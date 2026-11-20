const MarketingCampaign = require("../../models/MarketingCampaign");
const MarketingRecipient = require("../../models/MarketingRecipient");
const MarketingLink = require("../../models/MarketingLink");
const { getTrackingState } = require("../email/emailSettings");
const { newToken, trackingUrl } = require("../email/trackingToken");
const { newClickCode, ownSiteHosts, planLink, goUrl, marketingLinksOn } = require("./clickLinks");
const { marketingConfig } = require("./config");
const { renderMail, MAX_TRACKED_LINKS } = require("./render");
const { createUnsubscribeToken, unsubscribeUrl } = require("./unsubscribe");
const { isSuppressed } = require("./suppression");
const { classifySesError } = require("./sesSender");

// The sending queue, stored in MongoDB.
//   - one recipient row = one email. A row is claimed atomically (queued -> sending with a lease), so two
//     workers can never take the same one, and a restart simply carries on with what is still queued.
//   - AT MOST ONCE: SES SendEmail has no idempotency key, so a row found "sending" after its lease ran out
//     (the process died somewhere around the SES call) becomes "uncertain". It is never retried automatically;
//     an admin can press "Retry uncertain".
//   - throttled to SES_MAX_SEND_RATE per second, and to MARKETING_DAILY_CAP sent mails per UTC day
//     (the campaign waits and carries on the next day by itself).
//   - suppression is checked again right before every send.
//   - nothing here logs an address, a name or any content.

const RETRY_LIMIT = 3;
const HOLD_MS = 60_000;

const utcDayStart = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

function createMarketingQueue({
  sender,
  cfg = marketingConfig(),
  now = () => new Date(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  trackingState = () => getTrackingState(),
  log = console,
} = {}) {
  let lastSendAt = 0;
  let timer = null;
  let running = false;
  let active = false;

  async function recoverStuck() {
    const t = now();
    const res = await MarketingRecipient.updateMany(
      { status: "sending", lockedUntil: { $lt: t } },
      { $set: { status: "uncertain", errorCode: "interrupted", lockedUntil: null } }
    );
    return res.modifiedCount || 0;
  }

  const sentToday = () => MarketingRecipient.countDocuments({ sentAt: { $gte: utcDayStart(now()) } });

  async function pace() {
    const gap = 1000 / cfg.sendRatePerSecond;
    const wait = lastSendAt + gap - now().getTime();
    if (wait > 0) await sleep(wait);
    lastSendAt = now().getTime();
  }

  function claim(campaignId) {
    const t = now();
    return MarketingRecipient.findOneAndUpdate(
      { campaign: campaignId, status: "queued", $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: t } }] },
      { $set: { status: "sending", lockedUntil: new Date(t.getTime() + cfg.leaseSeconds * 1000) }, $inc: { attempts: 1 } },
      { sort: { _id: 1 }, returnDocument: "after" }
    );
  }

  async function finishIfDone(campaignId) {
    const open = await MarketingRecipient.countDocuments({ campaign: campaignId, status: { $in: ["queued", "sending"] } });
    if (open) return false;
    await MarketingCampaign.updateOne(
      { _id: campaignId, status: "sending" },
      { $set: { status: "sent", finishedAt: now(), holdReason: "", holdUntil: null } }
    );
    return true;
  }

  // → "sent" | "skipped" | "failed" | "uncertain" | "retry" | "hold"
  async function processOne(campaign, rec, state) {
    const mark = (set) => MarketingRecipient.updateOne({ _id: rec._id }, { $set: { lockedUntil: null, ...set } });

    if (await isSuppressed(rec.email)) {
      await mark({ status: "skipped", skipReason: "suppressed" });
      return "skipped";
    }

    let message;
    try {
      const token = createUnsubscribeToken(rec._id, cfg.unsubscribeSecret);
      const unsubUrl = unsubscribeUrl(cfg.baseUrl, token);

      const tracked = [];
      let pixelUrl = "";
      let openHash = "";
      if (state.active) {
        const t = newToken();
        pixelUrl = trackingUrl(state.baseUrl, t.token);
        openHash = t.hash;
      }
      // Click tracking for marketing is on whenever the env switches are (the Email page's own switch is not consulted).
      // Own-site links keep their real address plus ?r=<code>; other sites go through <base>/go/<code>.
      const hosts = ownSiteHosts({ baseUrl: state.baseUrl, extra: cfg.siteHosts });
      const trackLink = marketingLinksOn(state)
        ? (url) => {
            if (url.startsWith(`${state.baseUrl}/api/u/`)) return null; // never the unsubscribe link
            let entry = tracked.find((l) => l.url === url);
            if (!entry) {
              if (tracked.length >= MAX_TRACKED_LINKS) return null;
              const c = newClickCode();
              const plan = planLink(url, { hosts, code: c.code, goUrl: (code) => goUrl(state.baseUrl, code) });
              if (!plan) return null;
              entry = { url, hash: c.hash, out: plan.url, kind: plan.kind, index: tracked.length };
              tracked.push(entry);
            }
            return entry.out;
          }
        : null;

      message = {
        unsubUrl,
        mail: renderMail({ campaign, recipient: rec, footerAddress: cfg.footerAddress, unsubscribeUrl: unsubUrl, trackLink, pixelUrl }),
      };
      // The links and the open token must exist before the mail leaves, or a very fast click would find nothing.
      if (tracked.length) {
        await MarketingLink.insertMany(
          tracked.map((l) => ({ recipient: rec._id, campaign: campaign._id, index: l.index, url: l.url, tokenHash: l.hash, kind: l.kind }))
        );
      }
      if (openHash) await MarketingRecipient.updateOne({ _id: rec._id }, { $set: { openTokenHash: openHash } });
    } catch (err) {
      // Nothing has been sent yet, so this recipient can safely be marked failed.
      log.error("[marketing] could not prepare a mail:", err?.name || "error");
      await mark({ status: "failed", errorCode: "prepare_failed" });
      return "failed";
    }

    let result;
    try {
      result = await sender.send({
        fromAddress: campaign.fromAddress,
        fromName: campaign.fromName,
        to: rec.email,
        replyTo: campaign.fromAddress,
        subject: message.mail.subject,
        html: message.mail.html,
        text: message.mail.text,
        unsubscribeUrl: message.unsubUrl,
        tags: { campaign: String(campaign._id), recipient: String(rec._id) },
      });
    } catch (err) {
      const verdict = classifySesError(err);
      log.warn("[marketing] SES send failed:", verdict.code);
      if (verdict.kind === "retry" && rec.attempts < RETRY_LIMIT) {
        await mark({ status: "queued", errorCode: verdict.code, nextAttemptAt: new Date(now().getTime() + 30_000 * rec.attempts) });
        return "retry";
      }
      if (verdict.kind === "retry") {
        await mark({ status: "failed", errorCode: verdict.code });
        return "failed";
      }
      if (verdict.kind === "hold") {
        await mark({ status: "queued", errorCode: verdict.code, nextAttemptAt: null });
        await MarketingCampaign.updateOne(
          { _id: campaign._id },
          { $set: { holdReason: "ses_unavailable", holdUntil: new Date(now().getTime() + HOLD_MS) } }
        );
        return "hold";
      }
      if (verdict.kind === "fail") {
        await mark({ status: "failed", errorCode: verdict.code });
        return "failed";
      }
      await mark({ status: "uncertain", errorCode: verdict.code });
      return "uncertain";
    }

    // Only a row still "sending" becomes "sent": if this update is lost the row stays "sending" and is later
    // marked "uncertain", never sent a second time.
    await MarketingRecipient.updateOne(
      { _id: rec._id, status: "sending" },
      { $set: { status: "sent", sesMessageId: result.messageId, sentAt: now(), lockedUntil: null, errorCode: "", nextAttemptAt: null } }
    );
    return "sent";
  }

  // One pass over the running campaigns. maxSends keeps a pass short so a stop request is noticed quickly.
  async function runOnce({ maxSends = Infinity } = {}) {
    const summary = { sent: 0, skipped: 0, failed: 0, uncertain: 0, retry: 0, hold: 0, capReached: false };
    await recoverStuck();

    const t = now();
    const campaigns = await MarketingCampaign.find({
      status: "sending",
      $or: [{ holdUntil: null }, { holdUntil: { $lte: t } }],
    })
      .sort({ startedAt: 1 })
      .lean();
    if (!campaigns.length) return summary;

    const state = await trackingState();
    let remainingToday = cfg.dailyCap - (await sentToday());
    let sends = 0;

    for (const campaign of campaigns) {
      let holdThisCampaign = false;
      while (sends < maxSends && !holdThisCampaign) {
        const fresh = await MarketingCampaign.findById(campaign._id).select("status").lean();
        if (!fresh || fresh.status !== "sending") break; // stopped while we were working

        if (remainingToday <= 0) {
          summary.capReached = true;
          await MarketingCampaign.updateOne({ _id: campaign._id, holdReason: { $ne: "daily_cap" } }, { $set: { holdReason: "daily_cap" } });
          break;
        }

        const rec = await claim(campaign._id);
        if (!rec) {
          await finishIfDone(campaign._id);
          break;
        }
        await pace(); // the claimed row holds its lease meanwhile (MARKETING_LEASE_SECONDS is far longer than one gap)
        if (campaign.holdReason) {
          await MarketingCampaign.updateOne({ _id: campaign._id }, { $set: { holdReason: "", holdUntil: null } });
          campaign.holdReason = "";
        }

        const outcome = await processOne(campaign, rec, state);
        sends += 1;
        summary[outcome] = (summary[outcome] || 0) + 1;
        if (outcome === "sent") remainingToday -= 1;
        if (outcome === "hold") holdThisCampaign = true;
      }
      if (summary.capReached) break;
    }
    return summary;
  }

  function start() {
    if (active) return;
    active = true;
    const loop = async () => {
      running = true;
      try {
        await runOnce({ maxSends: Math.max(1, Math.ceil(cfg.sendRatePerSecond)) });
      } catch (err) {
        log.error("[marketing] queue pass failed:", err?.name || "error");
      } finally {
        running = false;
        if (active) {
          timer = setTimeout(loop, cfg.tickMs);
          if (timer.unref) timer.unref();
        }
      }
    };
    timer = setTimeout(loop, cfg.tickMs);
    if (timer.unref) timer.unref();
  }

  function stop() {
    active = false;
    if (timer) clearTimeout(timer);
    timer = null;
  }

  return { runOnce, recoverStuck, finishIfDone, start, stop };
}

module.exports = { createMarketingQueue, utcDayStart };
