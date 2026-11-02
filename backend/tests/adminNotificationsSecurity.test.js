const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

const AdminNotification = require("../models/AdminNotification");
const User = require("../models/User");
const { recordFailedLogin, recordSecurityEvent } = require("../utils/securityMonitor");
const { notifyAdminRepeatedFailedLogins, notifyAdminCriticalSecurityEvent } = require("../utils/adminNotifications");
const { superAdminOnly, adminOnly } = require("../middleware/verifyToken");

// Isolated in-memory MongoDB; no real account is touched or locked. The failed-login counter is
// in-process, so each test uses its own address and emails.
describe("admin notifications for security events (real monitor and routes, in-memory MongoDB)", () => {
  let mongod, server, base, n = 0;
  const PASSWORD_ATTEMPT = "Wr0ng-Passw0rd!";
  const settle = () => new Promise((r) => setTimeout(r, 150));
  const fakeReq = (ip) => ({ headers: {}, ip, socket: { remoteAddress: ip }, originalUrl: "/api/x?token=SECRETTOKEN" });
  const all = () => AdminNotification.find({}).lean();
  const failed = () => AdminNotification.find({ type: "security_repeated_failed_logins" }).lean();
  const critical = () => AdminNotification.find({ type: "security_critical_event" }).lean();
  const attempts = async (count, { ip, portal = "admin", email = () => `victim${++n}@example.com` }) => {
    for (let i = 0; i < count; i += 1) await recordFailedLogin(fakeReq(ip), { email: email(), portal });
  };

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

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await AdminNotification.init();
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use("/api/auth", require("../routes/auth"));
    app.use("/api/admin/notifications", require("../routes/adminNotifications").create());
    // Authenticated stand-in for a token, then the REAL superadmin-only guard.
    app.get("/api/superadmin-thing", (req, res, next) => {
      const role = req.headers["x-test-role"];
      if (!role) return res.status(401).json({ msg: "No token provided." });
      req.user = { id: req.headers["x-test-user"] || String(new mongoose.Types.ObjectId()), role };
      next();
    }, adminOnly, superAdminOnly, (req, res) => res.json({ ok: true }));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await Promise.all([AdminNotification.deleteMany({}), User.deleteMany({})]);
  });

  test("real login route: the 5th failed attempt raises one alert, earlier ones none, responses unchanged", async () => {
    const email = `target${++n}@example.com`;
    const statuses = [];
    for (let i = 1; i <= 6; i += 1) {
      const res = await fetch(`${base}/api/auth/admin-login`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: PASSWORD_ATTEMPT }),
      });
      statuses.push([res.status, (await res.json()).msg]);
      await settle();
      assert.equal((await failed()).length, i >= 5 ? 1 : 0, `after attempt ${i}`);
    }
    assert.equal(new Set(statuses.map((s) => JSON.stringify(s))).size, 1, "same response every time: nothing reveals the account");
    const [a] = await failed();
    assert.equal(a.title, "Repeated failed logins");
    assert.equal(a.message, "5 or more failed sign-in attempts within 15 minutes on the admin portal.");
    assert.equal(a.link, "/admin-dashboard/manage-users");
    assert.ok(AdminNotification.isInternalAdminLink(a.link));
    const text = JSON.stringify(a);
    for (const v of [email, PASSWORD_ATTEMPT, "127.0.0.1", "::1"]) assert.ok(!text.includes(v), `leaked ${v}`);
  });

  test("below the threshold nothing is raised", async () => {
    await attempts(4, { ip: "10.0.0.1" });
    await settle();
    assert.equal((await all()).length, 0);
  });

  test("many emails from one address, and many repeats, stay a single alert per portal per window", async () => {
    await attempts(30, { ip: "10.0.0.2" }); // a different email each time
    await settle();
    assert.equal((await failed()).length, 1);
    await attempts(10, { ip: "10.0.0.3" }); // another source on the same portal, same window
    await settle();
    assert.equal((await failed()).length, 1, "bounded: the bell cannot be flooded");
    await attempts(5, { ip: "10.0.0.4", portal: "patient" });
    await settle();
    const rows = await failed();
    assert.equal(rows.length, 2, "a different portal is its own alert");
    assert.notEqual(rows[0].dedupeKey, rows[1].dedupeKey);
  });

  test("a later window is a new alert", async () => {
    const WINDOW = 15 * 60 * 1000;
    assert.equal((await notifyAdminRepeatedFailedLogins({ portal: "admin", windowStart: 1000 * WINDOW })).status, "created");
    assert.equal((await notifyAdminRepeatedFailedLogins({ portal: "admin", windowStart: 1000 * WINDOW })).status, "deduplicated");
    assert.equal((await notifyAdminRepeatedFailedLogins({ portal: "admin", windowStart: 1001 * WINDOW })).status, "created");
  });

  test("an authenticated non-superadmin hitting a superadmin route raises one critical alert without sensitive data", async () => {
    const userId = String(new mongoose.Types.ObjectId());
    const call = (role, user = userId) => fetch(`${base}/api/superadmin-thing?token=SECRETTOKEN`, { headers: { ...(role ? { "x-test-role": role } : {}), "x-test-user": user } });
    assert.equal((await call("admin")).status, 403, "response unchanged");
    assert.equal((await call("admin")).status, 403);
    await settle();
    const rows = await critical();
    assert.equal(rows.length, 1, "repeats within the hour are one alert");
    const [c] = rows;
    assert.equal(c.title, "Critical security event");
    assert.equal(c.message, "Non-superadmin attempted superadmin access (role: admin).");
    assert.equal(c.refType, "user");
    assert.equal(c.refId, userId);
    assert.equal(c.link, "/admin-dashboard/manage-users");
    assert.ok(!JSON.stringify(rows).includes("SECRETTOKEN"));
    assert.ok(!JSON.stringify(rows).includes("/api/superadmin-thing"));
    // A different account is an independent incident.
    assert.equal((await call("admin", String(new mongoose.Types.ObjectId()))).status, 403);
    await settle();
    assert.equal((await critical()).length, 2);
  });

  test("a later hour is a new critical alert", async () => {
    const args = { type: "privilege_escalation", title: "Non-superadmin attempted superadmin access", userId: String(new mongoose.Types.ObjectId()), userRole: "admin" };
    assert.equal((await notifyAdminCriticalSecurityEvent({ ...args, hourBucket: 5000 })).status, "created");
    assert.equal((await notifyAdminCriticalSecurityEvent({ ...args, hourBucket: 5000 })).status, "deduplicated");
    assert.equal((await notifyAdminCriticalSecurityEvent({ ...args, hourBucket: 5001 })).status, "created");
  });

  test("unauthenticated callers, a superadmin, and non-critical events cannot raise or cause a critical alert", async () => {
    const get = (role) => fetch(`${base}/api/superadmin-thing`, { headers: role ? { "x-test-role": role } : {} });
    assert.equal((await get("")).status, 401);
    assert.equal((await get("superadmin")).status, 200);
    assert.equal((await get("user")).status, 403); // blocked earlier by adminOnly: high, not critical
    await recordSecurityEvent(fakeReq("10.0.1.1"), { type: "unauthorized_access", severity: "high", title: "x" });
    await recordSecurityEvent(fakeReq("10.0.1.1"), { type: "suspicious_activity", severity: "medium", title: "x" });
    await settle();
    assert.equal((await critical()).length, 0);
    // There is no route that creates notifications, so a request body can't forge one.
    for (const method of ["POST", "PUT", "PATCH"]) {
      const res = await fetch(`${base}/api/admin/notifications`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "security_critical_event", title: "forged" }) });
      assert.equal(res.status, 401, `${method} without an admin token`);
      const withToken = await fetch(`${base}/api/admin/notifications`, { method, headers: { "content-type": "application/json", "x-test-role": "admin" }, body: "{}" });
      assert.ok([401, 404].includes(withToken.status), `${method} has no create handler`);
    }
    assert.equal((await all()).length, 0);
  });

  test("a notification persistence failure does not change authentication behavior", async () => {
    const result = await withBrokenNotifications(async () => {
      await attempts(6, { ip: "10.0.2.1", portal: "patient" });
      const out = await recordSecurityEvent(fakeReq("10.0.2.2"), { type: "privilege_escalation", severity: "critical", title: "t", userRole: "admin" });
      const res = await fetch(`${base}/api/superadmin-thing`, { headers: { "x-test-role": "admin" } });
      await settle();
      return { out, status: res.status };
    });
    assert.equal(result.out.severity, "critical", "the security event is still recorded and returned");
    assert.equal(result.status, 403);
    assert.equal((await all()).length, 0);
  });
});
