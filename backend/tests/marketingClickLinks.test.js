const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

const Mailbox = require("../models/Mailbox");
const MarketingCampaign = require("../models/MarketingCampaign");
const MarketingRecipient = require("../models/MarketingRecipient");
const MarketingLink = require("../models/MarketingLink");
const MarketingEvent = require("../models/MarketingEvent");
const { marketingConfig } = require("../services/marketing/config");
const { createMarketingQueue } = require("../services/marketing/queue");
const { renderMail } = require("../services/marketing/render");
const { newClickCode, hashCode, ownSiteHosts, planLink, isSitePage, isCodeShape, marketingLinksOn } = require("../services/marketing/clickLinks");
const { recordMarketingClick, findMarketingCode } = require("../services/marketing/tracking");
const { create: createRouters } = require("../routes/publicClickCodes");

const BASE = "https://uat.humancareconnect.co";
const SECRET = "s".repeat(40);
const UA = "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0 Safari/537.36";
const ENV_ON = { EMAIL_TRACKING_ENABLED: "true", EMAIL_TRACKING_LINKS_ENABLED: "true", PUBLIC_TRACKING_BASE_URL: BASE };

describe("rewriting rules (pure)", () => {
  const hosts = ownSiteHosts({ baseUrl: BASE });
  const plan = (url, code = "AbC123xYz9") => planLink(url, { hosts, code, goUrl: (c) => `${BASE}/go/${c}` });

  test("codes: about 10 random base62 characters; only the hash is derived for storage", () => {
    const a = newClickCode();
    const b = newClickCode();
    assert.match(a.code, /^[0-9A-Za-z]{10}$/);
    assert.notEqual(a.code, b.code);
    assert.equal(a.hash, hashCode(a.code));
    assert.notEqual(a.hash, a.code);
    assert.ok(isCodeShape(a.code));
    assert.equal(isCodeShape("short"), false);
    assert.equal(isCodeShape("../../etc/passwd"), false);
  });

  test("own site keeps the real page URL and appends ?r=<code>; query string and #fragment are kept", () => {
    assert.deepEqual(plan("https://humancareconnect.co/doctors"), { kind: "own", url: "https://humancareconnect.co/doctors?r=AbC123xYz9" });
    assert.equal(plan("https://www.humancareconnect.co/blogs/x").url, "https://www.humancareconnect.co/blogs/x?r=AbC123xYz9");
    assert.equal(plan("https://humancareconnect.co/p?utm_source=mail&a=1").url, "https://humancareconnect.co/p?utm_source=mail&a=1&r=AbC123xYz9");
    assert.equal(plan("https://humancareconnect.co/p#pricing").url, "https://humancareconnect.co/p?r=AbC123xYz9#pricing");
    assert.equal(plan("https://humancareconnect.co/p?a=1#pricing").url, "https://humancareconnect.co/p?a=1&r=AbC123xYz9#pricing");
    assert.equal(plan("https://humancareconnect.co").url, "https://humancareconnect.co?r=AbC123xYz9");
    assert.doesNotMatch(plan("https://humancareconnect.co/doctors").url, /go\/|api\//);
  });

  test("the UAT host counts as own site because it is the host of the base URL; on production it is external", () => {
    assert.equal(plan("https://uat.humancareconnect.co/doctors").kind, "own");
    const prod = ownSiteHosts({ baseUrl: "https://humancareconnect.co" });
    assert.equal(planLink("https://uat.humancareconnect.co/x", { hosts: prod, code: "AbC123xYz9", goUrl: (c) => `/go/${c}` }).kind, "go");
  });

  test("other sites go through /go/<code> on our main domain", () => {
    assert.deepEqual(plan("https://example.com/offer?x=1#a"), { kind: "go", url: `${BASE}/go/AbC123xYz9` });
    assert.equal(plan("https://humancareconnect.co.evil.com/x").kind, "go", "a look-alike host is not our site");
    assert.equal(plan("https://evilhumancareconnect.co/x").kind, "go");
    assert.equal(plan("https://humancareconnect.co@evil.com/x").kind, "go", "user-info trick");
  });

  test("files, API addresses and links that already carry an r parameter use the redirect, not ?r=", () => {
    assert.equal(plan("https://humancareconnect.co/files/guide.pdf").kind, "go");
    assert.equal(plan("https://humancareconnect.co/api/anything").kind, "go");
    assert.equal(plan("https://humancareconnect.co/page?r=mine").kind, "go");
    assert.equal(plan("https://humancareconnect.co/page.html").kind, "own");
    assert.equal(isSitePage("/blogs/some.slug"), false, "a dot-suffix looks like a file");
    assert.equal(isSitePage("/blogs/slug"), true);
  });

  test("mailto:, tel:, javascript: and anything that is not plain http(s) is never rewritten", () => {
    for (const url of ["mailto:a@b.co", "tel:+15551234", "javascript:alert(1)", "ftp://x.co/a", "#top", "/relative", "not a url"]) {
      assert.equal(plan(url), null, url);
    }
  });

  test("the gate: env switches only; the Email page switch is not consulted", () => {
    assert.equal(marketingLinksOn({ envEnabled: true, linksEnvEnabled: true, baseUrl: BASE, trackClicks: false, linksActive: false }), true);
    assert.equal(marketingLinksOn({ envEnabled: false, linksEnvEnabled: true, baseUrl: BASE }), false);
    assert.equal(marketingLinksOn({ envEnabled: true, linksEnvEnabled: false, baseUrl: BASE }), false);
    assert.equal(marketingLinksOn({ envEnabled: true, linksEnvEnabled: true, baseUrl: "" }), false);
  });

  test("the plain-text part keeps the original links; only the HTML part is rewritten", () => {
    const campaign = { subject: "s", html: '<p><a href="https://example.com/offer">Offer</a> <a href="mailto:hi@humancareconnect.co">Mail</a></p>' };
    const trackLink = (url) => (url.startsWith("https://example.com") ? `${BASE}/go/AbC123xYz9` : null);
    const mail = renderMail({ campaign, recipient: {}, footerAddress: "Addr", unsubscribeUrl: `${BASE}/api/u/tok`, trackLink });
    assert.match(mail.html, /href="https:\/\/uat\.humancareconnect\.co\/go\/AbC123xYz9"/);
    assert.match(mail.html, /href="mailto:hi@humancareconnect\.co"/);
    assert.match(mail.text, /https:\/\/example\.com\/offer/);
    assert.doesNotMatch(mail.text, /\/go\//);
  });
});

describe("queue, click recording and the public routes", () => {
  let mongod;
  let mailbox;
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri(), { dbName: "marketing-click-links" });
    mailbox = await Mailbox.create({ address: "strategicalliance@humancareconnect.co", displayName: "Updates", allowedForMarketing: true });
  });
  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await Promise.all([MarketingCampaign, MarketingRecipient, MarketingLink, MarketingEvent].map((m) => m.deleteMany({})));
  });

  const cfg = () => ({
    ...marketingConfig({ MARKETING_ENABLED: "true", MARKETING_UNSUB_SECRET: SECRET, MARKETING_FOOTER_ADDRESS: "Humancare Connect, Inc.", SES_CONFIGURATION_SET: "cs", PUBLIC_TRACKING_BASE_URL: BASE }),
    sendRatePerSecond: 1000,
  });
  const html =
    '<p><a href="https://humancareconnect.co/doctors?a=1#top">Own</a> <a href="https://example.com/offer">Other</a> ' +
    '<a href="mailto:hi@humancareconnect.co">Mail</a> <a href="tel:+15551234">Call</a> <a href="#faq">FAQ</a></p>';

  async function sendOne(state) {
    const campaign = await MarketingCampaign.create({
      name: "C", mailbox: mailbox._id, fromAddress: mailbox.address, fromName: "Updates", subject: "S", html, status: "sending", createdBy: new mongoose.Types.ObjectId(),
    });
    await MarketingRecipient.create({ campaign: campaign._id, email: "reader@example.com", status: "queued" });
    const calls = [];
    const sender = { send: async (m) => (calls.push(m), { messageId: "ses-1" }) };
    const queue = createMarketingQueue({ sender, cfg: cfg(), sleep: async () => {}, trackingState: async () => state, log: { warn() {}, error() {}, log() {} } });
    await queue.runOnce();
    return calls[0];
  }

  test("a sent mail: own link = real URL + ?r=, other site = /go/, mailto/tel/# and the unsubscribe link untouched, text part original", async () => {
    // The Email page link switch is OFF (linksActive false, trackClicks false): marketing still tracks clicks.
    const mail = await sendOne({ envEnabled: true, linksEnvEnabled: true, active: false, linksActive: false, trackClicks: false, baseUrl: BASE });
    assert.match(mail.html, /href="https:\/\/humancareconnect\.co\/doctors\?a=1&amp;r=[A-Za-z0-9]{10}#top"/);
    assert.match(mail.html, /href="https:\/\/uat\.humancareconnect\.co\/go\/[A-Za-z0-9]{10}"/);
    assert.match(mail.html, /href="mailto:hi@humancareconnect\.co"/);
    assert.match(mail.html, /href="tel:\+15551234"/);
    assert.match(mail.html, /href="#faq"/);
    assert.match(mail.html, /href="https:\/\/uat\.humancareconnect\.co\/api\/u\/[^"]+"/, "unsubscribe link is not rewritten");
    assert.doesNotMatch(mail.html, /api\/l\//);
    assert.doesNotMatch(mail.html, /reader@example/, "no email address in any URL");
    assert.match(mail.text, /https:\/\/humancareconnect\.co\/doctors\?a=1#top/);
    assert.match(mail.text, /https:\/\/example\.com\/offer/);
    assert.doesNotMatch(mail.text, /[?&]r=|\/go\//);

    const links = await MarketingLink.find({}).sort({ index: 1 }).lean();
    assert.deepEqual(links.map((l) => [l.kind, l.url]), [["own", "https://humancareconnect.co/doctors?a=1#top"], ["go", "https://example.com/offer"]]);
    for (const l of links) assert.match(l.tokenHash, /^[0-9a-f]{64}$/, "only the hash is stored");
  });

  test("env switches off: no link is rewritten (the emergency stop)", async () => {
    const mail = await sendOne({ envEnabled: true, linksEnvEnabled: false, active: true, linksActive: false, baseUrl: BASE });
    assert.doesNotMatch(mail.html, /\/go\/|[?&]r=/);
    assert.equal(await MarketingLink.countDocuments({}), 0);
  });

  async function trackedLink(kind = "go", url = "https://example.com/offer") {
    const campaign = await MarketingCampaign.create({ name: "T", mailbox: mailbox._id, fromAddress: mailbox.address, subject: "s", html: "<p>x</p>", status: "sent", createdBy: new mongoose.Types.ObjectId() });
    const rec = await MarketingRecipient.create({ campaign: campaign._id, email: "reader@example.com", status: "sent", sentAt: new Date(Date.now() - 3600_000) });
    const c = newClickCode();
    await MarketingLink.create({ recipient: rec._id, campaign: campaign._id, index: 0, url, tokenHash: c.hash, kind });
    return { rec, code: c.code };
  }

  test("clicks use the same classifiers: a person counts once; scanners, no user agent and double clicks do not", async () => {
    const { rec, code } = await trackedLink();
    const click = (userAgent, ip = "203.0.113.5", env = ENV_ON) => recordMarketingClick({ code, ip, userAgent }, { env });
    assert.equal((await click("")).counted, false);
    assert.equal((await click("curl/8.0")).counted, false);
    assert.equal((await click(UA)).counted, true);
    assert.equal((await click(UA)).counted, false, "double click");
    assert.equal((await MarketingRecipient.findById(rec._id)).clickCount, 1);
    assert.equal((await click(UA, "203.0.113.5", { ...ENV_ON, EMAIL_TRACKING_LINKS_ENABLED: "false" })).recorded, false, "env off records nothing");
    const events = await MarketingEvent.find({ recipient: rec._id }).lean();
    assert.ok(events.every((e) => !("ip" in e)));
  });

  test("a click inside the grace window after sending is a scanner and is not counted", async () => {
    const { rec, code } = await trackedLink();
    await MarketingRecipient.updateOne({ _id: rec._id }, { $set: { sentAt: new Date(Date.now() - 2000) } });
    const res = await recordMarketingClick({ code, ip: "203.0.113.5", userAgent: UA }, { env: ENV_ON });
    assert.equal(res.recorded, true);
    assert.equal(res.counted, false);
    assert.equal((await MarketingRecipient.findById(rec._id)).clickCount, 0);
  });

  test("a code finds its link; a bad code finds nothing", async () => {
    const { code } = await trackedLink();
    assert.equal((await findMarketingCode(code)).url, "https://example.com/offer");
    assert.equal(await findMarketingCode("zzzzzzzzzz"), null);
    assert.equal(await findMarketingCode("../x"), null);
    assert.equal(await findMarketingCode(undefined), null);
  });

  // A tiny server around the two routers.
  async function withServer(opts, fn) {
    const { go, report } = createRouters(opts);
    const app = express();
    app.set("trust proxy", 1);
    app.use("/go", go);
    app.use("/api/r", report);
    const server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    try {
      await fn(`http://127.0.0.1:${server.address().port}`);
    } finally {
      await new Promise((r) => server.close(r));
    }
  }
  const settle = () => new Promise((r) => setTimeout(r, 80));

  test("/go/<code>: 302 only to the stored URL; unknown or odd codes 404; HEAD is not recorded; nothing can be passed in", async () => {
    const recorded = [];
    const store = new Map([
      ["AbC123xYz9", { url: "https://example.com/offer?x=1#a" }],
      ["BadScheme1", { url: "javascript:alert(1)" }],
      ["Evil000001", { url: "//evil.example/x" }],
    ]);
    await withServer({ record: async (a) => recorded.push(a), find: async (c) => store.get(c) || null, limitPerMinute: 1000 }, async (origin) => {
      const ok = await fetch(`${origin}/go/AbC123xYz9`, { redirect: "manual", headers: { "user-agent": UA } });
      assert.equal(ok.status, 302);
      assert.equal(ok.headers.get("location"), "https://example.com/offer?x=1#a");
      assert.equal(ok.headers.get("referrer-policy"), "no-referrer");
      assert.match(ok.headers.get("cache-control"), /no-store/);
      await settle();
      assert.equal(recorded.length, 1);
      assert.equal(recorded[0].code, "AbC123xYz9");

      const head = await fetch(`${origin}/go/AbC123xYz9`, { method: "HEAD", redirect: "manual" });
      assert.equal(head.status, 302);
      await settle();
      assert.equal(recorded.length, 1, "HEAD (a scanner first look) is not recorded");

      for (const path of ["/go/Unknown000", "/go/BadScheme1", "/go/Evil000001", "/go/short", "/go/..%2F..%2Fetc", "/go/"]) {
        const res = await fetch(`${origin}${path}`, { redirect: "manual" });
        assert.notEqual(res.status, 302, path);
        assert.equal(res.headers.get("location"), null, path);
      }
      // A query parameter can never change where the redirect goes.
      const withParam = await fetch(`${origin}/go/AbC123xYz9?url=https://evil.example`, { redirect: "manual" });
      assert.equal(withParam.headers.get("location"), "https://example.com/offer?x=1#a");
      await settle();
    });
  });

  test("/go/<code> follows the real database and records through the real recorder", async () => {
    const { rec, code } = await trackedLink();
    const saved = { ...process.env };
    Object.assign(process.env, ENV_ON);
    try {
      await withServer({ limitPerMinute: 1000 }, async (origin) => {
        const res = await fetch(`${origin}/go/${code}`, { redirect: "manual", headers: { "user-agent": UA } });
        assert.equal(res.status, 302);
        assert.equal(res.headers.get("location"), "https://example.com/offer");
        await settle();
        await settle();
        assert.equal((await MarketingRecipient.findById(rec._id)).clickCount, 1);
      });
    } finally {
      for (const k of Object.keys(ENV_ON)) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
    }
  });

  test("POST /api/r/<code>: always 204, records only a well-formed code, rate limited, GET refused", async () => {
    const recorded = [];
    await withServer({ record: async (a) => recorded.push(a), find: async () => null, limitPerMinute: 3 }, async (origin) => {
      const post = (code) => fetch(`${origin}/api/r/${code}`, { method: "POST", headers: { "user-agent": UA } });
      assert.equal((await post("AbC123xYz9")).status, 204);
      assert.equal((await post("nope!")).status, 204);
      assert.equal((await post("AbC123xYz9")).status, 204);
      await settle();
      assert.deepEqual(recorded.map((r) => r.code), ["AbC123xYz9", "AbC123xYz9"]);
      assert.equal(recorded[0].userAgent, UA);
      assert.equal((await post("AbC123xYz9")).status, 429, "rate limit per address");
      assert.equal((await fetch(`${origin}/api/r/AbC123xYz9`)).status, 404, "only POST");
    });
  });
});
