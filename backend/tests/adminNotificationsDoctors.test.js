const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

// Mocked mail provider, installed BEFORE the routes load. No real email is ever sent;
// it is also the test-only channel for reading the registration OTP.
const mailer = require("../utils/sendEmail");
const mails = [];
mailer.sendOTPEmail = async (to, code, type) => {
  mails.push({ kind: type, to, code });
};

const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const Session = require("../models/Session");
const OTP = require("../models/OTP");
const AdminNotification = require("../models/AdminNotification");
const { notifyAdminDoctorRegistered, notifyAdminEnrollmentSubmitted } = require("../utils/adminNotifications");

const PASSWORD = "Passw0rd!x";
let seq = 0;
let EMAIL = "";
const nextEmail = () => `new.doctor${++seq}@example.com`;
let mongod;
let server;
let base;

async function call(method, path, { body, token } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, body: json };
}

// The notification is fire-and-forget after the response, so wait for it to settle.
const settle = () => new Promise((r) => setTimeout(r, 150));
const notifications = async (type) => AdminNotification.find(type ? { type } : {}).lean();

async function register(email = EMAIL, name = "Jane Roe") {
  if (!email) email = EMAIL = nextEmail();
  await call("POST", "/api/doctor/send-register-otp", { body: { email, name } });
  const otp = [...mails].reverse().find((m) => m.to === email)?.code;
  const res = await call("POST", "/api/doctor/register", {
    body: { name, email, password: PASSWORD, confirmPassword: PASSWORD, otp },
  });
  return { ...res, otp };
}

// Replaces AdminNotification.create (what the helper uses) so the database write fails.
async function withBrokenNotifications(fn) {
  const original = AdminNotification.create;
  const warn = console.warn;
  AdminNotification.create = async () => { throw new Error("notification db down"); };
  console.warn = () => {};
  try { return await fn(); } finally {
    AdminNotification.create = original;
    console.warn = warn;
  }
}

describe("admin notifications for doctor registration and enrollment (real routes, in-memory MongoDB)", () => {
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Doctor.init();
    await AdminNotification.init();
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use("/api/doctor", require("../routes/doctorAuth"));
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await Promise.all([Doctor.deleteMany({}), Enrollment.deleteMany({}), Session.deleteMany({}), OTP.deleteMany({}), AdminNotification.deleteMany({})]);
    mails.length = 0;
    EMAIL = nextEmail();
  });

  describe("registration", () => {
    test("creates one notification linking to the new enrollment, with no sensitive data", async () => {
      const res = await register();
      assert.equal(res.status, 201);
      assert.equal(res.body.message, "Doctor registered successfully.");
      assert.equal(res.body.doctor.email, EMAIL, "response unchanged");
      assert.ok(res.body.accessToken, "tokens still returned");

      await settle();
      const doctor = await Doctor.findOne({ email: EMAIL }).lean();
      const enrollment = await Enrollment.findOne({ doctorId: doctor._id }).lean();
      const all = await notifications();
      assert.equal(all.length, 1);
      const [n] = all;
      assert.equal(n.type, "doctor_registered");
      assert.equal(n.title, "New doctor registered");
      assert.equal(n.refType, "doctor");
      assert.equal(n.refId, String(doctor._id));
      assert.equal(n.dedupeKey, `doctor_registered:${doctor._id}`);
      assert.equal(n.link, `/admin-dashboard/doctor-profile/${enrollment._id}`);
      assert.equal(n.message, "Jane Roe created an account. Enrollment form not submitted yet.");
      const text = JSON.stringify(n);
      for (const secret of [EMAIL, PASSWORD, res.otp, res.body.accessToken, "password"]) {
        assert.ok(!text.includes(secret), `leaked ${secret}`);
      }
    });

    test("failed registrations create no notification (bad OTP, duplicate email, validation)", async () => {
      await call("POST", "/api/doctor/send-register-otp", { body: { email: EMAIL, name: "Jane Roe" } });
      const bad = await call("POST", "/api/doctor/register", {
        body: { name: "Jane Roe", email: EMAIL, password: PASSWORD, confirmPassword: PASSWORD, otp: "000000" },
      });
      assert.equal(bad.status, 400);
      const missing = await call("POST", "/api/doctor/register", { body: { email: EMAIL } });
      assert.equal(missing.status, 400);
      await settle();
      assert.equal((await notifications()).length, 0);

      assert.equal((await register()).status, 201);
      await settle();
      assert.equal((await notifications()).length, 1);
      const dup = await register();
      assert.equal(dup.status, 409);
      await settle();
      assert.equal((await notifications()).length, 1, "duplicate registration adds nothing");
    });

    test("a notification database failure does not change the successful registration", async () => {
      const res = await withBrokenNotifications(async () => {
        const r = await register();
        await settle();
        return r;
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.message, "Doctor registered successfully.");
      assert.ok(await Doctor.findOne({ email: EMAIL }));
      assert.ok(await Enrollment.findOne({ email: EMAIL }));
      assert.equal((await notifications()).length, 0);
    });

    test("the same doctor is never notified twice", async () => {
      await register();
      await settle();
      const doctor = await Doctor.findOne({ email: EMAIL }).lean();
      const enrollment = await Enrollment.findOne({ doctorId: doctor._id }).lean();
      assert.equal((await notifyAdminDoctorRegistered({ doctor, enrollment })).status, "deduplicated");
      assert.equal((await notifications()).length, 1);
    });
  });

  describe("enrollment submission", () => {
    const submit = (token, doctorId, extra = {}) =>
      call("POST", "/api/doctor/enrollment", {
        token,
        body: { doctorId: String(doctorId), zip: "10001", firstName: "Jane", surname: "Roe", specialization: "Cardiology", ...extra },
      });
    const registered = async () => {
      const res = await register();
      await settle();
      await AdminNotification.deleteMany({});
      return { token: res.body.accessToken, doctorId: res.body.doctor.id };
    };

    test("first submission creates one notification for the enrollment", async () => {
      const { token, doctorId } = await registered();
      const res = await submit(token, doctorId);
      assert.equal(res.status, 201);
      assert.equal(res.body.message, "Enrollment submitted successfully", "response unchanged");
      await settle();

      const enrollment = await Enrollment.findOne({ doctorId }).lean();
      assert.equal(enrollment.formCompleted, true);
      assert.equal(enrollment.approvalStatus, "pending");
      const all = await notifications();
      assert.equal(all.length, 1);
      const [n] = all;
      assert.equal(n.type, "doctor_enrollment_submitted");
      assert.equal(n.title, "Doctor enrollment submitted");
      assert.equal(n.refType, "enrollment");
      assert.equal(n.refId, String(enrollment._id));
      assert.equal(n.dedupeKey, `doctor_enrollment_submitted:${enrollment._id}`);
      assert.equal(n.link, `/admin-dashboard/doctor-profile/${enrollment._id}`);
      assert.equal(n.message, "Jane Roe · Cardiology submitted an application for review.");
      assert.ok(!JSON.stringify(n).includes(EMAIL));
      assert.ok(!JSON.stringify(n).includes("10001"), "no address data");
    });

    test("saving again while still pending does not notify again", async () => {
      const { token, doctorId } = await registered();
      await submit(token, doctorId);
      await settle();
      assert.equal((await submit(token, doctorId, { specialization: "Neurology" })).status, 201);
      await settle();
      assert.equal((await notifications()).length, 1);
    });

    test("a rejected submission that fails validation creates no notification", async () => {
      const { token, doctorId } = await registered();
      const noZip = await submit(token, doctorId, { zip: "" });
      assert.equal(noZip.status, 400);
      const wrongDoctor = await call("POST", "/api/doctor/enrollment", { token, body: { doctorId: String(new mongoose.Types.ObjectId()), zip: "1" } });
      assert.equal(wrongDoctor.status, 403);
      const noToken = await call("POST", "/api/doctor/enrollment", { body: { doctorId: String(doctorId), zip: "1" } });
      assert.equal(noToken.status, 401);
      await settle();
      assert.equal((await notifications()).length, 0);
      assert.equal((await Enrollment.findOne({ doctorId }).lean()).formCompleted, false, "nothing was submitted");
    });

    test("an approved doctor's profile update is not an enrollment submission (it raises a profile-update alert instead)", async () => {
      const { token, doctorId } = await registered();
      await Enrollment.updateOne({ doctorId }, { approvalStatus: "approved", verified: true, formCompleted: true, pendingRequestType: "none", specialization: "Cardiology", zip: "10001" });
      const res = await submit(token, doctorId, { specialization: "Neurology" });
      assert.equal(res.status, 201);
      assert.match(res.body.message, /Update request submitted/);
      const same = await submit(token, doctorId, { specialization: "Cardiology" });
      await settle();
      assert.equal((await Enrollment.findOne({ doctorId }).lean()).pendingRequestType, "profile_update");
      assert.equal((await notifications("doctor_enrollment_submitted")).length, 0);
      assert.equal((await notifications("doctor_profile_updated")).length, 1);
      assert.ok(same.status === 200 || same.status === 201);
    });

    test("a rejected doctor who resubmits is notified once, separately from the first submission", async () => {
      const { token, doctorId } = await registered();
      await submit(token, doctorId);
      await settle();
      const first = await Enrollment.findOne({ doctorId });
      await Enrollment.updateOne({ _id: first._id }, { approvalStatus: "rejected", verified: false, applicationStatus: "Rejected" });
      const rejectedAt = (await Enrollment.findById(first._id).lean()).updatedAt.getTime();

      const res = await submit(token, doctorId, { specialization: "Cardiology" });
      assert.equal(res.status, 201);
      assert.match(res.body.message, /resubmitted and pending admin review/);
      await settle();
      await submit(token, doctorId); // now pending again: a plain re-save
      await settle();

      const all = (await notifications()).sort((a, b) => a.createdAt - b.createdAt);
      assert.equal(all.length, 2);
      assert.equal(all[0].dedupeKey, `doctor_enrollment_submitted:${first._id}`);
      assert.equal(all[1].title, "Doctor enrollment resubmitted");
      assert.equal(all[1].dedupeKey, `doctor_enrollment_submitted:${first._id}:resubmitted:${rejectedAt}`);
      assert.match(all[1].message, /resubmitted the application after rejection\.$/);
    });

    test("a notification database failure does not change the successful submission", async () => {
      const { token, doctorId } = await registered();
      const res = await withBrokenNotifications(async () => {
        const r = await submit(token, doctorId);
        await settle();
        return r;
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.message, "Enrollment submitted successfully");
      assert.equal((await Enrollment.findOne({ doctorId }).lean()).formCompleted, true);
      assert.equal((await notifications()).length, 0);
    });

    test("the helper deduplicates a repeated first-submission call", async () => {
      const { token, doctorId } = await registered();
      await submit(token, doctorId);
      await settle();
      const enrollment = await Enrollment.findOne({ doctorId }).lean();
      assert.equal((await notifyAdminEnrollmentSubmitted({ enrollment })).status, "deduplicated");
      assert.equal((await notifications()).length, 1);
    });
  });

  test("control characters in a name cannot reach the notification text", async () => {
    const res = await notifyAdminDoctorRegistered({
      doctor: { _id: new mongoose.Types.ObjectId(), name: "Eve\n\tEvil   Name" },
      enrollment: { _id: new mongoose.Types.ObjectId() },
    });
    assert.equal(res.status, "created");
    assert.equal((await notifications())[0].message, "Eve Evil Name created an account. Enrollment form not submitted yet.");
  });
});
