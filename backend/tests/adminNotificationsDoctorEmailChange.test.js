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
// it is the test-only channel for reading OTPs.
const mailer = require("../utils/sendEmail");
const mails = [];
mailer.sendEmailChangeOTPEmail = async (to, code) => { mails.push({ kind: "email-change", to, code }); };
mailer.sendOTPEmail = async (to, code, type) => { mails.push({ kind: type, to, code }); };

const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const Session = require("../models/Session");
const EmailChangeChallenge = require("../models/EmailChangeChallenge");
const DoctorEmailChangeAudit = require("../models/DoctorEmailChangeAudit");
const AdminNotification = require("../models/AdminNotification");

const PASSWORD = "Passw0rd!x";
const REQUEST = "/api/doctor/profile/email-change/request";
const VERIFY = "/api/doctor/profile/email-change/verify";
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

const profileAlerts = () => AdminNotification.find({ type: "doctor_profile_updated" }).sort({ createdAt: 1 }).lean();
const lastCode = (to) => [...mails].reverse().find((m) => m.kind === "email-change" && m.to === to)?.code;

async function createDoctor() {
  const email = `old.doctor${++seq}@example.com`;
  const doctor = await Doctor.create({ name: "Jane Roe", email, password: PASSWORD });
  const enrollment = await Enrollment.create({ doctorId: doctor._id, firstName: "Jane", surname: "Roe", email });
  const login = await call("POST", "/api/doctor/login", { body: { email, password: PASSWORD } });
  return { doctor, email, enrollmentId: String(enrollment._id), token: login.body.accessToken };
}

// Requests an OTP for newEmail and verifies it with the given code (default: the real one).
async function changeEmail(token, newEmail, { code } = {}) {
  const req = await call("POST", REQUEST, { token, body: { newEmail } });
  if (req.status !== 200) return req;
  return call("POST", VERIFY, { token, body: { newEmail, otp: code ?? lastCode(newEmail) } });
}

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

describe("admin notification for doctor email changes (real routes, in-memory MongoDB)", () => {
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
    await Promise.all([
      Doctor.deleteMany({}), Enrollment.deleteMany({}), Session.deleteMany({}),
      EmailChangeChallenge.deleteMany({}), DoctorEmailChangeAudit.deleteMany({}), AdminNotification.deleteMany({}),
    ]);
    mails.length = 0;
  });

  test("a verified email change creates exactly one safe notification", async () => {
    const { doctor, email, enrollmentId, token } = await createDoctor();
    const res = await changeEmail(token, "brand.new@example.com");
    assert.equal(res.status, 200);
    assert.equal((await Doctor.findById(doctor._id)).email, "brand.new@example.com");
    const rows = await profileAlerts();
    assert.equal(rows.length, 1);
    const [n] = rows;
    assert.equal(n.title, "Doctor profile updated");
    assert.equal(n.message, "Jane Roe updated their profile.");
    assert.equal(n.refType, "enrollment");
    assert.equal(n.refId, enrollmentId);
    assert.equal(n.link, `/admin-dashboard/doctor-profile/${enrollmentId}`);
    const json = JSON.stringify(rows);
    assert.ok(!json.includes("brand.new"));
    assert.ok(!json.includes(email));
    assert.ok(!json.includes("@example.com"));
    assert.ok(!json.includes(lastCode("brand.new@example.com")));
  });

  test("two successive email changes produce two distinct notifications", async () => {
    const { doctor } = await createDoctor();
    const first = await changeEmail((await call("POST", "/api/doctor/login", { body: { email: (await Doctor.findById(doctor._id)).email, password: PASSWORD } })).body.accessToken, "one@example.com");
    assert.equal(first.status, 200);
    await new Promise((r) => setTimeout(r, 5));
    const login = await call("POST", "/api/doctor/login", { body: { email: "one@example.com", password: PASSWORD } });
    // The OTP resend cooldown is per challenge; the first was deleted on success.
    const second = await changeEmail(login.body.accessToken, "two@example.com");
    assert.equal(second.status, 200);
    const rows = await profileAlerts();
    assert.equal(rows.length, 2);
    assert.notEqual(rows[0].dedupeKey, rows[1].dedupeKey);
  });

  test("requesting an OTP, a wrong OTP, or the same email creates no notification", async () => {
    const { email, token } = await createDoctor();
    assert.equal((await call("POST", REQUEST, { token, body: { newEmail: "pending@example.com" } })).status, 200);
    assert.equal((await call("POST", VERIFY, { token, body: { newEmail: "pending@example.com", otp: "000000" } })).status, 400);
    assert.equal((await call("POST", REQUEST, { token, body: { newEmail: email } })).status, 400);
    assert.equal((await call("POST", REQUEST, { token, body: { newEmail: "not-an-email" } })).status, 400);
    assert.equal((await AdminNotification.find({}).lean()).length, 0);
  });

  test("a notification persistence failure does not fail the email change", async () => {
    const { doctor, token } = await createDoctor();
    const res = await withBrokenNotifications(() => changeEmail(token, "resilient@example.com"));
    assert.equal(res.status, 200);
    assert.equal((await Doctor.findById(doctor._id)).email, "resilient@example.com");
    assert.equal((await AdminNotification.find({}).lean()).length, 0);
  });

  test("a doctor with no enrollment record still changes email without error or alert", async () => {
    const { doctor, token } = await createDoctor();
    await Enrollment.deleteMany({});
    const res = await changeEmail(token, "noenroll@example.com");
    assert.equal(res.status, 200);
    assert.equal((await Doctor.findById(doctor._id)).email, "noenroll@example.com");
    assert.equal((await AdminNotification.find({}).lean()).length, 0);
  });
});
