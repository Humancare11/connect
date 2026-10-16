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
const EmailDownloadEvent = require("../models/EmailDownloadEvent");
const EmailLink = require("../models/EmailLink");
const EmailTrackingOptOut = require("../models/EmailTrackingOptOut");
const EmailSettings = require("../models/EmailSettings");
const User = require("../models/User");
const adminEmail = require("../routes/adminEmail");
const superadminSettings = require("../routes/superadminEmailSettings");
const publicDownloads = require("../routes/publicDownloads");
const { secureLinksBlock } = require("../services/gmail/mimeBuilder");
const { recordDownload } = require("../services/email/downloadRecorder");
const { newToken, hashToken, downloadUrl } = require("../services/email/trackingToken");
const { getTrackingState, clearSettingsCache } = require("../services/email/emailSettings");
const { planSecureLinks } = require("../services/email/emailTracking");
const { computeReadStatus } = require("../services/email/readStatus");

const BASE = "https://uat.example.com";
const SENT = new Date("2026-10-05T10:00:00Z");
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const ON = { active: true, linksActive: false, secureLinksActive: true, secureLinkDays: 7, secureLinkDaysMax: 30, baseUrl: BASE, disclosureEnabled: false, disclosureText: "" };
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

const decodeQP = (s) => s.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

describe("the text that replaces the attachments", () => {
  test("lists each file with its size and link, and says when they expire", () => {
    const block = secureLinksBlock({
      items: [
        { filename: "report.pdf", size: 1_572_864, url: `${BASE}/api/d/${"a".repeat(32)}` },
        { filename: "note.txt", size: 100, url: `${BASE}/api/d/${"b".repeat(32)}` },
      ],
      expiresAt: new Date("2026-10-22T09:00:00Z"),
    });
    assert.match(block, /^Attachments \(available until 22 October 2026, UTC\):/);
    assert.ok(!/secure|track|record|download/i.test(block.replace(/https:\/\/\S+/g, "")), "only files, sizes and expiry");
    assert.match(block, /- report\.pdf \(1\.5 MB\)\n  https:\/\/uat\.example\.com\/api\/d\/a{32}/);
    assert.match(block, /- note\.txt \(1 KB\)\n  https:\/\/uat\.example\.com\/api\/d\/b{32}/);
  });

  test("a filename cannot add lines", () => {
    const block = secureLinksBlock({ items: [{ filename: "a.pdf\r\nBcc: x@evil.example", size: 10, url: `${BASE}/api/d/${"a".repeat(32)}` }], expiresAt: new Date() });
    assert.ok(!/\nBcc:/.test(block));
  });
});

describe("planSecureLinks", () => {
  test("default off, nothing to do without files, refuses when the feature is off", async () => {
    assert.deepEqual(await planSecureLinks({ requested: undefined, fileCount: 2, state: ON }), { enabled: false, reason: "not_requested" });
    assert.deepEqual(await planSecureLinks({ requested: false, fileCount: 2, state: ON }), { enabled: false, reason: "not_requested" });
    assert.deepEqual(await planSecureLinks({ requested: true, fileCount: 0, state: ON }), { enabled: false, reason: "no_files" });
    assert.deepEqual(await planSecureLinks({ requested: true, fileCount: 1, state: { ...ON, secureLinksActive: false } }), { enabled: false, reason: "off" });
    assert.deepEqual(await planSecureLinks({ requested: true, fileCount: 1, state: ON }), { enabled: true, days: 7, baseUrl: BASE });
  });
});

describe("secure attachment links: sending, downloading, recording", () => {
  let mongod, server, base, dlServer, dlBase, gmail, state, support, priya, store, storeFails, now;
  const fakeAuth = (req, res, next) => { req.user = { id: req.headers["x-test-admin"], role: "admin" }; next(); };

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([Mailbox.init(), EmailMessage.init(), EmailAttachment.init(), EmailDownloadLink.init(), EmailDownloadEvent.init(), EmailLink.init(), EmailTrackingOptOut.init(), User.init()]);
    store = {
      files: new Map(),
      async put(key, buf) { this.files.set(key, buf); },
      async get(key) {
        if (storeFails) throw new Error("S3 down");
        if (!this.files.has(key)) throw new Error("missing");
        return this.files.get(key);
      },
      async remove(key) { this.files.delete(key); },
    };
    const app = express();
    app.use(express.json());
    app.use("/api/admin/email", (req, res, next) => adminEmail.create({ guard: [fakeAuth], getGmail: () => gmail, store, trackingState: async () => state })(req, res, next));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}/api/admin/email`;

    const env = { EMAIL_TRACKING_GRACE_SECONDS: "60", EMAIL_TRACKING_IGNORE_IPS: "203.0.113.0/24", EMAIL_SCANNER_IPS: "proofpoint=198.51.100.0/24" };
    const dl = express();
    dl.use(
      "/api/d",
      publicDownloads.create({
        store,
        limitPerMinute: 1000,
        nowDate: () => now(),
        record: (args) => recordDownload(args, { state: { active: true }, env, now: now() }),
      })
    );
    dlServer = http.createServer(dl);
    await new Promise((r) => dlServer.listen(0, "127.0.0.1", r));
    dlBase = `http://127.0.0.1:${dlServer.address().port}/api/d`;
  });
  after(async () => {
    await new Promise((r) => server.close(r));
    await new Promise((r) => dlServer.close(r));
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await Promise.all([Mailbox.deleteMany({}), EmailMessage.deleteMany({}), EmailAttachment.deleteMany({}), EmailDownloadLink.deleteMany({}), EmailDownloadEvent.deleteMany({}), EmailLink.deleteMany({}), EmailTrackingOptOut.deleteMany({}), User.deleteMany({})]);
    store.files.clear();
    storeFails = false;
    support = await Mailbox.create({ address: "support@humancareconnect.co", displayName: "Support" });
    priya = await User.create({ name: "Priya", email: "p@x.co", role: "admin" });
    state = { ...ON };
    now = () => new Date();
    gmail = { sent: [], async sendRaw(raw) { this.sent.push(raw.toString()); return { id: `g${this.sent.length}`, threadId: `t${this.sent.length}` }; } };
  });

  const send = async ({ files = [["report.pdf", PDF]], ...fields } = {}) => {
    const fd = new FormData();
    const all = { from: String(support._id), to: "anita@gmail.com", subject: "Your report", body: "Please find it below.", ...fields };
    for (const [k, v] of Object.entries(all)) if (v !== undefined) fd.set(k, v);
    for (const [name, buf] of files) fd.append("files", new Blob([buf], { type: "application/pdf" }), name);
    const res = await fetch(`${base}/send`, { method: "POST", headers: { "x-test-admin": String(priya._id) }, body: fd });
    return { status: res.status, body: await res.json() };
  };
  const tokensIn = (mime) => [...decodeQP(mime).matchAll(/\/api\/d\/([A-Za-z0-9_-]{32})/g)].map((m) => m[1]);
  const wait = async (fn, ms = 1500) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await fn()) return true;
      await new Promise((r) => setTimeout(r, 25));
    }
    return false;
  };

  // ── sending ──
  test("default: files are attached exactly as before, no links, no rows", async () => {
    const { status, body } = await send();
    assert.equal(status, 201);
    assert.match(gmail.sent[0], /Content-Disposition: attachment; filename=/i);
    assert.ok(!/\/api\/d\//.test(gmail.sent[0]));
    assert.equal(await EmailDownloadLink.countDocuments(), 0);
    assert.equal((await EmailMessage.findById(body.message.id)).tracking.secureLinks, false);
  });

  test("ticked: nothing is attached, each file has its own link, only hashes are stored", async () => {
    const { status, body } = await send({ secureLinks: "1", files: [["report.pdf", PDF], ["labs.pdf", PDF]] });
    assert.equal(status, 201);
    const mime = gmail.sent[0];
    assert.ok(!/Content-Disposition: attachment/i.test(mime), "no attached file");
    assert.ok(!/application\/pdf/i.test(mime), "no PDF part");
    const text = decodeQP(mime);
    assert.match(text, /report\.pdf/);
    assert.match(text, /labs\.pdf/);
    assert.match(text, /Attachments \(available until/);
    // each address appears in the text part and in the HTML part (href and visible text)
    const tokens = [...new Set(tokensIn(mime))];
    assert.equal(tokens.length, 2);

    const links = await EmailDownloadLink.find({ message: body.message.id }).sort({ index: 1 }).lean();
    assert.equal(links.length, 2);
    assert.deepEqual(links.map((l) => l.tokenHash).sort(), tokens.map(hashToken).sort());
    assert.ok(!JSON.stringify(links).includes(tokens[0]), "token itself is never stored");
    const attachments = await EmailAttachment.find({ message: body.message.id }).sort({ _id: 1 }).lean();
    assert.deepEqual(links.map((l) => String(l.attachment)), attachments.map((a) => String(a._id)));
    assert.equal(store.files.size, 2, "files are in storage");
  });

  test("expiry is the configured number of days from sending", async () => {
    state = { ...ON, secureLinkDays: 3 };
    const { body } = await send({ secureLinks: "1" });
    const row = await EmailMessage.findById(body.message.id);
    const days = (row.tracking.secureLinksExpireAt - Date.now()) / 86_400_000;
    assert.ok(days > 2.99 && days <= 3.001, String(days));
    const link = await EmailDownloadLink.findOne({ message: body.message.id });
    assert.equal(link.expiresAt.getTime(), row.tracking.secureLinksExpireAt.getTime());
    assert.equal(row.tracking.secureLinks, true);
  });

  test("ticked but switched off: refused with 409, nothing sent or stored", async () => {
    state = { ...ON, secureLinksActive: false };
    const { status, body } = await send({ secureLinks: "1" });
    assert.equal(status, 409);
    assert.equal(body.code, "SECURE_LINKS_OFF");
    assert.equal(gmail.sent.length, 0);
    assert.equal(await EmailMessage.countDocuments(), 0);
    assert.equal(store.files.size, 0);
  });

  test("ticked without any file is just a normal mail", async () => {
    const { status } = await send({ secureLinks: "1", files: [] });
    assert.equal(status, 201);
    assert.ok(!/available until/.test(decodeQP(gmail.sent[0])));
  });

  test("anything other than '1' does not ask", async () => {
    await send({ secureLinks: "true" });
    assert.match(gmail.sent[0], /Content-Disposition: attachment/i);
  });

  test("works without 'Track opens': plain-text mail with the links", async () => {
    await send({ secureLinks: "1", trackOpens: "0" });
    assert.ok(!/multipart\/alternative/i.test(gmail.sent[0]));
    assert.equal(tokensIn(gmail.sent[0]).length, 1);
  });

  test("download links are not rewritten by link tracking (no double hop)", async () => {
    state = { ...ON, linksActive: true };
    await send({ secureLinks: "1", body: "See https://example.com/info and the file below." });
    const html = decodeQP(gmail.sent[0].split(/Content-Type: text\/html/i)[1] || "");
    assert.match(html, /\/api\/l\//, "ordinary links are tracked");
    assert.match(html, /<a href="https:\/\/uat\.example\.com\/api\/d\/[A-Za-z0-9_-]{32}">/);
    const tracked = await EmailLink.find().lean();
    assert.deepEqual(tracked.map((l) => l.url), ["https://example.com/info"]);
  });

  test("the dashboard still lists the files and allows download for admins", async () => {
    const { body } = await send({ secureLinks: "1" });
    const page = await (await fetch(`${base}/messages/${body.message.id}`, { headers: { "x-test-admin": String(priya._id) } })).json();
    assert.equal(page.message.attachments.length, 1);
    assert.equal(page.message.attachments[0].filename, "report.pdf");
    assert.equal(page.message.tracking.secureLinks, true);
    assert.equal(page.message.tracking.files.length, 1);
    assert.deepEqual([page.message.tracking.files[0].count, page.message.tracking.files[0].expired], [0, false]);
  });

  test("/mailboxes tells the form whether to offer the box, and for how long", async () => {
    const r = await (await fetch(`${base}/mailboxes`, { headers: { "x-test-admin": String(priya._id) } })).json();
    assert.deepEqual([r.tracking.secureLinks, r.tracking.secureLinkDays], [true, 7]);
    state = { ...ON, secureLinksActive: false };
    const off = await (await fetch(`${base}/mailboxes`, { headers: { "x-test-admin": String(priya._id) } })).json();
    assert.equal(off.tracking.secureLinks, false);
  });

  // ── downloading ──
  async function sendAndGetToken(over = {}) {
    const { body } = await send({ secureLinks: "1", ...over });
    // The mail was "sent" just now; push it into the past so the grace window has passed.
    await EmailMessage.updateOne({ _id: body.message.id }, { messageDate: SENT });
    return { id: body.message.id, token: tokensIn(gmail.sent.at(-1))[0] };
  }

  test("the link downloads the file as an attachment, never as a page", async () => {
    const { token } = await sendAndGetToken();
    const res = await fetch(`${dlBase}/${token}`, { headers: { "user-agent": CHROME } });
    assert.equal(res.status, 200);
    assert.deepEqual(Buffer.from(await res.arrayBuffer()), PDF);
    assert.match(res.headers.get("content-disposition"), /^attachment; filename="report\.pdf"/);
    assert.equal(res.headers.get("content-type"), "application/pdf");
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.match(res.headers.get("content-security-policy"), /sandbox/);
    assert.match(res.headers.get("cache-control"), /no-store/);
    assert.equal(res.headers.get("referrer-policy"), "no-referrer");
  });

  test("a stored file type that a browser would run is served as plain download bytes", async () => {
    const { token, id } = await sendAndGetToken();
    await EmailAttachment.updateOne({ message: id }, { mimeType: "text/html", filename: "x.html" });
    const res = await fetch(`${dlBase}/${token}`);
    assert.equal(res.headers.get("content-type"), "application/octet-stream");
    assert.match(res.headers.get("content-disposition"), /^attachment/);
  });

  test("an expired link gets the plain 'expired' page, and the file is not served", async () => {
    const { token, id } = await sendAndGetToken();
    await EmailDownloadLink.updateMany({ message: id }, { expiresAt: new Date(Date.now() - 1000) });
    const res = await fetch(`${dlBase}/${token}`, { headers: { "user-agent": CHROME } });
    const html = await res.text();
    assert.equal(res.status, 410);
    assert.match(res.headers.get("content-type"), /text\/html/);
    assert.match(html, /This link has expired/);
    assert.ok(!html.includes("%PDF"));
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(await EmailDownloadEvent.countDocuments(), 0, "nothing recorded");
  });

  test("it stops at the second the link expires, not later", async () => {
    const { token, id } = await sendAndGetToken();
    const link = await EmailDownloadLink.findOne({ message: id });
    now = () => new Date(link.expiresAt.getTime() - 1000);
    assert.equal((await fetch(`${dlBase}/${token}`)).status, 200);
    now = () => new Date(link.expiresAt.getTime());
    assert.equal((await fetch(`${dlBase}/${token}`)).status, 410);
  });

  test("unknown and malformed links get the same page, never a file or a redirect", async () => {
    for (const t of [newToken().token, "short", "x".repeat(32), "..%2F..%2Fetc%2Fpasswd"]) {
      const res = await fetch(`${dlBase}/${t}`, { redirect: "manual" });
      assert.equal(res.status, 404, t);
      assert.match(await res.text(), /This link has expired/);
    }
  });

  test("a link whose mail failed to send serves nothing", async () => {
    const { token, id } = await sendAndGetToken();
    await EmailMessage.updateOne({ _id: id }, { status: "failed" });
    assert.equal((await fetch(`${dlBase}/${token}`)).status, 404);
  });

  test("a storage failure is a 503, not a crash and not an 'expired' page", async () => {
    const { token } = await sendAndGetToken();
    storeFails = true;
    const res = await fetch(`${dlBase}/${token}`);
    assert.equal(res.status, 503);
    assert.ok(!(await res.text()).includes("expired"));
  });

  test("HEAD returns the headers without the file and is never recorded", async () => {
    const { token, id } = await sendAndGetToken();
    const res = await fetch(`${dlBase}/${token}`, { method: "HEAD", headers: { "user-agent": CHROME } });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-disposition"), /^attachment/);
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(await EmailDownloadEvent.countDocuments({ message: id }), 0);
  });

  // ── recording ──
  test("a real download is counted: count, first/last time, read status 'Downloaded'", async () => {
    const { token, id } = await sendAndGetToken();
    await fetch(`${dlBase}/${token}`, { headers: { "user-agent": CHROME } });
    assert.ok(await wait(async () => (await EmailMessage.findById(id)).tracking.downloadCount === 1));
    const row = await EmailMessage.findById(id).lean();
    assert.ok(row.tracking.firstDownloadedAt && row.tracking.lastDownloadedAt);
    assert.equal(computeReadStatus(row).status, "downloaded");
    const ev = await EmailDownloadEvent.findOne({ message: id }).lean();
    assert.deepEqual([ev.counted, ev.uaFamily], [true, "Chrome"]);
    assert.ok(!JSON.stringify(ev).includes("127.0.0.1"), "no IP stored");
    assert.ok(!JSON.stringify(ev).includes("Mozilla"), "no raw user agent stored");
  });

  test("a mail scanner is served the file but not counted", async () => {
    const { token, id } = await sendAndGetToken();
    for (const ua of ["Mozilla/5.0 SafeLinks", "Mimecast", "Proofpoint URL Defense", "curl/8", ""]) {
      const res = await fetch(`${dlBase}/${token}`, { headers: { "user-agent": ua } });
      assert.equal(res.status, 200, ua);
    }
    assert.ok(await wait(async () => (await EmailDownloadEvent.countDocuments({ message: id })) === 5));
    const row = await EmailMessage.findById(id).lean();
    assert.equal(row.tracking.downloadCount || 0, 0);
    assert.equal(await EmailDownloadEvent.countDocuments({ message: id, counted: true }), 0);
  });

  test("a fetch inside the grace window right after sending is a scanner", async () => {
    const { token, id } = await sendAndGetToken();
    await EmailMessage.updateOne({ _id: id }, { messageDate: new Date() });
    await fetch(`${dlBase}/${token}`, { headers: { "user-agent": CHROME } });
    assert.ok(await wait(async () => (await EmailDownloadEvent.countDocuments({ message: id })) === 1));
    assert.equal((await EmailDownloadEvent.findOne({ message: id })).ignoreReason, "grace_window");
  });

  test("a retry within 10 seconds counts once", async () => {
    const { token, id } = await sendAndGetToken();
    await fetch(`${dlBase}/${token}`, { headers: { "user-agent": CHROME } });
    assert.ok(await wait(async () => (await EmailDownloadEvent.countDocuments({ message: id })) === 1));
    await fetch(`${dlBase}/${token}`, { headers: { "user-agent": CHROME } });
    assert.ok(await wait(async () => (await EmailDownloadEvent.countDocuments({ message: id })) === 2));
    assert.equal((await EmailMessage.findById(id)).tracking.downloadCount, 1);
  });

  test("each file is counted on its own link", async () => {
    const { body } = await send({ secureLinks: "1", files: [["a.pdf", PDF], ["b.pdf", PDF]] });
    await EmailMessage.updateOne({ _id: body.message.id }, { messageDate: SENT });
    const [ta, tb] = tokensIn(gmail.sent.at(-1));
    await fetch(`${dlBase}/${tb}`, { headers: { "user-agent": CHROME } });
    assert.ok(await wait(async () => (await EmailDownloadEvent.countDocuments({ message: body.message.id })) === 1));
    const page = await (await fetch(`${base}/messages/${body.message.id}`, { headers: { "x-test-admin": String(priya._id) } })).json();
    const files = page.message.tracking.files;
    assert.deepEqual(files.map((f) => [f.filename, f.count]), [["a.pdf", 0], ["b.pdf", 1]]);
    assert.ok(ta && tb && ta !== tb);
  });

  test("a recipient who opted out after sending still gets the file; the download is not recorded", async () => {
    const { token, id } = await sendAndGetToken();
    await EmailTrackingOptOut.create({ address: "Anita@gmail.com" });
    const res = await fetch(`${dlBase}/${token}`, { headers: { "user-agent": CHROME } });
    assert.equal(res.status, 200);
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(await EmailDownloadEvent.countDocuments({ message: id }), 0);
    assert.equal((await EmailMessage.findById(id)).tracking.downloadCount || 0, 0);
  });

  test("tracking switched off: the file is still served, nothing is recorded", async () => {
    const { token, id } = await sendAndGetToken();
    const r = await recordDownload({ token, ip: "8.8.8.8", userAgent: CHROME }, { state: { active: false }, env: {}, now: new Date() });
    assert.deepEqual(r, { recorded: false, why: "tracking_off" });
    assert.equal(await EmailDownloadEvent.countDocuments({ message: id }), 0);
    assert.equal((await fetch(`${dlBase}/${token}`)).status, 200);
  });

  test("a download counts even if the mail was never opened by pixel, and outranks Opened and Clicked", async () => {
    const { token, id } = await sendAndGetToken();
    await EmailMessage.updateOne({ _id: id }, { "tracking.status": "opened", "tracking.openCount": 1, "tracking.clickCount": 2 });
    await fetch(`${dlBase}/${token}`, { headers: { "user-agent": CHROME } });
    assert.ok(await wait(async () => (await EmailMessage.findById(id)).tracking.downloadCount === 1));
    assert.equal(computeReadStatus(await EmailMessage.findById(id).lean()).status, "downloaded");
  });
});

describe("secure link settings", () => {
  let mongod, server, base, root;
  const fakeAuth = (req, res, next) => { req.user = { id: String(root._id), role: "superadmin" }; next(); };
  const call = async (method, path, body) => {
    const res = await fetch(base + path, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };
  const getState = (env) => (opts) => getTrackingState({ ...opts, env });
  let env;

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([EmailSettings.init(), User.init()]);
    root = await User.create({ name: "Root", email: "r@x.co", role: "superadmin" });
  });
  after(async () => {
    if (server) await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await EmailSettings.deleteMany({});
    clearSettingsCache();
    env = { EMAIL_TRACKING_ENABLED: "true", PUBLIC_TRACKING_BASE_URL: BASE, EMAIL_SECURE_LINKS_ENABLED: "true", EMAIL_SECURE_LINK_DAYS_MAX: "14" };
    const app = express();
    app.use(express.json());
    app.use("/settings", superadminSettings.create({ guard: [fakeAuth], getState: (o) => getState(env)(o) }));
    if (server) await new Promise((r) => server.close(r));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}/settings`;
  });

  test("defaults: switched off, 7 days", async () => {
    const { body } = await call("GET", "/");
    assert.deepEqual(
      [body.tracking.secureLinksEnabled, body.tracking.secureLinkDays, body.tracking.secureLinkDaysEffective, body.tracking.secureLinkDaysMax, body.tracking.secureLinksActive],
      [false, 7, 7, 14, false]
    );
  });

  test("three gates: open tracking, the server switch and the Super Admin switch", async () => {
    await call("PATCH", "/", { trackingEnabled: true, disclosureText: "We may track." });
    let r = await call("PATCH", "/", { secureLinksEnabled: true });
    assert.equal(r.body.tracking.secureLinksActive, true);
    env = { ...env, EMAIL_SECURE_LINKS_ENABLED: "false" };
    clearSettingsCache();
    assert.equal((await call("GET", "/")).body.tracking.secureLinksActive, false, "server gate");
    env = { ...env, EMAIL_SECURE_LINKS_ENABLED: "true" };
    clearSettingsCache();
    r = await call("PATCH", "/", { trackingEnabled: false });
    assert.equal(r.body.tracking.secureLinksActive, false, "open tracking off");
    r = await call("PATCH", "/", { trackingEnabled: true, secureLinksEnabled: false });
    assert.equal(r.body.tracking.secureLinksActive, false, "switch off");
  });

  test("the number of days: whole days from 1 up to the server cap", async () => {
    assert.equal((await call("PATCH", "/", { secureLinkDays: 10 })).body.tracking.secureLinkDays, 10);
    assert.equal((await call("PATCH", "/", { secureLinkDays: 14 })).status, 200);
    for (const bad of [0, -1, 15, 7.5, "7", null, 365]) {
      assert.equal((await call("PATCH", "/", { secureLinkDays: bad })).status, 400, String(bad));
    }
  });

  test("a stored value above a lowered server cap is capped when used", async () => {
    await call("PATCH", "/", { secureLinkDays: 14 });
    env = { ...env, EMAIL_SECURE_LINK_DAYS_MAX: "5" };
    clearSettingsCache();
    const { body } = await call("GET", "/");
    assert.deepEqual([body.tracking.secureLinkDays, body.tracking.secureLinkDaysEffective, body.tracking.secureLinkDaysMax], [14, 5, 5]);
    assert.equal((await getTrackingState({ env, full: true })).secureLinkDays, 5);
  });

  test("validation: switch must be a boolean", async () => {
    assert.equal((await call("PATCH", "/", { secureLinksEnabled: "yes" })).status, 400);
  });
});

describe("downloadUrl", () => {
  test("carries only the token", () => {
    const { token } = newToken();
    assert.equal(downloadUrl(BASE, token), `${BASE}/api/d/${token}`);
  });
});
