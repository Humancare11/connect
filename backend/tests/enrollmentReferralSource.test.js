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

const PASSWORD = "Passw0rd!x";
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

describe("enrollment step 1: how did you hear about us (real routes, in-memory MongoDB)", () => {
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Doctor.init();
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

  // A newly registered doctor whose enrollment is still in progress.
  async function newDoctor() {
    const email = `referral.doctor${++seq}@example.com`;
    const name = "Jane Roe";
    await call("POST", "/api/doctor/send-register-otp", { body: { email, name } });
    const otp = [...mails].reverse().find((m) => m.to === email)?.code;
    const res = await call("POST", "/api/doctor/register", {
      body: { name, email, password: PASSWORD, confirmPassword: PASSWORD, otp },
    });
    return { token: res.body.accessToken, doctorId: res.body.doctor.id };
  }
  const saveStep1 = (token, doctorId, data) =>
    call("PATCH", "/api/doctor/enrollment/step", { token, body: { doctorId: String(doctorId), step: 1, data } });
  const stored = (doctorId) => Enrollment.findOne({ doctorId }).lean();

  for (const value of ["indeed", "facebook", "instagram", "ai", "google", "others"]) {
    test(`step save accepts and stores "${value}"`, async () => {
      const { token, doctorId } = await newDoctor();
      const res = await saveStep1(token, doctorId, { referralSource: value });
      assert.equal(res.status, 200);
      assert.equal((await stored(doctorId)).referralSource, value);
    });
  }

  test("values outside the list are rejected and nothing is stored", async () => {
    const { token, doctorId } = await newDoctor();
    for (const bad of ["twitter", "INDEED!", { $ne: null }, ["google"], 5]) {
      const res = await saveStep1(token, doctorId, { referralSource: bad });
      assert.equal(res.status, 400, `rejected: ${JSON.stringify(bad)}`);
    }
    assert.ok(!(await stored(doctorId)).referralSource);
  });

  test("an empty value is allowed on Save (stored as null)", async () => {
    const { token, doctorId } = await newDoctor();
    const res = await saveStep1(token, doctorId, { referralSource: "", referralSourceOther: "" });
    assert.equal(res.status, 200);
    assert.equal((await stored(doctorId)).referralSource ?? null, null);
  });

  test("the free text is kept (trimmed, max 100) only for \"others\"", async () => {
    const { token, doctorId } = await newDoctor();
    await saveStep1(token, doctorId, { referralSource: "others", referralSourceOther: `  ${"x".repeat(150)}  ` });
    let doc = await stored(doctorId);
    assert.equal(doc.referralSource, "others");
    assert.equal(doc.referralSourceOther, "x".repeat(100));

    await saveStep1(token, doctorId, { referralSource: "google", referralSourceOther: "left over text" });
    doc = await stored(doctorId);
    assert.equal(doc.referralSource, "google");
    assert.equal(doc.referralSourceOther, "", "discarded when the source is not others");
  });

  test("a step save without the referral keys leaves the stored answer alone", async () => {
    const { token, doctorId } = await newDoctor();
    await saveStep1(token, doctorId, { referralSource: "ai" });
    const res = await saveStep1(token, doctorId, { city: "Austin" });
    assert.equal(res.status, 200);
    const doc = await stored(doctorId);
    assert.equal(doc.referralSource, "ai");
    assert.equal(doc.city, "Austin");
  });

  test("the final submit saves the answer and rejects a bad one", async () => {
    const { token, doctorId } = await newDoctor();
    const bad = await call("POST", "/api/doctor/enrollment", {
      token, body: { doctorId: String(doctorId), zip: "10001", referralSource: "twitter" },
    });
    assert.equal(bad.status, 400);
    const ok = await call("POST", "/api/doctor/enrollment", {
      token, body: { doctorId: String(doctorId), zip: "10001", referralSource: "others", referralSourceOther: "A friend" },
    });
    assert.equal(ok.status, 201);
    const doc = await stored(doctorId);
    assert.equal(doc.referralSource, "others");
    assert.equal(doc.referralSourceOther, "A friend");
  });

  test("existing enrollments without the fields still load and save", async () => {
    const { token, doctorId } = await newDoctor();
    await Enrollment.collection.updateOne({ doctorId: new mongoose.Types.ObjectId(String(doctorId)) }, { $unset: { referralSource: "", referralSourceOther: "" } });
    const res = await saveStep1(token, doctorId, { city: "Austin" });
    assert.equal(res.status, 200);
    assert.equal((await stored(doctorId)).city, "Austin");
  });
});
