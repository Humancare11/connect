const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

// Seams replaced BEFORE the controller is required (it destructures these at load).
const mailer = require("../utils/sendEmail");
const sent = [];
let sendImpl;
mailer.sendEmail = async (args) => {
  sent.push(args);
  return sendImpl(args);
};

const doctorChangeCalls = [];
require("../utils/bookingNotifications").notifyAppointmentDoctorChanged = (args) => {
  doctorChangeCalls.push(args);
  return Promise.resolve();
};
require("../utils/pushNotifications").sendPushToUser = () => {};

const Appointment = require("../models/Appointment");
const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const User = require("../models/User");
const { reassignAppointmentDoctor } = require("../controllers/appointmentController");

const APPT_ID = "64b000000000000000000001";
const OLD_DOCTOR = "64b0000000000000000000d1";
const NEW_DOCTOR = "64b0000000000000000000d2";
const PATIENT_ID = "64b0000000000000000000a1";
const ADMIN_ID = "64b0000000000000000000b1";

const events = [];
const makeApp = () => ({
  get(name) {
    if (name === "io") {
      return { to: (room) => ({ emit: (ev, payload) => events.push({ room, ev, payload }) }) };
    }
    return undefined;
  },
});

const chain = (value) => {
  const q = {
    select: () => q,
    populate: () => q,
    lean: async () => value,
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return q;
};

let appointmentDoc;
let patientDoc;
let saves;

const apptDoc = (over = {}) => ({
  _id: APPT_ID,
  patientId: PATIENT_ID,
  doctorId: OLD_DOCTOR,
  status: "confirmed",
  date: "2030-01-15",
  time: "10:00 AM",
  appointmentDateTimeUtc: new Date("2030-01-15T10:00:00Z"),
  patientTimezone: "Asia/Kolkata",
  async save() { saves += 1; },
  ...over,
});

test.beforeEach(() => {
  sent.length = 0;
  events.length = 0;
  doctorChangeCalls.length = 0;
  saves = 0;
  sendImpl = async () => {};
  appointmentDoc = apptDoc();
  patientDoc = { name: "Priya Sharma", email: "priya@example.com" };

  Appointment.findById = () => chain(appointmentDoc);
  Appointment.findOne = () => chain(null);
  Doctor.findOne = async () => ({ _id: NEW_DOCTOR, name: "Meera Rao", email: "meera@example.com" });
  Enrollment.findOne = () => chain({ timezone: "Asia/Kolkata" });
  User.findById = (id) =>
    String(id) === PATIENT_ID ? chain(patientDoc) : chain({ name: "Ada Admin", email: "ada@example.com" });
});

const call = async (body = { doctorId: 12345 }) => {
  const out = { status: 200, body: null };
  const res = { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; } };
  await reassignAppointmentDoctor(
    { app: makeApp(), params: { id: APPT_ID }, body, user: { id: ADMIN_ID, role: "admin" } },
    res
  );
  return out;
};

const NEW_TEXT =
  "Your appointment request has been reviewed and a doctor has been assigned to your appointment.";
const REASSIGN_TEXT =
  "Your assigned doctor has changed due to unavailability. Your appointment time remains the same, and a new doctor has been assigned to ensure you receive the best care.";

test("new assignment: branded email with unchanged recipient, subject and plain text", async () => {
  appointmentDoc = apptDoc({ status: "requested", doctorId: null });
  const out = await call();
  assert.equal(out.status, 200);
  assert.equal(out.body.msg, "Appointment confirmed and doctor assigned successfully.");
  assert.equal(sent.length, 1);
  const mail = sent[0];
  assert.equal(mail.to, "priya@example.com");
  assert.equal(mail.subject, "Your appointment has been confirmed — Humancare Connect");
  assert.equal(mail.text, NEW_TEXT);
  assert.match(mail.html, /logo-email\.png/);
  assert.match(mail.html, /logo-footer\.png/);
  assert.match(mail.html, />Doctor Assigned</);
  assert.match(mail.html, /Hello Priya Sharma,/);
  assert.match(mail.html, /Dr\. Meera Rao/);
  assert.match(mail.html, /Jan 15, 2030/);
  assert.match(mail.html, /support@humancareconnect\.co/);
  assert.doesNotMatch(mail.html, /contacted shortly/);
  assert.doesNotMatch(mail.text, /contacted shortly/);
  assert.ok(mail.html.includes(mail.text), "HTML intro matches the plain text");
  assert.doesNotMatch(mail.html, /Invoice|Payment|Amount/);
  assert.doesNotMatch(mail.html, /<a [^>]*href="[^"]*(meet|join|call)/i, "no invented meeting link");
});

test("reassignment: keeps the reassignment subject and plain text", async () => {
  const out = await call();
  assert.equal(out.status, 200);
  assert.equal(out.body.msg, "Doctor reassigned successfully.");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].subject, "Appointment update — Doctor reassigned");
  assert.equal(sent[0].text, REASSIGN_TEXT);
  assert.match(sent[0].html, />Doctor Reassigned</);
  assert.doesNotMatch(sent[0].html + sent[0].text, /contacted shortly/);
  assert.ok(sent[0].html.includes(sent[0].text), "HTML intro matches the plain text");
  assert.match(sent[0].html, /Dr\. Meera Rao/);
});

test("socket events and doctor notification are unchanged by the redesign", async () => {
  await call();
  assert.equal(doctorChangeCalls.length, 1);
  assert.deepEqual(
    events.map((e) => `${e.room}:${e.ev}`),
    [`patient_${PATIENT_ID}:appointment-updated`, "admin_room:appointment-updated", `doctor_${NEW_DOCTOR}:new-appointment`]
  );
});

test("unchanged doctor: no patient email and no doctor notification", async () => {
  appointmentDoc = apptDoc({ doctorId: NEW_DOCTOR });
  const out = await call();
  assert.equal(out.status, 200);
  assert.equal(out.body.msg, "Appointment already assigned to this doctor.");
  assert.equal(sent.length, 0);
  assert.equal(doctorChangeCalls.length, 0);
});

test("patient without an email: nothing is sent and the API still succeeds", async () => {
  patientDoc = { name: "Priya Sharma", email: "" };
  const out = await call();
  assert.equal(out.status, 200);
  assert.equal(sent.length, 0);
});

test("send failure is swallowed: API still returns 200 with the same body", async () => {
  sendImpl = async () => { throw new Error("SMTP down"); };
  const out = await call();
  assert.equal(out.status, 200);
  assert.equal(out.body.msg, "Doctor reassigned successfully.");
  assert.equal(sent.length, 1);
});

test("dynamic content is HTML-escaped", async () => {
  patientDoc = { name: `<script>alert(1)</script> & "Co"`, email: "p@example.com" };
  Doctor.findOne = async () => ({ _id: NEW_DOCTOR, name: `<img src=x onerror=1>`, email: "m@example.com" });
  await call();
  const { html } = sent[0];
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; &quot;Co&quot;/);
  assert.match(html, /Dr\. &lt;img src=x onerror=1&gt;/);
});

test("missing appointment date/time omits the Date / time row (never invented)", async () => {
  appointmentDoc = apptDoc({ date: "", time: "", appointmentDateTimeUtc: null, patientTimezone: "" });
  await call();
  assert.equal(sent.length, 1);
  assert.doesNotMatch(sent[0].html, /Date \/ time/);
  assert.match(sent[0].html, />Doctor</);
});

test("invalid UTC value falls back to stored date/time strings", async () => {
  appointmentDoc = apptDoc({ appointmentDateTimeUtc: "not-a-date", patientTimezone: "" });
  await call();
  assert.match(sent[0].html, /2030-01-15 10:00 AM/);
  assert.doesNotMatch(sent[0].html, /Invalid Date|NaN/);
});

test("missing doctor name omits the Doctor row", async () => {
  Doctor.findOne = async () => ({ _id: NEW_DOCTOR, name: "", email: "m@example.com" });
  await call();
  assert.doesNotMatch(sent[0].html, /Dr\./);
  assert.doesNotMatch(sent[0].html, /<td[^>]*>Doctor<\/td>/);
});

// ── shared helper: footnote is additive and opt-in ─────────────────────────

test("buildBookingNotificationHTML: output without footnote is unaffected; footnote is escaped", () => {
  const base = { badge: "New Booking", greeting: "Hello Admin,", intro: "Intro", rows: [["A", "B"]] };
  const plain = mailer.buildBookingNotificationHTML(base);
  assert.equal(mailer.buildBookingNotificationHTML({ ...base, footnote: "" }), plain);
  assert.equal(mailer.buildBookingNotificationHTML({ ...base, footnote: undefined }), plain);
  assert.doesNotMatch(plain, /margin:0;">/);
  const withNote = mailer.buildBookingNotificationHTML({ ...base, footnote: "<b>x</b>" });
  assert.match(withNote, /&lt;b&gt;x&lt;\/b&gt;/);
});
