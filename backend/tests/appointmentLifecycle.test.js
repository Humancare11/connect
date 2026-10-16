const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

// Seams replaced BEFORE the modules under test are required (they destructure
// these at load time).
const pushes = [];
require("../utils/pushNotifications").sendPushToUser = (userId, payload) => {
  pushes.push({ userId: String(userId), ...payload });
};

const reopenEmails = [];
require("../utils/bookingNotifications").notifyDoctorAppointmentReopened = (args) => {
  reopenEmails.push(args);
  return Promise.resolve();
};

const phi = require("../utils/phiCrypto");
phi.encryptPHI = () => ({ cipherText: "x", iv: "x", authTag: "x", keyVersion: "t" });

let accessResult;
require("../utils/doctorAppointmentAccess").ensureDoctorAppointment = async () => {
  if (accessResult instanceof Error) throw accessResult;
  return accessResult;
};

const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");
const Prescription = require("../models/Prescription");
const MedicalCertificate = require("../models/MedicalCertificate");
const User = require("../models/User");

const lifecycle = require("../utils/appointmentLifecycle");
const {
  completeAppointment,
  adminCompleteAppointment,
  reopenAppointment,
  reassignAppointmentDoctor,
} = require("../controllers/appointmentController");
const { updateCategoryConsultationStatus, assignDoctor } = require("../controllers/CategoryConsultationController");
const { createPrescription, createMedicalCertificate } = require("../controllers/medicalController");

const APPT_ID = "64b000000000000000000001";
const DOCTOR_ID = "64b0000000000000000000d1";
const PATIENT_ID = "64b0000000000000000000a1";
const ENROLLMENT_ID = "64b0000000000000000000e1";

const events = [];
const evicted = [];
const rejoined = [];
const makeApp = () => ({
  get(name) {
    if (name === "io") {
      return { to: (room) => ({ emit: (ev, payload) => events.push({ room, ev, payload }) }) };
    }
    if (name === "evictAllFromAppointmentRoom") return (id, opts) => evicted.push({ id: String(id), ...opts });
    if (name === "allowAppointmentRoomRejoin") return (id) => rejoined.push(String(id));
    return undefined;
  },
});

const lean = (value) => ({ select: () => ({ lean: async () => value }), lean: async () => value });

let updates; // recorded findOneAndUpdate calls
let updateResult; // what findOneAndUpdate resolves to (function of call or value)
let fresh; // what the post-race re-read returns
let conflictAppointment; // Appointment.findOne result
let conflictCategory; // CategoryConsultation.findOne result
let appointmentDoc;
let categoryDoc;

const apptDoc = (over = {}) => ({
  _id: APPT_ID,
  patientId: PATIENT_ID,
  doctorId: DOCTOR_ID,
  status: "confirmed",
  date: "2030-01-15",
  time: "10:00 AM",
  appointmentDateTimeUtc: new Date("2030-01-15T10:00:00Z"),
  ...over,
});
const catDoc = (over = {}) => ({
  _id: APPT_ID,
  patientId: PATIENT_ID,
  status: "Confirmed",
  date: "2030-01-15",
  appointmentType: "NEXT_AVAILABLE",
  assignedSlot: "10:00 AM",
  assignedDoctorId: { _id: ENROLLMENT_ID, doctorId: DOCTOR_ID },
  ...over,
});

test.beforeEach(() => {
  events.length = 0;
  evicted.length = 0;
  rejoined.length = 0;
  pushes.length = 0;
  reopenEmails.length = 0;
  updates = [];
  fresh = null;
  conflictAppointment = null;
  conflictCategory = null;
  accessResult = null;
  appointmentDoc = apptDoc();
  categoryDoc = null;
  updateResult = (model, filter, update) => ({
    ...(model === "Appointment" ? appointmentDoc : categoryDoc),
    status: update.$set.status,
  });

  Appointment.findById = (id) => {
    const query = lean(fresh);
    query.then = (resolve, reject) => Promise.resolve(appointmentDoc).then(resolve, reject);
    return query;
  };
  Appointment.findOne = () => lean(conflictAppointment);
  Appointment.findOneAndUpdate = async (filter, update) => {
    updates.push({ model: "Appointment", filter, update });
    return typeof updateResult === "function" ? updateResult("Appointment", filter, update) : updateResult;
  };
  CategoryConsultation.findById = () => {
    const query = lean(fresh);
    query.populate = async () => categoryDoc;
    return query;
  };
  CategoryConsultation.findOne = () => lean(conflictCategory);
  CategoryConsultation.findOneAndUpdate = async (filter, update) => {
    updates.push({ model: "CategoryConsultation", filter, update });
    return typeof updateResult === "function" ? updateResult("CategoryConsultation", filter, update) : updateResult;
  };
  User.findById = () => lean({ name: "Ada Admin", email: "ada@example.com" });
});

const call = async (handler, req) => {
  const out = { status: 200, body: null };
  const res = { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; } };
  await handler({ app: makeApp(), params: { id: APPT_ID }, body: {}, user: { id: DOCTOR_ID, role: "doctor" }, ...req }, res);
  return out;
};

// ── completion ─────────────────────────────────────────────────────────────

test("complete: a confirmed appointment becomes complete, with socket events, eviction and a patient push", async () => {
  const out = await call(completeAppointment);
  assert.equal(out.status, 200);
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].filter.status, { $in: ["assigned", "confirmed"] });
  assert.equal(updates[0].update.$set.status, "complete");
  assert.ok(updates[0].update.$unset.reopenedByAdmin, "clears the reopened note");
  const rooms = events.map((e) => e.room).sort();
  assert.deepEqual(rooms, [`appointment_${APPT_ID}`, "admin_room", `doctor_${DOCTOR_ID}`, `patient_${PATIENT_ID}`].sort());
  assert.deepEqual(evicted, [{ id: APPT_ID, reason: "completed" }]);
  assert.deepEqual(pushes.map((p) => [p.userId, p.title]), [[PATIENT_ID, "Appointment completed"]]);
});

test("complete: an already-complete appointment is a success with no side effects", async () => {
  appointmentDoc = apptDoc({ status: "complete" });
  const out = await call(completeAppointment);
  assert.equal(out.status, 200);
  assert.match(out.body.msg, /already completed/);
  assert.equal(updates.length, 0);
  assert.equal(events.length, 0);
  assert.equal(pushes.length, 0);
});

test("complete: a pending appointment is refused (400)", async () => {
  appointmentDoc = apptDoc({ status: "pending" });
  const out = await call(completeAppointment);
  assert.equal(out.status, 400);
  assert.equal(updates.length, 0);
});

test("complete: another doctor's appointment is refused (403)", async () => {
  const out = await call(completeAppointment, { user: { id: "64b0000000000000000000ff", role: "doctor" } });
  assert.equal(out.status, 403);
  assert.equal(updates.length, 0);
});

test("complete: lost race to another completion is treated as already complete; other changes are 409", async () => {
  updateResult = null;
  fresh = { status: "complete" };
  assert.equal((await call(completeAppointment)).status, 200);
  assert.equal(events.length, 0);

  fresh = { status: "cancelled" };
  assert.equal((await call(completeAppointment)).status, 409);
});

test("complete: category consultations use the capitalized statuses", async () => {
  appointmentDoc = null;
  categoryDoc = catDoc();
  const out = await call(completeAppointment);
  assert.equal(out.status, 200);
  assert.equal(updates[0].model, "CategoryConsultation");
  assert.deepEqual(updates[0].filter.status, { $in: ["Assigned", "Confirmed"] });
  assert.equal(updates[0].update.$set.status, "Completed");
});

test("admin complete: works without ownership, same side effects and patient push", async () => {
  const out = await call(adminCompleteAppointment, { user: { id: "64b0000000000000000000aa", role: "admin" } });
  assert.equal(out.status, 200);
  assert.equal(updates[0].update.$set.status, "complete");
  assert.deepEqual(pushes.map((p) => p.title), ["Appointment completed"]);
  assert.equal(evicted.length, 1);
});

test("admin complete: unknown id is 404", async () => {
  appointmentDoc = null;
  categoryDoc = null;
  const out = await call(adminCompleteAppointment, { user: { id: "x", role: "admin" } });
  assert.equal(out.status, 404);
});

// ── reopen ─────────────────────────────────────────────────────────────────

const adminReq = { user: { id: "64b0000000000000000000aa", role: "admin" } };

test("reopen: complete -> confirmed, marked reopened, rejoin allowed, patient and doctor pushed", async () => {
  appointmentDoc = apptDoc({ status: "complete" });
  const out = await call(reopenAppointment, adminReq);
  assert.equal(out.status, 200);
  const { filter, update } = updates[0];
  assert.deepEqual(filter.status, { $in: ["complete", "completed"] });
  assert.equal(update.$set.status, "confirmed");
  assert.equal(update.$set.sessionStarted, true);
  assert.equal(update.$set.reopenedByAdmin.name, "Ada Admin");
  assert.deepEqual(rejoined, [APPT_ID]);
  assert.deepEqual(
    pushes.map((p) => p.userId).sort(),
    [DOCTOR_ID, PATIENT_ID].sort()
  );
  assert.ok(events.every((e) => e.payload.status === "confirmed" && e.payload.reopened === true));
  assert.equal(evicted.length, 0);
  assert.equal(reopenEmails.length, 1, "the doctor is also emailed");
  assert.equal(reopenEmails[0].isCategory, false);
});

test("reopen: no doctor email when the reopen is refused", async () => {
  appointmentDoc = apptDoc({ status: "complete" });
  conflictAppointment = { _id: "other" };
  await call(reopenAppointment, adminReq);
  assert.equal(reopenEmails.length, 0);
});

test("reopen: refused with a clear 409 when the doctor's slot is now taken", async () => {
  appointmentDoc = apptDoc({ status: "complete" });
  conflictAppointment = { _id: "other" };
  const out = await call(reopenAppointment, adminReq);
  assert.equal(out.status, 409);
  assert.match(out.body.msg, /already has another active appointment/);
  assert.equal(updates.length, 0);
  assert.equal(rejoined.length, 0);
  assert.equal(pushes.length, 0);
});

test("reopen: only completed appointments, and only with an assigned doctor", async () => {
  appointmentDoc = apptDoc({ status: "confirmed" });
  assert.equal((await call(reopenAppointment, adminReq)).status, 400);
  appointmentDoc = apptDoc({ status: "complete", doctorId: null });
  assert.equal((await call(reopenAppointment, adminReq)).status, 400);
  assert.equal(updates.length, 0);
});

test("reopen: category consultation -> Confirmed; conflicts checked for a concrete slot", async () => {
  appointmentDoc = null;
  categoryDoc = catDoc({ status: "Completed" });
  const ok = await call(reopenAppointment, adminReq);
  assert.equal(ok.status, 200);
  assert.equal(updates[0].model, "CategoryConsultation");
  assert.equal(updates[0].update.$set.status, "Confirmed");
  assert.equal("sessionStarted" in updates[0].update.$set, false);

  updates.length = 0;
  conflictCategory = { _id: "other" };
  const blocked = await call(reopenAppointment, adminReq);
  assert.equal(blocked.status, 409);
  assert.equal(updates.length, 0);
});

test("reopen: a 'Next Available' category consultation has no concrete slot to conflict with", async () => {
  appointmentDoc = null;
  categoryDoc = catDoc({ status: "Completed", assignedSlot: "" });
  conflictCategory = { _id: "other" };
  conflictAppointment = { _id: "other" };
  assert.equal((await call(reopenAppointment, adminReq)).status, 200);
});

// ── prescriptions / certificates ───────────────────────────────────────────

let created;
const stubMedicalModels = () => {
  created = { prescriptions: 0, certificates: 0 };
  Prescription.create = async () => {
    created.prescriptions += 1;
    return { _id: "rx1", toObject() { return { _id: "rx1" }; } };
  };
  MedicalCertificate.create = async () => {
    created.certificates += 1;
    return { _id: "mc1", toObject() { return { _id: "mc1" }; } };
  };
};
const rxReq = (body = {}) => ({
  user: { id: DOCTOR_ID, role: "doctor" },
  body: { appointmentId: APPT_ID, diagnosis: "Flu", medicines: [{ name: "Para" }], ...body },
});

test("prescription with completeOnSave completes an assigned/confirmed appointment", async () => {
  stubMedicalModels();
  accessResult = { _id: APPT_ID, patientId: PATIENT_ID, status: "confirmed" };
  const out = await call(createPrescription, rxReq({ completeOnSave: true }));
  assert.equal(out.status, 201);
  assert.equal(out.body.appointmentCompleted, true);
  assert.equal(out.body.completionFailed, false);
  assert.equal(updates[0].update.$set.status, "complete");
  assert.ok(pushes.some((p) => p.title === "Appointment completed"));
});

test("prescription without the flag (e.g. saved inside a video call) does not complete or evict", async () => {
  stubMedicalModels();
  accessResult = { _id: APPT_ID, patientId: PATIENT_ID, status: "confirmed" };
  const out = await call(createPrescription, rxReq());
  assert.equal(out.status, 201);
  assert.equal(out.body.appointmentCompleted, false);
  assert.equal(updates.length, 0);
  assert.equal(evicted.length, 0);
});

test("a second prescription on an already-complete appointment is allowed and changes nothing", async () => {
  stubMedicalModels();
  accessResult = { _id: APPT_ID, patientId: PATIENT_ID, status: "complete" };
  const out = await call(createPrescription, rxReq({ completeOnSave: true }));
  assert.equal(out.status, 201);
  assert.equal(created.prescriptions, 1);
  assert.equal(out.body.appointmentCompleted, false);
  assert.equal(updates.length, 0);
});

test("completion failure still returns the saved prescription, flagged", async () => {
  stubMedicalModels();
  accessResult = { _id: APPT_ID, patientId: PATIENT_ID, status: "confirmed" };
  Appointment.findOneAndUpdate = async () => { throw new Error("db down"); };
  const out = await call(createPrescription, rxReq({ completeOnSave: true }));
  assert.equal(out.status, 201);
  assert.equal(created.prescriptions, 1);
  assert.equal(out.body.completionFailed, true);
});

test("prescriptions and certificates are refused for cancelled appointments", async () => {
  stubMedicalModels();
  accessResult = { _id: APPT_ID, patientId: PATIENT_ID, status: "cancelled" };
  assert.equal((await call(createPrescription, rxReq({ completeOnSave: true }))).status, 400);
  assert.equal((await call(createMedicalCertificate, rxReq())).status, 400);
  assert.equal(created.prescriptions + created.certificates, 0);
  const catCancelled = { _id: APPT_ID, patientId: PATIENT_ID, status: "Cancelled" };
  accessResult = catCancelled;
  assert.equal((await call(createPrescription, rxReq())).status, 400);
});

test("a certificate alone never completes the appointment", async () => {
  stubMedicalModels();
  accessResult = { _id: APPT_ID, patientId: PATIENT_ID, status: "confirmed" };
  const out = await call(createMedicalCertificate, rxReq({ completeOnSave: true }));
  assert.equal(out.status, 201);
  assert.equal(created.certificates, 1);
  assert.equal(updates.length, 0);
});

test("prescriptions and certificates still work for completed appointments (My Patients)", async () => {
  stubMedicalModels();
  accessResult = { _id: APPT_ID, patientId: PATIENT_ID, status: "complete" };
  assert.equal((await call(createPrescription, rxReq())).status, 201);
  assert.equal((await call(createMedicalCertificate, rxReq())).status, 201);
});

// ── change-doctor on a completed appointment ───────────────────────────────

test("change-doctor is blocked on a completed appointment (must reopen first), even for the same doctor", async () => {
  let saved = false;
  appointmentDoc = { ...apptDoc({ status: "complete" }), save: async () => { saved = true; } };
  const out = await call(reassignAppointmentDoctor, { ...adminReq, body: { doctorId: 12345 } });
  assert.equal(out.status, 409);
  assert.match(out.body.msg, /Reopen it before changing the doctor/);
  assert.equal(saved, false);
  assert.equal(events.length, 0);
});

// ── legacy PATCH /category-consultation/:id/status ─────────────────────────

const statusReq = (status) => ({ ...adminReq, body: { status } });
const stubConsultation = (status) => {
  const consultation = { status, saves: 0, async save() { this.saves += 1; } };
  CategoryConsultation.findById = async () => consultation;
  return consultation;
};

test("status endpoint: invalid values are rejected", async () => {
  const consultation = stubConsultation("Pending");
  const out = await call(updateCategoryConsultationStatus, statusReq("banana"));
  assert.equal(out.status, 400);
  assert.match(out.body.message, /Allowed values/);
  assert.equal(consultation.saves, 0);
});

test("status endpoint: completing is refused in favour of the new Complete endpoint", async () => {
  const consultation = stubConsultation("Confirmed");
  for (const value of ["Completed", "complete", "COMPLETED"]) {
    const out = await call(updateCategoryConsultationStatus, statusReq(value));
    assert.equal(out.status, 400);
    assert.match(out.body.message, /admin-complete/);
  }
  assert.equal(consultation.saves, 0);
  assert.equal(consultation.status, "Confirmed");
});

test("status endpoint: a completed consultation can't be changed here (reopen first)", async () => {
  const consultation = stubConsultation("Completed");
  const out = await call(updateCategoryConsultationStatus, statusReq("Confirmed"));
  assert.equal(out.status, 409);
  assert.match(out.body.message, /reopen/i);
  assert.equal(consultation.saves, 0);
  assert.equal(consultation.status, "Completed");
});

test("status endpoint: valid values still work, case-insensitively, saved in canonical form", async () => {
  const consultation = stubConsultation("Pending");
  const out = await call(updateCategoryConsultationStatus, statusReq("cancelled"));
  assert.equal(out.status, 200);
  assert.equal(consultation.status, "Cancelled");
  assert.equal(consultation.saves, 1);
});

// ── category assign-doctor on a completed consultation ─────────────────────

test("category assign-doctor is blocked on a Completed consultation (reopen first)", async () => {
  let updated = false;
  CategoryConsultation.findById = () => lean({ appointmentType: "NEXT_AVAILABLE", assignedDoctorId: ENROLLMENT_ID, status: "Completed" });
  CategoryConsultation.findOneAndUpdate = async () => { updated = true; return null; };
  const out = await call(assignDoctor, { ...adminReq, body: { doctorId: ENROLLMENT_ID } });
  assert.equal(out.status, 409);
  assert.match(out.body.message, /Reopen it before changing the doctor/);
  assert.equal(updated, false);
});

test("category assign-doctor still works for non-completed consultations", async () => {
  require("../models/Enrollment").findById = async () => ({ _id: ENROLLMENT_ID, firstName: "Nina", surname: "Shah" });
  CategoryConsultation.findById = () => lean({ appointmentType: "FLEXIBLE_TIME", assignedDoctorId: null, status: "Pending" });
  CategoryConsultation.findOneAndUpdate = async () => ({ _id: APPT_ID, patientId: PATIENT_ID });
  const out = await call(assignDoctor, { ...adminReq, body: { doctorId: ENROLLMENT_ID } });
  assert.equal(out.status, 200);
  assert.equal(out.body.success, true);
});
