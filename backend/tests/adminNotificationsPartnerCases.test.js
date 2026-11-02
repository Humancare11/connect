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
const { notifyAdminPartnerCaseCreated } = require("../utils/adminNotifications");

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

describe("admin notifications for partner cases (real routes, in-memory MongoDB)", () => {
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

  test("creating a case produces one notification with the right fields and no sensitive data", async () => {
    const res = await call("POST", "/api/partner/cases", { token, body: caseBody() });
    assert.equal(res.status, 201);
    assert.match(res.body.caseNumber, /^HC-\d{4}-\d{6}$/, "response unchanged");
    await settle();

    const saved = await PartnerCase.findOne({}).lean();
    const all = await notifications();
    assert.equal(all.length, 1);
    const [n] = all;
    assert.equal(n.type, "partner_case_created");
    assert.equal(n.title, "New partner case");
    assert.equal(n.refType, "partner_case");
    assert.equal(n.refId, String(saved._id));
    assert.equal(n.dedupeKey, `partner_case_created:${saved._id}`);
    assert.equal(n.link, `/admin-dashboard/partner-cases/${saved._id}`);
    assert.equal(n.message, `${saved.caseNumber} · Acme Assist · Teleconsultation · urgent urgency`);
    const text = JSON.stringify(n);
    for (const v of Object.values(SECRET)) assert.ok(!text.includes(v), `leaked ${v}`);
    for (const v of ["Pat Partner", "pat@acme.example", "Kenya", token]) assert.ok(!text.includes(v), `leaked ${v}`);
  });

  test("a routine case omits the urgency part", async () => {
    await call("POST", "/api/partner/cases", { token, body: caseBody({ urgency: "routine", serviceType: "house-call" }) });
    await settle();
    const saved = await PartnerCase.findOne({}).lean();
    assert.equal((await notifications())[0].message, `${saved.caseNumber} · Acme Assist · House call`);
  });

  test("each separately submitted case gets its own notification", async () => {
    await call("POST", "/api/partner/cases", { token, body: caseBody() });
    await call("POST", "/api/partner/cases", { token, body: caseBody() });
    await settle();
    assert.equal(await PartnerCase.countDocuments({}), 2);
    const all = await notifications();
    assert.equal(all.length, 2);
    assert.equal(new Set(all.map((n) => n.dedupeKey)).size, 2);
  });

  test("rejected case creations create no notification", async () => {
    assert.equal((await call("POST", "/api/partner/cases", { token, body: caseBody({ serviceType: "bogus" }) })).status, 400);
    assert.equal((await call("POST", "/api/partner/cases", { token, body: caseBody({ patient: { name: "", complaint: "x" } }) })).status, 400);
    assert.equal((await call("POST", "/api/partner/cases", { token, body: caseBody({ patient: { name: "A", complaint: "" } }) })).status, 400);
    assert.equal((await call("POST", "/api/partner/cases", { token, body: caseBody({ location: {} }) })).status, 400);
    assert.equal((await call("POST", "/api/partner/cases", { body: caseBody() })).status, 401);
    await settle();
    assert.equal(await PartnerCase.countDocuments({}), 0);
    assert.equal((await notifications()).length, 0);
  });

  test("a deactivated company cannot create cases and creates no notification", async () => {
    await Partner.updateOne({ _id: company._id }, { status: "inactive" });
    assert.equal((await call("POST", "/api/partner/cases", { token, body: caseBody() })).status, 403);
    await settle();
    assert.equal((await notifications()).length, 0);
  });

  test("a notification database failure does not change the successful case response", async () => {
    const res = await withBrokenNotifications(async () => {
      const r = await call("POST", "/api/partner/cases", { token, body: caseBody() });
      await settle();
      return r;
    });
    assert.equal(res.status, 201);
    assert.match(res.body.caseNumber, /^HC-/);
    assert.equal(await PartnerCase.countDocuments({}), 1);
    assert.equal((await notifications()).length, 0);
  });

  test("case reads create no notifications, and a message only raises the partner-message alert", async () => {
    const created = await call("POST", "/api/partner/cases", { token, body: caseBody() });
    await settle();
    await AdminNotification.deleteMany({});
    const id = created.body.id || created.body._id;
    assert.ok(id);
    assert.equal((await call("GET", "/api/partner/cases", { token })).status, 200);
    assert.equal((await call("GET", `/api/partner/cases/${id}`, { token })).status, 200);
    assert.equal((await call("POST", `/api/partner/cases/${id}/messages`, { token, body: { body: "hello" } })).status, 201);
    await settle();
    const rows = await notifications();
    assert.deepEqual(rows.map((n) => n.type), ["partner_case_message"], "reads never notify; messages are covered in adminNotificationsPartnerCaseActivity.test.js");
  });

  test("the helper deduplicates a repeated call for the same case", async () => {
    await call("POST", "/api/partner/cases", { token, body: caseBody() });
    await settle();
    const saved = await PartnerCase.findOne({}).lean();
    assert.equal((await notifyAdminPartnerCaseCreated({ partnerCase: saved })).status, "deduplicated");
    assert.equal((await notifications()).length, 1);
  });

  test("a missing company lookup only drops the company name", async () => {
    const saved = await PartnerCase.create({
      caseNumber: "HC-2026-000999", partner: new mongoose.Types.ObjectId(), submittedBy: creator,
      serviceType: "in-clinic", patient: { name: "X" },
    });
    const res = await notifyAdminPartnerCaseCreated({ partnerCase: saved });
    assert.equal(res.status, "created");
    assert.equal((await notifications())[0].message, "HC-2026-000999 · In-clinic");
  });
});
