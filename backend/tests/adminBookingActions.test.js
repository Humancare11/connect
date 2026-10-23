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
const { adminOnly } = require("../middleware/verifyToken");
const notify = require("../utils/bookingNotifications");
const push = require("../utils/pushNotifications");
const mailer = require("../utils/sendEmail");

// The real implementation, kept before the recorders below replace it.
const realNotifyPatient = notify.notifyPatientDoctorChanged;

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

  const post = async (path, body = {}, role = "admin") => {
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
    app.use("/api/admin/bookings", adminBookings.create({ guard: [fakeAuth, adminOnly] }));
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
    for (const path of ["assign-doctor", "alternate-doctor", "revert-doctor", "confirm"]) {
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

      test("Assigned and Pending keep their status", async () => {
        // Different target doctors, since every booking here shares one slot.
        for (const [status, target] of [["assigned", D2], ["pending", D3]]) {
          const b = await make(kind, status, { doctor: D1 });
          const res = await post(`/${b._id}/alternate-doctor`, { doctorId: String(target.e._id) });
          assert.equal(res.status, 200, status);
          assert.equal(res.body.booking.status, status);
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
        await post(`/${b._id}/confirm`);
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

    describe(`${kind}: confirm`, () => {
      test("Assigned -> Confirmed, call enabled, patient told as the doctor's confirm does", async () => {
        const b = await make(kind, "assigned", { doctor: D1 });
        const res = await post(`/${b._id}/confirm`);
        assert.equal(res.status, 200);
        assert.equal(res.body.booking.status, "confirmed");
        const doc = await fresh(kind, b._id);
        assert.equal(doc.status, STORED[kind].confirmed);
        if (kind === "appointment") assert.equal(doc.sessionStarted, true);

        assert.equal(pushes.length, 1);
        assert.equal(pushes[0].userId, String(patient._id));
        assert.equal(pushes[0].title, "Appointment confirmed");
        assert.ok(emitted.some((e) => e.ev === "appointment-updated" && e.room === "admin_room" && e.payload.status === "confirmed"));
        assert.deepEqual(calls, []);
      });

      test("409 on any other status", async () => {
        for (const status of ["upcoming", "pending", "confirmed", "complete", "cancelled"]) {
          const b = await make(kind, status, status === "upcoming" ? {} : { doctor: D1 });
          const res = await post(`/${b._id}/confirm`);
          assert.equal(res.status, 409, status);
          assert.equal((await fresh(kind, b._id)).status, STORED[kind][status]);
        }
        assert.deepEqual(pushes, []);
      });

      test("two admins confirming at once: exactly one wins, the other gets 409", async () => {
        const b = await make(kind, "assigned", { doctor: D1 });
        const results = await Promise.all([post(`/${b._id}/confirm`), post(`/${b._id}/confirm`)]);
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
        assert.equal(pushes.length, 1);
      });

      test("a testing booking is confirmed with no push", async () => {
        const b = await make(kind, "assigned", { doctor: D1, isTesting: true });
        assert.equal((await post(`/${b._id}/confirm`)).status, 200);
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
  }

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
