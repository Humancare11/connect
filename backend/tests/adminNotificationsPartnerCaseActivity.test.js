const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

const User = require("../models/User");
const Partner = require("../models/Partner");
const PartnerCase = require("../models/PartnerCase");
const Session = require("../models/Session");
const Counter = require("../models/Counter");
const AdminNotification = require("../models/AdminNotification");

// Real partner + auth routers over HTTP against an isolated in-memory MongoDB.
// No email is sent by this flow; nothing touches a shared database.
const PASSWORD = "Passw0rd!x";
let mongod, server, base, company, token, creator;

async function call(method, path, { body, token: t } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(t ? { authorization: `Bearer ${t}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, body: json };
}

const SECRET = {
  name: "Jane Patient", phone: "+15551234567", complaint: "severe chest pain since Tuesday",
  policy: "POLICY-998877", dob: "1980-02-03", address: "12 Private Lane",
};
const caseBody = (extra = {}) => ({
  serviceType: "teleconsultation",
  urgency: "urgent",
  patient: { name: SECRET.name, phone: SECRET.phone, complaint: SECRET.complaint, policyId: SECRET.policy, dob: SECRET.dob },
  location: { country: "Kenya", address: SECRET.address },
  ...extra,
});

const settle = () => new Promise((r) => setTimeout(r, 150));
const notifications = () => AdminNotification.find({}).lean();

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

describe("admin notifications for partner case activity: cancel and messages (real routes, in-memory MongoDB)", () => {
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await AdminNotification.init();
    await PartnerCase.init();
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use("/api/auth", require("../routes/auth"));
    app.use("/api/partner", require("../routes/partner"));
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
    await Promise.all([
      User.deleteMany({}), Partner.deleteMany({}), PartnerCase.deleteMany({}),
      Session.deleteMany({}), Counter.deleteMany({}), AdminNotification.deleteMany({}),
    ]);
    creator = new mongoose.Types.ObjectId();
    company = await Partner.create({
      partnerCode: "P-0001", companyName: "Acme Assist", slug: "acme-assist", status: "active", createdBy: creator,
    });
    await User.create({ name: "Pat Partner", email: "pat@acme.example", password: await bcrypt.hash(PASSWORD, 10), role: "partner", partner: company._id });
    const login = await call("POST", "/api/auth/partner-login", { body: { email: "pat@acme.example", password: PASSWORD } });
    assert.equal(login.status, 200, "partner login works in the test setup");
    token = login.body.accessToken;
    assert.ok(token);
  });

  const newCase = async () => {
    const res = await call("POST", "/api/partner/cases", { token, body: caseBody() });
    assert.equal(res.status, 201);
    await settle();
    await AdminNotification.deleteMany({}); // only the activity under test
    return res.body._id || String((await PartnerCase.findOne({}).lean())._id);
  };
  const activity = (type) => AdminNotification.find({ type }).lean();

  test("cancelling a submitted case creates one notification with no sensitive data", async () => {
    const id = await newCase();
    const res = await call("PATCH", `/api/partner/cases/${id}/cancel`, { token });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "cancelled", "response unchanged");
    await settle();
    const saved = await PartnerCase.findById(id).lean();
    const rows = await notifications();
    assert.equal(rows.length, 1);
    const [n] = rows;
    assert.equal(n.type, "partner_case_cancelled");
    assert.equal(n.title, "Partner case cancelled");
    assert.equal(n.message, `${saved.caseNumber} · Acme Assist · Cancelled by the partner`);
    assert.equal(n.refType, "partner_case");
    assert.equal(n.refId, id);
    assert.equal(n.link, `/admin-dashboard/partner-cases/${id}`);
    assert.equal(n.dedupeKey, `partner_case_cancelled:${id}`);
    assert.ok(AdminNotification.isInternalAdminLink(n.link));
    const text = JSON.stringify(rows);
    for (const v of [...Object.values(SECRET), "Pat Partner", "pat@acme.example", token]) assert.ok(!text.includes(v), `leaked ${v}`);
  });

  test("cancelling again, a case that has moved on, or someone else's case creates nothing", async () => {
    const moved = await newCase();
    const id = await newCase();
    assert.equal((await call("PATCH", `/api/partner/cases/${id}/cancel`, { token })).status, 200);
    assert.equal((await call("PATCH", `/api/partner/cases/${id}/cancel`, { token })).status, 409); // retry
    await PartnerCase.updateOne({ _id: moved }, { status: "assigned" });
    assert.equal((await call("PATCH", `/api/partner/cases/${moved}/cancel`, { token })).status, 409);
    assert.equal((await call("PATCH", `/api/partner/cases/${new mongoose.Types.ObjectId()}/cancel`, { token })).status, 404);
    assert.equal((await call("PATCH", `/api/partner/cases/${id}/cancel`)).status, 401);
    await settle();
    assert.equal((await activity("partner_case_cancelled")).length, 1, "only the first genuine cancellation");
  });

  test("posting a message creates one notification per message without its text", async () => {
    const id = await newCase();
    const text = "private note about the patient 24680";
    const res = await call("POST", `/api/partner/cases/${id}/messages`, { token, body: { body: text } });
    assert.equal(res.status, 201);
    await settle();
    const saved = await PartnerCase.findById(id).lean();
    const posted = saved.messages[saved.messages.length - 1];
    const rows = await notifications();
    assert.equal(rows.length, 1);
    const [n] = rows;
    assert.equal(n.type, "partner_case_message");
    assert.equal(n.title, "New partner message");
    assert.equal(n.message, `${saved.caseNumber} · Acme Assist · Message from the partner`);
    assert.equal(n.link, `/admin-dashboard/partner-cases/${id}`);
    assert.equal(n.dedupeKey, `partner_case_message:${id}:${posted._id}`);
    assert.ok(!JSON.stringify(rows).includes("24680"));

    assert.equal((await call("POST", `/api/partner/cases/${id}/messages`, { token, body: { body: "second" } })).status, 201);
    await settle();
    assert.equal((await activity("partner_case_message")).length, 2, "a distinct message is a distinct alert");
  });

  test("an empty or unauthorised message creates nothing", async () => {
    const id = await newCase();
    assert.equal((await call("POST", `/api/partner/cases/${id}/messages`, { token, body: { body: "   " } })).status, 400);
    assert.equal((await call("POST", `/api/partner/cases/${id}/messages`, { body: { body: "hi" } })).status, 401);
    await settle();
    assert.equal((await notifications()).length, 0);
  });

  test("a notification persistence failure does not fail the cancel or the message", async () => {
    const id = await newCase();
    const other = await newCase();
    await withBrokenNotifications(async () => {
      assert.equal((await call("POST", `/api/partner/cases/${id}/messages`, { token, body: { body: "hello" } })).status, 201);
      assert.equal((await call("PATCH", `/api/partner/cases/${other}/cancel`, { token })).status, 200);
      await settle();
    });
    assert.equal((await PartnerCase.findById(other).lean()).status, "cancelled");
    assert.equal((await PartnerCase.findById(id).lean()).messages.at(-1).body, "hello");
    assert.equal((await notifications()).length, 0);
  });

  test("the same activity notified twice is deduplicated", async () => {
    const id = await newCase();
    await call("PATCH", `/api/partner/cases/${id}/cancel`, { token });
    await settle();
    const { notifyAdminPartnerCaseActivity } = require("../utils/adminNotifications");
    const again = await notifyAdminPartnerCaseActivity({ partnerCase: await PartnerCase.findById(id), partnerId: company._id, action: "cancelled" });
    assert.equal(again.status, "deduplicated");
    assert.equal((await notifyAdminPartnerCaseActivity({ partnerCase: { _id: id }, action: "message" })).status, "invalid");
  });
});
