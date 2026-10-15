const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const sharp = require("sharp");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Mailbox = require("../models/Mailbox");
const EmailMessage = require("../models/EmailMessage");
const EmailAttachment = require("../models/EmailAttachment");
const EmailDownloadLink = require("../models/EmailDownloadLink");
const EmailLink = require("../models/EmailLink");
const EmailSignature = require("../models/EmailSignature");
const EmailSettings = require("../models/EmailSettings");
const EmailTrackingOptOut = require("../models/EmailTrackingOptOut");
const User = require("../models/User");
const adminEmail = require("../routes/adminEmail");
const { buildRawMessage, composeParts } = require("../services/gmail/mimeBuilder");
const { clearSettingsCache } = require("../services/email/emailSettings");

const BASE = "https://uat.example.com";
const FOOTER = "Human Care Connect";
const TEXT_VERSION = "Anita Rao\nCare Coordinator\n+91 98765 43210\nwww.humancareconnect.co";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const decodeQP = (s) => s.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

describe("composeParts", () => {
  test("splits message, signature lines and company footer; attachment lines go with the message", () => {
    assert.deepEqual(composeParts("Hello\n\n-- \nAnita\nCoordinator", "Human Care Connect", "Notice", "Attachments:\n- a.pdf"), {
      message: "Hello\n\nAttachments:\n- a.pdf",
      sig: "Anita\nCoordinator",
      company: "Human Care Connect",
      notice: "Notice",
    });
  });
  test("no divider: all of it is message; footer can be left out", () => {
    assert.deepEqual(composeParts("Hello", "F", "", "", { companyFooter: false }), { message: "Hello", sig: "", company: "", notice: "" });
  });
  test("the last divider starts the signature", () => {
    assert.equal(composeParts("a\n-- \nquote\n\n-- \nreal", "", "").sig, "real");
  });
});

describe("mail with an image signature", () => {
  let mongod, server, base, gmail, state, store, support, anita, ravi, bannerPng, sig, otherMailbox;
  const fakeAuth = (req, res, next) => { req.user = { id: req.headers["x-test-admin"], role: "admin" }; next(); };
  const ON = { active: true, linksActive: true, secureLinksActive: true, secureLinkDays: 7, baseUrl: BASE, disclosureEnabled: false, disclosureText: "" };

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([Mailbox.init(), EmailMessage.init(), EmailAttachment.init(), EmailDownloadLink.init(), EmailLink.init(), EmailSignature.init(), EmailSettings.init(), EmailTrackingOptOut.init(), User.init()]);
    store = {
      files: new Map(),
      failGet: false,
      failPutPrefix: "",
      async put(key, buf, type) {
        if (this.failPutPrefix && key.startsWith(this.failPutPrefix)) throw new Error("S3 down");
        this.files.set(key, { buf, type });
      },
      async get(key) {
        if (this.failGet || !this.files.has(key)) throw new Error("missing");
        return this.files.get(key).buf;
      },
      async remove(key) { this.files.delete(key); },
    };
    const app = express();
    app.use(express.json());
    app.use("/api/admin/email", (req, res, next) => adminEmail.create({ guard: [fakeAuth], getGmail: () => gmail, store, trackingState: async () => state })(req, res, next));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}/api/admin/email`;
    bannerPng = await sharp({ create: { width: 480, height: 120, channels: 3, background: { r: 20, g: 90, b: 160 } } }).png().toBuffer();
  });
  after(async () => {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await Promise.all([Mailbox.deleteMany({}), EmailMessage.deleteMany({}), EmailAttachment.deleteMany({}), EmailDownloadLink.deleteMany({}), EmailLink.deleteMany({}), EmailSignature.deleteMany({}), EmailSettings.deleteMany({}), EmailTrackingOptOut.deleteMany({}), User.deleteMany({})]);
    clearSettingsCache();
    store.files.clear();
    store.failGet = false;
    store.failPutPrefix = "";
    support = await Mailbox.create({ address: "support@humancareconnect.co", displayName: "Support", signature: FOOTER });
    anita = await User.create({ name: "Anita Rao", email: "anita@x.co", role: "admin" });
    ravi = await User.create({ name: "Ravi", email: "ravi@x.co", role: "admin" });
    otherMailbox = await Mailbox.create({ address: "billing@humancareconnect.co", displayName: "Billing", allowedAdmins: [ravi._id] });
    store.files.set("email-signature-images/a/banner.png", { buf: bannerPng, type: "image/png" });
    sig = await EmailSignature.create({
      owner: anita._id, name: "Banner", nameKey: "banner", content: TEXT_VERSION, isDefault: true, layout: "image_text",
      image: { key: "email-signature-images/a/banner.png", mime: "image/png", width: 480, height: 120, bytes: bannerPng.length },
    });
    state = { ...ON };
    gmail = { sent: [], async sendRaw(raw) { this.sent.push(raw.toString()); return { id: `g${this.sent.length}`, threadId: `t${this.sent.length}` }; } };
  });

  const withSig = (message, text = TEXT_VERSION) => `${message}\n\n-- \n${text}`;

  async function send(fields = {}, { files = [], as = anita } = {}) {
    const fd = new FormData();
    const all = { from: String(support._id), to: "client@gmail.com", subject: "Your enquiry", body: withSig("Dear client,\nThank you."), signatureId: String(sig._id), trackOpens: "0", ...fields };
    for (const [k, v] of Object.entries(all)) if (v !== undefined) fd.set(k, v);
    for (const [name, buf] of files) fd.append("files", new Blob([buf], { type: "application/pdf" }), name);
    const res = await fetch(`${base}/send`, { method: "POST", headers: { "x-test-admin": String(as._id) }, body: fd });
    const body = await res.json();
    const mime = gmail.sent.at(-1) || "";
    const htmlStart = mime.search(/Content-Type: text\/html/i);
    // the plain-text part: after its own headers, up to the next MIME boundary line
    const tStart = mime.search(/Content-Type: text\/plain/i);
    const afterHeaders = tStart >= 0 ? mime.indexOf("\r\n\r\n", tStart) + 4 : 0;
    const rest = mime.slice(afterHeaders);
    // nodemailer boundaries are "--_NmP-..." (a delimiter line is "--" + that); a quoted-printable "-- " divider line is "--=20"
    const end = rest.search(/\r?\n-{2,4}_NmP-[A-Za-z0-9_-]+/);
    const textPart = end >= 0 ? rest.slice(0, end) : rest;
    const htmlPart = htmlStart >= 0 ? mime.slice(htmlStart) : "";
    return { status: res.status, body, mime, text: decodeQP(textPart), html: decodeQP(htmlPart) };
  }
  const bodyOf = (text) => text.slice(text.indexOf("Dear client")).replace(/\r/g, "");
  const cidMatch = (html) => /src="cid:([^"]+)"/.exec(html)?.[1];

  // ── the MIME structure ──
  test("the image is an inline CID part of multipart/related with no file name", async () => {
    const r = await send();
    assert.equal(r.status, 201);
    assert.match(r.mime, /Content-Type: multipart\/related/i);
    const cid = cidMatch(r.html);
    assert.match(cid, /^sig-[0-9a-f-]{36}@humancareconnect\.co$/);
    const at = r.mime.indexOf(`Content-ID: <${cid}>`);
    assert.ok(at > 0, "the CID part exists");
    const partHead = r.mime.slice(r.mime.lastIndexOf("--", at - 2), at + 400);
    assert.match(partHead, /Content-Type: image\/png/i);
    assert.match(partHead, /Content-Disposition: inline\r?\n/i);
    assert.ok(!/filename=/i.test(partHead), "no file name, so it is less likely to be listed as an attachment");
    assert.match(partHead, /Content-Transfer-Encoding: base64/i);
  });

  test("the embedded bytes are the stored image", async () => {
    const r = await send();
    const cid = cidMatch(r.html);
    const after = r.mime.slice(r.mime.indexOf(`Content-ID: <${cid}>`));
    const b64 = after.split(/\r?\n\r?\n/)[1].split(/\r?\n--/)[0].replace(/\s+/g, "");
    assert.deepEqual(Buffer.from(b64, "base64"), bannerPng);
  });

  test("the text part is the text version only: no image reference, divider and company footer as usual", async () => {
    const r = await send();
    assert.equal(bodyOf(r.text).trimEnd(), `Dear client,\nThank you.\n\n-- \n${TEXT_VERSION}\n\n${FOOTER}`);
    assert.ok(!/cid:/i.test(r.text));
  });

  test("the HTML part: message, then the image, then the text lines, then the company footer", async () => {
    const r = await send();
    const i = r.html.indexOf("Thank you.");
    const j = r.html.indexOf('<img src="cid:');
    const k = r.html.indexOf("Care Coordinator");
    const l = r.html.lastIndexOf(FOOTER);
    assert.ok(i > 0 && i < j && j < k && k < l, [i, j, k, l].join(","));
    assert.ok(!/-- /.test(r.html.replace(/<[^>]+>/g, "")), "the divider line is replaced by the image");
  });

  test("image only: the text version is for the plain-text part and is not repeated under the image", async () => {
    await EmailSignature.updateOne({ _id: sig._id }, { layout: "image" });
    const r = await send();
    assert.ok(bodyOf(r.text).includes("Care Coordinator"), "plain text has it");
    assert.ok(!r.html.includes("Care Coordinator"), "the HTML shows the image only");
    assert.ok(r.html.includes(FOOTER));
    assert.match(r.html, /<img src="cid:/);
  });

  test("a text-only signature carries no image and no HTML part when tracking is off, as before", async () => {
    await EmailSignature.updateOne({ _id: sig._id }, { layout: "text" });
    const r = await send();
    assert.ok(!/multipart\/related/i.test(r.mime));
    assert.ok(!/text\/html/i.test(r.mime));
  });

  test("an image signature kept on a text-only layout is not sent as an image", async () => {
    await EmailSignature.updateOne({ _id: sig._id }, { layout: "text" });
    const r = await send({ trackOpens: "1" });
    assert.ok(!/cid:/i.test(r.mime));
  });

  test("No signature: the mail is exactly what it was, with no image", async () => {
    const r = await send({ signatureId: "none", body: "Dear client,\nThank you." });
    assert.ok(!/multipart\/related|text\/html/i.test(r.mime));
    assert.equal(bodyOf(r.text).trimEnd(), "Dear client,\nThank you.\n\n-- \nHuman Care Connect");
  });

  test("with 'Track opens' on the tracking image is still the last thing, and is a different image", async () => {
    const r = await send({ trackOpens: "1" });
    const html = r.html;
    const sigImg = html.indexOf('<img src="cid:');
    const pixel = html.indexOf('/api/e/');
    assert.ok(sigImg > 0 && pixel > sigImg);
    assert.match(html, /<img src="https:\/\/uat\.example\.com\/api\/e\/[A-Za-z0-9_-]{32}\.gif" width="1" height="1" alt="" border="0"[^>]*><\/body>/);
    assert.equal((html.match(/<img /g) || []).length, 2);
  });

  test("with 'Track opens' off there is no tracking image, only the signature image", async () => {
    const r = await send({ trackOpens: "0" });
    assert.ok(!/\/api\/e\//.test(r.mime));
    assert.equal((r.html.match(/<img /g) || []).length, 1);
  });

  // ── alt text and link ──
  test("alt text defaults to the first text line and can be set; it is escaped", async () => {
    let r = await send();
    assert.match(r.html, /alt="Anita Rao"/);
    await EmailSignature.updateOne({ _id: sig._id }, { imageAlt: 'Human "Care" <b>Connect</b>' });
    r = await send();
    assert.match(r.html, /alt="Human &quot;Care&quot; &lt;b&gt;Connect&lt;\/b&gt;"/);
  });

  test("the image has no title or class, and looks like a normal picture", async () => {
    const r = await send();
    const img = r.html.match(/<img src="cid:[^>]*>/)[0];
    assert.ok(!/title=|class=|id=/.test(img));
    assert.match(img, /width="480"/);
    assert.match(img, /height="120"/);
    assert.match(img, /style="display:block;border:0;max-width:100%;height:auto"/);
  });

  test("an image link wraps the image and is click-tracked like any link (on a tracked mail)", async () => {
    await EmailSignature.updateOne({ _id: sig._id }, { imageLink: "https://humancareconnect.co/" });
    const r = await send({ trackOpens: "1" });
    assert.match(r.html, /<a href="https:\/\/uat\.example\.com\/api\/l\/[A-Za-z0-9_-]{32}"><img src="cid:/);
    const tracked = (await EmailLink.find({ message: r.body.message.id }).lean()).map((l) => l.url);
    assert.ok(tracked.includes("https://humancareconnect.co/"), tracked.join(","));
    assert.ok(!r.text.includes("api/l/"));
  });

  test("with link tracking off the image link is the plain address", async () => {
    state = { ...ON, linksActive: false };
    await EmailSignature.updateOne({ _id: sig._id }, { imageLink: "https://humancareconnect.co/" });
    const r = await send({ trackOpens: "1" });
    assert.match(r.html, /<a href="https:\/\/humancareconnect\.co\/"><img src="cid:/);
    assert.equal(await EmailLink.countDocuments(), 0);
  });

  test("no image link: no anchor around the image", async () => {
    const r = await send();
    assert.ok(!/<a [^>]*><img src="cid:/.test(r.html));
  });

  // ── together with the other features ──
  test("secure links: the files are not attached, the signature image is the only inline part", async () => {
    const r = await send({ secureLinks: "1" }, { files: [["report.pdf", PDF]] });
    assert.equal(r.status, 201);
    assert.ok(!/application\/pdf/i.test(r.mime));
    assert.equal((r.mime.match(/Content-ID:/gi) || []).length, 1);
    const t = bodyOf(r.text);
    assert.ok(t.indexOf("Thank you.") < t.indexOf("Attachments (available until"));
    assert.ok(t.indexOf("Attachments (available until") < t.indexOf("\n-- \n"));
    assert.ok(r.html.indexOf("Attachments (available until") < r.html.indexOf('<img src="cid:'));
  });

  test("normal attachments and the image together: one real attachment, one inline image", async () => {
    const r = await send({}, { files: [["report.pdf", PDF]] });
    assert.match(r.mime, /Content-Type: multipart\/mixed/i);
    assert.equal((r.mime.match(/filename="?report\.pdf/gi) || []).length >= 1, true);
    assert.equal((r.mime.match(/Content-ID:/gi) || []).length, 1);
  });

  test("the company footer setting applies to the HTML part too", async () => {
    await EmailSettings.create({ key: "email", companyFooterWithSignature: false });
    clearSettingsCache();
    const r = await send();
    assert.ok(!r.html.includes(FOOTER));
    assert.ok(!bodyOf(r.text).includes(FOOTER));
  });

  test("a read receipt request does not change the image", async () => {
    state = { ...ON };
    const r = await send({ requestReceipt: "1" });
    assert.match(r.mime, /Disposition-Notification-To/);
    assert.match(r.html, /<img src="cid:/);
  });

  test("with the footer notice on it is last in both parts", async () => {
    state = { ...ON, disclosureEnabled: true };
    const r = await send({ trackOpens: "1" });
    assert.ok(r.html.includes("This email may include technology"), r.html.slice(0, 600));
    assert.ok(r.html.lastIndexOf("This email may include technology") > r.html.lastIndexOf(FOOTER), "html order");
    assert.ok(r.text.includes("This email may include technology"), r.text.slice(0, 600));
    assert.ok(r.text.lastIndexOf("This email may include technology") > r.text.lastIndexOf(FOOTER), "text order");
  });

  test("what a recipient can read has no tracking wording around the image", async () => {
    const r = await send({ trackOpens: "1" });
    const visible = r.html.replace(/<[^>]*>/g, " ");
    assert.ok(!/track|record|pixel|beacon|opened|clicked|secure/i.test(visible), visible);
  });

  // ── permissions and failure ──
  test("another admin's signature (with an image) is refused: nothing sent", async () => {
    const theirs = await EmailSignature.create({
      owner: ravi._id, name: "R", nameKey: "r", content: "Ravi", isDefault: true, layout: "image",
      image: { key: "email-signature-images/a/banner.png", mime: "image/png", width: 480, height: 120, bytes: 10 },
    });
    const r = await send({ signatureId: String(theirs._id) });
    assert.equal(r.status, 400);
    assert.equal(gmail.sent.length, 0);
  });

  test("the image cannot be loaded: the mail is refused with a clear message, nothing is sent or stored", async () => {
    store.failGet = true;
    const r = await send();
    assert.equal(r.status, 503);
    assert.equal(r.body.code, "SIGNATURE_IMAGE_UNAVAILABLE");
    assert.match(r.body.msg, /signature image could not be loaded/);
    assert.equal(gmail.sent.length, 0);
    assert.equal(await EmailMessage.countDocuments(), 0);
  });

  test("a reply whose image cannot be loaded gives the claim back", async () => {
    const inbound = new EmailMessage({ mailbox: support._id, direction: "in", status: "received", gmailMessageId: "gi", gmailThreadId: "ti", rfcMessageId: "<i@x>", from: { address: "client@gmail.com" }, to: [{ address: support.address }], subject: "Question", messageDate: new Date() });
    inbound.setContent({ text: "hi", html: "", snippet: "hi" });
    await inbound.save();
    store.failGet = true;
    const fd = new FormData();
    fd.set("body", withSig("Answer"));
    fd.set("clientRequestId", "rep-img");
    fd.set("signatureId", String(sig._id));
    const res = await fetch(`${base}/messages/${inbound._id}/reply`, { method: "POST", headers: { "x-test-admin": String(anita._id) }, body: fd });
    assert.equal(res.status, 503);
    const row = await EmailMessage.findById(inbound._id);
    assert.equal(row.repliedAt, null, "the mail is not marked as replied");
    assert.equal(gmail.sent.length, 0);
    store.failGet = false;
    const again = await fetch(`${base}/messages/${inbound._id}/reply`, { method: "POST", headers: { "x-test-admin": String(anita._id) }, body: (() => { const f = new FormData(); f.set("body", withSig("Answer")); f.set("clientRequestId", "rep-img-2"); f.set("signatureId", String(sig._id)); return f; })() });
    assert.equal(again.status, 201);
    assert.match(gmail.sent[0], /Content-ID: <sig-/);
  });

  test("the sent copy cannot be stored: the mail is not sent and is marked failed", async () => {
    store.failPutPrefix = "email-sent-signatures/";
    const r = await send();
    assert.equal(r.status, 502);
    assert.equal(gmail.sent.length, 0);
    const row = await EmailMessage.findOne({});
    assert.equal(row.status, "failed");
  });

  // ── the dashboard copy ──
  test("the sent mail keeps its own copy of the image, unaffected by later changes to the signature", async () => {
    const r = await send();
    const row = await EmailMessage.findById(r.body.message.id).lean();
    assert.match(row.signatureImage.key, new RegExp(`^email-sent-signatures/${support._id}/${row._id}/[0-9a-f]{16}\\.png$`));
    assert.deepEqual(store.files.get(row.signatureImage.key).buf, bannerPng);
    assert.equal(row.signatureImage.signatureText, TEXT_VERSION);
    assert.equal(row.signatureImage.layout, "image_text");

    // the admin replaces the working image and then deletes the signature
    store.files.delete("email-signature-images/a/banner.png");
    await EmailSignature.deleteOne({ _id: sig._id });
    assert.ok(store.files.has(row.signatureImage.key));
    const res = await fetch(`${base}/messages/${row._id}/signature-image`, { headers: { "x-test-admin": String(anita._id) } });
    assert.equal(res.status, 200);
    assert.deepEqual(Buffer.from(await res.arrayBuffer()), bannerPng);
  });

  test("the stored text is the text as sent; the mail page carries the image facts but never the key", async () => {
    const r = await send();
    const row = await EmailMessage.findById(r.body.message.id);
    assert.equal(row.getContent().text, `Dear client,\nThank you.\n\n-- \n${TEXT_VERSION}\n\n${FOOTER}\n`);
    const page = await (await fetch(`${base}/messages/${row._id}`, { headers: { "x-test-admin": String(anita._id) } })).json();
    assert.deepEqual(page.message.signatureImage, {
      mime: "image/png", width: 480, height: 120, alt: "Anita Rao", link: "", layout: "image_text", signatureText: TEXT_VERSION,
    });
    assert.ok(!JSON.stringify(page).includes("email-sent-signatures"));
    const list = await (await fetch(`${base}/messages?folder=sent`, { headers: { "x-test-admin": String(anita._id) } })).json();
    assert.ok(!JSON.stringify(list).includes("email-sent-signatures"));
  });

  test("the image route follows mailbox access like the mail itself", async () => {
    const own = await send();
    const id = own.body.message.id;
    // Ravi may use the support mailbox too (no allowed list), so he can open it
    assert.equal((await fetch(`${base}/messages/${id}/signature-image`, { headers: { "x-test-admin": String(ravi._id) } })).status, 200);
    // a mail in a mailbox Anita may not use
    const hidden = new EmailMessage({
      mailbox: otherMailbox._id, direction: "out", status: "sent", gmailMessageId: "gh", from: { address: otherMailbox.address }, to: [{ address: "c@gmail.com" }], subject: "Billing", messageDate: new Date(),
      signatureImage: { key: "email-sent-signatures/x/y/z.png", mime: "image/png", width: 10, height: 10, layout: "image" },
    });
    hidden.setContent({ text: "x", html: "", snippet: "x" });
    await hidden.save();
    store.files.set("email-sent-signatures/x/y/z.png", { buf: bannerPng, type: "image/png" });
    assert.equal((await fetch(`${base}/messages/${hidden._id}/signature-image`, { headers: { "x-test-admin": String(anita._id) } })).status, 404);
    assert.equal((await fetch(`${base}/messages/${hidden._id}/signature-image`, { headers: { "x-test-admin": String(ravi._id) } })).status, 200);
  });

  test("the image route has safe headers; a mail without an image, an unknown id and a bad id are 404", async () => {
    const r = await send();
    const res = await fetch(`${base}/messages/${r.body.message.id}/signature-image`, { headers: { "x-test-admin": String(anita._id) } });
    assert.equal(res.headers.get("content-type"), "image/png");
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.match(res.headers.get("content-security-policy"), /sandbox/);
    assert.match(res.headers.get("cache-control"), /no-store/);

    const plain = await send({ signatureId: "none", body: "Hello" });
    for (const id of [plain.body.message.id, String(new mongoose.Types.ObjectId()), "nope"]) {
      assert.equal((await fetch(`${base}/messages/${id}/signature-image`, { headers: { "x-test-admin": String(anita._id) } })).status, 404, id);
    }
  });

  test("the plain mail built without a signature image is byte-identical to before (no new parts)", async () => {
    const { raw } = await buildRawMessage({ mailbox: { _id: support._id, address: support.address, signature: FOOTER }, to: [{ address: "a@gmail.com" }], subject: "Hi", body: "Hello" });
    const s = raw.toString();
    assert.ok(!/multipart|text\/html|Content-ID/i.test(s));
    assert.match(s, /Content-Type: text\/plain/i);
  });
});
