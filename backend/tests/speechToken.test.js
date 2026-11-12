const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");
const Enrollment = require("../models/Enrollment");
const config = require("../utils/speech/config");
const { createSpeechTokenService, SpeechTokenError, CACHE_MS } = require("../utils/speech/speechTokenService");
const productionRouter = require("../routes/speechToken");
const { createSpeechTokenRouter } = productionRouter;
const { speechTokenLimiter } = require("../middleware/rateLimiters");

const KEY = "test-azure-key-0123456789abcdef";
const TOKEN = "tok-eyJ-secret-token-value";

// Everything printed through console during these tests is collected so we can prove the key and tokens never reach a log.
const printed = [];
const realConsole = {};
for (const m of ["log", "info", "warn", "error"]) {
  realConsole[m] = console[m];
  console[m] = (...args) => { printed.push(args.map(String).join(" ")); };
}
after(() => {
  for (const m of Object.keys(realConsole)) console[m] = realConsole[m];
});

// ---- helpers ----------------------------------------------------------------------------------------------------------
const okRes = (text) => ({ ok: true, status: 200, text: async () => text });
const badRes = (status) => ({ ok: false, status, text: async () => "denied" });
function fakeFetch(handler = () => okRes(TOKEN)) {
  const calls = [];
  const fn = async (url, opts) => { calls.push({ url, opts }); return handler(url, opts, calls.length); };
  fn.calls = calls;
  return fn;
}
const goodConfig = () => ({ ok: true, key: KEY, region: "eastus" });

// ---- config -----------------------------------------------------------------------------------------------------------
describe("speech config", () => {
  test("the feature flag is off unless exactly 'true'", () => {
    assert.equal(config.isTranscriptionEnabled({}), false);
    assert.equal(config.isTranscriptionEnabled({ TRANSCRIPTION_ENABLED: "" }), false);
    assert.equal(config.isTranscriptionEnabled({ TRANSCRIPTION_ENABLED: "false" }), false);
    assert.equal(config.isTranscriptionEnabled({ TRANSCRIPTION_ENABLED: "1" }), false);
    assert.equal(config.isTranscriptionEnabled({ TRANSCRIPTION_ENABLED: "yes" }), false);
    assert.equal(config.isTranscriptionEnabled({ TRANSCRIPTION_ENABLED: " TRUE " }), true);
  });

  test("key and region: missing key and unsafe region are refused, region defaults to eastus", () => {
    assert.deepEqual(config.getSpeechConfig({}), { ok: false, reason: "missing_key" });
    assert.deepEqual(config.getSpeechConfig({ AZURE_SPEECH_KEY: "  " }), { ok: false, reason: "missing_key" });
    assert.deepEqual(config.getSpeechConfig({ AZURE_SPEECH_KEY: KEY }), { ok: true, key: KEY, region: "eastus" });
    assert.equal(config.getSpeechConfig({ AZURE_SPEECH_KEY: KEY, AZURE_SPEECH_REGION: "WestEurope" }).region, "westeurope");
    for (const bad of ["evil.com/x", "a b", "east_us", "../x", "e", "x".repeat(40)]) {
      assert.equal(config.getSpeechConfig({ AZURE_SPEECH_KEY: KEY, AZURE_SPEECH_REGION: bad }).reason, "bad_region", bad);
    }
  });

  test("the per-appointment cap defaults to 40 and accepts a positive integer", () => {
    assert.equal(config.getMaxTokensPerAppointment({}), 40);
    assert.equal(config.getMaxTokensPerAppointment({ SPEECH_TOKEN_MAX_PER_APPOINTMENT: "5" }), 5);
    for (const bad of ["0", "-3", "abc", "2.5", ""]) assert.equal(config.getMaxTokensPerAppointment({ SPEECH_TOKEN_MAX_PER_APPOINTMENT: bad }), 40, bad);
  });
});

// ---- service ----------------------------------------------------------------------------------------------------------
describe("speech token service", () => {
  let t;
  const now = () => t;
  beforeEach(() => { t = 1_000_000; printed.length = 0; });

  test("asks Azure once with the key, only to the Azure host, and returns token, region and time left", async () => {
    const f = fakeFetch();
    const s = createSpeechTokenService({ fetchFn: f, now, getConfig: goodConfig });
    const out = await s.getToken();
    assert.equal(out.token, TOKEN);
    assert.equal(out.region, "eastus");
    assert.equal(out.expiresInSeconds, 600);
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].url, "https://eastus.api.cognitive.microsoft.com/sts/v1.0/issueToken");
    assert.equal(f.calls[0].opts.method, "POST");
    assert.equal(f.calls[0].opts.headers["Ocp-Apim-Subscription-Key"], KEY);
    assert.ok(!("key" in out), "the key must never be part of the answer");
    assert.ok(!JSON.stringify(out).includes(KEY));
  });

  test("a token is shared for 4 minutes, then renewed; the time left counts down", async () => {
    const f = fakeFetch((url, o, n) => okRes("token-" + n));
    const s = createSpeechTokenService({ fetchFn: f, now, getConfig: goodConfig });
    assert.equal((await s.getToken()).token, "token-1");
    t += 3 * 60 * 1000;
    const again = await s.getToken();
    assert.equal(again.token, "token-1");
    assert.equal(again.expiresInSeconds, 420);
    assert.equal(f.calls.length, 1);
    t += CACHE_MS; // past the 4 minute cache
    const renewed = await s.getToken();
    assert.equal(renewed.token, "token-2");
    assert.equal(renewed.expiresInSeconds, 600);
    assert.equal(f.calls.length, 2);
  });

  test("every token handed out has at least about 6 minutes left", async () => {
    const s = createSpeechTokenService({ fetchFn: fakeFetch(), now, getConfig: goodConfig });
    await s.getToken();
    t += CACHE_MS - 1;
    assert.ok((await s.getToken()).expiresInSeconds >= 5 * 60 + 59 - 1);
  });

  test("simultaneous requests share one Azure call", async () => {
    let release;
    const gate = new Promise((r) => { release = r; });
    const f = fakeFetch(async () => { await gate; return okRes(TOKEN); });
    const s = createSpeechTokenService({ fetchFn: f, now, getConfig: goodConfig });
    const all = Promise.all([s.getToken(), s.getToken(), s.getToken(), s.getToken(), s.getToken()]);
    release();
    const results = await all;
    assert.equal(f.calls.length, 1);
    assert.ok(results.every((r) => r.token === TOKEN));
  });

  test("Azure refusing the key gives a clean error, caches nothing, and recovers on the next try", async () => {
    let fail = true;
    const f = fakeFetch(() => (fail ? badRes(401) : okRes(TOKEN)));
    const s = createSpeechTokenService({ fetchFn: f, now, getConfig: goodConfig });
    await assert.rejects(s.getToken(), (e) => e instanceof SpeechTokenError && e.code === "azure_rejected" && e.httpStatus === 502 && !e.message.includes(KEY));
    fail = false;
    assert.equal((await s.getToken()).token, TOKEN);
    assert.equal(f.calls.length, 2);
  });

  test("an empty answer and a network failure are both reported without leaking anything", async () => {
    const s1 = createSpeechTokenService({ fetchFn: fakeFetch(() => okRes("   ")), now, getConfig: goodConfig });
    await assert.rejects(s1.getToken(), (e) => e.code === "azure_rejected");
    const boom = Object.assign(new Error("connect ECONNRESET https://eastus.api.cognitive.microsoft.com " + KEY), { name: "FetchError" });
    const s2 = createSpeechTokenService({ fetchFn: fakeFetch(() => { throw boom; }), now, getConfig: goodConfig });
    await assert.rejects(s2.getToken(), (e) => e.code === "azure_unreachable" && e.httpStatus === 502 && !e.message.includes(KEY));
    assert.ok(printed.every((line) => !line.includes(KEY)), "the key must not be logged, even when the network error message contains it");
  });

  test("no key configured: refuses without calling Azure", async () => {
    const f = fakeFetch();
    const s = createSpeechTokenService({ fetchFn: f, now, getConfig: () => ({ ok: false, reason: "missing_key" }) });
    await assert.rejects(s.getToken(), (e) => e.code === "not_configured" && e.httpStatus === 503);
    assert.equal(f.calls.length, 0);
  });

  test("changing the region drops the cached token", async () => {
    let region = "eastus";
    const f = fakeFetch((url, o, n) => okRes("token-" + n));
    const s = createSpeechTokenService({ fetchFn: f, now, getConfig: () => ({ ok: true, key: KEY, region }) });
    await s.getToken();
    region = "westeurope";
    const out = await s.getToken();
    assert.equal(out.region, "westeurope");
    assert.match(f.calls[1].url, /^https:\/\/westeurope\.api\./);
  });

  test("per appointment cap: counted per person and per appointment, and it resets after 24 hours", () => {
    const s = createSpeechTokenService({ fetchFn: fakeFetch(), now, getConfig: goodConfig });
    assert.equal(s.allowForAppointment("A1", "patient", 2), true);
    assert.equal(s.allowForAppointment("A1", "patient", 2), true);
    assert.equal(s.allowForAppointment("A1", "patient", 2), false);
    assert.equal(s.allowForAppointment("A1", "doctor", 2), true, "the other participant has their own allowance");
    assert.equal(s.allowForAppointment("A2", "patient", 2), true, "another appointment has its own allowance");
    t += 24 * 60 * 60 * 1000 + 1;
    assert.equal(s.allowForAppointment("A1", "patient", 2), true);
  });
});

// ---- HTTP -------------------------------------------------------------------------------------------------------------
describe("GET /api/speech-token", () => {
  let mongod, patientId, doctorId, strangerId, enrollment;
  const servers = [];

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });
  after(async () => {
    await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    printed.length = 0;
    await Promise.all([Appointment.deleteMany({}), CategoryConsultation.deleteMany({}), Enrollment.deleteMany({})]);
    patientId = new mongoose.Types.ObjectId();
    doctorId = new mongoose.Types.ObjectId();
    strangerId = new mongoose.Types.ObjectId();
    enrollment = await Enrollment.create({ firstName: "Nobita", surname: "Mestry", doctorId, approvalStatus: "approved" });
  });

  const STATUS = { appointment: { confirmed: "confirmed", pending: "pending", completed: "completed", cancelled: "cancelled" }, category: { confirmed: "Confirmed", pending: "Pending", completed: "Completed", cancelled: "Cancelled" } };
  const make = (kind, status) =>
    kind === "appointment"
      ? Appointment.create({ patientId, doctorId, date: "2026-11-01", time: "10:00 AM", status: STATUS.appointment[status] })
      : CategoryConsultation.create({ concern: "x", severity: "mild", supportType: "chat", urgency: "flexible", date: "2026-11-01", slot: "10:00 AM", patientId, assignedDoctorId: enrollment._id, status: STATUS.category[status] });

  // Test-only sign-in: the real login middleware is covered by the production wiring test below.
  const fakeAuth = (req, res, next) => {
    const raw = req.get("x-test-user");
    if (!raw) return res.status(401).json({ msg: "No token provided. Please login." });
    req.user = JSON.parse(raw);
    next();
  };
  const passLimiter = (req, res, next) => next();

  async function start({ enabled = true, fetchFn = fakeFetch(), getConfig = goodConfig, max = () => 40, limiter = passLimiter } = {}) {
    const service = createSpeechTokenService({ fetchFn, getConfig });
    const app = express();
    app.use(cookieParser());
    app.use("/api/speech-token", createSpeechTokenRouter({ auth: fakeAuth, limiter, service, isEnabled: () => enabled, maxPerAppointment: max }));
    const server = await new Promise((resolve) => { const s = http.createServer(app).listen(0, "127.0.0.1", () => resolve(s)); });
    servers.push(server);
    const base = `http://127.0.0.1:${server.address().port}`;
    const get = async (query, user) => {
      const res = await fetch(`${base}/api/speech-token${query}`, { headers: user ? { "x-test-user": JSON.stringify(user) } : {} });
      let body = null; try { body = await res.json(); } catch { /* empty */ }
      return { status: res.status, body, headers: res.headers };
    };
    return { get, fetchFn };
  }
  const patient = () => ({ id: String(patientId), role: "user" });
  const doctor = () => ({ id: String(doctorId), role: "doctor" });

  for (const kind of ["appointment", "category"]) {
    describe(kind, () => {
      test("the booking's patient and doctor each get a token; it is not cached by anyone", async () => {
        const b = await make(kind, "confirmed");
        const { get } = await start();
        for (const user of [patient, doctor]) {
          const r = await get(`?appointmentId=${b._id}`, user());
          assert.equal(r.status, 200);
          assert.deepEqual(Object.keys(r.body).sort(), ["expiresInSeconds", "region", "token"]);
          assert.equal(r.body.token, TOKEN);
          assert.equal(r.body.region, "eastus");
          assert.ok(r.body.expiresInSeconds > 0 && r.body.expiresInSeconds <= 600);
          assert.equal(r.headers.get("cache-control"), "no-store");
        }
      });

      test("a stranger, an admin and a different patient are refused", async () => {
        const b = await make(kind, "confirmed");
        const { get, fetchFn } = await start();
        assert.equal((await get(`?appointmentId=${b._id}`, { id: String(strangerId), role: "user" })).status, 403);
        assert.equal((await get(`?appointmentId=${b._id}`, { id: String(strangerId), role: "doctor" })).status, 403);
        const admin = await get(`?appointmentId=${b._id}`, { id: String(strangerId), role: "admin" });
        assert.equal(admin.status, 403);
        assert.equal(admin.body.code, "not_participant");
        assert.equal(fetchFn.calls.length, 0, "Azure is never contacted for someone who may not have a token");
      });

      test("not confirmed yet, or already finished: no token", async () => {
        const { get, fetchFn } = await start();
        const pending = await make(kind, "pending");
        const p = await get(`?appointmentId=${pending._id}`, patient());
        assert.equal(p.status, 403); assert.equal(p.body.code, "not_confirmed");
        for (const s of ["completed", "cancelled"]) {
          const done = await make(kind, s);
          const r = await get(`?appointmentId=${done._id}`, doctor());
          assert.equal(r.status, 403); assert.equal(r.body.code, "appointment_ended");
        }
        assert.equal(fetchFn.calls.length, 0);
      });
    });
  }

  test("feature flag off: 404 for a valid participant, and Azure is never contacted", async () => {
    const b = await make("appointment", "confirmed");
    const { get, fetchFn } = await start({ enabled: false });
    const r = await get(`?appointmentId=${b._id}`, patient());
    assert.equal(r.status, 404);
    assert.equal(fetchFn.calls.length, 0);
  });

  test("not signed in: 401. Bad or missing or unknown appointment id: 400 / 404", async () => {
    const b = await make("appointment", "confirmed");
    const { get } = await start();
    assert.equal((await get(`?appointmentId=${b._id}`)).status, 401);
    assert.equal((await get("", patient())).status, 400);
    assert.equal((await get("?appointmentId=not-an-id", patient())).status, 400);
    assert.equal((await get("?appointmentId[]=x", patient())).status, 400);
    const unknown = await get(`?appointmentId=${new mongoose.Types.ObjectId()}`, patient());
    assert.equal(unknown.status, 404);
  });

  test("the per-appointment cap stops a call that keeps asking, per person", async () => {
    const b = await make("appointment", "confirmed");
    const { get } = await start({ max: () => 2 });
    assert.equal((await get(`?appointmentId=${b._id}`, patient())).status, 200);
    assert.equal((await get(`?appointmentId=${b._id}`, patient())).status, 200);
    const third = await get(`?appointmentId=${b._id}`, patient());
    assert.equal(third.status, 429);
    assert.equal(third.body.code, "appointment_cap");
    assert.equal((await get(`?appointmentId=${b._id}`, doctor())).status, 200, "the doctor still has their own allowance");
  });

  test("Azure refusing or unreachable gives 502, no key configured gives 503, and none of it leaks the key", async () => {
    const b = await make("appointment", "confirmed");
    const down = await start({ fetchFn: fakeFetch(() => badRes(500)) });
    const r1 = await down.get(`?appointmentId=${b._id}`, patient());
    assert.equal(r1.status, 502);
    const unconfigured = await start({ getConfig: () => ({ ok: false, reason: "missing_key" }) });
    const r2 = await unconfigured.get(`?appointmentId=${b._id}`, patient());
    assert.equal(r2.status, 503);
    assert.equal(r2.body.code, "not_configured");
    assert.ok(!JSON.stringify([r1.body, r2.body]).includes(KEY));
  });

  test("the real rate limiter returns 429 after 20 requests from one person within 10 minutes", async () => {
    const b = await make("appointment", "confirmed");
    const { get } = await start({ limiter: speechTokenLimiter });
    const user = { id: String(new mongoose.Types.ObjectId()), role: "user" }; // a fresh person: the limiter keeps state per user
    let last;
    for (let i = 0; i < 20; i++) { last = await get(`?appointmentId=${b._id}`, user); assert.notEqual(last.status, 429, "request " + (i + 1)); }
    last = await get(`?appointmentId=${b._id}`, user);
    assert.equal(last.status, 429);
    assert.ok(Number(last.headers.get("retry-after")) > 0);
  });

  test("the app's real wiring: off by default (404), and when on it needs the real login (401 without a session)", async () => {
    const app = express();
    app.use(cookieParser());
    app.use("/api/speech-token", productionRouter);
    const server = await new Promise((resolve) => { const s = http.createServer(app).listen(0, "127.0.0.1", () => resolve(s)); });
    servers.push(server);
    const url = `http://127.0.0.1:${server.address().port}/api/speech-token?appointmentId=${new mongoose.Types.ObjectId()}`;
    const saved = process.env.TRANSCRIPTION_ENABLED;
    try {
      delete process.env.TRANSCRIPTION_ENABLED;
      assert.equal((await fetch(url)).status, 404);
      process.env.TRANSCRIPTION_ENABLED = "false";
      assert.equal((await fetch(url)).status, 404);
      process.env.TRANSCRIPTION_ENABLED = "true";
      assert.equal((await fetch(url)).status, 401);
    } finally {
      if (saved === undefined) delete process.env.TRANSCRIPTION_ENABLED; else process.env.TRANSCRIPTION_ENABLED = saved;
    }
  });

  test("across every request above, the key and the token were never written to a log", async () => {
    const b = await make("appointment", "confirmed");
    printed.length = 0;
    const down = await start({ fetchFn: fakeFetch(() => badRes(401)) });
    await down.get(`?appointmentId=${b._id}`, patient());
    const ok = await start();
    await ok.get(`?appointmentId=${b._id}`, patient());
    await ok.get(`?appointmentId=${b._id}`, { id: String(strangerId), role: "user" });
    for (const line of printed) {
      assert.ok(!line.includes(KEY), "key found in a log line");
      assert.ok(!line.includes(TOKEN), "token found in a log line");
    }
  });
});
