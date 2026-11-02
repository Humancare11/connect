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
const AdminNotification = require("../models/AdminNotification");
const push = require("../utils/pushNotifications");
const { confirmAppointment, completeAppointment, reopenAppointment } = require("../controllers/appointmentController");

// The REAL controllers are mounted; only authentication is replaced by a header shim
// (the doctor/admin token middleware is covered elsewhere). Isolated in-memory MongoDB.
describe("admin notifications for doctor confirm / complete (real controllers, in-memory MongoDB)", () => {
  let mongod, server, base, doctor, otherDoctor, enrollment, admin, patient;
  const SECRET = { problem: "chest pain since Tuesday", payment: "pi_SECRET123", email: "rachel@x.co" };

  const fakeAuth = (req, res, next) => {
    const id = req.headers["x-test-user"];
    if (!id) return res.status(401).json({ msg: "No token provided." });
    req.user = { id, role: req.headers["x-test-role"] || "doctor" };
    next();
  };
  const put = async (path, { user = String(doctor._id), role = "doctor" } = {}) => {
    const res = await fetch(`${base}${path}`, {
      method: "PUT",
      headers: { "content-type": "application/json", ...(user ? { "x-test-user": user, "x-test-role": role } : {}) },
      body: "{}",
    });
    return { status: res.status, body: await res.json() };
  };
  const settle = () => new Promise((r) => setTimeout(r, 150));
  const alerts = (type) => AdminNotification.find(type ? { type } : {}).sort({ createdAt: 1 }).lean();

  const makeAppointment = (status, extra = {}) =>
    Appointment.create({
      patientId: patient._id, doctorId: doctor._id, date: "2026-11-01", time: "10:00 AM",
      category: "Cardiology", specialty: "Heart", problem: SECRET.problem, paymentIntentId: SECRET.payment,
      status, ...extra,
    });
  const makeCategory = (status) =>
    CategoryConsultation.create({
      concern: SECRET.problem, severity: "mild", supportType: "chat", urgency: "flexible", appointmentType: "FLEXIBLE_TIME",
      date: "2026-11-02", slot: "05:30 PM", patientId: patient._id, categoryName: "Women's Health", specialtyName: "Gynecology",
      status, assignedDoctorId: enrollment._id, assignedDoctorName: "Martin Perlin",
    });

  async function withBrokenNotifications(fn) {
    const original = AdminNotification.create;
    const warn = console.warn;
    AdminNotification.create = async () => { throw new Error("notification db down"); };
    console.warn = () => {};
    try { return await fn(); } finally {
      AdminNotification.create = original;
      console.warn = warn;
    }
  }

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await AdminNotification.init();
    push.sendPushToUser = () => {}; // no real push
    const app = express();
    app.use(express.json());
    app.use("/api/appointments/:id/confirm", fakeAuth);
    app.use("/api/appointments/:id/complete", fakeAuth);
    app.use("/api/appointments/:id/reopen", fakeAuth);
    app.put("/api/appointments/:id/confirm", confirmAppointment);
    app.put("/api/appointments/:id/complete", completeAppointment);
    app.put("/api/appointments/:id/reopen", reopenAppointment);
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}/api/appointments`;
  });
  after(async () => {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await Promise.all([
      Appointment.deleteMany({}), CategoryConsultation.deleteMany({}), User.deleteMany({}),
      Doctor.deleteMany({}), Enrollment.deleteMany({}), AdminNotification.deleteMany({}),
    ]);
    doctor = await Doctor.create({ name: "Martin Perlin", email: "martin@x.co", password: "SecretPw1!" });
    otherDoctor = await Doctor.create({ name: "Other Doc", email: "other@x.co", password: "SecretPw1!" });
    enrollment = await Enrollment.create({ doctorId: doctor._id, firstName: "Martin", surname: "Perlin", email: "martin@enroll.co", approvalStatus: "approved" });
    admin = await User.create({ name: "Super Admin", email: "sa@x.co", password: "SecretPw1!", role: "superadmin" });
    patient = await User.create({ name: "Rachel Secemski", email: SECRET.email, password: "SecretPw1!", country: "US" });
  });

  const expectNoLeak = (rows) => {
    const text = JSON.stringify(rows);
    for (const v of Object.values(SECRET)) assert.ok(!text.includes(v), `leaked ${v}`);
    assert.doesNotMatch(text, /Rachel|Secemski/);
  };

  test("a doctor's confirmation creates one notification with a safe message and a valid link", async () => {
    const appt = await makeAppointment("assigned");
    const res = await put(`/${appt._id}/confirm`);
    assert.equal(res.status, 200);
    await settle();
    const rows = await alerts();
    assert.equal(rows.length, 1);
    const [n] = rows;
    assert.equal(n.type, "appointment_confirmed_by_doctor");
    assert.equal(n.title, "Appointment confirmed by doctor");
    assert.equal(n.message, "Dr. Martin Perlin · Cardiology · Heart · 2026-11-01 · 10:00 AM");
    assert.equal(n.refType, "appointment");
    assert.equal(n.refId, String(appt._id));
    assert.equal(n.link, `/admin-dashboard/appointments/${appt._id}`);
    assert.match(n.dedupeKey, new RegExp(`^appointment_confirmed_by_doctor:${appt._id}:\\d+$`));
    expectNoLeak(rows);
  });

  test("a doctor's completion creates one notification", async () => {
    const appt = await makeAppointment("confirmed");
    const res = await put(`/${appt._id}/complete`);
    assert.equal(res.status, 200);
    await settle();
    const rows = await alerts();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].type, "appointment_completed_by_doctor");
    assert.equal(rows[0].title, "Appointment completed by doctor");
    assert.equal(rows[0].message, "Dr. Martin Perlin · Cardiology · Heart · 2026-11-01 · 10:00 AM");
    assert.equal(rows[0].link, `/admin-dashboard/appointments/${appt._id}`);
    expectNoLeak(rows);
  });

  test("category consultations notify on confirm and complete with the same link route", async () => {
    const cc = await makeCategory("Assigned");
    assert.equal((await put(`/${cc._id}/confirm`)).status, 200);
    assert.equal((await put(`/${cc._id}/complete`)).status, 200);
    await settle();
    const rows = await alerts();
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map((r) => r.type).sort(), ["appointment_completed_by_doctor", "appointment_confirmed_by_doctor"]);
    for (const r of rows) {
      assert.equal(r.link, `/admin-dashboard/appointments/${cc._id}`);
      assert.match(r.message, /^Dr\. Martin Perlin · Women's Health · Gynecology · 2026-11-02 · 05:30 PM$/);
    }
    expectNoLeak(rows);
  });

  test("unauthorized, wrong-owner, invalid, missing and no-op requests create no notification", async () => {
    const assigned = await makeAppointment("assigned");
    const cancelled = await makeAppointment("cancelled");
    const done = await makeAppointment("complete");
    const missing = new mongoose.Types.ObjectId();

    assert.equal((await put(`/${assigned._id}/confirm`, { user: "" })).status, 401);
    assert.equal((await put(`/${assigned._id}/confirm`, { user: String(otherDoctor._id) })).status, 403);
    assert.equal((await put(`/${assigned._id}/complete`, { user: String(otherDoctor._id) })).status, 403);
    assert.equal((await put(`/${cancelled._id}/confirm`)).status, 400);
    assert.equal((await put(`/${cancelled._id}/complete`)).status, 400);
    assert.equal((await put(`/${done._id}/confirm`)).status, 400);
    assert.equal((await put(`/${missing}/confirm`)).status, 404);
    assert.equal((await put(`/${missing}/complete`)).status, 404);
    // Already complete: a successful no-op, so still no new alert.
    const noop = await put(`/${done._id}/complete`);
    assert.equal(noop.status, 200);
    assert.match(noop.body.msg, /already completed/);
    await settle();
    assert.equal((await alerts()).length, 0);
    assert.equal((await Appointment.findById(assigned._id)).status, "assigned");
  });

  test("a notification persistence failure does not fail the status change", async () => {
    const appt = await makeAppointment("assigned");
    await withBrokenNotifications(async () => {
      assert.equal((await put(`/${appt._id}/confirm`)).status, 200);
      assert.equal((await put(`/${appt._id}/complete`)).status, 200);
      await settle();
    });
    assert.equal((await Appointment.findById(appt._id)).status, "complete");
    assert.equal((await alerts()).length, 0);
  });

  test("repeating a request does not duplicate the alert", async () => {
    const appt = await makeAppointment("assigned");
    assert.equal((await put(`/${appt._id}/confirm`)).status, 200);
    assert.equal((await put(`/${appt._id}/confirm`)).status, 400); // already confirmed
    assert.equal((await put(`/${appt._id}/complete`)).status, 200);
    assert.equal((await put(`/${appt._id}/complete`)).status, 200); // already completed
    await settle();
    assert.equal((await alerts("appointment_confirmed_by_doctor")).length, 1);
    assert.equal((await alerts("appointment_completed_by_doctor")).length, 1);
  });

  test("two concurrent confirms of the same state raise a single alert", async () => {
    const appt = await makeAppointment("assigned");
    await Promise.all([put(`/${appt._id}/confirm`), put(`/${appt._id}/confirm`)]);
    await settle();
    assert.equal((await alerts("appointment_confirmed_by_doctor")).length, 1);
  });

  test("an admin reopening and the doctor completing again is a new transition with a new alert", async () => {
    const appt = await makeAppointment("confirmed");
    assert.equal((await put(`/${appt._id}/complete`)).status, 200);
    await settle();
    assert.equal((await alerts("appointment_completed_by_doctor")).length, 1);

    await new Promise((r) => setTimeout(r, 10));
    const reopen = await put(`/${appt._id}/reopen`, { user: String(admin._id), role: "superadmin" });
    assert.equal(reopen.status, 200);
    await settle();
    // Reopening is an admin action and raises nothing here.
    assert.equal((await alerts()).length, 1);

    await new Promise((r) => setTimeout(r, 10));
    assert.equal((await put(`/${appt._id}/complete`)).status, 200);
    await settle();
    const rows = await alerts("appointment_completed_by_doctor");
    assert.equal(rows.length, 2);
    assert.notEqual(rows[0].dedupeKey, rows[1].dedupeKey);
  });
});
