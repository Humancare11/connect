const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

// Mocked mail provider, installed BEFORE the routes load. It is also the
// test-only channel for reading OTPs; nothing is ever returned by the API.
const mailer = require("../utils/sendEmail");
const mails = [];
let mailFails = false;
mailer.sendEmailChangeOTPEmail = async (to, code) => {
  if (mailFails) throw new Error("smtp down");
  mails.push({ kind: "email-change", to, code });
};
mailer.sendOTPEmail = async (to, code, type) => {
  mails.push({ kind: type, to, code });
};

const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const Session = require("../models/Session");
const Appointment = require("../models/Appointment");
const EmailChangeChallenge = require("../models/EmailChangeChallenge");
const DoctorEmailChangeAudit = require("../models/DoctorEmailChangeAudit");
const { MAX_ATTEMPTS, RESEND_COOLDOWN_MS } = require("../utils/doctorEmailChange");

const PASSWORD = "Passw0rd!x";
const REQUEST = "/api/doctor/profile/email-change/request";
const VERIFY = "/api/doctor/profile/email-change/verify";

let mongod;
let server;
let base;

async function call(method, path, { body, token } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, body: json };
}

async function createDoctor(email, name = "Dr Test") {
  const doctor = await Doctor.create({ name, email, password: PASSWORD });
  await Enrollment.create({ doctorId: doctor._id, firstName: "Dr", surname: "Test", email });
  return doctor;
}

async function login(email) {
  const res = await call("POST", "/api/doctor/login", { body: { email, password: PASSWORD } });
  return res;
}

const lastMail = (kind) => [...mails].reverse().find((m) => m.kind === kind);
const emailOf = async (doctor) => (await Doctor.findById(doctor._id)).email;

describe("doctor email change over HTTP", () => {
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Doctor.init();
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use("/api/doctor", require("../routes/doctorAuth"));
    app.use("/api/auth", require("../routes/auth"));
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
      EmailChangeChallenge.deleteMany({}), Appointment.deleteMany({}), DoctorEmailChangeAudit.deleteMany({}),
    ]);
    mails.length = 0;
    mailFails = false;
  });

  test("unauthenticated requests are rejected on both endpoints", async () => {
    assert.equal((await call("POST", REQUEST, { body: { newEmail: "a@example.com" } })).status, 401);
    assert.equal((await call("POST", VERIFY, { body: { newEmail: "a@example.com", otp: "123456" } })).status, 401);
    assert.equal(mails.length, 0);
  });

  test("request: authenticated doctor gets an OTP at the new address, nothing leaks", async () => {
    const doc = await createDoctor("old@example.com");
    const { body: { accessToken } } = await login("old@example.com");
    const res = await call("POST", REQUEST, { token: accessToken, body: { newEmail: "New@Example.com" } });
    assert.equal(res.status, 200);
    assert.match(res.body.message, /OTP has been sent to your new email/);
    const code = lastMail("email-change").code;
    assert.equal(lastMail("email-change").to, "new@example.com");
    assert.ok(!JSON.stringify(res.body).includes(code), "OTP must not appear in the response");
    assert.equal(await emailOf(doc), "old@example.com");
    const stored = await EmailChangeChallenge.findOne({ doctorId: doc._id }).lean();
    assert.ok(!JSON.stringify(stored).includes(code), "OTP stored hashed");
    assert.ok(stored.expiresAt.getTime() - Date.now() <= 5 * 60 * 1000 + 1000, "5 minute expiry");
  });

  test("verify: wrong, expired and reused OTPs are rejected and keep the old email", async () => {
    const doc = await createDoctor("old@example.com");
    const { body: { accessToken: token } } = await login("old@example.com");
    await call("POST", REQUEST, { token, body: { newEmail: "new@example.com" } });
    const code = lastMail("email-change").code;
    const wrong = code === "111111" ? "222222" : "111111";

    assert.equal((await call("POST", VERIFY, { token, body: { newEmail: "new@example.com", otp: wrong } })).status, 400);
    assert.equal(await emailOf(doc), "old@example.com");

    await EmailChangeChallenge.updateOne({}, { expiresAt: new Date(Date.now() - 1000) });
    assert.equal((await call("POST", VERIFY, { token, body: { newEmail: "new@example.com", otp: code } })).status, 400);
    assert.equal(await emailOf(doc), "old@example.com");
  });

  test("verify: OTP reuse after success is rejected", async () => {
    const doc = await createDoctor("old@example.com");
    const { body: { accessToken: token } } = await login("old@example.com");
    await call("POST", REQUEST, { token, body: { newEmail: "new@example.com" } });
    const code = lastMail("email-change").code;
    const ok = await call("POST", VERIFY, { token, body: { newEmail: "new@example.com", otp: code } });
    assert.equal(ok.status, 200);
    // The session was revoked, so a replay with the same token is refused outright...
    assert.equal((await call("POST", VERIFY, { token, body: { newEmail: "new@example.com", otp: code } })).status, 401);
    // ...and with a fresh session the used challenge is gone.
    const fresh = (await login("new@example.com")).body.accessToken;
    assert.equal((await call("POST", VERIFY, { token: fresh, body: { newEmail: "new@example.com", otp: code } })).status, 400);
    assert.equal(await emailOf(doc), "new@example.com");
  });

  test("verify: attempts are capped, then even the right OTP is refused", async () => {
    const doc = await createDoctor("old@example.com");
    const { body: { accessToken: token } } = await login("old@example.com");
    await call("POST", REQUEST, { token, body: { newEmail: "new@example.com" } });
    const code = lastMail("email-change").code;
    const wrong = code === "111111" ? "222222" : "111111";
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      assert.equal((await call("POST", VERIFY, { token, body: { newEmail: "new@example.com", otp: wrong } })).status, 400);
    }
    assert.equal((await call("POST", VERIFY, { token, body: { newEmail: "new@example.com", otp: code } })).status, 429);
    assert.equal(await emailOf(doc), "old@example.com");
  });

  test("request: resend cooldown, then the per-doctor rate limit", async () => {
    await createDoctor("old@example.com");
    const { body: { accessToken: token } } = await login("old@example.com");
    assert.equal((await call("POST", REQUEST, { token, body: { newEmail: "new@example.com" } })).status, 200);
    const cooldown = await call("POST", REQUEST, { token, body: { newEmail: "new@example.com" } });
    assert.equal(cooldown.status, 429);
    assert.ok(cooldown.body.retryAfterMs > 0 && cooldown.body.retryAfterMs <= RESEND_COOLDOWN_MS);
    for (let i = 0; i < 3; i++) await call("POST", REQUEST, { token, body: { newEmail: "new@example.com" } });
    const limited = await call("POST", REQUEST, { token, body: { newEmail: "new@example.com" } });
    assert.equal(limited.status, 429);
    assert.ok(limited.body.retryAfterSeconds > 0, "rate limiter (not just the cooldown) answered");
    assert.equal(mails.length, 1);
  });

  test("request: an address registered to another doctor cannot be claimed", async () => {
    const doc = await createDoctor("old@example.com");
    await createDoctor("taken@example.com", "Dr Other");
    const { body: { accessToken: token } } = await login("old@example.com");
    const res = await call("POST", REQUEST, { token, body: { newEmail: "taken@example.com" } });
    assert.equal(res.status, 409);
    assert.ok(!/taken@example\.com|Dr Other/.test(JSON.stringify(res.body)), "no detail about the other account");
    assert.equal(mails.length, 0);
    assert.equal(await emailOf(doc), "old@example.com");
  });

  test("a doctor cannot change another doctor's email through the request body", async () => {
    const a = await createDoctor("a@example.com", "Dr A");
    const b = await createDoctor("b@example.com", "Dr B");
    const { body: { accessToken: tokenB } } = await login("b@example.com");
    const res = await call("POST", REQUEST, {
      token: tokenB,
      body: { newEmail: "evil@example.com", doctorId: String(a._id), id: String(a._id) },
    });
    assert.equal(res.status, 200);
    const challenge = await EmailChangeChallenge.findOne({});
    assert.equal(String(challenge.doctorId), String(b._id), "challenge belongs to the token's doctor");
    await call("POST", VERIFY, {
      token: tokenB,
      body: { newEmail: "evil@example.com", otp: lastMail("email-change").code, doctorId: String(a._id) },
    });
    assert.equal(await emailOf(a), "a@example.com");
    assert.equal(await emailOf(b), "evil@example.com");
  });

  test("an OTP issued to one doctor cannot be used by another", async () => {
    await createDoctor("a@example.com", "Dr A");
    const b = await createDoctor("b@example.com", "Dr B");
    const tokenA = (await login("a@example.com")).body.accessToken;
    const tokenB = (await login("b@example.com")).body.accessToken;
    await call("POST", REQUEST, { token: tokenA, body: { newEmail: "new@example.com" } });
    const res = await call("POST", VERIFY, { token: tokenB, body: { newEmail: "new@example.com", otp: lastMail("email-change").code } });
    assert.equal(res.status, 400);
    assert.equal(await emailOf(b), "b@example.com");
  });

  test("email delivery failure: 502 and the email is unchanged", async () => {
    const doc = await createDoctor("old@example.com");
    const { body: { accessToken: token } } = await login("old@example.com");
    mailFails = true;
    const res = await call("POST", REQUEST, { token, body: { newEmail: "new@example.com" } });
    assert.equal(res.status, 502);
    assert.ok(!/has been sent/.test(res.body.message));
    assert.equal(await emailOf(doc), "old@example.com");
    assert.equal(await EmailChangeChallenge.countDocuments(), 0);
  });

  test("two doctors racing for one address: one succeeds, no duplicate accounts", async () => {
    const a = await createDoctor("a@example.com", "Dr A");
    const b = await createDoctor("b@example.com", "Dr B");
    const tokenA = (await login("a@example.com")).body.accessToken;
    const tokenB = (await login("b@example.com")).body.accessToken;
    await call("POST", REQUEST, { token: tokenA, body: { newEmail: "shared@example.com" } });
    const codeA = lastMail("email-change").code;
    await call("POST", REQUEST, { token: tokenB, body: { newEmail: "shared@example.com" } });
    const codeB = lastMail("email-change").code;
    const results = await Promise.all([
      call("POST", VERIFY, { token: tokenA, body: { newEmail: "shared@example.com", otp: codeA } }),
      call("POST", VERIFY, { token: tokenB, body: { newEmail: "shared@example.com", otp: codeB } }),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    assert.equal(await Doctor.countDocuments({ email: "shared@example.com" }), 1);
    assert.equal(await Doctor.countDocuments(), 2);
    void a; void b;
  });

  test("real login flow, recovery and sessions after a successful change", async () => {
    const doc = await createDoctor("old@example.com");
    await Appointment.collection.insertOne({ doctorId: doc._id, note: "keep me" });
    const first = await login("old@example.com");
    const token = first.body.accessToken;
    const refreshToken = first.body.refreshToken;
    assert.equal((await call("GET", "/api/doctor/me", { token })).status, 200);
    // Control: the refresh token is valid until the change (so the 401 below is meaningful).
    assert.equal((await call("POST", "/api/auth/refresh", { token: refreshToken, body: { role: "doctor" } })).status, 200);

    await call("POST", REQUEST, { token, body: { newEmail: "new@example.com" } });
    const res = await call("POST", VERIFY, { token, body: { newEmail: "new@example.com", otp: lastMail("email-change").code } });
    assert.equal(res.status, 200);
    assert.equal(res.body.reauthRequired, true);
    assert.equal(res.body.email, "new@example.com");

    // Canonical DB state.
    assert.equal(await Doctor.countDocuments({ email: "old@example.com" }), 0);
    assert.equal((await Enrollment.findOne({ doctorId: doc._id })).email, "new@example.com");

    // Real login endpoint.
    assert.equal((await login("old@example.com")).status, 401);
    const viaNew = await login("new@example.com");
    assert.equal(viaNew.status, 200);
    assert.equal(String(viaNew.body.doctor.id), String(doc._id), "same account");
    assert.equal(viaNew.body.doctor.doctorId, doc.doctorId);
    assert.equal(viaNew.body.doctor.email, "new@example.com");
    assert.equal(await Appointment.collection.countDocuments({ doctorId: doc._id }), 1, "related records intact");

    // Previously issued tokens are dead: access token and refresh token.
    assert.equal((await call("GET", "/api/doctor/me", { token })).status, 401);
    const refreshed = await call("POST", "/api/auth/refresh", { token: refreshToken, body: { role: "doctor" } });
    assert.equal(refreshed.status, 401);
    // ...while the session from the new login works.
    assert.equal((await call("GET", "/api/doctor/me", { token: viaNew.body.accessToken })).status, 200);

    // Password recovery: old address has no account, new one does.
    mails.length = 0;
    const forgotOld = await call("POST", "/api/doctor/send-forgot-otp", { body: { email: "old@example.com" } });
    const forgotNew = await call("POST", "/api/doctor/send-forgot-otp", { body: { email: "new@example.com" } });
    assert.equal(forgotOld.status, 200);
    assert.deepEqual(forgotOld.body, forgotNew.body, "identical responses");
    assert.deepEqual(mails.map((m) => m.to), ["new@example.com"], "only the new address receives a reset OTP");
  });

  test("a stale profile save cannot restore the old email", async () => {
    const doc = await createDoctor("old@example.com");
    const token0 = (await login("old@example.com")).body.accessToken;
    await call("POST", REQUEST, { token: token0, body: { newEmail: "new@example.com" } });
    await call("POST", VERIFY, { token: token0, body: { newEmail: "new@example.com", otp: lastMail("email-change").code } });
    const token = (await login("new@example.com")).body.accessToken;

    const step = await call("PATCH", "/api/doctor/enrollment/step", {
      token,
      body: { doctorId: String(doc._id), step: 1, data: { email: "old@example.com", firstName: "Renamed" } },
    });
    assert.equal(step.status, 200);
    const enrollment = await Enrollment.findOne({ doctorId: doc._id });
    assert.equal(enrollment.firstName, "Renamed", "other fields still save");
    assert.equal(enrollment.email, "new@example.com");
    assert.equal(await emailOf(doc), "new@example.com");
  });
  test("audit: every step is persisted with safe categories and no secrets", async () => {
    // Distinct address: the login limiter is keyed by email and shared across tests.
    const doc = await createDoctor("audit-one@example.com");
    const first = await login("audit-one@example.com");
    const token = first.body.accessToken;

    mailFails = true;
    await call("POST", REQUEST, { token, body: { newEmail: "new@example.com" } }); // delivery failure
    mailFails = false;
    await call("POST", REQUEST, { token, body: { newEmail: "new@example.com" } });
    const code = lastMail("email-change").code;
    const wrong = code === "111111" ? "222222" : "111111";
    await call("POST", VERIFY, { token, body: { newEmail: "new@example.com", otp: wrong } });
    const ok = await call("POST", VERIFY, { token, body: { newEmail: "new@example.com", otp: code } });
    assert.equal(ok.status, 200);

    const rows = await DoctorEmailChangeAudit.find({ doctorId: doc._id }).sort({ createdAt: 1, _id: 1 }).lean();
    assert.deepEqual(
      rows.map((r) => [r.action, r.outcome, r.reason]),
      [
        ["request", "failure", "email_delivery_failed"],
        ["request", "success", ""],
        ["verify", "failure", "otp_invalid"],
        ["complete", "success", ""],
      ]
    );
    assert.ok(rows.every((r) => r.createdAt instanceof Date));

    const stored = JSON.stringify(rows);
    for (const secret of [code, wrong, PASSWORD, token, first.body.refreshToken, "audit-one@example.com", "new@example.com"]) {
      assert.ok(!stored.includes(secret), "audit rows must not contain " + (secret.length > 12 ? "a token" : secret));
    }
    assert.ok(!/otpHash/i.test(stored));
  });

  test("audit: a failed audit write never breaks the email change", async () => {
    const doc = await createDoctor("audit-two@example.com");
    const token = (await login("audit-two@example.com")).body.accessToken;
    await call("POST", REQUEST, { token, body: { newEmail: "new@example.com" } });
    const original = DoctorEmailChangeAudit.create;
    DoctorEmailChangeAudit.create = async () => { throw new Error("audit store down"); };
    try {
      const res = await call("POST", VERIFY, { token, body: { newEmail: "new@example.com", otp: lastMail("email-change").code } });
      assert.equal(res.status, 200);
    } finally {
      DoctorEmailChangeAudit.create = original;
    }
    assert.equal(await emailOf(doc), "new@example.com");
  });
});
