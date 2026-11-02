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
const Doctor = require("../models/Doctor");
const Ticket = require("../models/Ticket");
const UserTicket = require("../models/UserTicket");
const Session = require("../models/Session");
const AdminNotification = require("../models/AdminNotification");
const { notifyAdminSupportTicketCreated } = require("../utils/adminNotifications");

// Real tickets, auth and doctor routers over HTTP against an isolated in-memory
// MongoDB. No email is sent by these flows; no shared database is touched.
const PASSWORD = "Passw0rd!x";
let mongod, server, base, tokens, ids;
let emitted;

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

const SECRET_TITLE = "My chest hurts after the call";
const SECRET_BODY = "Please call me on +15551234567 about my insulin dosage";
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

describe("admin notifications for support tickets (real routes, in-memory MongoDB)", () => {
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await AdminNotification.init();
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    emitted = [];
    app.set("io", { to: (room) => ({ emit: (event) => emitted.push({ room, event }) }) });
    app.use("/api/auth", require("../routes/auth"));
    app.use("/api/doctor", require("../routes/doctorAuth"));
    app.use("/api/tickets", require("../routes/tickets"));
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
      User.deleteMany({}), Doctor.deleteMany({}), Ticket.deleteMany({}), UserTicket.deleteMany({}),
      Session.deleteMany({}), AdminNotification.deleteMany({}),
    ]);
    emitted.length = 0;
    const hash = await bcrypt.hash(PASSWORD, 10);
    const patient = await User.create({ name: "Jane Patient", email: "jane@example.com", password: hash, role: "user" });
    const admin = await User.create({ name: "Ada Admin", email: "ada@example.com", password: hash, role: "admin" });
    const doctor = await Doctor.create({ name: "Dr Roe", email: "roe@example.com", password: PASSWORD });
    ids = { patient: patient._id, admin: admin._id, doctor: doctor._id };
    const p = await call("POST", "/api/auth/login", { body: { email: "jane@example.com", password: PASSWORD } });
    const a = await call("POST", "/api/auth/admin-login", { body: { email: "ada@example.com", password: PASSWORD } });
    const d = await call("POST", "/api/doctor/login", { body: { email: "roe@example.com", password: PASSWORD } });
    tokens = { patient: p.body.accessToken, admin: a.body.accessToken, doctor: d.body.accessToken };
    for (const [k, v] of Object.entries(tokens)) assert.ok(v, `${k} login works in the test setup`);
  });

  const expectNoLeak = (n) => {
    const text = JSON.stringify(n);
    for (const v of [SECRET_TITLE, SECRET_BODY, "insulin", "5551234567", "jane@example.com", "roe@example.com", "Jane", "Roe", ...Object.values(tokens)]) {
      assert.ok(!text.includes(v), `leaked ${v}`);
    }
  };

  describe("patient tickets (UserTicket, POST /api/tickets/user/create)", () => {
    test("creates one notification with the right fields and no ticket text", async () => {
      const res = await call("POST", "/api/tickets/user/create", {
        token: tokens.patient, body: { title: SECRET_TITLE, description: SECRET_BODY, category: "billing" },
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.message, "Ticket submitted successfully.", "response unchanged");
      assert.ok(emitted.some((e) => e.room === "admin_room" && e.event === "user-ticket-created"), "existing socket event kept");
      await settle();

      const saved = await UserTicket.findOne({}).lean();
      const all = await notifications();
      assert.equal(all.length, 1);
      const [n] = all;
      assert.equal(n.type, "support_ticket_created");
      assert.equal(n.title, "New patient support ticket");
      assert.equal(n.refType, "user_ticket");
      assert.equal(n.refId, String(saved._id));
      assert.equal(n.dedupeKey, `support_ticket_created:patient:${saved._id}`);
      assert.equal(n.link, "/admin-dashboard/tickets");
      assert.equal(n.message, `Patient ticket · billing category · Ref ${String(saved._id).slice(-6)}`);
      expectNoLeak(n);
    });

    test("invalid, unauthenticated and wrong-role requests create no ticket and no notification", async () => {
      const body = { title: "t", description: "d" };
      assert.equal((await call("POST", "/api/tickets/user/create", { token: tokens.patient, body: { title: "t" } })).status, 400);
      assert.equal((await call("POST", "/api/tickets/user/create", { token: tokens.patient, body: { description: "d" } })).status, 400);
      assert.equal((await call("POST", "/api/tickets/user/create", { body })).status, 401);
      assert.equal((await call("POST", "/api/tickets/user/create", { token: tokens.doctor, body })).status, 401);
      assert.equal((await call("POST", "/api/tickets/user/create", { token: tokens.admin, body })).status, 401);
      // A category outside the model's enum makes the write fail (existing behaviour: 500).
      const warn = console.error;
      console.error = () => {};
      const bad = await call("POST", "/api/tickets/user/create", { token: tokens.patient, body: { ...body, category: "bogus" } });
      console.error = warn;
      assert.equal(bad.status, 500);
      await settle();
      assert.equal(await UserTicket.countDocuments({}), 0);
      assert.equal((await notifications()).length, 0);
    });

    test("a notification database failure does not change the successful response", async () => {
      const res = await withBrokenNotifications(async () => {
        const r = await call("POST", "/api/tickets/user/create", { token: tokens.patient, body: { title: "t", description: "d" } });
        await settle();
        return r;
      });
      assert.equal(res.status, 201);
      assert.equal(await UserTicket.countDocuments({}), 1);
      assert.equal((await notifications()).length, 0);
    });
  });

  describe("doctor tickets (Ticket, POST /api/tickets/create)", () => {
    test("creates one notification with the right fields and no ticket text", async () => {
      const res = await call("POST", "/api/tickets/create", { token: tokens.doctor, body: { title: SECRET_TITLE, description: SECRET_BODY } });
      assert.equal(res.status, 201);
      assert.equal(res.body.message, "Ticket created successfully.", "response unchanged");
      await settle();

      const saved = await Ticket.findOne({}).lean();
      const all = await notifications();
      assert.equal(all.length, 1);
      const [n] = all;
      assert.equal(n.type, "support_ticket_created");
      assert.equal(n.title, "New doctor support ticket");
      assert.equal(n.refType, "ticket");
      assert.equal(n.refId, String(saved._id));
      assert.equal(n.dedupeKey, `support_ticket_created:doctor:${saved._id}`);
      assert.equal(n.link, "/admin-dashboard/tickets");
      assert.equal(n.message, `Doctor ticket · Ref ${String(saved._id).slice(-6)}`);
      expectNoLeak(n);
    });

    test("invalid, unauthenticated and wrong-role requests create no ticket and no notification", async () => {
      const body = { title: "t", description: "d" };
      assert.equal((await call("POST", "/api/tickets/create", { token: tokens.doctor, body: { title: "t" } })).status, 400);
      assert.equal((await call("POST", "/api/tickets/create", { body })).status, 401);
      assert.equal((await call("POST", "/api/tickets/create", { token: tokens.patient, body })).status, 401);
      assert.equal((await call("POST", "/api/tickets/create", { token: tokens.admin, body })).status, 401);
      await settle();
      assert.equal(await Ticket.countDocuments({}), 0);
      assert.equal((await notifications()).length, 0);
    });

    test("a notification database failure does not change the successful response", async () => {
      const res = await withBrokenNotifications(async () => {
        const r = await call("POST", "/api/tickets/create", { token: tokens.doctor, body: { title: "t", description: "d" } });
        await settle();
        return r;
      });
      assert.equal(res.status, 201);
      assert.equal(await Ticket.countDocuments({}), 1);
      assert.equal((await notifications()).length, 0);
    });
  });

  test("patient and doctor tickets with the same id never collide, and repeats are deduplicated", async () => {
    const same = new mongoose.Types.ObjectId();
    assert.equal((await notifyAdminSupportTicketCreated({ ticket: { _id: same, category: "other" }, source: "patient" })).status, "created");
    assert.equal((await notifyAdminSupportTicketCreated({ ticket: { _id: same }, source: "doctor" })).status, "created");
    assert.equal((await notifyAdminSupportTicketCreated({ ticket: { _id: same, category: "other" }, source: "patient" })).status, "deduplicated");
    assert.equal((await notifications()).length, 2);
  });

  test("existing ticket workflows are unaffected and do not notify (list, read, resolve)", async () => {
    await call("POST", "/api/tickets/user/create", { token: tokens.patient, body: { title: "t", description: "d" } });
    await call("POST", "/api/tickets/create", { token: tokens.doctor, body: { title: "t", description: "d" } });
    await settle();
    await AdminNotification.deleteMany({});
    const patientTicket = await UserTicket.findOne({});
    const doctorTicket = await Ticket.findOne({});

    assert.equal((await call("GET", "/api/tickets/user/my", { token: tokens.patient })).body.length, 1);
    assert.equal((await call("GET", "/api/tickets/my", { token: tokens.doctor })).body.length, 1);
    assert.equal((await call("GET", "/api/tickets/user/all", { token: tokens.admin })).body.length, 1);
    assert.equal((await call("GET", "/api/tickets/all", { token: tokens.admin })).body.length, 1);
    assert.equal((await call("GET", "/api/tickets/all", { token: tokens.patient })).status, 403);
    assert.equal((await call("PUT", `/api/tickets/user/${patientTicket._id}/resolve`, { token: tokens.admin, body: { resolution: "done" } })).status, 200);
    assert.equal((await call("PUT", `/api/tickets/${doctorTicket._id}/resolve`, { token: tokens.admin, body: { resolution: "done" } })).status, 200);
    await settle();
    assert.equal((await UserTicket.findById(patientTicket._id)).status, "resolved");
    assert.equal((await notifications()).length, 0, "only creation notifies");
  });
});
