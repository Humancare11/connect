const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

// No real email: the approval welcome email goes through this mock.
const mailer = require("../utils/sendEmail");
const welcomeMails = [];
mailer.sendDoctorApprovalEmail = async (to) => { welcomeMails.push(to); };

const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const AdminNotification = require("../models/AdminNotification");
const { approveDoctor, rejectDoctor } = require("../controllers/adminController");
const { adminOnly } = require("../middleware/verifyToken");

// The REAL controllers behind the real adminOnly guard; only token parsing is a header
// shim (the same guard that protects PUT /api/admin/doctors/:id/approve|reject).
describe("admin notifications for doctor approval / rejection (real controllers, in-memory MongoDB)", () => {
  let mongod, server, base, doctor;
  const SECRET = "jane.secret@example.com";

  const fakeAuth = (req, res, next) => {
    const role = req.headers["x-test-role"];
    if (!role) return res.status(401).json({ msg: "No token provided." });
    req.user = { id: String(new mongoose.Types.ObjectId()), role };
    next();
  };
  const put = async (path, role = "admin") => {
    const res = await fetch(`${base}${path}`, { method: "PUT", headers: { "content-type": "application/json", ...(role ? { "x-test-role": role } : {}) }, body: "{}" });
    return { status: res.status, body: await res.json() };
  };
  const settle = () => new Promise((r) => setTimeout(r, 150));
  const alerts = (type) => AdminNotification.find(type ? { type } : {}).lean();
  let n = 0;
  // doctorId is unique on Enrollment, so the first enrollment uses the shared doctor and any further one gets its own.
  const makeEnrollment = async (extra = {}) =>
    Enrollment.create({
      doctorId: n++ === 0 ? doctor._id : (await Doctor.create({ name: `Extra ${n}`, email: `extra${n}@example.com`, password: "SecretPw1!" }))._id,
      firstName: "Jane", surname: "Roe", email: SECRET, approvalStatus: "pending",
      formCompleted: true, completedSteps: 5, ...extra,
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
    const app = express();
    app.use(express.json());
    app.put("/api/admin/doctors/:id/approve", fakeAuth, adminOnly, approveDoctor);
    app.put("/api/admin/doctors/:id/reject", fakeAuth, adminOnly, rejectDoctor);
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}/api/admin/doctors`;
  });
  after(async () => {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await Promise.all([Doctor.deleteMany({}), Enrollment.deleteMany({}), AdminNotification.deleteMany({})]);
    welcomeMails.length = 0;
    n = 0;
    doctor = await Doctor.create({ name: "Jane Roe", email: SECRET, password: "SecretPw1!" });
  });

  test("approving an application creates one safe notification and keeps the response and side effects", async () => {
    const e = await makeEnrollment();
    const res = await put(`/${e._id}/approve`);
    assert.equal(res.status, 200);
    assert.equal(res.body.msg, "Doctor approved");
    assert.equal(res.body.enrollment.approvalStatus, "approved");
    await settle();
    const rows = await alerts();
    assert.equal(rows.length, 1);
    const [n] = rows;
    assert.equal(n.type, "doctor_approved");
    assert.equal(n.title, "Doctor approved");
    assert.equal(n.message, "Dr. Jane Roe was approved.");
    assert.equal(n.refType, "enrollment");
    assert.equal(n.refId, String(e._id));
    assert.equal(n.link, `/admin-dashboard/doctor-profile/${e._id}`);
    assert.match(n.dedupeKey, new RegExp(`^doctor_approved:${e._id}:\\d+$`));
    assert.ok(!JSON.stringify(rows).includes(SECRET));
    assert.equal((await Doctor.findById(doctor._id)).isEnrolled, true);
    assert.deepEqual(welcomeMails, [SECRET]);
  });

  test("rejecting an application creates one safe notification and keeps the response and side effects", async () => {
    const e = await makeEnrollment();
    const res = await put(`/${e._id}/reject`, "superadmin");
    assert.equal(res.status, 200);
    assert.equal(res.body.msg, "Doctor rejected");
    assert.equal(res.body.enrollment.approvalStatus, "rejected");
    await settle();
    const rows = await alerts();
    assert.equal(rows.length, 1);
    const [n] = rows;
    assert.equal(n.type, "doctor_rejected");
    assert.equal(n.title, "Doctor application rejected");
    assert.equal(n.message, "Dr. Jane Roe's application was rejected.");
    assert.equal(n.link, `/admin-dashboard/doctor-profile/${e._id}`);
    assert.ok(!JSON.stringify(rows).includes(SECRET));
    assert.equal((await Doctor.findById(doctor._id)).isEnrolled, false);
    assert.deepEqual(welcomeMails, []);
  });

  test("failed, unauthorized and no-op decisions create no notification", async () => {
    const incomplete = await makeEnrollment({ formCompleted: false, completedSteps: 2 });
    const approved = await makeEnrollment({ approvalStatus: "approved" });
    const rejected = await makeEnrollment({ approvalStatus: "rejected" });
    const pendingDelete = await makeEnrollment({ profileDeleteRequestStatus: "pending" });
    const missing = new mongoose.Types.ObjectId();

    assert.equal((await put(`/${incomplete._id}/approve`)).status, 400);
    assert.equal((await put(`/${pendingDelete._id}/approve`)).status, 400);
    assert.equal((await put(`/${missing}/approve`)).status, 404);
    assert.equal((await put(`/${missing}/reject`)).status, 404);
    assert.equal((await put(`/${incomplete._id}/approve`, "")).status, 401);
    for (const role of ["user", "doctor", "paymentadmin"]) {
      assert.equal((await put(`/${incomplete._id}/approve`, role)).status, 403, role);
      assert.equal((await put(`/${incomplete._id}/reject`, role)).status, 403, role);
    }
    // Unchanged status: re-approving an approved doctor / re-rejecting a rejected one.
    assert.equal((await put(`/${approved._id}/approve`)).status, 200);
    assert.equal((await put(`/${rejected._id}/reject`)).status, 200);
    await settle();
    assert.equal((await alerts()).length, 0);
    assert.equal((await Enrollment.findById(incomplete._id)).approvalStatus, "pending");
  });

  test("approving or rejecting a staged profile update is not an application decision", async () => {
    const e = await makeEnrollment({ approvalStatus: "approved", pendingRequestType: "profile_update" });
    assert.equal((await put(`/${e._id}/approve`)).status, 200);
    const e2 = await makeEnrollment({ approvalStatus: "approved", pendingRequestType: "profile_update" });
    assert.equal((await put(`/${e2._id}/reject`)).status, 200);
    await settle();
    assert.equal((await alerts()).length, 0);
  });

  test("repeating a request does not duplicate; a later reversal is a new alert", async () => {
    const e = await makeEnrollment();
    assert.equal((await put(`/${e._id}/approve`)).status, 200);
    assert.equal((await put(`/${e._id}/approve`)).status, 200); // already approved: no-op
    await settle();
    assert.equal((await alerts("doctor_approved")).length, 1);

    await new Promise((r) => setTimeout(r, 10));
    assert.equal((await put(`/${e._id}/reject`)).status, 200); // approved -> rejected
    assert.equal((await put(`/${e._id}/reject`)).status, 200); // no-op
    await settle();
    assert.equal((await alerts("doctor_rejected")).length, 1);

    await new Promise((r) => setTimeout(r, 10));
    assert.equal((await put(`/${e._id}/approve`)).status, 200); // rejected -> approved again
    await settle();
    const approvals = await alerts("doctor_approved");
    assert.equal(approvals.length, 2);
    assert.notEqual(approvals[0].dedupeKey, approvals[1].dedupeKey);
  });

  test("two concurrent approvals read the same prior state and raise one alert", async () => {
    const e = await makeEnrollment();
    await Promise.all([put(`/${e._id}/approve`), put(`/${e._id}/approve`)]);
    await settle();
    assert.equal((await alerts("doctor_approved")).length, 1);
  });

  test("a notification persistence failure does not fail the decision", async () => {
    const e = await makeEnrollment();
    const e2 = await makeEnrollment();
    await withBrokenNotifications(async () => {
      assert.equal((await put(`/${e._id}/approve`)).status, 200);
      assert.equal((await put(`/${e2._id}/reject`)).status, 200);
      await settle();
    });
    assert.equal((await Enrollment.findById(e._id)).approvalStatus, "approved");
    assert.equal((await Enrollment.findById(e2._id)).approvalStatus, "rejected");
    assert.equal((await alerts()).length, 0);
  });
});
