// One unreadable or unlinkable record must never make a whole list fail (S3 not configured; record written with another PHI key).
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";
delete process.env.AWS_S3_BUCKET;
delete process.env.S3_BUCKET_NAME;

const Prescription = require("../models/Prescription");
const MedicalCertificate = require("../models/MedicalCertificate");
const Appointment = require("../models/Appointment");
const { encryptPHI } = require("../utils/phiCrypto");
const { getMyPrescriptions, getMyMedicalCertificates } = require("../controllers/medicalController");
const { getPatientAppointments } = require("../controllers/appointmentController");
const { serializeAmendment } = require("../utils/consultationReportService");

const SECRET = "ZEBRA-CLINICAL-WORDS";
const MESSAGE = "This record can't be displayed right now. Please contact support.";

const printed = [];
const realConsole = {};
for (const m of ["log", "info", "warn", "error"]) { realConsole[m] = console[m]; console[m] = (...a) => { printed.push(a.map(String).join(" ")); }; }
after(() => { for (const m of Object.keys(realConsole)) console[m] = realConsole[m]; });

// Encrypts with a DIFFERENT key, like a record written by a laptop that had no PHI_ENCRYPTION_KEY.
function encryptWithOtherKey(value) {
  const saved = process.env.PHI_ENCRYPTION_KEY;
  process.env.PHI_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
  try { return encryptPHI(value); } finally { if (saved === undefined) delete process.env.PHI_ENCRYPTION_KEY; else process.env.PHI_ENCRYPTION_KEY = saved; }
}
const makeRes = () => { const r = { statusCode: 200, body: null }; r.status = (c) => { r.statusCode = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };

describe("lists survive one bad record", () => {
  let mongod, patientId, doctorId, appt;
  before(async () => { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()); });
  after(async () => { await mongoose.disconnect(); await mongod.stop(); });
  beforeEach(async () => {
    printed.length = 0;
    await Promise.all([Prescription.deleteMany({}), MedicalCertificate.deleteMany({}), Appointment.deleteMany({})]);
    patientId = new mongoose.Types.ObjectId();
    doctorId = new mongoose.Types.ObjectId();
    appt = await Appointment.create({ patientId, doctorId, date: "2026-11-01", time: "10:00 AM", status: "completed" });
  });

  test("my-prescriptions: the good one is readable, the bad one is listed as unreadable, status 200, only its id is logged", async () => {
    const good = await Prescription.create({ appointmentId: appt._id, doctorId, patientId, ...encryptPHI({ diagnosis: SECRET, medicines: [], instructions: "x", followUpDate: "" }) });
    const bad = await Prescription.create({ appointmentId: appt._id, doctorId, patientId, ...encryptWithOtherKey({ diagnosis: SECRET, medicines: [], instructions: "x", followUpDate: "" }) });
    const res = makeRes();
    await getMyPrescriptions({ user: { id: String(patientId) }, ip: "127.0.0.1", headers: {}, get: () => "" }, res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    const byId = Object.fromEntries(res.body.map((r) => [String(r._id), r]));
    assert.equal(byId[String(good._id)].diagnosis, SECRET);
    assert.equal(byId[String(good._id)].unreadable, undefined);
    assert.equal(byId[String(bad._id)].unreadable, true);
    assert.equal(byId[String(bad._id)].unreadableMessage, MESSAGE);
    assert.equal(byId[String(bad._id)].diagnosis, null);
    assert.equal(byId[String(bad._id)].cipherText, undefined, "the cipher envelope is never sent");
    const log = printed.join("\n");
    assert.match(log, new RegExp(String(bad._id)));
    assert.doesNotMatch(log, new RegExp(SECRET));
  });

  test("my-certificates: same", async () => {
    const base = { appointmentId: appt._id, doctorId, patientId, issuedDate: "2026-11-01" };
    const good = await MedicalCertificate.create({ ...base, ...encryptPHI({ diagnosis: SECRET, recommendation: "r", restFromDate: "", restToDate: "", notes: "" }) });
    const bad = await MedicalCertificate.create({ ...base, ...encryptWithOtherKey({ diagnosis: SECRET, recommendation: "r", restFromDate: "", restToDate: "", notes: "" }) });
    const res = makeRes();
    await getMyMedicalCertificates({ user: { id: String(patientId) }, ip: "127.0.0.1", headers: {}, get: () => "" }, res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    const byId = Object.fromEntries((res.body.certificates || res.body).map((r) => [String(r._id), r]));
    assert.equal(byId[String(good._id)].diagnosis, SECRET);
    assert.equal(byId[String(bad._id)].unreadable, true);
    assert.equal(byId[String(bad._id)].diagnosis, null);
    assert.doesNotMatch(printed.join("\n"), new RegExp(SECRET));
  });

  test("a report amendment that cannot be decrypted is returned empty and marked, not thrown", () => {
    const out = serializeAmendment({ _id: new mongoose.Types.ObjectId(), authorName: "Dr", createdAt: new Date(), ...encryptWithOtherKey({ reason: SECRET, text: SECRET }) });
    assert.equal(out.unreadable, true);
    assert.equal(out.text, "");
    assert.doesNotMatch(JSON.stringify(out), new RegExp(SECRET));
    const ok = serializeAmendment({ _id: new mongoose.Types.ObjectId(), authorName: "Dr", createdAt: new Date(), ...encryptPHI({ reason: "r", text: "t" }) });
    assert.deepEqual([ok.reason, ok.text, ok.unreadable], ["r", "t", undefined]);
  });

  test("/mine with S3 not configured: the list loads, a report is listed without a link (urlUnavailable), other bookings are untouched", async () => {
    const withFile = await Appointment.create({ patientId, doctorId, date: "2026-11-02", time: "10:00 AM", status: "pending", medicalReports: [{ key: "reports/a/b.pdf", name: "b.pdf" }] });
    const res = makeRes();
    await getPatientAppointments({ user: { id: String(patientId) } }, res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(res.body.length, 2);
    const row = res.body.find((a) => String(a._id) === String(withFile._id));
    assert.equal(row.medicalReports.length, 1);
    assert.equal(row.medicalReports[0].url, null);
    assert.equal(row.medicalReports[0].urlUnavailable, true);
    assert.equal(row.medicalReports[0].name, "b.pdf");
    const log = printed.join("\n");
    assert.match(log, new RegExp(String(withFile._id)));
    assert.doesNotMatch(log, /reports\/a\/b\.pdf/, "the file key is not logged");
  });
});
