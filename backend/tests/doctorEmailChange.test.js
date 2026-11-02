const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

// Capture the OTP the mailer would send; no real SMTP.
const mailer = require("../utils/sendEmail");
const mails = [];
let mailFails = false;
mailer.sendEmailChangeOTPEmail = async (to, code) => {
  if (mailFails) throw new Error("smtp down");
  mails.push({ to, code });
};

const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const Session = require("../models/Session");
const EmailChangeChallenge = require("../models/EmailChangeChallenge");
const {
  requestEmailChange, verifyEmailChange, EmailChangeError, RESEND_COOLDOWN_MS, MAX_ATTEMPTS,
} = require("../utils/doctorEmailChange");

let mongod;
let doctor;
let other;
const req = {};
const lastCode = () => mails[mails.length - 1].code;
const rejects = (promise, status) =>
  assert.rejects(promise, (e) => e instanceof EmailChangeError && e.status === status);

describe("doctor email change", () => {
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Doctor.init();
  });
  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await Promise.all([Doctor.deleteMany({}), Enrollment.deleteMany({}), Session.deleteMany({}), EmailChangeChallenge.deleteMany({})]);
    mails.length = 0;
    mailFails = false;
    doctor = await Doctor.create({ name: "Dr One", email: "old@example.com", password: "Passw0rd!x" });
    other = await Doctor.create({ name: "Dr Two", email: "taken@example.com", password: "Passw0rd!x" });
    await Enrollment.create({ doctorId: doctor._id, firstName: "Dr", surname: "One", email: "old@example.com" });
  });

  test("request sends an OTP to the NEW address and leaves the login email unchanged", async () => {
    await requestEmailChange(req, doctor._id, "  New@Example.com ");
    assert.equal(mails.length, 1);
    assert.equal(mails[0].to, "new@example.com");
    assert.equal((await Doctor.findById(doctor._id)).email, "old@example.com");
    const stored = await EmailChangeChallenge.findOne({ doctorId: doctor._id });
    assert.notEqual(stored.otpHash, lastCode(), "OTP must be stored hashed");
  });

  test("rejects invalid, identical and already-registered addresses", async () => {
    await rejects(requestEmailChange(req, doctor._id, "not-an-email"), 400);
    await rejects(requestEmailChange(req, doctor._id, "OLD@example.com"), 400);
    await rejects(requestEmailChange(req, doctor._id, "taken@example.com"), 409);
    assert.equal(mails.length, 0);
  });

  test("enforces the resend cooldown", async () => {
    await requestEmailChange(req, doctor._id, "new@example.com");
    await rejects(requestEmailChange(req, doctor._id, "new@example.com"), 429);
    await EmailChangeChallenge.updateOne({}, { lastSentAt: new Date(Date.now() - RESEND_COOLDOWN_MS - 1000) });
    await requestEmailChange(req, doctor._id, "new@example.com");
    assert.equal(mails.length, 2);
  });

  test("a failed email delivery is reported and leaves no challenge", async () => {
    mailFails = true;
    await rejects(requestEmailChange(req, doctor._id, "new@example.com"), 502);
    assert.equal(await EmailChangeChallenge.countDocuments(), 0);
  });

  test("correct OTP replaces the login email, syncs enrollment, revokes sessions", async () => {
    const session = await Session.create({ userId: String(doctor._id), role: "doctor", expiresAt: new Date(Date.now() + 3600e3) });
    await requestEmailChange(req, doctor._id, "new@example.com");
    const result = await verifyEmailChange(req, doctor._id, "new@example.com", lastCode());
    assert.equal(result.email, "new@example.com");

    assert.equal(await Doctor.findOne({ email: "old@example.com" }), null, "old email must not log in");
    const found = await Doctor.findOne({ email: "new@example.com" });
    assert.equal(String(found._id), String(doctor._id), "same account id");
    assert.equal(found.doctorId, doctor.doctorId);
    assert.equal((await Enrollment.findOne({ doctorId: doctor._id })).email, "new@example.com");
    assert.ok((await Session.findById(session._id)).revokedAt, "existing sessions revoked");
    assert.equal(await EmailChangeChallenge.countDocuments(), 0);
  });

  test("wrong OTP is rejected and keeps the old email; attempts are capped", async () => {
    await requestEmailChange(req, doctor._id, "new@example.com");
    const wrong = lastCode() === "111111" ? "222222" : "111111";
    for (let i = 0; i < MAX_ATTEMPTS; i++) await rejects(verifyEmailChange(req, doctor._id, "new@example.com", wrong), 400);
    // Even the right code is refused once the attempt budget is spent.
    await rejects(verifyEmailChange(req, doctor._id, "new@example.com", lastCode()), 429);
    assert.equal((await Doctor.findById(doctor._id)).email, "old@example.com");
  });

  test("expired OTP is rejected", async () => {
    await requestEmailChange(req, doctor._id, "new@example.com");
    await EmailChangeChallenge.updateOne({}, { expiresAt: new Date(Date.now() - 1000) });
    await rejects(verifyEmailChange(req, doctor._id, "new@example.com", lastCode()), 400);
    assert.equal((await Doctor.findById(doctor._id)).email, "old@example.com");
  });

  test("an OTP cannot be reused", async () => {
    await requestEmailChange(req, doctor._id, "new@example.com");
    const code = lastCode();
    await verifyEmailChange(req, doctor._id, "new@example.com", code);
    await rejects(verifyEmailChange(req, doctor._id, "new@example.com", code), 400);
  });

  test("an OTP is bound to the doctor and the email it was issued for", async () => {
    await requestEmailChange(req, doctor._id, "new@example.com");
    await rejects(verifyEmailChange(req, other._id, "new@example.com", lastCode()), 400);
    await rejects(verifyEmailChange(req, doctor._id, "different@example.com", lastCode()), 400);
    assert.equal((await Doctor.findById(other._id)).email, "taken@example.com");
  });

  test("the address is re-checked at commit time", async () => {
    await requestEmailChange(req, doctor._id, "new@example.com");
    await Doctor.create({ name: "Dr Three", email: "new@example.com" });
    await rejects(verifyEmailChange(req, doctor._id, "new@example.com", lastCode()), 409);
    assert.equal((await Doctor.findById(doctor._id)).email, "old@example.com");
  });

  test("concurrent verifies with the same OTP apply the change once", async () => {
    await requestEmailChange(req, doctor._id, "new@example.com");
    const code = lastCode();
    const results = await Promise.allSettled([
      verifyEmailChange(req, doctor._id, "new@example.com", code),
      verifyEmailChange(req, doctor._id, "new@example.com", code),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal((await Doctor.findById(doctor._id)).email, "new@example.com");
  });

  test("two doctors racing for one address: exactly one wins", async () => {
    const racer = await Doctor.create({ name: "Dr Four", email: "racer@example.com" });
    await requestEmailChange(req, doctor._id, "shared@example.com");
    const codeA = lastCode();
    await requestEmailChange(req, racer._id, "shared@example.com");
    const codeB = lastCode();
    const results = await Promise.allSettled([
      verifyEmailChange(req, doctor._id, "shared@example.com", codeA),
      verifyEmailChange(req, racer._id, "shared@example.com", codeB),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(await Doctor.countDocuments({ email: "shared@example.com" }), 1);
  });

  test("database failure after verification rolls the login email back", async () => {
    await requestEmailChange(req, doctor._id, "new@example.com");
    const original = Enrollment.updateOne;
    Enrollment.updateOne = async () => { throw new Error("db down"); };
    try {
      await rejects(verifyEmailChange(req, doctor._id, "new@example.com", lastCode()), 500);
    } finally {
      Enrollment.updateOne = original;
    }
    assert.equal((await Doctor.findById(doctor._id)).email, "old@example.com");
  });
});
