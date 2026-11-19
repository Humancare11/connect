const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

const Mailbox = require("../models/Mailbox");
const MarketingCampaign = require("../models/MarketingCampaign");
const MarketingRecipient = require("../models/MarketingRecipient");
const MarketingLink = require("../models/MarketingLink");
const MarketingSuppression = require("../models/MarketingSuppression");
const { marketingConfig } = require("../services/marketing/config");
const { createMarketingQueue } = require("../services/marketing/queue");
const svc = require("../services/marketing/campaignService");
const { verifyUnsubscribeToken } = require("../services/marketing/unsubscribe");
const { purgeOldRecipients } = require("../services/marketing/purge");
const { sanitizeEmailHtml } = require("../services/marketing/sanitizer");

const SECRET = "s".repeat(40);
const BASE = "https://h.example";
const ADMIN = { id: String(new mongoose.Types.ObjectId()), name: "Shifa Kazi", role: "admin" };

let mongod;
let mailbox;
let supportBox;

const cfgWith = (over = {}) => ({
  ...marketingConfig({ MARKETING_ENABLED: "true", MARKETING_UNSUB_SECRET: SECRET, MARKETING_FOOTER_ADDRESS: "Humancare Connect, Inc.", SES_CONFIGURATION_SET: "cs", PUBLIC_TRACKING_BASE_URL: BASE }),
  sendRatePerSecond: 1000,
  ...over,
});

// A fake clock the tests move by hand, and a fake SES that records every call.
function harness({ cfg = cfgWith(), tracking = { active: false, linksActive: false, baseUrl: BASE } } = {}) {
  const clock = { t: new Date("2026-11-19T10:00:00.000Z") };
  const sleeps = [];
  const logs = [];
  const sender = {
    calls: [],
    next: null, // an error to throw once
    onSend: null,
    async send(args) {
      this.calls.push(args);
      if (this.onSend) await this.onSend(args);
      if (this.next) {
        const e = this.next;
        this.next = null;
        throw e;
      }
      return { messageId: `ses-${this.calls.length}` };
    },
  };
  const log = { warn: (...a) => logs.push(a.join(" ")), error: (...a) => logs.push(a.join(" ")), log: (...a) => logs.push(a.join(" ")) };
  const queue = createMarketingQueue({ sender, cfg, now: () => new Date(clock.t), sleep: async (ms) => sleeps.push(ms), trackingState: async () => tracking, log });
  return { clock, sleeps, logs, sender, queue, cfg };
}

async function campaignWith(emails, { status = "sending", html = '<p>Hello {{name}}</p><a href="https://example.com/a">A</a>' } = {}) {
  const c = await MarketingCampaign.create({
    name: "Test", mailbox: mailbox._id, fromAddress: mailbox.address, fromName: "Strategic", subject: "Hi {{name}}",
    html: sanitizeEmailHtml(html).html, status, startedAt: new Date("2026-11-19T09:00:00Z"), createdBy: ADMIN.id, sentBy: ADMIN.id,
  });
  await MarketingRecipient.insertMany(emails.map((e) => (typeof e === "string" ? { campaign: c._id, email: e, name: "" } : { campaign: c._id, ...e })));
  return c;
}

const statusOf = async (c) => Object.fromEntries((await MarketingRecipient.find({ campaign: c._id }).lean()).map((r) => [r.email, r.status]));

// File-level hooks: both suites below share one in-memory database.
before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([MarketingRecipient.init(), MarketingLink.init(), MarketingSuppression.init(), Mailbox.init()]);
  mailbox = await Mailbox.create({ address: "strategicalliance@humancareconnect.co", displayName: "Strategic", allowedForMarketing: true });
  supportBox = await Mailbox.create({ address: "support@humancareconnect.co", displayName: "Support" });
});
after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
beforeEach(async () => {
  await Promise.all([MarketingCampaign.deleteMany({}), MarketingRecipient.deleteMany({}), MarketingLink.deleteMany({}), MarketingSuppression.deleteMany({})]);
});

describe("Email Marketing queue (fake SES, in-memory MongoDB)", () => {
  test("one separate email per recipient, From = Reply-To = the Mail ID, a working unsubscribe link, then the campaign is sent", async () => {
    const c = await campaignWith([{ email: "ana@example.com", name: "Ana" }, { email: "bo@example.com" }]);
    const h = harness();
    const out = await h.queue.runOnce();
    assert.equal(out.sent, 2);
    assert.equal(h.sender.calls.length, 2);
    for (const call of h.sender.calls) {
      assert.equal(typeof call.to, "string"); // exactly one address, never a list
      assert.equal(call.replyTo, mailbox.address);
      assert.equal(call.fromAddress, mailbox.address);
    }
    const ana = h.sender.calls.find((x) => x.to === "ana@example.com");
    assert.equal(ana.subject, "Hi Ana");
    assert.match(ana.html, /Hello Ana/);
    assert.equal(h.sender.calls.find((x) => x.to === "bo@example.com").subject, "Hi there");
    const rec = await MarketingRecipient.findOne({ email: "ana@example.com" });
    assert.equal(verifyUnsubscribeToken(ana.unsubscribeUrl.split("/api/u/")[1], SECRET), String(rec._id));
    assert.equal(rec.status, "sent");
    assert.equal(rec.sesMessageId, "ses-1");
    assert.equal((await MarketingCampaign.findById(c._id)).status, "sent");
  });

  test("never sends twice: a second pass, or two workers at the same moment, send each person once", async () => {
    await campaignWith(Array.from({ length: 12 }, (_, i) => `u${i}@example.com`));
    const a = harness();
    const b = harness();
    b.sender = a.sender;
    const both = harness();
    await Promise.all([a.queue.runOnce(), createMarketingQueue({ sender: a.sender, cfg: cfgWith(), trackingState: async () => ({ active: false, linksActive: false }), sleep: async () => {}, log: a.logs }).runOnce()]);
    await a.queue.runOnce();
    await both.queue.runOnce();
    const to = a.sender.calls.map((x) => x.to);
    assert.equal(new Set(to).size, 12);
    assert.equal(to.length, 12);
  });

  test("a recipient who unsubscribed after the campaign started is skipped, right before sending", async () => {
    const c = await campaignWith(["keep@example.com", "gone@example.com"]);
    await MarketingSuppression.create({ email: "gone@example.com", reason: "unsubscribe" });
    const h = harness();
    await h.queue.runOnce();
    assert.deepEqual(h.sender.calls.map((x) => x.to), ["keep@example.com"]);
    const s = await statusOf(c);
    assert.equal(s["gone@example.com"], "skipped");
    assert.equal((await MarketingRecipient.findOne({ email: "gone@example.com" })).skipReason, "suppressed");
  });

  test("a crash around the SES call leaves the row 'uncertain': never re-sent automatically, only by 'Retry uncertain'", async () => {
    const c = await campaignWith(["a@example.com", "b@example.com"]);
    // Simulate a process that died after claiming "a" (status sending, lease already expired).
    const t0 = new Date("2026-11-19T09:00:00Z");
    await MarketingRecipient.updateOne({ email: "a@example.com" }, { $set: { status: "sending", lockedUntil: new Date(t0.getTime() + 1000) } });
    const h = harness();
    await h.queue.runOnce();
    assert.deepEqual(h.sender.calls.map((x) => x.to), ["b@example.com"]);
    assert.equal((await statusOf(c))["a@example.com"], "uncertain");
    await h.queue.runOnce();
    assert.equal(h.sender.calls.length, 1, "no automatic retry");
    // Nothing is waiting any more, so the campaign counts as finished; the uncertain row stays visible in the report.
    assert.equal((await MarketingCampaign.findById(c._id)).status, "sent");
  });

  test("Retry uncertain puts them back in the queue once, on request, and the campaign finishes", async () => {
    const c = await campaignWith(["a@example.com"]);
    await MarketingRecipient.updateOne({ email: "a@example.com" }, { $set: { status: "uncertain" } });
    await MarketingCampaign.updateOne({ _id: c._id }, { $set: { status: "sent" } });
    const h = harness();
    assert.equal(await svc.retryUncertain(await MarketingCampaign.findById(c._id)), 1);
    assert.equal((await MarketingCampaign.findById(c._id)).status, "sending");
    await h.queue.runOnce();
    assert.equal(h.sender.calls.length, 1);
    assert.equal((await MarketingCampaign.findById(c._id)).status, "sent");
  });

  test("throttled to the SES send rate", async () => {
    await campaignWith(["a@example.com", "b@example.com", "c@example.com", "d@example.com"]);
    const h = harness({ cfg: cfgWith({ sendRatePerSecond: 4 }) });
    await h.queue.runOnce();
    assert.equal(h.sender.calls.length, 4);
    assert.deepEqual(h.sleeps, [250, 250, 250]); // 4 per second = 250 ms between sends (the clock does not move in this test)
  });

  test("daily cap: stops at the cap, says why, and carries on the next day by itself", async () => {
    const c = await campaignWith(Array.from({ length: 5 }, (_, i) => `u${i}@example.com`));
    const h = harness({ cfg: cfgWith({ dailyCap: 2 }) });
    let out = await h.queue.runOnce();
    assert.equal(out.sent, 2);
    assert.equal(out.capReached, true);
    let fresh = await MarketingCampaign.findById(c._id);
    assert.equal(fresh.status, "sending");
    assert.equal(fresh.holdReason, "daily_cap");
    out = await h.queue.runOnce();
    assert.equal(out.sent, 0, "still the same day");
    h.clock.t = new Date("2026-11-20T00:05:00.000Z");
    out = await h.queue.runOnce();
    assert.equal(out.sent, 2);
    h.clock.t = new Date("2026-11-21T00:05:00.000Z");
    out = await h.queue.runOnce();
    assert.equal(out.sent, 1);
    fresh = await MarketingCampaign.findById(c._id);
    assert.equal(fresh.status, "sent");
    assert.equal(fresh.holdReason, "");
    assert.equal(h.sender.calls.length, 5);
  });

  test("Stop sending: nothing more goes out and the waiting people are skipped", async () => {
    const c = await campaignWith(Array.from({ length: 6 }, (_, i) => `u${i}@example.com`));
    const h = harness();
    h.sender.onSend = async () => {
      if (h.sender.calls.length === 2) await svc.stopCampaign(await MarketingCampaign.findById(c._id));
    };
    await h.queue.runOnce();
    assert.equal(h.sender.calls.length, 2);
    assert.equal((await MarketingCampaign.findById(c._id)).status, "stopped");
    const s = Object.values(await statusOf(c));
    assert.equal(s.filter((x) => x === "sent").length, 2);
    assert.equal(s.filter((x) => x === "skipped").length, 4);
    await h.queue.runOnce();
    assert.equal(h.sender.calls.length, 2);
  });

  test("SES errors: throttling retries later, a refusal fails one person, an unknown outcome is uncertain, an outage holds the campaign", async () => {
    const mk = (name, status) => Object.assign(new Error(name), { name, $metadata: { httpStatusCode: status } });
    const c = await campaignWith(["a@example.com"]);
    const h = harness();

    h.sender.next = mk("ThrottlingException", 400);
    let out = await h.queue.runOnce();
    assert.equal(out.retry, 1);
    assert.equal((await statusOf(c))["a@example.com"], "queued");
    out = await h.queue.runOnce();
    assert.equal(out.sent, 0, "waits for nextAttemptAt");
    h.clock.t = new Date(h.clock.t.getTime() + 60_000);
    out = await h.queue.runOnce();
    assert.equal(out.sent, 1);

    const c2 = await campaignWith(["b@example.com", "c@example.com", "d@example.com"]);
    h.sender.next = mk("MessageRejected", 400);
    await h.queue.runOnce({ maxSends: 1 });
    h.sender.next = mk("ServiceUnavailable", 503);
    await h.queue.runOnce({ maxSends: 1 });
    await h.queue.runOnce({ maxSends: 1 });
    const s2 = await statusOf(c2);
    assert.equal(s2["b@example.com"], "failed");
    assert.equal(s2["c@example.com"], "uncertain");
    assert.equal(s2["d@example.com"], "sent");

    const c3 = await campaignWith(["e@example.com"]);
    h.sender.next = mk("AccountSuspendedException", 400);
    out = await h.queue.runOnce();
    assert.equal(out.hold, 1);
    assert.equal((await statusOf(c3))["e@example.com"], "queued");
    const held = await MarketingCampaign.findById(c3._id);
    assert.equal(held.holdReason, "ses_unavailable");
    assert.ok(held.holdUntil > h.clock.t);
  });

  test("tracking: a hidden image and tracked links per recipient, stored before the mail leaves; unsubscribe link untracked", async () => {
    const c = await campaignWith([{ email: "ana@example.com", name: "Ana" }]);
    const h = harness({ tracking: { active: true, linksActive: true, baseUrl: BASE } });
    h.sender.onSend = async () => {
      assert.equal(await MarketingLink.countDocuments({}), 1, "link stored before sending");
      assert.ok((await MarketingRecipient.findOne({ email: "ana@example.com" })).openTokenHash);
    };
    await h.queue.runOnce();
    const sent = h.sender.calls[0];
    assert.match(sent.html, /src="https:\/\/h\.example\/api\/e\/[A-Za-z0-9_-]{32}\.gif"/);
    assert.match(sent.html, /href="https:\/\/h\.example\/api\/l\/[A-Za-z0-9_-]{32}"/);
    assert.doesNotMatch(sent.html, /href="https:\/\/example\.com\/a"/);
    assert.match(sent.html, /href="https:\/\/h\.example\/api\/u\//);
    const link = await MarketingLink.findOne({});
    assert.equal(link.url, "https://example.com/a");
    assert.equal(String(link.recipient), String((await MarketingRecipient.findOne({ email: "ana@example.com" }))._id));
    assert.equal((await MarketingCampaign.findById(c._id)).status, "sent");
  });

  test("with tracking switched off the mail has no image and no rewritten links", async () => {
    await campaignWith(["a@example.com"]);
    const h = harness({ tracking: { active: false, linksActive: false, baseUrl: BASE } });
    await h.queue.runOnce();
    assert.doesNotMatch(h.sender.calls[0].html, /api\/e\/|api\/l\//);
    assert.equal(await MarketingLink.countDocuments({}), 0);
  });

  test("no address, name or content is ever logged", async () => {
    await campaignWith([{ email: "secret.person@example.com", name: "Secretname" }]);
    const h = harness();
    h.sender.next = Object.assign(new Error("boom for secret.person@example.com"), { name: "MessageRejected", $metadata: { httpStatusCode: 400 } });
    await h.queue.runOnce();
    const text = h.logs.join("\n");
    assert.ok(h.logs.length > 0);
    assert.doesNotMatch(text, /secret\.person|Secretname|Hello/);
  });

  test("retention: personal fields are removed after 12 months, counts and the suppression list stay", async () => {
    const c = await campaignWith([{ email: "old@example.com", name: "Old", company: "Co" }]);
    // Raw write: Mongoose would ignore a change of createdAt.
    await MarketingRecipient.collection.updateOne({ email: "old@example.com" }, { $set: { createdAt: new Date("2025-10-01T00:00:00Z"), status: "sent", sentAt: new Date("2025-10-01"), openCount: 2 } });
    await MarketingSuppression.create({ email: "old@example.com", reason: "unsubscribe" });
    const n = await purgeOldRecipients({ now: new Date("2026-11-19T00:00:00Z"), months: 12 });
    assert.equal(n, 1);
    const row = await MarketingRecipient.collection.findOne({ campaign: c._id });
    assert.equal(row.email, undefined);
    assert.equal(row.name, undefined);
    assert.equal(row.company, undefined);
    assert.ok(row.purgedAt);
    assert.equal(row.openCount, 2);
    assert.equal(await MarketingSuppression.countDocuments({ email: "old@example.com" }), 1);
  });
});

describe("campaign rules (service)", () => {
  test("only Mail IDs allowed for marketing can be used; support@ stays off", async () => {
    await assert.rejects(svc.createDraft({ actor: ADMIN, name: "X", mailboxId: String(supportBox._id) }), /not allowed for marketing/);
    await assert.rejects(svc.createDraft({ actor: ADMIN, name: "X", mailboxId: "nope" }), /Choose a Mail ID/);
    const c = await svc.createDraft({ actor: ADMIN, name: "  My   campaign ", mailboxId: String(mailbox._id) });
    assert.equal(c.name, "My campaign");
    assert.equal(c.fromAddress, mailbox.address);
    assert.deepEqual((await svc.listMailboxes(ADMIN)).map((m) => m.address), [mailbox.address]);
  });

  test("a draft: recipients replaced as a whole, unsubscribed people left out, content sanitised, checks and previews", async () => {
    await MarketingSuppression.create({ email: "no@example.com", reason: "unsubscribe" });
    const draft = await svc.createDraft({ actor: ADMIN, name: "D", mailboxId: String(mailbox._id) });
    const { summary } = await svc.updateDraft({
      campaign: draft, actor: ADMIN, cfg: cfgWith(),
      body: { subject: "Hi {{name}}", html: '<script>x()</script><p onclick="y()">Hello {{name}} {{nmae}}</p><img src="http://insecure.example/i.png">', recipients: { mode: "lines", text: "Ana, ana@example.com\nNo, NO@example.com\nbad\nAna 2, ANA@example.com" } },
    });
    assert.equal(summary.willReceive, 1);
    assert.equal(summary.invalidCount, 1);
    assert.equal(summary.duplicates, 1);
    assert.deepEqual(summary.suppressed, ["no@example.com"]);
    assert.doesNotMatch(draft.html, /<script|onclick/);
    assert.equal(draft.htmlRemoved.scripts, 1);

    const view = await svc.draftView(draft, cfgWith());
    assert.equal(view.recipientCount, 1);
    assert.equal(view.recipientsText, "Ana, ana@example.com");

    const pv = await svc.previewMail(draft, 0, cfgWith());
    assert.equal(pv.recipient.email, "ana@example.com");
    assert.equal(pv.subject, "Hi Ana");
    assert.match(pv.html, /Hello Ana \{\{nmae\}\}/);
    const byKey = Object.fromEntries(pv.checks.map((c) => [c.key, c]));
    assert.equal(byKey.placeholder.ok, true);
    assert.equal(byKey.unknown.ok, false);
    assert.equal(byKey.scripts.ok, false);
    assert.equal(byKey.http.ok, false);
    assert.equal(byKey.size.ok, true);
    assert.equal(await svc.previewMail(draft, 5, cfgWith()).then((p) => p.index), 0); // wraps around

    await svc.updateDraft({ campaign: draft, actor: ADMIN, body: { fallbackName: "friend" } });
    assert.equal((await svc.previewMail(draft, 0, cfgWith())).subject, "Hi Ana");
  });

  test("a campaign can be sent only once, only after confirming, and only when SES is set up", async () => {
    const draft = await svc.createDraft({ actor: ADMIN, name: "S", mailboxId: String(mailbox._id) });
    await svc.updateDraft({ campaign: draft, actor: ADMIN, cfg: cfgWith(), body: { subject: "S", html: "<p>x</p>", recipients: { mode: "emails", text: "a@example.com, b@example.com" } } });
    await assert.rejects(svc.startCampaign({ campaign: draft, actor: ADMIN, confirm: false, cfg: cfgWith() }), /confirm/);
    await assert.rejects(svc.startCampaign({ campaign: draft, actor: ADMIN, confirm: true, cfg: marketingConfig({}) }), (e) => e.status === 503 && e.extra.missing.length === 4);

    // Someone unsubscribes between saving the list and pressing send.
    await MarketingSuppression.create({ email: "b@example.com", reason: "unsubscribe" });
    const results = await Promise.allSettled([
      svc.startCampaign({ campaign: draft, actor: ADMIN, confirm: true, cfg: cfgWith() }),
      svc.startCampaign({ campaign: draft, actor: ADMIN, confirm: true, cfg: cfgWith() }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1, "double click starts it once");
    const started = await MarketingCampaign.findById(draft._id);
    assert.equal(started.status, "sending");
    assert.equal(started.sentByName, "Shifa Kazi");
    assert.ok(started.confirmedAt && started.startedAt);
    assert.equal((await statusOf(draft))["b@example.com"], "skipped");
    await assert.rejects(svc.updateDraft({ campaign: started, actor: ADMIN, body: { name: "x" } }), /already been sent/);
  });

  test("a test mail uses the first recipient's name, is marked [Test], has no tracking and no real unsubscribe link", async () => {
    const draft = await svc.createDraft({ actor: ADMIN, name: "T", mailboxId: String(mailbox._id) });
    await svc.updateDraft({ campaign: draft, actor: ADMIN, cfg: cfgWith(), body: { subject: "Hello {{name}}", html: '<p>Hi {{name}}</p><a href="https://example.com/x">x</a>', recipients: { mode: "lines", text: "Ana, ana@example.com" } } });
    const h = harness();
    await assert.rejects(svc.sendTest({ campaign: draft, actor: ADMIN, to: "not an email", sender: h.sender, cfg: cfgWith() }), /valid email/);
    await svc.sendTest({ campaign: draft, actor: ADMIN, to: "me@humancareconnect.co", sender: h.sender, cfg: cfgWith() });
    const call = h.sender.calls[0];
    assert.equal(call.to, "me@humancareconnect.co");
    assert.equal(call.subject, "[Test] Hello Ana");
    assert.match(call.html, /Hi Ana/);
    assert.doesNotMatch(call.html, /api\/e\/|api\/l\//);
    assert.ok(!call.unsubscribeUrl);
    assert.equal(await MarketingRecipient.countDocuments({ status: "sent" }), 0, "a test never touches the campaign");
  });

  test("limits: too many recipients and oversized designs are refused", async () => {
    const draft = await svc.createDraft({ actor: ADMIN, name: "L", mailboxId: String(mailbox._id) });
    await assert.rejects(
      svc.updateDraft({ campaign: draft, actor: ADMIN, cfg: cfgWith({ maxRecipients: 2 }), body: { recipients: { mode: "emails", text: "a@example.com,b@example.com,c@example.com" } } }),
      /at most 2/
    );
    await assert.rejects(svc.updateDraft({ campaign: draft, actor: ADMIN, body: { html: "x".repeat(1_000_001) } }), (e) => e.status === 413);
  });
});
