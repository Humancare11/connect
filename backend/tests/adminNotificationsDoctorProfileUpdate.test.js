const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

// Mocked mail provider, installed BEFORE the routes load: no real email is sent, and
// it is the test-only channel for reading the registration OTP.
const mailer = require("../utils/sendEmail");
const mails = [];
mailer.sendOTPEmail = async (to, code, type) => { mails.push({ kind: type, to, code }); };

const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const Session = require("../models/Session");
const OTP = require("../models/OTP");
const AdminNotification = require("../models/AdminNotification");
const { notifyAdminDoctorProfileUpdated } = require("../utils/adminNotifications");

const PASSWORD = "Passw0rd!x";
const SECRET_BIO = "private bio text about my illness 98765";
let seq = 0;
let mongod, server, base;

async function call(method, path, { body, token } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, body: json };
}

const settle = () => new Promise((r) => setTimeout(r, 150));
const profileAlerts = () => AdminNotification.find({ type: "doctor_profile_updated" }).sort({ createdAt: 1 }).lean();

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

describe("admin notification for doctor profile updates (real routes, in-memory MongoDB)", () => {
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Doctor.init();
    await AdminNotification.init();
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use("/api/doctor", require("../routes/doctorAuth"));
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await Promise.all([Doctor.deleteMany({}), Enrollment.deleteMany({}), Session.deleteMany({}), OTP.deleteMany({}), AdminNotification.deleteMany({})]);
    mails.length = 0;
  });

  // An approved doctor with a live profile, ready to edit.
  async function approvedDoctor() {
    const email = `profile.doctor${++seq}@example.com`;
    const name = "Jane Roe";
    await call("POST", "/api/doctor/send-register-otp", { body: { email, name } });
    const otp = [...mails].reverse().find((m) => m.to === email)?.code;
    const res = await call("POST", "/api/doctor/register", {
      body: { name, email, password: PASSWORD, confirmPassword: PASSWORD, otp },
    });
    const doctorId = res.body.doctor.id;
    await Enrollment.updateOne(
      { doctorId },
      { approvalStatus: "approved", verified: true, formCompleted: true, pendingRequestType: "none", specialization: "Cardiology", zip: "10001" },
    );
    await settle();
    await AdminNotification.deleteMany({});
    const enrollment = await Enrollment.findOne({ doctorId }).lean();
    return { token: res.body.accessToken, doctorId, enrollmentId: String(enrollment._id) };
  }
  const edit = (token, doctorId, extra = {}) =>
    call("POST", "/api/doctor/enrollment", {
      token,
      body: { doctorId: String(doctorId), zip: "10001", firstName: "Jane", surname: "Roe", specialization: "Cardiology", ...extra },
    });

  test("a successful update creates one notification with the right shape and no profile data", async () => {
    const { token, doctorId, enrollmentId } = await approvedDoctor();
    const res = await edit(token, doctorId, { specialization: "Neurology", bio: SECRET_BIO });
    assert.equal(res.status, 201);
    assert.match(res.body.message, /Update request submitted/, "response unchanged");
    await settle();
    const rows = await profileAlerts();
    assert.equal(rows.length, 1);
    const [n] = rows;
    assert.equal(n.title, "Doctor profile updated");
    assert.equal(n.message, "Jane Roe updated their profile.");
    assert.equal(n.refType, "enrollment");
    assert.equal(n.refId, enrollmentId);
    assert.equal(n.link, `/admin-dashboard/doctor-profile/${enrollmentId}`);
    assert.match(n.dedupeKey, new RegExp(`^doctor_profile_updated:${enrollmentId}:\\d+$`));
    const json = JSON.stringify(rows);
    assert.ok(!json.includes("Neurology"));
    assert.ok(!json.includes(SECRET_BIO));
    assert.ok(!json.includes("@example.com"));
  });

  test("failed, unauthorised and unchanged updates create no notification", async () => {
    const { token, doctorId } = await approvedDoctor();
    const wrongDoctor = await call("POST", "/api/doctor/enrollment", { token, body: { doctorId: String(new mongoose.Types.ObjectId()), zip: "1" } });
    assert.equal(wrongDoctor.status, 403);
    const noToken = await call("POST", "/api/doctor/enrollment", { body: { doctorId: String(doctorId), zip: "1" } });
    assert.equal(noToken.status, 401);
    const noId = await call("POST", "/api/doctor/enrollment", { token, body: { zip: "1" } });
    assert.equal(noId.status, 400);
    const unchanged = await edit(token, doctorId);
    assert.equal(unchanged.status, 200);
    assert.match(unchanged.body.message, /No profile changes/);
    await settle();
    assert.equal((await AdminNotification.find({}).lean()).length, 0);
    assert.equal((await Enrollment.findOne({ doctorId }).lean()).pendingRequestType, "none");
  });

  test("a notification persistence failure does not fail the update", async () => {
    const { token, doctorId } = await approvedDoctor();
    await withBrokenNotifications(async () => {
      const res = await edit(token, doctorId, { specialization: "Neurology" });
      assert.equal(res.status, 201);
      assert.match(res.body.message, /Update request submitted/);
      await settle();
    });
    const saved = await Enrollment.findOne({ doctorId }).lean();
    assert.equal(saved.pendingRequestType, "profile_update");
    assert.equal(saved.profileUpdateRequestStatus, "pending");
    assert.equal((await AdminNotification.find({}).lean()).length, 0);
  });

  test("two distinct successful updates produce two distinct notifications", async () => {
    const { token, doctorId } = await approvedDoctor();
    assert.equal((await edit(token, doctorId, { specialization: "Neurology" })).status, 201);
    await settle();
    await new Promise((r) => setTimeout(r, 5)); // distinct profileUpdateRequestedAt
    assert.equal((await edit(token, doctorId, { specialization: "Dermatology" })).status, 201);
    await settle();
    const rows = await profileAlerts();
    assert.equal(rows.length, 2);
    assert.notEqual(rows[0].dedupeKey, rows[1].dedupeKey);
  });

  test("the same update notified twice is deduplicated", async () => {
    const { token, doctorId } = await approvedDoctor();
    await edit(token, doctorId, { specialization: "Neurology" });
    await settle();
    const enrollment = await Enrollment.findOne({ doctorId });
    const doctor = await Doctor.findById(doctorId);
    const result = await notifyAdminDoctorProfileUpdated({ enrollment, doctor });
    assert.equal(result.status, "deduplicated");
    assert.equal((await profileAlerts()).length, 1);
  });

  test("a doctor's first enrollment is not reported as a profile update", async () => {
    const email = `fresh.doctor${++seq}@example.com`;
    await call("POST", "/api/doctor/send-register-otp", { body: { email, name: "New Doc" } });
    const otp = [...mails].reverse().find((m) => m.to === email)?.code;
    const res = await call("POST", "/api/doctor/register", { body: { name: "New Doc", email, password: PASSWORD, confirmPassword: PASSWORD, otp } });
    await settle();
    const first = await edit(res.body.accessToken, res.body.doctor.id);
    assert.equal(first.status, 201);
    await settle();
    assert.equal((await profileAlerts()).length, 0);
  });
});
