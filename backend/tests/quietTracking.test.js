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
const EmailSettings = require("../models/EmailSettings");
const EmailTrackingOptOut = require("../models/EmailTrackingOptOut");
const User = require("../models/User");
const adminEmail = require("../routes/adminEmail");
const { getTrackingState, clearSettingsCache } = require("../services/email/emailSettings");
const { trackingUrl, linkUrl, downloadUrl } = require("../services/email/trackingToken");
const { buildHtml } = require("../services/email/emailHtml");

// "Recipients must not see that we track them": what a recipient can see in a tracked mail.
const BASE = "https://uat.example.com";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const decodeQP = (s) => s.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

// Words that would tell a reader the mail is tracked, in anything a recipient can read.
const GIVEAWAY = /track|record|monitor|analytic|beacon|pixel|telemetry|receipt|secure|opened|clicked|do not track/i;

describe("the notice switch: off unless a Super Admin switches it on", () => {
  let mongod;
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await EmailSettings.init();
  });
  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await EmailSettings.deleteMany({});
    clearSettingsCache();
  });
  const env = { EMAIL_TRACKING_ENABLED: "true", PUBLIC_TRACKING_BASE_URL: BASE };

  test("a fresh settings document has the notice off", async () => {
    const s = await getTrackingState({ env, full: true });
    assert.equal(s.disclosureEnabled, false);
    assert.equal((await EmailSettings.findOne({ key: "email" })).footerNoticeEnabled, false);
  });

  test("the gate being closed also means off", async () => {
    assert.equal((await getTrackingState({ env: {} })).disclosureEnabled, false);
  });

  test("an older document that still carries the previous default 'on' is NOT read as switched on", async () => {
    await EmailSettings.collection.insertOne({ key: "email", trackingEnabled: true, disclosureEnabled: true, disclosureText: "Old line." });
    const s = await getTrackingState({ env, full: true });
    assert.equal(s.disclosureEnabled, false);
    assert.equal(s.active, true, "tracking itself is unaffected");
  });

  test("only an explicit switch-on turns it on", async () => {
    await EmailSettings.create({ key: "email", trackingEnabled: true, footerNoticeEnabled: true });
    clearSettingsCache();
    assert.equal((await getTrackingState({ env, full: true })).disclosureEnabled, true);
  });
});

describe("what a recipient can see", () => {
  let mongod, server, base, gmail, state, support, priya;
  const store = { async put() {}, async get() { return Buffer.from("x"); }, async remove() {} };
  const fakeAuth = (req, res, next) => { req.user = { id: req.headers["x-test-admin"], role: "admin" }; next(); };
  const ON = { active: true, linksActive: true, secureLinksActive: true, secureLinkDays: 7, baseUrl: BASE, disclosureEnabled: false, disclosureText: "" };

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

  const BODY = "Hello Anita,\nForm: https://example.com/form\nInfo: www.example.org/info\nThanks.";

  async function send(fields = {}, files = []) {
    const fd = new FormData();
    const all = { from: String(support._id), to: "anita@gmail.com", subject: "Your enquiry", body: BODY, ...fields };
    for (const [k, v] of Object.entries(all)) if (v !== undefined) fd.set(k, v);
    for (const [name, buf] of files) fd.append("files", new Blob([buf], { type: "application/pdf" }), name);
    const res = await fetch(`${base}/send`, { method: "POST", headers: { "x-test-admin": String(priya._id) }, body: fd });
    assert.equal(res.status, 201, JSON.stringify(await res.clone().json()));
    const mime = gmail.sent.at(-1);
    const [textPart, htmlPart = ""] = mime.split(/Content-Type: text\/html/i);
    return { mime, decoded: decodeQP(mime), text: decodeQP(textPart), html: decodeQP(htmlPart) };
  }

  // Everything a person could read: the text and HTML with addresses and markup removed.
  const readable = (s) => s.replace(/<[^>]*>/g, " ").replace(/https?:\/\/\S+/g, " ").replace(/&[a-z]+;/g, " ");

  test("footer notice OFF: no notice line in the text part or the HTML part, whatever is tracked", async () => {
    const m = await send({ requestReceipt: "1", secureLinks: "1" }, [["report.pdf", PDF]]);
    for (const part of [m.text, m.html]) {
      assert.ok(!/Do not track|technology that records|This email may/i.test(part), part);
    }
    assert.ok(!/Do not track/i.test(m.decoded));
  });

  test("notice OFF: nothing in the readable mail uses tracking wording (opens + links + downloads + receipt)", async () => {
    const m = await send({ requestReceipt: "1", secureLinks: "1" }, [["report.pdf", PDF]]);
    assert.ok(!GIVEAWAY.test(readable(m.text)), readable(m.text));
    assert.ok(!GIVEAWAY.test(readable(m.html)), readable(m.html));
  });

  test("the only header that gives the receipt request away is the one the mail app acts on", async () => {
    const headers = (mime) => mime.split(/\r?\n\r?\n/)[0];
    const withReceipt = await send({ requestReceipt: "1" });
    assert.match(headers(withReceipt.mime), /^Disposition-Notification-To: support@humancareconnect\.co\r?$/m);
    const plain = await send({});
    assert.ok(!/^X-/im.test(headers(plain.mime)), "no X- headers");
    assert.ok(!/Disposition-Notification-To/i.test(headers(plain.mime)));
    assert.ok(!/track|beacon|pixel/i.test(headers(plain.mime)));
  });

  test("the image is invisible: 1x1, empty alt, no border, last in the body, on our own path", async () => {
    const { html } = await send({});
    const img = html.match(/<img [^>]*>/)[0];
    assert.match(img, /width="1"/);
    assert.match(img, /height="1"/);
    assert.match(img, /alt=""/);
    assert.match(img, /border="0"/);
    assert.match(img, /style="border:0;width:1px;height:1px"/);
    assert.match(img, /src="https:\/\/uat\.example\.com\/api\/e\/[A-Za-z0-9_-]{32}\.gif"/);
    assert.ok(!/title=|class=|id=/.test(img), "no attributes that could show as a tooltip or be styled");
    assert.match(html, /<img [^>]*>\s*<\/body>/, "after the last visible content");
  });

  test("link text stays exactly as typed; only the address behind it changes", async () => {
    const { html } = await send({});
    assert.match(html, /<a href="https:\/\/uat\.example\.com\/api\/l\/[A-Za-z0-9_-]{32}">https:\/\/example\.com\/form<\/a>/);
    assert.match(html, /<a href="https:\/\/uat\.example\.com\/api\/l\/[A-Za-z0-9_-]{32}">www\.example\.org\/info<\/a>/);
    assert.ok(!/<a [^>]*(title|rel|target)=/.test(html), "no extra attributes on links");
  });

  test("the plain-text part never carries a tracked address", async () => {
    const { text } = await send({});
    assert.match(text, /https:\/\/example\.com\/form/);
    assert.match(text, /www\.example\.org\/info/);
    assert.ok(!/\/api\/l\//.test(text));
  });

  test("secure-link text is only file name, size and expiry", async () => {
    const { text } = await send({ secureLinks: "1", body: "Please see the attached file." }, [["report.pdf", PDF]]);
    const block = text.slice(text.indexOf("Attachments ("));
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    assert.match(lines[0], /^Attachments \(available until \d{1,2} [A-Z][a-z]+ \d{4}, UTC\):$/);
    assert.match(lines[1], /^- report\.pdf \(\d+ KB\)$/);
    assert.match(lines[2], /^https:\/\/uat\.example\.com\/api\/d\/[A-Za-z0-9_-]{32}$/);
    assert.ok(!GIVEAWAY.test(lines.slice(0, 2).join(" ")));
  });

  test("the paths hold no tracking words", () => {
    const t = "a".repeat(32);
    const urls = [trackingUrl(BASE, t), linkUrl(BASE, t), downloadUrl(BASE, t)];
    assert.deepEqual(urls.map((u) => new URL(u).pathname), [`/api/e/${t}.gif`, `/api/l/${t}`, `/api/d/${t}`]);
    const words = /track|pixel|open|click|beacon|analytic|stat|read|receipt|download|secure|mail|email|campaign|redirect|go\b|out\b/i;
    for (const u of urls) assert.ok(!words.test(new URL(u).pathname.replace(t, "")), u);
  });

  test("buildHtml itself writes no tracking wording", () => {
    const html = buildHtml("Hello https://example.com", { imageUrl: `${BASE}/api/e/${"a".repeat(32)}.gif`, linkTracker: () => `${BASE}/api/l/${"b".repeat(32)}` });
    assert.ok(!GIVEAWAY.test(readable(html)), html);
    assert.ok(!/<!--/.test(html), "no comments");
    assert.deepEqual(html.match(/<meta[^>]*>/gi), ["<meta charset=\"utf-8\">"], "only the character-set declaration");
    assert.ok(!/<title|data-/i.test(html));
  });

  test("with the notice switched ON, the automatic wording is in both parts", async () => {
    state = { ...ON, disclosureEnabled: true };
    const m = await send({ requestReceipt: "1" });
    for (const part of [m.text, m.html]) {
      assert.ok(part.includes("This email may include technology that records whether it was opened and which links in it were clicked."), part);
      assert.ok(part.includes("It also asks your mail app to send a read receipt"));
    }
  });
});
