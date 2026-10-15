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
const EmailSignature = require("../models/EmailSignature");
const EmailSettings = require("../models/EmailSettings");
const EmailTrackingOptOut = require("../models/EmailTrackingOptOut");
const User = require("../models/User");
const adminEmail = require("../routes/adminEmail");
const superadminSettings = require("../routes/superadminEmailSettings");
const { composeText } = require("../services/gmail/mimeBuilder");
const { clearSettingsCache, getTrackingState } = require("../services/email/emailSettings");

const BASE = "https://uat.example.com";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const FOOTER = "Human Care Connect";
const SIG = "Anita Rao\nCare Coordinator\nwww.humancareconnect.co";
const decodeQP = (s) => s.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

describe("composeText with an admin signature", () => {
  test("no admin signature: exactly the output it always was", () => {
    assert.equal(composeText("Hello", FOOTER), "Hello\n\n-- \nHuman Care Connect\n");
    assert.equal(composeText("Hello", FOOTER, "Notice"), "Hello\n\n-- \nHuman Care Connect\n\nNotice\n");
    assert.equal(composeText("Hello", FOOTER, "", "Attachments:\n- a.pdf"), "Hello\n\nAttachments:\n- a.pdf\n\n-- \nHuman Care Connect\n");
    assert.equal(composeText("Hello", ""), "Hello\n");
  });

  test("message, signature, company footer: one divider, no second one", () => {
    assert.equal(composeText("Hello\n\n-- \nAnita", FOOTER, "", "", { adminSignature: true }), "Hello\n\n-- \nAnita\n\nHuman Care Connect\n");
  });

  test("company footer switched off: message and signature only", () => {
    assert.equal(composeText("Hello\n\n-- \nAnita", FOOTER, "", "", { adminSignature: true, companyFooter: false }), "Hello\n\n-- \nAnita\n");
  });

  test("notice comes last; attachment lines go above the signature", () => {
    assert.equal(
      composeText("Hello\n\n-- \nAnita", FOOTER, "Notice", "Attachments:\n- a.pdf", { adminSignature: true }),
      "Hello\n\nAttachments:\n- a.pdf\n\n-- \nAnita\n\nHuman Care Connect\n\nNotice\n"
    );
  });

  test("a signature divider typed without trailing space, and several dividers: the last one starts the signature", () => {
    assert.equal(composeText("Hi\n\n--\nAnita", "F", "", "Att", { adminSignature: true }), "Hi\n\nAtt\n\n--\nAnita\n\nF\n");
    assert.equal(composeText("Hi\n-- \nquote\n\n-- \nAnita", "F", "", "Att", { adminSignature: true }), "Hi\n-- \nquote\n\nAtt\n\n-- \nAnita\n\nF\n");
  });

  test("no divider left in the text (the admin removed it): attachments follow the text, footer after", () => {
    assert.equal(composeText("Hello", "F", "", "Att", { adminSignature: true }), "Hello\n\nAtt\n\nF\n");
  });

  test("a company footer that is empty adds nothing", () => {
    assert.equal(composeText("Hi\n\n-- \nA", "", "", "", { adminSignature: true }), "Hi\n\n-- \nA\n");
  });
});

describe("sending with a signature", () => {
  let mongod, server, base, gmail, state, support, anita, ravi, root, anitaSig;
  const store = { async put() {}, async get() { return Buffer.from("x"); }, async remove() {} };
  const fakeAuth = (req, res, next) => { req.user = { id: req.headers["x-test-admin"], role: "admin" }; next(); };
  const ON = { active: true, linksActive: true, secureLinksActive: true, secureLinkDays: 7, baseUrl: BASE, disclosureEnabled: false, disclosureText: "" };

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([Mailbox.init(), EmailMessage.init(), EmailAttachment.init(), EmailDownloadLink.init(), EmailLink.init(), EmailSignature.init(), EmailSettings.init(), EmailTrackingOptOut.init(), User.init()]);
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
    await Promise.all([Mailbox.deleteMany({}), EmailMessage.deleteMany({}), EmailAttachment.deleteMany({}), EmailDownloadLink.deleteMany({}), EmailLink.deleteMany({}), EmailSignature.deleteMany({}), EmailSettings.deleteMany({}), EmailTrackingOptOut.deleteMany({}), User.deleteMany({})]);
    clearSettingsCache();
    support = await Mailbox.create({ address: "support@humancareconnect.co", displayName: "Support", signature: FOOTER });
    anita = await User.create({ name: "Anita Rao", email: "anita@x.co", role: "admin" });
    ravi = await User.create({ name: "Ravi", email: "ravi@x.co", role: "admin" });
    root = await User.create({ name: "Root", email: "root@x.co", role: "superadmin" });
    anitaSig = await EmailSignature.create({ owner: anita._id, name: "Formal", nameKey: "formal", content: SIG, isDefault: true });
    state = { ...ON };
    gmail = { sent: [], async sendRaw(raw) { this.sent.push(raw.toString()); return { id: `g${this.sent.length}`, threadId: `t${this.sent.length}` }; } };
  });

  // What the composer produces: the message, a divider, the signature.
  const withSig = (message, sig = SIG) => `${message}\n\n-- \n${sig}`;

  async function send(fields = {}, { as = anita, files = [] } = {}) {
    const fd = new FormData();
    const all = { from: String(support._id), to: "client@gmail.com", subject: "Your enquiry", body: withSig("Dear client,\nThank you."), signatureId: String(anitaSig._id), ...fields };
    for (const [k, v] of Object.entries(all)) if (v !== undefined) fd.set(k, v);
    for (const [name, buf] of files) fd.append("files", new Blob([buf], { type: "application/pdf" }), name);
    const res = await fetch(`${base}/send`, { method: "POST", headers: { "x-test-admin": String(as._id) }, body: fd });
    const body = await res.json();
    const mime = gmail.sent.at(-1) || "";
    const [textPart, htmlPart = ""] = mime.split(/Content-Type: text\/html/i);
    return { status: res.status, body, mime, text: decodeQP(textPart), html: decodeQP(htmlPart) };
  }
  const plainBody = (text) => text.slice(text.indexOf("Dear client"));
  const textOf = (text) => plainBody(text).replace(/\r/g, "").trimEnd();

  test("order in the mail: message, admin signature, company footer", async () => {
    const r = await send({ trackOpens: "0" });
    assert.equal(r.status, 201);
    assert.equal(textOf(r.text), "Dear client,\nThank you.\n\n-- \nAnita Rao\nCare Coordinator\nwww.humancareconnect.co\n\nHuman Care Connect");
  });

  test("the dashboard copy is exactly what was sent, signature and company footer included", async () => {
    const r = await send({ trackOpens: "0" });
    const row = await EmailMessage.findById(r.body.message.id);
    const stored = row.getContent().text;
    assert.equal(stored, "Dear client,\nThank you.\n\n-- \nAnita Rao\nCare Coordinator\nwww.humancareconnect.co\n\nHuman Care Connect\n");
    assert.equal(textOf(r.text), stored.trimEnd());
    assert.equal(row.getContent().html, "", "the HTML twin is not stored");
  });

  test("company footer switched off by a Super Admin: message and signature only", async () => {
    await EmailSettings.create({ key: "email", companyFooterWithSignature: false });
    clearSettingsCache();
    const r = await send({ trackOpens: "0" });
    assert.equal(textOf(r.text), "Dear client,\nThank you.\n\n-- \nAnita Rao\nCare Coordinator\nwww.humancareconnect.co");
    assert.ok(!plainBody(r.text).includes(FOOTER), "From name in the headers is not the footer");
  });

  test("a settings document from before the field existed still adds the company footer", async () => {
    await EmailSettings.collection.insertOne({ key: "email", trackingEnabled: false });
    clearSettingsCache();
    const r = await send({ trackOpens: "0" });
    assert.ok(r.text.includes(FOOTER));
  });

  test("no signature: exactly today's output, whatever the setting says", async () => {
    await EmailSettings.create({ key: "email", companyFooterWithSignature: false });
    clearSettingsCache();
    for (const signatureId of ["none", "", undefined]) {
      const r = await send({ trackOpens: "0", signatureId, body: "Dear client,\nThank you." });
      assert.equal(textOf(r.text), "Dear client,\nThank you.\n\n-- \nHuman Care Connect", String(signatureId));
    }
  });

  test("the dropdown decides, not the text: signature chosen but text removed by hand", async () => {
    await EmailSettings.create({ key: "email", companyFooterWithSignature: false });
    clearSettingsCache();
    const r = await send({ trackOpens: "0", body: "Dear client,\nThank you." });
    assert.equal(textOf(r.text), "Dear client,\nThank you.", "no signature text and no company footer");
  });

  test("the admin may edit the signature for one mail; the saved signature is unchanged", async () => {
    const r = await send({ trackOpens: "0", body: withSig("Dear client,", "Anita Rao\nOut of office until Monday") });
    assert.ok(r.text.includes("Out of office until Monday"));
    assert.equal((await EmailSignature.findById(anitaSig._id)).content, SIG);
  });

  // ── permissions ──
  test("another admin's signature id is refused: 400, nothing sent, nothing stored", async () => {
    const theirs = await EmailSignature.create({ owner: ravi._id, name: "Ravi", nameKey: "ravi", content: "Ravi\n+91 1", isDefault: true });
    const r = await send({ signatureId: String(theirs._id) });
    assert.equal(r.status, 400);
    assert.equal(r.body.code, "SIGNATURE_NOT_FOUND");
    assert.equal(gmail.sent.length, 0);
    assert.equal(await EmailMessage.countDocuments(), 0);
  });

  test("a Super Admin's signature id is refused for an admin as well; invented and malformed ids too", async () => {
    const rootSig = await EmailSignature.create({ owner: root._id, name: "Root", nameKey: "root", content: "Root", isDefault: true });
    for (const id of [String(rootSig._id), String(new mongoose.Types.ObjectId()), "not-an-id", "{$ne:1}", "x".repeat(100)]) {
      const r = await send({ signatureId: id });
      assert.equal(r.status, 400, id);
    }
    assert.equal(gmail.sent.length, 0);
  });

  test("another admin can use their own, and the two never mix", async () => {
    const theirs = await EmailSignature.create({ owner: ravi._id, name: "Ravi", nameKey: "ravi", content: "Ravi K\nBilling", isDefault: true });
    const r = await send({ trackOpens: "0", body: withSig("Hi", "Ravi K\nBilling"), signatureId: String(theirs._id) }, { as: ravi });
    assert.equal(r.status, 201);
    assert.ok(r.text.includes("Ravi K"));
    assert.ok(!r.text.includes("Anita Rao"));
  });

  // ── tracking ──
  test("links in a signature (www. and https://) are clickable in the HTML part and tracked", async () => {
    const r = await send({ body: withSig("Hello", "Anita\nwww.humancareconnect.co\nhttps://humancareconnect.co/care") });
    assert.equal(r.status, 201);
    assert.match(r.html, /<a href="https:\/\/uat\.example\.com\/api\/l\/[A-Za-z0-9_-]{32}">www\.humancareconnect\.co<\/a>/);
    assert.match(r.html, /<a href="https:\/\/uat\.example\.com\/api\/l\/[A-Za-z0-9_-]{32}">https:\/\/humancareconnect\.co\/care<\/a>/);
    const tracked = (await EmailLink.find({ message: r.body.message.id }).sort({ index: 1 }).lean()).map((l) => l.url);
    assert.deepEqual(tracked, ["https://www.humancareconnect.co", "https://humancareconnect.co/care"]);
    assert.ok(!/api\/l\//.test(r.text), "the plain-text part keeps the original links");
    assert.match(r.text, /www\.humancareconnect\.co/);
  });

  test("a signature link and a message link are different tracked links", async () => {
    const r = await send({ body: withSig("See https://example.com/form", "Anita\nhttps://humancareconnect.co") });
    const tracked = (await EmailLink.find({ message: r.body.message.id }).sort({ index: 1 }).lean()).map((l) => l.url);
    assert.deepEqual(tracked, ["https://example.com/form", "https://humancareconnect.co"]);
  });

  test("markup typed in a signature is shown as text in the HTML part", async () => {
    const r = await send({ body: withSig("Hello", '<img src=x onerror="alert(1)">\n<b>Anita</b>') });
    assert.ok(!/<img src=x/i.test(r.html.replace(/<img [^>]*api\/e\/[^>]*>/g, "")), r.html);
    assert.match(r.html, /&lt;b&gt;Anita&lt;\/b&gt;/);
  });

  test("signature lines keep their line breaks in the HTML part", async () => {
    const r = await send({});
    assert.match(r.html, /Anita Rao<br>\s*Care Coordinator<br>/);
  });

  test("with secure links: message, attachment lines, signature, company footer", async () => {
    const r = await send({ trackOpens: "0", secureLinks: "1" }, { files: [["report.pdf", PDF]] });
    assert.equal(r.status, 201);
    const t = plainBody(r.text);
    const at = (needle) => t.indexOf(needle);
    assert.ok(at("Thank you.") < at("Attachments (available until"));
    assert.ok(at("Attachments (available until") < at("\n-- \n"));
    assert.ok(at("\n-- \n") < at("Anita Rao"));
    assert.ok(at("Anita Rao") < at(FOOTER));
    assert.equal((t.match(/\n-- \n/g) || []).length, 1, "one divider only");
  });

  test("with the footer notice switched on, it is last", async () => {
    state = { ...ON, disclosureEnabled: true };
    const r = await send({});
    const t = plainBody(r.text);
    assert.ok(t.indexOf(FOOTER) < t.indexOf("This email may include technology"));
    assert.ok(t.indexOf("Anita Rao") < t.indexOf(FOOTER));
  });

  test("a reply carries the signature the same way", async () => {
    const inbound = new EmailMessage({ mailbox: support._id, direction: "in", status: "received", gmailMessageId: "gi", gmailThreadId: "ti", rfcMessageId: "<i@x>", from: { address: "client@gmail.com" }, to: [{ address: support.address }], subject: "Question", messageDate: new Date() });
    inbound.setContent({ text: "hi", html: "", snippet: "hi" });
    await inbound.save();
    const fd = new FormData();
    fd.set("body", withSig("Answer: yes."));
    fd.set("clientRequestId", "rep-sig");
    fd.set("trackOpens", "0");
    fd.set("signatureId", String(anitaSig._id));
    const res = await fetch(`${base}/messages/${inbound._id}/reply`, { method: "POST", headers: { "x-test-admin": String(anita._id) }, body: fd });
    assert.equal(res.status, 201);
    const whole = decodeQP(gmail.sent[0]);
    const text = whole.slice(whole.indexOf("Answer: yes."));
    assert.ok(text.indexOf("Answer: yes.") < text.indexOf("Anita Rao"));
    assert.ok(text.indexOf("Anita Rao") < text.indexOf(FOOTER));
    // a foreign id on a reply is refused as well
    const theirs = await EmailSignature.create({ owner: ravi._id, name: "R", nameKey: "r", content: "R", isDefault: true });
    const fd2 = new FormData();
    fd2.set("body", "x");
    fd2.set("clientRequestId", "rep-sig-2");
    fd2.set("signatureId", String(theirs._id));
    const bad = await fetch(`${base}/messages/${inbound._id}/reply`, { method: "POST", headers: { "x-test-admin": String(anita._id) }, body: fd2 });
    assert.equal(bad.status, 400);
  });

  test("the snippet in lists starts with the message, not the signature", async () => {
    const r = await send({ trackOpens: "0" });
    assert.match(r.body.message.snippet, /^Dear client,/);
  });

  test("a duplicate send (same request id) does not change the stored copy", async () => {
    const a = await send({ trackOpens: "0", clientRequestId: "same-1" });
    const b = await send({ trackOpens: "0", clientRequestId: "same-1" });
    assert.equal(b.body.duplicate, true);
    assert.equal(a.body.message.id, b.body.message.id);
    assert.equal(gmail.sent.length, 1);
  });
});

describe("the Super Admin setting", () => {
  let mongod, server, base, root;
  const fakeAuth = (req, res, next) => { req.user = { id: String(root._id), role: "superadmin" }; next(); };
  const call = async (method, body) => {
    const res = await fetch(base, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([EmailSettings.init(), User.init()]);
    root = await User.create({ name: "Root", email: "r@x.co", role: "superadmin" });
    const app = express();
    app.use(express.json());
    app.use("/s", superadminSettings.create({ guard: [fakeAuth], getState: (o) => getTrackingState({ ...o, env: {} }) }));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}/s`;
  });
  after(async () => {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await EmailSettings.deleteMany({});
    clearSettingsCache();
  });

  test("default ON; can be switched off and on; must be a boolean", async () => {
    assert.equal((await call("GET")).body.tracking.companyFooterWithSignature, true);
    let r = await call("PATCH", { companyFooterWithSignature: false });
    assert.equal(r.status, 200);
    assert.equal(r.body.tracking.companyFooterWithSignature, false);
    r = await call("PATCH", { companyFooterWithSignature: true });
    assert.equal(r.body.tracking.companyFooterWithSignature, true);
    assert.equal((await call("PATCH", { companyFooterWithSignature: "no" })).status, 400);
  });

  test("it is independent of every tracking switch (read even when tracking is closed)", async () => {
    await call("PATCH", { companyFooterWithSignature: false });
    clearSettingsCache();
    const s = await getTrackingState({ env: {}, full: true });
    assert.equal(s.companyFooterWithSignature, false);
  });
});
