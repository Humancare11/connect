const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const AdminNotification = require("../models/AdminNotification");
const adminNotifications = require("../routes/adminNotifications");
const { adminOnly } = require("../middleware/verifyToken");
const { createAdminNotification } = require("../utils/adminNotifications");

// Isolated in-memory MongoDB only: never MONGO_URI, UAT or production.
describe("admin notifications", () => {
  let mongod, server, base;
  const A = String(new mongoose.Types.ObjectId());
  const B = String(new mongoose.Types.ObjectId());

  // Stands in for verifyAdminToken; the REAL adminOnly and id check run after it.
  const fakeAuth = (req, res, next) => {
    const role = req.headers["x-test-role"];
    if (!role) return res.status(401).json({ msg: "No token provided." });
    req.user = { id: req.headers["x-test-id"] || A, role };
    next();
  };

  const call = async (method, path, { role = "admin", id } = {}) => {
    const headers = {};
    if (role) headers["x-test-role"] = role;
    if (id) headers["x-test-id"] = id;
    const res = await fetch(`${base}${path}`, { method, headers });
    return { status: res.status, body: await res.json() };
  };

  const seed = (n, extra = {}) =>
    AdminNotification.create({
      type: "appointment_created",
      title: `Booking ${n}`,
      message: "msg",
      createdAt: new Date(Date.UTC(2026, 9, n)),
      ...extra,
    });

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await AdminNotification.init();
    const app = express();
    app.use("/api/admin/notifications", adminNotifications.create({ guard: [fakeAuth, adminOnly] }));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}/api/admin/notifications`;
  });
  after(async () => {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(() => AdminNotification.deleteMany({}));

  describe("schema", () => {
    test("applies defaults and rejects bad type/link", async () => {
      const doc = await AdminNotification.create({ type: "user_registered", title: "New user" });
      assert.deepEqual([doc.message, doc.refType, doc.refId, doc.link, doc.readBy.length], ["", null, "", "", 0]);
      assert.ok(doc.createdAt instanceof Date);
      assert.equal(doc.dedupeKey, undefined);
      await assert.rejects(AdminNotification.create({ type: "bogus", title: "x" }), /type/);
      await assert.rejects(AdminNotification.create({ type: "user_registered" }), /title/);
      for (const link of ["https://evil.example/x", "//evil.example", "/other", "/admin-dashboard/../x", "javascript:alert(1)"]) {
        await assert.rejects(AdminNotification.create({ type: "user_registered", title: "t", link }), /link/, link);
      }
      await AdminNotification.create({ type: "user_registered", title: "t", link: "/admin-dashboard/partner-cases/abc123" });
    });

    test("has a TTL index and a unique sparse dedupeKey index", async () => {
      const idx = await AdminNotification.collection.indexes();
      assert.equal(idx.find((i) => i.key.createdAt === 1)?.expireAfterSeconds, 60 * 60 * 24 * 90);
      const d = idx.find((i) => i.key.dedupeKey === 1);
      assert.ok(d.unique && d.sparse);
    });
  });

  describe("createAdminNotification helper", () => {
    test("creates, then deduplicates the same key", async () => {
      const input = { type: "appointment_created", title: "New booking", refType: "appointment", refId: "a1", dedupeKey: "appointment_created:a1" };
      const first = await createAdminNotification(input);
      assert.equal(first.status, "created");
      assert.ok(first.id);
      assert.equal((await createAdminNotification(input)).status, "deduplicated");
      assert.equal(await AdminNotification.countDocuments({}), 1);
    });

    test("notifications without a key never collide", async () => {
      await createAdminNotification({ type: "user_registered", title: "a" });
      await createAdminNotification({ type: "user_registered", title: "b" });
      assert.equal(await AdminNotification.countDocuments({}), 2);
    });

    test("rejects invalid input and external links without throwing", async () => {
      assert.deepEqual(await createAdminNotification({ type: "nope", title: "x" }), { status: "invalid", reason: "type" });
      assert.deepEqual(await createAdminNotification({ type: "user_registered", title: "  " }), { status: "invalid", reason: "title" });
      assert.deepEqual(await createAdminNotification({ type: "user_registered", title: "x", refType: "zzz" }), { status: "invalid", reason: "refType" });
      assert.deepEqual(await createAdminNotification({ type: "user_registered", title: "x", link: "https://evil.example" }), { status: "invalid", reason: "link" });
      assert.equal((await createAdminNotification()).status, "invalid");
      assert.equal(await AdminNotification.countDocuments({}), 0);
    });

    test("database failure returns failed, never throws, and logs no document data", async () => {
      const logged = [];
      const orig = console.warn;
      console.warn = (...a) => logged.push(a.join(" "));
      try {
        const Model = { create: async () => { throw new Error("db down"); } };
        const res = await createAdminNotification({ type: "user_registered", title: "Jane Patient registered" }, { Model });
        assert.deepEqual(res, { status: "failed" });
      } finally {
        console.warn = orig;
      }
      assert.equal(logged.length, 1);
      assert.match(logged[0], /db down/);
      assert.doesNotMatch(logged[0], /Jane/);
    });
  });

  describe("access", () => {
    test("401 without a token, 403 for non-admin roles, 200 for admin and superadmin", async () => {
      for (const [m, p] of [["GET", ""], ["GET", "/unread-count"], ["POST", "/read-all"], ["POST", `/${new mongoose.Types.ObjectId()}/read`]]) {
        assert.equal((await call(m, p, { role: "" })).status, 401, `${m} ${p}`);
        for (const role of ["user", "doctor", "partner", "employeeadmin", "paymentadmin"]) {
          assert.equal((await call(m, p, { role })).status, 403, `${m} ${p} ${role}`);
        }
      }
      assert.equal((await call("GET", "", { role: "admin" })).status, 200);
      assert.equal((await call("GET", "", { role: "superadmin" })).status, 200);
    });

    test("rejects a session whose id is not a valid ObjectId", async () => {
      assert.equal((await call("GET", "", { id: "not-an-id" })).status, 401);
    });
  });

  describe("list, count and read state", () => {
    test("lists newest first with a safe payload", async () => {
      await seed(1);
      await seed(3, { refType: "appointment", refId: "a3", link: "/admin-dashboard/bookings", dedupeKey: "k3" });
      await seed(2);
      const { status, body } = await call("GET", "");
      assert.equal(status, 200);
      assert.deepEqual(body.notifications.map((n) => n.title), ["Booking 3", "Booking 2", "Booking 1"]);
      assert.deepEqual(Object.keys(body.notifications[0]).sort(), ["createdAt", "id", "link", "message", "read", "refId", "refType", "title", "type"]);
      assert.doesNotMatch(JSON.stringify(body), /readBy|dedupeKey|__v|_id/);
    });

    test("limit is bounded, defaults to 20, and invalid values are rejected", async () => {
      for (let i = 1; i <= 25; i++) await seed(i);
      assert.equal((await call("GET", "")).body.notifications.length, 20);
      assert.equal((await call("GET", "?limit=3")).body.notifications.length, 3);
      assert.equal((await call("GET", "?limit=0")).body.notifications.length, 1);
      assert.equal((await call("GET", "?limit=9999")).body.notifications.length, 25);
      for (const bad of ["abc", "-1", "1.5", "1e3"]) assert.equal((await call("GET", `?limit=${bad}`)).status, 400, bad);
    });

    test("read state is per admin", async () => {
      const n1 = await seed(1);
      await seed(2);
      assert.equal((await call("GET", "/unread-count", { id: A })).body.count, 2);
      assert.equal((await call("GET", "/unread-count", { id: B })).body.count, 2);

      const res = await call("POST", `/${n1._id}/read`, { id: A });
      assert.equal(res.status, 200);
      assert.equal(res.body.notification.read, true);
      assert.doesNotMatch(JSON.stringify(res.body), /readBy/);

      assert.equal((await call("GET", "/unread-count", { id: A })).body.count, 1);
      assert.equal((await call("GET", "/unread-count", { id: B })).body.count, 2);
      const asB = (await call("GET", "", { id: B })).body.notifications;
      assert.ok(asB.every((n) => n.read === false));
      const asA = (await call("GET", "?unread=true", { id: A })).body.notifications;
      assert.deepEqual(asA.map((n) => n.title), ["Booking 2"]);
    });

    test("mark-one-read is idempotent", async () => {
      const n = await seed(1);
      await call("POST", `/${n._id}/read`);
      await call("POST", `/${n._id}/read`);
      assert.equal((await AdminNotification.findById(n._id)).readBy.length, 1);
    });

    test("read-all affects only the caller", async () => {
      await seed(1);
      await seed(2);
      const res = await call("POST", "/read-all", { id: A });
      assert.equal(res.status, 200);
      assert.equal(res.body.updated, 2);
      assert.equal((await call("GET", "/unread-count", { id: A })).body.count, 0);
      assert.equal((await call("GET", "/unread-count", { id: B })).body.count, 2);
      assert.equal((await call("POST", "/read-all", { id: A })).body.updated, 0);
    });

    test("invalid and unknown ids", async () => {
      assert.equal((await call("POST", "/not-an-id/read")).status, 400);
      assert.equal((await call("POST", `/${new mongoose.Types.ObjectId()}/read`)).status, 404);
    });
  });

  test("route is mounted in server.js and user registration does not raise a notification yet", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const root = path.resolve(__dirname, "..");
    assert.match(fs.readFileSync(path.join(root, "server.js"), "utf8"), /"\/api\/admin\/notifications", require\("\.\/routes\/adminNotifications"\)/);
    for (const f of ["controllers/authController.js"]) {
      assert.doesNotMatch(fs.readFileSync(path.join(root, f), "utf8"), /user_registered|notifyAdminUserRegistered/, f);
    }
  });
});
