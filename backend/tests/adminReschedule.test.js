const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");
const AppointmentRescheduleHistory = require("../models/AppointmentRescheduleHistory");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const adminBookings = require("../routes/adminBookings");
const { adminOnly, superAdminOnly } = require("../middleware/verifyToken");
const notify = require("../utils/bookingNotifications");
const push = require("../utils/pushNotifications");
const mailer = require("../utils/sendEmail");
const { decideAppointmentAccess } = require("../utils/appointmentRoomAccess");
const controller = require("../controllers/appointmentController");

const realNotifyRescheduled = notify.notifyBookingRescheduled;

const iso = (offsetDays) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
const FUTURE = iso(10);
const FUTURE2 = iso(11);
const PAST = iso(-3);
const NOTE = "Patient did not join; called him twice, internal remark XYZ";

describe("admin reschedule", () => {
  let replSet, server, base, app, admin, patient, D1, D2;
  let calls, pushes, emitted, evicted, rejoined;

  const fakeAuth = (req, res, next) => {
    const role = req.headers["x-test-role"];
    if (!role) return res.status(401).json({ msg: "No token provided." });
    req.user = { id: String(admin._id), role };
    next();
  };
  const call = async (method, path, body, role = "admin") => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { "content-type": "application/json", ...(role ? { "x-test-role": role } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: res.status, body: await res.json() };
  };
  const post = (id, body, role) => call("POST", `/${id}/reschedule`, body, role);
  const valid = (over = {}) => ({ date: FUTURE, time: "11:30", reason: "Patient not available", reasonNote: NOTE, notify: true, ...over });

  const makeDoctor = async (name) => {
    const d = await Doctor.create({ name, email: `${name.toLowerCase().replace(/\W/g, "")}@x.co`, password: "SecretPw1!" });
    const [firstName, surname] = name.split(" ");
    const e = await Enrollment.create({ firstName, surname, doctorId: d._id, email: `${firstName.toLowerCase()}@enroll.co`, approvalStatus: "approved", timezone: "Asia/Kolkata" });
    return { d, e, name };
  };
  const makeAppt = (status, over = {}) =>
    Appointment.create({
      patientId: patient._id, doctorId: D1.d._id, date: PAST, time: "10:00", status, patientTimezone: "Asia/Kolkata",
      appointmentDateTimeUtc: new Date(`${PAST}T04:30:00Z`), ...over,
    });
  const makeCat = (status, over = {}) =>
    CategoryConsultation.create({
      concern: "x", severity: "mild", supportType: "chat", urgency: "flexible", appointmentType: "FLEXIBLE_TIME",
      date: PAST, slot: "10:00 AM", patientId: patient._id, categoryName: "Women's Health", status,
      assignedDoctorId: D1.e._id, assignedDoctorName: D1.name, ...over,
    });
  const history = (id) => AppointmentRescheduleHistory.find({ appointmentId: id }).sort({ rescheduledAt: 1 }).lean();

  before(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    await Promise.all([Appointment.init(), CategoryConsultation.init(), AppointmentRescheduleHistory.init()]);
    app = express();
    app.use(express.json());
    app.set("io", { to: (room) => ({ emit: (ev, payload) => emitted.push({ room, ev, payload }) }) });
    app.set("evictAllFromAppointmentRoom", (id, opts) => evicted.push({ id: String(id), ...opts }));
    app.set("allowAppointmentRoomRejoin", (id) => rejoined.push(String(id)));
    app.use("/api/admin/bookings", adminBookings.create({ guard: [fakeAuth, adminOnly], superGuard: [fakeAuth, superAdminOnly] }));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}/api/admin/bookings`;

    notify.notifyBookingRescheduled = async (a) => { calls.push({ name: "rescheduled", ...a }); };
    push.sendPushToUser = (userId, payload) => { pushes.push({ userId: String(userId), ...payload }); };
  });
  after(async () => {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await replSet.stop();
  });
  beforeEach(async () => {
    calls = []; pushes = []; emitted = []; evicted = []; rejoined = [];
    await Promise.all([
      Appointment.deleteMany({}), CategoryConsultation.deleteMany({}), User.deleteMany({}), Doctor.deleteMany({}), Enrollment.deleteMany({}),
      mongoose.connection.collection("appointmentreschedulehistories").deleteMany({}),
    ]);
    admin = await User.create({ name: "Plain Admin", email: "pa@x.co", password: "SecretPw1!", role: "admin" });
    patient = await User.create({ name: "Rachel Secemski", email: "rachel@x.co", password: "SecretPw1!", country: "US" });
    D1 = await makeDoctor("Martin Perlin");
    D2 = await makeDoctor("Nobita Mestry");
  });

  // ── Permissions ────────────────────────────────────────────────────────────
  test("role matrix: admin and super admin may; doctor 403, patient 403, no auth 401, on all three endpoints", async () => {
    const b = await makeAppt("confirmed");
    for (const [method, path, body] of [
      ["POST", `/${b._id}/reschedule`, valid()],
      ["GET", `/${b._id}/reschedule-slots?date=${FUTURE}`, null],
      ["GET", `/${b._id}/reschedule-history`, null],
    ]) {
      assert.equal((await call(method, path, body, "")).status, 401, path);
      assert.equal((await call(method, path, body, "user")).status, 403, path);
      assert.equal((await call(method, path, body, "doctor")).status, 403, path);
    }
    assert.equal((await post(b._id, valid(), "superadmin")).status, 200);
    const b2 = await makeAppt("confirmed", { time: "12:00", appointmentDateTimeUtc: new Date(`${PAST}T06:30:00Z`) });
    assert.equal((await post(b2._id, valid({ time: "13:00" }), "admin")).status, 200);
    assert.equal((await history(b._id)).length, 1);
  });

  test("a forbidden or unauthenticated call changes nothing", async () => {
    const b = await makeAppt("confirmed");
    await post(b._id, valid(), "doctor");
    await post(b._id, valid(), "");
    const doc = await Appointment.findById(b._id).lean();
    assert.equal(doc.date, PAST);
    assert.equal(doc.rescheduleCount || 0, 0);
    assert.equal((await history(b._id)).length, 0);
  });

  // ── Happy path, both kinds ─────────────────────────────────────────────────
  test("appointment: moves date, time and UTC instant; keeps status; counts; appends history; returns the row", async () => {
    const b = await makeAppt("confirmed", { sessionStarted: true, paymentStatus: "paid", paymentAmount: 5000 });
    const res = await post(b._id, valid());
    assert.equal(res.status, 200);
    assert.equal(res.body.booking.status, "confirmed");
    assert.equal(res.body.booking.consultation.date, FUTURE);
    assert.equal(res.body.booking.consultation.time, "11:30");
    assert.equal(res.body.booking.rescheduleCount, 1);

    const doc = await Appointment.findById(b._id).lean();
    assert.equal(doc.status, "confirmed");
    assert.equal(doc.date, FUTURE);
    assert.equal(doc.time, "11:30");
    assert.equal(doc.appointmentDateTimeUtc.toISOString(), `${FUTURE}T06:00:00.000Z`); // 11:30 IST
    assert.equal(doc.rescheduleCount, 1);
    assert.ok(doc.lastRescheduledAt);
    assert.equal(doc.paymentAmount, 5000);
    assert.equal(doc.paymentStatus, "paid");

    const rows = await history(b._id);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].appointmentModel, "Appointment");
    assert.equal(rows[0].oldDate, PAST);
    assert.equal(rows[0].oldTime, "10:00");
    assert.equal(rows[0].newDate, FUTURE);
    assert.equal(rows[0].newTime, "11:30");
    assert.equal(rows[0].reason, "Patient not available");
    assert.equal(rows[0].reasonNote, NOTE);
    assert.equal(String(rows[0].rescheduledBy.id), String(admin._id));
    assert.equal(rows[0].rescheduledBy.name, "Plain Admin");
    assert.equal(rows[0].notified, true);
    assert.equal(rows[0].timezone, "Asia/Kolkata");
  });

  test("category: flexible booking changes slot (kept in its 'hh:mm AM' style); next-available changes assignedSlot", async () => {
    const flex = await makeCat("Confirmed");
    assert.equal((await post(flex._id, valid({ time: "17:30" }))).status, 200);
    const f = await CategoryConsultation.findById(flex._id).lean();
    assert.equal(f.date, FUTURE);
    assert.equal(f.slot, "05:30 PM");
    assert.equal(f.status, "Confirmed");
    assert.equal(f.rescheduleCount, 1);

    const next = await makeCat("Assigned", { urgency: "asap", appointmentType: "NEXT_AVAILABLE", slot: null, assignedSlot: "09:00 AM" });
    assert.equal((await post(next._id, valid({ time: "09:30" }))).status, 200);
    const n = await CategoryConsultation.findById(next._id).lean();
    assert.equal(n.assignedSlot, "09:30 AM");
    assert.equal(n.slot, null);
    assert.equal(n.status, "Assigned");
    assert.equal((await history(next._id))[0].appointmentModel, "CategoryConsultation");
  });

  // ── The main use case: the old time has already passed ─────────────────────
  for (const status of ["confirmed", "pending", "assigned"]) {
    test(`a ${status} appointment whose time has already passed can be rescheduled (only the new slot must be future)`, async () => {
      const b = await makeAppt(status);
      assert.ok(b.appointmentDateTimeUtc.getTime() < Date.now());
      const res = await post(b._id, valid());
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.equal((await Appointment.findById(b._id).lean()).status, status);
    });
  }
  for (const [label, status] of [["Confirmed", "Confirmed"], ["Pending", "Pending"], ["Assigned", "Assigned"]]) {
    test(`a ${label} category booking whose time has already passed can be rescheduled`, async () => {
      const b = await makeCat(status);
      assert.equal((await post(b._id, valid())).status, 200);
    });
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  test("400 for a new slot in the past, the unchanged slot, an off-grid time, a bad reason or a missing Other note", async () => {
    const b = await makeAppt("confirmed");
    const cases = [
      [valid({ date: PAST }), /future/],
      [valid({ date: iso(-1), time: "19:30" }), /future/],
      [valid({ date: PAST, time: "10:00" }), /current/],
      [valid({ time: "07:30" }), /08:00 to 19:30/],
      [valid({ time: "11:15" }), /08:00 to 19:30/],
      [valid({ time: "20:00" }), /08:00 to 19:30/],
      [valid({ date: "06-11-2026" }), /date/],
      [valid({ reason: "Because" }), /reason/],
      [valid({ reason: undefined }), /reason/],
      [valid({ reason: "Other", reasonNote: "  " }), /note is required/],
      [valid({ reasonNote: "x".repeat(501) }), /at most 500/],
    ];
    for (const [body, pattern] of cases) {
      const res = await post(b._id, body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.match(res.body.msg, pattern, JSON.stringify(body));
    }
    assert.equal((await history(b._id)).length, 0);
    assert.equal((await post("not-an-id", valid())).status, 400);
    assert.equal((await post(new mongoose.Types.ObjectId(), valid())).status, 404);
  });

  test("'Other' with a note is accepted; a note is optional for the other reasons", async () => {
    const b = await makeAppt("confirmed");
    assert.equal((await post(b._id, valid({ reason: "Other", reasonNote: "Power cut at clinic" }))).status, 200);
    assert.equal((await post(b._id, valid({ date: FUTURE2, reason: "Technical issue", reasonNote: undefined }))).status, 200);
  });

  // ── Blocked states ─────────────────────────────────────────────────────────
  test("409 for complete and cancelled bookings (both kinds); nothing written", async () => {
    for (const [make, status] of [[makeAppt, "complete"], [makeAppt, "cancelled"], [makeCat, "Completed"], [makeCat, "Cancelled"]]) {
      const b = await make(status);
      const res = await post(b._id, valid());
      assert.equal(res.status, 409, status);
      assert.equal(res.body.code, "closed");
      assert.equal((await history(b._id)).length, 0);
    }
  });

  test("409 'no_doctor' for a booking with no doctor, with a clear message", async () => {
    const a = await makeAppt("upcoming", { doctorId: null });
    const ra = await post(a._id, valid());
    assert.equal(ra.status, 409);
    assert.equal(ra.body.code, "no_doctor");
    assert.match(ra.body.msg, /Assign a doctor/);
    const c = await makeCat("Pending", { assignedDoctorId: null, assignedDoctorName: "" });
    assert.equal((await post(c._id, valid())).body.code, "no_doctor");
    const slots = await call("GET", `/${a._id}/reschedule-slots`);
    assert.equal(slots.body.canReschedule, false);
    assert.equal(slots.body.blockedCode, "no_doctor");
  });

  // ── Clash ──────────────────────────────────────────────────────────────────
  test("409 slot_taken when the same doctor has another active booking then (either collection); nothing changes", async () => {
    const mine = await makeAppt("confirmed");
    await makeAppt("pending", { date: FUTURE, time: "11:30", appointmentDateTimeUtc: new Date(`${FUTURE}T06:00:00Z`) });
    const r1 = await post(mine._id, valid());
    assert.equal(r1.status, 409);
    assert.equal(r1.body.code, "slot_taken");

    await makeCat("Confirmed", { date: FUTURE, slot: "12:00 PM" });
    const r2 = await post(mine._id, valid({ time: "12:00" }));
    assert.equal(r2.status, 409);
    assert.equal(r2.body.code, "slot_taken");

    // The same instant on another clock (a patient in New York booked 01:00 on the previous evening-style date).
    await makeAppt("assigned", { date: FUTURE, time: "00:00", patientTimezone: "America/New_York", appointmentDateTimeUtc: new Date(`${FUTURE}T09:00:00Z`) });
    const r3 = await post(mine._id, valid({ time: "14:30" })); // 14:30 IST = 09:00 UTC
    assert.equal(r3.status, 409);

    const doc = await Appointment.findById(mine._id).lean();
    assert.equal(doc.date, PAST);
    assert.equal((await history(mine._id)).length, 0);
    assert.equal(calls.length, 0);
  });

  test("another doctor's booking, a cancelled booking and a complete one do not block the slot", async () => {
    const mine = await makeAppt("confirmed");
    await makeAppt("confirmed", { doctorId: D2.d._id, date: FUTURE, time: "11:30", appointmentDateTimeUtc: new Date(`${FUTURE}T06:00:00Z`) });
    await makeAppt("cancelled", { date: FUTURE, time: "12:00", appointmentDateTimeUtc: new Date(`${FUTURE}T06:30:00Z`) });
    await makeAppt("complete", { date: FUTURE, time: "12:30", appointmentDateTimeUtc: new Date(`${FUTURE}T07:00:00Z`) });
    assert.equal((await post(mine._id, valid())).status, 200);
    const two = await makeAppt("confirmed", { time: "09:00", appointmentDateTimeUtc: new Date(`${PAST}T03:30:00Z`) });
    assert.equal((await post(two._id, valid({ time: "12:00" }))).status, 200);
    const three = await makeAppt("confirmed", { time: "09:30", appointmentDateTimeUtc: new Date(`${PAST}T04:00:00Z`) });
    assert.equal((await post(three._id, valid({ time: "12:30" }))).status, 200);
  });

  test("two admins moving different bookings into the same slot at once: exactly one wins, the other gets 409", async () => {
    const a = await makeAppt("confirmed");
    const c = await makeAppt("confirmed", { time: "09:00", appointmentDateTimeUtc: new Date(`${PAST}T03:30:00Z`) });
    const x = await makeCat("Confirmed");
    const results = await Promise.all([post(a._id, valid()), post(c._id, valid()), post(x._id, valid({ time: "11:30" }))]);
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [200, 409, 409]);
    const rows = await AppointmentRescheduleHistory.countDocuments({});
    assert.equal(rows, 1);
  });

  // ── History is append-only ─────────────────────────────────────────────────
  test("history: each move appends a row; the timeline starts with the original booking; rows cannot be changed or deleted", async () => {
    const b = await makeAppt("confirmed");
    await post(b._id, valid());
    await post(b._id, valid({ date: FUTURE2, time: "09:00", reason: "Doctor not available", reasonNote: "" }));
    const rows = await history(b._id);
    assert.equal(rows.length, 2);
    assert.equal(rows[1].oldDate, FUTURE);
    assert.equal(rows[1].oldTime, "11:30");

    const res = await call("GET", `/${b._id}/reschedule-history`);
    assert.equal(res.status, 200);
    assert.equal(res.body.count, 2);
    assert.equal(res.body.original.date, PAST);
    assert.equal(res.body.original.time, "10:00");
    assert.equal(res.body.changes[0].from.date, PAST);
    assert.equal(res.body.changes[1].to.time, "09:00");
    assert.equal(res.body.changes[0].reasonNote, NOTE);
    assert.equal(res.body.changes[0].by, "Plain Admin");
    assert.equal(res.body.current.date, FUTURE2);
    // Each slot is shown in the patient's zone AND in IST, labelled.
    assert.equal(res.body.timezone.patient, "Asia/Kolkata");
    assert.equal(res.body.timezone.ist, "Asia/Kolkata");
    assert.match(res.body.changes[0].to.patient.label, /11:30 AM/);
    assert.match(res.body.changes[0].to.ist.label, /11:30 AM/);

    const Model = AppointmentRescheduleHistory;
    await assert.rejects(() => Model.updateOne({ _id: rows[0]._id }, { $set: { reason: "x" } }), /append-only/);
    await assert.rejects(() => Model.updateMany({}, { $set: { reason: "x" } }), /append-only/);
    await assert.rejects(() => Model.findOneAndUpdate({ _id: rows[0]._id }, { reason: "x" }), /append-only/);
    await assert.rejects(() => Model.deleteOne({ _id: rows[0]._id }), /append-only/);
    await assert.rejects(() => Model.deleteMany({}), /append-only/);
    await assert.rejects(() => Model.findOneAndDelete({ _id: rows[0]._id }), /append-only/);
    const doc = await Model.findById(rows[0]._id);
    doc.reason = "x";
    await assert.rejects(() => doc.save(), /append-only/);
    await assert.rejects(() => doc.deleteOne(), /append-only/);
    assert.equal((await history(b._id)).length, 2);
    assert.equal((await history(b._id))[0].reason, "Patient not available");
  });

  test("a never-rescheduled booking has an empty timeline, and no edit or delete route exists", async () => {
    const b = await makeAppt("confirmed");
    const res = await call("GET", `/${b._id}/reschedule-history`);
    assert.equal(res.body.count, 0);
    assert.equal(res.body.original.date, PAST);
    for (const method of ["PUT", "PATCH", "DELETE"]) {
      const r = await fetch(`${base}/${b._id}/reschedule-history`, { method, headers: { "x-test-role": "admin", "content-type": "application/json" }, body: "{}" });
      assert.ok([404, 405].includes(r.status), `${method} -> ${r.status}`);
    }
  });

  test("zones: an Appointment without a recorded zone is shown as assumed UTC; a category booking as assumed IST", async () => {
    const a = await makeAppt("confirmed", { patientTimezone: "", appointmentDateTimeUtc: new Date(`${PAST}T10:00:00Z`) });
    const ha = await call("GET", `/${a._id}/reschedule-slots`);
    assert.equal(ha.body.timezone.patient, "UTC");
    assert.equal(ha.body.timezone.assumed, true);
    assert.match(ha.body.current.ist.label, /3:30 PM/); // 10:00 UTC = 15:30 IST
    const c = await makeCat("Confirmed");
    const hc = await call("GET", `/${c._id}/reschedule-slots`);
    assert.equal(hc.body.timezone.assumed, true);
    assert.equal(hc.body.timezone.patient, "Asia/Kolkata");
    const na = await makeAppt("confirmed", { patientTimezone: "America/New_York", appointmentDateTimeUtc: new Date(`${PAST}T14:00:00Z`) });
    const hn = await call("GET", `/${na._id}/reschedule-slots`);
    assert.equal(hn.body.timezone.assumed, false);
    assert.equal(hn.body.timezone.patient, "America/New_York");
  });

  // ── Slots for the modal ────────────────────────────────────────────────────
  test("slots: the 08:00-19:30 grid with booked, past and current marked", async () => {
    const mine = await makeAppt("confirmed", { date: FUTURE, time: "10:00", appointmentDateTimeUtc: new Date(`${FUTURE}T04:30:00Z`) });
    await makeAppt("assigned", { date: FUTURE, time: "10:30", appointmentDateTimeUtc: new Date(`${FUTURE}T05:00:00Z`) });
    await makeCat("Confirmed", { date: FUTURE, slot: "02:00 PM" });
    const res = await call("GET", `/${mine._id}/reschedule-slots?date=${FUTURE}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.canReschedule, true);
    assert.equal(res.body.slots.length, 24);
    assert.equal(res.body.slots[0].time, "08:00");
    assert.equal(res.body.slots[23].time, "19:30");
    const by = Object.fromEntries(res.body.slots.map((s) => [s.time, s.status]));
    assert.equal(by["10:00"], "current");
    assert.equal(by["10:30"], "booked");
    assert.equal(by["14:00"], "booked");
    assert.equal(by["11:00"], "available");
    const past = await call("GET", `/${mine._id}/reschedule-slots?date=${PAST}`);
    assert.ok(past.body.slots.every((s) => s.status === "past"));
    assert.equal((await call("GET", `/${mine._id}/reschedule-slots?date=bad`)).status, 400);
    const closed = await makeAppt("complete");
    assert.equal((await call("GET", `/${closed._id}/reschedule-slots?date=${FUTURE}`)).body.canReschedule, false);
  });

  // ── Call state ─────────────────────────────────────────────────────────────
  test("call state: the room is cleared and rejoin allowed; the booking stays confirmed and joinable; reopenedByAdmin is untouched", async () => {
    const reopened = { id: admin._id, name: "Old Admin", at: new Date("2026-01-01T00:00:00Z") };
    const b = await makeAppt("confirmed", { sessionStarted: true, reopenedByAdmin: reopened });
    assert.equal((await post(b._id, valid())).status, 200);
    assert.deepEqual(evicted, [{ id: String(b._id), reason: "rescheduled" }]);
    assert.deepEqual(rejoined, [String(b._id)]);
    const doc = await Appointment.findById(b._id).lean();
    assert.equal(doc.status, "confirmed");
    assert.equal(doc.sessionStarted, true);
    assert.equal(doc.reopenedByAdmin.name, "Old Admin");
    assert.equal(new Date(doc.reopenedByAdmin.at).toISOString(), "2026-01-01T00:00:00.000Z");
    // Both sides can still enter the room (access depends on status only).
    const patientAccess = await decideAppointmentAccess({ userId: patient._id, role: "user" }, b._id);
    const doctorAccess = await decideAppointmentAccess({ userId: D1.d._id, role: "doctor" }, b._id);
    assert.equal(patientAccess.allowed, true);
    assert.equal(doctorAccess.allowed, true);
    assert.ok(emitted.some((e) => e.ev === "appointment-updated" && e.room === `doctor_${D1.d._id}` && e.payload.rescheduled === true));
    assert.ok(emitted.some((e) => e.ev === "appointment-updated" && e.room === `patient_${patient._id}`));
  });

  test("a pending booking is not forced to confirmed (the doctor still confirms); a category reopen flag stays", async () => {
    const b = await makeCat("Assigned", { reopenedByAdmin: { id: admin._id, name: "Old Admin", at: new Date("2026-01-02T00:00:00Z") } });
    assert.equal((await post(b._id, valid())).status, 200);
    const doc = await CategoryConsultation.findById(b._id).lean();
    assert.equal(doc.status, "Assigned");
    assert.equal(doc.reopenedByAdmin.name, "Old Admin");
  });

  // ── Notifications ──────────────────────────────────────────────────────────
  test("notify on: patient and doctor get push and the rescheduled message, with the old time; the note is never passed", async () => {
    const b = await makeAppt("confirmed");
    await post(b._id, valid());
    assert.equal(calls.length, 1);
    assert.equal(calls[0].isCategory, false);
    assert.equal(calls[0].old.date, PAST);
    assert.equal(calls[0].old.time, "10:00");
    assert.equal(calls[0].booking.date, FUTURE);
    assert.deepEqual(pushes.map((p) => p.userId).sort(), [String(D1.d._id), String(patient._id)].sort());
    assert.ok(!JSON.stringify([calls, pushes]).includes("internal remark"));
    assert.ok(!JSON.stringify(emitted).includes("internal remark"));
  });

  test("notify off, or a testing booking: nothing is sent, but the move and the history are recorded (notified=false)", async () => {
    const b = await makeAppt("confirmed");
    await post(b._id, valid({ notify: false }));
    assert.deepEqual([calls, pushes], [[], []]);
    assert.equal((await history(b._id))[0].notified, false);
    assert.ok(emitted.some((e) => e.ev === "appointment-updated"));

    const t = await makeAppt("confirmed", { isTesting: true, time: "09:00", appointmentDateTimeUtc: new Date(`${PAST}T03:30:00Z`) });
    await post(t._id, valid({ time: "13:00" }));
    assert.deepEqual([calls, pushes], [[], []]);
    assert.equal((await history(t._id))[0].notified, false);
  });

  test("the real message shows earlier and new times to the patient and the doctor, and never the reason or note", async () => {
    const sent = [];
    const realSend = mailer.sendBookingNotificationEmail;
    mailer.sendBookingNotificationEmail = async (to, payload) => { sent.push({ to, ...payload }); };
    try {
      const b = await makeAppt("confirmed");
      await post(b._id, valid({ notify: false }));
      const fresh = await Appointment.findById(b._id).lean();
      await realNotifyRescheduled({ booking: fresh, isCategory: false, old: { date: PAST, time: "10:00", utc: new Date(`${PAST}T04:30:00Z`) } });
    } finally {
      mailer.sendBookingNotificationEmail = realSend;
    }
    assert.deepEqual(sent.map((s) => s.to).sort(), ["martinperlin@x.co", "rachel@x.co"]);
    for (const s of sent) {
      const rows = Object.fromEntries(s.rows);
      assert.ok(rows["Earlier"], "earlier row");
      assert.ok(rows["New date / time"], "new row");
      assert.notEqual(rows["Earlier"], rows["New date / time"]);
      const text = JSON.stringify(s);
      assert.ok(!text.includes("internal remark"));
      assert.ok(!text.includes("Patient not available"));
    }
  });

  // ── Read-only views for doctor and patient ─────────────────────────────────
  const callController = async (fn, req) => {
    let out;
    await fn(req, { status: () => ({ json: (v) => { out = v; } }) });
    return out;
  };

  test("doctor and patient responses carry a read-only reschedule summary and never the reason or note", async () => {
    const b = await makeAppt("confirmed");
    const c = await makeCat("Confirmed", { date: PAST, slot: "03:00 PM" });
    await post(b._id, valid());
    await post(b._id, valid({ date: FUTURE2, time: "09:00", reason: "Other", reasonNote: "second internal remark" }));
    await post(c._id, valid({ time: "16:00" }));

    const doctorList = await callController(controller.getDoctorAppointments, { user: { id: String(D1.d._id), role: "doctor" } });
    const patientList = await callController(controller.getPatientAppointments, { user: { id: String(patient._id), role: "user" } });
    const doctorOne = await callController(controller.getDoctorOwnAppointment, { user: { id: String(D1.d._id) }, params: { id: String(b._id) } });
    const patientOne = await callController(controller.getPatientOwnAppointment, { user: { id: String(patient._id) }, params: { id: String(b._id) } });

    for (const payload of [doctorList, patientList, doctorOne, patientOne]) {
      const text = JSON.stringify(payload);
      assert.ok(!text.includes("internal remark"), "no note");
      assert.ok(!text.includes("Patient not available"), "no reason");
      assert.ok(!text.includes("reasonNote"));
    }
    const mine = (list, id) => list.find((x) => String(x._id) === String(id));
    for (const row of [mine(doctorList, b._id), mine(patientList, b._id), doctorOne, patientOne]) {
      assert.equal(row.reschedule.count, 2);
      assert.equal(row.reschedule.by, "admin");
      assert.equal(row.reschedule.originalDate, PAST);
      assert.equal(row.reschedule.originalTime, "10:00");
      assert.equal(row.reschedule.previousDate, FUTURE);
      assert.equal(row.reschedule.previousTime, "11:30");
      assert.equal(row.date, FUTURE2);
      assert.equal(row.time, "09:00");
    }
    const cat = mine(doctorList, c._id);
    assert.equal(cat.reschedule.count, 1);
    assert.equal(cat.time, "04:00 PM");
    const never = await makeAppt("pending", { time: "12:30", appointmentDateTimeUtc: new Date(`${PAST}T07:00:00Z`) });
    const list2 = await callController(controller.getPatientAppointments, { user: { id: String(patient._id), role: "user" } });
    assert.equal(mine(list2, never._id).reschedule, undefined);
  });

  test("the admin list rows carry rescheduleCount and lastRescheduledAt", async () => {
    const b = await makeAppt("confirmed");
    await post(b._id, valid());
    const res = await call("GET", `/${b._id}`);
    assert.equal(res.body.booking.rescheduleCount, 1);
    assert.ok(res.body.booking.lastRescheduledAt);
    const fresh = await makeAppt("pending", { time: "08:00", appointmentDateTimeUtc: new Date(`${PAST}T02:30:00Z`) });
    assert.equal((await call("GET", `/${fresh._id}`)).body.booking.rescheduleCount, 0);
  });
});
