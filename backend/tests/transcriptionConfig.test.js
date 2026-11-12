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
const TranscriptSegment = require("../models/TranscriptSegment");
const config = require("../utils/speech/config");
const { recordNoticeShown } = require("../utils/speech/transcriptNotice");
const { createTranscriptionConfigRouter } = require("../routes/transcriptionConfig");
const productionConfigRouter = require("../routes/transcriptionConfig");
const productionTranscript = require("../routes/appointmentTranscript");
const productionToken = require("../routes/speechToken");
const { createAppointmentTranscriptRouter } = productionTranscript;
const { transcriptionConfigLimiter } = require("../middleware/rateLimiters");

const T0 = new Date("2026-11-12T10:00:00.000Z");
const KEY = "test-azure-key-0123456789abcdef";

// ---- the setting itself -------------------------------------------------------------------------------------------------
describe("TRANSCRIPT_MODE", () => {
  test("notice is the default; consent only when asked for exactly; anything else is treated as notice (it never claims consent that is not there)", () => {
    const mode = (v) => config.getTranscriptMode(v === undefined ? {} : { TRANSCRIPT_MODE: v });
    assert.equal(mode(undefined), "notice");
    assert.equal(mode(""), "notice");
    assert.equal(mode("   "), "notice");
    assert.equal(mode("notice"), "notice");
    assert.equal(mode(" NOTICE "), "notice");
    assert.equal(mode("consent"), "consent");
    assert.equal(mode(" Consent "), "consent");
    assert.deepEqual(config.TRANSCRIPT_MODES, ["notice", "consent"]);
    const warnings = [];
    const real = console.warn;
    console.warn = (...a) => warnings.push(a.join(" "));
    try {
      assert.equal(mode("concent"), "notice");
      assert.equal(mode("yes"), "notice");
      assert.equal(mode("<script>"), "notice");
    } finally {
      console.warn = real;
    }
    assert.ok(warnings.length <= 1, "the warning is printed at most once, not on every call");
  });
});

// ---- the endpoint -------------------------------------------------------------------------------------------------------
describe("GET /api/transcription/config", () => {
  const servers = [];
  after(async () => { await Promise.all(servers.map((s) => new Promise((r) => s.close(r)))); });

  const fakeAuth = (req, res, next) => {
    const raw = req.get("x-test-user");
    if (!raw) return res.status(401).json({ msg: "No token provided. Please login." });
    req.user = JSON.parse(raw);
    next();
  };
  async function start({ enabled = false, mode = "notice", limiter = (req, res, next) => next() } = {}) {
    const app = express();
    app.use("/api/transcription/config", createTranscriptionConfigRouter({ auth: fakeAuth, limiter, isEnabled: () => enabled, getMode: () => mode }));
    const server = await new Promise((resolve) => { const s = http.createServer(app).listen(0, "127.0.0.1", () => resolve(s)); });
    servers.push(server);
    const url = `http://127.0.0.1:${server.address().port}/api/transcription/config`;
    return async (user) => {
      const res = await fetch(url, { headers: user ? { "x-test-user": JSON.stringify(user) } : {} });
      let body = null; try { body = await res.json(); } catch { /* empty */ }
      return { status: res.status, body, headers: res.headers };
    };
  }
  const someone = (role = "user") => ({ id: String(new mongoose.Types.ObjectId()), role });

  test("flag off (the default): 200 with enabled:false, so asking is always safe", async () => {
    const get = await start({ enabled: false });
    const r = await get(someone());
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { enabled: false, mode: "notice", noticeVersion: "v1" });
    assert.equal(r.headers.get("cache-control"), "no-store");
  });

  test("flag on, and the mode: shown exactly", async () => {
    const on = await start({ enabled: true });
    assert.deepEqual((await on(someone())).body, { enabled: true, mode: "notice", noticeVersion: "v1" });
    const consent = await start({ enabled: true, mode: "consent" });
    assert.deepEqual((await consent(someone("doctor"))).body, { enabled: true, mode: "consent", noticeVersion: "v1" });
  });

  test("every signed-in role may ask; nobody else", async () => {
    const get = await start({ enabled: true });
    for (const role of ["user", "doctor", "admin", "superadmin", "partner", "employeeadmin", "paymentadmin"]) assert.equal((await get(someone(role))).status, 200, role);
    assert.equal((await get()).status, 401);
  });

  test("the answer has exactly three fields and never carries the Azure key, a token or any other setting", async () => {
    const saved = { k: process.env.AZURE_SPEECH_KEY, m: process.env.SPEECH_TOKEN_MAX_PER_APPOINTMENT };
    process.env.AZURE_SPEECH_KEY = KEY;
    process.env.SPEECH_TOKEN_MAX_PER_APPOINTMENT = "7";
    try {
      const r = await (await start({ enabled: true }))(someone());
      assert.deepEqual(Object.keys(r.body).sort(), ["enabled", "mode", "noticeVersion"]);
      assert.equal(JSON.stringify(r.body).includes(KEY), false);
    } finally {
      for (const [name, v] of [["AZURE_SPEECH_KEY", saved.k], ["SPEECH_TOKEN_MAX_PER_APPOINTMENT", saved.m]]) if (v === undefined) delete process.env[name]; else process.env[name] = v;
    }
  });

  test("the real rate limiter refuses the 61st request in 10 minutes (429)", async () => {
    const get = await start({ enabled: true, limiter: transcriptionConfigLimiter });
    const user = someone();
    let last;
    for (let i = 0; i < 60; i++) { last = await get(user); assert.equal(last.status, 200, "request " + (i + 1)); }
    last = await get(user);
    assert.equal(last.status, 429);
    assert.ok(Number(last.headers.get("retry-after")) > 0);
  });

  test("the app's real wiring needs the real login (401 without a session), and is mounted in server.js", async () => {
    const app = express();
    app.use(cookieParser());
    app.use("/api/transcription/config", productionConfigRouter);
    const server = await new Promise((resolve) => { const s = http.createServer(app).listen(0, "127.0.0.1", () => resolve(s)); });
    servers.push(server);
    assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/api/transcription/config`)).status, 401);
    const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "server.js"), "utf8");
    assert.ok(src.includes('app.use("/api/transcription/config", require("./routes/transcriptionConfig"));'));
  });
});

// ---- flag off = today's behaviour ---------------------------------------------------------------------------------------
describe("with the flag off, the live feature is invisible", () => {
  test("every route that creates something answers 404, exactly like a route that does not exist", async () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use("/api/speech-token", productionToken);
    app.use("/api/appointments/:id", productionTranscript);
    const server = await new Promise((resolve) => { const s = http.createServer(app).listen(0, "127.0.0.1", () => resolve(s)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const id = new mongoose.Types.ObjectId();
    const saved = process.env.TRANSCRIPTION_ENABLED;
    try {
      for (const flag of [undefined, "", "false", "0", "no"]) {
        if (flag === undefined) delete process.env.TRANSCRIPTION_ENABLED; else process.env.TRANSCRIPTION_ENABLED = flag;
        const results = await Promise.all([
          fetch(`${base}/api/speech-token?appointmentId=${id}`),
          fetch(`${base}/api/appointments/${id}/transcript-notice`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }),
          fetch(`${base}/api/appointments/${id}/transcript`, { method: "POST", headers: { "content-type": "application/json" }, body: '{"items":[]}' }),
        ]);
        assert.deepEqual(results.map((r) => r.status), [404, 404, 404], `flag=${flag}`);
        const bodies = await Promise.all(results.map((r) => r.text()));
        assert.ok(bodies.every((b) => !/token|azure|speech/i.test(b.replace("Not found.", ""))), "nothing about the feature leaks");
      }
    } finally {
      if (saved === undefined) delete process.env.TRANSCRIPTION_ENABLED; else process.env.TRANSCRIPTION_ENABLED = saved;
      await new Promise((r) => server.close(r));
    }
  });

  test("the default really is off: nothing in the repo's env example turns it on", () => {
    const text = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", ".env.example"), "utf8");
    assert.match(text, /^TRANSCRIPTION_ENABLED=false\s*$/m);
    assert.match(text, /^TRANSCRIPT_MODE=notice\s*$/m);
    assert.equal(/^TRANSCRIPTION_ENABLED=true/m.test(text), false);
  });
});

// ---- the mode is recorded with the data ---------------------------------------------------------------------------------
describe("the mode in force is stored with the notice and with every saved row", () => {
  let mongod, patientId, doctorId, enrollment;
  const servers = [];
  before(async () => { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()); await TranscriptSegment.init(); });
  after(async () => {
    await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await Promise.all([Appointment.deleteMany({}), CategoryConsultation.deleteMany({}), Enrollment.deleteMany({}), TranscriptSegment.deleteMany({})]);
    patientId = new mongoose.Types.ObjectId();
    doctorId = new mongoose.Types.ObjectId();
    enrollment = await Enrollment.create({ firstName: "N", surname: "M", doctorId, approvalStatus: "approved" });
  });

  const fakeAuth = (req, res, next) => { req.user = JSON.parse(req.get("x-test-user")); next(); };
  const pass = (req, res, next) => next();
  const make = (kind) => kind === "appointment"
    ? Appointment.create({ patientId, doctorId, date: "2026-11-01", time: "10:00 AM", status: "confirmed" })
    : CategoryConsultation.create({ concern: "x", severity: "mild", supportType: "chat", urgency: "flexible", date: "2026-11-01", slot: "10:00 AM", patientId, assignedDoctorId: enrollment._id, status: "Confirmed" });
  const KIND = { appointment: "appointment", category: "category_consultation" };
  const stored = (kind, id) => (kind === "appointment" ? Appointment : CategoryConsultation).findById(id).select("+transcriptNotice").lean();

  async function start(mode) {
    const app = express();
    app.use(express.json());
    app.use("/api/appointments/:id", createAppointmentTranscriptRouter({ auth: fakeAuth, noticeLimiter: pass, writeLimiter: pass, readLimiter: pass, isEnabled: () => true, mode: () => mode, now: () => T0 }));
    const server = await new Promise((resolve) => { const s = http.createServer(app).listen(0, "127.0.0.1", () => resolve(s)); });
    servers.push(server);
    const base = `http://127.0.0.1:${server.address().port}/api/appointments`;
    const call = async (method, path, user, body) => {
      const res = await fetch(`${base}${path}`, { method, headers: { "content-type": "application/json", "x-test-user": JSON.stringify(user) }, body: body === undefined ? undefined : JSON.stringify(body) });
      return { status: res.status, body: await res.json() };
    };
    return call;
  }
  const patient = () => ({ id: String(patientId), role: "user" });
  const doctor = () => ({ id: String(doctorId), role: "doctor" });
  const line = { type: "line", clientId: "line-00001", original: "hello there", translations: { en: "hello there" }, sourceLang: "en-US", confidence: 0.9 };

  for (const kind of ["appointment", "category"]) {
    test(`notice mode (${kind}): mode "notice" is stored, and a consent choice sent by the browser is ignored`, async () => {
      const b = await make(kind);
      const call = await start("notice");
      const r = await call("POST", `/${b._id}/transcript-notice`, patient(), { consent: "accepted" });
      assert.deepEqual([r.body.mode, r.body.consent], ["notice", ""]);
      const entry = (await stored(kind, b._id)).transcriptNotice.patient;
      assert.deepEqual([entry.mode, entry.consent], ["notice", ""]);
    });

    test(`consent mode (${kind}): the mode and the person's real choice are stored; junk choices become empty`, async () => {
      const call = await start("consent");
      for (const [sent, expected] of [["accepted", "accepted"], ["declined", "declined"], ["ACCEPTED", ""], ["yes", ""], [true, ""], [{ a: 1 }, ""], [undefined, ""], [null, ""]]) {
        const b = await make(kind);
        const r = await call("POST", `/${b._id}/transcript-notice`, patient(), sent === undefined ? {} : { consent: sent });
        assert.equal(r.status, 200, String(JSON.stringify(sent)));
        assert.deepEqual([r.body.mode, r.body.consent], ["consent", expected], String(JSON.stringify(sent)));
        const entry = (await stored(kind, b._id)).transcriptNotice.patient;
        assert.deepEqual([entry.mode, entry.consent], ["consent", expected], String(JSON.stringify(sent)));
      }
    });

    test(`every saved row (${kind}) carries the mode it was saved under, and the transcript view shows it; nothing is blocked in either mode`, async () => {
      const b = await make(kind);
      const notice = await start("notice");
      const consent = await start("consent");
      assert.equal((await notice("POST", `/${b._id}/transcript`, patient(), { items: [line] })).body.accepted, 1);
      assert.equal((await consent("POST", `/${b._id}/transcript`, patient(), { items: [{ ...line, clientId: "line-00002" }] })).body.accepted, 1, "consent mode blocks nothing yet");
      const rows = await TranscriptSegment.find({ appointmentId: b._id }).sort({ clientId: 1 }).lean();
      assert.deepEqual(rows.map((r) => r.captureMode), ["notice", "consent"]);
      const view = await notice("GET", `/${b._id}/transcript`, doctor());
      assert.deepEqual(view.body.segments.map((s) => s.captureMode), ["notice", "consent"]);
    });
  }

  test("the transcript view shows the mode and consent recorded with each notice", async () => {
    const b = await make("appointment");
    await recordNoticeShown({ kind: KIND.appointment, appointmentId: b._id, userId: patientId, role: "user", mode: "consent", consent: "declined", now: T0 });
    const call = await start("consent");
    const { notice } = (await call("GET", `/${b._id}/transcript`, doctor())).body;
    assert.deepEqual([notice.patient.mode, notice.patient.consent], ["consent", "declined"]);
    assert.equal(notice.doctor, null);
  });
});
