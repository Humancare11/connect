const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const adminBookings = require("../routes/adminBookings");
const { adminOnly, superAdminOnly } = require("../middleware/verifyToken");
const notify = require("../utils/bookingNotifications");
const push = require("../utils/pushNotifications");
const mailer = require("../utils/sendEmail");
const { decideAppointmentAccess } = require("../utils/appointmentRoomAccess");

// The real implementation, kept before the recorders below replace it.
const realNotifyPatient = notify.notifyPatientDoctorChanged;
const realNotifyCancelled = notify.notifyDoctorBookingCancelled;

const KINDS = ["appointment", "category"];

// Stored status per kind for each unified status.
const STORED = {
  appointment: { upcoming: "upcoming", pending: "pending", assigned: "assigned", confirmed: "confirmed", complete: "complete", cancelled: "cancelled" },
  category: { upcoming: "Pending", pending: "Pending", assigned: "Assigned", confirmed: "Confirmed", complete: "Completed", cancelled: "Cancelled" },
};

describe("admin booking actions", () => {
  let mongod, server, base, app, admin, patient, D1, D2, D3;
  let calls, pushes, emitted, evicted;

  const fakeAuth = (req, res, next) => {
    const role = req.headers["x-test-role"];
    if (!role) return res.status(401).json({ msg: "No token provided." });
    req.user = { id: String(admin._id), role };
    next();
  };

  // Cancelling is for super admins only, so a plain cancel call is made as one by default; tests of the rule pass a role.
  const post = async (path, body = {}, role = path.endsWith("/cancel") ? "superadmin" : "admin") => {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(role ? { "x-test-role": role } : {}) },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };

  const makeDoctor = async (name, { approved = true, disabled = false } = {}) => {
    const d = await Doctor.create({ name, email: `${name.toLowerCase().replace(/\W/g, "")}@x.co`, password: "SecretPw1!", accountDisabled: disabled });
    const [firstName, surname] = name.split(" ");
    const e = await Enrollment.create({
      firstName, surname, doctorId: d._id, email: `${firstName.toLowerCase()}@enroll.co`,
      approvalStatus: approved ? "approved" : "pending", timezone: "Asia/Kolkata",
    });
    return { d, e, name };
  };

  // A booking of `kind` in a unified status, optionally with a doctor.
  const make = (kind, status, { doctor, ...extra } = {}) =>
    kind === "appointment"
      ? Appointment.create({
          patientId: patient._id, date: "2026-11-01", time: "10:00 AM", status: STORED.appointment[status],
          ...(doctor ? { doctorId: doctor.d._id } : {}), ...extra,
        })
      : CategoryConsultation.create({
          concern: "x", severity: "mild", supportType: "chat", urgency: "flexible", appointmentType: "FLEXIBLE_TIME",
          date: "2026-11-01", slot: "10:00 AM", patientId: patient._id, categoryName: "Women's Health",
          status: STORED.category[status],
          ...(doctor ? { assignedDoctorId: doctor.e._id, assignedDoctorName: doctor.name } : {}), ...extra,
        });

  // What the doctor's own Confirm does to the booking (the admin has no Confirm).
  const doctorConfirms = (kind, id) =>
    (kind === "appointment" ? Appointment : CategoryConsultation).updateOne(
      { _id: id },
      { $set: { status: STORED[kind].confirmed, ...(kind === "appointment" ? { sessionStarted: true } : {}) } }
    );
  const fresh = (kind, id) => (kind === "appointment" ? Appointment : CategoryConsultation).findById(id).lean();
  const keyOf = (kind, D) => String(kind === "appointment" ? D.d._id : D.e._id);
  const doctorKeyOf = (kind, doc) => String(kind === "appointment" ? doc.doctorId : doc.assignedDoctorId);
  const originalKeyOf = (doc) => (doc.originalDoctorId ? String(doc.originalDoctorId) : "");
  const doctorChangedCalls = () => calls.filter((c) => c.name === "doctorChanged");
  const patientCalls = () => calls.filter((c) => c.name === "patientChanged");
  const nothingSent = () => {
    assert.deepEqual(calls, []);
    assert.deepEqual(pushes, []);
    assert.equal(emitted.some((e) => e.ev === "new-appointment"), false);
  };

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    app = express();
    app.use(express.json());
    app.set("io", { to: (room) => ({ emit: (ev, payload) => emitted.push({ room, ev, payload }) }) });
    app.set("evictDoctorFromAppointmentRoom", (id, doctorUserId) => evicted.push({ id: String(id), doctorUserId }));
    app.use("/api/admin/bookings", adminBookings.create({ guard: [fakeAuth, adminOnly], superGuard: [fakeAuth, superAdminOnly] }));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}/api/admin/bookings`;

    // Recorders in place of emails and push (the actions call these through the module objects).
    notify.notifyAppointmentDoctorChanged = async (a) => { calls.push({ name: "doctorChanged", kind: "appointment", ...a }); };
    notify.notifyConsultationDoctorChanged = async (a) => { calls.push({ name: "doctorChanged", kind: "category", ...a }); };
    notify.notifyPatientDoctorChanged = async (a) => { calls.push({ name: "patientChanged", ...a }); };
    notify.notifyDoctorBookingCancelled = async (a) => { calls.push({ name: "doctorCancelled", ...a }); };
    push.sendPushToUser = (userId, payload) => { pushes.push({ userId: String(userId), ...payload }); };
  });
  after(async () => {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    calls = []; pushes = []; emitted = []; evicted = [];
    await Promise.all([Appointment.deleteMany({}), CategoryConsultation.deleteMany({}), User.deleteMany({}), Doctor.deleteMany({}), Enrollment.deleteMany({})]);
    admin = await User.create({ name: "Super Admin", email: "sa@x.co", password: "SecretPw1!", role: "superadmin" });
    patient = await User.create({ name: "Rachel Secemski", email: "rachel@x.co", password: "SecretPw1!", country: "US" });
    D1 = await makeDoctor("Martin Perlin");
    D2 = await makeDoctor("Nobita Mestry");
    D3 = await makeDoctor("Farah Siddiqui");
  });

  test("every action is admin-only", async () => {
    const b = await make("appointment", "upcoming");
    for (const path of ["assign-doctor", "alternate-doctor", "revert-doctor", "reactivate", "cancel"]) {
      assert.equal((await post(`/${b._id}/${path}`, {}, "")).status, 401, path);
      assert.equal((await post(`/${b._id}/${path}`, {}, "user")).status, 403, path);
      assert.equal((await post(`/${b._id}/${path}`, {}, "doctor")).status, 403, path);
    }
  });

  for (const kind of KINDS) {
    describe(`${kind}: assign doctor`, () => {
      test("moves Upcoming to Assigned, records who assigned, locks the call, notifies the doctor and patient", async () => {
        const b = await make(kind, "upcoming");
        const res = await post(`/${b._id}/assign-doctor`, { doctorId: String(D1.e._id) });
        assert.equal(res.status, 200);
        assert.equal(res.body.booking.status, "assigned");
        assert.equal(res.body.booking.doctorName, kind === "appointment" ? "Martin Perlin" : "Martin Perlin");
        assert.equal(res.body.booking.assignedBy, "Super Admin");
        assert.equal(res.body.paid, false);

        const doc = await fresh(kind, b._id);
        assert.equal(doc.status, STORED[kind].assigned);
        assert.equal(doctorKeyOf(kind, doc), keyOf(kind, D1));
        assert.equal(String(doc.assignedBy.id), String(admin._id));
        assert.equal(doc.assignedBy.name, "Super Admin");
        assert.equal(doc.assignedBy.email, "sa@x.co");
        assert.ok(doc.assignedBy.assignedAt);
        if (kind === "appointment") {
          assert.equal(doc.sessionStarted, false);
          assert.equal(doc.doctorTimezone, "Asia/Kolkata");
        }

        assert.equal(doctorChangedCalls().length, 1);
        assert.equal(doctorChangedCalls()[0].kind, kind);
        assert.ok(kind === "category" ? doctorChangedCalls()[0].previousEnrollmentId === null : doctorChangedCalls()[0].previousDoctorId === null);
        assert.equal(patientCalls().length, 1);
        assert.equal(patientCalls()[0].reassigned, false);
        assert.equal(patientCalls()[0].isCategory, kind === "category");
        assert.ok(emitted.some((e) => e.ev === "new-appointment"));
      });

      test("returns the paid flag", async () => {
        const b = await make(kind, "upcoming", { paymentStatus: "paid" });
        assert.equal((await post(`/${b._id}/assign-doctor`, { doctorId: String(D1.e._id) })).body.paid, true);
      });

      test("409 when the booking already has a doctor, or is not Upcoming", async () => {
        const hasDoctor = await make(kind, "assigned", { doctor: D1 });
        const r1 = await post(`/${hasDoctor._id}/assign-doctor`, { doctorId: String(D2.e._id) });
        assert.equal(r1.status, 409);
        assert.match(r1.body.msg, /already has a doctor/);

        for (const status of ["complete", "cancelled"]) {
          const closed = await make(kind, status);
          const res = await post(`/${closed._id}/assign-doctor`, { doctorId: String(D1.e._id) });
          assert.equal(res.status, 409, status);
          assert.match(res.body.msg, new RegExp(status));
        }
        assert.deepEqual(calls, []);
      });

      test("400/404 for a missing, unknown, unapproved or disabled doctor and a bad booking id", async () => {
        const b = await make(kind, "upcoming");
        const unapproved = await makeDoctor("Pending Person", { approved: false });
        const disabled = await makeDoctor("Disabled Person", { disabled: true });
        assert.equal((await post(`/${b._id}/assign-doctor`, {})).status, 400);
        assert.equal((await post(`/${b._id}/assign-doctor`, { doctorId: "nope" })).status, 400);
        assert.equal((await post(`/${b._id}/assign-doctor`, { doctorId: String(new mongoose.Types.ObjectId()) })).status, 404);
        assert.equal((await post(`/${b._id}/assign-doctor`, { doctorId: String(unapproved.e._id) })).status, 400);
        assert.equal((await post(`/${b._id}/assign-doctor`, { doctorId: String(disabled.e._id) })).status, 400);
        assert.equal((await post(`/nope/assign-doctor`, { doctorId: String(D1.e._id) })).status, 400);
        assert.equal((await post(`/${new mongoose.Types.ObjectId()}/assign-doctor`, { doctorId: String(D1.e._id) })).status, 404);
        assert.equal((await fresh(kind, b._id)).status, STORED[kind].upcoming);
      });

      test("409 when the doctor already has an active booking at that slot (in either collection)", async () => {
        await make("appointment", "confirmed", { doctor: D1 });
        const b = await make(kind, "upcoming");
        const res = await post(`/${b._id}/assign-doctor`, { doctorId: String(D1.e._id) });
        assert.equal(res.status, 409);
        assert.match(res.body.msg, /already booked/);
        assert.equal((await fresh(kind, b._id)).status, STORED[kind].upcoming);

        await Appointment.deleteMany({ _id: { $ne: b._id } });
        await make("category", "confirmed", { doctor: D1 });
        assert.equal((await post(`/${b._id}/assign-doctor`, { doctorId: String(D1.e._id) })).status, 409);

        // A different doctor is fine, and so is a cancelled booking at that slot.
        assert.equal((await post(`/${b._id}/assign-doctor`, { doctorId: String(D2.e._id) })).status, 200);
      });

      test("a testing booking is assigned but sends no email or push", async () => {
        const b = await make(kind, "upcoming", { isTesting: true });
        assert.equal((await post(`/${b._id}/assign-doctor`, { doctorId: String(D1.e._id) })).status, 200);
        assert.equal((await fresh(kind, b._id)).status, STORED[kind].assigned);
        nothingSent();
      });

      test("409 for the loser when another admin changes the booking in between", async () => {
        const b = await make(kind, "upcoming");
        const realFindById = Enrollment.findById;
        // After this request has read the booking, another admin assigns D2 first.
        Enrollment.findById = (...args) => ({
          lean: async () => {
            Enrollment.findById = realFindById;
            await (kind === "appointment" ? Appointment : CategoryConsultation).updateOne(
              { _id: b._id },
              kind === "appointment"
                ? { $set: { doctorId: D2.d._id, status: "assigned" } }
                : { $set: { assignedDoctorId: D2.e._id, status: "Assigned" } }
            );
            return realFindById.apply(Enrollment, args).lean();
          },
        });
        try {
          const res = await post(`/${b._id}/assign-doctor`, { doctorId: String(D1.e._id) });
          assert.equal(res.status, 409);
          assert.match(res.body.msg, /just changed/);
        } finally {
          Enrollment.findById = realFindById;
        }
        assert.equal(doctorKeyOf(kind, await fresh(kind, b._id)), keyOf(kind, D2));
        assert.deepEqual(calls, []);
      });
    });

    describe(`${kind}: alternate doctor`, () => {
      test("replaces the doctor, keeps the original, notifies new doctor, removed doctor and patient", async () => {
        const b = await make(kind, "assigned", { doctor: D1 });
        const res = await post(`/${b._id}/alternate-doctor`, { doctorId: String(D2.e._id) });
        assert.equal(res.status, 200);
        assert.equal(res.body.booking.doctorName, "Nobita Mestry");
        assert.equal(res.body.booking.originalDoctorName, "Martin Perlin");

        const doc = await fresh(kind, b._id);
        assert.equal(doctorKeyOf(kind, doc), keyOf(kind, D2));
        assert.equal(originalKeyOf(doc), keyOf(kind, D1));
        assert.equal(doc.originalDoctorName, "Martin Perlin");
        assert.equal(doc.assignedBy.name, "Super Admin");

        assert.equal(doctorChangedCalls().length, 1);
        const call = doctorChangedCalls()[0];
        // The notifier emails the new doctor and, because `previous*` is set, the removed one.
        assert.equal(String(kind === "category" ? call.previousEnrollmentId : call.previousDoctorId), keyOf(kind, D1));
        assert.equal(patientCalls().length, 1);
        assert.equal(patientCalls()[0].reassigned, true);
        assert.deepEqual(evicted, [{ id: String(b._id), doctorUserId: String(D1.d._id) }]);
      });

      test("a second alternate never overwrites the original doctor", async () => {
        const b = await make(kind, "assigned", { doctor: D1 });
        await post(`/${b._id}/alternate-doctor`, { doctorId: String(D2.e._id) });
        const second = await post(`/${b._id}/alternate-doctor`, { doctorId: String(D3.e._id) });
        assert.equal(second.status, 200);
        const doc = await fresh(kind, b._id);
        assert.equal(doctorKeyOf(kind, doc), keyOf(kind, D3));
        assert.equal(originalKeyOf(doc), keyOf(kind, D1));
        assert.equal(doc.originalDoctorName, "Martin Perlin");
        assert.equal(second.body.booking.originalDoctorName, "Martin Perlin");
      });

      test("Confirmed goes back to Assigned and the call is locked until the new doctor confirms", async () => {
        const b = await make(kind, "confirmed", { doctor: D1, ...(kind === "appointment" ? { sessionStarted: true } : {}) });
        const res = await post(`/${b._id}/alternate-doctor`, { doctorId: String(D2.e._id) });
        assert.equal(res.body.booking.status, "assigned");
        const doc = await fresh(kind, b._id);
        assert.equal(doc.status, STORED[kind].assigned);
        if (kind === "appointment") assert.equal(doc.sessionStarted, false);
      });

      test("Assigned stays Assigned and Pending becomes Assigned: an admin's change always ends in Assigned", async () => {
        // Different target doctors, since every booking here shares one slot.
        for (const [status, target] of [["assigned", D2], ["pending", D3]]) {
          const b = await make(kind, status, { doctor: D1 });
          const res = await post(`/${b._id}/alternate-doctor`, { doctorId: String(target.e._id) });
          assert.equal(res.status, 200, status);
          assert.equal(res.body.booking.status, "assigned", status);
          assert.equal((await fresh(kind, b._id)).status, STORED[kind].assigned, status);
        }
      });

      test("assignedBy follows the admin who made the change", async () => {
        const other = await User.create({ name: "Other Admin", email: "oa@x.co", password: "SecretPw1!", role: "admin" });
        const b = await make(kind, "assigned", { doctor: D1, assignedBy: { id: other._id, name: "Other Admin", email: "oa@x.co" } });
        const res = await post(`/${b._id}/alternate-doctor`, { doctorId: String(D2.e._id) });
        assert.equal(res.body.booking.assignedBy, "Super Admin");
      });

      test("409 for Complete or Cancelled, and for a booking with no doctor", async () => {
        for (const status of ["complete", "cancelled"]) {
          const b = await make(kind, status, { doctor: D1 });
          assert.equal((await post(`/${b._id}/alternate-doctor`, { doctorId: String(D2.e._id) })).status, 409, status);
        }
        const none = await make(kind, "upcoming");
        const res = await post(`/${none._id}/alternate-doctor`, { doctorId: String(D2.e._id) });
        assert.equal(res.status, 409);
        assert.match(res.body.msg, /Assign a doctor first/);
        assert.deepEqual(calls, []);
      });

      test("400 when the new doctor is the current one", async () => {
        const b = await make(kind, "assigned", { doctor: D1 });
        const res = await post(`/${b._id}/alternate-doctor`, { doctorId: String(D1.e._id) });
        assert.equal(res.status, 400);
        assert.equal(originalKeyOf(await fresh(kind, b._id)), "");
      });

      test("409 when the new doctor is busy at that slot", async () => {
        await make("appointment", "confirmed", { doctor: D2 });
        const b = await make(kind, "assigned", { doctor: D1 });
        const res = await post(`/${b._id}/alternate-doctor`, { doctorId: String(D2.e._id) });
        assert.equal(res.status, 409);
        assert.equal(doctorKeyOf(kind, await fresh(kind, b._id)), keyOf(kind, D1));
      });

      test("400 for an unapproved doctor", async () => {
        const unapproved = await makeDoctor("Pending Person", { approved: false });
        const b = await make(kind, "assigned", { doctor: D1 });
        assert.equal((await post(`/${b._id}/alternate-doctor`, { doctorId: String(unapproved.e._id) })).status, 400);
      });

      test("a testing booking changes doctor but sends no email or push", async () => {
        const b = await make(kind, "confirmed", { doctor: D1, isTesting: true });
        assert.equal((await post(`/${b._id}/alternate-doctor`, { doctorId: String(D2.e._id) })).status, 200);
        assert.equal(doctorKeyOf(kind, await fresh(kind, b._id)), keyOf(kind, D2));
        nothingSent();
      });

      test("409 for the loser when another admin changes the doctor in between", async () => {
        const b = await make(kind, "assigned", { doctor: D1 });
        const realFindById = Enrollment.findById;
        Enrollment.findById = (...args) => ({
          lean: async () => {
            Enrollment.findById = realFindById;
            await (kind === "appointment" ? Appointment : CategoryConsultation).updateOne(
              { _id: b._id },
              kind === "appointment" ? { $set: { doctorId: D3.d._id } } : { $set: { assignedDoctorId: D3.e._id } }
            );
            return realFindById.apply(Enrollment, args).lean();
          },
        });
        try {
          const res = await post(`/${b._id}/alternate-doctor`, { doctorId: String(D2.e._id) });
          assert.equal(res.status, 409);
        } finally {
          Enrollment.findById = realFindById;
        }
        const doc = await fresh(kind, b._id);
        assert.equal(doctorKeyOf(kind, doc), keyOf(kind, D3));
        assert.equal(originalKeyOf(doc), "");
        assert.deepEqual(calls, []);
      });
    });

    describe(`${kind}: go back to the original doctor`, () => {
      test("restores the original, clears the record, and applies Confirmed -> Assigned", async () => {
        const b = await make(kind, "assigned", { doctor: D1 });
        await post(`/${b._id}/alternate-doctor`, { doctorId: String(D2.e._id) });
        await doctorConfirms(kind, b._id); // the new doctor confirms
        calls = []; evicted = [];

        const res = await post(`/${b._id}/revert-doctor`);
        assert.equal(res.status, 200);
        assert.equal(res.body.booking.doctorName, "Martin Perlin");
        assert.equal(res.body.booking.originalDoctorName, "");
        assert.equal(res.body.booking.status, "assigned");

        const doc = await fresh(kind, b._id);
        assert.equal(doctorKeyOf(kind, doc), keyOf(kind, D1));
        assert.equal(originalKeyOf(doc), "");
        assert.equal(doc.originalDoctorName, "");
        assert.equal(doc.status, STORED[kind].assigned);
        if (kind === "appointment") assert.equal(doc.sessionStarted, false);

        // The restored doctor and the removed one are both told, and so is the patient.
        assert.equal(doctorChangedCalls().length, 1);
        assert.equal(String(kind === "category" ? doctorChangedCalls()[0].previousEnrollmentId : doctorChangedCalls()[0].previousDoctorId), keyOf(kind, D2));
        assert.equal(patientCalls().length, 1);
        assert.deepEqual(evicted, [{ id: String(b._id), doctorUserId: String(D2.d._id) }]);
      });

      test("works after several alternates (goes back to the very first doctor)", async () => {
        const b = await make(kind, "assigned", { doctor: D1 });
        await post(`/${b._id}/alternate-doctor`, { doctorId: String(D2.e._id) });
        await post(`/${b._id}/alternate-doctor`, { doctorId: String(D3.e._id) });
        assert.equal((await post(`/${b._id}/revert-doctor`)).status, 200);
        assert.equal(doctorKeyOf(kind, await fresh(kind, b._id)), keyOf(kind, D1));
      });

      test("409 with no original, or on a Complete or Cancelled booking", async () => {
        const plain = await make(kind, "assigned", { doctor: D1 });
        assert.equal((await post(`/${plain._id}/revert-doctor`)).status, 409);

        for (const status of ["complete", "cancelled"]) {
          const b = await make(kind, status, { doctor: D2, originalDoctorId: kind === "appointment" ? D1.d._id : D1.e._id, originalDoctorName: "Martin Perlin" });
          assert.equal((await post(`/${b._id}/revert-doctor`)).status, 409, status);
        }
      });

      test("409 when the original doctor is no longer approved, or is busy at that slot", async () => {
        const b = await make(kind, "assigned", { doctor: D2, originalDoctorId: kind === "appointment" ? D1.d._id : D1.e._id, originalDoctorName: "Martin Perlin" });
        await make("appointment", "confirmed", { doctor: D1 });
        const busy = await post(`/${b._id}/revert-doctor`);
        assert.equal(busy.status, 409);
        assert.match(busy.body.msg, /already booked/);

        await Appointment.deleteMany({ _id: { $ne: b._id } });
        await Enrollment.updateOne({ _id: D1.e._id }, { $set: { approvalStatus: "rejected" } });
        const gone = await post(`/${b._id}/revert-doctor`);
        assert.equal(gone.status, 409);
        assert.match(gone.body.msg, /no longer available/);
        assert.equal(doctorKeyOf(kind, await fresh(kind, b._id)), keyOf(kind, D2));
      });

      test("a testing booking goes back but sends no email or push", async () => {
        const b = await make(kind, "assigned", { doctor: D1, isTesting: true });
        await post(`/${b._id}/alternate-doctor`, { doctorId: String(D2.e._id) });
        assert.equal((await post(`/${b._id}/revert-doctor`)).status, 200);
        nothingSent();
      });
    });

    describe(`${kind}: cancel`, () => {
      const cancelCalls = () => calls.filter((c) => c.name === "doctorCancelled");
      const recordEvictions = () => {
        const seen = [];
        app.set("evictAllFromAppointmentRoom", (id, opts) => seen.push({ id: String(id), ...opts }));
        return seen;
      };
      beforeEach(() => app.set("evictAllFromAppointmentRoom", undefined));

      test("cancels an open booking, records reason and who, closes the call room, tells the patient and the doctor", async () => {
        for (const status of ["pending", "assigned", "confirmed"]) {
          calls = []; pushes = []; emitted = [];
          const evictions = recordEvictions();
          const b = await make(kind, status, { doctor: D1, paymentStatus: "paid" });
          const res = await post(`/${b._id}/cancel`, { reason: "Doctor unavailable" });
          assert.equal(res.status, 200, status);
          assert.equal(res.body.booking.status, "cancelled");
          assert.equal(res.body.paid, true);

          const doc = await fresh(kind, b._id);
          assert.equal(doc.status, STORED[kind].cancelled);
          assert.equal(doc.cancelReason, "Doctor unavailable");
          assert.equal(String(doc.cancelledBy.id), String(admin._id));
          assert.equal(doc.cancelledBy.name, "Super Admin");
          assert.equal(doc.cancelledBy.email, "sa@x.co");
          assert.ok(doc.cancelledAt);

          assert.deepEqual(evictions, [{ id: String(b._id), reason: "cancelled" }]);
          for (const room of ["admin_room", `patient_${patient._id}`, `doctor_${D1.d._id}`]) {
            assert.ok(emitted.some((e) => e.room === room && e.payload.status === "cancelled"), room);
          }
          assert.equal(pushes.length, 1);
          assert.equal(pushes[0].userId, String(patient._id));
          assert.equal(pushes[0].title, "Appointment cancelled");
          assert.equal(cancelCalls().length, 1);
          assert.equal(cancelCalls()[0].isCategory, kind === "category");
          assert.equal(String(cancelCalls()[0].booking._id), String(b._id));
        }
      });

      test("an unpaid booking reports paid: false, and a booking with no doctor sends no doctor email", async () => {
        const b = await make(kind, "upcoming");
        const res = await post(`/${b._id}/cancel`, { reason: "Duplicate booking" });
        assert.equal(res.status, 200);
        assert.equal(res.body.paid, false);
        assert.equal(cancelCalls().length, 0);
        assert.equal(pushes.length, 1);
      });

      test("a reason is required and must be one of the five", async () => {
        const b = await make(kind, "assigned", { doctor: D1 });
        for (const body of [{}, { reason: "" }, { reason: "Changed my mind" }, { reason: "patient requested" }, { reason: 5 }]) {
          assert.equal((await post(`/${b._id}/cancel`, body)).status, 400, JSON.stringify(body));
        }
        assert.equal((await fresh(kind, b._id)).status, STORED[kind].assigned);
        for (const reason of ["Patient requested", "Doctor unavailable", "Payment failed", "Duplicate booking", "Testing booking"]) {
          const each = await make(kind, "upcoming");
          assert.equal((await post(`/${each._id}/cancel`, { reason })).status, 200, reason);
          assert.equal((await fresh(kind, each._id)).cancelReason, reason);
        }
      });

      test("409 on Complete or Cancelled, 404/400 for an unknown or bad id, and nothing is sent", async () => {
        for (const status of ["complete", "cancelled"]) {
          const b = await make(kind, status, { doctor: D1 });
          const res = await post(`/${b._id}/cancel`, { reason: "Patient requested" });
          assert.equal(res.status, 409, status);
          assert.match(res.body.msg, new RegExp(status));
        }
        assert.equal((await post(`/${new mongoose.Types.ObjectId()}/cancel`, { reason: "Patient requested" })).status, 404);
        assert.equal((await post(`/nope/cancel`, { reason: "Patient requested" })).status, 400);
        assert.deepEqual(calls, []);
        assert.deepEqual(pushes, []);
      });

      test("the doctor's slot is released: a cancelled booking no longer blocks it", async () => {
        const first = await make("appointment", "confirmed", { doctor: D1 });
        const second = await make(kind, "upcoming");
        assert.equal((await post(`/${second._id}/assign-doctor`, { doctorId: String(D1.e._id) })).status, 409);

        assert.equal((await post(`/${first._id}/cancel`, { reason: "Patient requested" })).status, 200);
        assert.equal((await post(`/${second._id}/assign-doctor`, { doctorId: String(D1.e._id) })).status, 200);
      });

      test("a cancelled category booking frees the slot too", async () => {
        const first = await make("category", "confirmed", { doctor: D1 });
        const second = await make(kind, "upcoming");
        assert.equal((await post(`/${second._id}/assign-doctor`, { doctorId: String(D1.e._id) })).status, 409);
        await post(`/${first._id}/cancel`, { reason: "Doctor unavailable" });
        assert.equal((await post(`/${second._id}/assign-doctor`, { doctorId: String(D1.e._id) })).status, 200);
      });

      test("two admins cancelling at once: exactly one wins, the other gets 409", async () => {
        const b = await make(kind, "confirmed", { doctor: D1 });
        const results = await Promise.all([
          post(`/${b._id}/cancel`, { reason: "Patient requested" }),
          post(`/${b._id}/cancel`, { reason: "Doctor unavailable" }),
        ]);
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
        assert.equal(pushes.length, 1);
      });

      test("409 for the loser when the booking changes between the read and the write", async () => {
        const b = await make(kind, "assigned", { doctor: D1 });
        const Model = kind === "appointment" ? Appointment : CategoryConsultation;
        const real = Model.findOneAndUpdate;
        Model.findOneAndUpdate = async function (...args) {
          Model.findOneAndUpdate = real;
          // Another admin confirms it first.
          await Model.updateOne({ _id: b._id }, { $set: { status: STORED[kind].confirmed } });
          return real.apply(this, args);
        };
        try {
          const res = await post(`/${b._id}/cancel`, { reason: "Patient requested" });
          assert.equal(res.status, 409);
          assert.match(res.body.msg, /just changed/);
        } finally {
          Model.findOneAndUpdate = real;
        }
        const doc = await fresh(kind, b._id);
        assert.equal(doc.status, STORED[kind].confirmed);
        assert.equal(doc.cancelReason, "");
        assert.deepEqual(calls, []);
        assert.deepEqual(pushes, []);
      });

      test("a testing booking is cancelled with no email or push (the call room is still closed)", async () => {
        const evictions = recordEvictions();
        const b = await make(kind, "confirmed", { doctor: D1, isTesting: true });
        assert.equal((await post(`/${b._id}/cancel`, { reason: "Testing booking" })).status, 200);
        assert.equal((await fresh(kind, b._id)).status, STORED[kind].cancelled);
        assert.equal(evictions.length, 1);
        nothingSent();
      });
    });

    describe(`${kind}: auto complete`, () => {
      const recordEvictions = () => {
        const seen = [];
        app.set("evictAllFromAppointmentRoom", (id, opts) => seen.push({ id: String(id), ...opts }));
        return seen;
      };
      beforeEach(() => app.set("evictAllFromAppointmentRoom", undefined));

      test("completes an Assigned or Confirmed booking, closes the call room, updates everyone, tells the patient", async () => {
        for (const status of ["assigned", "confirmed"]) {
          calls = []; pushes = []; emitted = [];
          const evictions = recordEvictions();
          const b = await make(kind, status, { doctor: D1, paymentStatus: "paid" });
          const res = await post(`/${b._id}/auto-complete`);
          assert.equal(res.status, 200, status);
          assert.equal(res.body.booking.status, "complete");
          assert.equal(res.body.paid, true);
          assert.equal((await fresh(kind, b._id)).status, STORED[kind].complete);
          assert.deepEqual(evictions, [{ id: String(b._id), reason: "completed" }]);
          for (const room of ["admin_room", `patient_${patient._id}`, `doctor_${D1.d._id}`]) {
            assert.ok(emitted.some((e) => e.room === room && e.payload.status === "complete"), room);
          }
          assert.equal(pushes.length, 1);
          assert.equal(pushes[0].title, "Appointment completed");
        }
      });

      test("409 for Upcoming, Pending, Complete and Cancelled; nothing changes or is sent", async () => {
        const evictions = recordEvictions();
        for (const status of ["upcoming", "pending", "complete", "cancelled"]) {
          const b = await make(kind, status, status === "upcoming" ? {} : { doctor: D1 });
          const res = await post(`/${b._id}/auto-complete`);
          assert.equal(res.status, 409, status);
          assert.equal((await fresh(kind, b._id)).status, STORED[kind][status]);
        }
        assert.equal((await post(`/${new mongoose.Types.ObjectId()}/auto-complete`)).status, 404);
        assert.deepEqual(evictions, []);
        assert.deepEqual(pushes, []);
      });

      test("two admins at once: exactly one wins", async () => {
        const b = await make(kind, "confirmed", { doctor: D1 });
        const results = await Promise.all([post(`/${b._id}/auto-complete`), post(`/${b._id}/auto-complete`)]);
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
        assert.equal(pushes.length, 1);
      });

      test("a testing booking is completed with no push (the call room is still closed)", async () => {
        const evictions = recordEvictions();
        const b = await make(kind, "confirmed", { doctor: D1, isTesting: true });
        assert.equal((await post(`/${b._id}/auto-complete`)).status, 200);
        assert.equal((await fresh(kind, b._id)).status, STORED[kind].complete);
        assert.equal(evictions.length, 1);
        nothingSent();
      });
    });
  }

  describe("bulk actions", () => {
    const bulk = (body, role = body?.action === "cancel" ? "superadmin" : "admin") => post("/bulk", body, role);
    const byId = (res) => Object.fromEntries(res.body.results.map((r) => [r.id, r]));
    let evictions;
    beforeEach(() => {
      evictions = [];
      app.set("evictAllFromAppointmentRoom", (id, opts) => evictions.push({ id: String(id), ...opts }));
    });
    after(() => app.set("evictAllFromAppointmentRoom", undefined));

    test("auto complete: per-id results, only open ones change, each closes its room and updates everyone", async () => {
      const a = await make("appointment", "assigned", { doctor: D1 });
      const c = await make("category", "confirmed", { doctor: D2 });
      const done = await make("appointment", "complete", { doctor: D3 });
      const upcoming = await make("category", "upcoming");
      const unknown = String(new mongoose.Types.ObjectId());
      const ids = [a, c, done, upcoming].map((d) => String(d._id)).concat([unknown, "not-an-id"]);

      const res = await bulk({ action: "auto-complete", ids });
      assert.equal(res.status, 200);
      const r = byId(res);
      assert.equal(r[String(a._id)].status, "ok");
      assert.equal(r[String(a._id)].kind, "appointment");
      assert.equal(r[String(c._id)].status, "ok");
      assert.equal(r[String(c._id)].kind, "category");
      assert.equal(r[String(done._id)].status, "conflict");
      assert.match(r[String(done._id)].message, /complete/);
      assert.equal(r[String(upcoming._id)].status, "conflict");
      assert.equal(r[unknown].status, "not_found");
      assert.equal(r["not-an-id"].status, "not_found");
      assert.deepEqual(res.body.summary, { ok: 2, not_found: 2, conflict: 2, error: 0 });

      assert.equal((await fresh("appointment", a._id)).status, "complete");
      assert.equal((await fresh("category", c._id)).status, "Completed");
      assert.equal((await fresh("category", upcoming._id)).status, "Pending");
      assert.deepEqual(evictions.map((e) => e.id).sort(), [String(a._id), String(c._id)].sort());
      assert.equal(evictions.every((e) => e.reason === "completed"), true);
      for (const id of [a._id, c._id]) {
        assert.ok(emitted.some((e) => e.room === "admin_room" && String(e.payload.appointmentId) === String(id) && e.payload.status === "complete"));
        assert.ok(emitted.some((e) => e.room === `patient_${patient._id}` && String(e.payload.appointmentId) === String(id)));
      }
      assert.ok(emitted.some((e) => e.room === `doctor_${D1.d._id}` && e.payload.status === "complete"));
      assert.equal(pushes.length, 2);
    });

    test("cancel: reason is required up front; nothing is touched when it is missing or wrong", async () => {
      const b = await make("appointment", "confirmed", { doctor: D1 });
      for (const body of [{}, { reason: "" }, { reason: "Changed my mind" }]) {
        assert.equal((await bulk({ action: "cancel", ids: [String(b._id)], ...body })).status, 400, JSON.stringify(body));
      }
      assert.equal((await fresh("appointment", b._id)).status, "confirmed");
      assert.deepEqual(evictions, []);
    });

    test("cancel: same rules as the single endpoint, with paid flags, rooms closed and doctor emails", async () => {
      const paid = await make("appointment", "confirmed", { doctor: D1, paymentStatus: "paid" });
      const unpaid = await make("category", "assigned", { doctor: D2 });
      const noDoctor = await make("category", "upcoming");
      const done = await make("appointment", "complete", { doctor: D3 });
      const gone = await make("category", "cancelled", { doctor: D3 });
      const ids = [paid, unpaid, noDoctor, done, gone].map((d) => String(d._id));

      const res = await bulk({ action: "cancel", ids, reason: "Duplicate booking" });
      assert.equal(res.status, 200);
      const r = byId(res);
      assert.deepEqual([paid, unpaid, noDoctor].map((d) => r[String(d._id)].status), ["ok", "ok", "ok"]);
      assert.equal(r[String(done._id)].status, "conflict");
      assert.equal(r[String(gone._id)].status, "conflict");
      assert.equal(r[String(paid._id)].paid, true);
      assert.equal(r[String(unpaid._id)].paid, false);
      assert.deepEqual(res.body.summary, { ok: 3, not_found: 0, conflict: 2, error: 0 });
      assert.equal(res.body.paidCount, 1);

      for (const d of [paid, unpaid, noDoctor]) {
        const kind = d === paid ? "appointment" : "category";
        const after = await fresh(kind, d._id);
        assert.equal(after.cancelReason, "Duplicate booking");
        assert.equal(after.cancelledBy.name, "Super Admin");
      }
      assert.equal((await fresh("appointment", done._id)).cancelReason, "");
      assert.deepEqual(evictions.map((e) => e.id).sort(), [paid, unpaid, noDoctor].map((d) => String(d._id)).sort());
      assert.equal(evictions.every((e) => e.reason === "cancelled"), true);
      assert.ok(emitted.some((e) => e.room === `doctor_${D1.d._id}` && e.payload.status === "cancelled"));
      assert.equal(pushes.length, 3);
      assert.equal(calls.filter((c) => c.name === "doctorCancelled").length, 2, "only bookings that had a doctor");
    });

    test("testing bookings in a bulk get no push or email but their rooms are still closed", async () => {
      const t1 = await make("appointment", "confirmed", { doctor: D1, isTesting: true });
      const t2 = await make("category", "assigned", { doctor: D2, isTesting: true });
      const t3 = await make("appointment", "assigned", { doctor: D3, isTesting: true });

      const cancel = await bulk({ action: "cancel", ids: [String(t1._id), String(t2._id)], reason: "Testing booking" });
      assert.equal(cancel.body.summary.ok, 2);
      const complete = await bulk({ action: "auto-complete", ids: [String(t3._id)] });
      assert.equal(complete.body.summary.ok, 1);
      assert.equal(evictions.length, 3);
      nothingSent();
    });

    test("mark and unmark testing through the bulk endpoint", async () => {
      const a = await make("appointment", "complete", { doctor: D1 });
      const c = await make("category", "cancelled");
      const unknown = String(new mongoose.Types.ObjectId());
      const marked = await bulk({ action: "mark-testing", ids: [String(a._id), String(c._id), unknown] });
      assert.equal(marked.status, 200);
      assert.deepEqual(marked.body.summary, { ok: 2, not_found: 1, conflict: 0, error: 0 });
      assert.equal((await fresh("appointment", a._id)).isTesting, true);
      assert.equal((await fresh("category", c._id)).isTesting, true);

      const unmarked = await bulk({ action: "unmark-testing", ids: [String(a._id), String(c._id)] });
      assert.equal(unmarked.body.summary.ok, 2);
      assert.equal((await fresh("appointment", a._id)).isTesting, false);
      nothingSent();
    });

    test("a booking another admin changed first is a conflict and the rest still go through", async () => {
      const first = await make("appointment", "confirmed", { doctor: D1 });
      const second = await make("appointment", "confirmed", { doctor: D2 });
      const real = Appointment.findOneAndUpdate;
      Appointment.findOneAndUpdate = async function (...args) {
        Appointment.findOneAndUpdate = real;
        await Appointment.updateOne({ _id: first._id }, { $set: { status: "complete" } });
        return real.apply(this, args);
      };
      try {
        const res = await bulk({ action: "cancel", ids: [String(first._id), String(second._id)], reason: "Patient requested" });
        const r = byId(res);
        assert.equal(r[String(first._id)].status, "conflict");
        assert.equal(r[String(second._id)].status, "ok");
      } finally {
        Appointment.findOneAndUpdate = real;
      }
      assert.equal((await fresh("appointment", first._id)).status, "complete");
      assert.equal((await fresh("appointment", second._id)).status, "cancelled");
    });

    test("an unexpected failure on one booking is reported as error and the rest still go through", async () => {
      const first = await make("appointment", "confirmed", { doctor: D1 });
      const second = await make("appointment", "confirmed", { doctor: D2 });
      const real = Appointment.findOneAndUpdate;
      Appointment.findOneAndUpdate = async function () {
        Appointment.findOneAndUpdate = real;
        throw new Error("boom");
      };
      const logged = console.error;
      console.error = () => {};
      try {
        const res = await bulk({ action: "cancel", ids: [String(first._id), String(second._id)], reason: "Patient requested" });
        assert.equal(res.status, 200);
        assert.deepEqual(res.body.summary, { ok: 1, not_found: 0, conflict: 0, error: 1 });
        assert.equal(byId(res)[String(first._id)].status, "error");
        assert.doesNotMatch(JSON.stringify(res.body), /boom/);
      } finally {
        console.error = logged;
        Appointment.findOneAndUpdate = real;
      }
    });

    test("repeated ids are handled once", async () => {
      const b = await make("appointment", "confirmed", { doctor: D1 });
      const res = await bulk({ action: "cancel", ids: [String(b._id), String(b._id)], reason: "Patient requested" });
      assert.deepEqual(res.body.summary, { ok: 1, not_found: 0, conflict: 0, error: 0 });
      assert.equal(pushes.length, 1);
    });

    test("400 for an unknown action (there is no bulk confirm), a bad id list, or more than 100 ids", async () => {
      const fakeId = () => String(new mongoose.Types.ObjectId());
      const b = await make("appointment", "assigned", { doctor: D1 });
      assert.equal((await bulk({ action: "confirm", ids: [String(b._id)] })).status, 400);
      assert.equal((await fresh("appointment", b._id)).status, "assigned");
      for (const body of [{ ids: [fakeId()] }, { action: "nope", ids: [fakeId()] }, { action: "auto-complete" }, { action: "auto-complete", ids: [] }, { action: "auto-complete", ids: "abc" }]) {
        assert.equal((await bulk(body)).status, 400, JSON.stringify(body));
      }
      const hundred = Array.from({ length: 100 }, fakeId);
      assert.equal((await bulk({ action: "auto-complete", ids: hundred })).status, 200);
      assert.equal((await bulk({ action: "auto-complete", ids: [...hundred, fakeId()] })).status, 400);
    });

    test("is admin-only", async () => {
      const body = { action: "auto-complete", ids: [String(new mongoose.Types.ObjectId())] };
      assert.equal((await bulk(body, "")).status, 401);
      assert.equal((await bulk(body, "user")).status, 403);
      assert.equal((await bulk(body, "doctor")).status, 403);
    });
  });

  describe("mark / unmark testing", () => {
    const patch = async (body, role = "admin") => {
      const res = await fetch(`${base}/testing`, {
        method: "PATCH",
        headers: { "content-type": "application/json", ...(role ? { "x-test-role": role } : {}) },
        body: JSON.stringify(body),
      });
      return { status: res.status, body: await res.json() };
    };

    test("marks bookings of any status and kind, then unmarks them, sending nothing", async () => {
      const made = [];
      for (const kind of KINDS) {
        for (const status of ["upcoming", "assigned", "confirmed", "complete", "cancelled"]) {
          made.push({ kind, doc: await make(kind, status, status === "upcoming" ? {} : { doctor: D1 }) });
        }
      }
      const ids = made.map((m) => String(m.doc._id));

      const marked = await patch({ ids, value: true });
      assert.equal(marked.status, 200);
      assert.equal(marked.body.updated, 10);
      assert.equal(marked.body.results.every((r) => r.status === "ok"), true);
      for (const { kind, doc } of made) {
        const after = await fresh(kind, doc._id);
        assert.equal(after.isTesting, true);
        assert.equal(String(after.testingMarkedBy.id), String(admin._id));
        assert.equal(after.testingMarkedBy.name, "Super Admin");
        assert.equal(after.testingMarkedBy.email, "sa@x.co");
        assert.ok(after.testingMarkedAt);
        assert.equal(after.status, doc.status, "status is untouched");
      }

      const unmarked = await patch({ ids, value: false });
      assert.equal(unmarked.status, 200);
      for (const { kind, doc } of made) {
        const after = await fresh(kind, doc._id);
        assert.equal(after.isTesting, false);
        assert.equal(after.testingMarkedBy.id, null);
        assert.equal(after.testingMarkedBy.name, "");
        assert.equal(after.testingMarkedBy.email, "");
        assert.equal(after.testingMarkedAt, null);
      }
      nothingSent();
    });

    test("answers per id: ok, or not_found for unknown and invalid ids; repeated ids count once", async () => {
      const a = await make("appointment", "upcoming");
      const c = await make("category", "upcoming");
      const unknown = String(new mongoose.Types.ObjectId());
      const res = await patch({ ids: [String(a._id), unknown, "not-an-id", String(c._id), String(a._id)], value: true });
      assert.equal(res.status, 200);
      assert.equal(res.body.updated, 2);
      assert.deepEqual(res.body.results, [
        { id: String(a._id), status: "ok", kind: "appointment" },
        { id: unknown, status: "not_found" },
        { id: "not-an-id", status: "not_found" },
        { id: String(c._id), status: "ok", kind: "category" },
      ]);
    });

    test("up to 100 ids are accepted, 101 are not; bad input is a 400", async () => {
      const fakeId = () => String(new mongoose.Types.ObjectId());
      const ids = Array.from({ length: 100 }, fakeId);
      assert.equal((await patch({ ids, value: true })).status, 200);
      assert.equal((await patch({ ids: [...ids, fakeId()], value: true })).status, 400);
      for (const body of [{}, { ids: [], value: true }, { ids: "abc", value: true }, { ids: [fakeId()] }, { ids: [fakeId()], value: "true" }]) {
        assert.equal((await patch(body)).status, 400, JSON.stringify(body));
      }
    });

    test("is admin-only", async () => {
      assert.equal((await patch({ ids: ["x"], value: true }, "")).status, 401);
      assert.equal((await patch({ ids: ["x"], value: true }, "user")).status, 403);
    });

    test("the list follows the flag: the Testing tab and Hide testing", async () => {
      const a = await make("appointment", "upcoming");
      const c = await make("category", "upcoming");
      await patch({ ids: [String(a._id)], value: true });
      const list = async (q) => (await fetch(`${base}?${q}`, { headers: { "x-test-role": "admin" } })).json();
      assert.deepEqual((await list("status=testing")).items.map((r) => r.id), [String(a._id)]);
      assert.deepEqual((await list("hideTesting=true")).items.map((r) => r.id), [String(c._id)]);
      await patch({ ids: [String(a._id)], value: false });
      assert.equal((await list("status=testing")).items.length, 0);
    });
  });

  describe("overview counts leave out testing bookings", () => {
    test("getAdminStats ignores isTesting=true and counts documents that have no flag", async () => {
      const { getAdminStats } = require("../controllers/adminController");
      await make("appointment", "upcoming");
      const legacy = await make("appointment", "confirmed", { doctor: D1, time: "11:00 AM" });
      await make("appointment", "complete", { doctor: D2 });
      await make("appointment", "upcoming", { isTesting: true });
      await make("appointment", "confirmed", { doctor: D3, isTesting: true });
      await make("appointment", "complete", { doctor: D3, isTesting: true, time: "12:00 PM" });
      // Written before the field existed: no isTesting key at all.
      await Appointment.collection.updateOne({ _id: legacy._id }, { $unset: { isTesting: 1 } });

      const res = { code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
      await getAdminStats({}, res);
      assert.equal(res.code, 200);
      assert.equal(res.body.totalAppointments, 3);
      assert.deepEqual(res.body.appointmentsByStatus, { upcoming: 1, assigned: 0, pending: 0, confirmed: 1, complete: 1, cancelled: 0 });
    });
  });

  test("Appointment 'pending' with no doctor can be assigned; the Next Available time rules apply to category only", async () => {
    const pending = await make("appointment", "pending");
    assert.equal((await post(`/${pending._id}/assign-doctor`, { doctorId: String(D1.e._id) })).status, 200);

    const next = await make("category", "upcoming", { appointmentType: "NEXT_AVAILABLE", urgency: "next", slot: null });
    const noTime = await post(`/${next._id}/assign-doctor`, { doctorId: String(D2.e._id) });
    assert.equal(noTime.status, 400);
    assert.match(noTime.body.msg, /time is required/);
    assert.equal((await post(`/${next._id}/assign-doctor`, { doctorId: String(D2.e._id), appointmentTime: "5pm" })).status, 400);
    assert.equal((await fresh("category", next._id)).status, "Pending");

    const ok = await post(`/${next._id}/assign-doctor`, { doctorId: String(D2.e._id), appointmentTime: "05:30 PM" });
    assert.equal(ok.status, 200);
    assert.equal((await fresh("category", next._id)).assignedSlot, "05:30 PM");
    assert.deepEqual(ok.body.booking.consultation, { date: "2026-11-01", time: "05:30 PM", timezone: "" });
  });

  test("Next Available slot conflicts are checked against the time the admin picks", async () => {
    await make("appointment", "confirmed", { doctor: D1, time: "05:30 PM" });
    const next = await make("category", "upcoming", { appointmentType: "NEXT_AVAILABLE", urgency: "next", slot: null });
    assert.equal((await post(`/${next._id}/assign-doctor`, { doctorId: String(D1.e._id), appointmentTime: "05:30 PM" })).status, 409);
    assert.equal((await post(`/${next._id}/assign-doctor`, { doctorId: String(D1.e._id), appointmentTime: "06:30 PM" })).status, 200);
  });

  test("a time is not needed for a flexible category booking, and the chosen slot is kept", async () => {
    const b = await make("category", "upcoming");
    assert.equal((await post(`/${b._id}/assign-doctor`, { doctorId: String(D1.e._id), appointmentTime: "09:00 AM" })).status, 200);
    const doc = await fresh("category", b._id);
    assert.equal(doc.slot, "10:00 AM");
    assert.equal(doc.assignedSlot, null);
  });

  describe("a doctor confirming their own booking", () => {
    // Loaded here, after the push recorder is installed, so the controller sees the recorder.
    const confirmAs = async (doctorUserId, bookingId) => {
      const { confirmAppointment } = require("../controllers/appointmentController");
      const res = { code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
      await confirmAppointment({ params: { id: String(bookingId) }, user: { id: String(doctorUserId), role: "doctor" }, app }, res);
      return res;
    };

    for (const kind of KINDS) {
      test(`${kind}: records who confirmed (role doctor) and when, and tells the patient`, async () => {
        const b = await make(kind, "assigned", { doctor: D1 });
        const before = Date.now();
        const res = await confirmAs(D1.d._id, b._id);
        assert.equal(res.code, 200);
        const doc = await fresh(kind, b._id);
        assert.equal(doc.status, STORED[kind].confirmed);
        assert.equal(String(doc.confirmedBy.id), String(D1.d._id));
        assert.equal(doc.confirmedBy.name, "Martin Perlin");
        assert.equal(doc.confirmedBy.email, "martinperlin@x.co");
        assert.equal(doc.confirmedBy.role, "doctor");
        assert.ok(doc.confirmedAt && doc.confirmedAt.getTime() >= before - 1000);
        assert.equal(pushes.length, 1);
        assert.equal(pushes[0].userId, String(patient._id));
      });

      test(`${kind}: a testing booking is confirmed with no push, and the record is still kept`, async () => {
        const b = await make(kind, "assigned", { doctor: D1, isTesting: true });
        assert.equal((await confirmAs(D1.d._id, b._id)).code, 200);
        assert.equal((await fresh(kind, b._id)).confirmedBy.role, "doctor");
        assert.deepEqual(pushes, []);
      });

      test(`${kind}: another doctor can't confirm it, and nothing is recorded`, async () => {
        const b = await make(kind, "assigned", { doctor: D1 });
        assert.equal((await confirmAs(D2.d._id, b._id)).code, 403);
        const doc = await fresh(kind, b._id);
        assert.equal(doc.status, STORED[kind].assigned);
        assert.equal(doc.confirmedBy.role, "");
        assert.equal(doc.confirmedAt, null);
      });
    }

    for (const kind of KINDS) {
      test(`${kind}: after the doctor confirms, the room opens for the patient and the doctor, and not before`, async () => {
        const b = await make(kind, "assigned", { doctor: D1 });
        const asPatient = { userId: String(patient._id), role: "user" };
        const asDoctor = { userId: String(D1.d._id), role: "doctor" };
        assert.equal((await decideAppointmentAccess(asPatient, String(b._id))).reason, "not_confirmed");
        assert.equal((await decideAppointmentAccess(asDoctor, String(b._id))).reason, "not_confirmed");
        assert.equal((await confirmAs(D1.d._id, b._id)).code, 200);
        assert.equal((await decideAppointmentAccess(asPatient, String(b._id))).allowed, true);
        assert.equal((await decideAppointmentAccess(asDoctor, String(b._id))).allowed, true);
      });
    }

    test("there is no admin confirm: the route is gone", async () => {
      const b = await make("appointment", "assigned", { doctor: D1 });
      const res = await fetch(`${base}/${b._id}/confirm`, { method: "POST", headers: { "x-test-role": "superadmin" } });
      assert.equal(res.status, 404);
      assert.equal((await fresh("appointment", b._id)).status, "assigned");
      assert.equal(typeof require("../utils/adminBookingActions").confirmBooking, "undefined");
      assert.equal(typeof notify.notifyDoctorBookingConfirmed, "undefined");
    });
  });

  describe("the booking's View page: one row, and delete (super admin only)", () => {
    const request = async (method, path, role = "admin") => {
      const res = await fetch(`${base}${path}`, { method, headers: role ? { "x-test-role": role } : {} });
      return { status: res.status, body: await res.json() };
    };

    for (const kind of KINDS) {
      test(`${kind}: GET /:id returns the booking as a list row`, async () => {
        const b = await make(kind, "assigned", { doctor: D1, paymentStatus: "paid", paymentGateway: "stripe" });
        const res = await request("GET", `/${b._id}`);
        assert.equal(res.status, 200);
        assert.equal(res.body.booking.id, String(b._id));
        assert.equal(res.body.booking.kind, kind);
        assert.equal(res.body.booking.status, "assigned");
        assert.equal(res.body.booking.doctorName, "Martin Perlin");
        assert.equal(res.body.booking.paid, true);
        assert.equal(res.body.booking.paymentGateway, "stripe");
        if (kind === "category") {
          assert.equal(res.body.detail.concern, "x", "the category request's fields come with it");
          assert.equal(res.body.detail.appointmentType, "FLEXIBLE_TIME");
          assert.equal(res.body.detail.slot, "10:00 AM");
          assert.equal(res.body.detail.categoryName, "Women's Health");
          assert.equal(String(res.body.detail.assignedDoctorId), String(D1.e._id));
        } else {
          assert.equal(res.body.detail, undefined);
        }
      });
    }

    test("GET /:id: 400 for a bad id, 404 for an unknown one, admins only", async () => {
      assert.equal((await request("GET", "/nope")).status, 400);
      assert.equal((await request("GET", `/${new mongoose.Types.ObjectId()}`)).status, 404);
      const b = await make("appointment", "upcoming");
      assert.equal((await request("GET", `/${b._id}`, "")).status, 401);
      assert.equal((await request("GET", `/${b._id}`, "user")).status, 403);
      assert.equal((await request("GET", `/${b._id}`, "doctor")).status, 403);
    });

    test("a super admin deletes a category consultation: gone for good, the call room closed, the paid flag returned", async () => {
      const evictions = [];
      app.set("evictAllFromAppointmentRoom", (id, opts) => evictions.push({ id: String(id), ...opts }));
      try {
        const b = await make("category", "assigned", { doctor: D1, paymentStatus: "paid" });
        const res = await request("DELETE", `/${b._id}`, "superadmin");
        assert.equal(res.status, 200);
        assert.equal(res.body.id, String(b._id));
        assert.equal(res.body.paid, true);
        assert.equal(await fresh("category", b._id), null);
        assert.deepEqual(evictions, [{ id: String(b._id), reason: "cancelled" }]);
        assert.equal((await request("DELETE", `/${b._id}`, "superadmin")).status, 404, "a second delete finds nothing");
        assert.deepEqual(calls, [], "nobody is emailed");
        assert.deepEqual(pushes, []);
      } finally {
        app.set("evictAllFromAppointmentRoom", undefined);
      }
    });

    test("an ordinary admin cannot delete, and neither can anyone signed out; the booking stays", async () => {
      const b = await make("category", "upcoming");
      assert.equal((await request("DELETE", `/${b._id}`, "admin")).status, 403);
      assert.equal((await request("DELETE", `/${b._id}`, "")).status, 401);
      assert.equal((await request("DELETE", `/${b._id}`, "user")).status, 403);
      assert.ok(await fresh("category", b._id));
    });

    test("a regular appointment is refused (cancel it instead) and stays; a bad id is a 400", async () => {
      const b = await make("appointment", "upcoming");
      const res = await request("DELETE", `/${b._id}`, "superadmin");
      assert.equal(res.status, 400);
      assert.match(res.body.msg, /Cancel a regular appointment/);
      assert.ok(await fresh("appointment", b._id));
      assert.equal((await request("DELETE", "/nope", "superadmin")).status, 400);
      assert.equal((await request("DELETE", `/${new mongoose.Types.ObjectId()}`, "superadmin")).status, 404);
    });
  });

  describe("assign a doctor to any open booking that has none", () => {
    for (const kind of KINDS) {
      test(`${kind}: Upcoming, Pending, Assigned and Confirmed bookings with no doctor can all be assigned (it ends Assigned)`, async () => {
        for (const status of ["upcoming", "pending", "assigned", "confirmed"]) {
          const b = await make(kind, status);
          const res = await post(`/${b._id}/assign-doctor`, { doctorId: String(D1.e._id) });
          assert.equal(res.status, 200, status);
          assert.equal(res.body.booking.status, "assigned", status);
          assert.equal(res.body.booking.doctorName, "Martin Perlin", status);
          const doc = await fresh(kind, b._id);
          assert.equal(doc.status, STORED[kind].assigned, status);
          assert.equal(doc.assignedBy.name, "Super Admin", status);
          await (kind === "appointment" ? Appointment : CategoryConsultation).deleteOne({ _id: b._id }); // free the slot for the next status
        }
      });

      test(`${kind}: a reference to a doctor that no longer exists counts as no doctor, and the booking can be assigned`, async () => {
        const ghost = new mongoose.Types.ObjectId();
        const b = await (kind === "appointment"
          ? Appointment.create({ patientId: patient._id, date: "2026-11-01", time: "10:00 AM", status: "assigned", doctorId: ghost })
          : CategoryConsultation.create({
              concern: "x", severity: "mild", supportType: "chat", urgency: "flexible", appointmentType: "FLEXIBLE_TIME", date: "2026-11-01",
              slot: "10:00 AM", patientId: patient._id, categoryName: "Women's Health", status: "Assigned", assignedDoctorId: ghost,
            }));
        const list = await (await fetch(`${base}/${b._id}`, { headers: { "x-test-role": "admin" } })).json();
        assert.equal(list.booking.doctorName, null, "the page shows Not assigned");
        const res = await post(`/${b._id}/assign-doctor`, { doctorId: String(D2.e._id) });
        assert.equal(res.status, 200);
        assert.equal(doctorKeyOf(kind, await fresh(kind, b._id)), keyOf(kind, D2));
      });

      test(`${kind}: a booking whose doctor still exists is refused (use Alternate doctor), and Complete / Cancelled ones are closed`, async () => {
        const has = await make(kind, "assigned", { doctor: D1 });
        const refused = await post(`/${has._id}/assign-doctor`, { doctorId: String(D2.e._id) });
        assert.equal(refused.status, 409);
        assert.match(refused.body.msg, /already has a doctor/);
        for (const status of ["complete", "cancelled"]) {
          const closed = await make(kind, status);
          const res = await post(`/${closed._id}/assign-doctor`, { doctorId: String(D2.e._id) });
          assert.equal(res.status, 409, status);
          assert.match(res.body.msg, new RegExp(status));
        }
      });
    }
  });

  describe("cancelling is for super admins only", () => {
    for (const kind of KINDS) {
      test(`${kind}: an ordinary admin gets 403 on cancel and nothing changes; a super admin can cancel`, async () => {
        const b = await make(kind, "confirmed", { doctor: D1 });
        const denied = await post(`/${b._id}/cancel`, { reason: "Patient requested" }, "admin");
        assert.equal(denied.status, 403);
        assert.equal((await fresh(kind, b._id)).status, STORED[kind].confirmed);
        assert.deepEqual(calls, []);
        assert.deepEqual(pushes, []);
        assert.equal((await post(`/${b._id}/cancel`, { reason: "Patient requested" }, "superadmin")).status, 200);
      });
    }

    test("bulk cancel is 403 for an ordinary admin (nothing is touched), while the other bulk actions still work for them", async () => {
      const a = await make("appointment", "confirmed", { doctor: D1 });
      const c = await make("category", "assigned", { doctor: D2 });
      const ids = [String(a._id), String(c._id)];
      const denied = await post("/bulk", { action: "cancel", ids, reason: "Duplicate booking" }, "admin");
      assert.equal(denied.status, 403);
      assert.equal((await fresh("appointment", a._id)).status, "confirmed");
      assert.equal((await fresh("category", c._id)).status, "Assigned");
      assert.equal((await post("/bulk", { action: "mark-testing", ids }, "admin")).status, 200);
      assert.equal((await post("/bulk", { action: "auto-complete", ids }, "admin")).body.summary.ok, 2);
      const b2 = await make("appointment", "confirmed", { doctor: D3 });
      assert.equal((await post("/bulk", { action: "cancel", ids: [String(b2._id)], reason: "Duplicate booking" }, "superadmin")).body.summary.ok, 1);
    });

    test("an unsigned or non-admin caller is 401 / 403 on cancel and bulk cancel", async () => {
      const b = await make("appointment", "confirmed", { doctor: D1 });
      assert.equal((await post(`/${b._id}/cancel`, { reason: "Patient requested" }, "")).status, 401);
      assert.equal((await post(`/${b._id}/cancel`, { reason: "Patient requested" }, "user")).status, 403);
      assert.equal((await post("/bulk", { action: "cancel", ids: [String(b._id)], reason: "Patient requested" }, "user")).status, 403);
    });
  });

  describe("reactivate a completed booking", () => {
    for (const kind of KINDS) {
      test(`${kind}: Complete -> Confirmed, who and when recorded, the room open again, the patient pushed and the doctor told`, async () => {
        const lifecycle = require("../utils/bookingNotifications");
        const doctorEmails = [];
        const realReopen = lifecycle.notifyDoctorAppointmentReopened;
        lifecycle.notifyDoctorAppointmentReopened = (a) => { doctorEmails.push(a); return Promise.resolve(); };
        const rejoined = [];
        app.set("allowAppointmentRoomRejoin", (id) => rejoined.push(String(id)));
        try {
          const b = await make(kind, "complete", { doctor: D1 });
          const before = Date.now();
          const res = await post(`/${b._id}/reactivate`, {}, "admin");
          assert.equal(res.status, 200);
          assert.equal(res.body.booking.status, "confirmed");

          const doc = await fresh(kind, b._id);
          assert.equal(doc.status, STORED[kind].confirmed);
          if (kind === "appointment") assert.equal(doc.sessionStarted, true);
          assert.equal(String(doc.reactivatedBy.id), String(admin._id));
          assert.equal(doc.reactivatedBy.name, "Super Admin");
          assert.equal(doc.reactivatedBy.email, "sa@x.co");
          assert.ok(doc.reactivatedAt && doc.reactivatedAt.getTime() >= before - 1000);
          assert.deepEqual(rejoined, [String(b._id)], "the call room is open again");

          assert.equal(pushes.filter((p) => p.userId === String(patient._id)).length, 1, "the patient is told");
          assert.equal(doctorEmails.length, 1, "the doctor is emailed");
          assert.ok(emitted.some((e) => e.room === "admin_room" && e.payload.status === "confirmed"));

          const decision = await decideAppointmentAccess({ userId: String(patient._id), role: "user" }, String(b._id));
          assert.equal(decision.allowed, true, "and the booking can be joined");
        } finally {
          lifecycle.notifyDoctorAppointmentReopened = realReopen;
          app.set("allowAppointmentRoomRejoin", undefined);
        }
      });

      test(`${kind}: 409 when the booking is not Complete, and when someone changed it first`, async () => {
        for (const status of ["upcoming", "assigned", "confirmed", "cancelled"]) {
          const b = await make(kind, status, status === "upcoming" ? {} : { doctor: D1 });
          const res = await post(`/${b._id}/reactivate`, {}, "admin");
          assert.equal(res.status, 409, status);
          assert.equal((await fresh(kind, b._id)).status, STORED[kind][status], status);
        }
        const done = await make(kind, "complete", { doctor: D2 });
        const Model = kind === "appointment" ? Appointment : CategoryConsultation;
        const real = Model.findOneAndUpdate;
        Model.findOneAndUpdate = async function (...args) {
          Model.findOneAndUpdate = real;
          await Model.updateOne({ _id: done._id }, { $set: { status: STORED[kind].cancelled } }); // another admin got there first
          return real.apply(this, args);
        };
        try {
          const lost = await post(`/${done._id}/reactivate`, {}, "admin");
          assert.equal(lost.status, 409);
          assert.equal(lost.body.code, "changed");
        } finally {
          Model.findOneAndUpdate = real;
        }
        assert.equal((await fresh(kind, done._id)).status, STORED[kind].cancelled);
      });

      test(`${kind}: two admins at once: exactly one wins`, async () => {
        const b = await make(kind, "complete", { doctor: D1 });
        const results = await Promise.all([post(`/${b._id}/reactivate`, {}, "admin"), post(`/${b._id}/reactivate`, {}, "superadmin")]);
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
      });

      test(`${kind}: a testing booking is reactivated with no push and no email`, async () => {
        const b = await make(kind, "complete", { doctor: D1, isTesting: true });
        assert.equal((await post(`/${b._id}/reactivate`, {}, "admin")).status, 200);
        assert.equal((await fresh(kind, b._id)).status, STORED[kind].confirmed);
        assert.equal((await fresh(kind, b._id)).reactivatedBy.name, "Super Admin");
        nothingSent();
      });

      test(`${kind}: refused (and unchanged) when the doctor now has another booking at that time, or the booking has no doctor`, async () => {
        const b = await make(kind, "complete", { doctor: D1 });
        await make("appointment", "confirmed", { doctor: D1 });
        const busy = await post(`/${b._id}/reactivate`, {}, "admin");
        assert.equal(busy.status, 409);
        assert.equal(busy.body.code, "slot_taken");
        assert.equal((await fresh(kind, b._id)).status, STORED[kind].complete);

        const noDoctor = await make(kind, "complete");
        assert.equal((await post(`/${noDoctor._id}/reactivate`, {}, "admin")).status, 400);
      });
    }

    test("both admins and super admins may reactivate; users and doctors may not", async () => {
      const b = await make("appointment", "complete", { doctor: D1 });
      assert.equal((await post(`/${b._id}/reactivate`, {}, "")).status, 401);
      assert.equal((await post(`/${b._id}/reactivate`, {}, "user")).status, 403);
      assert.equal((await post(`/${b._id}/reactivate`, {}, "doctor")).status, 403);
      assert.equal((await post(`/${b._id}/reactivate`, {}, "superadmin")).status, 200);
    });
  });

  describe("409 codes the page relies on", () => {
    test("a busy doctor is slot_taken; a lost race is changed; other 409s carry no code", async () => {
      await make("appointment", "confirmed", { doctor: D1 });
      const up = await make("category", "upcoming");
      const busy = await post(`/${up._id}/assign-doctor`, { doctorId: String(D1.e._id) });
      assert.equal(busy.status, 409);
      assert.equal(busy.body.code, "slot_taken");

      const closed = await make("appointment", "complete", { doctor: D2 });
      const state = await post(`/${closed._id}/cancel`, { reason: "Patient requested" });
      assert.equal(state.status, 409);
      assert.equal(state.body.code, undefined);

      const racing = await make("appointment", "assigned", { doctor: D3 });
      const real = Appointment.findOneAndUpdate;
      Appointment.findOneAndUpdate = async function (...args) {
        Appointment.findOneAndUpdate = real;
        await Appointment.updateOne({ _id: racing._id }, { $set: { status: "confirmed" } });
        return real.apply(this, args);
      };
      try {
        const lost = await post(`/${racing._id}/cancel`, { reason: "Patient requested" });
        assert.equal(lost.status, 409);
        assert.equal(lost.body.code, "changed");
      } finally {
        Appointment.findOneAndUpdate = real;
      }
    });
  });

  describe("doctor email for a cancel", () => {
    const withMailer = async (fn) => {
      const sent = [];
      const real = mailer.sendBookingNotificationEmail;
      mailer.sendBookingNotificationEmail = async (to, payload) => { sent.push({ to, ...payload }); };
      try { await fn(sent); } finally { mailer.sendBookingNotificationEmail = real; }
    };

    for (const kind of KINDS) {
      test(`${kind}: cancelled email goes to the doctor and does not include the cancel reason`, async () => {
        await withMailer(async (sent) => {
          const b = await make(kind, "cancelled", { doctor: D1, cancelReason: "Payment failed" });
          await realNotifyCancelled({ booking: b.toObject(), isCategory: kind === "category" });
          assert.equal(sent.length, 1);
          assert.match(sent[0].subject, /cancelled/i);
          assert.doesNotMatch(JSON.stringify(sent[0]), /Payment failed/);
        });
      });
    }

    test("no email when the doctor has no address", async () => {
      await withMailer(async (sent) => {
        await Doctor.updateOne({ _id: D1.d._id }, { $set: { email: "" } });
        const b = await make("appointment", "confirmed", { doctor: D1 });
        const quiet = console.warn;
        console.warn = () => {};
        try { await realNotifyCancelled({ booking: b.toObject(), isCategory: false }); } finally { console.warn = quiet; }
        assert.equal(sent.length, 0);
      });
    });
  });

  describe("patient email", () => {
    test("notifyPatientDoctorChanged sends one email, worded for assign vs reassign", async () => {
      const sent = [];
      const realSend = mailer.sendEmail;
      mailer.sendEmail = async (m) => { sent.push(m); };
      try {
        const b = await make("appointment", "assigned", { doctor: D1 });
        await realNotifyPatient({ booking: b.toObject(), isCategory: false, doctorName: "Martin Perlin", reassigned: false });
        await realNotifyPatient({ booking: b.toObject(), isCategory: false, doctorName: "Dr. Nobita Mestry", reassigned: true });
        assert.equal(sent.length, 2);
        assert.equal(sent[0].to, "rachel@x.co");
        assert.match(sent[0].subject, /assigned/);
        assert.match(sent[0].html, /Dr\. Martin Perlin/);
        assert.match(sent[1].subject, /reassigned/);
        assert.doesNotMatch(sent[1].html, /Dr\. Dr\./);
      } finally {
        mailer.sendEmail = realSend;
      }
    });
  });
});
