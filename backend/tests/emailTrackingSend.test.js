const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Mailbox = require("../models/Mailbox");
const EmailMessage = require("../models/EmailMessage");
const EmailAttachment = require("../models/EmailAttachment");
const EmailTrackingOptOut = require("../models/EmailTrackingOptOut");
const EmailSettings = require("../models/EmailSettings");
const User = require("../models/User");
const adminEmail = require("../routes/adminEmail");
const { buildRawMessage, composeText } = require("../services/gmail/mimeBuilder");
const { buildHtml, textToHtml } = require("../services/email/emailHtml");
const { newToken, hashToken, isTokenShape, trackingUrl } = require("../services/email/trackingToken");
const { normalizeBaseUrl, trackingEnv, getTrackingState, clearSettingsCache } = require("../services/email/emailSettings");
const { planTracking } = require("../services/email/emailTracking");

const BASE = "https://api.uat.example.com";
const ACTIVE = { active: true, baseUrl: BASE, disclosureEnabled: true, disclosureText: "We may track opens." };
const mailbox = { _id: new mongoose.Types.ObjectId(), address: "support@humancareconnect.co", isActive: true, signature: "Human Care Connect", trackOpensDefault: true };
const to = [{ name: "", address: "anita@gmail.com" }];

const decodeQP = (s) => s.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
// Minimal MIME reader: { headers, body, parts[] } (enough for nodemailer output).
function parseMime(raw) {
  const [head, ...rest] = raw.split(/\r?\n\r?\n/);
  const body = rest.join("\n\n");
  const headers = {};
  for (const line of head.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) headers[line.slice(0, i).toLowerCase()] = line.slice(i + 1).trim();
  }
  const m = /boundary="?([^";]+)"?/i.exec(headers["content-type"] || "");
  const parts = m ? body.split(`--${m[1]}`).slice(1, -1).map((p) => parseMime(p.replace(/^\r?\n/, ""))) : [];
  return { headers, body, parts };
}
const partText = (p) => {
  const enc = p.headers["content-transfer-encoding"] || "";
  const t = /quoted-printable/i.test(enc) ? decodeQP(p.body) : /base64/i.test(enc) ? Buffer.from(p.body, "base64").toString() : p.body;
  return t.replace(/\r\n/g, "\n");
};

describe("tracking token", () => {
  test("is 32 URL-safe characters, unique, and only its SHA-256 is stored", () => {
    const a = newToken(), b = newToken();
    assert.ok(isTokenShape(a.token));
    assert.notEqual(a.token, b.token);
    assert.equal(a.hash, hashToken(a.token));
    assert.equal(a.hash.length, 64);
    assert.ok(!a.hash.includes(a.token));
  });
  test("shape check rejects anything else", () => {
    for (const bad of ["", "short", "x".repeat(33), "x".repeat(31), "a/b".padEnd(32, "a"), null, undefined, 5, "é".repeat(32)]) assert.equal(isTokenShape(bad), false, String(bad));
  });
  test("the URL carries only the token", () => {
    const { token } = newToken();
    assert.equal(trackingUrl(BASE, token), `${BASE}/api/e/${token}.gif`);
  });
});

describe("tracking settings", () => {
  test("base URL must be public https without query/credentials", () => {
    assert.equal(normalizeBaseUrl("https://api.uat.example.com/"), BASE);
    for (const bad of ["", "http://api.example.com", "ftp://x.co", "https://u:p@x.co", "https://x.co?a=1", "not a url", undefined]) assert.equal(normalizeBaseUrl(bad), "", String(bad));
  });
  test("everything is off by default", () => {
    const e = trackingEnv({});
    assert.equal(e.envEnabled, false);
    assert.equal(e.baseUrl, "");
    assert.equal(e.graceSeconds, 60);
    assert.equal(e.dedupeMinutes, 10);
  });
  test("env values are parsed; grace may be 0", () => {
    const e = trackingEnv({ EMAIL_TRACKING_ENABLED: "true", PUBLIC_TRACKING_BASE_URL: BASE, EMAIL_TRACKING_GRACE_SECONDS: "0", EMAIL_TRACKING_IGNORE_IPS: "1.2.3.0/24, 5.6.7.8" });
    assert.equal(e.envEnabled, true);
    assert.equal(e.graceSeconds, 0);
    assert.deepEqual(e.ignoreIps, ["1.2.3.0/24", "5.6.7.8"]);
    assert.equal(trackingEnv({ EMAIL_TRACKING_ENABLED: "TRUE" }).envEnabled, false, "only the exact string 'true'");
  });
});

describe("emailHtml", () => {
  test("escapes everything, keeps line breaks and spacing", () => {
    const html = textToHtml(`<script>alert("x")</script> & 'q'\nline2\n  indented`);
    assert.ok(!html.includes("<script>"));
    assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; &#39;q&#39;<br>/);
    assert.match(html, /<br>\n &nbsp;indented/);
  });
  test("bare http(s) links stay clickable and are not rewritten; trailing punctuation is left out", () => {
    const html = textToHtml("See https://example.com/a?x=1&y=2. Also javascript:alert(1) and http://x.co/a).");
    assert.match(html, /<a href="https:\/\/example\.com\/a\?x=1&amp;y=2">https:\/\/example\.com\/a\?x=1&amp;y=2<\/a>\./);
    assert.match(html, /<a href="http:\/\/x\.co\/a">http:\/\/x\.co\/a<\/a>\)\./);
    assert.ok(!/href="javascript/.test(html));
  });
  test("a link containing a quote cannot break out of the attribute", () => {
    const html = textToHtml('https://x.co/"onmouseover="alert(1)');
    assert.ok(!html.includes('"onmouseover'));
    assert.ok(!/<a [^>]*" [a-z]+=/.test(html));
  });
  test("document ends with the 1x1 image only when an image URL is given", () => {
    const withImg = buildHtml("hi", { imageUrl: `${BASE}/api/e/${"a".repeat(32)}.gif` });
    assert.match(withImg, /<img src="https:\/\/api\.uat\.example\.com\/api\/e\/a{32}\.gif" width="1" height="1" alt="" border="0"[^>]*><\/body><\/html>$/);
    assert.ok(!buildHtml("hi").includes("<img"));
  });
});

describe("mimeBuilder with and without tracking", () => {
  test("without tracking the mail is plain text only — exactly as before", async () => {
    const { raw, text } = await buildRawMessage({ mailbox, to, subject: "Hello", body: "Thanks Anita" });
    const s = raw.toString();
    assert.ok(!/multipart/i.test(s));
    assert.ok(!/text\/html/i.test(s));
    assert.ok(!s.includes("/api/e/"));
    assert.equal(text, "Thanks Anita\n\n-- \nHuman Care Connect\n");
  });

  test("composeText without a disclosure is byte-identical to the old footer", () => {
    assert.equal(composeText("Body", "Footer"), "Body\n\n-- \nFooter\n");
    assert.equal(composeText("Body", ""), "Body\n");
    assert.equal(composeText("Body", "Footer", ""), "Body\n\n-- \nFooter\n");
    assert.equal(composeText("Body", "Footer", "Track note"), "Body\n\n-- \nFooter\n\nTrack note\n");
    assert.equal(composeText("Body", "", "Track note"), "Body\n\n-- \nTrack note\n");
  });

  test("with tracking: multipart/alternative, text part unchanged, HTML twin ends in the image", async () => {
    const { token } = newToken();
    const imageUrl = trackingUrl(BASE, token);
    const { raw, text } = await buildRawMessage({ mailbox, to, subject: "Hello", body: "Thanks Anita\nSee https://example.com", tracking: { imageUrl, disclosure: "We may track opens." } });
    const mime = parseMime(raw.toString());
    assert.match(mime.headers["content-type"], /^multipart\/alternative/i);
    assert.equal(mime.parts.length, 2);
    assert.match(mime.parts[0].headers["content-type"], /text\/plain/i);
    assert.match(mime.parts[1].headers["content-type"], /text\/html/i);
    assert.equal(partText(mime.parts[0]).trimEnd(), text.trimEnd());
    const html = partText(mime.parts[1]);
    assert.ok(html.includes(imageUrl));
    assert.ok(html.includes("We may track opens."));
    assert.ok(text.includes("We may track opens."));
    assert.ok(html.includes("Thanks Anita"));
    assert.ok(!partText(mime.parts[0]).includes("/api/e/"), "the plain part carries no image reference");
  });

  test("with tracking and attachments: multipart/mixed wrapping the alternative", async () => {
    const { token } = newToken();
    const { raw } = await buildRawMessage({
      mailbox, to, subject: "Report", body: "See attached",
      attachments: [{ filename: "a.pdf", contentType: "application/pdf", content: Buffer.from("%PDF-1.4") }],
      tracking: { imageUrl: trackingUrl(BASE, token), disclosure: "" },
    });
    const mime = parseMime(raw.toString());
    assert.match(mime.headers["content-type"], /^multipart\/mixed/i);
    assert.match(mime.parts[0].headers["content-type"], /^multipart\/alternative/i);
    assert.match(mime.parts[1].headers["content-type"], /application\/pdf/i);
  });

  test("a tracked reply keeps its threading headers", async () => {
    const { token } = newToken();
    const { raw } = await buildRawMessage({ mailbox, to, subject: "Re: Hi", body: "ok", inReplyTo: "<a@x>", references: ["<a@x>"], tracking: { imageUrl: trackingUrl(BASE, token) } });
    assert.match(raw.toString(), /^In-Reply-To: <a@x>/m);
  });
});

describe("planTracking decides per mail", () => {
  let mongod;
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([EmailTrackingOptOut.init(), EmailSettings.init()]);
  });
  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await Promise.all([EmailTrackingOptOut.deleteMany({}), EmailSettings.deleteMany({})]);
    clearSettingsCache();
  });

  const plan = (over = {}) => planTracking({ mailbox, to, cc: [], state: ACTIVE, ...over });

  test("tracked when everything allows it", async () => {
    const p = await plan();
    assert.equal(p.enabled, true);
    assert.ok(isTokenShape(p.token));
    assert.equal(p.hash, hashToken(p.token));
    assert.equal(p.imageUrl, trackingUrl(BASE, p.token));
    assert.equal(p.disclosure, "We may track opens.");
  });
  test("each mail gets its own token", async () => {
    assert.notEqual((await plan()).token, (await plan()).token);
  });
  test("global off → tracking_off", async () => {
    assert.deepEqual(await plan({ state: { ...ACTIVE, active: false } }), { enabled: false, reason: "tracking_off" });
  });
  test("the Track opens box: unticked → mail_off; absent → mailbox default", async () => {
    assert.equal((await plan({ requested: false })).reason, "mail_off");
    assert.equal((await plan({ requested: true })).enabled, true);
    assert.equal((await plan({ mailbox: { ...mailbox, trackOpensDefault: false } })).reason, "mail_off");
    assert.equal((await plan({ mailbox: { ...mailbox, trackOpensDefault: false }, requested: true })).enabled, true);
  });
  test("disclosure line is empty when the Super Admin turned it off", async () => {
    assert.equal((await plan({ state: { ...ACTIVE, disclosureEnabled: false } })).disclosure, "");
  });
  test("any company-domain recipient (To or Cc) → internal_recipients", async () => {
    assert.equal((await plan({ to: [{ address: "x@humancareconnect.co" }] })).reason, "internal_recipients");
    assert.equal((await plan({ cc: [{ address: "Boss@HumanCareConnect.co" }] })).reason, "internal_recipients");
  });
  test("Apple recipients → apple_recipient", async () => {
    for (const d of ["icloud.com", "me.com", "mac.com", "ICLOUD.COM"]) assert.equal((await plan({ to: [{ address: `a@${d}` }] })).reason, "apple_recipient", d);
    assert.equal((await plan({ cc: [{ address: "a@icloud.com" }] })).reason, "apple_recipient");
    assert.equal((await plan({ to: [{ address: "a@notapple-icloud.com" }] })).enabled, true);
  });
  test("an opted-out address anywhere in To/Cc → opted_out", async () => {
    await EmailTrackingOptOut.create({ address: "optout@gmail.com" });
    assert.equal((await plan({ to: [{ address: "OptOut@gmail.com" }] })).reason, "opted_out");
    assert.equal((await plan({ to, cc: [{ address: "optout@gmail.com" }] })).reason, "opted_out");
    assert.equal((await plan()).enabled, true);
  });
  test("getTrackingState: env gate closed never reads the database; all three gates are needed", async () => {
    const closed = await getTrackingState({ env: {} });
    assert.equal(closed.active, false);
    assert.equal(await EmailSettings.countDocuments(), 0);

    const env = { EMAIL_TRACKING_ENABLED: "true", PUBLIC_TRACKING_BASE_URL: BASE };
    assert.equal((await getTrackingState({ env })).active, false, "DB switch is off by default");
    assert.equal((await getTrackingState({ env })).switchOn, false);

    await EmailSettings.updateOne({ key: "email" }, { trackingEnabled: true });
    clearSettingsCache();
    assert.equal((await getTrackingState({ env })).active, true);
    assert.equal((await getTrackingState({ env: { ...env, EMAIL_TRACKING_ENABLED: "false" } })).active, false);
    assert.equal((await getTrackingState({ env: { ...env, PUBLIC_TRACKING_BASE_URL: "http://insecure.example.com" } })).active, false);
    const s = await getTrackingState({ env });
    assert.equal(s.disclosureEnabled, true, "disclosure is ON by default");
    assert.match(s.disclosureText, /image that tells us when it was opened/);
  });
});

describe("sending: tracked and untracked mail", () => {
  let mongod, server, base, gmail, state, support, priya;
  const store = { async put() {}, async get() { return Buffer.from("x"); }, async remove() {} };
  const fakeAuth = (req, res, next) => { req.user = { id: req.headers["x-test-admin"], role: "admin" }; next(); };

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([Mailbox.init(), EmailMessage.init(), EmailAttachment.init(), User.init(), EmailTrackingOptOut.init()]);
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
    await Promise.all([Mailbox.deleteMany({}), EmailMessage.deleteMany({}), User.deleteMany({}), EmailTrackingOptOut.deleteMany({})]);
    support = await Mailbox.create({ address: "support@humancareconnect.co", displayName: "Support" });
    priya = await User.create({ name: "Priya", email: "p@x.co", role: "admin" });
    state = { ...ACTIVE };
    gmail = { sent: [], async sendRaw(raw) { this.sent.push(raw.toString()); return { id: `g${this.sent.length}`, threadId: `t${this.sent.length}` }; } };
  });

  const send = async (fields = {}) => {
    const fd = new FormData();
    const all = { from: String(support._id), to: "anita@gmail.com", subject: "Hello", body: "Thanks", ...fields };
    for (const [k, v] of Object.entries(all)) if (v !== undefined) fd.set(k, v);
    const res = await fetch(`${base}/send`, { method: "POST", headers: { "x-test-admin": String(priya._id) }, body: fd });
    return { status: res.status, body: await res.json() };
  };

  test("a tracked mail: image in the sent MIME, only the token HASH stored, dashboard copy is text only", async () => {
    const { status, body } = await send({ clientRequestId: "r1" });
    assert.equal(status, 201);
    const row = await EmailMessage.findById(body.message.id);
    assert.equal(row.tracking.enabled, true);
    assert.equal(row.tracking.status, "pending");
    assert.equal(row.tracking.openCount, 0);

    const mime = parseMime(gmail.sent[0]);
    assert.match(mime.headers["content-type"], /multipart\/alternative/i);
    const html = partText(mime.parts[1]);
    const token = new RegExp(`${BASE.replace(/\./g, "\\.")}/api/e/([A-Za-z0-9_-]{32})\\.gif`).exec(html)?.[1];
    assert.ok(token, "image URL with a 32-char token in the HTML part");
    assert.equal(hashToken(token), row.tracking.tokenHash);
    assert.ok(!JSON.stringify(row.toObject()).includes(token), "the token itself is never stored");

    const content = row.getContent();
    assert.equal(content.html, "");
    assert.ok(!content.text.includes("/api/e/"));
    assert.ok(content.text.includes("We may track opens."), "disclosure shows in the stored copy too");
  });

  test("the API response never exposes the token or its hash", async () => {
    const { body } = await send();
    assert.ok(!/tokenHash|"token"|\/api\/e\//.test(JSON.stringify(body)));
  });

  test("unticking Track opens sends plain text with no image and records why", async () => {
    const { body } = await send({ trackOpens: "0" });
    const row = await EmailMessage.findById(body.message.id);
    assert.deepEqual([row.tracking.enabled, row.tracking.status, row.tracking.unavailableReason], [false, "unavailable", "mail_off"]);
    assert.equal(row.tracking.tokenHash, undefined);
    assert.ok(!/multipart|text\/html|\/api\/e\//i.test(gmail.sent[0]));
    assert.ok(!row.getContent().text.includes("We may track opens."), "no disclosure on an untracked mail");
  });

  test("tracking switched off globally: plain text, reason tracking_off, even if the form says 1", async () => {
    state = { ...ACTIVE, active: false };
    const { body } = await send({ trackOpens: "1" });
    const row = await EmailMessage.findById(body.message.id);
    assert.equal(row.tracking.unavailableReason, "tracking_off");
    assert.ok(!/multipart|\/api\/e\//i.test(gmail.sent[0]));
  });

  test("mailbox default off applies when the form says nothing, and the box can still override", async () => {
    await Mailbox.updateOne({ _id: support._id }, { trackOpensDefault: false });
    assert.equal((await EmailMessage.findById((await send()).body.message.id)).tracking.unavailableReason, "mail_off");
    assert.equal((await EmailMessage.findById((await send({ trackOpens: "1" })).body.message.id)).tracking.enabled, true);
  });

  test("recipient rules: company, Apple and opted-out recipients get no image", async () => {
    await EmailTrackingOptOut.create({ address: "optout@gmail.com" });
    for (const [rcpt, reason] of [["colleague@humancareconnect.co", "internal_recipients"], ["a@icloud.com", "apple_recipient"], ["optout@gmail.com", "opted_out"]]) {
      const { body } = await send({ to: rcpt });
      assert.equal((await EmailMessage.findById(body.message.id)).tracking.unavailableReason, reason, rcpt);
    }
    assert.ok(gmail.sent.every((m) => !/\/api\/e\//.test(m)));
  });

  test("Cc is checked as well", async () => {
    const { body } = await send({ cc: "friend@icloud.com" });
    assert.equal((await EmailMessage.findById(body.message.id)).tracking.unavailableReason, "apple_recipient");
  });

  test("a failed send keeps its row as failed", async () => {
    gmail.sendRaw = async () => { throw Object.assign(new Error("down"), { code: 500 }); };
    const { status } = await send();
    assert.equal(status, 502);
    assert.equal((await EmailMessage.findOne({})).status, "failed");
  });

  test("/mailboxes tells the compose form whether tracking is available, and each mailbox's default", async () => {
    const get = async () => (await fetch(`${base}/mailboxes`, { headers: { "x-test-admin": String(priya._id) } })).json();
    let r = await get();
    assert.deepEqual(r.tracking, { available: true, disclosure: true });
    assert.equal(r.mailboxes[0].trackOpensDefault, true);
    state = { ...ACTIVE, active: false };
    r = await get();
    assert.deepEqual(r.tracking, { available: false, disclosure: false });
  });

  test("replying follows the same rules (the reply goes to ONE recipient)", async () => {
    const inbound = new EmailMessage({ mailbox: support._id, direction: "in", status: "received", gmailMessageId: "gi", gmailThreadId: "ti", rfcMessageId: "<i@x>", from: { address: "client@gmail.com" }, to: [{ address: support.address }], subject: "Q", messageDate: new Date() });
    inbound.setContent({ text: "hi", html: "", snippet: "hi" });
    await inbound.save();
    const fd = new FormData();
    fd.set("body", "answer");
    fd.set("clientRequestId", "rep1");
    const res = await fetch(`${base}/messages/${inbound._id}/reply`, { method: "POST", headers: { "x-test-admin": String(priya._id) }, body: fd });
    assert.equal(res.status, 201);
    const reply = await EmailMessage.findOne({ direction: "out" });
    assert.equal(reply.tracking.status, "pending");
    assert.match(parseMime(gmail.sent[0]).headers["content-type"], /multipart\/alternative/);
    assert.match(gmail.sent[0], /^In-Reply-To: <i@x>/m);
  });
});
