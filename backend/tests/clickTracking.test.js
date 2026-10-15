const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Mailbox = require("../models/Mailbox");
const EmailMessage = require("../models/EmailMessage");
const EmailAttachment = require("../models/EmailAttachment");
const EmailLink = require("../models/EmailLink");
const EmailClickEvent = require("../models/EmailClickEvent");
const EmailOpenEvent = require("../models/EmailOpenEvent");
const EmailTrackingOptOut = require("../models/EmailTrackingOptOut");
const EmailSettings = require("../models/EmailSettings");
const User = require("../models/User");
const adminEmail = require("../routes/adminEmail");
const publicLinks = require("../routes/publicLinks");
const { buildHtml, textToHtml } = require("../services/email/emailHtml");
const { buildRawMessage } = require("../services/gmail/mimeBuilder");
const { recordClick, classifyClick } = require("../services/email/clickRecorder");
const { recordOpen } = require("../services/email/trackingRecorder");
const { newToken, hashToken, linkUrl } = require("../services/email/trackingToken");
const { trackingEnv, getTrackingState, clearSettingsCache } = require("../services/email/emailSettings");
const { planTracking } = require("../services/email/emailTracking");
const { debugLogState, logUnmatched } = require("../services/email/trackingDebug");
const { computeReadStatus } = require("../services/email/readStatus");

const BASE = "https://uat.example.com";
const SENT = new Date("2026-10-05T10:00:00Z");
const at = (s) => new Date(SENT.getTime() + s * 1000);
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const LINKS_ON = { active: true, linksActive: true, baseUrl: BASE, disclosureEnabled: true, disclosureText: "We may track." };
const mailbox = { _id: new mongoose.Types.ObjectId(), address: "support@humancareconnect.co", isActive: true, signature: "Human Care Connect", trackOpensDefault: true };

describe("rewriting links in the HTML part", () => {
  const tracker = (url) => `${BASE}/api/l/T${Buffer.from(url).toString("hex").slice(0, 8)}`;

  test("without a tracker nothing changes", () => {
    assert.match(textToHtml("see https://example.com/a?b=1&c=2 now"), /<a href="https:\/\/example.com\/a\?b=1&amp;c=2">/);
  });

  test("http and https links get the tracked href; the visible text stays the original address", () => {
    const html = textToHtml("a https://example.com/x and http://example.org/y.", { linkTracker: tracker });
    assert.match(html, /<a href="https:\/\/uat\.example\.com\/api\/l\/T[0-9a-f]{8}">https:\/\/example\.com\/x<\/a>/);
    assert.match(html, /<a href="https:\/\/uat\.example\.com\/api\/l\/T[0-9a-f]{8}">http:\/\/example\.org\/y<\/a>\./, "trailing punctuation stays outside");
    assert.ok(!/href="https?:\/\/example\./.test(html));
  });

  test("the tracker receives the original address, unescaped", () => {
    const seen = [];
    textToHtml("go https://example.com/a?b=1&c=2", { linkTracker: (u) => (seen.push(u), null) });
    assert.deepEqual(seen, ["https://example.com/a?b=1&c=2"]);
  });

  test("a link the tracker declines (null) is left as written", () => {
    const html = textToHtml("https://example.com/x", { linkTracker: () => null });
    assert.match(html, /<a href="https:\/\/example.com\/x">/);
  });

  test("only http(s) is ever offered to the tracker: mailto, javascript, data and ftp are not links at all", () => {
    const seen = [];
    const html = textToHtml("mailto:a@b.co javascript:alert(1) data:text/html,x ftp://x.example.com/f", { linkTracker: (u) => (seen.push(u), "x") });
    assert.deepEqual(seen, []);
    assert.ok(!/<a /.test(html));
  });

  test("over-long addresses are not tracked", () => {
    const seen = [];
    textToHtml(`https://example.com/${"a".repeat(2100)}`, { linkTracker: (u) => (seen.push(u), "x") });
    assert.deepEqual(seen, []);
  });

  test("buildHtml passes the tracker through and still ends with the image", () => {
    const html = buildHtml("hi https://example.com/z", { imageUrl: `${BASE}/api/e/${"a".repeat(32)}.gif`, linkTracker: tracker });
    assert.match(html, /\/api\/l\//);
    assert.match(html, /<img src="https:\/\/uat\.example\.com\/api\/e\//);
  });
});

describe("the sent MIME", () => {
  const tracker = (u) => `${BASE}/api/l/${"b".repeat(32)}?u=${encodeURIComponent(u)}`.split("?")[0];

  test("HTML links are tracked, the plain-text part keeps the original links", async () => {
    const { raw } = await buildRawMessage({
      mailbox, to: [{ address: "a@gmail.com" }], subject: "Hi", body: "Please open https://example.com/form today",
      tracking: { imageUrl: `${BASE}/api/e/${"a".repeat(32)}.gif`, linkTracker: tracker },
    });
    const s = raw.toString();
    const text = s.split(/Content-Type: text\/html/i)[0];
    assert.match(text, /https:\/\/example\.com\/form/);
    assert.ok(!/api\/l\//.test(text), "text part untouched");
    assert.match(s, /api\/l\/b{32}/);
  });
});

describe("sending, recording and redirecting", () => {
  let mongod, server, base, gmail, state, support, priya, linkServer, linkBase;
  const store = { async put() {}, async get() { return Buffer.from("x"); }, async remove() {} };
  const fakeAuth = (req, res, next) => { req.user = { id: req.headers["x-test-admin"], role: "admin" }; next(); };

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([Mailbox.init(), EmailMessage.init(), EmailAttachment.init(), EmailLink.init(), EmailClickEvent.init(), User.init(), EmailTrackingOptOut.init(), EmailOpenEvent.init()]);
    const app = express();
    app.use(express.json());
    app.use("/api/admin/email", (req, res, next) => adminEmail.create({ guard: [fakeAuth], getGmail: () => gmail, store, trackingState: async () => state })(req, res, next));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}/api/admin/email`;

    const linksApp = express();
    linksApp.use("/api/l", publicLinks.create({ limitPerMinute: 1000 }));
    linkServer = http.createServer(linksApp);
    await new Promise((r) => linkServer.listen(0, "127.0.0.1", r));
    linkBase = `http://127.0.0.1:${linkServer.address().port}/api/l`;
  });
  after(async () => {
    await new Promise((r) => server.close(r));
    await new Promise((r) => linkServer.close(r));
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await Promise.all([Mailbox.deleteMany({}), EmailMessage.deleteMany({}), User.deleteMany({}), EmailTrackingOptOut.deleteMany({}), EmailLink.deleteMany({}), EmailClickEvent.deleteMany({}), EmailOpenEvent.deleteMany({})]);
    support = await Mailbox.create({ address: "support@humancareconnect.co", displayName: "Support" });
    priya = await User.create({ name: "Priya", email: "p@x.co", role: "admin" });
    state = { ...LINKS_ON };
    gmail = { sent: [], async sendRaw(raw) { this.sent.push(raw.toString()); return { id: `g${this.sent.length}`, threadId: `t${this.sent.length}` }; } };
  });

  const send = async (fields = {}) => {
    const fd = new FormData();
    const all = { from: String(support._id), to: "anita@gmail.com", subject: "Hello", body: "Form: https://example.com/form and https://example.org/info", ...fields };
    for (const [k, v] of Object.entries(all)) if (v !== undefined) fd.set(k, v);
    const res = await fetch(`${base}/send`, { method: "POST", headers: { "x-test-admin": String(priya._id) }, body: fd });
    return { status: res.status, body: await res.json() };
  };
  const env = { EMAIL_TRACKING_ENABLED: "true", EMAIL_TRACKING_LINKS_ENABLED: "true", PUBLIC_TRACKING_BASE_URL: BASE, EMAIL_TRACKING_GRACE_SECONDS: "60", EMAIL_TRACKING_IGNORE_IPS: "203.0.113.0/24" };
  const click = (token, extra = {}, now = at(300)) => recordClick({ token, ip: "8.8.8.8", userAgent: CHROME, ...extra }, { state: LINKS_ON, env, now });

  // A sent mail with two tracked links, made by hand so timing is exact.
  async function mailWithLinks(over = {}) {
    const msg = new EmailMessage({
      mailbox: support._id, direction: "out", status: "sent", gmailMessageId: `g${Math.random()}`,
      from: { address: support.address }, to: [{ address: "anita@gmail.com" }], subject: "s", messageDate: SENT,
      tracking: { enabled: true, tokenHash: newToken().hash, status: "pending" }, ...over,
    });
    msg.setContent({ text: "x", html: "", snippet: "x" });
    await msg.save();
    const tokens = [];
    for (const [i, url] of ["https://example.com/a", "https://example.org/b", "https://example.net/c", "https://example.io/d"].entries()) {
      const { token, hash } = newToken();
      await EmailLink.create({ message: msg._id, index: i, url, tokenHash: hash });
      tokens.push(token);
    }
    return { id: msg._id, tokens };
  }
  const row = (id) => EmailMessage.findById(id).lean();

  test("a tracked mail: HTML links go through /api/l, only token hashes are stored, text part is untouched", async () => {
    const { status, body } = await send();
    assert.equal(status, 201);
    const links = await EmailLink.find({ message: body.message.id }).sort({ index: 1 }).lean();
    assert.deepEqual(links.map((l) => l.url), ["https://example.com/form", "https://example.org/info"]);
    assert.ok(links.every((l) => /^[0-9a-f]{64}$/.test(l.tokenHash)));
    // quoted-printable: undo soft line breaks and =XX escapes before reading it
    const mime = gmail.sent[0].replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    const tokens = [...mime.matchAll(/\/api\/l\/([A-Za-z0-9_-]{32})/g)].map((m) => m[1]);
    assert.equal(new Set(tokens).size, 2);
    assert.deepEqual(tokens.map(hashToken).sort(), links.map((l) => l.tokenHash).sort());
    const text = mime.split(/Content-Type: text\/html/i)[0];
    assert.match(text, /https:\/\/example\.com\/form/);
    assert.ok(!/api\/l\//.test(text));
  });

  test("the same address twice in one mail is one link", async () => {
    await send({ body: "https://example.com/x and again https://example.com/x" });
    assert.equal(await EmailLink.countDocuments(), 1);
  });

  test("link tracking off (its own switch): the mail is tracked for opens but no link is rewritten", async () => {
    state = { ...LINKS_ON, linksActive: false };
    const { body } = await send();
    assert.equal(await EmailLink.countDocuments(), 0);
    assert.equal((await row(body.message.id)).tracking.enabled, true);
    assert.ok(!/api\/l\//.test(gmail.sent[0]));
  });

  test("a mail with 'Track opens' unticked has no tracked links either", async () => {
    await send({ trackOpens: "0" });
    assert.equal(await EmailLink.countDocuments(), 0);
    assert.ok(!/api\/l\//.test(gmail.sent[0]));
  });

  test("a mail to an opted-out recipient has no tracked links", async () => {
    await EmailTrackingOptOut.create({ address: "optout@gmail.com" });
    await send({ to: "optout@gmail.com" });
    assert.equal(await EmailLink.countDocuments(), 0);
  });

  test("planTracking carries the link switch and base URL", async () => {
    const p = await planTracking({ mailbox, to: [{ address: "a@gmail.com" }], cc: [], state: LINKS_ON });
    assert.deepEqual([p.links, p.baseUrl], [true, BASE]);
    assert.equal((await planTracking({ mailbox, to: [{ address: "a@gmail.com" }], cc: [], state: { ...LINKS_ON, linksActive: false } })).links, false);
  });

  test("gates: link tracking needs open tracking, its own env gate and its own switch", async () => {
    await EmailSettings.deleteMany({});
    clearSettingsCache();
    const e = { EMAIL_TRACKING_ENABLED: "true", PUBLIC_TRACKING_BASE_URL: BASE };
    await EmailSettings.create({ key: "email", trackingEnabled: true, trackClicks: true });
    assert.equal((await getTrackingState({ env: e })).linksActive, false, "env gate missing");
    clearSettingsCache();
    assert.equal((await getTrackingState({ env: { ...e, EMAIL_TRACKING_LINKS_ENABLED: "true" } })).linksActive, true);
    await EmailSettings.updateOne({ key: "email" }, { trackClicks: false });
    clearSettingsCache();
    assert.equal((await getTrackingState({ env: { ...e, EMAIL_TRACKING_LINKS_ENABLED: "true" } })).linksActive, false, "switch off");
    await EmailSettings.updateOne({ key: "email" }, { trackClicks: true, trackingEnabled: false });
    clearSettingsCache();
    assert.equal((await getTrackingState({ env: { ...e, EMAIL_TRACKING_LINKS_ENABLED: "true" } })).linksActive, false, "open tracking off");
    assert.equal(trackingEnv({}).clickBurstLinks, 3);
    assert.equal(trackingEnv({}).clickBurstSeconds, 5);
  });

  // ── the redirect ──
  test("GET redirects at once to the stored address, with no-store and no-referrer", async () => {
    const { tokens } = await mailWithLinks();
    const res = await fetch(`${linkBase}/${tokens[0]}`, { redirect: "manual" });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), "https://example.com/a");
    assert.match(res.headers.get("cache-control"), /no-store/);
    assert.equal(res.headers.get("referrer-policy"), "no-referrer");
  });

  test("unknown and malformed tokens are 404, never a redirect", async () => {
    for (const t of ["x".repeat(32), "short", "..%2F..%2Fetc", newToken().token]) {
      const res = await fetch(`${linkBase}/${t}`, { redirect: "manual" });
      assert.equal(res.status, 404, t);
      assert.equal(res.headers.get("location"), null);
    }
  });

  test("not an open redirect: a url parameter or any other value is ignored", async () => {
    const { tokens } = await mailWithLinks();
    const res = await fetch(`${linkBase}/${tokens[1]}?url=https://evil.example.com&next=//evil.example.com`, { redirect: "manual" });
    assert.equal(res.headers.get("location"), "https://example.org/b");
    assert.equal((await fetch(`${linkBase}/https://evil.example.com`, { redirect: "manual" })).status, 404);
  });

  test("a stored address that is not http(s) is never followed", async () => {
    const msg = (await mailWithLinks()).id;
    for (const [i, url] of ["javascript:alert(1)", "data:text/html,x", "//evil.example.com", "https://ok.example.com/ with space"].entries()) {
      const { token, hash } = newToken();
      await EmailLink.create({ message: msg, index: 10 + i, url, tokenHash: hash });
      assert.equal((await fetch(`${linkBase}/${token}`, { redirect: "manual" })).status, 404, url);
    }
  });

  test("the redirect works with every tracking switch off (a mail already sent must not break)", async () => {
    const { tokens } = await mailWithLinks();
    const res = await fetch(`${linkBase}/${tokens[0]}`, { redirect: "manual" });
    assert.equal(res.status, 302);
  });

  test("HEAD is redirected the same way and never recorded", async () => {
    const { id, tokens } = await mailWithLinks();
    const res = await fetch(`${linkBase}/${tokens[0]}`, { method: "HEAD", redirect: "manual" });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), "https://example.com/a");
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(await EmailClickEvent.countDocuments({ message: id }), 0);
  });

  // ── recording ──
  test("a real click: counted, which link, when, count; the mail reads 'Clicked'", async () => {
    const { id, tokens } = await mailWithLinks();
    assert.deepEqual(await click(tokens[1]), { recorded: true, counted: true, reason: "" });
    const t = (await row(id)).tracking;
    assert.deepEqual([t.clickCount, t.firstClickedAt, t.lastClickedAt], [1, at(300), at(300)]);
    assert.equal(computeReadStatus(await row(id)).status, "clicked");
    const ev = await EmailClickEvent.findOne({ message: id }).lean();
    assert.deepEqual([ev.counted, ev.uaFamily], [true, "Chrome"]);
    const link = await EmailLink.findOne({ message: id, index: 1 }).lean();
    assert.equal(String(ev.link), String(link._id));
    assert.ok(!JSON.stringify(ev).includes("8.8.8.8"), "no IP stored");
    assert.ok(!JSON.stringify(ev).includes("Mozilla"), "no raw user agent stored");
  });

  test("a second click on another link is counted; first stays, last moves", async () => {
    const { id, tokens } = await mailWithLinks();
    await click(tokens[0], {}, at(300));
    await click(tokens[1], {}, at(900));
    const t = (await row(id)).tracking;
    assert.deepEqual([t.clickCount, t.firstClickedAt, t.lastClickedAt], [2, at(300), at(900)]);
  });

  test("a double-click on the same link within 10 s counts once", async () => {
    const { id, tokens } = await mailWithLinks();
    await click(tokens[0], {}, at(300));
    assert.equal((await click(tokens[0], {}, at(305))).reason, "duplicate");
    assert.equal((await click(tokens[0], {}, at(320))).counted, true);
    assert.equal((await row(id)).tracking.clickCount, 2);
  });

  test("clicks inside the grace window are scanners, not people", async () => {
    const { id, tokens } = await mailWithLinks();
    assert.deepEqual(await click(tokens[0], {}, at(5)), { recorded: true, counted: false, reason: "grace_window" });
    assert.equal((await row(id)).tracking.clickCount, 0);
  });

  test("scanner user agents and listed scanner addresses are ignored", async () => {
    const { id, tokens } = await mailWithLinks();
    assert.equal((await click(tokens[0], { userAgent: "Mozilla/5.0 SafeLinks" })).reason, "scanner_microsoft");
    assert.equal((await click(tokens[1], { userAgent: "Proofpoint URL Defense" })).reason, "scanner_proofpoint");
    assert.equal((await click(tokens[2], { userAgent: "curl/8" })).reason, "scanner_ua");
    assert.equal((await click(tokens[3], { userAgent: "" })).reason, "no_user_agent");
    const withIps = { ...env, EMAIL_SCANNER_IPS: "barracuda=198.51.100.0/24" };
    const r = await recordClick({ token: tokens[0], ip: "198.51.100.7", userAgent: CHROME }, { state: LINKS_ON, env: withIps, now: at(400) });
    assert.equal(r.reason, "scanner_barracuda");
    assert.equal((await row(id)).tracking.clickCount, 0);
  });

  test("our own address is ignored", async () => {
    const { tokens } = await mailWithLinks();
    assert.equal((await click(tokens[0], { ip: "203.0.113.9" })).reason, "own_ip");
  });

  test("burst rule: 3 different links within 5 s are a scanner, including the clicks that looked fine", async () => {
    const { id, tokens } = await mailWithLinks();
    assert.equal((await click(tokens[0], {}, at(300))).counted, true);
    assert.equal((await click(tokens[1], {}, at(301))).counted, true);
    assert.equal((await row(id)).tracking.clickCount, 2);
    const third = await click(tokens[2], {}, at(302));
    assert.deepEqual([third.counted, third.reason], [false, "scanner_burst"]);
    const t = (await row(id)).tracking;
    assert.deepEqual([t.clickCount, t.firstClickedAt, t.lastClickedAt], [0, null, null]);
    assert.equal(await EmailClickEvent.countDocuments({ message: id, counted: true }), 0);
    assert.equal(computeReadStatus(await row(id)).status, "pending");
  });

  test("burst rule: the same pace spread over more than 5 s is a person", async () => {
    const { id, tokens } = await mailWithLinks();
    await click(tokens[0], {}, at(300));
    await click(tokens[1], {}, at(304));
    assert.equal((await click(tokens[2], {}, at(309))).counted, true);
    assert.equal((await row(id)).tracking.clickCount, 3);
  });

  test("an earlier burst keeps older, unrelated clicks", async () => {
    const { id, tokens } = await mailWithLinks();
    await click(tokens[3], {}, at(100 + 60));
    await click(tokens[0], {}, at(900));
    await click(tokens[1], {}, at(901));
    await click(tokens[2], {}, at(902));
    const t = (await row(id)).tracking;
    assert.deepEqual([t.clickCount, t.firstClickedAt], [1, at(160)]);
  });

  test("a recipient who opted out after the mail went out stops being recorded (click and open)", async () => {
    const { id, tokens } = await mailWithLinks();
    await EmailTrackingOptOut.create({ address: "Anita@gmail.com" });
    assert.deepEqual(await click(tokens[0]), { recorded: false, why: "opted_out" });
    assert.equal(await EmailClickEvent.countDocuments({ message: id }), 0);
    // the same list stops the open pixel
    const { token, hash } = newToken();
    await EmailMessage.updateOne({ _id: id }, { "tracking.tokenHash": hash });
    const r = await recordOpen({ token, ip: "8.8.8.8", userAgent: CHROME }, { state: { active: true }, env, now: at(300) });
    assert.deepEqual(r, { recorded: false, why: "opted_out" });
    // and the link itself still redirects
    const res = await fetch(`${linkBase}/${tokens[0]}`, { redirect: "manual" });
    assert.equal(res.status, 302);
  });

  test("links switched off: the redirect works, nothing is recorded", async () => {
    const { id, tokens } = await mailWithLinks();
    const r = await recordClick({ token: tokens[0], ip: "8.8.8.8", userAgent: CHROME }, { state: { ...LINKS_ON, linksActive: false }, env, now: at(300) });
    assert.deepEqual(r, { recorded: false, why: "links_off" });
    assert.equal(await EmailClickEvent.countDocuments({ message: id }), 0);
  });

  test("unknown and malformed tokens record nothing", async () => {
    assert.equal((await click("x".repeat(32))).why, "unknown_token");
    assert.equal((await click("bad")).why, "unknown_token");
  });

  test("a failed mail records nothing", async () => {
    const { id, tokens } = await mailWithLinks({ status: "failed" });
    assert.equal((await click(tokens[0])).why, "unknown_token");
    assert.equal(await EmailClickEvent.countDocuments({ message: id }), 0);
  });

  test("a click on a mail whose pixel was never seen still counts, and outranks Opened", async () => {
    const { id, tokens } = await mailWithLinks({ tracking: { enabled: true, tokenHash: newToken().hash, status: "opened", openCount: 1, lastOpenedAt: at(100) } });
    await click(tokens[0]);
    assert.equal(computeReadStatus(await row(id)).status, "clicked");
  });

  test("the mail page lists every tracked link with its click count", async () => {
    const { id, tokens } = await mailWithLinks({ sentByAdmin: priya._id, sentByName: "Priya", gmailThreadId: "t1" });
    await click(tokens[1], {}, at(300));
    await click(tokens[1], {}, at(500));
    const res = await fetch(`${base}/messages/${id}`, { headers: { "x-test-admin": String(priya._id) } });
    const page = await res.json();
    const links = page.message.tracking.links;
    assert.equal(links.length, 4);
    assert.deepEqual(links.map((l) => l.url).slice(0, 2), ["https://example.com/a", "https://example.org/b"]);
    assert.deepEqual([links[1].count, links[0].count], [2, 0]);
    assert.equal(page.message.tracking.readStatus, "clicked");
    assert.ok(!JSON.stringify(page).includes(tokens[1]));
    // lists do not carry links
    const list = await (await fetch(`${base}/messages?folder=sent`, { headers: { "x-test-admin": String(priya._id) } })).json();
    assert.equal("links" in list.items[0].tracking, false);
  });

  test("classifyClick: the rules in order", () => {
    const base = { sentAt: SENT, now: at(600), graceSeconds: 60, ip: "8.8.8.8", userAgent: CHROME };
    assert.equal(classifyClick(base).counted, true);
    assert.equal(classifyClick({ ...base, now: at(59) }).reason, "grace_window");
    assert.equal(classifyClick({ ...base, userAgent: "" }).reason, "no_user_agent");
    assert.equal(classifyClick({ ...base, ignoreIps: ["8.8.8.8"] }).reason, "own_ip");
  });
});

describe("UAT-only tuning log", () => {
  const FUTURE = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
  const verdictCounted = { counted: true, reason: "", automated: false };

  test("off unless the flag AND a future expiry are set", () => {
    assert.equal(debugLogState({}).on, false);
    assert.equal(debugLogState({ EMAIL_TRACKING_DEBUG_LOG: "true" }).reason, "no_expiry");
    assert.equal(debugLogState({ EMAIL_TRACKING_DEBUG_LOG: "true", EMAIL_TRACKING_DEBUG_UNTIL: "nonsense" }).on, false);
    assert.equal(debugLogState({ EMAIL_TRACKING_DEBUG_UNTIL: FUTURE }).on, false, "expiry alone does nothing");
    assert.equal(debugLogState({ EMAIL_TRACKING_DEBUG_LOG: "true", EMAIL_TRACKING_DEBUG_UNTIL: FUTURE }).on, true);
  });

  test("stops by itself at the expiry", () => {
    const env = { EMAIL_TRACKING_DEBUG_LOG: "true", EMAIL_TRACKING_DEBUG_UNTIL: "2026-10-10T00:00:00Z" };
    assert.equal(debugLogState(env, Date.parse("2026-10-09T23:59:00Z")).on, true);
    assert.deepEqual([debugLogState(env, Date.parse("2026-10-10T00:00:01Z")).on, debugLogState(env, Date.parse("2026-10-10T00:00:01Z")).reason], [false, "expired"]);
  });

  test("a far-away date is capped at 14 days", () => {
    const now = Date.parse("2026-10-01T00:00:00Z");
    const s = debugLogState({ EMAIL_TRACKING_DEBUG_LOG: "true", EMAIL_TRACKING_DEBUG_UNTIL: "2030-01-01T00:00:00Z" }, now);
    assert.equal(s.on, true);
    assert.equal(s.until.getTime(), now + 14 * 24 * 3600 * 1000);
  });

  test("refuses to run when NODE_ENV=production, whatever else is set", () => {
    const s = debugLogState({ NODE_ENV: "production", EMAIL_TRACKING_DEBUG_LOG: "true", EMAIL_TRACKING_DEBUG_UNTIL: FUTURE });
    assert.deepEqual([s.on, s.reason], [false, "production"]);
    assert.equal(debugLogState({ NODE_ENV: "Production", EMAIL_TRACKING_DEBUG_LOG: "true", EMAIL_TRACKING_DEBUG_UNTIL: FUTURE }).on, false);
  });

  test("logs only unmatched hits, one line each, with no token, message or address", () => {
    const env = { EMAIL_TRACKING_DEBUG_LOG: "true", EMAIL_TRACKING_DEBUG_UNTIL: FUTURE };
    const lines = [];
    const logger = (l) => lines.push(l);
    assert.equal(logUnmatched({ kind: "open", ip: "198.51.100.7", family: "Chrome", verdict: verdictCounted }, { env, logger }), true);
    assert.equal(logUnmatched({ kind: "click", ip: "198.51.100.8", family: "Scanner", verdict: { counted: false, reason: "scanner_ua" } }, { env, logger }), true);
    // matched by a list, Apple or own address: nothing to tune
    assert.equal(logUnmatched({ kind: "open", ip: "1.1.1.1", family: "Scanner", verdict: { counted: false, reason: "scanner_mimecast" } }, { env, logger }), false);
    assert.equal(logUnmatched({ kind: "open", ip: "17.1.1.1", family: "ApplePrivacyProxy", verdict: { counted: false, reason: "apple_proxy", apple: true } }, { env, logger }), false);
    assert.equal(logUnmatched({ kind: "open", ip: "2.2.2.2", family: "Chrome", verdict: { counted: false, reason: "own_ip" } }, { env, logger }), false);
    assert.deepEqual(lines, [
      "[email-tracking-debug] open ip=198.51.100.7 ua=Chrome verdict=counted",
      "[email-tracking-debug] click ip=198.51.100.8 ua=Scanner verdict=scanner_ua",
    ]);
  });

  test("writes nothing when off", () => {
    const lines = [];
    assert.equal(logUnmatched({ kind: "open", ip: "1.1.1.1", family: "Chrome", verdict: verdictCounted }, { env: {}, logger: (l) => lines.push(l) }), false);
    assert.deepEqual(lines, []);
  });

  test("log injection: control characters in an address cannot add lines", () => {
    const env = { EMAIL_TRACKING_DEBUG_LOG: "true", EMAIL_TRACKING_DEBUG_UNTIL: FUTURE };
    const lines = [];
    logUnmatched({ kind: "open", ip: "1.1.1.1\n[fake] line", family: "Chrome", verdict: verdictCounted }, { env, logger: (l) => lines.push(l) });
    assert.equal(lines.length, 1);
    assert.ok(!lines[0].includes("\n"));
  });
});
