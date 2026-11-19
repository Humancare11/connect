const express = require("express");
const User = require("../models/User");
const MarketingCampaign = require("../models/MarketingCampaign");
const { verifyAdminToken, adminOnly } = require("../middleware/verifyToken");
const { hasMarketingAccess, marketingEnabledGate, requireMarketingAccess } = require("../middleware/marketingAccess");
const { marketingTestLimiter } = require("../middleware/rateLimiters");
const { marketingConfig } = require("../services/marketing/config");
const { createSesSender } = require("../services/marketing/sesSender");
const svc = require("../services/marketing/campaignService");
const { progressOf, buildReport, countsFor, countsOrEmpty } = require("../services/marketing/report");

// Email Marketing admin API. Super Admin, or an admin a Super Admin switched it on for. Nobody else gets past the
// guard, and while MARKETING_ENABLED is not "true" none of it exists (404) — except GET /access, which always
// answers so the sidebar knows whether to show the item.
//
// Recipient lists are personal data: they are only ever returned to an authorised admin, and nothing in this
// file logs an address, a name or any content.
//
// Options exist so tests can run without AWS or the real session layer:
//   auth    login middleware (default: verified admin session)
//   gate    access middleware (default: module on + allowed admin)
//   sender  { send() } for SES
//   cfg     () => settings
//   testLimiter  throttle for test mails
function createAdminEmailMarketingRouter({
  auth = [verifyAdminToken, adminOnly],
  gate = [marketingEnabledGate(), requireMarketingAccess()],
  sender = null,
  cfg = () => marketingConfig(),
  testLimiter = marketingTestLimiter,
  checkAccess = hasMarketingAccess,
} = {}) {
  const router = express.Router();
  let ses = sender;
  const getSender = () => ses || (ses = createSesSender({ cfg: cfg() }));

  const handle = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof svc.MarketingHttpError) return res.status(err.status).json({ msg: err.message, ...err.extra });
      console.error("[email-marketing]", req.method, req.route?.path || "", err?.name || "error");
      res.status(500).json({ msg: "Something went wrong. Please try again." });
    }
  };

  // The acting admin comes from the verified session, never from the request.
  const actorOf = async (req) => {
    const row = await User.findById(req.user.id).select("name").lean();
    return { id: req.user.id, name: row?.name || "", role: req.user.role };
  };

  router.get("/access", ...auth, handle(async (req, res) => {
    const enabled = cfg().enabled;
    res.json({ enabled, allowed: enabled && (await checkAccess(req.user)), superAdmin: req.user.role === "superadmin" });
  }));

  router.use(...auth, ...gate);

  router.get("/settings", handle(async (req, res) => {
    const c = cfg();
    res.json({ dailyCap: c.dailyCap, maxRecipients: c.maxRecipients, sendRatePerSecond: c.sendRatePerSecond });
  }));

  router.get("/mailboxes", handle(async (req, res) => {
    res.json({ mailboxes: await svc.listMailboxes(await actorOf(req)) });
  }));

  router.get("/campaigns", handle(async (req, res) => {
    res.json({ campaigns: await svc.listCampaigns() });
  }));

  router.post("/campaigns", handle(async (req, res) => {
    const actor = await actorOf(req);
    const campaign = await svc.createDraft({ actor, name: req.body?.name, mailboxId: req.body?.mailboxId });
    res.status(201).json({ campaign: await svc.draftView(campaign, cfg()) });
  }));

  // Dry run for the Recipients step. Saves nothing.
  router.post("/recipients/preview", handle(async (req, res) => {
    res.json(await svc.previewRecipients({ mode: req.body?.mode, text: req.body?.text }, cfg()));
  }));

  router.get("/campaigns/:id", handle(async (req, res) => {
    const campaign = await svc.loadCampaign(req.params.id);
    if (campaign.status === "draft") return res.json({ campaign: await svc.draftView(campaign, cfg()) });
    const counts = countsOrEmpty(await countsFor([campaign._id]), campaign._id);
    res.json({ campaign: svc.serializeCampaign(campaign, counts) });
  }));

  router.put("/campaigns/:id", handle(async (req, res) => {
    const actor = await actorOf(req);
    const campaign = await svc.loadCampaign(req.params.id);
    const { summary } = await svc.updateDraft({ campaign, actor, body: req.body, cfg: cfg() });
    res.json({ campaign: await svc.draftView(campaign, cfg()), recipients: summary });
  }));

  router.delete("/campaigns/:id", handle(async (req, res) => {
    await svc.deleteDraft(await svc.loadCampaign(req.params.id));
    res.json({ ok: true });
  }));

  router.post("/campaigns/:id/preview", handle(async (req, res) => {
    const campaign = await svc.loadCampaign(req.params.id);
    res.json(await svc.previewMail(campaign, Number(req.body?.index) || 0, cfg()));
  }));

  router.post("/campaigns/:id/test", testLimiter, handle(async (req, res) => {
    const campaign = await svc.loadCampaign(req.params.id);
    await svc.sendTest({ campaign, actor: await actorOf(req), to: req.body?.to, sender: getSender(), cfg: cfg() });
    res.json({ ok: true });
  }));

  router.post("/campaigns/:id/send", handle(async (req, res) => {
    const campaign = await svc.loadCampaign(req.params.id);
    const started = await svc.startCampaign({ campaign, actor: await actorOf(req), confirm: req.body?.confirm, cfg: cfg() });
    res.json({ campaign: svc.serializeCampaign(started), progress: await progressOf(started) });
  }));

  router.get("/campaigns/:id/progress", handle(async (req, res) => {
    const campaign = await svc.loadCampaign(req.params.id);
    res.json({ progress: await progressOf(campaign), estimate: svc.estimateOf((await progressOf(campaign)).total, cfg()) });
  }));

  router.post("/campaigns/:id/stop", handle(async (req, res) => {
    const stopped = await svc.stopCampaign(await svc.loadCampaign(req.params.id));
    res.json({ campaign: svc.serializeCampaign(stopped), progress: await progressOf(stopped) });
  }));

  router.post("/campaigns/:id/retry-uncertain", handle(async (req, res) => {
    const campaign = await svc.loadCampaign(req.params.id);
    const count = await svc.retryUncertain(campaign);
    const fresh = await MarketingCampaign.findById(campaign._id);
    res.json({ retried: count, progress: await progressOf(fresh) });
  }));

  router.get("/campaigns/:id/report", handle(async (req, res) => {
    const campaign = await svc.loadCampaign(req.params.id);
    if (campaign.status === "draft") throw new svc.MarketingHttpError(409, "This campaign has not been sent yet.");
    const report = await buildReport(campaign);
    res.json({ campaign: svc.serializeCampaign(campaign, report.counts), counts: report.counts, people: report.people });
  }));

  return router;
}

module.exports = createAdminEmailMarketingRouter();
module.exports.create = createAdminEmailMarketingRouter;
