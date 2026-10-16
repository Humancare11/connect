const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const EmailMessage = require("../models/EmailMessage");
const EmailOpenEvent = require("../models/EmailOpenEvent");
const EmailSettings = require("../models/EmailSettings");
const { classifyOpen, uaFamily } = require("../services/email/openClassifier");
const { parseScannerIps, matchScanner, isApplePrivacyProxy, APPLE_SEED_IPS } = require("../services/email/scannerLists");
const { trackingEnv } = require("../services/email/emailSettings");
const { recordOpen } = require("../services/email/trackingRecorder");
const { computeReadStatus } = require("../services/email/readStatus");
const { trackingView } = require("../services/email/emailSerializers");
const { newToken } = require("../services/email/trackingToken");

const SENT = new Date("2026-10-05T10:00:00Z");
const at = (seconds) => new Date(SENT.getTime() + seconds * 1000);
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const GOOGLE_PROXY = "Mozilla/5.0 (Windows NT 5.1; rv:11.0) Gecko Firefox/11.0 (via ggpht.com GoogleImageProxy)";

describe("scanner lists", () => {
  test("vendor user agents are named, so the stored reason says who it was", () => {
    const cases = [
      ["Mozilla/5.0 (compatible; SafeLinks)", "microsoft"],
      ["Mozilla/5.0 BingPreview/1.0b", "microsoft"],
      ["Mimecast-Sandbox", "mimecast"],
      ["Proofpoint URL Defense", "proofpoint"],
      ["Barracuda Sentinel", "barracuda"],
      ["Googlebot/2.1", "google"],
    ];
    for (const [ua, vendor] of cases) assert.deepEqual(matchScanner({ userAgent: ua }), { vendor, by: "ua" }, ua);
    assert.equal(matchScanner({ userAgent: CHROME }), null);
  });

  test("the Gmail image proxy is not on any scanner list", () => {
    assert.equal(matchScanner({ userAgent: GOOGLE_PROXY }), null);
  });

  test("EMAIL_SCANNER_IPS: vendor=range pairs, bare ranges, junk ignored", () => {
    assert.deepEqual(parseScannerIps("microsoft=40.92.0.0/15, Mimecast=203.0.113.0/24 ,198.51.100.7, ,x="), [
      { vendor: "microsoft", rule: "40.92.0.0/15" },
      { vendor: "mimecast", rule: "203.0.113.0/24" },
      { vendor: "other", rule: "198.51.100.7" },
    ]);
    assert.deepEqual(parseScannerIps(""), []);
  });

  test("an address on a vendor list is a scanner even with a normal browser user agent", () => {
    const scannerIps = parseScannerIps("proofpoint=203.0.113.0/24");
    assert.deepEqual(matchScanner({ userAgent: CHROME, ip: "203.0.113.50", scannerIps }), { vendor: "proofpoint", by: "ip" });
    assert.equal(matchScanner({ userAgent: CHROME, ip: "8.8.8.8", scannerIps }), null);
  });

  test("no vendor address ranges are guessed: the list is empty until the environment fills it", () => {
    assert.deepEqual(trackingEnv({}).scannerIps, []);
    assert.deepEqual(trackingEnv({}).appleIps, []);
    assert.equal(trackingEnv({}).secondHitMinutes, 2);
    assert.deepEqual(trackingEnv({ EMAIL_SECOND_HIT_MINUTES: "5" }).secondHitMinutes, 5);
  });

  test("Apple: only Apple's own block is built in; partner ranges come from the environment", () => {
    assert.deepEqual(APPLE_SEED_IPS, ["17.0.0.0/8"]);
    assert.equal(isApplePrivacyProxy("17.58.1.2"), true);
    assert.equal(isApplePrivacyProxy("::ffff:17.58.1.2"), true);
    assert.equal(isApplePrivacyProxy("8.8.8.8"), false);
    assert.equal(isApplePrivacyProxy("198.51.100.9", ["198.51.100.0/24"]), true);
  });
});

describe("classifyOpen: scanners and Apple", () => {
  const base = { sentAt: SENT, graceSeconds: 60, now: at(600) };

  test("a vendor scanner is ignored as automated and named in the reason", () => {
    const v = classifyOpen({ ...base, ip: "8.8.8.8", userAgent: "Mimecast" });
    assert.deepEqual([v.counted, v.reason, v.automated, v.scanner], [false, "scanner_mimecast", true, true]);
  });

  test("a vendor address with a browser user agent is ignored", () => {
    const v = classifyOpen({ ...base, ip: "203.0.113.5", userAgent: CHROME, scannerIps: parseScannerIps("microsoft=203.0.113.0/24") });
    assert.deepEqual([v.counted, v.reason], [false, "scanner_microsoft"]);
  });

  test("Gmail's image proxy is not a scanner even from a listed address", () => {
    const v = classifyOpen({ ...base, ip: "203.0.113.5", userAgent: GOOGLE_PROXY, scannerIps: parseScannerIps("google=203.0.113.0/24") });
    assert.equal(v.counted, true);
  });

  test("an Apple proxy address is reported as Apple, never as an open and never dropped", () => {
    const v = classifyOpen({ ...base, ip: "17.241.0.9", userAgent: SAFARI });
    assert.deepEqual(v, { counted: false, reason: "apple_proxy", automated: false, apple: true });
  });

  test("Apple loads arrive at delivery, so the grace window does not hide them", () => {
    const v = classifyOpen({ ...base, now: at(2), ip: "17.241.0.9", userAgent: SAFARI });
    assert.equal(v.apple, true);
  });

  test("when every recipient is Apple, an unlisted address that is not a scanner is still Apple", () => {
    const v = classifyOpen({ ...base, ip: "104.28.0.1", userAgent: SAFARI, allRecipientsApple: true });
    assert.equal(v.apple, true);
  });

  test("mixed recipients: the same hit is a normal open, because it might be the other recipient", () => {
    const v = classifyOpen({ ...base, ip: "104.28.0.1", userAgent: SAFARI, allRecipientsApple: false });
    assert.equal(v.counted, true);
  });

  test("an all-Apple mail loaded by a scanner is a scanner, not Apple", () => {
    const v = classifyOpen({ ...base, ip: "104.28.0.1", userAgent: "Mimecast", allRecipientsApple: true });
    assert.deepEqual([v.apple, v.reason], [undefined, "scanner_mimecast"]);
  });

  test("uaFamily names vendor scanners as Scanner", () => {
    assert.equal(uaFamily("Barracuda Sentinel"), "Scanner");
    assert.equal(uaFamily("Mozilla/5.0 SafeLinks"), "Scanner");
  });
});

describe("recordOpen: second hit and Apple", () => {
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

  async function tracked(tracking = {}) {
    const { token, hash } = newToken();
    const doc = new EmailMessage({
      mailbox: new mongoose.Types.ObjectId(), direction: "out", status: "sent", gmailMessageId: `g${Math.random()}`,
      from: { address: "support@humancareconnect.co" }, to: [{ address: "a@gmail.com" }], subject: "s", messageDate: SENT,
      tracking: { enabled: true, tokenHash: hash, status: "pending", ...tracking },
    });
    doc.setContent({ text: "x", html: "", snippet: "x" });
    await doc.save();
    return { token, id: doc._id };
  }
  const env = { EMAIL_TRACKING_ENABLED: "true", PUBLIC_TRACKING_BASE_URL: "https://api.example.com", EMAIL_TRACKING_GRACE_SECONDS: "60", EMAIL_TRACKING_DEDUPE_MINUTES: "10", EMAIL_SCANNER_IPS: "proofpoint=203.0.113.0/24" };
  const rec = (token, extra = {}, now = at(300)) => recordOpen({ token, ip: "8.8.8.8", userAgent: CHROME, ...extra }, { state: { active: true }, env, now });
  const row = (id) => EmailMessage.findById(id).lean();

  test("a scanner hit alone never counts: the honest answer is 'only automatic loads seen'", async () => {
    const { token, id } = await tracked();
    assert.deepEqual(await rec(token, { userAgent: "Mimecast" }), { recorded: true, counted: false, reason: "scanner_mimecast" });
    const t = (await row(id)).tracking;
    assert.deepEqual([t.status, t.unavailableReason, t.openCount], ["unavailable", "automated_only", 0]);
    assert.equal(computeReadStatus(await row(id)).status, "automated");
  });

  test("a second hit from a scanner-looking client 2+ minutes later counts as an open", async () => {
    const { token, id } = await tracked();
    await rec(token, { userAgent: "Mimecast" }, at(300));
    assert.deepEqual(await rec(token, { userAgent: "Mimecast" }, at(300 + 130)), { recorded: true, counted: true, reason: "second_hit" });
    const t = (await row(id)).tracking;
    assert.deepEqual([t.status, t.openCount], ["opened", 1]);
    const ev = await EmailOpenEvent.find({ message: id }).sort({ at: 1 }).lean();
    assert.deepEqual(ev.map((e) => [e.counted, e.ignoreReason]), [[false, "scanner_mimecast"], [true, "second_hit"]]);
  });

  test("a second scanner hit within 2 minutes is the same scan, not an open", async () => {
    const { token, id } = await tracked();
    await rec(token, { userAgent: "Mimecast" }, at(300));
    assert.equal((await rec(token, { userAgent: "Mimecast" }, at(300 + 90))).counted, false);
    assert.equal((await row(id)).tracking.openCount, 0);
  });

  test("a vendor-listed address works the same way", async () => {
    const { token, id } = await tracked();
    assert.equal((await rec(token, { ip: "203.0.113.4" }, at(300))).reason, "scanner_proofpoint");
    assert.equal((await rec(token, { ip: "203.0.113.4" }, at(300 + 180))).counted, true);
    assert.equal((await row(id)).tracking.status, "opened");
  });

  test("a grace-window hit does not start the second-hit clock", async () => {
    const { token } = await tracked();
    await rec(token, { userAgent: "Mimecast" }, at(10)); // inside the grace window
    assert.equal((await rec(token, { userAgent: "Mimecast" }, at(10 + 130))).counted, false, "first scanner hit after the window is still a first hit");
  });

  test("an Apple hit is recorded apart: status stays pending, read status is Opened (Apple)", async () => {
    const { token, id } = await tracked();
    assert.deepEqual(await rec(token, { ip: "17.241.0.9", userAgent: SAFARI }, at(5)), { recorded: true, counted: false, reason: "apple_proxy" });
    const t = (await row(id)).tracking;
    assert.deepEqual([t.status, t.openCount, t.appleOpenCount], ["pending", 0, 1]);
    assert.deepEqual([t.firstAppleOpenedAt, t.lastAppleOpenedAt], [at(5), at(5)]);
    assert.equal(computeReadStatus(await row(id)).status, "opened_apple");
    const ev = await EmailOpenEvent.findOne({ message: id }).lean();
    assert.deepEqual([ev.counted, ev.ignoreReason, ev.uaFamily], [false, "apple_proxy", "ApplePrivacyProxy"]);
    assert.ok(!JSON.stringify(ev).includes("17.241"), "no IP stored");
  });

  test("Apple hits are counted, first/last tracked, and a later real open outranks them", async () => {
    const { token, id } = await tracked();
    await rec(token, { ip: "17.241.0.9", userAgent: SAFARI }, at(5));
    await rec(token, { ip: "17.241.0.9", userAgent: SAFARI }, at(9000));
    let t = (await row(id)).tracking;
    assert.deepEqual([t.appleOpenCount, t.firstAppleOpenedAt, t.lastAppleOpenedAt], [2, at(5), at(9000)]);
    await rec(token, {}, at(9100));
    assert.equal(computeReadStatus(await row(id)).status, "opened");
  });

  test("an all-Apple mail with an unlisted proxy address is still Apple", async () => {
    const { token, id } = await tracked({ allRecipientsApple: true });
    await rec(token, { ip: "104.28.0.1", userAgent: SAFARI });
    const t = (await row(id)).tracking;
    assert.deepEqual([t.status, t.appleOpenCount], ["pending", 1]);
  });

  test("a mixed mail's Gmail open is a normal open", async () => {
    const { token, id } = await tracked({ allRecipientsApple: false });
    await rec(token, { ip: "104.28.0.1", userAgent: GOOGLE_PROXY });
    assert.equal((await row(id)).tracking.status, "opened");
  });

  test("the screen payload carries the Apple signal and the recipient facts", async () => {
    const { token, id } = await tracked({ includesInternal: true });
    await rec(token, { ip: "17.241.0.9", userAgent: SAFARI }, at(5));
    const v = trackingView(await row(id));
    assert.deepEqual([v.readStatus, v.includesInternal, v.allRecipientsApple], ["opened_apple", true, false]);
    assert.equal(v.signals.openedApple.count, 1);
    assert.equal(v.signals.opened, null);
  });
});
