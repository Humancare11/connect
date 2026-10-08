const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const EmailMessage = require("../models/EmailMessage");
const EmailOpenEvent = require("../models/EmailOpenEvent");
const EmailSettings = require("../models/EmailSettings");
const { classifyOpen, uaFamily, ipMatches } = require("../services/email/openClassifier");
const { recordOpen, MAX_EVENTS_PER_DAY } = require("../services/email/trackingRecorder");
const { newToken } = require("../services/email/trackingToken");
const publicTracking = require("../routes/publicTracking");

const SENT = new Date("2026-10-05T10:00:00Z");
const after_ = (seconds) => new Date(SENT.getTime() + seconds * 1000);
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const GOOGLE_PROXY = "Mozilla/5.0 (Windows NT 5.1; rv:11.0) Gecko Firefox/11.0 (via ggpht.com GoogleImageProxy)";
const ACTIVE = { active: true };

describe("openClassifier", () => {
  const base = { sentAt: SENT, graceSeconds: 60, ignoreIps: [] };

  test("a normal browser well after the grace window is a counted open", () => {
    assert.deepEqual(classifyOpen({ ...base, now: after_(300), ip: "8.8.8.8", userAgent: CHROME }), { counted: true, reason: "", automated: false });
  });
  test("hits inside the grace window are ignored as automated (prefetch)", () => {
    for (const s of [0, 1, 30, 59.9]) {
      assert.deepEqual(classifyOpen({ ...base, now: after_(s), ip: "8.8.8.8", userAgent: CHROME }), { counted: false, reason: "grace_window", automated: true }, `${s}s`);
    }
    assert.equal(classifyOpen({ ...base, now: after_(60), ip: "8.8.8.8", userAgent: CHROME }).counted, true, "exactly at the limit counts");
  });
  test("a grace of 0 disables the window", () => {
    assert.equal(classifyOpen({ ...base, graceSeconds: 0, now: after_(0), userAgent: CHROME }).counted, true);
  });
  test("Google's image proxy IS a real open (Gmail loads images when the person opens the mail)", () => {
    assert.equal(classifyOpen({ ...base, now: after_(600), userAgent: GOOGLE_PROXY }).counted, true);
  });
  test("Google's image proxy is NOT held back by the grace window (its delivery-time fetch can be the only hit)", () => {
    for (const s of [0, 1, 5, 30, 59.9]) {
      assert.deepEqual(classifyOpen({ ...base, now: after_(s), ip: "8.8.8.8", userAgent: GOOGLE_PROXY }), { counted: true, reason: "", automated: false }, `${s}s`);
    }
    // every other client still waits, so the exemption is not a blanket bypass
    assert.equal(classifyOpen({ ...base, now: after_(5), userAgent: CHROME }).reason, "grace_window");
    assert.equal(classifyOpen({ ...base, now: after_(5), userAgent: "curl/8" }).reason, "grace_window");
    // the other rules still apply to the proxy
    assert.equal(classifyOpen({ ...base, now: after_(5), ip: "203.0.113.5", userAgent: GOOGLE_PROXY, ignoreIps: ["203.0.113.5"] }).reason, "own_ip");
  });
  test("scanners, crawlers, scripts and empty user agents are ignored as automated", () => {
    for (const ua of ["Googlebot/2.1", "curl/8.4.0", "python-requests/2.31", "Go-http-client/2.0", "Mozilla/5.0 HeadlessChrome/120", "Proofpoint URL Defense", "Mimecast", "Java/17", "facebookexternalhit/1.1", ""]) {
      const v = classifyOpen({ ...base, now: after_(600), userAgent: ua });
      assert.equal(v.counted, false, ua);
      assert.equal(v.automated, true, ua);
    }
    assert.equal(classifyOpen({ ...base, now: after_(600), userAgent: "" }).reason, "no_user_agent");
    assert.equal(classifyOpen({ ...base, now: after_(600), userAgent: "curl/8" }).reason, "scanner_ua");
  });
  test("our own addresses are ignored (and are not 'automated')", () => {
    const v = classifyOpen({ ...base, now: after_(600), ip: "203.0.113.77", userAgent: CHROME, ignoreIps: ["203.0.113.0/24"] });
    assert.deepEqual(v, { counted: false, reason: "own_ip", automated: false });
    assert.equal(classifyOpen({ ...base, now: after_(0), ip: "203.0.113.77", userAgent: CHROME, ignoreIps: ["203.0.113.77"] }).reason, "own_ip", "checked before the grace window");
  });
  test("ipMatches: CIDR, exact, IPv4-mapped IPv6, garbage", () => {
    assert.ok(ipMatches("10.1.2.3", ["10.0.0.0/8"]));
    assert.ok(!ipMatches("11.1.2.3", ["10.0.0.0/8"]));
    assert.ok(ipMatches("::ffff:10.1.2.3", ["10.0.0.0/8"]));
    assert.ok(ipMatches("192.168.1.5", ["192.168.1.5"]));
    assert.ok(ipMatches("2001:db8::1", ["2001:DB8::1"]));
    assert.ok(ipMatches("1.2.3.4", ["0.0.0.0/0"]));
    assert.ok(!ipMatches("1.2.3.4", ["1.2.3.0/33", "bad/8", "1.2.3.4/x", "999.1.1.1/8"]));
    assert.ok(!ipMatches("", ["10.0.0.0/8"]));
    assert.ok(ipMatches("172.16.5.5", ["172.16.0.0/12"]));
    assert.ok(!ipMatches("172.32.0.1", ["172.16.0.0/12"]));
  });
  test("uaFamily keeps only a short family name", () => {
    assert.equal(uaFamily(GOOGLE_PROXY), "GoogleImageProxy");
    assert.equal(uaFamily(CHROME), "Chrome");
    assert.equal(uaFamily("curl/8"), "Scanner");
    assert.equal(uaFamily(""), "");
    assert.ok(uaFamily("x".repeat(500)).length <= 24);
  });
});

describe("recordOpen", () => {
  let mongod;
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([EmailMessage.init(), EmailOpenEvent.init(), EmailSettings.init()]);
  });
  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await Promise.all([EmailMessage.deleteMany({}), EmailOpenEvent.deleteMany({})]);
  });

  async function tracked(over = {}) {
    const { token, hash } = newToken();
    const doc = new EmailMessage({
      mailbox: new mongoose.Types.ObjectId(), direction: "out", status: "sent", gmailMessageId: `g${Math.random()}`,
      from: { address: "support@humancareconnect.co" }, to: [{ address: "a@gmail.com" }], subject: "s", messageDate: SENT,
      tracking: { enabled: true, tokenHash: hash, status: "pending" }, ...over,
    });
    doc.setContent({ text: "x", html: "", snippet: "x" });
    await doc.save();
    return { token, id: doc._id };
  }
  const env = { EMAIL_TRACKING_ENABLED: "true", PUBLIC_TRACKING_BASE_URL: "https://api.example.com", EMAIL_TRACKING_GRACE_SECONDS: "60", EMAIL_TRACKING_DEDUPE_MINUTES: "10", EMAIL_TRACKING_IGNORE_IPS: "203.0.113.0/24" };
  const rec = (token, extra = {}, opts = {}) => recordOpen({ token, ip: "8.8.8.8", userAgent: CHROME, ...extra }, { state: ACTIVE, env, now: after_(300), ...opts });
  const row = (id) => EmailMessage.findById(id).lean();

  test("a real open: status opened, count 1, first/last time, one counted event", async () => {
    const { token, id } = await tracked();
    assert.deepEqual(await rec(token), { recorded: true, counted: true, reason: "" });
    const t = (await row(id)).tracking;
    assert.equal(t.status, "opened");
    assert.equal(t.openCount, 1);
    assert.deepEqual([t.firstOpenedAt, t.lastOpenedAt], [after_(300), after_(300)]);
    const events = await EmailOpenEvent.find({ message: id }).lean();
    assert.equal(events.length, 1);
    assert.equal(events[0].counted, true);
    assert.equal(events[0].uaFamily, "Chrome");
    assert.ok(!JSON.stringify(events[0]).includes("8.8.8.8"), "no IP address stored");
    assert.ok(!JSON.stringify(events[0]).includes("Mozilla"), "no raw user agent stored");
  });

  test("a repeat within 10 minutes is stored as 'duplicate' and not counted; later opens are counted", async () => {
    const { token, id } = await tracked();
    await rec(token);
    assert.deepEqual(await rec(token, {}, { now: after_(300 + 120) }), { recorded: true, counted: false, reason: "duplicate" });
    assert.equal((await row(id)).tracking.openCount, 1);
    assert.deepEqual(await rec(token, {}, { now: after_(300 + 11 * 60) }), { recorded: true, counted: true, reason: "" });
    const t = (await row(id)).tracking;
    assert.equal(t.openCount, 2);
    assert.deepEqual([t.firstOpenedAt, t.lastOpenedAt], [after_(300), after_(300 + 660)]);
  });

  test("simultaneous hits count once (atomic)", async () => {
    const { token, id } = await tracked();
    const results = await Promise.all(Array.from({ length: 8 }, () => rec(token)));
    assert.equal(results.filter((r) => r.counted).length, 1);
    assert.equal((await row(id)).tracking.openCount, 1);
    assert.equal(await EmailOpenEvent.countDocuments({ message: id }), 8);
  });

  test("prefetch inside the grace window: not counted, status becomes 'unavailable' (automated_only)", async () => {
    const { token, id } = await tracked();
    assert.deepEqual(await rec(token, {}, { now: after_(5) }), { recorded: true, counted: false, reason: "grace_window" });
    const t = (await row(id)).tracking;
    assert.deepEqual([t.status, t.unavailableReason, t.openCount, t.firstOpenedAt], ["unavailable", "automated_only", 0, null]);
  });

  test("a Gmail-proxy hit inside the grace window is recorded as a (likely) open, not dropped", async () => {
    const { token, id } = await tracked();
    assert.deepEqual(await rec(token, { userAgent: GOOGLE_PROXY }, { now: after_(5) }), { recorded: true, counted: true, reason: "" });
    const t = (await row(id)).tracking;
    assert.deepEqual([t.status, t.unavailableReason, t.openCount], ["opened", "", 1]);
    assert.deepEqual([t.firstOpenedAt, t.lastOpenedAt], [after_(5), after_(5)]);
    const ev = await EmailOpenEvent.findOne({ message: id }).lean();
    assert.deepEqual([ev.counted, ev.ignoreReason, ev.uaFamily], [true, "", "GoogleImageProxy"]);
    assert.equal("ip" in ev || "userAgent" in ev, false, "no raw IP or user agent is stored");
  });

  test("a real open after an automated hit flips it to opened; a later automated hit never downgrades", async () => {
    const { token, id } = await tracked();
    await rec(token, { userAgent: "curl/8" });
    assert.equal((await row(id)).tracking.status, "unavailable");
    await rec(token);
    const opened = (await row(id)).tracking;
    assert.equal(opened.status, "opened");
    assert.equal(opened.unavailableReason, "");
    await rec(token, { userAgent: "Googlebot" }, { now: after_(5000) });
    assert.equal((await row(id)).tracking.status, "opened");
  });

  test("our own IP never changes anything but the event log", async () => {
    const { token, id } = await tracked();
    assert.equal((await rec(token, { ip: "203.0.113.9" })).reason, "own_ip");
    const t = (await row(id)).tracking;
    assert.deepEqual([t.status, t.openCount], ["pending", 0]);
    assert.equal(await EmailOpenEvent.countDocuments({ message: id, counted: false, ignoreReason: "own_ip" }), 1);
  });

  test("an unknown or malformed token records nothing", async () => {
    await tracked();
    const unknown = newToken().token;
    assert.deepEqual(await rec(unknown), { recorded: false, why: "unknown_token" });
    for (const bad of ["", "short", "x".repeat(40), undefined, null]) assert.deepEqual(await rec(bad), { recorded: false, why: "bad_token" });
    assert.equal(await EmailOpenEvent.countDocuments(), 0);
  });

  test("switched off (global switch / env gate) → nothing is recorded", async () => {
    const { token, id } = await tracked();
    assert.deepEqual(await rec(token, {}, { state: { active: false } }), { recorded: false, why: "tracking_off" });
    assert.equal((await row(id)).tracking.openCount, 0);
    assert.equal(await EmailOpenEvent.countDocuments(), 0);
  });

  test("a failed mail and inbound mail never record", async () => {
    const failed = await tracked({ status: "failed" });
    assert.equal((await rec(failed.token)).why, "unknown_token");
    const { token, hash } = newToken();
    const inbound = new EmailMessage({ mailbox: new mongoose.Types.ObjectId(), direction: "in", status: "received", gmailMessageId: "gi", from: { address: "x@y.co" }, subject: "s", messageDate: SENT, tracking: { tokenHash: hash } });
    inbound.setContent({ text: "x", html: "", snippet: "x" });
    await inbound.save();
    assert.equal((await rec(token)).why, "unknown_token");
  });

  test("a flood on one token stops being stored", async () => {
    const { token, id } = await tracked();
    await EmailOpenEvent.insertMany(Array.from({ length: MAX_EVENTS_PER_DAY }, () => ({ message: id, at: after_(299), counted: false, ignoreReason: "duplicate" })));
    assert.deepEqual(await rec(token), { recorded: false, why: "flood" });
    assert.equal(await EmailOpenEvent.countDocuments({ message: id }), MAX_EVENTS_PER_DAY);
  });

  test("events expire by TTL (180 days by default); the summary stays on the mail", async () => {
    const idx = (await EmailOpenEvent.collection.indexes()).find((i) => i.key.at === 1);
    assert.equal(idx.expireAfterSeconds, 180 * 24 * 3600);
  });
});

describe("public tracking endpoint", () => {
  const PIXEL = publicTracking.PIXEL;
  let server, base, records, delay;

  function startServer(opts = {}) {
    const app = express();
    app.use("/api/e", publicTracking.create({
      record: async (hit) => { records.push(hit); if (delay) await delay; },
      limitPerMinute: 1000,
      ...opts,
    }));
    return new Promise((resolve) => {
      const s = http.createServer(app);
      s.listen(0, "127.0.0.1", () => resolve(s));
    });
  }
  before(async () => {
    records = [];
    server = await startServer();
    base = `http://127.0.0.1:${server.address().port}/api/e`;
  });
  const stop = (s) => new Promise((r) => { s.close(r); s.closeAllConnections(); });
  after(async () => { await stop(server); });
  beforeEach(() => { records.length = 0; delay = null; });
  const settle = () => new Promise((r) => setTimeout(r, 30));

  const fetchRaw = async (path, init) => {
    const res = await fetch(base + path, init);
    return { status: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer()) };
  };

  test("returns a 1x1 transparent GIF with no-cache, cross-origin and no cookies", async () => {
    const token = newToken().token;
    const r = await fetchRaw(`/${token}.gif`, { headers: { "user-agent": CHROME } });
    assert.equal(r.status, 200);
    assert.equal(r.headers["content-type"], "image/gif");
    assert.equal(r.body.length, PIXEL.length);
    assert.equal(r.body.subarray(0, 6).toString(), "GIF89a");
    assert.deepEqual(r.body, PIXEL);
    assert.match(r.headers["cache-control"], /no-store/);
    assert.equal(r.headers["cross-origin-resource-policy"], "cross-origin");
    assert.equal(r.headers["set-cookie"], undefined);
    assert.equal(r.headers["x-content-type-options"], "nosniff");
    assert.match(r.headers["x-robots-tag"], /noindex/);
  });

  test("valid, unknown, malformed and extension-less requests are indistinguishable", async () => {
    const paths = [`/${newToken().token}.gif`, `/${newToken().token}`, "/short.gif", "/x.gif", `/${"z".repeat(500)}.gif`, "/%00.gif", "/..%2f..%2fetc.gif"];
    const answers = [];
    for (const p of paths) {
      const r = await fetchRaw(p);
      delete r.headers.date;
      delete r.headers.etag;
      answers.push(JSON.stringify([r.status, r.headers, r.body.toString("base64")]));
    }
    assert.equal(new Set(answers).size, 1, "every response is byte-for-byte the same");
  });

  test("only well-formed tokens reach the recorder, with the caller's user agent and IP", async () => {
    const token = newToken().token;
    await fetchRaw(`/${token}.gif`, { headers: { "user-agent": "TestAgent/1" } });
    await fetchRaw("/garbage.gif");
    await settle();
    assert.equal(records.length, 2, "the recorder does its own token check and discards the garbage");
    assert.equal(records[0].token, token);
    assert.equal(records[0].userAgent, "TestAgent/1");
    assert.match(records[0].ip, /127\.0\.0\.1/);
  });

  test("the image is sent before recording finishes, and a failing recorder changes nothing", async () => {
    let release;
    delay = new Promise((r) => { release = r; });
    const t0 = Date.now();
    const r = await fetchRaw(`/${newToken().token}.gif`);
    assert.equal(r.status, 200);
    assert.ok(Date.now() - t0 < 1000, "did not wait for the recorder");
    release();

    const failing = await startServer({ record: async () => { throw new Error("db down"); } });
    const b = `http://127.0.0.1:${failing.address().port}/api/e`;
    const res = await fetch(`${b}/${newToken().token}.gif`);
    assert.equal(res.status, 200);
    assert.equal((await res.arrayBuffer()).byteLength, PIXEL.length);
    await stop(failing);
  });

  test("HEAD gets the same headers and is never recorded; other methods are not served", async () => {
    const token = newToken().token;
    const head = await fetch(`${base}/${token}.gif`, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get("content-type"), "image/gif");
    await settle();
    assert.equal(records.length, 0);
    assert.equal((await fetch(`${base}/${token}.gif`, { method: "POST" })).status, 404);
    assert.equal((await fetch(`${base}/${token}.gif`, { method: "DELETE" })).status, 404);
  });

  test("over the per-IP limit the image is STILL served (never 429) but nothing is recorded", async () => {
    const limited = await startServer({ limitPerMinute: 3 });
    const b = `http://127.0.0.1:${limited.address().port}/api/e`;
    const statuses = [];
    for (let i = 0; i < 10; i++) statuses.push((await fetch(`${b}/${newToken().token}.gif`)).status);
    await settle();
    assert.deepEqual([...new Set(statuses)], [200]);
    assert.equal(records.length, 3);
    await stop(limited);
  });
});
