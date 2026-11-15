const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const Session = require("../models/Session");
const User = require("../models/User");
const { signAccessToken } = require("../middleware/verifyToken");

const PRIVATE = ["email", "phoneNumber", "countryCode", "mongoId", "medicalRegistrationNumber", "internationalLicenses"];

describe("GET /api/doctor/approved: contact details are admin-only", () => {
  let mongod, server, base;

  const tokenFor = async (role) => {
    const user = await User.create({ name: role, email: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.co`, password: "x", role });
    const session = await Session.create({ userId: String(user._id), role, expiresAt: new Date(Date.now() + 3600e3) });
    return signAccessToken(user, session._id);
  };
  const get = async (headers = {}) => {
    const res = await fetch(`${base}/api/doctor/approved`, { headers });
    return { status: res.status, body: await res.json() };
  };

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    const doctor = await Doctor.create({ name: "Asha Rao", email: "account@example.com", password: "Passw0rd!x" });
    await Enrollment.create({
      doctorId: doctor._id, firstName: "Asha", surname: "Rao", email: "asha.enroll@example.com",
      countryCode: "+91", phoneNumber: "98765 43210", approvalStatus: "approved", specialization: "Cardiology",
    });
    // No enrollment email: falls back to the doctor account email, like the Our Doctors page.
    const second = await Doctor.create({ name: "Ben Lee", email: "ben.account@example.com", password: "Passw0rd!x" });
    await Enrollment.create({ doctorId: second._id, firstName: "Ben", surname: "Lee", approvalStatus: "approved" });
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use("/api/doctor", require("../routes/doctorAuth"));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await mongod.stop();
  });

  const assertNoPrivate = (doctors) => {
    assert.equal(doctors.length, 2);
    for (const d of doctors) for (const f of PRIVATE) assert.ok(!(f in d), `${f} must not be public`);
    assert.ok(!JSON.stringify(doctors).match(/example\.com|98765/), "no email or phone anywhere in the body");
  };

  test("an anonymous caller gets neither email nor phone", async () => {
    const res = await get();
    assert.equal(res.status, 200);
    assertNoPrivate(res.body);
    assert.equal(res.body[0].specialty !== undefined, true, "public fields still present");
  });

  test("a patient (bearer token or cookie) gets neither email nor phone", async () => {
    const token = await tokenFor("user");
    assertNoPrivate((await get({ authorization: `Bearer ${token}` })).body);
    assertNoPrivate((await get({ cookie: `adminToken=${token}` })).body);
  });

  test("a doctor session gets neither email nor phone", async () => {
    const token = await tokenFor("doctor");
    assertNoPrivate((await get({ authorization: `Bearer ${token}` })).body);
  });

  test("an admin and a superadmin get email, country code and phone", async () => {
    for (const role of ["admin", "superadmin"]) {
      const token = await tokenFor(role);
      const res = await get({ cookie: `adminToken=${token}` });
      assert.equal(res.status, 200);
      const asha = res.body.find((d) => d.name.includes("Asha"));
      assert.equal(asha.email, "asha.enroll@example.com");
      assert.equal(asha.countryCode, "+91");
      assert.equal(asha.phoneNumber, "98765 43210");
      assert.equal(res.body.find((d) => d.name.includes("Ben")).email, "ben.account@example.com", "falls back to the account email");
    }
  });

  test("a revoked admin session is treated as anonymous", async () => {
    const token = await tokenFor("admin");
    await Session.updateMany({ role: "admin" }, { revokedAt: new Date() });
    assertNoPrivate((await get({ cookie: `adminToken=${token}` })).body);
  });
});
