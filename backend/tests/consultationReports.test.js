process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const express = require("express");
const mongoose = require("mongoose");
const sharp = require("sharp");
const { MongoMemoryServer } = require("mongodb-memory-server");

// In-memory S3: Put / Copy / Get / Delete against a Map, so the tests can check what the report owns.
const s3 = { objects: new Map(), sent: [], failCopy: false };
function stub(rel, exports) {
  const file = require.resolve(path.join("..", rel));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
}
stub("config/s3", {
  s3Client: {
    send: async (command) => {
      const name = command.constructor.name;
      const input = command.input;
      s3.sent.push({ name, input });
      if (name === "PutObjectCommand") s3.objects.set(input.Key, input.Body);
      if (name === "CopyObjectCommand") {
        if (s3.failCopy) throw new Error("S3 down");
        const source = decodeURIComponent(input.CopySource.split("/").slice(1).join("/"));
        if (!s3.objects.has(source)) throw Object.assign(new Error("missing"), { name: "NoSuchKey" });
        s3.objects.set(input.Key, s3.objects.get(source));
      }
      if (name === "GetObjectCommand") {
        if (!s3.objects.has(input.Key)) throw Object.assign(new Error("missing"), { name: "NoSuchKey" });
        return { Body: [s3.objects.get(input.Key)] };
      }
      return {};
    },
  },
  getBucketName: () => "test-bucket",
});
stub("middleware/verifyToken", {
  verifyDoctorToken: (req, res, next) => {
    if (!req.headers["x-test-doctor"]) return res.status(401).json({ msg: "no token" });
    req.user = { id: req.headers["x-test-doctor"], role: "doctor" };
    next();
  },
  verifyUserToken: (req, res, next) => {
    if (!req.headers["x-test-user"]) return res.status(401).json({ msg: "no token" });
    req.user = { id: req.headers["x-test-user"], role: "user" };
    next();
  },
  verifyAdminToken: (req, res, next) => {
    if (!req.headers["x-test-admin"]) return res.status(401).json({ msg: "no token" });
    req.user = { id: req.headers["x-test-admin"], role: req.headers["x-test-role"] || "admin" };
    next();
  },
  adminOnly: (req, res, next) =>
    req.user.role === "admin" || req.user.role === "superadmin" ? next() : res.status(403).json({ msg: "Admins only" }),
});

const User = require("../models/User");
const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const Appointment = require("../models/Appointment");
const ConsultationNote = require("../models/ConsultationNote");
const ConsultationReport = require("../models/ConsultationReport");
const ConsultationReportAmendment = require("../models/ConsultationReportAmendment");
const Counter = require("../models/Counter");
const notesRouter = require("../routes/consultationNotes");
const reportsRouter = require("../routes/consultationReports");
const { encryptFields } = require("../utils/consultationNoteFields");
const { decryptPHI } = require("../utils/phiCrypto");

const png = (color) =>
  sharp({ create: { width: 120, height: 50, channels: 4, background: color } }).png().toBuffer();

describe("Visit Notes (consultation reports)", () => {
  let mongod, server, base;
  let doctor, otherDoctor, patient, otherPatient, admin, appt;
  let sigA, sigB;

  const call = async (who, method, url, body) => {
    const headers = { "content-type": "application/json" };
    if (who.doctor) headers["x-test-doctor"] = String(who.doctor);
    if (who.user) headers["x-test-user"] = String(who.user);
    if (who.admin) headers["x-test-admin"] = String(who.admin);
    if (who.role) headers["x-test-role"] = who.role;
    const res = await fetch(`${base}${url}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const type = res.headers.get("content-type") || "";
    return { status: res.status, headers: res.headers, body: type.includes("json") ? await res.json() : Buffer.from(await res.arrayBuffer()) };
  };
  const asDoctor = (d = doctor) => ({ doctor: d._id });
  const asPatient = (p = patient) => ({ user: p._id });
  const asAdmin = (role = "admin") => ({ admin: admin._id, role });

  const makeAppointment = (over = {}) =>
    Appointment.create({
      patientId: patient._id, doctorId: doctor._id, date: "2026-10-01", time: "10:00 AM", status: "complete",
      patientDetails: { firstName: "Jane", lastName: "Patient", gender: "Female", dob: "1990-05-20" }, ...over,
    });
  const fillNote = (appointment, fields = {}) =>
    call(asDoctor(), "PUT", `/api/notes/appointment/${appointment._id}`, {
      symptoms: "Cough and fever", clinicalFindings: "Chest clear", plan: "Rest and fluids", note: "Review in a week", ...fields,
    });
  const finalise = (note, over = {}) => call(asDoctor(), "POST", "/api/consultation-reports", { noteId: note._id, confirm: true, ...over });

  // A signature the doctor "uploaded" earlier: a private object under their folder + key on the enrollment.
  const giveSignature = async (d, buffer) => {
    const key = `doctors/${d._id}/signature/${new mongoose.Types.ObjectId()}.png`;
    s3.objects.set(key, buffer);
    await Enrollment.updateOne({ doctorId: d._id }, { $set: { signatureKey: key } });
    return key;
  };

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    const app = express();
    app.use(express.json());
    app.use("/api/notes", notesRouter);
    app.use("/api/consultation-reports", reportsRouter);
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));
    base = `http://127.0.0.1:${server.address().port}`;
    sigA = await png({ r: 255, g: 0, b: 0, alpha: 1 });
    sigB = await png({ r: 0, g: 0, b: 255, alpha: 1 });
  });

  after(async () => {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    for (const m of [User, Doctor, Enrollment, Appointment, ConsultationNote, Counter]) await m.deleteMany({});
    await ConsultationReport.collection.deleteMany({});
    await ConsultationReportAmendment.collection.deleteMany({});
    s3.objects.clear();
    s3.sent.length = 0;
    s3.failCopy = false;

    patient = await User.create({ name: "Jane Patient", email: "jane@x.com", role: "user" });
    otherPatient = await User.create({ name: "Other Person", email: "other@x.com", role: "user" });
    admin = await User.create({ name: "Admin A", email: "a@x.com", role: "admin" });
    doctor = await Doctor.create({ name: "Dr Who", email: "who@x.com", password: "x" });
    otherDoctor = await Doctor.create({ name: "Dr Other", email: "other-dr@x.com", password: "x" });
    await Enrollment.collection.insertMany([
      { doctorId: doctor._id, specialization: "Cardiology", country: "India", medicalRegistrationNumber: "MCI-12345" },
      { doctorId: otherDoctor._id, specialization: "ENT", country: "India", medicalRegistrationNumber: "MCI-99999" },
    ]);
    await giveSignature(doctor, sigA);
    await giveSignature(otherDoctor, sigB);
    appt = await makeAppointment();
  });

  describe("finalising", () => {
    test("creates HCR-<year>-0001 with encrypted fields, snapshots, locked note", async () => {
      const { body: saved } = await fillNote(appt);
      const res = await finalise(saved.note);
      assert.equal(res.status, 201);
      const r = res.body.report;
      assert.match(r.reportNumber, new RegExp(`^HCR-${new Date().getFullYear()}-0001$`));
      assert.equal(r.symptoms, "Cough and fever");
      assert.equal(r.patient.name, "Jane Patient");
      assert.equal(r.patient.gender, "Female");
      assert.equal(r.consultation.date, "2026-10-01");
      assert.deepEqual(
        { ...r.physician },
        { name: "Dr Who", registrationNumber: "MCI-12345", speciality: "Cardiology", country: "India" },
      );
      assert.equal(r.signatureKey, undefined);

      const raw = await ConsultationReport.collection.findOne({ _id: new mongoose.Types.ObjectId(r._id) });
      assert.ok(!JSON.stringify(raw).includes("Cough"));
      assert.equal(decryptPHI(raw).plan, "Rest and fluids");

      const note = await ConsultationNote.findById(saved.note._id).lean();
      assert.equal(String(note.reportId), r._id);
      assert.equal(note.status, "final");

      const second = await makeAppointment({ time: "11:00 AM" });
      const n2 = await fillNote(second);
      assert.match((await finalise(n2.body.note)).body.report.reportNumber, /-0002$/);
    });

    test("blocks when Symptoms / Clinical Findings / Plan are empty and says which", async () => {
      const { body } = await fillNote(appt, { symptoms: "  ", plan: "" });
      const res = await finalise(body.note);
      assert.equal(res.status, 422);
      assert.deepEqual(res.body.missing.sort(), ["plan", "symptoms"]);
      assert.equal(await ConsultationReport.countDocuments(), 0);
    });

    test("Note is optional", async () => {
      const { body } = await fillNote(appt, { note: "" });
      assert.equal((await finalise(body.note)).status, 201);
    });

    test("requires the confirmation", async () => {
      const { body } = await fillNote(appt);
      const res = await finalise(body.note, { confirm: false });
      assert.equal(res.status, 400);
      assert.equal(res.body.code, "CONFIRM_REQUIRED");
    });

    test("blocks without a Medical Registration Number, with the profile message", async () => {
      await Enrollment.updateOne({ doctorId: doctor._id }, { $set: { medicalRegistrationNumber: "  " } });
      const { body } = await fillNote(appt);
      const res = await finalise(body.note);
      assert.equal(res.status, 422);
      assert.equal(res.body.code, "PROFILE_INCOMPLETE");
      assert.match(res.body.msg, /Please complete your profile \(Medical Registration Number\) before finalising a visit note/);
      assert.equal(await ConsultationReport.countDocuments(), 0);
    });

    test("blocks without a signature", async () => {
      await Enrollment.updateOne({ doctorId: doctor._id }, { $set: { signatureKey: "" } });
      const { body } = await fillNote(appt);
      const res = await finalise(body.note);
      assert.equal(res.status, 422);
      assert.equal(res.body.code, "SIGNATURE_REQUIRED");
    });

    test("a second finalise is refused and creates no second report", async () => {
      const { body } = await fillNote(appt);
      assert.equal((await finalise(body.note)).status, 201);
      const again = await finalise(body.note);
      assert.equal(again.status, 409);
      assert.equal(await ConsultationReport.countDocuments(), 1);
    });

    test("concurrent finalise submits create exactly one report", async () => {
      const { body } = await fillNote(appt);
      const results = await Promise.all([finalise(body.note), finalise(body.note), finalise(body.note)]);
      assert.equal(results.filter((r) => r.status === 201).length, 1);
      assert.equal(await ConsultationReport.countDocuments(), 1);
    });

    test("another doctor cannot finalise my note", async () => {
      const { body } = await fillNote(appt);
      const res = await call(asDoctor(otherDoctor), "POST", "/api/consultation-reports", { noteId: body.note._id, confirm: true });
      assert.equal(res.status, 404);
    });

    test("is unavailable to patients and admins", async () => {
      const { body } = await fillNote(appt);
      assert.equal((await call(asPatient(), "POST", "/api/consultation-reports", { noteId: body.note._id, confirm: true })).status, 401);
      assert.equal((await call(asAdmin(), "POST", "/api/consultation-reports", { noteId: body.note._id, confirm: true })).status, 401);
    });
  });

  describe("signature ownership", () => {
    test("the signature is COPIED to consultation-reports/<reportId>/signature.png, not referenced", async () => {
      const profileKey = (await Enrollment.findOne({ doctorId: doctor._id }).lean()).signatureKey;
      const { body } = await fillNote(appt);
      const res = await finalise(body.note);
      const reportId = res.body.report._id;

      const raw = await ConsultationReport.collection.findOne({ _id: new mongoose.Types.ObjectId(reportId) });
      assert.equal(raw.signatureKey, `consultation-reports/${reportId}/signature.png`);
      assert.notEqual(raw.signatureKey, profileKey);
      const copy = s3.sent.find((c) => c.name === "CopyObjectCommand");
      assert.ok(copy.input.CopySource.endsWith(profileKey));
      assert.equal(copy.input.Key, raw.signatureKey);
      assert.equal(copy.input.ServerSideEncryption, "AES256");
      assert.ok(s3.objects.get(raw.signatureKey).equals(sigA));
    });

    test("replacing the profile signature later does not change an old report", async () => {
      const { body } = await fillNote(appt);
      const first = await finalise(body.note);
      await giveSignature(doctor, sigB); // doctor uploads a new profile signature
      const img = await call(asDoctor(), "GET", `/api/consultation-reports/doctor/${first.body.report._id}/signature`);
      assert.equal(img.status, 200);
      assert.ok(img.body.equals(sigA), "old report still serves the signature it was signed with");

      const second = await makeAppointment({ time: "11:00 AM" });
      const n2 = await fillNote(second);
      const r2 = await finalise(n2.body.note);
      const img2 = await call(asDoctor(), "GET", `/api/consultation-reports/doctor/${r2.body.report._id}/signature`);
      assert.ok(img2.body.equals(sigB), "a new report uses the new signature");
    });

    test("deleting the profile signature object does not affect an old report", async () => {
      const { body } = await fillNote(appt);
      const res = await finalise(body.note);
      const profileKey = (await Enrollment.findOne({ doctorId: doctor._id }).lean()).signatureKey;
      s3.objects.delete(profileKey);
      const img = await call(asDoctor(), "GET", `/api/consultation-reports/doctor/${res.body.report._id}/signature`);
      assert.equal(img.status, 200);
    });

    test("if the copy fails nothing is created and the note stays a draft", async () => {
      s3.failCopy = true;
      const { body } = await fillNote(appt);
      const res = await finalise(body.note);
      assert.equal(res.status, 502);
      assert.equal(await ConsultationReport.countDocuments(), 0);
      assert.equal((await ConsultationNote.findById(body.note._id).lean()).reportId, null);
    });
  });

  describe("immutability and amendments", () => {
    let report;
    beforeEach(async () => {
      const { body } = await fillNote(appt);
      report = (await finalise(body.note)).body.report;
    });

    test("Mongoose cannot update, replace or delete a finalised report", async () => {
      await assert.rejects(ConsultationReport.updateOne({ _id: report._id }, { $set: { cipherText: "x" } }), /read-only/);
      await assert.rejects(ConsultationReport.findOneAndUpdate({ _id: report._id }, { $set: { status: "final" } }), /read-only/);
      await assert.rejects(ConsultationReport.deleteOne({ _id: report._id }), /read-only/);
      await assert.rejects(ConsultationReport.deleteMany({}), /read-only/);
      const doc = await ConsultationReport.findById(report._id);
      doc.reportNumber = "HCR-0000";
      await assert.rejects(doc.save(), /read-only/);
    });

    test("there is no edit / delete route, and the note is locked", async () => {
      for (const method of ["PUT", "PATCH", "DELETE"]) {
        const res = await call(asDoctor(), method, `/api/consultation-reports/doctor/${report._id}`, { symptoms: "x" });
        assert.ok([404, 405].includes(res.status), `${method} -> ${res.status}`);
      }
      assert.equal((await call(asDoctor(), "PUT", `/api/notes/appointment/${appt._id}`, { symptoms: "changed" })).status, 409);
      const after = await call(asDoctor(), "GET", `/api/consultation-reports/doctor/${report._id}`);
      assert.equal(after.body.report.symptoms, "Cough and fever");
    });

    test("amendments are stored separately, shown after the original, encrypted", async () => {
      const res = await call(asDoctor(), "POST", `/api/consultation-reports/doctor/${report._id}/amendments`, {
        reason: "Typo in dosage", text: "Plan should read: rest, fluids and paracetamol 500mg.",
      });
      assert.equal(res.status, 201);
      const raw = await ConsultationReportAmendment.collection.findOne({});
      assert.equal(String(raw.reportId), report._id);
      assert.equal(String(raw.authorId), String(doctor._id));
      assert.ok(raw.createdAt);
      assert.ok(!JSON.stringify(raw).includes("paracetamol"));

      const got = await call(asDoctor(), "GET", `/api/consultation-reports/doctor/${report._id}`);
      assert.equal(got.body.report.plan, "Rest and fluids"); // original untouched
      assert.equal(got.body.report.amendments.length, 1);
      assert.equal(got.body.report.amendments[0].reason, "Typo in dosage");
      assert.equal(got.body.report.amendments[0].authorName, "Dr Who");
      assert.equal(await ConsultationReport.countDocuments(), 1);
    });

    test("amendment needs a reason and text; only the report's doctor may add one", async () => {
      const url = `/api/consultation-reports/doctor/${report._id}/amendments`;
      assert.equal((await call(asDoctor(), "POST", url, { reason: "", text: "x" })).status, 400);
      assert.equal((await call(asDoctor(), "POST", url, { reason: "x", text: " " })).status, 400);
      assert.equal((await call(asDoctor(otherDoctor), "POST", url, { reason: "x", text: "y" })).status, 404);
      assert.equal((await call(asPatient(), "POST", url, { reason: "x", text: "y" })).status, 401);
      assert.equal((await call(asAdmin(), "POST", url, { reason: "x", text: "y" })).status, 401);
      assert.equal(await ConsultationReportAmendment.collection.countDocuments(), 0);
    });
  });

  describe("who can read", () => {
    let report;
    beforeEach(async () => {
      const { body } = await fillNote(appt);
      report = (await finalise(body.note)).body.report;
    });

    test("patient: own report and signature only", async () => {
      const mine = await call(asPatient(), "GET", "/api/consultation-reports/mine");
      assert.equal(mine.body.reports.length, 1);
      assert.equal((await call(asPatient(), "GET", `/api/consultation-reports/mine/${report._id}`)).status, 200);
      assert.equal((await call(asPatient(), "GET", `/api/consultation-reports/mine/${report._id}/signature`)).status, 200);
      assert.equal((await call(asPatient(otherPatient), "GET", `/api/consultation-reports/mine/${report._id}`)).status, 404);
      assert.equal((await call(asPatient(otherPatient), "GET", `/api/consultation-reports/mine/${report._id}/signature`)).status, 404);
      assert.equal((await call(asPatient(otherPatient), "GET", "/api/consultation-reports/mine")).body.reports.length, 0);
    });

    test("doctor: only own reports; other doctor gets 404 for report and signature", async () => {
      assert.equal((await call(asDoctor(), "GET", "/api/consultation-reports/doctor")).body.reports.length, 1);
      assert.equal((await call(asDoctor(otherDoctor), "GET", "/api/consultation-reports/doctor")).body.reports.length, 0);
      assert.equal((await call(asDoctor(otherDoctor), "GET", `/api/consultation-reports/doctor/${report._id}`)).status, 404);
      assert.equal((await call(asDoctor(otherDoctor), "GET", `/api/consultation-reports/doctor/${report._id}/signature`)).status, 404);
      const byPatient = await call(asDoctor(), "GET", `/api/consultation-reports/doctor/patient/${patient._id}`);
      assert.equal(byPatient.body.reports.length, 1);
    });

    test("admin: all reports (search by patient name and report ID), read only", async () => {
      const list = await call(asAdmin(), "GET", "/api/consultation-reports/admin");
      assert.equal(list.body.total, 1);
      assert.equal((await call(asAdmin("superadmin"), "GET", "/api/consultation-reports/admin?q=jane")).body.reports.length, 1);
      assert.equal((await call(asAdmin(), "GET", `/api/consultation-reports/admin?q=${report.reportNumber}`)).body.reports.length, 1);
      assert.equal((await call(asAdmin(), "GET", "/api/consultation-reports/admin?q=nobody")).body.reports.length, 0);
      assert.equal((await call(asAdmin(), "GET", "/api/consultation-reports/admin?q=.*")).body.reports.length, 0);
      assert.equal((await call(asAdmin(), "GET", `/api/consultation-reports/admin/${report._id}`)).status, 200);
      assert.equal((await call(asAdmin(), "GET", `/api/consultation-reports/admin/${report._id}/signature`)).status, 200);
      assert.equal((await call(asAdmin(), "DELETE", `/api/consultation-reports/admin/${report._id}`)).status, 404);
    });

    test("a non-admin role is refused on admin routes; no token is 401 everywhere", async () => {
      assert.equal((await call({ admin: admin._id, role: "user" }, "GET", "/api/consultation-reports/admin")).status, 403);
      assert.equal((await call(asDoctor(), "GET", "/api/consultation-reports/admin")).status, 401);
      assert.equal((await call(asPatient(), "GET", "/api/consultation-reports/admin")).status, 401);
      for (const url of ["mine", "doctor", "admin", `mine/${report._id}/signature`, `doctor/${report._id}`, `admin/${report._id}`]) {
        assert.equal((await call({}, "GET", `/api/consultation-reports/${url}`)).status, 401, url);
      }
    });

    test("signature response is private, never cached, and report JSON never carries a key or URL", async () => {
      const img = await call(asPatient(), "GET", `/api/consultation-reports/mine/${report._id}/signature`);
      assert.equal(img.headers.get("content-type"), "image/png");
      assert.match(img.headers.get("cache-control"), /no-store/);
      const json = JSON.stringify((await call(asPatient(), "GET", `/api/consultation-reports/mine/${report._id}`)).body);
      assert.ok(!json.includes("signatureKey") && !json.includes("consultation-reports/") && !json.includes("cipherText"));
    });
  });

  describe("drafts and pending", () => {
    test("drafts are never visible to patient or admin; a completed appointment shows as pending", async () => {
      await fillNote(appt);
      const mine = await call(asPatient(), "GET", "/api/consultation-reports/mine");
      assert.equal(mine.body.reports.length, 0);
      assert.equal(mine.body.pending.length, 1);
      assert.equal(String(mine.body.pending[0].appointmentId), String(appt._id));
      assert.ok(!JSON.stringify(mine.body).includes("Cough"));
      assert.equal((await call(asAdmin(), "GET", "/api/consultation-reports/admin")).body.total, 0);
    });

    test("pending disappears once finalised", async () => {
      const { body } = await fillNote(appt);
      await finalise(body.note);
      assert.equal((await call(asPatient(), "GET", "/api/consultation-reports/mine")).body.pending.length, 0);
    });

    test("doctor states: draft vs signed per appointment", async () => {
      const second = await makeAppointment({ time: "11:00 AM" });
      await fillNote(second);
      const { body } = await fillNote(appt);
      await finalise(body.note);
      const { body: out } = await call(asDoctor(), "GET", "/api/consultation-reports/doctor/states");
      assert.equal(out.states[String(appt._id)].state, "signed");
      assert.equal(out.states[String(second._id)].state, "draft");
    });

    test("review-info returns the physician details and signature flag", async () => {
      const { body } = await call(asDoctor(), "GET", "/api/consultation-reports/doctor/review-info");
      assert.equal(body.physician.registrationNumber, "MCI-12345");
      assert.equal(body.hasSignature, true);
    });
  });

  test("a crashed link is repaired: report exists, note not linked, next finalise re-links and answers 409", async () => {
    const { body } = await fillNote(appt);
    const res = await finalise(body.note);
    await ConsultationNote.updateOne({ _id: body.note._id }, { $set: { reportId: null, status: "draft" } });
    const again = await finalise(body.note);
    assert.equal(again.status, 409);
    assert.equal(String((await ConsultationNote.findById(body.note._id).lean()).reportId), res.body.report._id);
  });

  test("encryptFields round trip helper is used for the report blob", () => {
    const blob = encryptFields({ symptoms: "a", clinicalFindings: "b", plan: "c", note: "" });
    assert.deepEqual(decryptPHI(blob), { symptoms: "a", clinicalFindings: "b", plan: "c", note: "" });
  });
});
