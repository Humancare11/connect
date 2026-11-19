const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

const User = require("../models/User");
const Mailbox = require("../models/Mailbox");
const EmailMessage = require("../models/EmailMessage");
const EmailTrackingOptOut = require("../models/EmailTrackingOptOut");
const MarketingCampaign = require("../models/MarketingCampaign");
const MarketingRecipient = require("../models/MarketingRecipient");
const MarketingLink = require("../models/MarketingLink");
const MarketingEvent = require("../models/MarketingEvent");
const MarketingSuppression = require("../models/MarketingSuppression");
const { adminOnly, superAdminOnly } = require("../middleware/verifyToken");
const { marketingEnabledGate, requireMarketingAccess } = require("../middleware/marketingAccess");
const { marketingConfig } = require("../services/marketing/config");
const { createMarketingQueue } = require("../services/marketing/queue");
const { createUnsubscribeToken } = require("../services/marketing/unsubscribe");
const { recordMarketingOpen, recordMarketingClick } = require("../services/marketing/tracking");
const { recordOpenAny, recordClickAny, findLinkAny } = require("../services/marketing/trackingBridge");
const { newToken } = require("../services/email/trackingToken");

const SECRET = "s".repeat(40);
const TOPIC = "arn:aws:sns:ap-south-1:123456789012:ses-events";
const cfg = {
  ...marketingConfig({ MARKETING_ENABLED: "true", MARKETING_UNSUB_SECRET: SECRET, MARKETING_FOOTER_ADDRESS: "Humancare Connect, Inc.", SES_CONFIGURATION_SET: "cs", PUBLIC_TRACKING_BASE_URL: "https://h.example", SES_SNS_TOPIC_ARN: TOPIC }),
  sendRatePerSecond: 1000,
};

let mongod, server, base;
let users = {};
let boxes = {};
const sender = { calls: [], async send(a) { this.calls.push(a); return { messageId: `ses-${this.calls.length}` }; } };
const snsVerifyFake = async (raw) => {
  const msg = JSON.parse(raw);
  if (msg.Signature !== "valid") throw new (require("../services/marketing/snsVerify").SnsVerifyError)("bad");
  return msg;
};
const confirmed = [];

const fakeAuth = (req, res, next) => {
  const raw = req.headers["x-user"];
  if (!raw) return res.status(401).json({ msg: "Not signed in." });
  req.user = JSON.parse(raw);
  next();
};
const asUser = (u) => ({ "x-user": JSON.stringify({ id: String(u._id), role: u.role }) });

async function call(method, path, { user, body, raw, headers = {} } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { ...(raw ? {} : { "content-type": "application/json" }), ...(user ? asUser(user) : {}), ...headers },
    body: raw !== undefined ? raw : body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* html or empty */ }
  return { status: res.status, body: json, text, headers: res.headers };
}

const API = "/api/admin/email-marketing";

describe("Email Marketing routes (real routers, in-memory MongoDB, fake SES)", () => {
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([User.init(), Mailbox.init(), MarketingRecipient.init(), MarketingSuppression.init(), MarketingLink.init()]);

    const app = express();
    app.use("/api/u", require("../routes/publicUnsubscribe").create({ cfg: () => cfg, limitPerMinute: 1000 }));
    app.post("/api/ses/events", express.text({ type: "*/*" }), require("../routes/publicSesEvents").create({
      cfg: () => cfg, verify: snsVerifyFake, confirm: async (m) => { confirmed.push(m.Type); }, limitPerMinute: 1000,
    }));
    app.use(express.json({ limit: "3mb" }));
    app.use(API, require("../routes/adminEmailMarketing").create({
      auth: [fakeAuth, adminOnly], gate: [marketingEnabledGate(() => cfg), requireMarketingAccess()], sender, cfg: () => cfg, testLimiter: (req, res, next) => next(),
    }));
    app.use("/api/superadmin/email-marketing", require("../routes/superadminEmailMarketing").create({ guard: [fakeAuth, superAdminOnly, marketingEnabledGate(() => cfg)] }));
    app.use("/api/superadmin/email/mailboxes", require("../routes/superadminMailboxes").create({ guard: [fakeAuth, superAdminOnly], check: async () => ({ ok: true }) }));
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Mailbox.deleteMany({}), EmailMessage.deleteMany({}), EmailTrackingOptOut.deleteMany({}),
      MarketingCampaign.deleteMany({}), MarketingRecipient.deleteMany({}), MarketingLink.deleteMany({}), MarketingEvent.deleteMany({}), MarketingSuppression.deleteMany({})]);
    cfg.enabled = true;
    sender.calls.length = 0;
    confirmed.length = 0;
    const mk = (role, extra = {}) => User.create({ name: `${role} person`, email: `${role}${Math.random().toString(36).slice(2)}@example.com`, role, ...extra });
    users = {
      superadmin: await mk("superadmin"),
      adminYes: await mk("admin", { emailMarketingAccess: true, name: "Shifa Kazi" }),
      adminNo: await mk("admin"),
      user: await mk("user"),
      doctor: await mk("doctor"),
      partner: await mk("partner"),
      payment: await mk("paymentadmin"),
      employee: await mk("employeeadmin"),
    };
    boxes = {
      marketing: await Mailbox.create({ address: "strategicalliance@humancareconnect.co", displayName: "Humancare Connect Strategic Alliance", allowedForMarketing: true }),
      support: await Mailbox.create({ address: "support@humancareconnect.co", displayName: "Support" }),
    };
  });

  describe("access", () => {
    test("only a Super Admin, or an admin a Super Admin switched on, gets in; everyone else is refused", async () => {
      assert.equal((await call("GET", `${API}/campaigns`)).status, 401);
      for (const who of ["user", "doctor", "partner", "payment", "employee"]) {
        assert.equal((await call("GET", `${API}/campaigns`, { user: users[who] })).status, 403, who);
        assert.equal((await call("GET", `${API}/access`, { user: users[who] })).status, 403, who);
      }
      assert.equal((await call("GET", `${API}/campaigns`, { user: users.adminNo })).status, 403);
      assert.equal((await call("GET", `${API}/campaigns`, { user: users.adminYes })).status, 200);
      assert.equal((await call("GET", `${API}/campaigns`, { user: users.superadmin })).status, 200);
      assert.deepEqual((await call("GET", `${API}/access`, { user: users.adminNo })).body, { enabled: true, allowed: false, superAdmin: false });
      assert.deepEqual((await call("GET", `${API}/access`, { user: users.adminYes })).body, { enabled: true, allowed: true, superAdmin: false });
      assert.deepEqual((await call("GET", `${API}/access`, { user: users.superadmin })).body, { enabled: true, allowed: true, superAdmin: true });
    });

    test("removing an admin's access takes effect at once; a disabled admin never gets in", async () => {
      assert.equal((await call("GET", `${API}/campaigns`, { user: users.adminYes })).status, 200);
      await User.updateOne({ _id: users.adminYes._id }, { emailMarketingAccess: false });
      assert.equal((await call("GET", `${API}/campaigns`, { user: users.adminYes })).status, 403);
      await User.updateOne({ _id: users.adminYes._id }, { emailMarketingAccess: true, accountDisabled: true });
      assert.equal((await call("GET", `${API}/campaigns`, { user: users.adminYes })).status, 403);
    });

    test("with MARKETING_ENABLED off the API does not exist (404) but /access still answers 'not allowed'", async () => {
      cfg.enabled = false;
      assert.equal((await call("GET", `${API}/campaigns`, { user: users.superadmin })).status, 404);
      assert.equal((await call("POST", `${API}/campaigns`, { user: users.superadmin, body: {} })).status, 404);
      assert.deepEqual((await call("GET", `${API}/access`, { user: users.superadmin })).body, { enabled: false, allowed: false, superAdmin: true });
      assert.equal((await call("GET", "/api/superadmin/email-marketing/admins", { user: users.superadmin })).status, 404);
    });

    test("Super Admin gives and removes access for individual admins; only plain admins can be switched", async () => {
      const list = await call("GET", "/api/superadmin/email-marketing/admins", { user: users.superadmin });
      assert.equal(list.status, 200);
      assert.deepEqual(list.body.admins.map((a) => [a.name, a.allowed]).sort(), [["Shifa Kazi", true], ["admin person", false]].sort());
      assert.equal((await call("GET", "/api/superadmin/email-marketing/admins", { user: users.adminYes })).status, 403);
      assert.equal((await call("PATCH", `/api/superadmin/email-marketing/admins/${users.adminNo._id}`, { user: users.adminYes, body: { allowed: true } })).status, 403);

      const on = await call("PATCH", `/api/superadmin/email-marketing/admins/${users.adminNo._id}`, { user: users.superadmin, body: { allowed: true } });
      assert.equal(on.body.admin.allowed, true);
      assert.equal((await call("GET", `${API}/campaigns`, { user: users.adminNo })).status, 200);
      await call("PATCH", `/api/superadmin/email-marketing/admins/${users.adminNo._id}`, { user: users.superadmin, body: { allowed: false } });
      assert.equal((await call("GET", `${API}/campaigns`, { user: users.adminNo })).status, 403);

      assert.equal((await call("PATCH", `/api/superadmin/email-marketing/admins/${users.adminNo._id}`, { user: users.superadmin, body: { allowed: "yes" } })).status, 400);
      for (const who of ["user", "doctor", "superadmin"]) {
        assert.equal((await call("PATCH", `/api/superadmin/email-marketing/admins/${users[who]._id}`, { user: users.superadmin, body: { allowed: true } })).status, 404, who);
      }
      assert.equal(Boolean((await User.findById(users.user._id)).emailMarketingAccess), false);
    });
  });

  describe("Mail IDs", () => {
    test("'Allowed for marketing' is off by default, switched by a Super Admin only, and only allowed Mail IDs can send", async () => {
      const list = await call("GET", "/api/superadmin/email/mailboxes", { user: users.superadmin });
      const byAddr = Object.fromEntries(list.body.mailboxes.map((m) => [m.address, m.allowedForMarketing]));
      assert.deepEqual(byAddr, { "strategicalliance@humancareconnect.co": true, "support@humancareconnect.co": false });

      const mine = await call("GET", `${API}/mailboxes`, { user: users.adminYes });
      assert.deepEqual(mine.body.mailboxes.map((m) => m.address), ["strategicalliance@humancareconnect.co"]);
      assert.equal((await call("POST", `${API}/campaigns`, { user: users.adminYes, body: { name: "X", mailboxId: String(boxes.support._id) } })).status, 400);

      const bad = await call("PATCH", `/api/superadmin/email/mailboxes/${boxes.support._id}`, { user: users.superadmin, body: { allowedForMarketing: "yes" } });
      assert.equal(bad.status, 400);
      const on = await call("PATCH", `/api/superadmin/email/mailboxes/${boxes.support._id}`, { user: users.superadmin, body: { allowedForMarketing: true } });
      assert.equal(on.body.mailbox.allowedForMarketing, true);
      assert.equal((await call("GET", `${API}/mailboxes`, { user: users.adminYes })).body.mailboxes.length, 2);
      assert.equal((await call("PATCH", `/api/superadmin/email/mailboxes/${boxes.support._id}`, { user: users.adminYes, body: { allowedForMarketing: false } })).status, 403);
    });
  });

  describe("a whole campaign", () => {
    test("create, preview, test, send, track, report: every step through the real routes", async () => {
      const admin = users.adminYes;
      const created = await call("POST", `${API}/campaigns`, { user: admin, body: { name: "Corporate wellness", mailboxId: String(boxes.marketing._id) } });
      assert.equal(created.status, 201);
      const id = created.body.campaign.id;
      assert.equal(created.body.campaign.status, "draft");

      const dry = await call("POST", `${API}/recipients/preview`, { user: admin, body: { mode: "lines", text: "Anil, anil@example.com\nbad\nPriya, Acme, priya@example.com\nANIL@example.com" } });
      assert.equal(dry.body.willReceive, 2);
      assert.equal(dry.body.invalidCount, 1);
      assert.equal(dry.body.duplicates, 1);
      assert.equal(await MarketingRecipient.countDocuments({}), 0, "a dry run saves nothing");

      const put = await call("PUT", `${API}/campaigns/${id}`, {
        user: admin,
        body: { subject: "Hello {{name}}", html: '<p>Hi {{name}} at {{company}}</p><a href="https://humancareconnect.co">Learn</a><script>x()</script>', fallbackName: "friend", recipients: { mode: "lines", text: "Anil, anil@example.com\nPriya, Acme, priya@example.com\nno-name@example.com" } },
      });
      assert.equal(put.status, 200);
      assert.equal(put.body.recipients.willReceive, 3);
      assert.doesNotMatch(put.body.campaign.html, /<script/);

      const pv = await call("POST", `${API}/campaigns/${id}/preview`, { user: admin, body: { index: 2 } });
      assert.equal(pv.body.recipient.email, "no-name@example.com");
      assert.equal(pv.body.subject, "Hello friend");

      assert.equal((await call("POST", `${API}/campaigns/${id}/test`, { user: admin, body: { to: "nope" } })).status, 400);
      assert.equal((await call("POST", `${API}/campaigns/${id}/test`, { user: admin, body: { to: "me@humancareconnect.co" } })).status, 200);
      assert.equal(sender.calls.length, 1);
      assert.match(sender.calls[0].subject, /^\[Test\] Hello Anil/);

      assert.equal((await call("POST", `${API}/campaigns/${id}/send`, { user: admin, body: { confirm: false } })).status, 400);
      const sent = await call("POST", `${API}/campaigns/${id}/send`, { user: admin, body: { confirm: true } });
      assert.equal(sent.status, 200);
      assert.equal(sent.body.progress.total, 3);
      assert.equal((await call("POST", `${API}/campaigns/${id}/send`, { user: admin, body: { confirm: true } })).status, 409);
      assert.equal((await call("PUT", `${API}/campaigns/${id}`, { user: admin, body: { name: "later" } })).status, 409);
      const stored = await MarketingCampaign.findById(id);
      assert.equal(stored.sentByName, "Shifa Kazi");
      assert.equal(String(stored.createdBy), String(admin._id));

      // The server-side queue does the sending (here driven by hand, with the fake SES).
      sender.calls.length = 0;
      const queue = createMarketingQueue({ sender, cfg, sleep: async () => {}, trackingState: async () => ({ active: true, linksActive: true, baseUrl: "https://h.example" }), log: { warn() {}, error() {}, log() {} } });
      await queue.runOnce();
      assert.equal(sender.calls.length, 3);
      const progress = await call("GET", `${API}/campaigns/${id}/progress`, { user: admin });
      assert.equal(progress.body.progress.sent, 3);
      assert.equal(progress.body.progress.remaining, 0);
      assert.equal(progress.body.progress.status, "sent");

      // SES says: delivered to all, one bounced for good, one complained later.
      const apply = (eventType, extra, n) => call("POST", "/api/ses/events", { raw: JSON.stringify({ Type: "Notification", Signature: "valid", TopicArn: TOPIC, Message: JSON.stringify({ eventType, mail: { messageId: `ses-${n}` }, ...extra }) }), headers: { "content-type": "text/plain" } });
      // ids on the fake sender are ses-1..3 for the test mail + 3 real sends: the real ones are ses-2..4
      const ids = (await MarketingRecipient.find({ campaign: id }).sort({ _id: 1 }).lean()).map((r) => r.sesMessageId);
      assert.equal(ids.length, 3);
      const n = (i) => Number(ids[i].split("-")[1]);
      await apply("Delivery", { delivery: { timestamp: "2026-11-19T10:00:00Z" } }, n(0));
      await apply("Delivery", { delivery: {} }, n(1));
      await apply("Bounce", { bounce: { bounceType: "Permanent", bouncedRecipients: [{ emailAddress: "no-name@example.com" }] } }, n(2));
      await apply("Complaint", { complaint: { complainedRecipients: [{ emailAddress: "anil@example.com" }] } }, n(0));

      // A person opens and clicks (counted: sent long ago, a normal browser).
      const rec = await MarketingRecipient.findOne({ email: "priya@example.com" });
      await MarketingRecipient.updateOne({ _id: rec._id }, { $set: { sentAt: new Date(Date.now() - 3600_000) } });
      const tokenOf = (html, re) => html.match(re)[1];
      const mail = sender.calls.find((c) => c.to === "priya@example.com");
      const openTok = tokenOf(mail.html, /api\/e\/([A-Za-z0-9_-]{32})\.gif/);
      const linkTok = tokenOf(mail.html, /api\/l\/([A-Za-z0-9_-]{32})/);
      const UA = "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0 Safari/537.36";
      const state = { active: true, linksActive: true };
      assert.equal((await recordOpenAny({ token: openTok, ip: "203.0.113.5", userAgent: UA }, { state })).counted, true);
      assert.equal((await recordClickAny({ token: linkTok, ip: "203.0.113.5", userAgent: UA }, { state })).counted, true);
      assert.equal((await findLinkAny(linkTok)).url, "https://humancareconnect.co", "stored exactly as the admin wrote it");

      // A reply to Priya's mail arrives in the Mail ID's Gmail and is stored by the existing sync.
      await EmailMessage.collection.insertOne({
        mailbox: boxes.marketing._id, direction: "in", from: { name: "Priya", address: "priya@example.com" }, messageDate: new Date(Date.now() + 1000),
        inReplyTo: `<${rec.sesMessageId ? rec.sesMessageId : (await MarketingRecipient.findById(rec._id)).sesMessageId}@ap-south-1.amazonses.com>`, references: [], isSpam: false,
      });

      const report = await call("GET", `${API}/campaigns/${id}/report`, { user: admin });
      assert.equal(report.status, 200);
      const by = Object.fromEntries(report.body.people.map((p) => [p.email, p.status]));
      assert.deepEqual(by, { "anil@example.com": "complained", "priya@example.com": "replied", "no-name@example.com": "bounced" });
      assert.equal(report.body.counts.total, 3);
      assert.equal(report.body.counts.delivered, 2);
      assert.equal(report.body.counts.opened, 1);
      assert.equal(report.body.counts.clicked, 1);
      assert.equal(report.body.counts.replied, 1);
      assert.equal(report.body.counts.bounced, 1);
      assert.equal(report.body.counts.complained, 1);
      assert.equal(report.body.campaign.sentBy, "Shifa Kazi");

      const list = await call("GET", `${API}/campaigns`, { user: admin });
      assert.equal(list.body.campaigns[0].counts.total, 3);
      assert.equal(list.body.campaigns[0].status, "sent");
      assert.equal(await MarketingSuppression.countDocuments({ email: { $in: ["anil@example.com", "no-name@example.com"] } }), 2, "bounce and complaint reach the suppression list");
    });

    test("Stop sending and Retry uncertain work through the API; drafts can be reopened and deleted", async () => {
      const admin = users.superadmin;
      const mk = async (text) => {
        const c = (await call("POST", `${API}/campaigns`, { user: admin, body: { name: "C", mailboxId: String(boxes.marketing._id) } })).body.campaign;
        await call("PUT", `${API}/campaigns/${c.id}`, { user: admin, body: { subject: "S", html: "<p>x</p>", recipients: { mode: "emails", text } } });
        return c.id;
      };
      const id = await mk("a@example.com, b@example.com");
      const reopened = await call("GET", `${API}/campaigns/${id}`, { user: admin });
      assert.equal(reopened.body.campaign.recipientsText, "a@example.com\nb@example.com");
      assert.equal(reopened.body.campaign.status, "draft");

      assert.equal((await call("POST", `${API}/campaigns/${id}/stop`, { user: admin })).status, 409);
      await call("POST", `${API}/campaigns/${id}/send`, { user: admin, body: { confirm: true } });
      const stopped = await call("POST", `${API}/campaigns/${id}/stop`, { user: admin });
      assert.equal(stopped.body.campaign.status, "stopped");
      assert.equal(stopped.body.progress.skipped, 2);

      await MarketingRecipient.updateOne({ campaign: id }, { $set: { status: "uncertain" } });
      const retried = await call("POST", `${API}/campaigns/${id}/retry-uncertain`, { user: admin });
      assert.equal(retried.status, 409, "a stopped campaign is not restarted");

      const id2 = await mk("c@example.com");
      assert.equal((await call("DELETE", `${API}/campaigns/${id2}`, { user: admin })).status, 200);
      assert.equal(await MarketingCampaign.countDocuments({ _id: id2 }), 0);
      assert.equal(await MarketingRecipient.countDocuments({ campaign: id2 }), 0);
      assert.equal((await call("GET", `${API}/campaigns/${id2}`, { user: admin })).status, 404);
      assert.equal((await call("GET", `${API}/campaigns/not-an-id`, { user: admin })).status, 404);
    });
  });

  describe("unsubscribe page", () => {
    async function recipient(extra = {}) {
      const c = await MarketingCampaign.create({ name: "U", mailbox: boxes.marketing._id, fromAddress: boxes.marketing.address, subject: "s", html: "<p>x</p>", status: "sending", createdBy: users.superadmin._id });
      const r = await MarketingRecipient.create({ campaign: c._id, email: "leaving@example.com", name: "Leo", ...extra });
      return { c, r, path: `/api/u/${createUnsubscribeToken(r._id, SECRET)}` };
    }

    test("GET shows the page and unsubscribes nobody (scanners open links); POST unsubscribes", async () => {
      const { r, c, path } = await recipient();
      const queued = await MarketingRecipient.create({ campaign: c._id, email: "leaving@example.com".replace("leaving", "leaving2"), status: "queued" });
      const page = await call("GET", path);
      assert.equal(page.status, 200);
      assert.match(page.text, /<title>Unsubscribe from Humancare Connect emails<\/title>/);
      assert.match(page.text, /Click the button to stop receiving marketing emails from Humancare Connect\. You will still receive emails about your appointments and account\./);
      assert.match(page.text, /<button type="submit">Unsubscribe<\/button>/);
      assert.doesNotMatch(page.text, /leaving@example\.com/, "the address is not shown");
      assert.match(page.headers.get("content-security-policy"), /default-src 'none'/);
      assert.equal(await MarketingSuppression.countDocuments({}), 0);

      await MarketingRecipient.updateOne({ _id: queued._id }, { $set: { email: "leaving@example.com".replace("@", "+q@") } });
      const done = await call("POST", path, { raw: "", headers: { "content-type": "application/x-www-form-urlencoded" } });
      assert.equal(done.status, 200);
      assert.match(done.text, /You have been unsubscribed\. You will not receive marketing emails from us again\./);
      assert.equal((await MarketingSuppression.findOne({ email: "leaving@example.com" })).reason, "unsubscribe");
      assert.ok((await MarketingRecipient.findById(r._id)).unsubscribedAt);
      assert.equal((await call("POST", path, { raw: "", headers: { "content-type": "application/x-www-form-urlencoded" } })).status, 200, "idempotent");
      assert.equal(await MarketingSuppression.countDocuments({}), 1);
    });

    test("a queued mail to the same address, in any campaign, is skipped at once", async () => {
      const { c, path } = await recipient();
      const other = await MarketingCampaign.create({ name: "O", mailbox: boxes.marketing._id, fromAddress: boxes.marketing.address, subject: "s", html: "<p>x</p>", status: "sending", createdBy: users.superadmin._id });
      const waiting = await MarketingRecipient.create({ campaign: other._id, email: "leaving@example.com", status: "queued" });
      await call("POST", path, { raw: "", headers: { "content-type": "application/x-www-form-urlencoded" } });
      assert.equal((await MarketingRecipient.findById(waiting._id)).status, "skipped");
      assert.ok(c);
    });

    test("one-click (RFC 8058) POST from a mail app unsubscribes and answers 200 OK", async () => {
      const { path } = await recipient();
      const res = await call("POST", path, { raw: "List-Unsubscribe=One-Click", headers: { "content-type": "application/x-www-form-urlencoded" } });
      assert.equal(res.status, 200);
      assert.equal(res.text, "OK");
      assert.equal(await MarketingSuppression.countDocuments({ email: "leaving@example.com" }), 1);
    });

    test("a tampered, foreign or test link does nothing", async () => {
      const { r, path } = await recipient();
      for (const bad of [`${path}x`, `/api/u/${r._id}.${"A".repeat(43)}`, "/api/u/test", `/api/u/${createUnsubscribeToken(new mongoose.Types.ObjectId(), SECRET)}`]) {
        for (const method of ["GET", "POST"]) {
          const res = await call(method, bad, method === "POST" ? { raw: "", headers: { "content-type": "application/x-www-form-urlencoded" } } : {});
          assert.equal(res.status, 404, `${method} ${bad.slice(0, 20)}`);
        }
      }
      assert.equal(await MarketingSuppression.countDocuments({}), 0);
    });

    test("an old campaign whose personal data was removed says so instead of pretending", async () => {
      const { r, path } = await recipient();
      await MarketingRecipient.collection.updateOne({ _id: r._id }, { $unset: { email: "" }, $set: { purgedAt: new Date() } });
      const res = await call("POST", path, { raw: "", headers: { "content-type": "application/x-www-form-urlencoded" } });
      assert.equal(res.status, 410);
      assert.doesNotMatch(res.text, /You have been unsubscribed/);
    });
  });

  describe("SES events endpoint", () => {
    const post = (body) => call("POST", "/api/ses/events", { raw: typeof body === "string" ? body : JSON.stringify(body), headers: { "content-type": "text/plain" } });

    test("anything that is not a verified message for our topic is refused with no detail", async () => {
      assert.equal((await post("not json")).status, 403);
      assert.equal((await post({ Type: "Notification", Signature: "forged", TopicArn: TOPIC, Message: "{}" })).status, 403);
      const saved = cfg.snsTopicArn;
      cfg.snsTopicArn = "";
      assert.equal((await post({ Type: "Notification", Signature: "valid" })).status, 404);
      cfg.snsTopicArn = saved;
    });

    test("subscription confirmations are confirmed; notifications for unknown mail are accepted and ignored; a bounce suppresses and skips the queued", async () => {
      assert.equal((await post({ Type: "SubscriptionConfirmation", Signature: "valid", TopicArn: TOPIC })).status, 200);
      assert.deepEqual(confirmed, ["SubscriptionConfirmation"]);
      assert.equal((await post({ Type: "Notification", Signature: "valid", TopicArn: TOPIC, Message: JSON.stringify({ eventType: "Bounce", mail: { messageId: "unknown" }, bounce: { bounceType: "Permanent", bouncedRecipients: [{ emailAddress: "x@example.com" }] } }) })).status, 200);
      assert.equal(await MarketingSuppression.countDocuments({}), 0);

      const c = await MarketingCampaign.create({ name: "B", mailbox: boxes.marketing._id, fromAddress: boxes.marketing.address, subject: "s", html: "<p>x</p>", status: "sending", createdBy: users.superadmin._id });
      const sentRow = await MarketingRecipient.create({ campaign: c._id, email: "dead@example.com", status: "sent", sesMessageId: "m-1", sentAt: new Date() });
      const other = await MarketingCampaign.create({ name: "B2", mailbox: boxes.marketing._id, fromAddress: boxes.marketing.address, subject: "s", html: "<p>x</p>", status: "sending", createdBy: users.superadmin._id });
      const waiting = await MarketingRecipient.create({ campaign: other._id, email: "dead@example.com", status: "queued" });
      const event = { Type: "Notification", Signature: "valid", TopicArn: TOPIC, Message: JSON.stringify({ eventType: "Bounce", mail: { messageId: "m-1" }, bounce: { bounceType: "Permanent", bouncedRecipients: [{ emailAddress: "Dead@Example.com" }] } }) };
      assert.equal((await post(event)).status, 200);
      assert.equal((await post(event)).status, 200, "the same event twice is harmless");
      assert.equal((await MarketingRecipient.findById(sentRow._id)).status, "bounced");
      assert.equal((await MarketingSuppression.findOne({ email: "dead@example.com" })).reason, "bounce");
      assert.equal((await MarketingRecipient.findById(waiting._id)).status, "skipped");
    });

    test("a soft bounce is remembered but does not suppress; a late 'Delivery' never undoes a bounce", async () => {
      const c = await MarketingCampaign.create({ name: "S", mailbox: boxes.marketing._id, fromAddress: boxes.marketing.address, subject: "s", html: "<p>x</p>", status: "sent", createdBy: users.superadmin._id });
      const soft = await MarketingRecipient.create({ campaign: c._id, email: "full@example.com", status: "sent", sesMessageId: "m-soft", sentAt: new Date() });
      const hard = await MarketingRecipient.create({ campaign: c._id, email: "gone@example.com", status: "sent", sesMessageId: "m-hard", sentAt: new Date() });
      const ev = (eventType, id, extra = {}) => post({ Type: "Notification", Signature: "valid", TopicArn: TOPIC, Message: JSON.stringify({ eventType, mail: { messageId: id }, ...extra }) });
      await ev("Bounce", "m-soft", { bounce: { bounceType: "Transient", bouncedRecipients: [{ emailAddress: "full@example.com" }] } });
      assert.equal((await MarketingRecipient.findById(soft._id)).status, "sent");
      assert.equal(await MarketingSuppression.countDocuments({ email: "full@example.com" }), 0);
      await ev("Bounce", "m-hard", { bounce: { bounceType: "Permanent", bouncedRecipients: [{ emailAddress: "gone@example.com" }] } });
      await ev("Delivery", "m-hard", { delivery: {} });
      assert.equal((await MarketingRecipient.findById(hard._id)).status, "bounced");
    });
  });

  describe("open and click tracking of marketing mail", () => {
    async function trackedRecipient() {
      const c = await MarketingCampaign.create({ name: "T", mailbox: boxes.marketing._id, fromAddress: boxes.marketing.address, subject: "s", html: "<p>x</p>", status: "sent", createdBy: users.superadmin._id });
      const open = newToken();
      const link = newToken();
      const r = await MarketingRecipient.create({ campaign: c._id, email: "reader@example.com", status: "sent", sentAt: new Date(Date.now() - 3600_000), openTokenHash: open.hash });
      await MarketingLink.create({ recipient: r._id, campaign: c._id, index: 0, url: "https://example.com/offer", tokenHash: link.hash });
      return { r, open: open.token, link: link.token };
    }
    const UA = "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0 Safari/537.36";
    const state = { active: true, linksActive: true };

    test("a real open counts once inside the dedupe window; scanners, no-user-agent and the first seconds do not", async () => {
      const { r, open } = await trackedRecipient();
      assert.equal((await recordMarketingOpen({ token: open, ip: "203.0.113.5", userAgent: "" }, { state })).counted, false);
      assert.equal((await recordMarketingOpen({ token: open, ip: "203.0.113.5", userAgent: "curl/8.0" }, { state })).counted, false);
      assert.equal((await recordMarketingOpen({ token: open, ip: "203.0.113.5", userAgent: UA }, { state })).counted, true);
      assert.equal((await recordMarketingOpen({ token: open, ip: "203.0.113.5", userAgent: UA }, { state })).counted, false);
      const row = await MarketingRecipient.findById(r._id);
      assert.equal(row.openCount, 1);
      assert.ok(row.firstOpenedAt);
      assert.equal(await MarketingEvent.countDocuments({ recipient: r._id, kind: "open" }), 4);
      const events = await MarketingEvent.find({ recipient: r._id }).lean();
      assert.ok(events.every((e) => !("ip" in e)), "no IP address is stored");
    });

    test("Apple Mail Privacy Protection is counted apart from real opens", async () => {
      const { r, open } = await trackedRecipient();
      const res = await recordMarketingOpen({ token: open, ip: "17.58.1.1", userAgent: UA }, { state });
      assert.equal(res.counted, false);
      const row = await MarketingRecipient.findById(r._id);
      assert.equal(row.openCount, 0);
      assert.equal(row.appleOpenCount, 1);
    });

    test("a click counts; a scanner following every link is ignored; clicks stop being recorded for an opted-out address", async () => {
      const { r, link } = await trackedRecipient();
      assert.equal((await recordMarketingClick({ token: link, ip: "203.0.113.5", userAgent: UA }, { state })).counted, true);
      assert.equal((await recordMarketingClick({ token: link, ip: "203.0.113.5", userAgent: UA }, { state })).counted, false, "double click");
      assert.equal((await MarketingRecipient.findById(r._id)).clickCount, 1);
      await EmailTrackingOptOut.create({ address: "reader@example.com" });
      assert.equal((await recordMarketingClick({ token: link, ip: "203.0.113.5", userAgent: UA }, { state })).recorded, false);
      assert.equal((await recordMarketingOpen({ token: link, ip: "203.0.113.5", userAgent: UA }, { state })).recorded, false);
    });

    test("switched off: nothing is recorded, but the link still redirects", async () => {
      const { r, link } = await trackedRecipient();
      assert.equal((await recordMarketingClick({ token: link, ip: "203.0.113.5", userAgent: UA }, { state: { active: false, linksActive: false } })).recorded, false);
      assert.equal((await findLinkAny(link)).url, "https://example.com/offer");
      assert.equal((await MarketingRecipient.findById(r._id)).clickCount, 0);
    });

    test("the public routes ask the Email page first: its own tokens are unaffected, an unknown token falls through to marketing", async () => {
      const { open } = await trackedRecipient();
      // Not a token of the Email page, so the Email page answers "unknown_token" and marketing takes it.
      const viaBridge = await recordOpenAny({ token: open, ip: "203.0.113.5", userAgent: UA }, { state });
      assert.equal(viaBridge.recorded, true);
      // Garbage stays garbage on both sides.
      assert.equal((await recordOpenAny({ token: "nope", ip: "", userAgent: UA }, { state })).recorded, false);
      assert.equal(await findLinkAny("nope"), null);
      assert.equal(await findLinkAny(newToken().token), null);
    });
  });
});
