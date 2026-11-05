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
pv.verifyStripePaymentIntent = async ({ paymentIntentId }) => ({ ref: paymentIntentId, gateway: "stripe", amountCents: 5000 });
pv.verifyPaypalOrder = async ({ paypalOrderId }) => ({ ref: paypalOrderId, gateway: "paypal", amountCents: 5000 });
pv.claimPaymentOnce = async () => { claims += 1; };
require("../utils/billing").recordPaymentAndInvoice = async () => {};
const notify = require("../utils/bookingNotifications");
notify.notifyAppointmentBooked = () => {};
notify.notifyCategoryConsultationBooked = () => {};

const CategoryConsultation = require("../models/CategoryConsultation");
const Appointment = require("../models/Appointment");
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
  await Appointment.init();
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

describe("when the booking is created (the patient has already paid): a file is never a reason to refuse it", () => {
  const appointmentBody = (extra = {}) => ({
    date: tomorrow(), time: "10:00", problem: "Cough", category: "General Care", specialty: "GP", condition: "Cough",
    consultationPrice: 50, paymentIntentId: `pi_${++seq}`, patientDetails: { firstName: "Test" }, ...extra,
  });
  const bookAppointment = (reports) =>
    call(A.createAppointment, { user: { id: PATIENT, role: "user" }, body: appointmentBody(reports === undefined ? {} : { medicalReports: reports }) });
  const warnings = [];
  const realWarn = console.warn;
  before(() => { console.warn = (...args) => { warnings.push(args.join(" ")); }; });
  after(() => { console.warn = realWarn; });
  beforeEach(() => { warnings.length = 0; });

  const storedOf = async (kind, res) =>
    kind === "category"
      ? CategoryConsultation.findById(res.body.data._id).lean()
      : Appointment.findById(res.body.appointment._id).lean();
  const flows = [["category", book], ["appointment", bookAppointment]];

  for (const [kind, create] of flows) {
    test(`${kind}: own files are kept, described by the storage (not by what the browser claimed); no warning`, async () => {
      put(OWN, { name: "blood-test.pdf", length: 2048 });
      put(OWN_IMG, { type: "image/png", length: 4096, name: "xray.png" });
      const res = await create([
        { url: `https://bucket.s3.amazonaws.com/${OWN}`, key: OWN, name: "TOTALLY-DIFFERENT.pdf", type: "text/html", size: 1, evil: "<script>" },
        { key: OWN_IMG },
      ]);
      assert.equal(res.statusCode, 201, JSON.stringify(res.body));
      assert.equal(res.body.warning, undefined);
      const stored = await storedOf(kind, res);
      assert.deepEqual(
        stored.medicalReports.map((r) => [r.key, r.name, r.type, r.size]),
        [[OWN, "blood-test.pdf", "application/pdf", 2048], [OWN_IMG, "xray.png", "image/png", 4096]],
      );
      assert.equal(stored.medicalReports[0].evil, undefined);
      assert.deepEqual(warnings.filter((w) => w.includes("[REPORT_")), []);
    });

    test(`${kind}: PAYMENT SUCCEEDED + an invalid report -> the booking is still created, the file is dropped, a warning is returned and logged`, async () => {
      put(OWN);
      put(OTHERS, { by: OTHER_PATIENT });
      const res = await create([{ key: OWN }, { key: OTHERS, name: "their-scan.pdf" }, { key: "doctors/Dr-Dana/licence-1.pdf", name: "licence.pdf" }]);
      assert.equal(res.statusCode, 201, JSON.stringify(res.body));
      assert.equal(claims >= 1, true, "the payment was claimed for the booking");
      const stored = await storedOf(kind, res);
      assert.deepEqual(stored.medicalReports.map((r) => r.key), [OWN], "only the genuine file is attached");
      assert.match(res.body.warning, /2 files could not be attached/);
      assert.match(res.body.warning, /booking and payment are confirmed/);
      assert.deepEqual(res.body.droppedReports.map((d) => d.reason).sort(), ["not_an_upload_key", "not_yours"]);
      const logged = warnings.filter((w) => w.includes("[REPORT_DROPPED]"));
      assert.equal(logged.length, 2);
      assert.ok(logged.some((l) => l.includes("reason=not_yours") && l.includes(OTHERS)));
      assert.ok(logged.some((l) => l.includes("reason=not_an_upload_key")));
      assert.ok(logged.every((l) => l.includes(`patient=${PATIENT}`) && l.includes(`kind=${kind}`)));
    });

    test(`${kind}: made-up keys, path tricks, bad types and sizes are all dropped, never refused`, async () => {
      put(OWN, { type: "text/html" });
      for (const key of [
        "patients/Test-Patient/never-uploaded-1700000000000-aaaaaaaa.pdf",
        "patients/Test-Patient/../../doctors/Dr-Dana/licence-1.pdf",
        "patients/Test-Patient/run.exe",
        OWN,
      ]) {
        const res = await create([{ key }]);
        assert.equal(res.statusCode, 201, `${key}: ${JSON.stringify(res.body)}`);
        assert.deepEqual((await storedOf(kind, res)).medicalReports, []);
        assert.match(res.body.warning, /1 file could not be attached/);
      }
    });

    test(`${kind}: more than 10 files keeps the first 10 and drops the rest; a list that is not a list is dropped`, async () => {
      const keys = Array.from({ length: 12 }, (_, i) => put(`patients/Test-Patient/f${i}-1700000000000-aaaaaaaa.pdf`));
      const res = await create(keys.map((key) => ({ key })));
      assert.equal(res.statusCode, 201);
      assert.equal((await storedOf(kind, res)).medicalReports.length, 10);
      assert.match(res.body.warning, /2 files could not be attached/);
      const odd = await create("patients/Test-Patient/x.pdf");
      assert.equal(odd.statusCode, 201);
      assert.match(odd.body.warning, /1 file could not be attached/);
    });

    test(`${kind}: the same file twice is kept once; no files / no field / null / [] book normally with no warning`, async () => {
      put(OWN);
      const twice = await create([{ key: OWN }, { key: OWN }]);
      assert.equal((await storedOf(kind, twice)).medicalReports.length, 1);
      assert.equal(twice.body.warning, undefined);
      for (const none of [undefined, [], null]) {
        const res = await create(none);
        assert.equal(res.statusCode, 201);
        assert.deepEqual((await storedOf(kind, res)).medicalReports, []);
        assert.equal(res.body.warning, undefined);
      }
    });

    test(`${kind}: the storage is DOWN -> the booking is created, the file is kept aside as unverified (not shown), a warning says it will follow`, async () => {
      put(OWN);
      headError = Object.assign(new Error("S3 down"), { name: "ServiceUnavailable" });
      const res = await create([{ key: OWN, name: "blood-test.pdf" }]);
      assert.equal(res.statusCode, 201, JSON.stringify(res.body));
      const stored = await storedOf(kind, res);
      assert.deepEqual(stored.medicalReports, [], "an unchecked file is not attached");
      assert.deepEqual(stored.reportsUnverified.map((u) => u.key), [OWN]);
      assert.ok(stored.reportsUnverifiedAt);
      assert.match(res.body.warning, /could not be checked right now and will be attached to your booking shortly/);
      assert.ok(warnings.some((w) => w.includes("[REPORT_UNVERIFIED]") && w.includes(OWN)));
    });
  }

  test("a storage error that goes away on the second try is not even reported", async () => {
    put(OWN);
    let calls = 0;
    const flaky = async (key) => { calls += 1; if (calls === 1) throw new Error("blip"); return objects.get(key) || null; };
    const checked = await R.checkBookingReports([{ key: OWN }], { userId: PATIENT, head: flaky, retryDelayMs: 0 });
    assert.equal(checked.kept.length, 1);
    assert.deepEqual([checked.dropped, checked.unverified], [[], []]);
  });
});

describe("before the payment is created: the files are checked and refused while nothing is charged", () => {
  const route = () => {
    const upload = require("../routes/upload");
    const layer = upload.stack.find((l) => l.route && l.route.path === "/check-reports" && l.route.methods.post);
    assert.ok(layer, "POST /api/upload/check-reports exists");
    assert.equal(layer.route.stack.length, 3, "verifyToken + rate limit + handler");
    return layer.route.stack[layer.route.stack.length - 1].handle;
  };
  const check = async (reports, user = { id: PATIENT, role: "user" }) => {
    const res = makeRes();
    await route()({ user, body: { medicalReports: reports } }, res);
    return res;
  };

  test("all files fine (or none) -> ok", async () => {
    put(OWN);
    const res = await check([{ key: OWN }]);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true, files: 1 });
    assert.deepEqual((await check([])).body, { ok: true, files: 0 });
    assert.deepEqual((await check(undefined)).body, { ok: true, files: 0 });
  });

  test("a file that cannot be attached -> 400 naming it, so the page stops before any charge", async () => {
    put(OWN);
    put(OTHERS, { by: OTHER_PATIENT });
    const res = await check([{ key: OWN }, { key: OTHERS, name: "their-scan.pdf" }]);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.msg, /their-scan\.pdf/);
    assert.deepEqual(res.body.invalid, [{ name: "their-scan.pdf", reason: "not_yours" }]);
    assert.equal((await check([{ key: "doctors/x/y.pdf", name: "y.pdf" }])).statusCode, 400);
    assert.equal((await check([{ key: "patients/Test-Patient/missing-1700000000000-aaaaaaaa.pdf" }])).statusCode, 400);
  });

  test("the storage cannot be asked -> 503 (nothing charged yet, the patient retries)", async () => {
    put(OWN);
    headError = Object.assign(new Error("S3 down"), { name: "ServiceUnavailable" });
    const res = await check([{ key: OWN }]);
    assert.equal(res.statusCode, 503);
  });

  test("both booking pages call it before every gateway call", () => {
    const form = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "pages", "AppointmentBookingForm.jsx"), "utf8").replace(/\r\n/g, "\n");
    for (const call of ["/api/payments/create-intent-by-amount", "/api/paypal/create-order-by-amount", "/api/razorpay/create-order"]) {
      const at = form.indexOf(`api.post("${call}"`);
      assert.ok(at > 0, call);
      assert.ok(form.slice(Math.max(0, at - 700), at).includes("checkReportsBeforeCharge()"), `${call} is preceded by the files check`);
    }
    assert.ok(form.includes('"/api/upload/check-reports"'));
  });
});

describe("unverified files are settled later by the job", () => {
  const { runPendingReports, GIVE_UP_AFTER_MS } = require("../jobs/pendingReportsJob");
  const warn = console.warn;
  const logs = [];
  before(() => { console.warn = (...a) => logs.push(a.join(" ")); });
  after(() => { console.warn = warn; });
  beforeEach(() => { logs.length = 0; });

  const bookWhileDown = async (reports) => {
    headError = Object.assign(new Error("S3 down"), { name: "ServiceUnavailable" });
    const res = await book(reports);
    headError = null;
    return res.body.data._id;
  };

  test("when the storage is back the file is attached, the pending list is cleared", async () => {
    put(OWN);
    const id = await bookWhileDown([{ key: OWN }]);
    const totals = await runPendingReports();
    assert.ok(totals.attached >= 1);
    const stored = await CategoryConsultation.findById(id).lean();
    assert.deepEqual(stored.medicalReports.map((r) => r.key), [OWN]);
    assert.deepEqual(stored.reportsUnverified, []);
    assert.equal(stored.reportsUnverifiedAt, null);
  });

  test("a file that fails when finally checked is dropped and logged; a good one beside it is attached", async () => {
    put(OWN);
    put(OTHERS, { by: OTHER_PATIENT });
    const id = await bookWhileDown([{ key: OWN }, { key: OTHERS }]);
    await runPendingReports();
    const stored = await CategoryConsultation.findById(id).lean();
    assert.deepEqual(stored.medicalReports.map((r) => r.key), [OWN]);
    assert.deepEqual(stored.reportsUnverified, []);
    assert.ok(logs.some((l) => l.includes("[REPORT_DROPPED]") && l.includes("reason=not_yours")));
  });

  test("while the storage is still down the file waits; after 24 hours it is dropped and logged", async () => {
    put(OWN);
    const id = await bookWhileDown([{ key: OWN }]);
    headError = Object.assign(new Error("S3 down"), { name: "ServiceUnavailable" });
    const waiting = await runPendingReports();
    assert.ok(waiting.waiting >= 1);
    assert.equal((await CategoryConsultation.findById(id).lean()).reportsUnverified.length, 1);
    await runPendingReports({ now: Date.now() + GIVE_UP_AFTER_MS + 60000 });
    const stored = await CategoryConsultation.findById(id).lean();
    assert.deepEqual(stored.reportsUnverified, []);
    assert.deepEqual(stored.medicalReports, []);
    assert.ok(logs.some((l) => l.includes("[REPORT_DROPPED]") && l.includes("reason=storage_unavailable")));
    headError = null;
  });

  test("it also settles Book Appointment bookings", async () => {
    put(OWN);
    headError = Object.assign(new Error("S3 down"), { name: "ServiceUnavailable" });
    const res = await call(A.createAppointment, {
      user: { id: PATIENT, role: "user" },
      body: { date: tomorrow(), time: "10:00", problem: "Cough", category: "General Care", specialty: "GP", condition: "Cough", consultationPrice: 50, paymentIntentId: `pi_${++seq}`, patientDetails: { firstName: "T" }, medicalReports: [{ key: OWN }] },
    });
    headError = null;
    assert.equal(res.statusCode, 201, JSON.stringify(res.body));
    await runPendingReports();
    const stored = await Appointment.findById(res.body.appointment._id).lean();
    assert.deepEqual(stored.medicalReports.map((r) => r.key), [OWN]);
    assert.deepEqual(stored.reportsUnverified, []);
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
