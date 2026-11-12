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
const notice = require("../utils/speech/transcriptNotice");
const productionRouter = require("../routes/appointmentTranscript");
const { createAppointmentTranscriptRouter } = productionRouter;
const { transcriptNoticeLimiter } = require("../middleware/rateLimiters");

const { TRANSCRIPT_NOTICE_VERSION, resolveNoticeVersion, sanitizeRawVersion, noticeRoleKey, bothNoticesShown, recordNoticeShown, transcriptNoticeFields } = notice;
const T0 = new Date("2026-11-12T10:00:00.000Z");
const T1 = new Date("2026-11-12T10:00:07.000Z");

// ---- pure helpers -------------------------------------------------------------------------------------------------------
describe("transcript notice helpers", () => {
  test("the notice wording version is NEVER refused: known = as is, missing = v1, anything else = kept, cleaned and flagged", () => {
    const ok = (version) => ({ version, versionUnrecognized: false });
    for (const absent of [undefined, null, "", "   "]) assert.deepEqual(resolveNoticeVersion(absent), ok("v1"), JSON.stringify(absent));
    assert.deepEqual(resolveNoticeVersion("v1"), ok("v1"));
    assert.deepEqual(resolveNoticeVersion("  v1  "), ok("v1"), "trimmed before comparing");

    // unknown but well formed
    assert.deepEqual(resolveNoticeVersion("v2"), { version: "v2", versionUnrecognized: true });
    assert.deepEqual(resolveNoticeVersion("V1"), { version: "V1", versionUnrecognized: true });
    assert.deepEqual(resolveNoticeVersion(5), { version: "5", versionUnrecognized: true });
    assert.deepEqual(resolveNoticeVersion(true), { version: "true", versionUnrecognized: true });

    // malformed: still saved, safely
    const html = resolveNoticeVersion('<img src=x onerror="alert(1)">v9');
    assert.equal(html.versionUnrecognized, true);
    assert.match(html.version, /^[^<>&"'`]+$/, "no HTML characters survive");
    assert.deepEqual(resolveNoticeVersion({ a: 1 }), { version: "(non-text value)", versionUnrecognized: true });
    assert.deepEqual(resolveNoticeVersion(["v1"]), { version: "(non-text value)", versionUnrecognized: true });
    assert.deepEqual(resolveNoticeVersion('<>&"'), { version: "(empty)", versionUnrecognized: true });
    assert.deepEqual(resolveNoticeVersion("a\u0000b\nc\td"), { version: "a b c d", versionUnrecognized: true }, "control characters become spaces");
    const long = resolveNoticeVersion("x".repeat(500));
    assert.equal(long.version.length, 50);
    assert.equal(long.versionUnrecognized, true);
  });

  test("sanitizeRawVersion never throws, whatever it is given", () => {
    for (const v of [undefined, null, NaN, Symbol("s"), () => 1, new Date(), Object.create(null), 10n, "\uD800", "ok"]) {
      assert.equal(typeof sanitizeRawVersion(v), "string");
      assert.ok(sanitizeRawVersion(v).length <= 50);
    }
  });

  test("only a patient (user) and a doctor have a notice slot", () => {
    assert.equal(noticeRoleKey("user"), "patient");
    assert.equal(noticeRoleKey("doctor"), "doctor");
    for (const r of ["admin", "superadmin", "partner", "employeeadmin", undefined, "patient"]) assert.equal(noticeRoleKey(r), null, String(r));
  });

  test("bothNoticesShown needs a time for the patient AND the doctor", () => {
    const e = { userId: new mongoose.Types.ObjectId(), shownAt: T0 };
    assert.equal(bothNoticesShown(null), false);
    assert.equal(bothNoticesShown({}), false);
    assert.equal(bothNoticesShown({ transcriptNotice: { patient: e } }), false);
    assert.equal(bothNoticesShown({ transcriptNotice: { doctor: e } }), false);
    assert.equal(bothNoticesShown({ transcriptNotice: { patient: e, doctor: {} } }), false);
    assert.equal(bothNoticesShown({ transcriptNotice: { patient: e, doctor: e } }), true);
  });

  test("the schema fragment is hidden by default and has no default value", () => {
    const f = transcriptNoticeFields().transcriptNotice;
    assert.equal(f.select, false);
    assert.equal(f.default, undefined);
  });
});

describe("server.js wiring", () => {
  test("the transcript router is mounted at /api/appointments/:id, before the general appointments router", () => {
    const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "server.js"), "utf8");
    const transcript = src.indexOf('app.use("/api/appointments/:id", require("./routes/appointmentTranscript"));');
    const general = src.indexOf('app.use("/api/appointments", require("./routes/appointments"));');
    assert.ok(transcript > 0, "transcript router is not mounted");
    assert.ok(general > 0, "general appointments router mount not found");
    assert.ok(transcript < general, "the transcript router must come first");
  });
});

// ---- database + route ---------------------------------------------------------------------------------------------------
describe("transcript notice record", () => {
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
    await Promise.all([Appointment.deleteMany({}), CategoryConsultation.deleteMany({}), Enrollment.deleteMany({})]);
    patientId = new mongoose.Types.ObjectId();
    doctorId = new mongoose.Types.ObjectId();
    strangerId = new mongoose.Types.ObjectId();
    enrollment = await Enrollment.create({ firstName: "Nobita", surname: "Mestry", doctorId, approvalStatus: "approved" });
  });

  const STATUS = { appointment: { confirmed: "confirmed", pending: "pending", completed: "completed", cancelled: "cancelled" }, category: { confirmed: "Confirmed", pending: "Pending", completed: "Completed", cancelled: "Cancelled" } };
  const make = (kind, status = "confirmed") =>
    kind === "appointment"
      ? Appointment.create({ patientId, doctorId, date: "2026-11-01", time: "10:00 AM", status: STATUS.appointment[status] })
      : CategoryConsultation.create({ concern: "x", severity: "mild", supportType: "chat", urgency: "flexible", date: "2026-11-01", slot: "10:00 AM", patientId, assignedDoctorId: enrollment._id, status: STATUS.category[status] });
  const Model = (kind) => (kind === "appointment" ? Appointment : CategoryConsultation);
  const KIND = { appointment: "appointment", category: "category_consultation" };
  const stored = (kind, id) => Model(kind).findById(id).select("+transcriptNotice").lean();

  for (const kind of ["appointment", "category"]) {
    describe(kind, () => {
      test("the record is stored per person: user id, server time, wording version, device", async () => {
        const b = await make(kind);
        const p = await recordNoticeShown({ kind: KIND[kind], appointmentId: b._id, userId: patientId, role: "user", version: "v1", userAgent: "UA-patient", ip: "203.0.113.7", now: T0 });
        assert.equal(p.recorded, true);
        assert.equal(p.bothShown, false);
        const d = await recordNoticeShown({ kind: KIND[kind], appointmentId: b._id, userId: doctorId, role: "doctor", userAgent: "UA-doctor", ip: "198.51.100.9", now: T1 });
        assert.equal(d.recorded, true);
        assert.equal(d.bothShown, true);

        const doc = await stored(kind, b._id);
        assert.deepEqual(Object.keys(doc.transcriptNotice).sort(), ["doctor", "patient"]);
        assert.equal(String(doc.transcriptNotice.patient.userId), String(patientId));
        assert.equal(doc.transcriptNotice.patient.shownAt.getTime(), T0.getTime());
        assert.equal(doc.transcriptNotice.patient.version, "v1");
        assert.equal(doc.transcriptNotice.patient.userAgent, "UA-patient");
        assert.equal(doc.transcriptNotice.patient.ip, "203.0.113.7");
        assert.equal(doc.transcriptNotice.patient.versionUnrecognized, false);
        assert.equal(String(doc.transcriptNotice.doctor.userId), String(doctorId));
        assert.equal(doc.transcriptNotice.doctor.shownAt.getTime(), T1.getTime());
        assert.equal(doc.transcriptNotice.doctor.version, TRANSCRIPT_NOTICE_VERSION);
        assert.equal(doc.transcriptNotice.doctor.ip, "198.51.100.9");
        assert.equal(bothNoticesShown(doc), true);
      });

      test("first write wins: showing the notice again never moves the original time", async () => {
        const b = await make(kind);
        const first = await recordNoticeShown({ kind: KIND[kind], appointmentId: b._id, userId: patientId, role: "user", now: T0 });
        const again = await recordNoticeShown({ kind: KIND[kind], appointmentId: b._id, userId: patientId, role: "user", version: "v9", userAgent: "other", now: T1 });
        assert.equal(first.recorded, true);
        assert.equal(again.recorded, false);
        assert.equal(again.entry.shownAt.getTime(), T0.getTime());
        assert.equal(again.entry.version, TRANSCRIPT_NOTICE_VERSION);
        assert.equal(again.bothShown, false);
      });

      test("many simultaneous posts by one person: exactly one wins", async () => {
        const b = await make(kind);
        const results = await Promise.all(
          Array.from({ length: 8 }, (_, i) => recordNoticeShown({ kind: KIND[kind], appointmentId: b._id, userId: patientId, role: "user", now: new Date(T0.getTime() + i) }))
        );
        assert.equal(results.filter((r) => r.recorded).length, 1);
        const doc = await stored(kind, b._id);
        assert.equal(doc.transcriptNotice.patient.shownAt.getTime() >= T0.getTime(), true);
        assert.equal(doc.transcriptNotice.doctor, undefined);
      });

      test("the record never shows up in the ways bookings are read today, and recording it does not touch updatedAt", async () => {
        const b = await make(kind);
        const before = (await Model(kind).findById(b._id).lean()).updatedAt.getTime();
        await recordNoticeShown({ kind: KIND[kind], appointmentId: b._id, userId: patientId, role: "user", userAgent: "secret-UA", ip: "203.0.113.77", now: T0 });
        const M = Model(kind);
        assert.equal((await M.findById(b._id)).transcriptNotice, undefined);
        assert.equal((await M.findById(b._id).lean()).transcriptNotice, undefined);
        assert.equal((await M.find({}).lean())[0].transcriptNotice, undefined);
        for (const text of [JSON.stringify(await M.findById(b._id)), JSON.stringify(await M.find({ patientId }).lean())]) {
          assert.equal(text.includes("secret-UA"), false);
          assert.equal(text.includes("203.0.113.77"), false, "the IP must not leak through the normal reads either");
        }
        assert.equal((await M.findById(b._id).lean()).updatedAt.getTime(), before);
        assert.ok((await stored(kind, b._id)).transcriptNotice.patient, "but it is there when asked for");
      });

      test("a booking that never had a notice has no such field at all (no migration needed)", async () => {
        const b = await make(kind);
        const raw = await Model(kind).collection.findOne({ _id: b._id });
        assert.equal("transcriptNotice" in raw, false);
      });
    });
  }

  test("the device string is cut to 300 characters and the IP to 64; a role without a slot is refused", async () => {
    const b = await make("appointment");
    await recordNoticeShown({ kind: "appointment", appointmentId: b._id, userId: patientId, role: "user", userAgent: "x".repeat(1000), ip: "9".repeat(200), now: T0 });
    const entry = (await stored("appointment", b._id)).transcriptNotice.patient;
    assert.equal(entry.userAgent.length, 300);
    assert.equal(entry.ip.length, 64);
    await assert.rejects(recordNoticeShown({ kind: "appointment", appointmentId: b._id, userId: strangerId, role: "admin" }), /role must be user or doctor/);
  });

  // ---- HTTP ----
  // Test-only sign-in: the real login middleware is covered by the production wiring test below.
  const fakeAuth = (req, res, next) => {
    const raw = req.get("x-test-user");
    if (!raw) return res.status(401).json({ msg: "No token provided. Please login." });
    req.user = JSON.parse(raw);
    next();
  };
  const passLimiter = (req, res, next) => next();
  const patient = () => ({ id: String(patientId), role: "user" });
  const doctor = () => ({ id: String(doctorId), role: "doctor" });

  async function start({ enabled = true, limiter = passLimiter, now = () => T0, trustProxy } = {}) {
    const app = express();
    if (trustProxy !== undefined) app.set("trust proxy", trustProxy);
    app.use(express.json());
    app.use(cookieParser());
    app.use("/api/appointments/:id", createAppointmentTranscriptRouter({ auth: fakeAuth, noticeLimiter: limiter, isEnabled: () => enabled, now }));
    // a neighbouring route, to prove the new router lets other /api/appointments/:id/... requests through
    app.put("/api/appointments/:id/confirm", (req, res) => res.json({ ok: "confirm-reached", id: req.params.id }));
    app.get("/api/appointments/:id", (req, res) => res.json({ ok: "get-reached" }));
    const server = await new Promise((resolve) => { const s = http.createServer(app).listen(0, "127.0.0.1", () => resolve(s)); });
    servers.push(server);
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = async (method, path, { user, body, ua, headers } = {}) => {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: { "content-type": "application/json", ...(user ? { "x-test-user": JSON.stringify(user) } : {}), ...(ua ? { "user-agent": ua } : {}), ...(headers || {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      let json = null; try { json = await res.json(); } catch { /* empty */ }
      return { status: res.status, body: json, headers: res.headers };
    };
    return { post: (id, opts) => call("POST", `/api/appointments/${id}/transcript-notice`, opts), call };
  }

  for (const kind of ["appointment", "category"]) {
    describe(`POST transcript-notice (${kind})`, () => {
      test("patient then doctor: each is recorded with the server's time, and bothShown flips on the second", async () => {
        const b = await make(kind);
        const { post } = await start();
        const p = await post(b._id, { user: patient(), ua: "Mozilla/5.0 (iPhone)" });
        assert.equal(p.status, 200);
        assert.deepEqual(p.body, { recorded: true, role: "patient", shownAt: T0.toISOString(), version: "v1", versionUnrecognized: false, bothShown: false });
        assert.equal(p.headers.get("cache-control"), "no-store");
        const d = await post(b._id, { user: doctor() });
        assert.deepEqual(d.body, { recorded: true, role: "doctor", shownAt: T0.toISOString(), version: "v1", versionUnrecognized: false, bothShown: true });
        const doc = await stored(kind, b._id);
        assert.equal(doc.transcriptNotice.patient.userAgent, "Mozilla/5.0 (iPhone)");
        assert.equal(String(doc.transcriptNotice.doctor.userId), String(doctorId));
      });

      test("repeating the call is safe: recorded false, original time kept, and no counterpart details in the answer", async () => {
        const b = await make(kind);
        let clock = T0;
        const { post } = await start({ now: () => clock });
        await post(b._id, { user: patient() });
        clock = T1;
        const again = await post(b._id, { user: patient() });
        assert.equal(again.status, 200);
        assert.equal(again.body.recorded, false);
        assert.equal(again.body.shownAt, T0.toISOString());
        assert.deepEqual(Object.keys(again.body).sort(), ["bothShown", "recorded", "role", "shownAt", "version", "versionUnrecognized"]);
        assert.equal(JSON.stringify(again.body).includes("127.0.0.1"), false, "the IP is never sent back");
      });

      test("the browser cannot choose who it is, what role, what time or what IP: only the wording version is read from the body", async () => {
        const b = await make(kind);
        const { post } = await start({ now: () => T1 });
        const r = await post(b._id, { user: patient(), body: { userId: String(strangerId), role: "doctor", shownAt: "2000-01-01T00:00:00Z", ip: "6.6.6.6", ipAddress: "6.6.6.6", userAgent: "forged", version: "v2", bothShown: true } });
        assert.equal(r.status, 200);
        assert.equal(r.body.role, "patient");
        assert.equal(r.body.shownAt, T1.toISOString());
        assert.equal(r.body.version, "v2");
        const doc = await stored(kind, b._id);
        assert.equal(String(doc.transcriptNotice.patient.userId), String(patientId));
        assert.equal(doc.transcriptNotice.patient.ip, "127.0.0.1", "the IP comes from the connection, not the body");
        assert.notEqual(doc.transcriptNotice.patient.userAgent, "forged");
        assert.equal(doc.transcriptNotice.doctor, undefined);
      });

      test("the notice is ALWAYS saved, whatever version arrives (known, missing, unknown, malformed), and unknown ones are flagged", async () => {
        const cases = [
          [{ version: "v1" }, "v1", false],
          [{}, "v1", false],
          [undefined, "v1", false],
          [{ version: null }, "v1", false],
          [{ version: "" }, "v1", false],
          [{ version: " v1 " }, "v1", false],
          [{ version: "v7" }, "v7", true],
          [{ version: "V1" }, "V1", true],
          [{ version: 3 }, "3", true],
          [{ version: { nested: true } }, "(non-text value)", true],
          [{ version: ["v1"] }, "(non-text value)", true],
          [{ version: "<script>alert('x')</script>" }, "scriptalert(x)/script", true],
          [{ version: "x".repeat(400) }, "x".repeat(50), true],
          [{ version: "\u0000\u0001" }, "(empty)", true],
        ];
        for (const [body, expectedVersion, expectedFlag] of cases) {
          const b = await make(kind);
          const { post } = await start();
          const r = await post(b._id, { user: patient(), body });
          const label = JSON.stringify(body);
          assert.equal(r.status, 200, label);
          assert.equal(r.body.recorded, true, label);
          assert.equal(r.body.version, expectedVersion, label);
          assert.equal(r.body.versionUnrecognized, expectedFlag, label);
          const entry = (await stored(kind, b._id)).transcriptNotice.patient;
          assert.equal(entry.version, expectedVersion, label);
          assert.equal(entry.versionUnrecognized, expectedFlag, label);
          assert.ok(entry.shownAt, "a time is always on file: " + label);
          assert.equal(/[<>&"'`]/.test(entry.version), false, "no HTML characters stored: " + label);
          assert.ok(entry.version.length <= 50, label);
        }
      });

      test("a real browser's version first, a wrong one later: the first record stays (first write wins), flag included", async () => {
        const b = await make(kind);
        const { post } = await start();
        await post(b._id, { user: patient(), body: { version: "v1" } });
        const again = await post(b._id, { user: patient(), body: { version: "totally-new" } });
        assert.equal(again.body.recorded, false);
        assert.equal(again.body.version, "v1");
        assert.equal(again.body.versionUnrecognized, false);
      });

      test("strangers, admins and wrong-role callers are refused and nothing is written", async () => {
        const b = await make(kind);
        const { post } = await start();
        for (const user of [{ id: String(strangerId), role: "user" }, { id: String(strangerId), role: "doctor" }, { id: String(strangerId), role: "admin" }, { id: String(patientId), role: "superadmin" }]) {
          const r = await post(b._id, { user });
          assert.equal(r.status, 403, JSON.stringify(user));
          assert.equal(r.body.code, "not_participant");
        }
        assert.equal((await stored(kind, b._id)).transcriptNotice, undefined);
      });

      test("not confirmed yet, or already finished: refused and nothing is written", async () => {
        const { post } = await start();
        const pending = await make(kind, "pending");
        const p = await post(pending._id, { user: patient() });
        assert.equal(p.status, 403); assert.equal(p.body.code, "not_confirmed");
        for (const s of ["completed", "cancelled"]) {
          const done = await make(kind, s);
          const r = await post(done._id, { user: doctor() });
          assert.equal(r.status, 403); assert.equal(r.body.code, "appointment_ended");
          assert.equal((await stored(kind, done._id)).transcriptNotice, undefined);
        }
        assert.equal((await stored(kind, pending._id)).transcriptNotice, undefined);
      });
    });
  }

  test("feature flag off: 404 for a valid participant and nothing is written", async () => {
    const b = await make("appointment");
    const { post } = await start({ enabled: false });
    assert.equal((await post(b._id, { user: patient() })).status, 404);
    assert.equal((await stored("appointment", b._id)).transcriptNotice, undefined);
  });

  test("not signed in 401; bad id 400; unknown id 404; nothing written for any of them", async () => {
    const b = await make("appointment");
    const { post } = await start();
    assert.equal((await post(b._id)).status, 401);
    assert.equal((await post("not-an-id", { user: patient() })).status, 400);
    assert.equal((await post(new mongoose.Types.ObjectId(), { user: patient() })).status, 404);
    assert.equal((await stored("appointment", b._id)).transcriptNotice, undefined);
  });

  test("the IP comes from the request and respects the trusted-proxy setup", async () => {
    // Behind one trusted proxy (the usual setup): the address the proxy reports in X-Forwarded-For is used.
    const behindProxy = await make("appointment");
    const trusted = await start({ trustProxy: 1 });
    await trusted.post(behindProxy._id, { user: patient(), headers: { "x-forwarded-for": "203.0.113.7" } });
    assert.equal((await stored("appointment", behindProxy._id)).transcriptNotice.patient.ip, "203.0.113.7");

    // No trusted proxy: a forged X-Forwarded-For is ignored and the real connection address is stored.
    const direct = await make("appointment");
    const untrusted = await start({ trustProxy: false });
    await untrusted.post(direct._id, { user: patient(), headers: { "x-forwarded-for": "6.6.6.6" } });
    assert.equal((await stored("appointment", direct._id)).transcriptNotice.patient.ip, "127.0.0.1");

    // An unusable address is stored as empty, never as junk (the notice itself is still saved).
    const junk = await make("category");
    const t2 = await start({ trustProxy: 1 });
    const r = await t2.post(junk._id, { user: patient(), headers: { "x-forwarded-for": "<script>" } });
    assert.equal(r.status, 200);
    assert.equal(/[<>]/.test((await stored("category", junk._id)).transcriptNotice.patient.ip), false);
  });

  test("a database failure answers 500 without leaking details", async () => {
    const b = await make("appointment");
    const app = express();
    app.use(express.json());
    app.use("/api/appointments/:id", createAppointmentTranscriptRouter({ auth: fakeAuth, noticeLimiter: passLimiter, isEnabled: () => true, record: async () => { throw Object.assign(new Error("mongo exploded: secret-host:27017"), { name: "MongoNetworkError" }); } }));
    const server = await new Promise((resolve) => { const s = http.createServer(app).listen(0, "127.0.0.1", () => resolve(s)); });
    servers.push(server);
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/appointments/${b._id}/transcript-notice`, { method: "POST", headers: { "x-test-user": JSON.stringify(patient()), "content-type": "application/json" }, body: "{}" });
    assert.equal(res.status, 500);
    assert.equal((await res.text()).includes("secret-host"), false);
  });

  test("the new router lets the other /api/appointments/:id/... routes through", async () => {
    const b = await make("appointment");
    const { call } = await start();
    const confirm = await call("PUT", `/api/appointments/${b._id}/confirm`, { user: doctor() });
    assert.deepEqual(confirm.body, { ok: "confirm-reached", id: String(b._id) });
    assert.deepEqual((await call("GET", `/api/appointments/${b._id}`, { user: doctor() })).body, { ok: "get-reached" });
  });

  test("the real rate limiter returns 429 after 30 posts from one person within 10 minutes", async () => {
    const b = await make("appointment");
    const { post } = await start({ limiter: transcriptNoticeLimiter });
    const user = { id: String(patientId), role: "user" };
    let last;
    for (let i = 0; i < 30; i++) { last = await post(b._id, { user }); assert.notEqual(last.status, 429, "request " + (i + 1)); }
    last = await post(b._id, { user });
    assert.equal(last.status, 429);
    assert.ok(Number(last.headers.get("retry-after")) > 0);
  });

  test("the app's real wiring: off by default (404), and when on it needs the real login (401 without a session)", async () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use("/api/appointments/:id", productionRouter);
    const server = await new Promise((resolve) => { const s = http.createServer(app).listen(0, "127.0.0.1", () => resolve(s)); });
    servers.push(server);
    const url = `http://127.0.0.1:${server.address().port}/api/appointments/${new mongoose.Types.ObjectId()}/transcript-notice`;
    const saved = process.env.TRANSCRIPTION_ENABLED;
    try {
      delete process.env.TRANSCRIPTION_ENABLED;
      assert.equal((await fetch(url, { method: "POST" })).status, 404);
      process.env.TRANSCRIPTION_ENABLED = "false";
      assert.equal((await fetch(url, { method: "POST" })).status, 404);
      process.env.TRANSCRIPTION_ENABLED = "true";
      assert.equal((await fetch(url, { method: "POST" })).status, 401);
    } finally {
      if (saved === undefined) delete process.env.TRANSCRIPTION_ENABLED; else process.env.TRANSCRIPTION_ENABLED = saved;
    }
  });
});
