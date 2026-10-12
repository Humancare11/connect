const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

// Replace the mailer and the Mongo lookups BEFORE the modules under test are
// required — the helpers read these through the module objects at call time.
const mailer = require("../utils/sendEmail");
const sent = [];
let mailFails = false;
let failFor = null; // address whose send should fail (others succeed)
mailer.sendBookingNotificationEmail = async (to, payload) => {
  if (mailFails || to === failFor) throw new Error("smtp down");
  sent.push({ to, ...payload });
};

const User = require("../models/User");
const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const CategoryConsultation = require("../models/CategoryConsultation");

// Query stand-in: awaitable directly (like `await Model.findById(x)`) and
// chainable through .select().lean().
const chain = (value) => ({
  then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  select: () => ({ lean: async () => value }),
  lean: async () => value,
});
const PATIENT = { _id: "p1", name: "Asha Rao", patientId: "HC-1001" };
User.findById = () => chain(PATIENT);
// Admin lookup: `adminUsers` is what the DB "returns"; `adminQueries` records
// the filter so the test can assert exactly which accounts are requested.
let adminUsers = [];
let adminLookupFails = false;
const adminQueries = [];
User.find = (filter) => {
  adminQueries.push(filter);
  if (adminLookupFails) throw new Error("db down");
  return chain(adminUsers);
};
const doctors = {
  d1: { _id: "d1", name: "Old Doc", email: "old@example.com" },
  d2: { _id: "d2", name: "New Doc", email: "new@example.com" },
};
Doctor.findById = (id) => chain(doctors[id] || null);
const enrollments = {};
Enrollment.findOne = () => chain({ timezone: "Asia/Kolkata" });
Enrollment.findById = (id) => chain(enrollments[id] || null);

const notify = require("../utils/bookingNotifications");
const { assignDoctor } = require("../controllers/CategoryConsultationController");

const appointment = {
  _id: "a1",
  patientId: "p1",
  date: "2030-01-15",
  time: "10:00 AM",
  appointmentDateTimeUtc: new Date("2030-01-15T10:00:00Z"),
  patientTimezone: "UTC",
  category: "General",
  specialty: "Cardiology",
  concern: "SECRET CONCERN",
};

test.beforeEach(() => {
  sent.length = 0;
  mailFails = false;
  failFor = null;
  adminLookupFails = false;
  adminQueries.length = 0;
  adminUsers = [{ email: "a1@example.com" }, { email: "a2@example.com" }];
});

test("direct booking: each admin gets a separate email, doctor gets one", async () => {
  await notify.notifyAppointmentBooked({ appointment, patient: PATIENT, doctor: doctors.d2 });
  assert.equal(sent.length, 3);
  assert.ok(sent.every((m) => !m.to.includes(",")), "no message addresses several people");
  assert.deepEqual(
    sent.filter((m) => m.to !== "new@example.com").map((m) => m.to).sort(),
    ["a1@example.com", "a2@example.com"]
  );
  const admin = sent.find((m) => m.to === "a1@example.com");
  assert.match(admin.subject, /New appointment booked \(Dr\. New Doc\)/);
  const doc = sent.find((m) => m.to === "new@example.com");
  assert.equal(doc.subject, "Humancare Connect — New appointment booked with you");
  assert.match(admin.ctaUrl, /\/admin-dashboard\/appointments\/a1$/);
});

test("emails carry minimal patient data only", async () => {
  await notify.notifyAppointmentBooked({ appointment, patient: PATIENT, doctor: doctors.d2 });
  const blob = JSON.stringify(sent);
  assert.match(blob, /Asha Rao \(ID HC-1001\)/);
  assert.doesNotMatch(blob, /SECRET CONCERN/);
});

test("category booking without a doctor: admin only, 'not assigned yet'", async () => {
  await notify.notifyAppointmentBooked({ appointment, patient: PATIENT, doctor: null });
  assert.equal(sent.length, 2); // one per admin
  assert.match(sent[0].subject, /New appointment request \(General\)/);
  assert.ok(sent[0].rows.some(([l, v]) => l === "Doctor" && /Not assigned/.test(v)));
});

test("admin lookup asks only for active admin/superadmin accounts with an email", async () => {
  await notify.notifyAppointmentBooked({ appointment, patient: PATIENT, doctor: null });
  assert.deepEqual(adminQueries[0], {
    role: { $in: ["admin", "superadmin"] },
    accountDisabled: { $ne: true },
    email: { $exists: true, $ne: "" },
  });
});

test("admin recipients are de-duplicated (case-insensitive) and blank/invalid emails dropped", async () => {
  adminUsers = [
    { email: "Boss@Example.com" },
    { email: "boss@example.com " },
    { email: "" },
    { email: "not-an-email" },
    { email: "second@example.com" },
  ];
  await notify.notifyAppointmentBooked({ appointment, patient: PATIENT, doctor: null });
  assert.deepEqual(sent.map((m) => m.to), ["boss@example.com", "second@example.com"]);
});

test("admins are looked up on every booking, so changes apply without a restart", async () => {
  await notify.notifyAppointmentBooked({ appointment, patient: PATIENT, doctor: null });
  adminUsers = [{ email: "newadmin@example.com" }];
  await notify.notifyAppointmentBooked({ appointment, patient: PATIENT, doctor: null });
  assert.equal(adminQueries.length, 2);
  assert.deepEqual(sent.map((m) => m.to), ["a1@example.com", "a2@example.com", "newadmin@example.com"]);
});

test("one admin's failed send is skipped; the other admins and the doctor still get theirs", async () => {
  failFor = "a1@example.com";
  await assert.doesNotReject(() =>
    notify.notifyAppointmentBooked({ appointment, patient: PATIENT, doctor: doctors.d2 })
  );
  assert.deepEqual(sent.map((m) => m.to).sort(), ["a2@example.com", "new@example.com"]);
});

test("no admin recipients: skips the admin email without throwing", async () => {
  adminUsers = [];
  await assert.doesNotReject(() =>
    notify.notifyAppointmentBooked({ appointment, patient: PATIENT, doctor: null })
  );
  assert.equal(sent.length, 0);
});

test("admin lookup failure never blocks the doctor email or rejects", async () => {
  adminLookupFails = true;
  await assert.doesNotReject(() =>
    notify.notifyAppointmentBooked({ appointment, patient: PATIENT, doctor: doctors.d2 })
  );
  assert.deepEqual(sent.map((m) => m.to), ["new@example.com"]);
});

test("first assignment emails only the new doctor", async () => {
  await notify.notifyAppointmentDoctorChanged({ appointment, newDoctor: doctors.d2, previousDoctorId: null });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].subject, "Humancare Connect — New case assigned to you");
  assert.equal(sent[0].to, "new@example.com");
});

test("reassignment emails the new doctor and the previous doctor (no patient name, no link)", async () => {
  await notify.notifyAppointmentDoctorChanged({ appointment, newDoctor: doctors.d2, previousDoctorId: "d1" });
  assert.equal(sent.length, 2);
  const next = sent.find((m) => m.to === "new@example.com");
  assert.equal(next.subject, "Humancare Connect — Case reassigned to you");
  const prev = sent.find((m) => m.to === "old@example.com");
  assert.equal(prev.subject, "Humancare Connect — Case no longer assigned to you");
  assert.doesNotMatch(JSON.stringify(prev), /Asha Rao/);
  assert.ok(!prev.ctaUrl);
});

test("doctor without an email is skipped, not an error", async () => {
  await notify.notifyAppointmentDoctorChanged({
    appointment,
    newDoctor: { _id: "d9", name: "No Mail", email: "" },
    previousDoctorId: null,
  });
  assert.equal(sent.length, 0);
});

test("a failing mailer never rejects", async () => {
  mailFails = true;
  await assert.doesNotReject(() =>
    notify.notifyAppointmentBooked({ appointment, patient: PATIENT, doctor: doctors.d2 })
  );
  await assert.doesNotReject(() =>
    notify.notifyAppointmentDoctorChanged({ appointment, newDoctor: doctors.d2, previousDoctorId: "d1" })
  );
});

test("whenText converts the UTC instant into the target timezone", () => {
  const out = notify._internals.whenText({
    date: "2030-01-15",
    time: "10:00 AM",
    utc: new Date("2030-01-15T10:00:00Z"),
    targetTimezone: "Asia/Kolkata",
  });
  assert.match(out, /3:30 PM/);
  assert.match(out, /Asia\/Kolkata/);
});

// ── category assignDoctor controller ───────────────────────────────────────
const call = async (handler, req) => {
  const out = { status: 200, body: null };
  const res = { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; } };
  await handler(req, res);
  return out;
};
const flush = () => new Promise((r) => setImmediate(r));

const setupAssign = (existing) => {
  enrollments.e2 = { _id: "e2", firstName: "Nina", surname: "Shah", email: "nina@example.com", doctorId: "d2" };
  enrollments.e1 = { _id: "e1", firstName: "Omar", surname: "Khan", email: "omar@example.com", doctorId: "d1" };
  CategoryConsultation.findById = () => chain(existing);
  Enrollment.findById = (id) => chain(enrollments[id] || null);
  CategoryConsultation.findOneAndUpdate = async () => ({
    _id: "c1",
    patientId: "p1",
    date: "2030-01-15",
    appointmentType: "NEXT_AVAILABLE",
    assignedSlot: "10:00 AM",
    categoryName: "General",
    specialtyName: "Cardiology",
  });
};

test("category assign: first assignment emails the doctor once", async () => {
  setupAssign({ appointmentType: "NEXT_AVAILABLE", assignedDoctorId: null });
  const out = await call(assignDoctor, { params: { id: "c1" }, body: { doctorId: "e2", appointmentTime: "10:00 AM" } });
  await flush();
  assert.equal(out.status, 200);
  assert.deepEqual(sent.map((m) => m.to), ["nina@example.com"]);
});

test("category assign: same doctor again sends nothing", async () => {
  setupAssign({ appointmentType: "NEXT_AVAILABLE", assignedDoctorId: "e2" });
  await call(assignDoctor, { params: { id: "c1" }, body: { doctorId: "e2" } });
  await flush();
  assert.equal(sent.length, 0);
});

test("category assign: a different doctor emails new + previous", async () => {
  setupAssign({ appointmentType: "NEXT_AVAILABLE", assignedDoctorId: "e1" });
  await call(assignDoctor, { params: { id: "c1" }, body: { doctorId: "e2" } });
  await flush();
  assert.deepEqual(sent.map((m) => m.to).sort(), ["nina@example.com", "omar@example.com"]);
});

test("category assign: a failing mailer does not fail the assignment", async () => {
  mailFails = true;
  setupAssign({ appointmentType: "NEXT_AVAILABLE", assignedDoctorId: "e1" });
  const out = await call(assignDoctor, { params: { id: "c1" }, body: { doctorId: "e2" } });
  await flush();
  assert.equal(out.status, 200);
  assert.equal(out.body.success, true);
});

// ── reopen email to the doctor ─────────────────────────────────────────────

test("reopen: the doctor gets one email with minimal details and a dashboard link", async () => {
  await notify.notifyDoctorAppointmentReopened({ appointment: { ...appointment, doctorId: "d2" }, isCategory: false });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "new@example.com");
  assert.equal(sent[0].subject, "Humancare Connect — Appointment reopened by admin");
  assert.match(sent[0].ctaUrl, /\/doctor-dashboard\/appointments$/);
  const blob = JSON.stringify(sent);
  assert.match(blob, /Asha Rao \(ID HC-1001\)/);
  assert.doesNotMatch(blob, /SECRET CONCERN/);
});

test("reopen email: category consultation uses the enrollment's email", async () => {
  const consultation = {
    _id: "c1",
    patientId: "p1",
    date: "2030-01-15",
    appointmentType: "NEXT_AVAILABLE",
    assignedSlot: "10:00 AM",
    categoryName: "General",
    assignedDoctorId: { firstName: "Nina", surname: "Shah", email: "nina@example.com", doctorId: "d2" },
  };
  await notify.notifyDoctorAppointmentReopened({ appointment: consultation, isCategory: true });
  assert.deepEqual(sent.map((m) => m.to), ["nina@example.com"]);
  assert.match(sent[0].greeting, /Nina Shah/);
});

test("reopen email: missing doctor email is skipped and a failing mailer never rejects", async () => {
  Doctor.findById = () => chain({ name: "No Mail", email: "" });
  await notify.notifyDoctorAppointmentReopened({ appointment: { ...appointment, doctorId: "d9" }, isCategory: false });
  assert.equal(sent.length, 0);
  Doctor.findById = (id) => chain(doctors[id] || null);
  mailFails = true;
  await assert.doesNotReject(() =>
    notify.notifyDoctorAppointmentReopened({ appointment: { ...appointment, doctorId: "d2" }, isCategory: false })
  );
});
