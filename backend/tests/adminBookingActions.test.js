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
  }

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
