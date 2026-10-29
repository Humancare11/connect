const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

// Mocked mail provider, installed BEFORE the routes load: no real email is sent.
const mailer = require("../utils/sendEmail");
const mails = [];
mailer.sendOTPEmail = async (to, code, type) => { mails.push({ kind: type, to, code }); };

const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const Session = require("../models/Session");
const OTP = require("../models/OTP");
const AdminNotification = require("../models/AdminNotification");

const PASSWORD = "Passw0rd!x";
const REASON = "private reason: moving abroad 54321";
const PATH = "/api/doctor/profile-delete-request";
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
const alerts = () => AdminNotification.find({ type: "doctor_account_deletion_requested" }).sort({ createdAt: 1 }).lean();

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

describe("admin notification for doctor deletion requests (real route, in-memory MongoDB)", () => {
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

  async function registeredDoctor() {
    const email = `delete.doctor${++seq}@example.com`;
    const name = "Jane Roe";
    await call("POST", "/api/doctor/send-register-otp", { body: { email, name } });
    const otp = [...mails].reverse().find((m) => m.to === email)?.code;
    const res = await call("POST", "/api/doctor/register", { body: { name, email, password: PASSWORD, confirmPassword: PASSWORD, otp } });
    const doctorId = res.body.doctor.id;
    const enrollment = await Enrollment.findOne({ doctorId }).lean();
    await settle();
    await AdminNotification.deleteMany({});
    return { token: res.body.accessToken, doctorId, email, enrollmentId: String(enrollment._id) };
  }
  const request = (token, reason = REASON) => call("POST", PATH, { token, body: { reason } });

  test("a successful request creates one notification with the right shape and no sensitive data", async () => {
    const { token, email, enrollmentId } = await registeredDoctor();
    const res = await request(token);
    assert.equal(res.status, 201);
    await settle();
    const rows = await alerts();
    assert.equal(rows.length, 1);
    const [n] = rows;
    assert.equal(n.title, "Doctor account deletion requested");
    assert.equal(n.message, "Dr. Jane Roe requested account deletion.");
    assert.equal(n.refType, "enrollment");
    assert.equal(n.refId, enrollmentId);
    assert.equal(n.link, `/admin-dashboard/doctor-profile/${enrollmentId}`);
    assert.match(n.dedupeKey, new RegExp(`^doctor_account_deletion_requested:${enrollmentId}:\\d+$`));
    assert.ok(AdminNotification.isInternalAdminLink(n.link));
    const json = JSON.stringify(rows);
    assert.ok(!json.includes(REASON));
    assert.ok(!json.includes("54321"));
    assert.ok(!json.includes(email));
  });

  test("a duplicate pending request is rejected and creates no second alert", async () => {
    const { token } = await registeredDoctor();
    assert.equal((await request(token)).status, 201);
    assert.equal((await request(token)).status, 400);
    await settle();
    assert.equal((await alerts()).length, 1);
  });

  test("failed requests create no notification", async () => {
    const { token } = await registeredDoctor();
    assert.equal((await call("POST", PATH, { body: { reason: "x" } })).status, 401);
    await Enrollment.deleteMany({});
    assert.equal((await request(token)).status, 404);
    await settle();
    assert.equal((await AdminNotification.find({}).lean()).length, 0);
  });

  test("a notification persistence failure does not fail the request", async () => {
    const { token, doctorId } = await registeredDoctor();
    await withBrokenNotifications(async () => {
      const res = await request(token);
      assert.equal(res.status, 201);
      assert.match(res.body.message, /sent to admin/);
      await settle();
    });
    const saved = await Enrollment.findOne({ doctorId }).lean();
    assert.equal(saved.profileDeleteRequestStatus, "pending");
    assert.equal(saved.pendingRequestType, "profile_delete");
    assert.equal((await AdminNotification.find({}).lean()).length, 0);
  });

  test("a new request after an admin rejection is a new alert", async () => {
    const { token, doctorId } = await registeredDoctor();
    assert.equal((await request(token)).status, 201);
    await settle();
    // What rejectDoctorDeleteRequest persists.
    await Enrollment.updateOne({ doctorId }, { profileDeleteRequestStatus: "rejected", pendingRequestType: "none" });
    await new Promise((r) => setTimeout(r, 5));
    assert.equal((await request(token)).status, 201);
    await settle();
    const rows = await alerts();
    assert.equal(rows.length, 2);
    assert.notEqual(rows[0].dedupeKey, rows[1].dedupeKey);
  });

  test("the same request notified twice is deduplicated", async () => {
    const { token, doctorId } = await registeredDoctor();
    await request(token);
    await settle();
    const { notifyAdminDoctorDeletionRequested } = require("../utils/adminNotifications");
    const result = await notifyAdminDoctorDeletionRequested({
      enrollment: await Enrollment.findOne({ doctorId }),
      doctor: await Doctor.findById(doctorId),
    });
    assert.equal(result.status, "deduplicated");
    assert.equal((await alerts()).length, 1);
  });
});
