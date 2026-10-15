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
const signaturesRouter = require("../routes/adminEmailSignatures");
const { buildRawMessage, composeText } = require("../services/gmail/mimeBuilder");
const { clearSettingsCache } = require("../services/email/emailSettings");
const { planCleanup } = require("../scripts/cleanupEmailSignatures");

const BASE = "https://uat.example.com";
const FOOTER = "Human Care Connect";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const decodeQP = (s) => s.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
const png = (w = 500, h = 120) => sharp({ create: { width: w, height: h, channels: 3, background: { r: 20, g: 90, b: 160 } } }).png().toBuffer();

describe("composeText", () => {
  test("with the company footer: message, divider, footer, notice (unchanged)", () => {
    assert.equal(composeText("Hello", "Human Care Connect", "Notice"), "Hello\n\n-- \nHuman Care Connect\n\nNotice\n");
    assert.equal(composeText("Hello", ""), "Hello\n");
  });
  test("with an image signature (no footer): just the message, attachment lines and notice - no divider", () => {
    assert.equal(composeText("Hello", "Human Care Connect", "Notice", "Attachments:\n- a.pdf", { companyFooter: false }), "Hello\n\nAttachments:\n- a.pdf\n\nNotice\n");
    assert.equal(composeText("Hello", "Human Care Connect", "", "", { companyFooter: false }), "Hello\n");
  });
});

describe("cleanup plan for old signatures", () => {
  const id = (n) => `id${n}`;
  const img = (n) => ({ key: `email-signature-images/o/${n}.png` });
  test("keeps one image signature per admin (default first, then newest), deletes the rest", () => {
    const docs = [
      { _id: id(1), owner: "a", isDefault: false, image: img(1), updatedAt: "2026-10-03" },
      { _id: id(2), owner: "a", isDefault: true, image: img(2), updatedAt: "2026-10-01" },
      { _id: id(3), owner: "a", isDefault: false, updatedAt: "2026-10-04" },
      { _id: id(4), owner: "b", isDefault: false, image: img(4), updatedAt: "2026-10-01" },
      { _id: id(5), owner: "b", isDefault: false, image: img(5), updatedAt: "2026-10-02" },
    ];
    const plan = planCleanup(docs);
    assert.deepEqual(plan.keep.map((k) => k._id).sort(), [id(2), id(5)]);
    assert.deepEqual(plan.remove.map((r) => r._id).sort(), [id(1), id(3), id(4)]);
    // only the deleted ones' image files are removed, never the kept one's
    assert.deepEqual(plan.remove.filter((r) => r.imageKey).map((r) => r.imageKey).sort(), [img(1).key, img(4).key]);
  });
  test("an admin with only text signatures ends up with none", () => {
    const plan = planCleanup([{ _id: id(1), owner: "a", name: "Formal", content: "Anita" }, { _id: id(2), owner: "a", name: "Short", content: "A" }]);
    assert.deepEqual(plan.keep, []);
    assert.equal(plan.remove.length, 2);
    assert.ok(plan.remove.every((r) => r.imageKey === ""));
  });
  test("a kept old signature is stripped and gets autoAdd on; an already-clean one is left alone (safe to run twice)", () => {
    const old = planCleanup([{ _id: id(1), owner: "a", name: "x", nameKey: "x", content: "c", layout: "image", isDefault: true, image: img(1) }]);
    assert.deepEqual(old.keep, [{ _id: id(1), needsStrip: true, needsAutoAdd: true }]);
    const clean = planCleanup([{ _id: id(1), owner: "a", autoAdd: false, image: img(1) }]);
    assert.deepEqual(clean.keep, [{ _id: id(1), needsStrip: false, needsAutoAdd: false }]);
    assert.deepEqual(clean.remove, []);
  });
});

describe("image-only signatures", () => {
  let mongod, server, base, gmail, state, store, support, anita, ravi, banner, otherMailbox, now;
  const fakeAuth = (req, res, next) => { req.user = { id: req.headers["x-test-admin"], role: "admin" }; next(); };
  const ON = { active: true, linksActive: true, secureLinksActive: true, secureLinkDays: 7, baseUrl: BASE, disclosureEnabled: false, disclosureText: "" };
  const as = (u) => ({ "x-test-admin": String(u._id) });
  const SIG = () => `${base}/signatures`;

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([Mailbox.init(), EmailMessage.init(), EmailAttachment.init(), EmailDownloadLink.init(), EmailLink.init(), EmailSignature.init(), EmailSettings.init(), EmailTrackingOptOut.init(), User.init()]);
    store = {
      files: new Map(),
      failGet: false,
      failPut: false,
      failPutPrefix: "",
      async put(key, buf, type) {
        if (this.failPut || (this.failPutPrefix && key.startsWith(this.failPutPrefix))) throw new Error("S3 down");
        this.files.set(key, { buf, type });
      },
      async get(key) {
        if (this.failGet || !this.files.has(key)) throw new Error("missing");
        return this.files.get(key).buf;
      },
      async remove(key) { this.files.delete(key); },
    };
    now = () => Date.now();
    const app = express();
    app.use(express.json());
    // Same order as server.js: signatures first, then the rest of the Email module.
    app.use("/api/admin/email/signatures", signaturesRouter.create({ guard: [fakeAuth], store, uploadsPerHour: 6, now: () => now() }));
    app.use("/api/admin/email", (req, res, next) => adminEmail.create({ guard: [fakeAuth], getGmail: () => gmail, store, trackingState: async () => state })(req, res, next));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}/api/admin/email`;
    banner = await png(480, 120);
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
    store.failPut = false;
    store.failPutPrefix = "";
    now = () => Date.now();
    support = await Mailbox.create({ address: "support@humancareconnect.co", displayName: "Support", signature: FOOTER });
    anita = await User.create({ name: "Anita Rao", email: "anita@x.co", role: "admin" });
    ravi = await User.create({ name: "Ravi", email: "ravi@x.co", role: "admin" });
    otherMailbox = await Mailbox.create({ address: "billing@humancareconnect.co", displayName: "Billing", allowedAdmins: [ravi._id] });
    state = { ...ON };
    gmail = { sent: [], async sendRaw(raw) { this.sent.push(raw.toString()); return { id: `g${this.sent.length}`, threadId: `t${this.sent.length}` }; } };
  });

  // Gives Anita a stored signature image directly (the upload route is tested separately).
  async function giveSignature(owner = anita, extra = {}) {
    const key = `email-signature-images/${owner._id}/banner.png`;
    store.files.set(key, { buf: banner, type: "image/png" });
    return EmailSignature.create({ owner: owner._id, image: { key, mime: "image/png", width: 480, height: 120, bytes: banner.length }, ...extra });
  }
  async function upload(user, buf, { name = "sig.png", type = "image/png" } = {}) {
    const fd = new FormData();
    fd.set("image", new Blob([buf], { type }), name);
    return fetch(`${SIG()}/image`, { method: "PUT", headers: as(user), body: fd });
  }
  const patch = (user, body) => fetch(SIG(), { method: "PATCH", headers: { ...as(user), "content-type": "application/json" }, body: JSON.stringify(body) });

  // ── My signature: the API ──
  describe("API", () => {
    test("a new admin has no image and automatic adding on; nothing is created by looking", async () => {
      const res = await fetch(SIG(), { headers: as(anita) });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.deepEqual(body.signature, { image: null, autoAdd: true, updatedAt: null });
      assert.deepEqual(body.limits, { maxImageBytes: 200 * 1024, maxImageWidth: 600, maxImageHeight: 400 });
      assert.equal(await EmailSignature.countDocuments(), 0);
    });

    test("upload: processed to 600 px, stored under the owner's prefix, the key is never returned", async () => {
      const res = await upload(anita, await png(1200, 300));
      assert.equal(res.status, 200);
      const { signature } = await res.json();
      assert.equal(signature.image.width, 600);
      assert.equal(signature.image.height, 150);
      assert.equal(signature.autoAdd, true);
      assert.ok(!JSON.stringify(signature).includes("email-signature-images"));
      const doc = await EmailSignature.findOne({ owner: anita._id }).lean();
      assert.match(doc.image.key, new RegExp(`^email-signature-images/${anita._id}/[0-9a-f]{24}\\.png$`));
      assert.ok(store.files.has(doc.image.key));
      assert.equal(await EmailSignature.countDocuments(), 1);
    });

    test("replace: one document, the old file is removed", async () => {
      await upload(anita, banner);
      const first = (await EmailSignature.findOne({ owner: anita._id }).lean()).image.key;
      const res = await upload(anita, await png(300, 100));
      assert.equal(res.status, 200);
      const doc = await EmailSignature.find({ owner: anita._id }).lean();
      assert.equal(doc.length, 1);
      assert.notEqual(doc[0].image.key, first);
      assert.ok(!store.files.has(first));
      assert.ok(store.files.has(doc[0].image.key));
      assert.equal(doc[0].image.width, 300);
    });

    test("the image is served to its owner with safe headers; no image is a 404", async () => {
      assert.equal((await fetch(`${SIG()}/image`, { headers: as(anita) })).status, 404);
      await upload(anita, banner);
      const res = await fetch(`${SIG()}/image`, { headers: as(anita) });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("content-type"), "image/png");
      assert.equal(res.headers.get("x-content-type-options"), "nosniff");
      assert.match(res.headers.get("content-security-policy"), /sandbox/);
      assert.match(res.headers.get("cache-control"), /no-store/);
      assert.equal((await sharp(Buffer.from(await res.arrayBuffer())).metadata()).width, 480);
    });

    test("privacy: nobody else sees or loads it, and nothing in the request chooses the owner", async () => {
      await upload(anita, banner);
      assert.equal((await fetch(`${SIG()}/image`, { headers: as(ravi) })).status, 404);
      assert.equal((await (await fetch(SIG(), { headers: as(ravi) })).json()).signature.image, null);
      // ids in the URL or body do not matter: the session decides
      const res = await fetch(`${SIG()}/${anita._id}/image`, { headers: as(ravi) });
      assert.equal(res.status, 404);
      const fd = new FormData();
      fd.set("owner", String(anita._id));
      fd.set("image", new Blob([banner], { type: "image/png" }), "x.png");
      await fetch(`${SIG()}/image`, { method: "PUT", headers: as(ravi), body: fd });
      assert.equal(await EmailSignature.countDocuments({ owner: anita._id }), 1);
      assert.equal((await EmailSignature.findOne({ owner: anita._id }).lean()).image.width, 480);
      assert.equal(await EmailSignature.countDocuments({ owner: ravi._id }), 1);
    });

    test("remove: the image and its file go, the 'add automatically' choice stays", async () => {
      await upload(anita, banner);
      await patch(anita, { autoAdd: false });
      const key = (await EmailSignature.findOne({ owner: anita._id }).lean()).image.key;
      const res = await fetch(`${SIG()}/image`, { method: "DELETE", headers: as(anita) });
      assert.equal(res.status, 200);
      assert.deepEqual((await res.json()).signature.image, null);
      assert.ok(!store.files.has(key));
      assert.equal((await (await fetch(SIG(), { headers: as(anita) })).json()).signature.autoAdd, false);
      // removing again (or with nothing at all) is fine
      assert.equal((await fetch(`${SIG()}/image`, { method: "DELETE", headers: as(anita) })).status, 200);
      assert.equal((await fetch(`${SIG()}/image`, { method: "DELETE", headers: as(ravi) })).status, 200);
    });

    test("'Add to new mails automatically': saved per admin, only a true/false is accepted, nothing else is editable", async () => {
      let res = await patch(anita, { autoAdd: false });
      assert.equal(res.status, 200);
      assert.equal((await res.json()).signature.autoAdd, false);
      assert.equal((await (await fetch(SIG(), { headers: as(ravi) })).json()).signature.autoAdd, true);
      for (const bad of [{ autoAdd: "yes" }, { autoAdd: 1 }, {}, { autoAdd: true, name: "x" }, { name: "x" }, { layout: "image" }, { imageAlt: "x" }, { imageLink: "https://x.co" }]) {
        res = await patch(anita, bad);
        assert.equal(res.status, 400, JSON.stringify(bad));
      }
      assert.equal((await EmailSignature.findOne({ owner: anita._id }).lean()).autoAdd, false);
    });

    test("only PNG or JPG are accepted: SVG, GIF, text and a renamed file are refused, nothing is stored", async () => {
      const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"><rect width="400" height="100"/></svg>');
      const gif = await sharp({ create: { width: 200, height: 80, channels: 3, background: "#123456" } }).gif().toBuffer();
      for (const [buf, name, type] of [[svg, "a.svg", "image/svg+xml"], [gif, "a.gif", "image/gif"], [Buffer.from("hello"), "a.png", "image/png"], [svg, "a.png", "image/png"]]) {
        const res = await upload(anita, buf, { name, type });
        assert.equal(res.status, 400, name);
        assert.ok((await res.json()).msg);
      }
      const none = await fetch(`${SIG()}/image`, { method: "PUT", headers: as(anita), body: new FormData() });
      assert.equal(none.status, 400);
      assert.equal(await EmailSignature.countDocuments(), 0);
      assert.equal(store.files.size, 0);
    });

    test("over 5 MB is refused", async () => {
      const res = await upload(anita, Buffer.alloc(5 * 1024 * 1024 + 10, 1));
      assert.equal(res.status, 400);
      assert.match((await res.json()).msg, /5 MB/);
    });

    test("a storage failure on upload leaves the old image as it was", async () => {
      await upload(anita, banner);
      const before = await EmailSignature.findOne({ owner: anita._id }).lean();
      store.failPut = true;
      const res = await upload(anita, await png(300, 100));
      assert.equal(res.status, 500);
      const after = await EmailSignature.findOne({ owner: anita._id }).lean();
      assert.equal(after.image.key, before.image.key);
      assert.ok(store.files.has(before.image.key));
    });

    test("a storage failure when showing the image is a 503 with a clear message", async () => {
      await upload(anita, banner);
      store.failGet = true;
      const res = await fetch(`${SIG()}/image`, { headers: as(anita) });
      assert.equal(res.status, 503);
      assert.match((await res.json()).msg, /could not be loaded/);
    });

    test("uploads are throttled per admin", async () => {
      const statuses = [];
      for (let i = 0; i < 8; i += 1) statuses.push((await upload(anita, banner)).status);
      assert.deepEqual(statuses, [200, 200, 200, 200, 200, 200, 429, 429]);
      assert.equal((await upload(ravi, banner)).status, 200);
      now = () => Date.now() + 3_700_000;
      assert.equal((await upload(anita, banner)).status, 200);
    });

    test("a disabled account is refused", async () => {
      await User.updateOne({ _id: anita._id }, { accountDisabled: true });
      assert.equal((await fetch(SIG(), { headers: as(anita) })).status, 401);
      assert.equal((await upload(anita, banner)).status, 401);
    });

    test("the old text/multiple-signature routes are gone", async () => {
      const json = { ...as(anita), "content-type": "application/json" };
      const id = new mongoose.Types.ObjectId();
      assert.equal((await fetch(SIG(), { method: "POST", headers: json, body: JSON.stringify({ name: "x", content: "y" }) })).status, 404);
      assert.equal((await fetch(`${SIG()}/${id}`, { method: "PATCH", headers: json, body: "{}" })).status, 404);
      assert.equal((await fetch(`${SIG()}/${id}`, { method: "DELETE", headers: as(anita) })).status, 404);
      assert.equal((await fetch(`${SIG()}/mailbox-defaults`, { method: "PUT", headers: json, body: "{}" })).status, 404);
    });

    test("the database allows one signature per admin", async () => {
      await giveSignature(anita);
      await assert.rejects(EmailSignature.create({ owner: anita._id }), (e) => e.code === 11000);
    });
  });

  // ── sending ──
  describe("sent mail", () => {
    async function send(fields = {}, { files = [], user = anita } = {}) {
      const fd = new FormData();
      const all = { from: String(support._id), to: "client@gmail.com", subject: "Your enquiry", body: "Dear client,\nThank you.", signature: "1", trackOpens: "0", ...fields };
      for (const [k, v] of Object.entries(all)) if (v !== undefined) fd.set(k, v);
      for (const [name, buf] of files) fd.append("files", new Blob([buf], { type: "application/pdf" }), name);
      const res = await fetch(`${base}/send`, { method: "POST", headers: as(user), body: fd });
      const body = await res.json();
      const mime = gmail.sent.at(-1) || "";
      const htmlStart = mime.search(/Content-Type: text\/html/i);
      const tStart = mime.search(/Content-Type: text\/plain/i);
      const afterHeaders = tStart >= 0 ? mime.indexOf("\r\n\r\n", tStart) + 4 : 0;
      const rest = mime.slice(afterHeaders);
      // nodemailer boundaries are "--_NmP-..."; a quoted-printable "-- " divider line is "--=20"
      const end = rest.search(/\r?\n-{2,4}_NmP-[A-Za-z0-9_-]+/);
      const textPart = end >= 0 ? rest.slice(0, end) : rest;
      const htmlPart = htmlStart >= 0 ? mime.slice(htmlStart) : "";
      return { status: res.status, body, mime, text: decodeQP(textPart).replace(/\r/g, ""), html: decodeQP(htmlPart) };
    }
    const cidOf = (html) => /src="cid:([^"]+)"/.exec(html)?.[1];

    test("the image is an inline CID part of multipart/related with no file name, and it is the stored image", async () => {
      await giveSignature();
      const r = await send();
      assert.equal(r.status, 201);
      assert.match(r.mime, /Content-Type: multipart\/related/i);
      const cid = cidOf(r.html);
      assert.match(cid, /^sig-[0-9a-f-]{36}@humancareconnect\.co$/);
      const at = r.mime.indexOf(`Content-ID: <${cid}>`);
      assert.ok(at > 0);
      const partHead = r.mime.slice(r.mime.lastIndexOf("--", at - 2), at + 400);
      assert.match(partHead, /Content-Type: image\/png/i);
      assert.match(partHead, /Content-Disposition: inline\r?\n/i);
      assert.ok(!/filename=/i.test(partHead));
      const b64 = r.mime.slice(at).split(/\r?\n\r?\n/)[1].split(/\r?\n--/)[0].replace(/\s+/g, "");
      assert.deepEqual(Buffer.from(b64, "base64"), banner);
    });

    test("HTML: the message, then the image with the alt text 'Signature'; no footer, no divider, no name", async () => {
      await giveSignature();
      const r = await send();
      const i = r.html.indexOf("Thank you.");
      const j = r.html.indexOf('<img src="cid:');
      assert.ok(i > 0 && i < j);
      assert.match(r.html, /alt="Signature"/);
      assert.ok(!r.html.includes(FOOTER));
      assert.ok(!r.html.includes("Anita"));
      assert.ok(!/-- /.test(r.html.replace(/<[^>]+>/g, "")));
      assert.ok(!/<a /.test(r.html), "the image is not a link");
    });

    test("plain text: just the message - no signature text, no divider, no company footer", async () => {
      await giveSignature();
      const r = await send();
      const body = r.text.slice(r.text.indexOf("Dear client")).trimEnd();
      assert.equal(body, "Dear client,\nThank you.");
      assert.ok(!/cid:|Anita|--/.test(r.text));
    });

    test("without the box ticked the mail is exactly what it was: company footer, no image, no HTML", async () => {
      await giveSignature();
      for (const fields of [{ signature: undefined }, { signature: "0" }, { signature: "true" }]) {
        const r = await send(fields);
        assert.equal(r.status, 201);
        assert.ok(!/multipart\/related|text\/html|Content-ID/i.test(r.mime), JSON.stringify(fields));
        assert.equal(r.text.slice(r.text.indexOf("Dear client")).trimEnd(), `Dear client,\nThank you.\n\n-- \n${FOOTER}`);
      }
    });

    test("the Super Admin 'company footer with signature' setting no longer matters: the image never has the footer", async () => {
      await giveSignature();
      await EmailSettings.create({ key: "email", companyFooterWithSignature: true });
      clearSettingsCache();
      const r = await send();
      assert.ok(!r.html.includes(FOOTER));
      assert.ok(!r.text.includes(FOOTER));
    });

    test("ticked but the admin has no image (never uploaded, or removed since): refused, nothing sent", async () => {
      let r = await send();
      assert.equal(r.status, 400);
      assert.equal(r.body.code, "SIGNATURE_NOT_FOUND");
      assert.equal(gmail.sent.length, 0);
      const sig = await giveSignature();
      await EmailSignature.updateOne({ _id: sig._id }, { image: null });
      r = await send();
      assert.equal(r.status, 400);
      assert.equal(gmail.sent.length, 0);
      assert.equal(await EmailMessage.countDocuments(), 0);
    });

    test("it is always the sender's own image: another admin's image is never used", async () => {
      await giveSignature(anita);
      const r = await send({}, { user: ravi }); // Ravi has none
      assert.equal(r.status, 400);
      assert.equal(gmail.sent.length, 0);
      await giveSignature(ravi);
      const ok = await send({ signature: "1", owner: String(anita._id), signatureId: String((await EmailSignature.findOne({ owner: anita._id }))._id) }, { user: ravi });
      assert.equal(ok.status, 201);
      const sent = await EmailMessage.findById(ok.body.message.id).lean();
      assert.ok(sent.signatureImage.key.startsWith(`email-sent-signatures/${support._id}/`));
    });

    test("with 'Track opens' on the tracking image is still last and is a different image", async () => {
      await giveSignature();
      const r = await send({ trackOpens: "1" });
      const sigImg = r.html.indexOf('<img src="cid:');
      const pixel = r.html.indexOf("/api/e/");
      assert.ok(sigImg > 0 && pixel > sigImg);
      assert.match(r.html, /<img src="https:\/\/uat\.example\.com\/api\/e\/[A-Za-z0-9_-]{32}\.gif" width="1" height="1" alt="" border="0"[^>]*><\/body>/);
      assert.equal((r.html.match(/<img /g) || []).length, 2);
    });

    test("with 'Track opens' off there is no tracking image, only the signature", async () => {
      await giveSignature();
      const r = await send({ trackOpens: "0" });
      assert.ok(!/\/api\/e\//.test(r.mime));
      assert.equal((r.html.match(/<img /g) || []).length, 1);
    });

    test("links in the message are still tracked, and only those", async () => {
      await giveSignature();
      const r = await send({ trackOpens: "1", body: "See https://humancareconnect.co/plans please." });
      assert.match(r.html, /<a href="https:\/\/uat\.example\.com\/api\/l\/[A-Za-z0-9_-]+"/);
      assert.equal(await EmailLink.countDocuments(), 1);
      assert.ok(!/<a [^>]*>\s*<img/.test(r.html));
    });

    test("what a recipient can read has no tracking wording around the image", async () => {
      await giveSignature();
      const r = await send({ trackOpens: "1" });
      const visible = r.html.replace(/<[^>]*>/g, " ");
      assert.ok(!/track|record|pixel|beacon|opened|clicked|secure/i.test(visible), visible);
    });

    test("normal attachments and the image together: one real attachment, one inline image", async () => {
      await giveSignature();
      const r = await send({}, { files: [["report.pdf", PDF]] });
      assert.equal(r.status, 201);
      assert.match(r.mime, /Content-Type: multipart\/mixed/i);
      assert.ok(/filename="?report\.pdf/i.test(r.mime));
      assert.equal((r.mime.match(/Content-ID:/gi) || []).length, 1);
    });

    test("secure links: the lines sit above the image in HTML and after the message in the text", async () => {
      await giveSignature();
      const r = await send({ secureLinks: "1" }, { files: [["report.pdf", PDF]] });
      assert.equal(r.status, 201);
      assert.ok(r.html.indexOf("Attachments (available until") < r.html.indexOf('<img src="cid:'));
      assert.ok(r.text.indexOf("Attachments (available until") > r.text.indexOf("Thank you."));
      assert.ok(!r.text.includes("\n-- \n"));
    });

    test("the footer notice is last in both parts", async () => {
      await giveSignature();
      state = { ...ON, disclosureEnabled: true };
      const r = await send({ trackOpens: "1" });
      assert.ok(r.html.includes("This email may include technology"));
      assert.ok(r.html.indexOf("This email may include technology") > r.html.indexOf('<img src="cid:'));
      assert.ok(r.text.trimEnd().endsWith(r.text.slice(r.text.indexOf("This email may include technology")).trimEnd()));
    });

    test("a read receipt request does not change the image", async () => {
      await giveSignature();
      const r = await send({ requestReceipt: "1" });
      assert.match(r.mime, /Disposition-Notification-To/);
      assert.match(r.html, /<img src="cid:/);
    });

    test("the image cannot be loaded: refused with a clear message, nothing is sent or stored", async () => {
      await giveSignature();
      store.failGet = true;
      const r = await send();
      assert.equal(r.status, 503);
      assert.equal(r.body.code, "SIGNATURE_IMAGE_UNAVAILABLE");
      assert.equal(gmail.sent.length, 0);
      assert.equal(await EmailMessage.countDocuments(), 0);
    });

    test("the sent copy cannot be stored: the mail is not sent and is marked failed", async () => {
      await giveSignature();
      store.failPutPrefix = "email-sent-signatures/";
      const r = await send();
      assert.equal(r.status, 502);
      assert.equal(gmail.sent.length, 0);
      assert.equal((await EmailMessage.findOne({})).status, "failed");
    });

    test("reply: the same box works, and a failed image load gives the claim back", async () => {
      await giveSignature();
      const inbound = new EmailMessage({ mailbox: support._id, direction: "in", status: "received", gmailMessageId: "gi", gmailThreadId: "ti", rfcMessageId: "<i@x>", from: { address: "client@gmail.com" }, to: [{ address: support.address }], subject: "Question", messageDate: new Date() });
      inbound.setContent({ text: "hi", html: "", snippet: "hi" });
      await inbound.save();
      const reply = (requestId, extra = {}) => {
        const fd = new FormData();
        fd.set("body", "Answer");
        fd.set("clientRequestId", requestId);
        fd.set("signature", "1");
        for (const [k, v] of Object.entries(extra)) fd.set(k, v);
        return fetch(`${base}/messages/${inbound._id}/reply`, { method: "POST", headers: as(anita), body: fd });
      };
      store.failGet = true;
      assert.equal((await reply("r1")).status, 503);
      assert.equal((await EmailMessage.findById(inbound._id)).repliedAt, null);
      assert.equal(gmail.sent.length, 0);
      store.failGet = false;
      assert.equal((await reply("r2")).status, 201);
      assert.match(gmail.sent[0], /Content-ID: <sig-/);
      // (the From header carries the company name, so look for the footer's divider instead)
      assert.ok(!/--=20/.test(gmail.sent[0]), "no '-- ' divider and footer");
    });

    test("reply with no image to use is refused before the mail is claimed", async () => {
      const inbound = new EmailMessage({ mailbox: support._id, direction: "in", status: "received", gmailMessageId: "gi", gmailThreadId: "ti", rfcMessageId: "<i@x>", from: { address: "client@gmail.com" }, to: [{ address: support.address }], subject: "Question", messageDate: new Date() });
      inbound.setContent({ text: "hi", html: "", snippet: "hi" });
      await inbound.save();
      const fd = new FormData();
      fd.set("body", "Answer");
      fd.set("clientRequestId", "r3");
      fd.set("signature", "1");
      const res = await fetch(`${base}/messages/${inbound._id}/reply`, { method: "POST", headers: as(anita), body: fd });
      assert.equal(res.status, 400);
      assert.equal((await EmailMessage.findById(inbound._id)).repliedAt, null);
    });

    // ── the dashboard copy ──
    test("the sent mail keeps its own copy of the image, unaffected by later changes to the signature", async () => {
      const sig = await giveSignature();
      const r = await send();
      const row = await EmailMessage.findById(r.body.message.id).lean();
      assert.match(row.signatureImage.key, new RegExp(`^email-sent-signatures/${support._id}/${row._id}/[0-9a-f]{16}\\.png$`));
      assert.deepEqual(store.files.get(row.signatureImage.key).buf, banner);
      assert.equal(row.signatureImage.alt, "Signature");
      assert.equal(row.signatureImage.layout, undefined);

      // the admin removes the image, then replaces it with another
      await fetch(`${SIG()}/image`, { method: "DELETE", headers: as(anita) });
      await upload(anita, await png(300, 100));
      assert.ok(store.files.has(row.signatureImage.key));
      void sig;
      const res = await fetch(`${base}/messages/${row._id}/signature-image`, { headers: as(anita) });
      assert.equal(res.status, 200);
      assert.deepEqual(Buffer.from(await res.arrayBuffer()), banner);
    });

    test("the stored text is the message only; the mail page carries the image facts but never the key", async () => {
      await giveSignature();
      const r = await send();
      const row = await EmailMessage.findById(r.body.message.id);
      assert.equal(row.getContent().text, "Dear client,\nThank you.\n");
      const page = await (await fetch(`${base}/messages/${row._id}`, { headers: as(anita) })).json();
      assert.deepEqual(page.message.signatureImage, { mime: "image/png", width: 480, height: 120, alt: "Signature" });
      assert.ok(!JSON.stringify(page).includes("email-sent-signatures"));
      const list = await (await fetch(`${base}/messages?folder=sent`, { headers: as(anita) })).json();
      assert.ok(!JSON.stringify(list).includes("email-sent-signatures"));
    });

    test("a mail sent without the signature has no image in its record", async () => {
      await giveSignature();
      const r = await send({ signature: "0" });
      const page = await (await fetch(`${base}/messages/${r.body.message.id}`, { headers: as(anita) })).json();
      assert.equal(page.message.signatureImage, null);
      assert.equal((await fetch(`${base}/messages/${r.body.message.id}/signature-image`, { headers: as(anita) })).status, 404);
    });

    test("the image route follows mailbox access like the mail itself, and has safe headers", async () => {
      await giveSignature();
      const own = await send();
      const id = own.body.message.id;
      const ok = await fetch(`${base}/messages/${id}/signature-image`, { headers: as(ravi) });
      assert.equal(ok.status, 200);
      assert.equal(ok.headers.get("x-content-type-options"), "nosniff");
      assert.match(ok.headers.get("content-security-policy"), /sandbox/);
      assert.match(ok.headers.get("cache-control"), /no-store/);
      const hidden = new EmailMessage({
        mailbox: otherMailbox._id, direction: "out", status: "sent", gmailMessageId: "gh", from: { address: otherMailbox.address }, to: [{ address: "c@gmail.com" }], subject: "Billing", messageDate: new Date(),
        signatureImage: { key: "email-sent-signatures/x/y/z.png", mime: "image/png", width: 10, height: 10 },
      });
      hidden.setContent({ text: "x", html: "", snippet: "x" });
      await hidden.save();
      store.files.set("email-sent-signatures/x/y/z.png", { buf: banner, type: "image/png" });
      assert.equal((await fetch(`${base}/messages/${hidden._id}/signature-image`, { headers: as(anita) })).status, 404);
      assert.equal((await fetch(`${base}/messages/${hidden._id}/signature-image`, { headers: as(ravi) })).status, 200);
      for (const bad of [String(new mongoose.Types.ObjectId()), "nope"]) {
        assert.equal((await fetch(`${base}/messages/${bad}/signature-image`, { headers: as(anita) })).status, 404, bad);
      }
    });

    test("a mail sent before this change (layout and text on its record) still opens and shows only the image facts", async () => {
      const old = new EmailMessage({
        mailbox: support._id, direction: "out", status: "sent", gmailMessageId: "go", from: { address: support.address }, to: [{ address: "c@gmail.com" }], subject: "Old", messageDate: new Date(), sentByAdmin: anita._id,
        signatureImage: { key: "email-sent-signatures/o/o/o.png", mime: "image/png", width: 480, height: 120, alt: "Anita Rao", link: "https://x.co", layout: "image_text", signatureText: "Anita" },
      });
      old.setContent({ text: "Old text", html: "", snippet: "Old text" });
      await old.save();
      const page = await (await fetch(`${base}/messages/${old._id}`, { headers: as(anita) })).json();
      assert.deepEqual(page.message.signatureImage, { mime: "image/png", width: 480, height: 120, alt: "Anita Rao" });
    });

    test("a mail built without a signature image is byte-identical in shape to before (no new parts)", async () => {
      const { raw } = await buildRawMessage({ mailbox: { _id: support._id, address: support.address, signature: FOOTER }, to: [{ address: "a@gmail.com" }], subject: "Hi", body: "Hello" });
      const s = raw.toString();
      assert.ok(!/multipart|text\/html|Content-ID/i.test(s));
      assert.match(s, /Content-Type: text\/plain/i);
    });
  });
});
