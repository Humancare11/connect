// Medical reports of a category ("Get Help With") booking: checked against the storage when the booking is created, and returned
// (with signed, short-lived links) to the patient who owns the booking, the doctor assigned to it and admins - nobody else.
// The storage (S3) is replaced by an in-memory object table; the models, the controllers and the validator are the real ones.
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";
process.env.AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || "test-bucket";

// ── stubs, put on the real modules' exports BEFORE the controllers are loaded ──────────────────────────────────────────────────
const objects = new Map(); // key -> what HEAD returns
let headError = null;
const storage = require("../utils/uploadStorage");
storage.headUploadByKey = async (key) => {
  if (headError) throw headError;
  return objects.get(key) || null;
};
require("../utils/s3PresignedUrl").createS3PresignedGetUrl = async (key) => ({
  url: `https://signed.test/${key}?X-Amz-Expires=300&sig=abc`,
  key,
  expiresIn: 300,
  expiresAt: new Date(Date.now() + 300000).toISOString(),
});
const pv = require("../utils/paymentVerification");
let claims = 0;
pv.verifyCategoryPayment = async ({ paymentIntentId }) => ({ ref: paymentIntentId, gateway: "stripe", amountCents: 5000, currency: "USD" });
pv.verifyServicePayment = pv.verifyCategoryPayment;
pv.claimPaymentOnce = async () => { claims += 1; };
require("../utils/billing").recordPaymentAndInvoice = async () => {};
const notify = require("../utils/bookingNotifications");
notify.notifyAppointmentBooked = () => {};
notify.notifyCategoryConsultationBooked = () => {};

const CategoryConsultation = require("../models/CategoryConsultation");
const Enrollment = require("../models/Enrollment");
const { createCategoryConsultation } = require("../controllers/CategoryConsultationController");
const A = require("../controllers/appointmentController");
const R = require("../utils/bookingReports");

const PATIENT = "64b000000000000000000001";
const OTHER_PATIENT = "64b000000000000000000002";
const DOCTOR = "64b0000000000000000000d1"; // Doctor (login) id of the assigned doctor
const OTHER_DOCTOR = "64b0000000000000000000d2";
const ADMIN = "64b0000000000000000000a1";

const tomorrow = () => new Date(Date.now() + 36 * 3600 * 1000).toISOString().slice(0, 10);
const makeRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
};
const call = async (fn, { user, params = {}, body = {} }) => {
  const res = makeRes();
  await fn({ headers: {}, body, params, query: {}, user, app: { get: () => null } }, res);
  return res;
};

let seq = 0;
const consultationBody = (extra = {}) => ({
  concern: "Rash", duration: "1 week", severity: "mild", supportType: "advice", urgency: "next", date: tomorrow(),
  categoryName: "General Care", specialtyName: "", conditionName: "Rash", paymentIntentId: `pi_${++seq}`, ...extra,
});

// A file the patient uploaded: what the upload endpoints leave in the storage.
const put = (key, { by = PATIENT, type = "application/pdf", length = 2048, name = "blood-test.pdf" } = {}) => {
  objects.set(key, { key, length, contentType: type, originalName: name, uploadedBy: by, uploadedByRole: "user" });
  return key;
};
const OWN = "patients/Test-Patient/blood-test-1700000000000-ab12cd34.pdf";
const OWN_IMG = "patients/Test-Patient/xray-1700000000001-ab12cd35.png";
const OTHERS = "patients/Someone-Else/their-scan-1700000000002-ab12cd36.pdf";

let replSet;
let enrollmentId;
before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  await CategoryConsultation.init();
  // Validation is not what is tested here: the enrollment is inserted as the doctor directory row the controllers look up.
  const inserted = await Enrollment.collection.insertOne({ doctorId: new mongoose.Types.ObjectId(DOCTOR), firstName: "Dana", surname: "Doe", email: "dana@doctor.test" });
  enrollmentId = inserted.insertedId;
});
after(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});
beforeEach(() => {
  objects.clear();
  headError = null;
  claims = 0;
});

const book = (reports, user = { id: PATIENT, role: "user" }) =>
  call(createCategoryConsultation, { user, body: consultationBody(reports === undefined ? {} : { medicalReports: reports }) });

describe("on create: the attached files are validated and rebuilt from the storage", () => {
  test("own files are kept, described by the storage (not by what the browser claimed)", async () => {
    put(OWN, { name: "blood-test.pdf", length: 2048 });
    put(OWN_IMG, { type: "image/png", length: 4096, name: "xray.png" });
    const res = await book([
      { url: `https://bucket.s3.amazonaws.com/${OWN}`, key: OWN, name: "TOTALLY-DIFFERENT.pdf", type: "text/html", size: 1, evil: "<script>" },
      { key: OWN_IMG },
    ]);
    assert.equal(res.statusCode, 201, JSON.stringify(res.body));
    const stored = await CategoryConsultation.findById(res.body.data._id).lean();
    assert.equal(stored.medicalReports.length, 2);
    assert.deepEqual(
      stored.medicalReports.map((r) => [r.key, r.name, r.type, r.size]),
      [[OWN, "blood-test.pdf", "application/pdf", 2048], [OWN_IMG, "xray.png", "image/png", 4096]],
    );
    assert.equal(stored.medicalReports[0].evil, undefined);
  });

  test("the same file listed twice is kept once; no files and no field at all both book normally", async () => {
    put(OWN);
    const twice = await book([{ key: OWN }, { key: OWN }]);
    assert.equal((await CategoryConsultation.findById(twice.body.data._id).lean()).medicalReports.length, 1);
    for (const none of [undefined, [], null]) {
      const res = await book(none);
      assert.equal(res.statusCode, 201);
      assert.deepEqual((await CategoryConsultation.findById(res.body.data._id).lean()).medicalReports, []);
    }
  });

  const refused = async (reports, status = 400) => {
    const before = await CategoryConsultation.countDocuments();
    const res = await book(reports);
    assert.equal(res.statusCode, status, JSON.stringify(res.body));
    assert.equal(res.body.success, false);
    assert.ok(res.body.msg);
    assert.equal(await CategoryConsultation.countDocuments(), before, "no booking was created");
    assert.equal(claims, 0, "the payment was not spent");
  };

  test("a file another patient uploaded is refused", async () => {
    put(OTHERS, { by: OTHER_PATIENT });
    await refused([{ key: OTHERS }]);
    await refused([{ url: `https://bucket.s3.amazonaws.com/${OTHERS}` }]);
  });

  test("a made-up key (no such object) is refused", async () => {
    await refused([{ key: "patients/Test-Patient/never-uploaded-1700000000000-aaaaaaaa.pdf" }]);
  });

  test("keys outside the patient folders, or with path tricks, are refused without asking the storage", async () => {
    put("doctors/Dr-Dana/licence-1.pdf", { by: PATIENT });
    put("employee-tasks/x/y.pdf", { by: PATIENT });
    for (const key of [
      "doctors/Dr-Dana/licence-1.pdf",
      "employee-tasks/x/y.pdf",
      "invoices/1.pdf",
      "patients/Test-Patient/../../doctors/Dr-Dana/licence-1.pdf",
      "patients//x.pdf",
      "patients/Test-Patient/x.pdf%00.exe",
      "patients/Test-Patient/run.exe",
      "patients/Test-Patient/noextension",
      `patients/${"a".repeat(400)}.pdf`,
    ]) {
      await refused([{ key }]);
    }
  });

  test("a stored type that does not fit the extension, or a size of 0 or over 10 MB, is refused", async () => {
    put(OWN, { type: "text/html" });
    await refused([{ key: OWN }]);
    put(OWN, { length: 0 });
    await refused([{ key: OWN }]);
    put(OWN, { length: 10 * 1024 * 1024 + 1 });
    await refused([{ key: OWN }]);
  });

  test("one bad file refuses the whole list; more than 10 files, or a list that is not a list, are refused", async () => {
    put(OWN);
    put(OTHERS, { by: OTHER_PATIENT });
    await refused([{ key: OWN }, { key: OTHERS }]);
    await refused(Array.from({ length: 11 }, () => ({ key: OWN })));
    await refused("patients/Test-Patient/x.pdf");
    await refused({ key: OWN });
  });

  test("when the storage cannot be asked the booking is not refused as forged: 503, nothing spent", async () => {
    put(OWN);
    headError = Object.assign(new Error("S3 down"), { name: "ServiceUnavailable" });
    await refused([{ key: OWN }], 503);
  });
});

describe("who sees the saved files", () => {
  let id; // a booking by PATIENT, assigned to the doctor, with one report
  let legacyId; // a booking saved before reports were validated: no reports field at all
  let forgedId; // an old entry that names a file outside the patient folders

  beforeEach(async () => {
    put(OWN);
    const res = await book([{ key: OWN }]);
    id = res.body.data._id;
    await CategoryConsultation.updateOne({ _id: id }, { $set: { assignedDoctorId: enrollmentId, status: "assigned" } });
    const legacy = await CategoryConsultation.collection.insertOne({
      concern: "Old", duration: "1", severity: "mild", supportType: "advice", urgency: "next", date: tomorrow(),
      patientId: new mongoose.Types.ObjectId(PATIENT), assignedDoctorId: enrollmentId, status: "assigned", createdAt: new Date(), updatedAt: new Date(),
    });
    legacyId = legacy.insertedId;
    const forged = await CategoryConsultation.collection.insertOne({
      concern: "Old forged", duration: "1", severity: "mild", supportType: "advice", urgency: "next", date: tomorrow(),
      patientId: new mongoose.Types.ObjectId(PATIENT), assignedDoctorId: enrollmentId, status: "assigned", createdAt: new Date(), updatedAt: new Date(),
      medicalReports: [{ url: "https://bucket.s3.amazonaws.com/doctors/Dr-Dana/licence-1.pdf", name: "licence.pdf" }, { url: `https://bucket.s3.amazonaws.com/${OWN}`, name: "mine.pdf" }],
    });
    forgedId = forged.insertedId;
  });

  const signed = (r) => r.url.startsWith("https://signed.test/") && /X-Amz-Expires=300/.test(r.url) && r.urlExpiresAt;

  test("the assigned doctor gets the files, as signed short-lived links, in the list and on the booking", async () => {
    const list = await call(A.getDoctorAppointments, { user: { id: DOCTOR, role: "doctor" } });
    assert.equal(list.statusCode, 200);
    const mine = list.body.find((b) => String(b._id) === String(id));
    assert.equal(mine.medicalReports.length, 1);
    assert.equal(mine.medicalReports[0].name, "blood-test.pdf");
    assert.ok(signed(mine.medicalReports[0]));
    assert.ok(mine.medicalReports[0].url.includes(OWN));

    const one = await call(A.getDoctorOwnAppointment, { user: { id: DOCTOR, role: "doctor" }, params: { id: String(id) } });
    assert.equal(one.statusCode, 200);
    assert.ok(signed(one.body.medicalReports[0]));
  });

  test("another doctor sees neither the booking nor its files", async () => {
    const list = await call(A.getDoctorAppointments, { user: { id: OTHER_DOCTOR, role: "doctor" } });
    assert.equal(list.statusCode, 200);
    assert.deepEqual(list.body, []);
    const one = await call(A.getDoctorOwnAppointment, { user: { id: OTHER_DOCTOR, role: "doctor" }, params: { id: String(id) } });
    assert.ok([403, 404].includes(one.statusCode), `denied, got ${one.statusCode}`); // 404 when that login has no doctor enrollment at all
    assert.equal(one.body.medicalReports, undefined);
    const byId = await call(A.getAppointmentById, { user: { id: OTHER_DOCTOR, role: "doctor" }, params: { id: String(id) } });
    assert.equal(byId.statusCode, 403);
  });

  test("the patient who owns the booking gets the files; another patient is refused", async () => {
    const list = await call(A.getPatientAppointments, { user: { id: PATIENT, role: "user" } });
    const mine = list.body.find((b) => String(b._id) === String(id));
    assert.ok(signed(mine.medicalReports[0]));
    const one = await call(A.getPatientOwnAppointment, { user: { id: PATIENT, role: "user" }, params: { id: String(id) } });
    assert.ok(signed(one.body.medicalReports[0]));

    const otherList = await call(A.getPatientAppointments, { user: { id: OTHER_PATIENT, role: "user" } });
    assert.deepEqual(otherList.body, []);
    const otherOne = await call(A.getPatientOwnAppointment, { user: { id: OTHER_PATIENT, role: "user" }, params: { id: String(id) } });
    assert.equal(otherOne.statusCode, 403);
    assert.equal(otherOne.body.medicalReports, undefined);
    const otherById = await call(A.getAppointmentById, { user: { id: OTHER_PATIENT, role: "user" }, params: { id: String(id) } });
    assert.equal(otherById.statusCode, 403);
  });

  test("an admin sees them on the booking page, the same call the Book Appointment bookings use", async () => {
    for (const role of ["admin", "superadmin"]) {
      const res = await call(A.getAppointmentById, { user: { id: ADMIN, role }, params: { id: String(id) } });
      assert.equal(res.statusCode, 200, JSON.stringify(res.body));
      assert.equal(res.body.medicalReports.length, 1);
      assert.ok(signed(res.body.medicalReports[0]));
    }
    // the participant checks are the old ones: a doctor / patient login that is neither party is not an admin
    const stranger = await call(A.getAppointmentById, { user: { id: OTHER_DOCTOR, role: "doctor" }, params: { id: String(id) } });
    assert.equal(stranger.statusCode, 403);
  });

  test("old bookings without reports still work, with an empty list", async () => {
    const list = await call(A.getDoctorAppointments, { user: { id: DOCTOR, role: "doctor" } });
    const old = list.body.find((b) => String(b._id) === String(legacyId));
    assert.deepEqual(old.medicalReports, []);
    const patient = await call(A.getPatientAppointments, { user: { id: PATIENT, role: "user" } });
    assert.deepEqual(patient.body.find((b) => String(b._id) === String(legacyId)).medicalReports, []);
    const one = await call(A.getAppointmentById, { user: { id: ADMIN, role: "admin" }, params: { id: String(legacyId) } });
    assert.equal(one.statusCode, 200);
    assert.deepEqual(one.body.medicalReports, []);
  });

  test("an old entry naming a file outside the patient folders is never signed; the genuine one beside it is", async () => {
    const list = await call(A.getDoctorAppointments, { user: { id: DOCTOR, role: "doctor" } });
    const row = list.body.find((b) => String(b._id) === String(forgedId));
    assert.deepEqual(row.medicalReports.map((r) => r.name), ["mine.pdf"]);
    assert.ok(!JSON.stringify(row).includes("licence-1.pdf"));
  });
});

describe("the validator itself", () => {
  test("isSafeReportKey accepts what the upload endpoints produce and nothing else", () => {
    for (const ok of [OWN, OWN_IMG, "uploads/report-1700000000000-ab12cd34.pdf", "patients/A-B/x.DOCX".toLowerCase()]) assert.equal(R.isSafeReportKey(ok), true, ok);
    for (const bad of ["", null, "doctors/a/b.pdf", "patients/a/../b.pdf", "patients/a/b.exe", "patients/a b/c.pdf", "/patients/a/b.pdf", "patients/a/b.pdf?x=1"]) assert.equal(R.isSafeReportKey(bad), false, String(bad));
  });

  test("its allowed-type table is the upload endpoint's (same extensions and types)", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "routes", "upload.js"), "utf8");
    const block = source.slice(source.indexOf("const ALLOWED_TYPES = {"), source.indexOf("};", source.indexOf("const ALLOWED_TYPES = {")));
    const fromUpload = {};
    for (const m of block.matchAll(/"(\.\w+)":\s*\[([^\]]*)\]/g)) fromUpload[m[1]] = [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    assert.deepEqual(R.ALLOWED_TYPES, fromUpload);
  });
});
