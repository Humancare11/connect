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
const mailer = require("../utils/sendEmail");
const { formatInZone, validTimeZone, ticketRef } = require("../utils/ticketThread");

// Support-ticket conversations over HTTP against an isolated in-memory MongoDB. The mailer is
// replaced by a recorder, so no email leaves the machine.
const PASSWORD = "Passw0rd!x";
let mongod, server, base, tokens, ids, sent, realSend;

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

const settle = () => new Promise((r) => setTimeout(r, 200));
const login = async (path, email) => (await call("POST", path, { body: { email, password: PASSWORD } })).body.accessToken;

describe("support ticket conversations (real routes, in-memory MongoDB)", () => {
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await AdminNotification.init();
    realSend = mailer.sendBookingNotificationEmail;
    sent = [];
    mailer.sendBookingNotificationEmail = async (to, payload) => { sent.push({ to, payload }); };
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.set("io", { to: () => ({ emit: () => {} }) });
    app.use("/api/auth", require("../routes/auth"));
    app.use("/api/doctor", require("../routes/doctorAuth"));
    app.use("/api/tickets", require("../routes/tickets"));
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${server.address().port}`;

    // Users and logins are created once: the login routes are rate limited.
    const hash = await bcrypt.hash(PASSWORD, 10);
    const patient = await User.create({ name: "Jane Patient", email: "jane@example.com", password: hash, role: "user" });
    await User.create({ name: "Other Patient", email: "other@example.com", password: hash, role: "user" });
    const admin = await User.create({ name: "Ada Admin", email: "ada@example.com", password: hash, role: "admin" });
    const doctor = await Doctor.create({ name: "Dr Roe", email: "roe@example.com", password: PASSWORD });
    ids = { patient: patient._id, admin: admin._id, doctor: doctor._id };
    tokens = {
      patient: await login("/api/auth/login", "jane@example.com"),
      other: await login("/api/auth/login", "other@example.com"),
      admin: await login("/api/auth/admin-login", "ada@example.com"),
      doctor: await login("/api/doctor/login", "roe@example.com"),
    };
    for (const [k, v] of Object.entries(tokens)) assert.ok(v, `${k} login works in the test setup`);
  });
  after(async () => {
    mailer.sendBookingNotificationEmail = realSend;
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await Promise.all([Ticket.deleteMany({}), UserTicket.deleteMany({}), AdminNotification.deleteMany({})]);
    sent.length = 0;
  });

  const raisePatient = async (extra = {}) =>
    (await call("POST", "/api/tickets/user/create", {
      token: tokens.patient,
      body: { title: "Reports not received", description: "I never got my report.", category: "medical", userTimezone: "America/New_York", ...extra },
    })).body.ticket;

  describe("creating", () => {
    test("stores the raiser's timezone and the first message; ignores a bad timezone", async () => {
      const t = await raisePatient();
      const saved = await UserTicket.findById(t._id).lean();
      assert.equal(saved.userTimezone, "America/New_York");
      assert.equal(saved.messages.length, 1);
      assert.equal(saved.messages[0].sender, "user");
      assert.equal(saved.messages[0].text, "I never got my report.");
      assert.equal(saved.status, "open");
      assert.equal(saved.closedAt, null);

      const bad = await raisePatient({ userTimezone: "Not/AZone" });
      assert.equal((await UserTicket.findById(bad._id).lean()).userTimezone, "");
    });

    test("doctor tickets get a category (default other) and a timezone too", async () => {
      const r = await call("POST", "/api/tickets/create", {
        token: tokens.doctor, body: { title: "Payout", description: "Not received", category: "payments", userTimezone: "Asia/Dubai" },
      });
      assert.equal(r.status, 201);
      const saved = await Ticket.findById(r.body.ticket._id).lean();
      assert.equal(saved.category, "payments");
      assert.equal(saved.userTimezone, "Asia/Dubai");
      const d = await call("POST", "/api/tickets/create", { token: tokens.doctor, body: { title: "x", description: "y" } });
      assert.equal((await Ticket.findById(d.body.ticket._id).lean()).category, "other");
    });
  });

  describe("email to admin", () => {
    test("a patient ticket emails every active admin with id, title, category, raiser, description and both times", async () => {
      const t = await raisePatient();
      await settle();
      assert.equal(sent.length, 1);
      assert.equal(sent[0].to, "ada@example.com");
      const p = sent[0].payload;
      const rows = Object.fromEntries(p.rows);
      assert.ok(p.subject.includes(ticketRef(t._id)) && p.subject.includes("Reports not received"));
      assert.equal(rows["Ticket ID"], ticketRef(t._id));
      assert.equal(rows.Title, "Reports not received");
      assert.equal(rows.Category, "medical");
      assert.equal(rows.Name, "Jane Patient");
      assert.equal(rows.Email, "jane@example.com");
      assert.equal(p.quote, "I never got my report.");
      assert.match(rows["Raised (patient time)"], /America\/New_York \(GMT-[45]\)/);
      assert.match(rows["Raised (admin time)"], /Asia\/Kolkata \(GMT\+5:30\)/);
    });

    test("a doctor ticket is emailed as a doctor ticket", async () => {
      await call("POST", "/api/tickets/create", { token: tokens.doctor, body: { title: "Payout", description: "Missing", userTimezone: "Asia/Dubai" } });
      await settle();
      assert.equal(sent.length, 1);
      const rows = Object.fromEntries(sent[0].payload.rows);
      assert.equal(rows["Raised by"], "Doctor");
      assert.equal(rows.Email, "roe@example.com");
      assert.match(rows["Raised (doctor time)"], /Asia\/Dubai \(GMT\+4\)/);
    });

    test("a mail failure never fails the ticket", async () => {
      mailer.sendBookingNotificationEmail = async () => { throw new Error("smtp down"); };
      const err = console.error; console.error = () => {};
      try {
        const r = await call("POST", "/api/tickets/user/create", { token: tokens.patient, body: { title: "t", description: "d" } });
        assert.equal(r.status, 201);
        await settle();
        assert.equal(await UserTicket.countDocuments({}), 1);
      } finally {
        console.error = err;
        mailer.sendBookingNotificationEmail = async (to, payload) => { sent.push({ to, payload }); };
      }
    });
  });

  describe("replies and closing", () => {
    test("user and admin replies build the thread and never close the ticket", async () => {
      const t = await raisePatient();
      const a = await call("POST", `/api/tickets/user/${t._id}/admin-reply`, { token: tokens.admin, body: { text: "Looking into it" } });
      assert.equal(a.status, 201);
      assert.equal(a.body.ticket.status, "open");
      const u = await call("POST", `/api/tickets/user/${t._id}/reply`, { token: tokens.patient, body: { text: "Thanks" } });
      assert.equal(u.status, 201);
      const saved = await UserTicket.findById(t._id).lean();
      assert.deepEqual(saved.messages.map((m) => [m.sender, m.text]), [
        ["user", "I never got my report."], ["admin", "Looking into it"], ["user", "Thanks"],
      ]);
      assert.equal(saved.status, "open");
      assert.equal(saved.closedAt, null);
    });

    test("only an admin can close; closing records who/when and ends the conversation", async () => {
      const t = await raisePatient();
      for (const who of ["patient", "doctor"]) {
        const status = (await call("PUT", `/api/tickets/user/${t._id}/close`, { token: tokens[who] })).status;
        assert.ok([401, 403].includes(status), `${who} cannot close (got ${status})`);
      }
      assert.equal((await call("PUT", `/api/tickets/user/${t._id}/close`)).status, 401);
      assert.equal((await UserTicket.findById(t._id).lean()).status, "open");

      const c = await call("PUT", `/api/tickets/user/${t._id}/close`, { token: tokens.admin });
      assert.equal(c.status, 200);
      assert.equal(c.body.ticket.status, "resolved");
      const saved = await UserTicket.findById(t._id).lean();
      assert.equal(String(saved.closedBy), String(ids.admin));
      assert.ok(saved.closedAt);

      const afterUser = await call("POST", `/api/tickets/user/${t._id}/reply`, { token: tokens.patient, body: { text: "one more thing" } });
      assert.equal(afterUser.status, 409);
      const afterAdmin = await call("POST", `/api/tickets/user/${t._id}/admin-reply`, { token: tokens.admin, body: { text: "late" } });
      assert.equal(afterAdmin.status, 409);
      assert.equal((await UserTicket.findById(t._id).lean()).messages.length, 1, "no message added after closing");
      assert.equal((await call("PUT", `/api/tickets/user/${t._id}/close`, { token: tokens.admin })).status, 409, "closing twice is refused");
    });

    test("users only see and reply to their own tickets; the user view hides who closed it", async () => {
      const t = await raisePatient();
      assert.equal((await call("POST", `/api/tickets/user/${t._id}/reply`, { token: tokens.other, body: { text: "hi" } })).status, 404);
      assert.equal((await call("GET", "/api/tickets/user/my", { token: tokens.other })).body.length, 0);
      const mine = await call("GET", "/api/tickets/user/my", { token: tokens.patient });
      assert.equal(mine.body.length, 1);
      // A doctor token is not accepted on patient routes, nor a patient token on doctor routes.
      assert.equal((await call("POST", `/api/tickets/user/${t._id}/reply`, { token: tokens.doctor, body: { text: "hi" } })).status, 401);
      assert.equal((await call("POST", `/api/tickets/${t._id}/reply`, { token: tokens.patient, body: { text: "hi" } })).status, 401);
      await call("PUT", `/api/tickets/user/${t._id}/close`, { token: tokens.admin });
      const closed = (await call("GET", "/api/tickets/user/my", { token: tokens.patient })).body[0];
      assert.equal(closed.status, "resolved");
      assert.ok(closed.closedAt);
      assert.equal(closed.closedBy, undefined);
      assert.equal(closed.resolvedBy, undefined);
      const admin = (await call("GET", "/api/tickets/user/all", { token: tokens.admin })).body[0];
      assert.equal(admin.closedBy.name, "Ada Admin");
    });

    test("doctor tickets follow the same rules", async () => {
      const c = await call("POST", "/api/tickets/create", { token: tokens.doctor, body: { title: "Slots", description: "Not syncing" } });
      const id = c.body.ticket._id;
      assert.equal((await call("POST", `/api/tickets/${id}/admin-reply`, { token: tokens.admin, body: { text: "checking" } })).status, 201);
      assert.equal((await call("POST", `/api/tickets/${id}/reply`, { token: tokens.doctor, body: { text: "ok" } })).status, 201);
      assert.equal((await Ticket.findById(id).lean()).status, "open");
      assert.equal((await call("PUT", `/api/tickets/${id}/close`, { token: tokens.admin })).status, 200);
      assert.equal((await call("POST", `/api/tickets/${id}/reply`, { token: tokens.doctor, body: { text: "again" } })).status, 409);
      assert.equal((await Ticket.findById(id).lean()).messages.length, 3);
    });

    test("bad input: empty text 400, unknown/invalid id 404, long text is capped", async () => {
      const t = await raisePatient();
      assert.equal((await call("POST", `/api/tickets/user/${t._id}/reply`, { token: tokens.patient, body: { text: "   " } })).status, 400);
      assert.equal((await call("POST", `/api/tickets/user/${t._id}/reply`, { token: tokens.patient, body: {} })).status, 400);
      assert.equal((await call("POST", "/api/tickets/user/not-an-id/reply", { token: tokens.patient, body: { text: "x" } })).status, 404);
      assert.equal((await call("PUT", "/api/tickets/user/not-an-id/close", { token: tokens.admin })).status, 404);
      assert.equal((await call("PUT", `/api/tickets/user/${new mongoose.Types.ObjectId()}/close`, { token: tokens.admin })).status, 404);
      const long = await call("POST", `/api/tickets/user/${t._id}/reply`, { token: tokens.patient, body: { text: "a".repeat(5000) } });
      assert.equal(long.status, 201);
      assert.equal(long.body.ticket.messages.at(-1).text.length, 2000);
    });

    test("a reply racing with close is either stored before the close or refused, never added after", async () => {
      const t = await raisePatient();
      const results = await Promise.all([
        call("POST", `/api/tickets/user/${t._id}/reply`, { token: tokens.patient, body: { text: "racing" } }),
        call("PUT", `/api/tickets/user/${t._id}/close`, { token: tokens.admin }),
      ]);
      const saved = await UserTicket.findById(t._id).lean();
      assert.equal(saved.status, "resolved");
      const replyStored = saved.messages.some((m) => m.text === "racing");
      assert.equal(results[0].status, replyStored ? 201 : 409);
    });
  });

  describe("tickets created before threads existed", () => {
    test("show a derived thread, and storing a reply keeps the original text and resolution", async () => {
      const old = await UserTicket.collection.insertOne({
        title: "Old", description: "Original problem", category: "billing", status: "open",
        createdBy: ids.patient, createdAt: new Date("2026-01-01T10:00:00Z"), updatedAt: new Date("2026-01-01T10:00:00Z"),
      });
      let mine = (await call("GET", "/api/tickets/user/my", { token: tokens.patient })).body[0];
      assert.deepEqual(mine.messages.map((m) => [m.sender, m.text]), [["user", "Original problem"]]);

      await call("POST", `/api/tickets/user/${old.insertedId}/admin-reply`, { token: tokens.admin, body: { text: "Hello" } });
      mine = (await call("GET", "/api/tickets/user/my", { token: tokens.patient })).body[0];
      assert.deepEqual(mine.messages.map((m) => [m.sender, m.text]), [["user", "Original problem"], ["admin", "Hello"]]);

      const resolved = await UserTicket.collection.insertOne({
        title: "Done", description: "Was broken", category: "technical", status: "resolved", resolution: "Fixed it",
        createdBy: ids.patient, createdAt: new Date("2026-01-02T10:00:00Z"), updatedAt: new Date("2026-01-03T10:00:00Z"),
      });
      const list = (await call("GET", "/api/tickets/user/my", { token: tokens.patient })).body;
      const r = list.find((x) => x._id === String(resolved.insertedId));
      assert.deepEqual(r.messages.map((m) => [m.sender, m.text]), [["user", "Was broken"], ["admin", "Fixed it"]]);
      assert.ok(r.closedAt, "closedAt falls back to the last update");
    });

    test("the older /resolve routes still work and close through the same rules", async () => {
      const t = await raisePatient();
      const r = await call("PUT", `/api/tickets/user/${t._id}/resolve`, { token: tokens.admin, body: { resolution: "All sorted" } });
      assert.equal(r.status, 200);
      const saved = await UserTicket.findById(t._id).lean();
      assert.equal(saved.status, "resolved");
      assert.equal(saved.messages.at(-1).text, "All sorted");
      assert.equal(saved.messages.at(-1).sender, "admin");
    });
  });
});

describe("ticket time helpers", () => {
  test("formatInZone shows the zone name and UTC offset", () => {
    const d = new Date("2026-11-07T10:00:00Z");
    assert.equal(formatInZone(d, "Asia/Kolkata"), "7 Nov 2026, 03:30 pm · Asia/Kolkata (GMT+5:30)");
    assert.match(formatInZone(d, "America/New_York"), /05:00 am · America\/New_York \(GMT-5\)$/);
    assert.equal(formatInZone(d, "Nope/Zone"), "");
    assert.equal(formatInZone("garbage", "Asia/Kolkata"), "");
  });
  test("validTimeZone", () => {
    assert.ok(validTimeZone("UTC") && validTimeZone("Europe/London"));
    assert.ok(!validTimeZone("") && !validTimeZone(null) && !validTimeZone("x".repeat(100)) && !validTimeZone("Mars/Base"));
  });
});
