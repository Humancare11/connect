const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

// The email the patient gets when an admin assigns or changes the doctor
// (notifyPatientDoctorChanged, used by the admin bookings actions). These checks were written for the old
// change-doctor controller, which sent the same email inline, and carry over: the layout, the wording, escaping,
// and "never invent a date, a doctor or a link".
const mailer = require("../utils/sendEmail");
const sent = [];
let sendImpl;
mailer.sendEmail = async (args) => {
  sent.push(args);
  return sendImpl(args);
};

const User = require("../models/User");
const { notifyPatientDoctorChanged } = require("../utils/bookingNotifications");

const PATIENT_ID = "64b0000000000000000000a1";

const chain = (value) => {
  const q = { select: () => q, lean: async () => value };
  return q;
};

let patientDoc;
test.beforeEach(() => {
  sent.length = 0;
  sendImpl = async () => {};
  patientDoc = { name: "Priya Sharma", email: "priya@example.com" };
  User.findById = () => chain(patientDoc);
});

const booking = (over = {}) => ({
  _id: "64b000000000000000000001",
  patientId: PATIENT_ID,
  date: "2030-01-15",
  time: "10:00 AM",
  appointmentDateTimeUtc: new Date("2030-01-15T10:00:00Z"),
  patientTimezone: "Asia/Kolkata",
  ...over,
});
const send = (over = {}, args = {}) =>
  notifyPatientDoctorChanged({ booking: booking(over), isCategory: false, doctorName: "Meera Rao", reassigned: false, ...args });

const ASSIGNED_TEXT = "A doctor has been assigned to your appointment. We will let you know once they have confirmed.";
const REASSIGN_TEXT =
  "Your assigned doctor has changed due to unavailability. Your appointment time remains the same, and a new doctor has been assigned to ensure you receive the best care.";

test("new assignment: branded email to the patient, saying the doctor still has to confirm", async () => {
  await send();
  assert.equal(sent.length, 1);
  const mail = sent[0];
  assert.equal(mail.to, "priya@example.com");
  assert.equal(mail.subject, "A doctor has been assigned to your appointment — Humancare Connect");
  assert.equal(mail.text, ASSIGNED_TEXT);
  assert.match(mail.html, /logo-email\.png/);
  assert.match(mail.html, /logo-footer\.png/);
  assert.match(mail.html, />Doctor Assigned</);
  assert.match(mail.html, /Hello Priya Sharma,/);
  assert.match(mail.html, /Dr\. Meera Rao/);
  assert.match(mail.html, /Jan 15, 2030/);
  assert.match(mail.html, /support@humancareconnect\.co/);
  assert.doesNotMatch(mail.html + mail.text, /has been confirmed|contacted shortly/);
  assert.ok(mail.html.includes(mail.text), "HTML intro matches the plain text");
  assert.doesNotMatch(mail.html, /Invoice|Payment|Amount/);
  assert.doesNotMatch(mail.html, /<a [^>]*href="[^"]*(meet|join|call)/i, "no invented meeting link");
});

test("reassignment: keeps the reassignment subject and plain text", async () => {
  await send({}, { reassigned: true });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].subject, "Appointment update — Doctor reassigned");
  assert.equal(sent[0].text, REASSIGN_TEXT);
  assert.match(sent[0].html, />Doctor Reassigned</);
  assert.ok(sent[0].html.includes(sent[0].text), "HTML intro matches the plain text");
  assert.match(sent[0].html, /Dr\. Meera Rao/);
});

test("a category booking shows its own date and time", async () => {
  await notifyPatientDoctorChanged({
    booking: { _id: "c1", patientId: PATIENT_ID, date: "2030-02-03", appointmentType: "FLEXIBLE_TIME", slot: "05:30 PM" },
    isCategory: true,
    doctorName: "Meera Rao",
    reassigned: false,
  });
  assert.equal(sent.length, 1);
  assert.match(sent[0].html, /2030-02-03 05:30 PM/);
});

test("a doctor name that already starts with Dr. is not prefixed twice", async () => {
  await send({}, { doctorName: "Dr. Meera Rao" });
  assert.match(sent[0].html, /Dr\. Meera Rao/);
  assert.doesNotMatch(sent[0].html, /Dr\. Dr\./);
});

test("patient without an email: nothing is sent", async () => {
  patientDoc = { name: "Priya Sharma", email: "" };
  await send();
  assert.equal(sent.length, 0);
});

test("send failure is swallowed: the notifier resolves and never throws", async () => {
  sendImpl = async () => {
    throw new Error("SMTP down");
  };
  const logged = console.error;
  console.error = () => {};
  try {
    await assert.doesNotReject(send({}, { reassigned: true }));
  } finally {
    console.error = logged;
  }
  assert.equal(sent.length, 1);
});

test("dynamic content is HTML-escaped", async () => {
  patientDoc = { name: `<script>alert(1)</script> & "Co"`, email: "p@example.com" };
  await send({}, { doctorName: "<img src=x onerror=1>" });
  const { html } = sent[0];
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; &quot;Co&quot;/);
  assert.match(html, /Dr\. &lt;img src=x onerror=1&gt;/);
});

test("missing appointment date/time omits the Date / time row (never invented)", async () => {
  await send({ date: "", time: "", appointmentDateTimeUtc: null, patientTimezone: "" });
  assert.equal(sent.length, 1);
  assert.doesNotMatch(sent[0].html, /Date \/ time/);
  assert.match(sent[0].html, />Doctor</);
});

test("invalid UTC value falls back to stored date/time strings", async () => {
  await send({ appointmentDateTimeUtc: "not-a-date", patientTimezone: "" });
  assert.match(sent[0].html, /2030-01-15 10:00 AM/);
  assert.doesNotMatch(sent[0].html, /Invalid Date|NaN/);
});

test("missing doctor name omits the Doctor row (never a bare 'Dr.')", async () => {
  await send({}, { doctorName: "" });
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
