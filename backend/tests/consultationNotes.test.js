const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

function stub(rel, exports) {
  const file = require.resolve(path.join("..", rel));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
}
stub("middleware/verifyToken", {
  verifyDoctorToken: (req, res, next) => {
    if (!req.headers["x-test-doctor"]) return res.status(401).json({ msg: "no token" });
    req.user = { id: req.headers["x-test-doctor"], role: "doctor" };
    next();
  },
});

require("../models/Doctor");
require("../models/User");
const Appointment = require("../models/Appointment");
const ConsultationNote = require("../models/ConsultationNote");
const notesRouter = require("../routes/consultationNotes");
const { migrateConsultationNotes } = require("../utils/migrateConsultationNotes");
const { decryptPHI } = require("../utils/phiCrypto");

describe("structured consultation notes", () => {
  let mongod, server, base, doctorId, otherDoctorId, patientId, appt;

  const call = async (method, url, body, doctor = String(doctorId)) => {
    const res = await fetch(`${base}/api/notes${url}`, {
      method,
      headers: { "content-type": "application/json", ...(doctor ? { "x-test-doctor": doctor } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  };

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    doctorId = new mongoose.Types.ObjectId();
    otherDoctorId = new mongoose.Types.ObjectId();
    patientId = new mongoose.Types.ObjectId();
    const app = express();
    app.use(express.json());
    app.use("/api/notes", notesRouter);
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    await Appointment.deleteMany({});
    await ConsultationNote.deleteMany({});
    appt = await Appointment.create({ patientId, doctorId, date: "2026-10-01", time: "10:00 AM", status: "complete" });
  });

  test("auto-save: each field saves on its own and merges, stored encrypted", async () => {
    let r = await call("PUT", `/appointment/${appt._id}`, { symptoms: "Cough" });
    assert.equal(r.status, 201);
    assert.equal(r.body.note.symptoms, "Cough");
    r = await call("PUT", `/appointment/${appt._id}`, { plan: "Rest" });
    assert.equal(r.status, 200);
    assert.equal(r.body.note.symptoms, "Cough");
    assert.equal(r.body.note.plan, "Rest");
    assert.equal(r.body.note.cipherText, undefined);
    const raw = await ConsultationNote.findOne({ appointmentId: appt._id }).lean();
    assert.ok(raw.cipherText);
    assert.equal(raw.content, "");
    assert.ok(!JSON.stringify(raw).includes("Cough"));
    assert.equal(decryptPHI(raw).symptoms, "Cough");
  });

  test("legacy `content` is accepted as the Note field", async () => {
    const r = await call("PUT", `/appointment/${appt._id}`, { content: "old client text" });
    assert.equal(r.body.note.note, "old client text");
  });

  test("field limits: 20,000 for Note, 5,000 for the others", async () => {
    assert.equal((await call("PUT", `/appointment/${appt._id}`, { note: "x".repeat(20000) })).status, 201);
    assert.equal((await call("PUT", `/appointment/${appt._id}`, { note: "x".repeat(20001) })).status, 400);
    assert.equal((await call("PUT", `/appointment/${appt._id}`, { symptoms: "x".repeat(5001) })).status, 400);
  });

  test("a legacy note shows its text in Note until migrated; migration is idempotent and keeps content", async () => {
    const legacy = await ConsultationNote.create({
      appointmentId: appt._id, doctorId, patientId, content: "Patient has fever", status: "final",
    });
    let r = await call("GET", `/appointment/${appt._id}`);
    assert.equal(r.body.note.note, "Patient has fever");
    assert.equal(r.body.note.symptoms, "");

    assert.deepEqual(await migrateConsultationNotes(), { migrated: 1 });
    assert.deepEqual(await migrateConsultationNotes(), { migrated: 0 });
    const raw = await ConsultationNote.findById(legacy._id).lean();
    assert.equal(raw.content, "Patient has fever");
    assert.equal(raw.status, "final");
    assert.equal(decryptPHI(raw).note, "Patient has fever");
    r = await call("GET", `/appointment/${appt._id}`);
    assert.equal(r.body.note.note, "Patient has fever");
  });

  test("another doctor cannot read or write; unauthenticated is 401", async () => {
    await call("PUT", `/appointment/${appt._id}`, { symptoms: "Cough" });
    assert.equal((await call("GET", `/appointment/${appt._id}`, null, String(otherDoctorId))).status, 404);
    assert.equal((await call("PUT", `/appointment/${appt._id}`, { symptoms: "x" }, String(otherDoctorId))).status, 404);
    assert.equal((await call("GET", `/appointment/${appt._id}`, null, "")).status, 401);
  });

  test("status cannot be set to final by hand; a note with a reportId is locked against edit and delete", async () => {
    const { body } = await call("PUT", `/appointment/${appt._id}`, { symptoms: "Cough" });
    const id = body.note._id;
    assert.equal((await call("PATCH", `/${id}`, { status: "final" })).status, 400);
    await ConsultationNote.updateOne({ _id: id }, { $set: { reportId: new mongoose.Types.ObjectId(), status: "final" } });
    assert.equal((await call("PUT", `/appointment/${appt._id}`, { symptoms: "changed" })).status, 409);
    assert.equal((await call("PATCH", `/${id}`, { plan: "changed" })).status, 409);
    assert.equal((await call("DELETE", `/${id}`)).status, 404);
    assert.equal((await call("GET", `/appointment/${appt._id}`)).body.note.symptoms, "Cough");
  });

  test("list searches by patient only (note text is encrypted) and decrypts fields", async () => {
    await call("PUT", `/appointment/${appt._id}`, { symptoms: "Cough" });
    const r = await call("GET", "/");
    assert.equal(r.body.notes.length, 1);
    assert.equal(r.body.notes[0].symptoms, "Cough");
    assert.equal(r.body.notes[0].finalised, false);
    assert.equal((await call("GET", "/?search=Cough")).body.notes.length, 0);
  });
});
