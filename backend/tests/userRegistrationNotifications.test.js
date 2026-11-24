const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

const mailer = require("../utils/sendEmail");
const sent = [];
let failFor = null;
mailer.sendBookingNotificationEmail = async (to, payload) => {
  if (to === failFor) throw new Error("smtp down");
  sent.push({ to, ...payload });
};

const User = require("../models/User");
const chain = (value) => ({ select: () => ({ lean: async () => value }) });
let admins = [];
let lookupFails = false;
User.find = () => {
  if (lookupFails) throw new Error("db down");
  return chain(admins);
};

const { notifyAdminsByEmailUserRegistered } = require("../utils/userRegistrationNotifications");

const USER = { _id: "64b000000000000000000001", name: "Priya Sharma", email: "priya@example.com", mobile: "9999999999", country: "India", signupMethod: "email", createdAt: new Date("2026-11-24T10:12:00Z") };

test.beforeEach(() => {
  sent.length = 0;
  failFor = null;
  lookupFails = false;
  delete process.env.ADMIN_REGISTRATION_EMAIL;
  admins = [{ email: "A@x.com" }, { email: "a@x.com" }, { email: "b@x.com" }, { email: "" }, { email: "nope" }];
});

test("sends one email per unique admin address with the agreed content", async () => {
  await notifyAdminsByEmailUserRegistered({ user: USER });
  assert.deepEqual(sent.map((m) => m.to).sort(), ["a@x.com", "b@x.com"]);
  const m = sent[0];
  assert.equal(m.subject, "New patient registered: Priya Sharma");
  const flat = JSON.stringify(m.rows);
  assert.match(flat, /priya@example\.com/);
  assert.match(flat, /Email/);
  assert.match(flat, /IST|Asia\/Kolkata|\+5:30/);
  assert.ok(!flat.includes("9999999999") && !flat.includes("India"), "no mobile or country");
  assert.equal(m.ctaUrl.endsWith("/admin-dashboard/manage-users/64b000000000000000000001"), true);
});

test("Google signups are labelled Google", async () => {
  await notifyAdminsByEmailUserRegistered({ user: { ...USER, signupMethod: "google" } });
  assert.match(JSON.stringify(sent[0].rows), /Google/);
});

test("a hostile name cannot break the subject", async () => {
  await notifyAdminsByEmailUserRegistered({ user: { ...USER, name: "Eve\r\nBcc: x@y.com" + "z".repeat(200) } });
  assert.ok(!/[\r\n]/.test(sent[0].subject));
  assert.ok(sent[0].subject.length < 120);
});

test("ADMIN_REGISTRATION_EMAIL=false sends nothing; empty means on", async () => {
  process.env.ADMIN_REGISTRATION_EMAIL = "false";
  await notifyAdminsByEmailUserRegistered({ user: USER });
  assert.equal(sent.length, 0);
  process.env.ADMIN_REGISTRATION_EMAIL = "";
  await notifyAdminsByEmailUserRegistered({ user: USER });
  assert.equal(sent.length, 2);
});

test("one failing send does not stop the others, and nothing throws", async () => {
  failFor = "a@x.com";
  await notifyAdminsByEmailUserRegistered({ user: USER });
  assert.deepEqual(sent.map((m) => m.to), ["b@x.com"]);
});

test("never throws when the admin lookup fails or the user is missing", async () => {
  lookupFails = true;
  await notifyAdminsByEmailUserRegistered({ user: USER });
  await notifyAdminsByEmailUserRegistered({});
  await notifyAdminsByEmailUserRegistered();
  assert.equal(sent.length, 0);
});

test("no admins means no emails", async () => {
  admins = [];
  await notifyAdminsByEmailUserRegistered({ user: USER });
  assert.equal(sent.length, 0);
});
