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
const EmailSignature = require("../models/EmailSignature");
const MarketingCampaign = require("../models/MarketingCampaign");
const MarketingRecipient = require("../models/MarketingRecipient");
const MarketingLink = require("../models/MarketingLink");
const MarketingEvent = require("../models/MarketingEvent");
const MarketingSignatureCopy = require("../models/MarketingSignatureCopy");
const { adminOnly } = require("../middleware/verifyToken");
const { marketingEnabledGate, requireMarketingAccess } = require("../middleware/marketingAccess");
const { marketingConfig } = require("../services/marketing/config");
const { createMarketingQueue } = require("../services/marketing/queue");
const { textToHtml } = require("../services/marketing/textToHtml");
const { sanitizeEmailHtml } = require("../services/marketing/sanitizer");
const { renderMail, signatureBlockHtml } = require("../services/marketing/render");
const sigSvc = require("../services/marketing/signature");
const svc = require("../services/marketing/campaignService");

const cfg = {
  ...marketingConfig({ MARKETING_ENABLED: "true", MARKETING_UNSUB_SECRET: "s".repeat(40), MARKETING_FOOTER_ADDRESS: "Humancare Connect, Inc.", SES_CONFIGURATION_SET: "cs", PUBLIC_TRACKING_BASE_URL: "https://h.example" }),
  sendRatePerSecond: 1000,
};
const STATE = { envEnabled: true, linksEnvEnabled: true, active: true, linksActive: true, baseUrl: "https://h.example" };

const IMG_A = Buffer.from("PNG-bytes-of-admin-A");
const IMG_B = Buffer.from("PNG-bytes-of-someone-else");

const sender = { calls: [], async send(a) { this.calls.push(a); return { messageId: `ses-${this.calls.length}` }; } };
const makeStore = () => {
  const objects = new Map();
  return {
    objects,
    async put(key, buf, mime) { objects.set(key, { buf, mime }); },
    async get(key) { if (!objects.has(key)) throw new Error("missing"); return objects.get(key).buf; },
    async remove(key) { objects.delete(key); },
  };
};
let store;

let mongod, server, base, users, box;
const fakeAuth = (req, res, next) => {
  const raw = req.headers["x-user"];
  if (!raw) return res.status(401).json({ msg: "Not signed in." });
  req.user = JSON.parse(raw);
  next();
};
const asUser = (u) => ({ "x-user": JSON.stringify({ id: String(u._id), role: u.role }) });
async function call(method, path, { user, body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(user ? asUser(user) : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const buf = Buffer.from(await res.arrayBuffer());
  let json = null;
  try { json = JSON.parse(buf.toString("utf8")); } catch { /* not json */ }
  return { status: res.status, body: json, bytes: buf, headers: res.headers };
}
const API = "/api/admin/email-marketing";
const giveSignature = async (user, buf, extra = {}) => {
  const key = `email-signature-images/${user._id}/x.png`;
  await store.put(key, buf, "image/png");
  await EmailSignature.create({ owner: user._id, image: { key, mime: "image/png", width: 840, height: 200, bytes: buf.length }, ...extra });
  return key;
};
const draft = async (user, patch = {}) => {
  const id = (await call("POST", `${API}/campaigns`, { user, body: { name: "C", mailboxId: String(box._id) } })).body.campaign.id;
  const put = await call("PUT", `${API}/campaigns/${id}`, {
    user,
    body: { subject: "Hi {{name}}", html: '<p>Hello {{name}}</p><a href="https://example.org/offer">Offer</a>', recipients: { mode: "lines", text: "Anil, anil@example.com" }, ...patch },
  });
  assert.equal(put.status, 200, JSON.stringify(put.body));
  return id;
};
const runQueue = async () => {
  sender.calls.length = 0;
  await createMarketingQueue({ sender, cfg, sleep: async () => {}, trackingState: async () => STATE, log: { warn() {}, error() {}, log() {} } }).runOnce();
  return sender.calls;
};

describe("Email Marketing: signature and Write text (real routers, in-memory MongoDB, fake SES and S3)", () => {
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([User.init(), Mailbox.init(), MarketingRecipient.init(), MarketingLink.init(), MarketingSignatureCopy.init()]);
    store = makeStore();
    const app = express();
    app.use("/api/m/sig", require("../routes/publicMarketingSignature").create({ store: { get: (k) => store.get(k) } }));
    app.use(express.json({ limit: "3mb" }));
    app.use(API, require("../routes/adminEmailMarketing").create({
      auth: [fakeAuth, adminOnly], gate: [marketingEnabledGate(() => cfg), requireMarketingAccess()], sender, cfg: () => cfg, testLimiter: (req, res, next) => next(), store: { put: (...a) => store.put(...a), get: (k) => store.get(k), remove: (k) => store.remove(k) },
    }));
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
    await Promise.all([User.deleteMany({}), Mailbox.deleteMany({}), EmailSignature.deleteMany({}), MarketingCampaign.deleteMany({}), MarketingRecipient.deleteMany({}),
      MarketingLink.deleteMany({}), MarketingEvent.deleteMany({}), MarketingSignatureCopy.deleteMany({})]);
    store = makeStore();
    sender.calls.length = 0;
    const mk = (name, role = "admin") => User.create({ name, email: `${name.replace(/\s/g, "")}${Math.random().toString(36).slice(2)}@example.com`, role, emailMarketingAccess: true });
    users = { a: await mk("Admin A"), b: await mk("Admin B"), c: await mk("Admin C") };
    box = await Mailbox.create({ address: "strategicalliance@humancareconnect.co", displayName: "Humancare", allowedForMarketing: true });
  });

  describe("Write text", () => {
    test("blank line = paragraph, single break = <br>, URLs become links, everything is escaped", () => {
      const html = textToHtml('Hi {{name}},\nline two\n\nSecond <b>para</b> & "quotes"\n   \nSee https://example.org/a?x=1&y=2.\nMail me (https://example.org/b).');
      assert.equal((html.match(/<p /g) || []).length, 3);
      assert.match(html, /Hi \{\{name\}\},<br>line two/);
      assert.match(html, /Second &lt;b&gt;para&lt;\/b&gt; &amp; &quot;quotes&quot;/);
      assert.doesNotMatch(html, /<b>/);
      assert.match(html, /<a href="https:\/\/example\.org\/a\?x=1&amp;y=2"[^>]*>https:\/\/example\.org\/a\?x=1&amp;y=2<\/a>\./, "trailing full stop stays outside the link");
      assert.match(html, /<a href="https:\/\/example\.org\/b"[^>]*>[^<]*<\/a>\)\./, "closing bracket stays outside the link");
      assert.match(html, /max-width:600px/);
      assert.match(html, /background:#ffffff/);
      assert.doesNotMatch(html, /#f4f6f8|#eef1f7|align="center"|<table/, "a personal email: no grey page, no centered card");
      assert.match(html, /font-size:15px;line-height:1\.6/);
      assert.match(html, /padding:16px 16px 0/);
      assert.match(html, /text-align:left/);
      assert.match(html, /<p style="margin:0 0 0px 0;">/, "the last paragraph has no bottom margin, so the signature sits 6px below it");
      assert.equal(textToHtml("   \n\n "), "");
    });

    test("typed markup and script are text, never HTML; javascript: is not linked", () => {
      const html = textToHtml('<script>alert(1)</script>\n<img src=x onerror=alert(1)>\njavascript:alert(1)');
      assert.doesNotMatch(html, /<script|<img/);
      assert.doesNotMatch(html, /<a /);
      const s = sanitizeEmailHtml(html);
      assert.equal(s.removed.scripts + s.removed.eventHandlers, 0, "it was only text, so there was nothing to strip");
      assert.doesNotMatch(s.html, /<script|<img/);
    });

    test("saved through the API: HTML made on the server, the browser's html is ignored, draft reopens as text", async () => {
      const id = await draft(users.a, { contentMode: "text", sourceText: "Hello {{name}},\n\nVisit https://example.org/x now.", html: "<script>evil()</script>" });
      const view = (await call("GET", `${API}/campaigns/${id}`, { user: users.a })).body.campaign;
      assert.equal(view.contentMode, "text");
      assert.equal(view.sourceText, "Hello {{name}},\n\nVisit https://example.org/x now.");
      assert.doesNotMatch(view.html, /evil/);
      assert.match(view.html, /Hello \{\{name\}\},/);
      assert.match(view.html, /href="https:\/\/example\.org\/x"/);
      // editing the text regenerates the HTML
      const again = await call("PUT", `${API}/campaigns/${id}`, { user: users.a, body: { sourceText: "Second version" } });
      assert.match(again.body.campaign.html, /Second version/);
      assert.doesNotMatch(again.body.campaign.html, /Hello/);
      // leaving the tab: html is whatever the browser sends, the typed text is dropped
      const out = await call("PUT", `${API}/campaigns/${id}`, { user: users.a, body: { contentMode: "paste", html: "<p>Own HTML</p>" } });
      assert.equal(out.body.campaign.contentMode, "paste");
      assert.equal(out.body.campaign.sourceText, "");
      assert.match(out.body.campaign.html, /Own HTML/);
      assert.equal((await call("PUT", `${API}/campaigns/${id}`, { user: users.a, body: { contentMode: "bogus" } })).status, 400);
      assert.equal((await call("PUT", `${API}/campaigns/${id}`, { user: users.a, body: { sourceText: 5 } })).status, 400);
    });

    test("the convert endpoint returns the same HTML and saves nothing", async () => {
      const r = await call("POST", `${API}/text-to-html`, { user: users.a, body: { text: "A\n\nB" } });
      assert.equal(r.status, 200);
      assert.equal(r.body.html, textToHtml("A\n\nB"));
      assert.equal((await call("POST", `${API}/text-to-html`, { user: users.a, body: { text: 4 } })).status, 400);
      assert.equal(await MarketingCampaign.countDocuments({}), 0);
    });

    test("placeholders are filled, links on typed URLs are click tracked, and the plain-text part is the typed text", async () => {
      const id = await draft(users.a, { contentMode: "text", sourceText: "Hello {{name}} from {{company}},\n\nRead https://example.org/offer and https://humancareconnect.co/blog" , recipients: { mode: "lines", text: "Anil, Acme, anil@example.com" } });
      await call("POST", `${API}/campaigns/${id}/send`, { user: users.a, body: { confirm: true } });
      const [mail] = await runQueue();
      assert.match(mail.html, /Hello Anil from Acme,/);
      assert.doesNotMatch(mail.html, /href="https:\/\/example\.org\/offer"/, "tracked, not the raw address");
      assert.match(mail.html, /href="https:\/\/h\.example\/go\/[A-Za-z0-9]+"/);
      assert.match(mail.html, /href="https:\/\/humancareconnect\.co\/blog\?r=[A-Za-z0-9]{10}"/);
      assert.equal(await MarketingLink.countDocuments({ campaign: id }), 2);
      assert.match(mail.text, /^Hello Anil from Acme,\n\nRead https:\/\/example\.org\/offer and https:\/\/humancareconnect\.co\/blog/);
      assert.doesNotMatch(mail.text, /<|\{\{/);
    });
  });

  describe("signature", () => {
    test("placement: after the content, before the footer, 420px with width/height, 6px gap, never a tracked link", async () => {
      await giveSignature(users.a, IMG_A);
      const id = await draft(users.a, { addSignature: true });
      await call("POST", `${API}/campaigns/${id}/send`, { user: users.a, body: { confirm: true } });
      const [mail] = await runQueue();
      const c = mail.html.indexOf("Hello Anil");
      const s = mail.html.indexOf("/api/m/sig/");
      const f = mail.html.indexOf("Unsubscribe");
      const p = mail.html.indexOf("/api/e/");
      assert.ok(c > -1 && s > c && f > s && p > f, "content < signature < footer < pixel");
      assert.match(mail.html, /<td align="left" style="padding-top:6px;"><img src="https:\/\/h\.example\/api\/m\/sig\/[A-Za-z0-9_-]{32}" alt="Signature" width="420" height="100"/);
      assert.match(mail.html, /<table role="presentation" width="600"[^>]*max-width:600px;width:100%;"><tr><td align="left"/, "centered 600px wrapper, left aligned inside it");
      assert.match(mail.html, /style="display:block;width:420px;max-width:100%;height:auto;border:0"/);
      assert.match(mail.html, /text-align:center;padding:14px 12px 22px/, "pasted designs keep the centered footer");
      const block = mail.html.slice(mail.html.lastIndexOf("<table", s), mail.html.indexOf("</table>", s));
      assert.doesNotMatch(block, /<a /);
      assert.doesNotMatch(mail.html, /cid:/);
      assert.doesNotMatch(mail.text, /api\/m\/sig/);
      assert.equal(await MarketingLink.countDocuments({ campaign: id, url: /m\/sig/ }), 0, "the signature URL is never a tracked link");
    });

    test("the sender is the logged-in admin, never anything from the request body", async () => {
      await giveSignature(users.a, IMG_A);
      await giveSignature(users.b, IMG_B);
      const id = await draft(users.a, { addSignature: true, signatureOwner: String(users.b._id), owner: String(users.b._id), signature: { token: "x", key: "email-signature-images/other" } });
      // Admin C (no signature of their own) presses Send on A's draft: C is the sender, so no signature at all.
      const sentByC = await call("POST", `${API}/campaigns/${id}/send`, { user: users.c, body: { confirm: true } });
      assert.equal(sentByC.status, 200);
      assert.equal((await MarketingCampaign.findById(id)).signature, null, "C has no signature, and A's or B's is not used");
      const id2 = await draft(users.a, { addSignature: true, signatureOwner: String(users.b._id) });
      await call("POST", `${API}/campaigns/${id2}/send`, { user: users.a, body: { confirm: true } });
      const c = await MarketingCampaign.findById(id2);
      assert.equal(c.signature.key.startsWith(`marketing-signatures/${id2}/`), true);
      assert.deepEqual(store.objects.get(c.signature.key).buf, IMG_A, "A sent it, so A's image");
    });

    test("snapshot: changing or deleting the admin's own signature later does not change a running or sent campaign", async () => {
      const original = await giveSignature(users.a, IMG_A);
      const id = await draft(users.a, { addSignature: true, recipients: { mode: "emails", text: "a@example.com, b@example.com" } });
      await call("POST", `${API}/campaigns/${id}/send`, { user: users.a, body: { confirm: true } });
      const snap = (await MarketingCampaign.findById(id)).signature;
      assert.notEqual(snap.key, original);
      // The admin replaces, then removes, their signature (what the My signature page does).
      await store.put(original, IMG_B, "image/png");
      await EmailSignature.updateOne({ owner: users.a._id }, { $set: { image: null } });
      await store.remove(original);
      const calls = await runQueue();
      assert.equal(calls.length, 2);
      for (const m of calls) assert.match(m.html, new RegExp(`/api/m/sig/${snap.token}`));
      const served = await call("GET", `/api/m/sig/${snap.token}`);
      assert.equal(served.status, 200);
      assert.deepEqual(served.bytes, IMG_A);
    });

    test("public route: right token serves the image, anything else is 404, and loading it is never an open or a click", async () => {
      await giveSignature(users.a, IMG_A);
      const id = await draft(users.a, { addSignature: true });
      await call("POST", `${API}/campaigns/${id}/send`, { user: users.a, body: { confirm: true } });
      await runQueue();
      const { token } = (await MarketingCampaign.findById(id)).signature;
      const before = await MarketingRecipient.findOne({ campaign: id }).lean();
      for (let i = 0; i < 3; i += 1) {
        const ok = await call("GET", `/api/m/sig/${token}`);
        assert.equal(ok.status, 200);
        assert.equal(ok.headers.get("content-type"), "image/png");
        assert.match(ok.headers.get("cache-control"), /public/);
      }
      assert.equal((await call("HEAD", `/api/m/sig/${token}`)).status, 200);
      assert.equal((await call("GET", `/api/m/sig/${"a".repeat(32)}`)).status, 404);
      assert.equal((await call("GET", `/api/m/sig/${token.slice(0, 31)}`)).status, 404);
      assert.equal((await call("GET", `/api/m/sig/not-a-token`)).status, 404);
      assert.equal((await call("GET", `/api/m/sig/${token}.png`)).status, 404);
      const after = await MarketingRecipient.findOne({ campaign: id }).lean();
      assert.equal(after.openCount, before.openCount);
      assert.equal(after.clickCount, before.clickCount);
      assert.equal(await MarketingEvent.countDocuments({}), 0);
    });

    test("test mail: a temporary hosted copy under marketing-signatures/test, gone after 7 days; real campaigns unaffected", async () => {
      await giveSignature(users.a, IMG_A);
      const id = await draft(users.a, { addSignature: true });
      const r = await call("POST", `${API}/campaigns/${id}/test`, { user: users.a, body: { to: "me@humancareconnect.co" } });
      assert.equal(r.status, 200);
      const html = sender.calls[0].html;
      const m = html.match(/https:\/\/h\.example\/api\/m\/sig\/([A-Za-z0-9_-]{32})/);
      assert.ok(m, "hosted URL in the test mail");
      assert.ok(html.indexOf("/api/m/sig/") < html.indexOf("Unsubscribe"));
      const copy = await MarketingSignatureCopy.findOne({}).lean();
      assert.match(copy.key, /^marketing-signatures\/test\/[0-9a-f]{24}\.png$/);
      const days = (copy.expiresAt - Date.now()) / 86400000;
      assert.ok(days > 6.9 && days <= 7.01);
      assert.notEqual(copy.tokenHash, m[1], "only a hash is stored");
      assert.equal((await call("GET", `/api/m/sig/${m[1]}`)).status, 200);
      assert.equal((await MarketingCampaign.findById(id)).signature, null, "a test never gives the campaign a copy");

      // not yet expired: the sweep leaves it
      assert.equal(await sigSvc.sweepExpiredTestCopies({ store: makeStore(), now: new Date(Date.now() + 6 * 86400000) }), 0);
      assert.ok(store.objects.has(copy.key));
      // 8 days later: the image is removed and the URL stops working
      const later = new Date(Date.now() + 8 * 86400000);
      assert.equal(await sigSvc.sweepExpiredTestCopies({ store, now: later }), 1);
      assert.equal(store.objects.has(copy.key), false);
      assert.equal((await MarketingSignatureCopy.findOne({}).lean()).removedAt.getTime(), later.getTime());
      assert.equal(await sigSvc.sweepExpiredTestCopies({ store, now: later }), 0);
      assert.equal(await sigSvc.findHostedByToken(m[1], later), null);
      // the TTL index drops the row itself 3 days after expiry
      const idx = (await MarketingSignatureCopy.collection.indexes()).find((i) => i.key.expiresAt === 1);
      assert.equal(idx.expireAfterSeconds, 3 * 24 * 3600);
    });

    test("ticked but no signature: sends without one, no error; Send step and checks say 'none', with a link", async () => {
      const id = await draft(users.c, { addSignature: true });
      const view = (await call("GET", `${API}/campaigns/${id}`, { user: users.c })).body.campaign;
      assert.equal(view.addSignature, true);
      assert.equal(view.hasSignatureImage, false);
      const pv = (await call("POST", `${API}/campaigns/${id}/preview`, { user: users.c, body: { index: 0 } })).body;
      const check = pv.checks.find((x) => x.key === "signature");
      assert.equal(check.ok, false);
      assert.equal(check.text, "Signature: none (you have no signature yet)");
      assert.equal(check.link.href, "/admin-dashboard/email/settings/my-signature");
      assert.doesNotMatch(pv.html, /<img[^>]*Signature/);
      assert.equal((await call("POST", `${API}/campaigns/${id}/test`, { user: users.c, body: { to: "me@humancareconnect.co" } })).status, 200);
      assert.doesNotMatch(sender.calls[0].html, /api\/m\/sig/);
      assert.equal((await call("POST", `${API}/campaigns/${id}/send`, { user: users.c, body: { confirm: true } })).status, 200);
      const [mail] = await runQueue();
      assert.doesNotMatch(mail.html, /api\/m\/sig/);
      assert.equal(store.objects.size, 0);
    });

    test("preview shows the signature inline (a draft has no public copy yet); unticked adds nothing", async () => {
      await giveSignature(users.a, IMG_A);
      const id = await draft(users.a, { addSignature: true });
      const on = (await call("POST", `${API}/campaigns/${id}/preview`, { user: users.a, body: { index: 0 } })).body;
      assert.match(on.html, /<img src="data:image\/png;base64,[^"]+" alt="Signature" width="420" height="100"/);
      assert.ok(on.html.indexOf("data:image/png") < on.html.indexOf("Unsubscribe"));
      assert.equal(on.checks.find((x) => x.key === "signature").ok, true);
      assert.equal(store.objects.size, 1, "no copy is made for a preview");
      await call("PUT", `${API}/campaigns/${id}`, { user: users.a, body: { addSignature: false } });
      const off = (await call("POST", `${API}/campaigns/${id}/preview`, { user: users.a, body: { index: 0 } })).body;
      assert.doesNotMatch(off.html, /Signature/);
      assert.equal(off.checks.find((x) => x.key === "signature"), undefined);
      assert.equal((await call("PUT", `${API}/campaigns/${id}`, { user: users.a, body: { addSignature: "yes" } })).status, 400);
    });

    test("GET /signature is the caller's own, with their automatic setting", async () => {
      assert.deepEqual((await call("GET", `${API}/signature`, { user: users.c })).body, { hasImage: false, autoAdd: true, previewUrl: null, displayWidth: 0, displayHeight: 0 });
      await giveSignature(users.a, IMG_A, { autoAdd: false });
      const a = (await call("GET", `${API}/signature`, { user: users.a })).body;
      assert.equal(a.hasImage, true);
      assert.equal(a.autoAdd, false);
      assert.equal(a.displayWidth, 420);
      assert.match(a.previewUrl, /^data:image\/png;base64,/);
      assert.equal((await call("GET", `${API}/signature`, { user: users.b })).body.hasImage, false, "never someone else's");
    });

    test("deleting a campaign removes its copy", async () => {
      const c = await MarketingCampaign.create({ name: "d", mailbox: box._id, fromAddress: "x@example.com", createdBy: users.a._id, signature: { token: "t".repeat(32), key: "marketing-signatures/zzz/a.png", mime: "image/png", width: 2, height: 1 } });
      await store.put("marketing-signatures/zzz/a.png", IMG_A, "image/png");
      await svc.deleteDraft(c, store);
      assert.equal(store.objects.size, 0);
      assert.equal(await MarketingCampaign.countDocuments({ _id: c._id }), 0);
    });

    test("a start that loses the race removes the copy it made", async () => {
      await giveSignature(users.a, IMG_A);
      const id = await draft(users.a, { addSignature: true });
      const stale = await MarketingCampaign.findById(id);
      await MarketingCampaign.updateOne({ _id: id }, { $set: { status: "sending" } });
      await assert.rejects(svc.startCampaign({ campaign: stale, actor: { id: users.a._id, name: "A" }, confirm: true, cfg, store }), /already been started/);
      assert.equal([...store.objects.keys()].filter((k) => k.startsWith("marketing-signatures/")).length, 0);
    });

    test("signatureBlockHtml escapes the URL", () => {
      assert.match(signatureBlockHtml({ url: 'https://h/x"y', width: 10, height: 5 }), /src="https:\/\/h\/x&quot;y"/);
      assert.match(signatureBlockHtml({ url: 'https://h/x"y', width: 10, height: 5 }, { layout: "text" }), /src="https:\/\/h\/x&quot;y"/);
    });

    test("Write text mail: white left-aligned column; signature right under the text in the same column; footer left in 600px", async () => {
      await giveSignature(users.a, IMG_A);
      const id = await draft(users.a, { contentMode: "text", sourceText: "Hi {{name}},\n\nThe end.", addSignature: true });
      await call("POST", `${API}/campaigns/${id}/send`, { user: users.a, body: { confirm: true } });
      const [mail] = await runQueue();
      const h = mail.html;
      const text = h.indexOf("The end.");
      const sig = h.indexOf("/api/m/sig/");
      const foot = h.indexOf("Unsubscribe");
      assert.ok(text > -1 && sig > text && foot > sig, "text < signature < footer");
      assert.match(h, /<body style="margin:0;padding:0;background:#ffffff;?">/);
      assert.doesNotMatch(h, /#f4f6f8|#eef1f7/);
      assert.match(h, /<div style="max-width:600px;padding:0 16px;"><div style="margin-top:6px"><img src="https:\/\/h\.example\/api\/m\/sig\//, "same 16px left edge as the text, 6px gap");
      assert.match(h, /width="420" height="100"/);
      assert.match(h, /text-align:left;max-width:600px;padding:18px 16px 24px;/, "footer left in the same 600px column");
      assert.doesNotMatch(h, /text-align:center/);
    });

    test("footer address is wrapped so Gmail leaves it as plain grey text; wording and unsubscribe link are unchanged", async () => {
      const id = await draft(users.a);
      await call("POST", `${API}/campaigns/${id}/send`, { user: users.a, body: { confirm: true } });
      const [mail] = await runQueue();
      assert.match(mail.html, /<a style="color:inherit;text-decoration:none;pointer-events:none;">Humancare Connect, Inc\.<\/a><br>You received this email from Humancare Connect\. <a href="https:\/\/h\.example\/api\/u\/[^"]+" style="color:#8a93a6;text-decoration:underline;">Unsubscribe<\/a>/);
      assert.match(mail.text, /Humancare Connect, Inc\.\nYou received this email from Humancare Connect\. Unsubscribe: https:\/\/h\.example\/api\/u\//);
      assert.equal(await MarketingLink.countDocuments({ campaign: id, url: /\/api\/u\// }), 0);
    });
  });
});
