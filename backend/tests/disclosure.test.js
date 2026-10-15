const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Mailbox = require("../models/Mailbox");
const EmailMessage = require("../models/EmailMessage");
const EmailAttachment = require("../models/EmailAttachment");
const EmailDownloadLink = require("../models/EmailDownloadLink");
const EmailLink = require("../models/EmailLink");
const EmailTrackingOptOut = require("../models/EmailTrackingOptOut");
const User = require("../models/User");
const adminEmail = require("../routes/adminEmail");
const { automaticDisclosure, composeDisclosure, disclosureExamples, STOP } = require("../services/email/disclosure");
const { countTrackableLinks } = require("../services/email/emailHtml");

const BASE = "https://uat.example.com";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const decodeQP = (s) => s.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

describe("automatic notice wording", () => {
  const f = (...on) => Object.fromEntries(["opens", "links", "downloads", "receipt"].map((k) => [k, on.includes(k)]));

  test("nothing tracked → no notice", () => {
    assert.equal(automaticDisclosure(f()), "");
    assert.equal(automaticDisclosure(), "");
  });

  test("each way of tracking is named, and only the ones that apply", () => {
    assert.match(automaticDisclosure(f("opens")), /records whether it was opened\./);
    assert.match(automaticDisclosure(f("links")), /records which links in it were clicked\./);
    assert.match(automaticDisclosure(f("downloads")), /records whether its download links were used\./);
    assert.match(automaticDisclosure(f("opens", "links")), /records whether it was opened and which links in it were clicked\./);
    assert.match(automaticDisclosure(f("opens", "links", "downloads")), /records whether it was opened, which links in it were clicked and whether its download links were used\./);
    for (const [flags, absent] of [[f("opens"), /clicked|download|receipt/], [f("links"), /opened|download|receipt/], [f("downloads"), /opened|clicked|receipt/]]) {
      assert.ok(!absent.test(automaticDisclosure(flags)), automaticDisclosure(flags));
    }
  });

  test("a read receipt is described as the recipient's choice, alone or with the rest", () => {
    assert.match(automaticDisclosure(f("receipt")), /^This email asks your mail app to send a read receipt when it is displayed\. You can decline\./);
    assert.ok(!/records/.test(automaticDisclosure(f("receipt"))), "nothing is recorded by us on its own");
    assert.match(automaticDisclosure(f("opens", "receipt")), /records whether it was opened\. It also asks your mail app to send a read receipt, which you can decline\./);
  });

  test("every notice ends with how to stop it", () => {
    for (const e of disclosureExamples()) assert.ok(e.text.endsWith(STOP), e.label);
    assert.equal(STOP, 'To stop this, reply to this email with "Do not track".');
  });

  test("all 15 combinations exist, are different, and are labelled", () => {
    const ex = disclosureExamples();
    assert.equal(ex.length, 15);
    assert.equal(new Set(ex.map((e) => e.text)).size, 15);
    assert.equal(new Set(ex.map((e) => e.label)).size, 15);
    assert.equal(ex[0].label, "opens");
    assert.equal(ex.at(-1).label, "opens + links + downloads + read receipt");
  });

  test("the notice is plain text on one paragraph, with no URL or HTML in it", () => {
    for (const e of disclosureExamples()) {
      assert.ok(!/[<>\n]|https?:/.test(e.text), e.label);
    }
  });

  test("switched off → none; a custom line replaces the automatic one; empty → automatic", () => {
    const on = { disclosureEnabled: true, disclosureText: "" };
    assert.equal(composeDisclosure(f("opens"), { ...on, disclosureEnabled: false }), "");
    assert.equal(composeDisclosure(f("receipt"), { ...on, disclosureEnabled: false }), "");
    assert.equal(composeDisclosure(f("opens"), { ...on, disclosureText: "  Custom line.  " }), "Custom line.");
    assert.equal(composeDisclosure(f("opens"), on), automaticDisclosure(f("opens")));
    assert.equal(composeDisclosure(f(), { ...on, disclosureText: "Custom line." }), "", "a custom line is not added to mail that is not tracked");
  });
});

describe("which links count for the wording", () => {
  test("http(s) and www. addresses count; email addresses and look-alikes do not", () => {
    assert.equal(countTrackableLinks("see https://example.com and www.example.org"), 2);
    assert.equal(countTrackableLinks("write to a@b.co or visit example.com"), 0);
    assert.equal(countTrackableLinks(""), 0);
    assert.equal(countTrackableLinks(null), 0);
  });
});

describe("the notice on real outgoing mail", () => {
  let mongod, server, base, gmail, state, support, priya;
  const store = { async put() {}, async get() { return Buffer.from("x"); }, async remove() {} };
  const fakeAuth = (req, res, next) => { req.user = { id: req.headers["x-test-admin"], role: "admin" }; next(); };
  const ON = { active: true, linksActive: true, secureLinksActive: true, secureLinkDays: 7, baseUrl: BASE, disclosureEnabled: true, disclosureText: "" };

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([Mailbox.init(), EmailMessage.init(), EmailAttachment.init(), EmailDownloadLink.init(), EmailLink.init(), EmailTrackingOptOut.init(), User.init()]);
    const app = express();
    app.use(express.json());
    app.use("/api/admin/email", (req, res, next) => adminEmail.create({ guard: [fakeAuth], getGmail: () => gmail, store, trackingState: async () => state })(req, res, next));
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
    await Promise.all([Mailbox.deleteMany({}), EmailMessage.deleteMany({}), EmailAttachment.deleteMany({}), EmailDownloadLink.deleteMany({}), EmailLink.deleteMany({}), EmailTrackingOptOut.deleteMany({}), User.deleteMany({})]);
    support = await Mailbox.create({ address: "support@humancareconnect.co", displayName: "Support", signature: "Human Care Connect" });
    priya = await User.create({ name: "Priya", email: "p@x.co", role: "admin" });
    state = { ...ON };
    gmail = { sent: [], async sendRaw(raw) { this.sent.push(raw.toString()); return { id: `g${this.sent.length}`, threadId: `t${this.sent.length}` }; } };
  });

  // → the plain-text part of the mail that was sent
  async function sendAndRead({ files = [], ...fields } = {}) {
    const fd = new FormData();
    const all = { from: String(support._id), to: "anita@gmail.com", subject: "Hello", body: "Thank you for your enquiry.", ...fields };
    for (const [k, v] of Object.entries(all)) if (v !== undefined) fd.set(k, v);
    for (const [name, buf] of files) fd.append("files", new Blob([buf], { type: "application/pdf" }), name);
    const res = await fetch(`${base}/send`, { method: "POST", headers: { "x-test-admin": String(priya._id) }, body: fd });
    assert.equal(res.status, 201, JSON.stringify(await res.clone().json()));
    const mime = gmail.sent.at(-1);
    const text = decodeQP(mime.split(/Content-Type: text\/html/i)[0]);
    return { mime, text, all: decodeQP(mime) };
  }
  const phrase = (flags) => automaticDisclosure(flags);

  test("opens only", async () => {
    const { text } = await sendAndRead({ trackOpens: "1" });
    assert.ok(text.includes(phrase({ opens: true })), text);
    assert.ok(!/clicked|download links|read receipt/.test(text));
  });

  test("opens + links when the mail has a link", async () => {
    const { text } = await sendAndRead({ body: "Details: https://example.com/care" });
    assert.ok(text.includes(phrase({ opens: true, links: true })), text);
  });

  test("a mail without any link does not claim links are tracked", async () => {
    const { text } = await sendAndRead({ body: "No links here." });
    assert.ok(text.includes(phrase({ opens: true })));
    assert.ok(!/which links/.test(text));
  });

  test("a link in the signature counts", async () => {
    await Mailbox.updateOne({ _id: support._id }, { signature: "Human Care Connect\nwww.humancareconnect.co" });
    const { text } = await sendAndRead({ body: "No links in the body." });
    assert.ok(text.includes(phrase({ opens: true, links: true })), text);
  });

  test("opens + downloads (secure links)", async () => {
    const { text } = await sendAndRead({ secureLinks: "1", files: [["r.pdf", PDF]] });
    assert.ok(text.includes(phrase({ opens: true, downloads: true })), text);
    assert.ok(text.includes("valid until"), "the expiry stays in the mail itself");
  });

  test("downloads only: secure links with 'Track opens' unticked still carry a notice", async () => {
    const { text, mime } = await sendAndRead({ secureLinks: "1", trackOpens: "0", files: [["r.pdf", PDF]] });
    assert.ok(text.includes(phrase({ downloads: true })), text);
    assert.ok(!/multipart\/alternative/i.test(mime));
  });

  test("read receipt only: 'Track opens' unticked still carries a notice", async () => {
    const { text, mime } = await sendAndRead({ requestReceipt: "1", trackOpens: "0" });
    assert.ok(text.includes(phrase({ receipt: true })), text);
    assert.match(mime, /Disposition-Notification-To/);
  });

  test("everything at once", async () => {
    const { text } = await sendAndRead({ body: "See www.example.com", requestReceipt: "1", secureLinks: "1", files: [["r.pdf", PDF]] });
    assert.ok(text.includes(phrase({ opens: true, links: true, downloads: true, receipt: true })), text);
  });

  test("the HTML part carries the same notice", async () => {
    const { mime } = await sendAndRead({ body: "Details: https://example.com/care" });
    const html = decodeQP(mime.split(/Content-Type: text\/html/i)[1] || "");
    assert.ok(html.includes("which links in it were clicked"));
    assert.ok(html.includes("Do not track"));
  });

  test("nothing tracked → no notice at all", async () => {
    const { text, mime } = await sendAndRead({ trackOpens: "0" });
    assert.ok(!/Do not track|technology/.test(mime));
    assert.ok(!/Do not track/.test(text));
  });

  test("notice switched off → none, whatever is tracked", async () => {
    state = { ...ON, disclosureEnabled: false };
    const { mime } = await sendAndRead({ requestReceipt: "1", secureLinks: "1", files: [["r.pdf", PDF]], body: "https://example.com" });
    assert.ok(!/Do not track/.test(mime));
  });

  test("a custom line replaces the automatic wording on every kind of tracked mail", async () => {
    state = { ...ON, disclosureText: "Our own wording about tracking." };
    const a = await sendAndRead({});
    const b = await sendAndRead({ requestReceipt: "1", trackOpens: "0" });
    for (const m of [a, b]) {
      assert.ok(m.text.includes("Our own wording about tracking."));
      assert.ok(!/Do not track/.test(m.text));
    }
  });

  test("the notice sits after the signature divider, below the message", async () => {
    const { text } = await sendAndRead({});
    const i = text.indexOf("Thank you for your enquiry.");
    const j = text.indexOf("-- ");
    const k = text.indexOf("This email may include technology");
    assert.ok(i >= 0 && j > i && k > j, text);
  });
});
