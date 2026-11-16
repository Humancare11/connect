const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Mailbox = require("../models/Mailbox");
const EmailMessage = require("../models/EmailMessage");
const EmailView = require("../models/EmailView");
const User = require("../models/User");
const adminEmail = require("../routes/adminEmail");

// The dashboard is told (through onChange) when mail changes, so other open dashboards refresh.
describe("email change events from the API", () => {
  let mongod, server, base, gmail, calls, support, priya, aman;
  const store = { async put() {}, async get() { return Buffer.from("x"); }, async remove() {} };
  const fakeAuth = (req, res, next) => {
    req.user = { id: req.headers["x-test-admin"], role: "admin" };
    next();
  };

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([Mailbox.init(), EmailMessage.init(), EmailView.init(), User.init()]);
    const app = express();
    app.use(express.json());
    app.use(
      "/api/admin/email",
      adminEmail.create({
        guard: [fakeAuth],
        getGmail: () => gmail,
        store,
        trackingState: async () => ({ active: false }),
        onChange: (mailboxId) => calls.push(String(mailboxId)),
      })
    );
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}/api/admin/email`;
  });
  after(async () => {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await Promise.all([Mailbox.deleteMany({}), EmailMessage.deleteMany({}), EmailView.deleteMany({}), User.deleteMany({})]);
    support = await Mailbox.create({ address: "support@humancareconnect.co", displayName: "Support", signature: "HCC" });
    [priya, aman] = await User.create([
      { name: "Priya", email: "p@x.co", role: "admin" },
      { name: "Aman", email: "a@x.co", role: "admin" },
    ]);
    calls = [];
    gmail = { sent: [], async sendRaw(raw) { this.sent.push(raw.toString()); return { id: "g1", threadId: "t1" }; } };
  });

  async function inbound() {
    const doc = new EmailMessage({
      mailbox: support._id,
      direction: "in",
      status: "received",
      gmailMessageId: "g-in",
      gmailThreadId: "t-in",
      rfcMessageId: "<in@x>",
      from: { address: "client@gmail.com" },
      to: [{ address: support.address }],
      subject: "Hello",
      messageDate: new Date(),
    });
    doc.setContent({ text: "hi", html: "", snippet: "hi" });
    await doc.save();
    return doc;
  }
  const as = (u) => ({ "x-test-admin": String(u._id) });

  test("the first view of a mail tells the dashboards (other admins' unread counts change); a repeat view does not", async () => {
    const mail = await inbound();
    await fetch(`${base}/messages/${mail._id}/view`, { method: "POST", headers: as(priya) });
    assert.deepEqual(calls, [String(support._id)]);
    await fetch(`${base}/messages/${mail._id}/view`, { method: "POST", headers: as(priya) });
    assert.equal(calls.length, 1, "no second event for the same admin opening it again");
  });

  test("sending a new mail tells the dashboards; a duplicate (same clientRequestId) does not", async () => {
    const send = () => {
      const fd = new FormData();
      for (const [k, v] of Object.entries({ from: String(support._id), to: "anita@gmail.com", subject: "Hi", body: "Hello", clientRequestId: "req-1" })) fd.set(k, v);
      return fetch(`${base}/send`, { method: "POST", headers: as(aman), body: fd });
    };
    assert.equal((await send()).status, 201);
    assert.deepEqual(calls, [String(support._id)]);
    assert.equal((await send()).status, 200);
    assert.equal(calls.length, 1);
  });

  test("an event carries only the mailbox id", async () => {
    const mail = await inbound();
    await fetch(`${base}/messages/${mail._id}/view`, { method: "POST", headers: as(aman) });
    assert.ok(calls.every((c) => /^[0-9a-f]{24}$/.test(c)));
  });
});
