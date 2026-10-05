const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Mailbox = require("../models/Mailbox");
const EmailMessage = require("../models/EmailMessage");
const EmailAttachment = require("../models/EmailAttachment");
const EmailView = require("../models/EmailView");
const User = require("../models/User");
const adminEmail = require("../routes/adminEmail");
const { hashToken } = require("../services/email/trackingToken");

describe("Sent list and mail page show open tracking", () => {
  let mongod, server, base, support, priya, rows;
  const fakeAuth = (req, res, next) => { req.user = { id: req.headers["x-test-admin"], role: "admin" }; next(); };

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([Mailbox.init(), EmailMessage.init(), EmailAttachment.init(), EmailView.init(), User.init()]);
    const app = express();
    app.use(express.json());
    app.use("/api/admin/email", adminEmail.create({ guard: [fakeAuth] }));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}/api/admin/email`;
  });
  after(async () => {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await mongod.stop();
  });

  let seq = 0;
  async function out(subject, fields = {}) {
    seq += 1;
    const doc = new EmailMessage({
      mailbox: support._id, direction: "out", status: "sent", gmailMessageId: `g${seq}`, gmailThreadId: `t${seq}`,
      from: { name: "Human Care Connect", address: support.address }, to: [{ address: `c${seq}@gmail.com` }],
      subject, messageDate: new Date(Date.now() - seq * 60_000), sentByAdmin: priya._id, sentByName: "Priya", ...fields,
    });
    doc.setContent({ text: "body", html: "", snippet: "body" });
    await doc.save();
    return doc;
  }
  const get = async (path) => (await fetch(base + path, { headers: { "x-test-admin": String(priya._id) } })).json();
  const subjects = (r) => r.items.map((i) => i.subject).sort();

  beforeEach(async () => {
    await Promise.all([Mailbox.deleteMany({}), EmailMessage.deleteMany({}), User.deleteMany({})]);
    priya = await User.create({ name: "Priya", email: "p@x.co", role: "admin" });
    support = await Mailbox.create({ address: "support@humancareconnect.co", displayName: "Support" });
    const opened = new Date("2026-10-05T10:05:00Z");
    rows = {
      opened: await out("Opened mail", { tracking: { enabled: true, tokenHash: hashToken("a"), status: "opened", firstOpenedAt: opened, lastOpenedAt: new Date("2026-10-05T12:00:00Z"), openCount: 3 } }),
      pending: await out("Pending mail", { tracking: { enabled: true, tokenHash: hashToken("b"), status: "pending" } }),
      auto: await out("Automated only", { tracking: { enabled: true, tokenHash: hashToken("c"), status: "unavailable", unavailableReason: "automated_only" } }),
      off: await out("Mail off", { tracking: { enabled: false, status: "unavailable", unavailableReason: "mail_off" } }),
      legacy: await out("Legacy mail (no tracking block)"),
      outside: await out("Sent from Gmail", { sentOutsideDashboard: true, sentByAdmin: null, sentByName: "" }),
      failed: await out("Failed mail", { status: "failed", failureReason: "x", tracking: { enabled: true, tokenHash: hashToken("d"), status: "pending" } }),
      sending: await out("Sending mail", { status: "sending", tracking: { enabled: true, tokenHash: hashToken("e"), status: "pending" } }),
      multi: await out("To and Cc", { to: [{ address: "a@gmail.com" }], cc: [{ address: "b@gmail.com" }], tracking: { enabled: true, tokenHash: hashToken("f"), status: "opened", firstOpenedAt: opened, lastOpenedAt: opened, openCount: 1 } }),
      replied: await out("Replied mail", { status: "replied", tracking: { enabled: true, tokenHash: hashToken("g"), status: "opened", firstOpenedAt: opened, lastOpenedAt: opened, openCount: 1 } }),
    };
  });

  test("each Sent row carries a tracking summary", async () => {
    const list = await get("/messages?folder=sent");
    const by = (s) => list.items.find((i) => i.subject === s).tracking;
    assert.deepEqual(by("Opened mail"), { status: "opened", reason: "", firstOpenedAt: "2026-10-05T10:05:00.000Z", lastOpenedAt: "2026-10-05T12:00:00.000Z", openCount: 3, multiRecipient: false });
    assert.deepEqual([by("Pending mail").status, by("Pending mail").openCount], ["pending", 0]);
    assert.deepEqual([by("Automated only").status, by("Automated only").reason], ["unavailable", "automated_only"]);
    assert.deepEqual([by("Mail off").status, by("Mail off").reason], ["unavailable", "mail_off"]);
    assert.deepEqual([by("Legacy mail (no tracking block)").status, by("Legacy mail (no tracking block)").reason], ["unavailable", "tracking_off"]);
    assert.deepEqual([by("Sent from Gmail").status, by("Sent from Gmail").reason], ["unavailable", "outside_dashboard"]);
  });

  test("multi-recipient mail is flagged so the screen can word it 'by at least one recipient'", async () => {
    const list = await get("/messages?folder=sent");
    assert.equal(list.items.find((i) => i.subject === "To and Cc").tracking.multiRecipient, true);
    assert.equal(list.items.find((i) => i.subject === "Opened mail").tracking.multiRecipient, false);
  });

  test("failed and still-sending mail show no tracking, nor does received mail", async () => {
    const list = await get("/messages?folder=all");
    assert.equal(list.items.find((i) => i.subject === "Failed mail").tracking, null);
    assert.equal(list.items.find((i) => i.subject === "Sending mail").tracking, null);
    const inbound = new EmailMessage({ mailbox: support._id, direction: "in", status: "received", gmailMessageId: "gin", from: { address: "c@gmail.com" }, subject: "Inbound", messageDate: new Date() });
    inbound.setContent({ text: "x", html: "", snippet: "x" });
    await inbound.save();
    assert.equal((await get("/messages?folder=inbox")).items[0].tracking, null);
  });

  test("filter: Opened", async () => {
    assert.deepEqual(subjects(await get("/messages?folder=sent&openStatus=opened")), ["Opened mail", "Replied mail", "To and Cc"]);
  });
  test("filter: Not opened yet", async () => {
    assert.deepEqual(subjects(await get("/messages?folder=sent&openStatus=pending")), ["Pending mail"]);
  });
  test("filter: Tracking unavailable includes old mail without a tracking block, but never failed/sending", async () => {
    assert.deepEqual(subjects(await get("/messages?folder=sent&openStatus=unavailable")), ["Automated only", "Legacy mail (no tracking block)", "Mail off", "Sent from Gmail"]);
  });
  test("the filter combines with other filters and is ignored outside Sent", async () => {
    assert.deepEqual(subjects(await get(`/messages?folder=sent&openStatus=opened&status=replied`)), ["Replied mail"]);
    const all = await get("/messages?folder=all&openStatus=opened");
    assert.ok(all.items.length >= 10, "not applied to All mail");
  });
  test("an invalid filter value is rejected", async () => {
    const res = await fetch(`${base}/messages?folder=sent&openStatus=seen`, { headers: { "x-test-admin": String(priya._id) } });
    assert.equal(res.status, 400);
    // an object value (query-string operator injection) is refused by the parser itself
    const { parseListQuery } = require("../services/email/emailQueries");
    assert.throws(() => parseListQuery({ folder: "sent", openStatus: { $ne: "x" } }), /Invalid/);
    assert.throws(() => parseListQuery({ folder: "sent", openStatus: ["opened"] }), /Invalid/);
  });

  test("the mail page carries tracking for every sent mail in the thread, without any token", async () => {
    const page = await get(`/messages/${rows.opened._id}`);
    assert.equal(page.message.tracking.status, "opened");
    assert.equal(page.thread[0].tracking.openCount, 3);
    const s = JSON.stringify(page);
    assert.ok(!/tokenHash|"token"|\/api\/e\//.test(s));
    assert.ok(!s.includes(hashToken("a")));
  });

  test("opening the mail in the dashboard never counts as an open", async () => {
    await get(`/messages/${rows.pending._id}`);
    await fetch(`${base}/messages/${rows.pending._id}/view`, { method: "POST", headers: { "x-test-admin": String(priya._id) } });
    const t = (await EmailMessage.findById(rows.pending._id)).tracking;
    assert.deepEqual([t.status, t.openCount, t.firstOpenedAt], ["pending", 0, null]);
  });
});
