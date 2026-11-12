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
const TranscriptAccessLog = require("../models/TranscriptAccessLog");
const { recordNoticeShown } = require("../utils/speech/transcriptNotice");
const { decryptPHI } = require("../utils/phiCrypto");
const productionRouter = require("../routes/appointmentTranscript");
const { createAppointmentTranscriptRouter } = productionRouter;
const { transcriptWriteLimiter, transcriptReadLimiter } = require("../middleware/rateLimiters");

const T0 = new Date("2026-11-12T10:00:00.000Z");
const SECRET_WORDS = "ZEBRA-SECRET-PHRASE";

// Everything printed through console is collected, to prove that transcript words never reach a log.
const printed = [];
const realConsole = {};
for (const m of ["log", "info", "warn", "error"]) {
  realConsole[m] = console[m];
  console[m] = (...args) => { printed.push(args.map(String).join(" ")); };
}
after(() => { for (const m of Object.keys(realConsole)) console[m] = realConsole[m]; });

describe("transcript routes", () => {
  let mongod, patientId, doctorId, otherDoctorId, strangerId, enrollment;
  const servers = [];

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([TranscriptSegment.init(), TranscriptAccessLog.init()]); // make sure the unique index exists before the first write
  });
  after(async () => {
    await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    printed.length = 0;
    await Promise.all([Appointment.deleteMany({}), CategoryConsultation.deleteMany({}), Enrollment.deleteMany({}), TranscriptSegment.deleteMany({}), TranscriptAccessLog.deleteMany({})]);
    patientId = new mongoose.Types.ObjectId();
    doctorId = new mongoose.Types.ObjectId();
    otherDoctorId = new mongoose.Types.ObjectId();
    strangerId = new mongoose.Types.ObjectId();
    enrollment = await Enrollment.create({ firstName: "Nobita", surname: "Mestry", doctorId, approvalStatus: "approved" });
    await Enrollment.create({ firstName: "Other", surname: "Doctor", doctorId: otherDoctorId, approvalStatus: "approved" });
  });

  const STATUS = {
    appointment: { confirmed: "confirmed", pending: "pending", requested: "requested", completed: "completed", complete: "complete", cancelled: "cancelled" },
    category: { confirmed: "Confirmed", pending: "Pending", requested: "Pending", completed: "Completed", complete: "Completed", cancelled: "Cancelled" },
  };
  const make = (kind, status = "confirmed") =>
    kind === "appointment"
      ? Appointment.create({ patientId, doctorId, date: "2026-11-01", time: "10:00 AM", status: STATUS.appointment[status] })
      : CategoryConsultation.create({ concern: "x", severity: "mild", supportType: "chat", urgency: "flexible", date: "2026-11-01", slot: "10:00 AM", patientId, assignedDoctorId: enrollment._id, status: STATUS.category[status] });
  const KIND = { appointment: "appointment", category: "category_consultation" };

  const fakeAuth = (req, res, next) => {
    const raw = req.get("x-test-user");
    if (!raw) return res.status(401).json({ msg: "No token provided. Please login." });
    req.user = JSON.parse(raw);
    next();
  };
  const pass = (req, res, next) => next();
  const patient = () => ({ id: String(patientId), role: "user" });
  const doctor = () => ({ id: String(doctorId), role: "doctor" });
  const admin = () => ({ id: String(new mongoose.Types.ObjectId()), role: "admin" });
  const superadmin = () => ({ id: String(new mongoose.Types.ObjectId()), role: "superadmin" });

  async function start(opts = {}) {
    const { enabled = true, writeLimiter = pass, readLimiter = pass, now = () => T0, trustProxy, lateUploadMinutes } = opts;
    const app = express();
    if (trustProxy !== undefined) app.set("trust proxy", trustProxy);
    app.use(express.json());
    app.use(cookieParser());
    app.use("/api/appointments/:id", createAppointmentTranscriptRouter({ auth: fakeAuth, noticeLimiter: pass, writeLimiter, readLimiter, isEnabled: () => enabled, now, ...(lateUploadMinutes ? { lateUploadMinutes } : {}) }));
    const server = await new Promise((resolve) => { const s = http.createServer(app).listen(0, "127.0.0.1", () => resolve(s)); });
    servers.push(server);
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = async (method, id, { user, body, headers } = {}) => {
      const res = await fetch(`${base}/api/appointments/${id}/transcript`, {
        method,
        headers: { "content-type": "application/json", ...(user ? { "x-test-user": JSON.stringify(user) } : {}), ...(headers || {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      let json = null; try { json = await res.json(); } catch { /* empty */ }
      return { status: res.status, body: json, headers: res.headers };
    };
    return { post: (id, o) => call("POST", id, o), get: (id, o) => call("GET", id, o), del: (id, o) => call("DELETE", id, o) };
  }

  const line = (n, extra = {}) => ({ type: "line", clientId: `line-${String(n).padStart(5, "0")}`, original: `${SECRET_WORDS} ${n}`, translations: { en: `Hello ${n}` }, sourceLang: "de-DE", confidence: 0.9, ageMs: 0, ...extra });
  const gapItem = (n, extra = {}) => ({ type: "gap", clientId: `gap-${String(n).padStart(5, "0")}`, reason: "muted", durationMs: 5000, ageMs: 5000, ...extra });
  const rows = (id) => TranscriptSegment.find({ appointmentId: id }).select("+enc").sort({ spokeAt: 1 }).lean();
  const bothNotices = async (kind, b) => {
    await recordNoticeShown({ kind: KIND[kind], appointmentId: b._id, userId: patientId, role: "user", now: T0 });
    await recordNoticeShown({ kind: KIND[kind], appointmentId: b._id, userId: doctorId, role: "doctor", now: T0 });
  };

  // ============================================================================================================== POST
  for (const kind of ["appointment", "category"]) {
    describe(`POST transcript (${kind})`, () => {
      test("a participant's lines and gaps are saved against their own identity; the words are encrypted at rest", async () => {
        const b = await make(kind);
        const { post } = await start();
        const r = await post(b._id, { user: patient(), body: { items: [line(1), gapItem(2)] } });
        assert.equal(r.status, 200);
        assert.deepEqual(r.body, { accepted: 2, duplicates: 0, rejected: [], noticePending: true, lateUpload: false });
        assert.equal(r.headers.get("cache-control"), "no-store");

        const saved = await rows(b._id);
        assert.equal(saved.length, 2);
        const l = saved.find((x) => x.kind === "line");
        assert.equal(String(l.recordedBy), String(patientId));
        assert.equal(l.speakerRole, "patient");
        assert.equal(l.appointmentModel, kind === "appointment" ? "Appointment" : "CategoryConsultation");
        assert.equal(l.receivedAt.getTime(), T0.getTime());
        assert.deepEqual(decryptPHI(l.enc), { original: `${SECRET_WORDS} 1`, translations: { en: "Hello 1" } });
        assert.equal(JSON.stringify(await TranscriptSegment.find({}).lean()).includes(SECRET_WORDS), false, "no clear text in normal reads");
        assert.equal(await TranscriptSegment.countDocuments({ "enc.cipherText": { $regex: SECRET_WORDS } }), 0, "nor in the database");
        const g = saved.find((x) => x.kind === "gap");
        assert.equal(g.gapReason, "muted");
      });

      test("the doctor's lines are saved as the doctor", async () => {
        const b = await make(kind);
        const { post } = await start();
        assert.equal((await post(b._id, { user: doctor(), body: { items: [line(1)] } })).body.accepted, 1);
        const [row] = await rows(b._id);
        assert.equal(String(row.recordedBy), String(doctorId));
        assert.equal(row.speakerRole, "doctor");
      });

      test("the browser cannot choose who it is, the role, the booking, the time, or the notice mark", async () => {
        const b = await make(kind);
        const { post } = await start();
        const forged = { ...line(1), recordedBy: String(strangerId), speakerRole: "doctor", appointmentId: String(new mongoose.Types.ObjectId()), receivedAt: "2001-01-01T00:00:00Z", spokeAt: "2001-01-01T00:00:00Z", noticePending: false, kind: "gap" };
        const r = await post(b._id, { user: patient(), body: { items: [forged], recordedBy: String(strangerId) } });
        assert.equal(r.body.accepted, 1);
        const [row] = await rows(b._id);
        assert.equal(String(row.recordedBy), String(patientId));
        assert.equal(row.speakerRole, "patient");
        assert.equal(String(row.appointmentId), String(b._id));
        assert.equal(row.receivedAt.getTime(), T0.getTime());
        assert.equal(row.spokeAt.getTime(), T0.getTime());
        assert.equal(row.noticePending, true);
        assert.equal(row.kind, "line");
      });

      test("a retried batch is harmless: the same row is stored once; a different person may reuse the same clientId", async () => {
        const b = await make(kind);
        const { post } = await start();
        const batch = { items: [line(1), line(2)] };
        assert.equal((await post(b._id, { user: patient(), body: batch })).body.accepted, 2);
        const again = await post(b._id, { user: patient(), body: batch });
        assert.deepEqual([again.body.accepted, again.body.duplicates], [0, 2]);
        const mixed = await post(b._id, { user: patient(), body: { items: [line(2), line(3)] } });
        assert.deepEqual([mixed.body.accepted, mixed.body.duplicates], [1, 1]);
        assert.equal(await TranscriptSegment.countDocuments({ appointmentId: b._id }), 3);
        assert.equal((await post(b._id, { user: doctor(), body: { items: [line(1)] } })).body.accepted, 1, "same clientId, other person");
        assert.equal(await TranscriptSegment.countDocuments({ appointmentId: b._id }), 4);
        // the same clientId twice inside ONE batch: stored once
        const inBatch = await post(b._id, { user: patient(), body: { items: [line(9), line(9)] } });
        assert.equal(inBatch.body.accepted + inBatch.body.duplicates, 2);
        assert.equal(await TranscriptSegment.countDocuments({ appointmentId: b._id, clientId: "line-00009" }), 1);
      });

      test("lines are ALWAYS accepted: noticePending says whether both notices were on file at that moment, and never changes afterwards", async () => {
        const b = await make(kind);
        const { post } = await start();
        // no notices at all
        const first = await post(b._id, { user: patient(), body: { items: [line(1)] } });
        assert.equal(first.status, 200); assert.equal(first.body.accepted, 1); assert.equal(first.body.noticePending, true);
        // only the patient's notice
        await recordNoticeShown({ kind: KIND[kind], appointmentId: b._id, userId: patientId, role: "user", now: T0 });
        const second = await post(b._id, { user: patient(), body: { items: [line(2)] } });
        assert.equal(second.body.accepted, 1); assert.equal(second.body.noticePending, true);
        // both notices
        await recordNoticeShown({ kind: KIND[kind], appointmentId: b._id, userId: doctorId, role: "doctor", now: T0 });
        const third = await post(b._id, { user: doctor(), body: { items: [line(3)] } });
        assert.equal(third.body.accepted, 1); assert.equal(third.body.noticePending, false);

        const byId = Object.fromEntries((await rows(b._id)).map((x) => [x.clientId, x.noticePending]));
        assert.deepEqual(byId, { "line-00001": true, "line-00002": true, "line-00003": false });
      });

      test("the last lines are accepted after the appointment is completed or cancelled (the final flush happens as the call ends)", async () => {
        const { post } = await start();
        for (const status of ["completed", "complete", "cancelled"]) {
          const b = await make(kind, status);
          const r = await post(b._id, { user: doctor(), body: { items: [line(1)] } });
          assert.equal(r.status, 200, status);
          assert.equal(r.body.accepted, 1, status);
        }
      });

      test("a booking that cannot have had a call yet is refused and nothing is saved", async () => {
        const { post } = await start();
        for (const status of ["pending", "requested"]) {
          const b = await make(kind, status);
          const r = await post(b._id, { user: patient(), body: { items: [line(1)] } });
          assert.equal(r.status, 403, status);
          assert.equal(r.body.code, "not_active");
          assert.equal(await TranscriptSegment.countDocuments({ appointmentId: b._id }), 0);
        }
      });

      test("strangers, admins and wrong roles are refused and nothing is saved", async () => {
        const b = await make(kind);
        const { post } = await start();
        for (const user of [{ id: String(strangerId), role: "user" }, { id: String(otherDoctorId), role: "doctor" }, admin(), superadmin(), { id: String(patientId), role: "partner" }]) {
          const r = await post(b._id, { user, body: { items: [line(1)] } });
          assert.equal(r.status, 403, JSON.stringify(user));
          assert.equal(r.body.code, "not_participant");
        }
        assert.equal(await TranscriptSegment.countDocuments({}), 0);
      });
    });
  }

  test("one bad row never costs the good ones: good rows saved, bad ones reported with position and reason", async () => {
    const b = await make("appointment");
    const { post } = await start();
    const items = [line(1), line(2, { original: "" }), "junk", gapItem(3, { reason: "lunch" }), line(4, { type: "video" }), line(5), line(6, { translations: { en: "a", de: "b", es: "c", fr: "d" } })];
    const r = await post(b._id, { user: patient(), body: { items } });
    assert.equal(r.status, 200);
    assert.equal(r.body.accepted, 2);
    assert.deepEqual(r.body.rejected.map((x) => [x.index, x.reason]), [[1, "empty_text"], [2, "bad_item"], [3, "bad_gap_reason"], [4, "bad_type"], [6, "too_many_translations"]]);
    assert.equal(r.body.rejected[0].clientId, "line-00002");
    assert.equal(r.body.rejected[1].clientId, null);
    assert.equal(await TranscriptSegment.countDocuments({ appointmentId: b._id }), 2);
  });

  test("a request that is not a batch is refused (400): nothing there to save", async () => {
    const b = await make("appointment");
    const { post } = await start();
    for (const body of [undefined, {}, { items: [] }, { items: "x" }, { items: {} }, { items: Array.from({ length: 26 }, (_, i) => line(i)) }]) {
      const r = await post(b._id, { user: patient(), body });
      assert.equal(r.status, 400, JSON.stringify(body)?.slice(0, 40));
      assert.equal(r.body.code, "bad_batch");
    }
    assert.equal((await post(b._id, { user: patient(), body: { items: Array.from({ length: 25 }, (_, i) => line(i)) } })).body.accepted, 25, "25 is the limit and is fine");
  });

  test("feature flag off: 404; not signed in: 401; bad id: 400; unknown booking: 404", async () => {
    const b = await make("appointment");
    const on = await start();
    const off = await start({ enabled: false });
    assert.equal((await off.post(b._id, { user: patient(), body: { items: [line(1)] } })).status, 404);
    assert.equal((await on.post(b._id, { body: { items: [line(1)] } })).status, 401);
    assert.equal((await on.post("nope", { user: patient(), body: { items: [line(1)] } })).status, 400);
    assert.equal((await on.post(new mongoose.Types.ObjectId(), { user: patient(), body: { items: [line(1)] } })).status, 404);
    assert.equal(await TranscriptSegment.countDocuments({}), 0);
  });

  // ============================================================================================================== GET
  for (const kind of ["appointment", "category"]) {
    describe(`GET transcript (${kind})`, () => {
      test("the booking's doctor reads the lines in speaking order, decrypted, with the notice record and a summary", async () => {
        const b = await make(kind);
        await bothNotices(kind, b);
        const { post, get } = await start();
        await post(b._id, { user: patient(), body: { items: [line(2, { ageMs: 5000 }), line(1, { ageMs: 20000 })] } }); // sent out of order
        await post(b._id, { user: doctor(), body: { items: [line(3, { ageMs: 1000, confidence: 0.2 }), gapItem(4, { ageMs: 30000 })] } });
        const r = await get(b._id, { user: doctor() });
        assert.equal(r.status, 200);
        assert.equal(r.headers.get("cache-control"), "no-store");
        assert.equal(r.body.machineTranslationNotice, "Machine-translated, may contain errors.");
        assert.equal(r.body.truncated, false);
        assert.deepEqual(r.body.segments.map((s) => s.kind === "gap" ? "gap" : s.original), ["gap", `${SECRET_WORDS} 1`, `${SECRET_WORDS} 2`, `${SECRET_WORDS} 3`]);
        const first = r.body.segments[1];
        assert.deepEqual(first.translations, { en: "Hello 1" });
        assert.equal(first.speakerRole, "patient");
        assert.equal(first.noticePending, false);
        assert.equal(first.machineTranslated, true);
        assert.equal("enc" in first, false);
        assert.equal(r.body.segments[3].hidden, true, "an unclear line is returned but marked hidden");
        assert.deepEqual(r.body.summary, { lines: 3, gaps: 1, hidden: 1, noticePending: 0, lateUpload: 0 });
        assert.equal(r.body.notice.bothShown, true);
        assert.equal(r.body.notice.patient.shownAt, T0.toISOString());
        assert.equal("ip" in r.body.notice.patient, false, "a doctor does not get the IP / device / user id of the notice");
        assert.equal(r.body.notice.patient.clientShownAt, null, "no browser claim was sent, so none is shown");
        assert.equal("userId" in r.body.notice.patient, false);
      });

      test("an admin and a superadmin can read any booking, and also see who/where the notice was shown", async () => {
        const b = await make(kind);
        await recordNoticeShown({ kind: KIND[kind], appointmentId: b._id, userId: patientId, role: "user", userAgent: "Safari iPhone", ip: "203.0.113.7", now: T0 });
        const { post, get } = await start();
        await post(b._id, { user: patient(), body: { items: [line(1)] } });
        for (const who of [admin(), superadmin()]) {
          const r = await get(b._id, { user: who });
          assert.equal(r.status, 200, who.role);
          assert.equal(r.body.segments.length, 1);
          assert.equal(r.body.notice.patient.ip, "203.0.113.7");
          assert.equal(r.body.notice.patient.userAgent, "Safari iPhone");
          assert.equal(r.body.notice.patient.userId, String(patientId));
          assert.equal(r.body.notice.doctor, null);
          assert.equal(r.body.notice.bothShown, false);
          assert.equal(r.body.segments[0].noticePending, true, "the flag is shown to the reviewer");
          assert.equal(r.body.summary.noticePending, 1);
        }
      });

      test("the patient can NEVER read it, nor can another doctor, a partner, or other staff", async () => {
        const b = await make(kind);
        const { post, get } = await start();
        await post(b._id, { user: patient(), body: { items: [line(1)] } });
        for (const user of [patient(), { id: String(otherDoctorId), role: "doctor" }, { id: String(strangerId), role: "user" }, { id: String(strangerId), role: "partner" }, { id: String(strangerId), role: "employeeadmin" }, { id: String(strangerId), role: "paymentadmin" }]) {
          const r = await get(b._id, { user });
          assert.equal(r.status, 403, JSON.stringify(user));
          assert.equal(JSON.stringify(r.body).includes(SECRET_WORDS), false);
        }
        assert.equal(await TranscriptAccessLog.countDocuments({}), 0, "refused reads are not logged as reads");
      });

      test("every read is audited: who, role, when, how many rows, from where; never any words", async () => {
        const b = await make(kind);
        const { post, get } = await start({ trustProxy: 1 });
        await post(b._id, { user: patient(), body: { items: [line(1), line(2)] } });
        await get(b._id, { user: doctor(), headers: { "x-forwarded-for": "198.51.100.9", "user-agent": "DoctorBrowser/1" } });
        await get(b._id, { user: admin() });
        const log = await TranscriptAccessLog.find({}).sort({ _id: 1 }).lean();
        assert.equal(log.length, 2);
        assert.deepEqual([log[0].action, log[0].role, log[0].count], ["view", "doctor", 2]);
        assert.equal(String(log[0].userId), String(doctorId));
        assert.equal(String(log[0].appointmentId), String(b._id));
        assert.equal(log[0].ip, "198.51.100.9");
        assert.equal(log[0].userAgent, "DoctorBrowser/1");
        assert.equal(log[0].at.getTime(), T0.getTime());
        assert.equal(log[1].role, "admin");
        assert.equal(JSON.stringify(log).includes(SECRET_WORDS), false);
      });
    });
  }

  test("fail closed: if the audit row cannot be saved, no transcript is returned", async () => {
    const b = await make("appointment");
    const { post, get } = await start();
    await post(b._id, { user: patient(), body: { items: [line(1)] } });
    const realCreate = TranscriptAccessLog.create;
    TranscriptAccessLog.create = async () => { throw Object.assign(new Error("audit db down " + SECRET_WORDS), { name: "MongoNetworkError" }); };
    try {
      const r = await get(b._id, { user: doctor() });
      assert.equal(r.status, 503);
      assert.equal(r.body.code, "audit_unavailable");
      assert.equal(JSON.stringify(r.body).includes(SECRET_WORDS), false);
    } finally {
      TranscriptAccessLog.create = realCreate;
    }
  });

  test("a damaged row is reported as unreadable and the rest still loads", async () => {
    const b = await make("appointment");
    const { post, get } = await start();
    await post(b._id, { user: patient(), body: { items: [line(1), line(2)] } });
    await TranscriptSegment.updateOne({ appointmentId: b._id, clientId: "line-00001" }, { $set: { "enc.authTag": Buffer.from("0".repeat(16)).toString("base64") } });
    const r = await get(b._id, { user: doctor() });
    assert.equal(r.status, 200);
    const byId = Object.fromEntries(r.body.segments.map((s) => [s.original === null ? "damaged" : s.original, s.unreadable]));
    assert.deepEqual(byId, { damaged: true, [`${SECRET_WORDS} 2`]: false });
  });

  test("limit and truncated; bad limits fall back; unknown booking 404; bad id 400; not signed in 401; flag off still reads", async () => {
    const b = await make("appointment");
    const { post, get } = await start();
    await post(b._id, { user: patient(), body: { items: [1, 2, 3, 4, 5].map((n) => line(n, { ageMs: 10000 - n })) } });
    const app = express(); // limit goes in the query string
    app.use(express.json());
    app.use("/api/appointments/:id", createAppointmentTranscriptRouter({ auth: fakeAuth, noticeLimiter: pass, writeLimiter: pass, readLimiter: pass, isEnabled: () => true, now: () => T0 }));
    const server = await new Promise((resolve) => { const s = http.createServer(app).listen(0, "127.0.0.1", () => resolve(s)); });
    servers.push(server);
    const q = async (qs) => (await fetch(`http://127.0.0.1:${server.address().port}/api/appointments/${b._id}/transcript${qs}`, { headers: { "x-test-user": JSON.stringify(doctor()) } })).json();
    const three = await q("?limit=3");
    assert.equal(three.segments.length, 3);
    assert.equal(three.truncated, true);
    assert.equal((await q("?limit=5")).truncated, false);
    assert.equal((await q("?limit=abc")).segments.length, 5);
    assert.equal((await q("?limit=-4")).segments.length, 1, "below 1 is raised to 1");
    assert.equal((await get(new mongoose.Types.ObjectId(), { user: admin() })).status, 404);
    assert.equal((await get(new mongoose.Types.ObjectId(), { user: doctor() })).status, 404);
    assert.equal((await get("nope", { user: doctor() })).status, 400);
    assert.equal((await get(b._id)).status, 401);
    assert.equal((await (await start({ enabled: false })).get(b._id, { user: doctor() })).status, 200, "reading does not depend on the flag");
  });

  // ============================================================================================================== DELETE
  describe("DELETE transcript", () => {
    test("an admin removes every row of that appointment only; the notice record stays; the delete is audited with the reason and count", async () => {
      const a = await make("appointment");
      const c = await make("category");
      await recordNoticeShown({ kind: "appointment", appointmentId: a._id, userId: patientId, role: "user", now: T0 });
      const { post, del } = await start();
      await post(a._id, { user: patient(), body: { items: [line(1), line(2), gapItem(3)] } });
      await post(c._id, { user: patient(), body: { items: [line(1)] } });
      const adm = admin();
      const r = await del(a._id, { user: adm, body: { reason: "  Patient   requested removal, ticket 1234 " } });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body, { deleted: 3 });
      assert.equal(await TranscriptSegment.countDocuments({ appointmentId: a._id }), 0);
      assert.equal(await TranscriptSegment.countDocuments({ appointmentId: c._id }), 1, "another appointment is untouched");
      const notice = await Appointment.findById(a._id).select("+transcriptNotice").lean();
      assert.ok(notice.transcriptNotice.patient.shownAt, "the notice record is kept");
      const [log] = await TranscriptAccessLog.find({ action: "delete" }).lean();
      assert.equal(log.count, 3);
      assert.equal(log.reason, "Patient requested removal, ticket 1234");
      assert.equal(log.role, "admin");
      assert.equal(String(log.userId), adm.id);
      assert.equal(String(log.appointmentId), String(a._id));
      assert.equal(JSON.stringify(log).includes(SECRET_WORDS), false);
    });

    test("a superadmin can delete; deleting nothing is fine (0) and still audited", async () => {
      const b = await make("category");
      const { del } = await start();
      const r = await del(b._id, { user: superadmin(), body: { reason: "cleanup" } });
      assert.deepEqual(r.body, { deleted: 0 });
      assert.equal((await TranscriptAccessLog.findOne({ action: "delete" }).lean()).count, 0);
    });

    test("a reason is required (3 to 300 characters); without it nothing is deleted and nothing is logged", async () => {
      const b = await make("appointment");
      const { post, del } = await start();
      await post(b._id, { user: patient(), body: { items: [line(1)] } });
      for (const body of [undefined, {}, { reason: "" }, { reason: "  " }, { reason: "ab" }, { reason: 5 }, { reason: "x".repeat(301) }]) {
        const r = await del(b._id, { user: admin(), body });
        assert.equal(r.status, 400, JSON.stringify(body)?.slice(0, 30));
        assert.match(r.body.code, /^reason_/);
      }
      assert.equal(await TranscriptSegment.countDocuments({ appointmentId: b._id }), 1);
      assert.equal(await TranscriptAccessLog.countDocuments({}), 0);
      assert.equal((await del(b._id, { user: admin(), body: { reason: "x".repeat(300) } })).status, 200);
    });

    test("only admin and superadmin may delete: doctor, patient, partner and others are refused and nothing is deleted", async () => {
      const b = await make("appointment");
      const { post, del } = await start();
      await post(b._id, { user: patient(), body: { items: [line(1)] } });
      for (const user of [doctor(), patient(), { id: String(strangerId), role: "partner" }, { id: String(strangerId), role: "employeeadmin" }, { id: String(strangerId), role: "paymentadmin" }]) {
        const r = await del(b._id, { user, body: { reason: "please delete this" } });
        assert.equal(r.status, 403, JSON.stringify(user));
      }
      assert.equal((await del(b._id, { body: { reason: "no login at all" } })).status, 401);
      assert.equal(await TranscriptSegment.countDocuments({ appointmentId: b._id }), 1);
      assert.equal(await TranscriptAccessLog.countDocuments({}), 0);
    });

    test("fail closed: if the audit row cannot be saved, nothing is deleted", async () => {
      const b = await make("appointment");
      const { post, del } = await start();
      await post(b._id, { user: patient(), body: { items: [line(1)] } });
      const realCreate = TranscriptAccessLog.create;
      TranscriptAccessLog.create = async () => { throw new Error("audit down"); };
      try {
        const r = await del(b._id, { user: admin(), body: { reason: "should not happen" } });
        assert.equal(r.status, 503);
      } finally {
        TranscriptAccessLog.create = realCreate;
      }
      assert.equal(await TranscriptSegment.countDocuments({ appointmentId: b._id }), 1);
    });

    test("bad id: 400 (and with the flag off the delete still works: see the flag-off test below)", async () => {
      assert.equal((await (await start()).del("nope", { user: admin(), body: { reason: "bad id here" } })).status, 400);
    });
  });

  // ============================================================================================================== flag off
  describe("the flag controls only the live feature", () => {
    test("flag off: new lines are 404, but saved transcripts stay readable (doctor, admin) and deletable (admin, superadmin), and reads are still audited", async () => {
      const b = await make("appointment");
      const live = await start({ enabled: true });
      await live.post(b._id, { user: patient(), body: { items: [line(1), line(2)] } });

      const off = await start({ enabled: false });
      assert.equal((await off.post(b._id, { user: patient(), body: { items: [line(3)] } })).status, 404, "the live part is off");
      assert.equal(await TranscriptSegment.countDocuments({ appointmentId: b._id }), 2, "nothing new was saved");

      const d = await off.get(b._id, { user: doctor() });
      assert.equal(d.status, 200);
      assert.equal(d.body.segments.length, 2);
      assert.equal((await off.get(b._id, { user: admin() })).status, 200);
      assert.equal((await off.get(b._id, { user: superadmin() })).status, 200);
      assert.equal((await off.get(b._id, { user: patient() })).status, 403, "the patient never reads, flag or no flag");
      assert.equal((await off.get(b._id)).status, 401);
      assert.equal(await TranscriptAccessLog.countDocuments({ action: "view" }), 3, "every successful read is audited");

      assert.equal((await off.del(b._id, { user: doctor(), body: { reason: "a doctor must not delete" } })).status, 403);
      assert.equal((await off.del(b._id, { user: patient(), body: { reason: "a patient must not delete" } })).status, 403);
      assert.equal(await TranscriptSegment.countDocuments({ appointmentId: b._id }), 2);
      const del = await off.del(b._id, { user: superadmin(), body: { reason: "deleting is allowed with the flag off" } });
      assert.deepEqual(del.body, { deleted: 2 });
      assert.equal(await TranscriptSegment.countDocuments({ appointmentId: b._id }), 0);
      assert.equal((await TranscriptAccessLog.findOne({ action: "delete" }).lean()).count, 2);
    });

    test("flag off, category booking: the doctor and an admin can still read what was saved", async () => {
      const b = await make("category");
      await (await start({ enabled: true })).post(b._id, { user: doctor(), body: { items: [line(1)] } });
      const off = await start({ enabled: false });
      assert.equal((await off.get(b._id, { user: doctor() })).body.segments.length, 1);
      assert.equal((await off.get(b._id, { user: admin() })).body.segments.length, 1);
    });
  });

  // ============================================================================================================== late uploads
  for (const kind of ["appointment", "category"]) {
    describe(`late uploads (${kind})`, () => {
      const MIN = 60 * 1000;
      const backdate = (b, fields) => (kind === "appointment" ? Appointment : CategoryConsultation).collection.updateOne({ _id: b._id }, { $set: fields });

      test("a call that is still running is never late", async () => {
        const b = await make(kind, "confirmed");
        await backdate(b, { updatedAt: new Date(T0.getTime() - 5000 * MIN) });
        const r = await (await start()).post(b._id, { user: patient(), body: { items: [line(1)] } });
        assert.equal(r.body.lateUpload, false);
        assert.equal((await rows(b._id))[0].lateUpload, false);
      });

      test("more than 30 minutes after the appointment ended is marked late (exactly 30 is not); the rows are ALWAYS saved", async () => {
        for (const [minutes, expected] of [[0, false], [29, false], [30, false], [31, true], [600, true], [60 * 24 * 14, true]]) {
          const b = await make(kind, "completed");
          await backdate(b, { updatedAt: new Date(T0.getTime() - minutes * MIN) });
          const r = await (await start()).post(b._id, { user: patient(), body: { items: [line(1), gapItem(2)] } });
          assert.equal(r.status, 200, `${minutes} min`);
          assert.equal(r.body.accepted, 2, `${minutes} min: never rejected for being late`);
          assert.equal(r.body.lateUpload, expected, `${minutes} min`);
          assert.deepEqual((await rows(b._id)).map((x) => x.lateUpload), [expected, expected], `${minutes} min: lines and gaps alike`);
        }
      });

      test("a cancellation is measured from cancelledAt when there is one, not from later edits", async () => {
        const withDate = await make(kind, "cancelled");
        await backdate(withDate, { cancelledAt: new Date(T0.getTime() - 45 * MIN), updatedAt: new Date(T0.getTime() - 1 * MIN) });
        assert.equal((await (await start()).post(withDate._id, { user: doctor(), body: { items: [line(1)] } })).body.lateUpload, true);
        const withoutDate = await make(kind, "cancelled");
        await backdate(withoutDate, { updatedAt: new Date(T0.getTime() - 10 * MIN) });
        assert.equal((await (await start()).post(withoutDate._id, { user: doctor(), body: { items: [line(1)] } })).body.lateUpload, false);
      });

      test("the limit is configurable", async () => {
        const { post } = await start({ lateUploadMinutes: () => 120 });
        for (const [minutes, expected] of [[119, false], [120, false], [121, true]]) {
          const b = await make(kind, "completed");
          await backdate(b, { updatedAt: new Date(T0.getTime() - minutes * MIN) });
          assert.equal((await post(b._id, { user: patient(), body: { items: [line(1)] } })).body.lateUpload, expected, `${minutes} min with a 120 min limit`);
        }
      });

      test("the mark is a fact about the moment of saving, shown per row and in the summary; it can sit next to noticePending", async () => {
        const b = await make(kind, "completed");
        await backdate(b, { updatedAt: new Date(T0.getTime() - 5 * MIN) });
        let clock = T0;
        const { post, get } = await start({ now: () => clock });
        const early = await post(b._id, { user: patient(), body: { items: [line(1)] } });
        clock = new Date(T0.getTime() + 60 * MIN);
        const late = await post(b._id, { user: patient(), body: { items: [line(2)] } });
        assert.equal(early.body.lateUpload, false);
        assert.equal(late.body.lateUpload, true);
        assert.equal(late.body.noticePending, true, "no notices were on file, and it is late too: both marks");

        const view = await get(b._id, { user: doctor() });
        assert.deepEqual(view.body.segments.map((s) => [s.lateUpload, s.noticePending]), [[false, true], [true, true]]);
        assert.equal(view.body.summary.lateUpload, 1);
        const forAdmin = await get(b._id, { user: admin() });
        assert.equal(forAdmin.body.segments[1].lateUpload, true);
      });
    });
  }

  test("the notice record shows both times: the server's shownAt and the browser's own (untrusted) claim, clientShownAt", async () => {
    const b = await make("appointment");
    await recordNoticeShown({ kind: "appointment", appointmentId: b._id, userId: patientId, role: "user", clientShownAt: new Date(T0.getTime() - 40000), now: T0 });
    await recordNoticeShown({ kind: "appointment", appointmentId: b._id, userId: doctorId, role: "doctor", clientShownAt: "not a date", now: T0 });
    const { get } = await start();
    for (const user of [doctor(), admin()]) {
      const { notice } = (await get(b._id, { user })).body;
      assert.equal(notice.patient.shownAt, T0.toISOString(), "the server's time is the real one");
      assert.equal(notice.patient.clientShownAt, new Date(T0.getTime() - 40000).toISOString());
      assert.equal(notice.doctor.clientShownAt, null);
    }
  });

  // ============================================================================================================== logs, limits, wiring
  test("transcript words never reach a log, also when saving, reading or the database fail", async () => {
    const b = await make("appointment");
    const { post, get } = await start();
    printed.length = 0;
    await post(b._id, { user: patient(), body: { items: [line(1)] } });
    await get(b._id, { user: doctor() });
    const realBulk = TranscriptSegment.bulkWrite;
    TranscriptSegment.bulkWrite = async () => { throw Object.assign(new Error("write failed near " + SECRET_WORDS), { name: "MongoServerError" }); };
    try {
      const failed = await post(b._id, { user: patient(), body: { items: [line(2)] } });
      assert.equal(failed.status, 500);
      assert.equal(JSON.stringify(failed.body).includes(SECRET_WORDS), false);
    } finally {
      TranscriptSegment.bulkWrite = realBulk;
    }
    const realFind = TranscriptSegment.find;
    TranscriptSegment.find = () => { throw Object.assign(new Error("read failed near " + SECRET_WORDS), { name: "MongoServerError" }); };
    try {
      const failed = await get(b._id, { user: doctor() });
      assert.equal(failed.status, 500);
      assert.equal(JSON.stringify(failed.body).includes(SECRET_WORDS), false);
    } finally {
      TranscriptSegment.find = realFind;
    }
    for (const lineText of printed) assert.equal(lineText.includes(SECRET_WORDS), false, "words found in a log line: " + lineText.slice(0, 80));
    assert.ok(printed.some((p) => p.includes("MongoServerError")), "the failures themselves are logged, by name only");
  });

  test("the real rate limiters: 601st upload in 10 minutes and 121st read/delete are refused (429)", async () => {
    const b = await make("appointment");
    const { post, get } = await start({ writeLimiter: transcriptWriteLimiter, readLimiter: transcriptReadLimiter });
    const writer = { id: String(new mongoose.Types.ObjectId()), role: "user" }; // fresh people: the limiters keep state per user
    let last;
    for (let i = 0; i < 600; i++) { last = await post("not-an-id", { user: writer }); if (last.status === 429) break; }
    assert.equal(last.status, 400, "600 requests are allowed");
    last = await post("not-an-id", { user: writer });
    assert.equal(last.status, 429);
    assert.ok(Number(last.headers.get("retry-after")) > 0);
    const reader = { id: String(new mongoose.Types.ObjectId()), role: "doctor" };
    for (let i = 0; i < 120; i++) { last = await get("not-an-id", { user: reader }); if (last.status === 429) break; }
    assert.equal(last.status, 400, "120 requests are allowed");
    assert.equal((await get("not-an-id", { user: reader })).status, 429);
    assert.ok(b);
  });

  test("the app's real wiring: flag off -> the live POST is 404 while read / delete are still there (they need the real login: 401); flag on -> all need the login", async () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use("/api/appointments/:id", productionRouter);
    const server = await new Promise((resolve) => { const s = http.createServer(app).listen(0, "127.0.0.1", () => resolve(s)); });
    servers.push(server);
    const url = `http://127.0.0.1:${server.address().port}/api/appointments/${new mongoose.Types.ObjectId()}/transcript`;
    const saved = process.env.TRANSCRIPTION_ENABLED;
    try {
      for (const flag of [undefined, "false"]) {
        if (flag === undefined) delete process.env.TRANSCRIPTION_ENABLED; else process.env.TRANSCRIPTION_ENABLED = flag;
        assert.equal((await fetch(url, { method: "POST" })).status, 404, `POST flag=${flag}`);
        assert.equal((await fetch(url + "-notice", { method: "POST" })).status, 404, `POST notice flag=${flag}`);
        for (const method of ["GET", "DELETE"]) assert.equal((await fetch(url, { method })).status, 401, `${method} flag=${flag}`);
      }
      process.env.TRANSCRIPTION_ENABLED = "true";
      for (const method of ["GET", "POST", "DELETE"]) assert.equal((await fetch(url, { method })).status, 401, method);
    } finally {
      if (saved === undefined) delete process.env.TRANSCRIPTION_ENABLED; else process.env.TRANSCRIPTION_ENABLED = saved;
    }
  });

  test("the schema keeps the promises: unique per person+clientId, ordered index, words hidden by default, no expiry", async () => {
    const idx = await TranscriptSegment.collection.indexes();
    const unique = idx.find((i) => i.unique && i.key.appointmentId === 1 && i.key.recordedBy === 1 && i.key.clientId === 1);
    assert.ok(unique, "unique (appointmentId, recordedBy, clientId) index");
    assert.ok(idx.some((i) => i.key.appointmentId === 1 && i.key.spokeAt === 1), "ordering index");
    assert.equal(idx.some((i) => i.expireAfterSeconds !== undefined), false, "no automatic deletion");
    assert.equal(TranscriptSegment.schema.path("enc").options.select, false);
    const logIdx = await TranscriptAccessLog.collection.indexes();
    assert.equal(logIdx.some((i) => i.expireAfterSeconds !== undefined), false, "the audit log never expires either");
  });
});
