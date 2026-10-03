const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Mailbox = require("../models/Mailbox");
const EmailMessage = require("../models/EmailMessage");
const EmailAttachment = require("../models/EmailAttachment");
const User = require("../models/User");
const adminEmail = require("../routes/adminEmail");
const { emailSendLimiter } = require("../middleware/rateLimiters");

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
const b64 = (s) => Buffer.from(s).toString("base64url");
const NOW = Date.now();

describe("admin email: send, reply, spam, attachments", () => {
  let mongod, server, base;
  let support, tech, priya, aman, rahul;
  let gmail, store, limiter;

  const fakeAuth = (req, res, next) => {
    const id = req.headers["x-test-admin"];
    if (!id) return res.status(401).json({ msg: "No token provided." });
    req.user = { id, role: "admin" };
    next();
  };

  function makeGmail() {
    const g = {
      sent: [], spam: [], gotMessages: [], gotAttachments: [], failSend: null, failSpam: false, messages: new Map(), n: 0,
      async sendRaw(raw, threadId) {
        if (g.failSend) throw g.failSend;
        g.n += 1;
        g.sent.push({ raw: raw.toString(), threadId });
        return { id: `sent-${g.n}`, threadId: threadId || `thread-new-${g.n}` };
      },
      async setSpam(id, isSpam) {
        if (g.failSpam) throw new Error("gmail down");
        g.spam.push({ id, isSpam });
      },
      async getMessage(id) { g.gotMessages.push(id); return g.messages.get(id) || null; },
      async getAttachment(messageId, attachmentId) { g.gotAttachments.push(attachmentId); return Buffer.from("INBOUND-FILE-BYTES"); },
    };
    return g;
  }

  function makeStore() {
    const files = new Map();
    return { files, failPut: false,
      async put(key, buffer) { if (this.failPut) throw new Error("s3 down"); files.set(key, Buffer.from(buffer)); },
      async get(key) { if (!files.has(key)) throw new Error("NoSuchKey"); return files.get(key); },
      async remove(key) { files.delete(key); },
    };
  }

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([Mailbox.init(), EmailMessage.init(), EmailAttachment.init(), User.init()]);
    const app = express();
    app.use(express.json());
    app.use("/api/admin/email", (req, res, next) =>
      adminEmail.create({ guard: [fakeAuth], getGmail: () => gmail, store, sendLimiter: limiter })(req, res, next));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}/api/admin/email`;
  });
  after(async () => {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await mongod.stop();
  });

  let inbound, inboundNoReply, spamMsg, sentMsg;
  let seq = 0;
  async function mk(box, o) {
    seq += 1;
    const doc = new EmailMessage({
      mailbox: box._id, direction: "in", status: "received",
      gmailMessageId: `g${seq}`, gmailThreadId: `t${seq}`, rfcMessageId: `<m${seq}@mail.test>`,
      from: { name: "Client", address: "client@gmail.com" },
      to: [{ address: box.address }], subject: "Subject", messageDate: new Date(NOW - 3_600_000), ...o,
    });
    doc.setContent({ text: "Hello", html: "", snippet: "Hello" });
    await doc.save();
    return doc;
  }

  beforeEach(async () => {
    await Promise.all([Mailbox.deleteMany({}), EmailMessage.deleteMany({}), EmailAttachment.deleteMany({}), User.deleteMany({})]);
    gmail = makeGmail();
    store = makeStore();
    limiter = (_req, _res, next) => next();
    [rahul, priya, aman] = await User.create([
      { name: "Rahul Sharma", email: "rahul@x.co", role: "superadmin" },
      { name: "Priya Patil", email: "priya@x.co", role: "admin" },
      { name: "Aman Verma", email: "aman@x.co", role: "admin" },
    ]);
    [support, tech] = await Mailbox.create([
      { address: "support@humancareconnect.co", displayName: "Support", sortOrder: 1 },
      { address: "tech@humancareconnect.co", displayName: "Tech", sortOrder: 2 },
    ]);
    inbound = await mk(support, { from: { name: "Meera Desai", address: "meera@gmail.com" }, subject: "Report download problem", gmailThreadId: "T-meera", rfcMessageId: "<meera1@mail.gmail.com>", references: ["<earlier@mail.gmail.com>"] });
    inboundNoReply = await mk(tech, { from: { name: "Vendor", address: "vendor@cloudhost.in" }, subject: "Quote", gmailThreadId: "T-vendor" });
    spamMsg = await mk(tech, { from: { address: "offers@cheap.biz" }, subject: "WIN", isSpam: true, gmailThreadId: "T-spam" });
    sentMsg = await mk(support, { direction: "out", status: "sent", from: { name: "Human Care Connect", address: support.address }, to: [{ address: "kavita@outlook.com" }], subject: "Welcome", gmailThreadId: "T-kavita", sentByAdmin: aman._id, sentByName: "Aman Verma", rfcMessageId: "<ours1@humancareconnect.co>" });
  });

  const headers = (as) => (as ? { "x-test-admin": String(as._id) } : {});
  function form(fields = {}, files = []) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    for (const f of files) fd.append("files", new Blob([f.content]), f.name);
    return fd;
  }
  async function send(as, fields, files) {
    const res = await fetch(`${base}/send`, { method: "POST", headers: headers(as), body: form(fields, files) });
    return { status: res.status, body: await res.json() };
  }
  async function reply(as, id, fields = {}, files) {
    const res = await fetch(`${base}/messages/${id}/reply`, { method: "POST", headers: headers(as), body: form(fields, files) });
    return { status: res.status, body: await res.json() };
  }
  async function post(path, as) {
    const res = await fetch(base + path, { method: "POST", headers: headers(as) });
    return { status: res.status, body: await res.json() };
  }
  const valid = (over = {}) => ({ from: String(support._id), to: "anita@gmail.com", subject: "Appointment", body: "See you at 11.", ...over });

  describe("POST /send", () => {
    test("sends from the company ID and records the logged-in admin as the sender", async () => {
      const { status, body } = await send(priya, valid({ cc: "boss@x.co" }));
      assert.equal(status, 201);
      assert.equal(body.message.status, "sent");
      assert.deepEqual(body.message.sentBy, { id: String(priya._id), name: "Priya Patil" });
      assert.equal(body.message.mailbox.address, support.address);

      const row = await EmailMessage.findById(body.message.id);
      assert.equal(row.direction, "out");
      assert.equal(String(row.sentByAdmin), String(priya._id));
      assert.equal(row.sentByName, "Priya Patil");
      assert.equal(row.gmailMessageId, "sent-1");
      assert.equal(row.from.address, support.address);
      assert.deepEqual(row.cc.map((a) => a.address), ["boss@x.co"]);
      assert.equal(row.getContent().text.includes("See you at 11."), true);
    });

    test("the client sees only the company ID and footer, never the admin's name", async () => {
      await send(priya, valid());
      const raw = gmail.sent[0].raw;
      assert.match(raw, /^From: .*support@humancareconnect\.co/m);
      assert.match(raw, /^To: anita@gmail\.com/m);
      assert.match(raw, /Human Care Connect/);
      assert.doesNotMatch(raw, /Priya|priya@x\.co|Patil/);
      assert.doesNotMatch(raw, /X-HC|Sent-By/i);
    });

    test("attribution cannot be spoofed from the request", async () => {
      const { body } = await send(priya, valid({ sentBy: String(rahul._id), sentByAdmin: String(rahul._id), sentByName: "Rahul Sharma", status: "replied" }));
      const row = await EmailMessage.findById(body.message.id);
      assert.equal(String(row.sentByAdmin), String(priya._id));
      assert.equal(row.sentByName, "Priya Patil");
      assert.equal(row.status, "sent");
    });

    test("From must be a company mailbox this admin may use", async () => {
      assert.equal((await send(priya, valid({ from: "not-an-id" }))).status, 400);
      assert.equal((await send(priya, valid({ from: String(new mongoose.Types.ObjectId()) }))).status, 400);
      await Mailbox.updateOne({ _id: tech._id }, { $set: { allowedAdmins: [rahul._id] } });
      assert.equal((await send(priya, valid({ from: String(tech._id) }))).status, 400);
      assert.equal((await send(rahul, valid({ from: String(tech._id) }))).status, 201);
      assert.equal(gmail.sent.length, 1);
    });

    test("validates recipients, subject and body before anything is stored or sent", async () => {
      const bad = [
        valid({ to: "" }), valid({ to: "not-an-email" }), valid({ cc: "a@b.co, nope" }),
        valid({ subject: "  " }), valid({ body: "   " }),
        valid({ to: Array.from({ length: 51 }, (_, i) => `u${i}@x.co`).join(",") }),
        valid({ subject: "x".repeat(999) }),
      ];
      for (const fields of bad) assert.equal((await send(priya, fields)).status, 400, JSON.stringify(fields).slice(0, 60));
      assert.equal(gmail.sent.length, 0);
      assert.equal(await EmailMessage.countDocuments({ direction: "out", sentByAdmin: priya._id }), 0);
    });

    test("a subject cannot inject headers", async () => {
      await send(priya, valid({ subject: "Hi\r\nBcc: evil@x.co" }));
      assert.doesNotMatch(gmail.sent[0].raw, /^Bcc:/im);
    });

    test("the same clientRequestId never sends twice (double-click)", async () => {
      const first = await send(priya, valid({ clientRequestId: "req-1" }));
      const second = await send(priya, valid({ clientRequestId: "req-1" }));
      assert.equal(first.status, 201);
      assert.equal(second.status, 200);
      assert.equal(second.body.duplicate, true);
      assert.equal(second.body.message.id, first.body.message.id);
      assert.equal(gmail.sent.length, 1);
    });

    test("two simultaneous submits with the same key send exactly once", async () => {
      const results = await Promise.all([send(priya, valid({ clientRequestId: "race" })), send(priya, valid({ clientRequestId: "race" }))]);
      assert.equal(gmail.sent.length, 1);
      assert.equal(results.filter((r) => r.body.duplicate).length, 1);
      assert.equal(await EmailMessage.countDocuments({ clientRequestId: "race" }), 1);
    });

    test("a Gmail failure is recorded as Failed with a reason and shown in Sent", async () => {
      gmail.failSend = Object.assign(new Error("Invalid To header"), { code: 400 });
      const { status, body } = await send(priya, valid());
      assert.equal(status, 502);
      assert.match(body.msg, /Gmail rejected/);
      const row = await EmailMessage.findById(body.messageId);
      assert.equal(row.status, "failed");
      assert.match(row.failureReason, /Invalid To header/);
      const list = await (await fetch(`${base}/messages?folder=sent&status=failed`, { headers: headers(priya) })).json();
      assert.ok(list.items.some((i) => i.id === body.messageId && i.failureReason));
    });

    test("a rate-limit error gives a friendly message", async () => {
      gmail.failSend = Object.assign(new Error("User-rate limit exceeded"), { code: 429 });
      const { status, body } = await send(priya, valid());
      assert.equal(status, 502);
      assert.match(body.msg, /sending limit/);
    });

    test("the per-admin send throttle runs before anything is sent", async () => {
      limiter = (_req, res) => res.status(429).json({ msg: "Too many" });
      assert.equal((await send(priya, valid())).status, 429);
      assert.equal(gmail.sent.length, 0);
      assert.equal(typeof emailSendLimiter, "function");
    });

    test("requires a session", async () => {
      assert.equal((await send(null, valid())).status, 401);
    });
  });

  describe("attachments", () => {
    test("valid files are stored, attached to the mail and recorded", async () => {
      const { status, body } = await send(priya, valid(), [{ name: "slip.png", content: PNG }, { name: "Appointment Slip.pdf", content: PDF }]);
      assert.equal(status, 201);
      assert.equal(body.message.hasAttachments, true);
      assert.equal(body.message.attachmentCount, 2);
      assert.equal(store.files.size, 2);
      assert.ok([...store.files.keys()].every((k) => k.startsWith("email-attachments/")));
      assert.match(gmail.sent[0].raw, /filename=.?slip\.png/);
      const rows = await EmailAttachment.find({ message: body.message.id });
      assert.deepEqual(rows.map((r) => r.filename).sort(), ["Appointment Slip.pdf", "slip.png"]);
      assert.ok(rows.every((r) => r.s3Key && r.size > 0));
    });

    test("downloads come back as attachments, byte-for-byte, with safe headers", async () => {
      const { body } = await send(priya, valid(), [{ name: "slip.png", content: PNG }]);
      const att = await EmailAttachment.findOne({ message: body.message.id });
      const res = await fetch(`${base}/attachments/${att._id}`, { headers: headers(aman) });
      assert.equal(res.status, 200);
      assert.deepEqual(Buffer.from(await res.arrayBuffer()), PNG);
      assert.match(res.headers.get("content-disposition"), /^attachment; filename="slip\.png"/);
      assert.equal(res.headers.get("x-content-type-options"), "nosniff");
      assert.match(res.headers.get("content-security-policy"), /sandbox/);
    });

    test("rejects disallowed or disguised files", async () => {
      const cases = [
        { name: "setup.exe", content: Buffer.from("MZ\x90\x00fake") },
        { name: "page.html", content: Buffer.from("<script>alert(1)</script>") },
        { name: "logo.svg", content: Buffer.from("<svg onload='x'/>") },
        { name: "photo.png", content: Buffer.from("MZ\x90\x00 pretending to be a png") },
        { name: "report.pdf", content: Buffer.from("this is not a pdf at all") },
        { name: "notes.txt", content: Buffer.from([0x68, 0x00, 0x69, 0x00, 0x00]) },
        { name: "empty.pdf", content: Buffer.alloc(0) },
        { name: "script.txt", content: Buffer.from("#!/bin/sh\nrm -rf /") },
      ];
      for (const file of cases) {
        const res = await send(priya, valid(), [file]);
        assert.equal(res.status, 400, file.name);
      }
      assert.equal(gmail.sent.length, 0);
      assert.equal(store.files.size, 0);
    });

    test("enforces the per-file size, file count and total size limits", async () => {
      const big = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(11 * 1024 * 1024)]);
      assert.equal((await send(priya, valid(), [{ name: "big.pdf", content: big }])).status, 400);
      const many = Array.from({ length: 11 }, (_, i) => ({ name: `f${i}.png`, content: PNG }));
      assert.equal((await send(priya, valid(), many)).status, 400);
      const nine = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(9 * 1024 * 1024)]);
      const total = await send(priya, valid(), [{ name: "a.pdf", content: nine }, { name: "b.pdf", content: nine }]);
      assert.equal(total.status, 400);
      assert.match(total.body.msg, /18 MB/);
      assert.equal(gmail.sent.length, 0);
    });

    test("if storage fails nothing is sent and the mail is recorded as failed", async () => {
      store.failPut = true;
      const { status, body } = await send(priya, valid(), [{ name: "slip.png", content: PNG }]);
      assert.equal(status, 502);
      assert.equal(gmail.sent.length, 0);
      assert.equal((await EmailMessage.findById(body.messageId)).status, "failed");
    });

    test("an inbound file is fetched from Gmail once (via partId), then served from storage", async () => {
      const att = await EmailAttachment.create({ message: inbound._id, mailbox: support._id, filename: "screenshot.jpg", mimeType: "image/jpeg", size: 18, gmailAttachmentId: "OLD-ID", partId: "2" });
      gmail.messages.set(inbound.gmailMessageId, {
        id: inbound.gmailMessageId, threadId: "T-meera", labelIds: ["INBOX"], internalDate: String(NOW),
        payload: { mimeType: "multipart/mixed", headers: [{ name: "From", value: "meera@gmail.com" }], parts: [
          { mimeType: "text/plain", body: { data: b64("hi") } },
          { mimeType: "image/jpeg", filename: "screenshot.jpg", partId: "2", body: { attachmentId: "NEW-ID", size: 18 } },
        ] },
      });
      const first = await fetch(`${base}/attachments/${att._id}`, { headers: headers(priya) });
      assert.equal(await first.text(), "INBOUND-FILE-BYTES");
      assert.deepEqual(gmail.gotAttachments, ["NEW-ID"], "re-resolved the current Gmail attachment id");
      const cached = await EmailAttachment.findById(att._id);
      assert.ok(cached.s3Key);

      gmail.gotMessages.length = 0;
      const second = await fetch(`${base}/attachments/${att._id}`, { headers: headers(aman) });
      assert.equal(await second.text(), "INBOUND-FILE-BYTES");
      assert.deepEqual(gmail.gotMessages, [], "second download did not touch Gmail");
    });

    test("downloads are refused for spam mail and for mailboxes the admin cannot use", async () => {
      const spamAtt = await EmailAttachment.create({ message: spamMsg._id, mailbox: tech._id, filename: "claim.zip", mimeType: "application/zip", size: 5, s3Key: "k" });
      assert.equal((await fetch(`${base}/attachments/${spamAtt._id}`, { headers: headers(priya) })).status, 403);
      const okAtt = await EmailAttachment.create({ message: inboundNoReply._id, mailbox: tech._id, filename: "a.pdf", mimeType: "application/pdf", size: 3, s3Key: "k2" });
      await store.put("k2", Buffer.from("abc"));
      await Mailbox.updateOne({ _id: tech._id }, { $set: { allowedAdmins: [rahul._id] } });
      assert.equal((await fetch(`${base}/attachments/${okAtt._id}`, { headers: headers(priya) })).status, 404);
      assert.equal((await fetch(`${base}/attachments/${okAtt._id}`, { headers: headers(rahul) })).status, 200);
      assert.equal((await fetch(`${base}/attachments/not-an-id`, { headers: headers(priya) })).status, 404);
    });

    test("an HTML/SVG file type is never served with a renderable content type", async () => {
      const att = await EmailAttachment.create({ message: inboundNoReply._id, mailbox: tech._id, filename: "x.svg", mimeType: "image/svg+xml", size: 3, s3Key: "k3" });
      await store.put("k3", Buffer.from("<svg/>"));
      const res = await fetch(`${base}/attachments/${att._id}`, { headers: headers(priya) });
      assert.equal(res.headers.get("content-type"), "application/octet-stream");
    });
  });

  describe("POST /messages/:id/reply", () => {
    test("replies from the same company ID to the client, threaded, as the logged-in admin", async () => {
      const { status, body } = await reply(priya, inbound._id, { body: "Please try again now." });
      assert.equal(status, 201);
      assert.equal(body.message.mailbox.address, support.address);
      assert.deepEqual(body.message.sentBy, { id: String(priya._id), name: "Priya Patil" });
      assert.equal(body.message.subject, "Re: Report download problem");
      assert.deepEqual(body.message.to.map((a) => a.address), ["meera@gmail.com"]);

      const sent = gmail.sent[0];
      assert.equal(sent.threadId, "T-meera");
      assert.match(sent.raw, /^In-Reply-To: <meera1@mail\.gmail\.com>/m);
      assert.match(sent.raw, /^References: <earlier@mail\.gmail\.com> <meera1@mail\.gmail\.com>/m);
      assert.match(sent.raw, /^From: .*support@humancareconnect\.co/m);
      assert.doesNotMatch(sent.raw, /Priya|Patil/);

      const stored = await EmailMessage.findById(body.message.id);
      assert.equal(stored.gmailThreadId, "T-meera");
      assert.equal(stored.inReplyTo, "<meera1@mail.gmail.com>");
    });

    test("marks the received mail as replied by that admin, visible in lists", async () => {
      await reply(priya, inbound._id, { body: "On it." });
      const row = await EmailMessage.findById(inbound._id);
      assert.equal(row.repliedByName, "Priya Patil");
      assert.equal(String(row.repliedBy), String(priya._id));
      const list = await (await fetch(`${base}/messages?folder=inbox&status=replied`, { headers: headers(aman) })).json();
      assert.deepEqual(list.items.map((i) => i.repliedByName), ["Priya Patil"]);
    });

    test("recipient and subject come from stored data, not from the request", async () => {
      await reply(priya, inbound._id, { body: "Hi", to: "attacker@evil.co", cc: "x@evil.co", subject: "Hijacked", from: String(tech._id) });
      const raw = gmail.sent[0].raw;
      assert.match(raw, /^To: .*meera@gmail\.com/m);
      assert.doesNotMatch(raw, /evil\.co|Hijacked/);
      assert.match(raw, /support@humancareconnect\.co/);
    });

    test("reply attachments work and are recorded", async () => {
      const { body } = await reply(priya, inbound._id, { body: "Invoice attached." }, [{ name: "Invoice.pdf", content: PDF }]);
      assert.equal(body.message.attachmentCount, 1);
      assert.match(gmail.sent[0].raw, /filename=.?Invoice\.pdf/);
      assert.equal(await EmailAttachment.countDocuments({ message: body.message.id }), 1);
    });

    test("asks for confirmation when someone already replied (409), and sends nothing", async () => {
      await reply(priya, inbound._id, { body: "First." });
      gmail.sent.length = 0;
      const second = await reply(aman, inbound._id, { body: "Second." });
      assert.equal(second.status, 409);
      assert.equal(second.body.code, "ALREADY_REPLIED");
      assert.equal(second.body.repliedByName, "Priya Patil");
      assert.equal(gmail.sent.length, 0);
    });

    test("confirm=1 sends anyway and the latest replier is shown", async () => {
      await reply(priya, inbound._id, { body: "First." });
      const second = await reply(aman, inbound._id, { body: "Second.", confirm: "1" });
      assert.equal(second.status, 201);
      assert.equal((await EmailMessage.findById(inbound._id)).repliedByName, "Aman Verma");
    });

    test("two admins replying at the same moment: only one goes out", async () => {
      const results = await Promise.all([reply(priya, inbound._id, { body: "A" }), reply(aman, inbound._id, { body: "B" })]);
      assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
      assert.equal(gmail.sent.length, 1);
    });

    test("a failed send gives the claim back so the mail is not wrongly marked replied", async () => {
      gmail.failSend = new Error("boom");
      assert.equal((await reply(priya, inbound._id, { body: "Hi" })).status, 502);
      const row = await EmailMessage.findById(inbound._id);
      assert.equal(row.repliedAt, null);
      assert.equal(row.repliedBy, null);
      assert.equal(row.repliedByName, "");
      gmail.failSend = null;
      assert.equal((await reply(aman, inbound._id, { body: "Retry" })).status, 201);
    });

    test("a failed overridden send restores the previous replier", async () => {
      await reply(priya, inbound._id, { body: "First." });
      gmail.failSend = new Error("boom");
      assert.equal((await reply(aman, inbound._id, { body: "Second.", confirm: "1" })).status, 502);
      assert.equal((await EmailMessage.findById(inbound._id)).repliedByName, "Priya Patil");
    });

    test("a repeated request (same clientRequestId) neither claims nor sends again", async () => {
      await reply(priya, inbound._id, { body: "Hi", clientRequestId: "r1" });
      const again = await reply(priya, inbound._id, { body: "Hi", clientRequestId: "r1" });
      assert.equal(again.status, 200);
      assert.equal(again.body.duplicate, true);
      assert.equal(gmail.sent.length, 1);
    });

    test("cannot reply to spam, to unknown mail, or without a body", async () => {
      assert.equal((await reply(priya, spamMsg._id, { body: "Hi" })).status, 400);
      assert.equal((await reply(priya, new mongoose.Types.ObjectId(), { body: "Hi" })).status, 404);
      assert.equal((await reply(priya, "bad-id", { body: "Hi" })).status, 404);
      assert.equal((await reply(priya, inbound._id, { body: " " })).status, 400);
      assert.equal(gmail.sent.length, 0);
      assert.equal((await EmailMessage.findById(inbound._id)).repliedAt, null, "a rejected reply must not claim");
    });

    test("replying from our own sent mail follows up with the original recipient and claims nothing", async () => {
      const { status, body } = await reply(priya, sentMsg._id, { body: "Following up." });
      assert.equal(status, 201);
      assert.deepEqual(body.message.to.map((a) => a.address), ["kavita@outlook.com"]);
      assert.equal(body.message.subject, "Re: Welcome");
      assert.match(gmail.sent[0].raw, /^In-Reply-To: <ours1@humancareconnect\.co>/m);
    });

    test("replying from a sent mail whose client has answered goes to that answer and claims it", async () => {
      const clientAnswer = await mk(support, { from: { name: "Kavita", address: "kavita@outlook.com" }, subject: "Re: Welcome", gmailThreadId: "T-kavita", messageDate: new Date(NOW - 60_000), rfcMessageId: "<kav2@mail.test>" });
      const { status } = await reply(priya, sentMsg._id, { body: "Glad to help." });
      assert.equal(status, 201);
      assert.match(gmail.sent[0].raw, /^In-Reply-To: <kav2@mail\.test>/m);
      assert.equal((await EmailMessage.findById(clientAnswer._id)).repliedByName, "Priya Patil");
    });

    test("not allowed in a mailbox the admin cannot use", async () => {
      await Mailbox.updateOne({ _id: support._id }, { $set: { allowedAdmins: [rahul._id] } });
      assert.equal((await reply(priya, inbound._id, { body: "Hi" })).status, 404);
    });
  });

  describe("spam / not spam", () => {
    test("marking as spam updates Gmail first, then moves the mail to Spam", async () => {
      const { status, body } = await post(`/messages/${inboundNoReply._id}/spam`, priya);
      assert.equal(status, 200);
      assert.equal(body.message.isSpam, true);
      assert.deepEqual(gmail.spam, [{ id: inboundNoReply.gmailMessageId, isSpam: true }]);
      const inbox = await (await fetch(`${base}/messages?folder=inbox`, { headers: headers(priya) })).json();
      assert.ok(!inbox.items.some((i) => i.id === String(inboundNoReply._id)));
      const spam = await (await fetch(`${base}/messages?folder=spam`, { headers: headers(priya) })).json();
      assert.ok(spam.items.some((i) => i.id === String(inboundNoReply._id)));
    });

    test("not spam moves it back to Received", async () => {
      const { status, body } = await post(`/messages/${spamMsg._id}/not-spam`, aman);
      assert.equal(status, 200);
      assert.equal(body.message.isSpam, false);
      assert.deepEqual(gmail.spam, [{ id: spamMsg.gmailMessageId, isSpam: false }]);
    });

    test("if Gmail fails the mail is left unchanged", async () => {
      gmail.failSpam = true;
      assert.equal((await post(`/messages/${inboundNoReply._id}/spam`, priya)).status, 502);
      assert.equal((await EmailMessage.findById(inboundNoReply._id)).isSpam, false);
    });

    test("is idempotent, and only applies to received mail the admin can access", async () => {
      await post(`/messages/${spamMsg._id}/spam`, priya);
      assert.equal(gmail.spam.length, 0, "already spam: no Gmail call");
      assert.equal((await post(`/messages/${sentMsg._id}/spam`, priya)).status, 400);
      assert.equal((await post(`/messages/${new mongoose.Types.ObjectId()}/spam`, priya)).status, 404);
      await Mailbox.updateOne({ _id: tech._id }, { $set: { allowedAdmins: [rahul._id] } });
      assert.equal((await post(`/messages/${inboundNoReply._id}/spam`, priya)).status, 404);
    });
  });
});
