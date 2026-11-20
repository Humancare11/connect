const MarketingRecipient = require("../../models/MarketingRecipient");
const MarketingLink = require("../../models/MarketingLink");
const MarketingEvent = require("../../models/MarketingEvent");
const EmailTrackingOptOut = require("../../models/EmailTrackingOptOut");
const { getTrackingState, trackingEnv } = require("../email/emailSettings");
const { hashToken, isTokenShape } = require("../email/trackingToken");
const { classifyOpen, uaFamily } = require("../email/openClassifier");
const { classifyClick } = require("../email/clickRecorder");
const { isCodeShape, hashCode, marketingLinksOn } = require("./clickLinks");

// Open and click tracking for marketing mail: the SAME rules, gates and classifiers as the Email page
// (grace window, scanner lists, Apple Mail Privacy Protection, second-hit rule, de-duplication, burst rule),
// only keyed by campaign recipient instead of an Email page message. The public /api/e and /api/l routes try
// the Email page first and fall back to these (see trackingBridge.js), so existing tokens behave as before.
//
// Called AFTER the image/redirect was answered, so nothing here can slow or change the response.
const DAY_MS = 24 * 3600 * 1000;
const MAX_EVENTS_PER_DAY = 200;
const CLICK_DEDUPE_MS = 10_000;

// The recipient may have asked the Email page never to be tracked; that list is honoured here as well.
const optedOut = async (email) => Boolean(email) && Boolean(await EmailTrackingOptOut.exists({ address: email }));

// Looks a marketing link up by token. → { url, linkId, recipientId, campaignId } | null
async function findMarketingLink(token) {
  if (!isTokenShape(token)) return null;
  const link = await MarketingLink.findOne({ tokenHash: hashToken(token) }).select("_id recipient campaign url").lean();
  return link ? { url: link.url, linkId: link._id, recipientId: link.recipient, campaignId: link.campaign, marketing: true } : null;
}

// Looks a short click code up (the ?r= code on our site, or /go/<code>). Same shape of answer as above.
async function findMarketingCode(code) {
  if (!isCodeShape(code)) return null;
  const link = await MarketingLink.findOne({ tokenHash: hashCode(code), kind: { $in: ["own", "go"] } }).select("_id recipient campaign url").lean();
  return link ? { url: link.url, linkId: link._id, recipientId: link.recipient, campaignId: link.campaign, marketing: true } : null;
}

async function recordMarketingOpen({ token, ip = "", userAgent = "" }, { now = new Date(), state, env = process.env } = {}) {
  if (!isTokenShape(token)) return { recorded: false, why: "bad_token" };
  const current = state || (await getTrackingState({ env, now: now.getTime() }));
  if (!current.active) return { recorded: false, why: "tracking_off" };
  const cfg = trackingEnv(env);

  const recipient = await MarketingRecipient.findOne({ openTokenHash: hashToken(token) })
    .select("_id campaign email sentAt status")
    .lean();
  if (!recipient || !recipient.sentAt) return { recorded: false, why: "unknown_token" };
  if (await optedOut(recipient.email)) return { recorded: false, why: "opted_out" };

  const recent = await MarketingEvent.countDocuments({ recipient: recipient._id, kind: "open", at: { $gte: new Date(now.getTime() - DAY_MS) } });
  if (recent >= MAX_EVENTS_PER_DAY) return { recorded: false, why: "flood" };

  let verdict = classifyOpen({
    sentAt: recipient.sentAt,
    now,
    ip,
    userAgent,
    graceSeconds: cfg.graceSeconds,
    ignoreIps: cfg.ignoreIps,
    scannerIps: cfg.scannerIps,
    appleIps: cfg.appleIps,
    allRecipientsApple: false,
  });

  // Second-hit rule: a scanner loads the image once at delivery; a later scanner-looking hit is more likely a person.
  if (verdict.scanner) {
    const earlier = await MarketingEvent.exists({
      recipient: recipient._id,
      kind: "open",
      ignoreReason: /^scanner_/,
      at: { $lte: new Date(now.getTime() - cfg.secondHitMinutes * 60_000) },
    });
    if (earlier) verdict = { counted: true, reason: "", automated: false, secondHit: true };
  }

  if (verdict.apple) {
    await MarketingRecipient.updateOne({ _id: recipient._id }, { $inc: { appleOpenCount: 1 } });
  } else if (verdict.counted) {
    const threshold = new Date(now.getTime() - cfg.dedupeMinutes * 60_000);
    const updated = await MarketingRecipient.findOneAndUpdate(
      { _id: recipient._id, $or: [{ lastCountedAt: null }, { lastCountedAt: { $lt: threshold } }] },
      { $inc: { openCount: 1 }, $set: { lastOpenedAt: now, lastCountedAt: now } },
      { returnDocument: "after" }
    );
    if (updated) await MarketingRecipient.updateOne({ _id: recipient._id, firstOpenedAt: null }, { $set: { firstOpenedAt: now } });
    else verdict = { counted: false, reason: "duplicate", automated: false };
  }

  await MarketingEvent.create({
    recipient: recipient._id,
    campaign: recipient.campaign,
    kind: "open",
    at: now,
    counted: Boolean(verdict.counted),
    ignoreReason: verdict.secondHit ? "second_hit" : verdict.reason || "",
    uaFamily: verdict.apple ? "ApplePrivacyProxy" : uaFamily(userAgent),
  });
  return { recorded: true, counted: Boolean(verdict.counted), reason: verdict.secondHit ? "second_hit" : verdict.reason || "" };
}

// `token`: the 32-character /api/l token (older mails) · `code`: the short ?r= / go code (current mails).
// Marketing clicks are recorded whenever the env switches are on; the Email page's link switch is not consulted.
async function recordMarketingClick({ token, code, ip = "", userAgent = "" }, { now = new Date(), env = process.env } = {}) {
  const link = code ? await findMarketingCode(code) : await findMarketingLink(token);
  if (!link) return { recorded: false, why: "unknown_token" };
  const cfg = trackingEnv(env);
  if (!marketingLinksOn(cfg)) return { recorded: false, why: "links_off" };

  const recipient = await MarketingRecipient.findById(link.recipientId).select("_id campaign email sentAt").lean();
  if (!recipient || !recipient.sentAt) return { recorded: false, why: "unknown_token" };
  if (await optedOut(recipient.email)) return { recorded: false, why: "opted_out" };

  const recent = await MarketingEvent.countDocuments({ recipient: recipient._id, kind: "click", at: { $gte: new Date(now.getTime() - DAY_MS) } });
  if (recent >= MAX_EVENTS_PER_DAY) return { recorded: false, why: "flood" };

  let verdict = classifyClick({
    sentAt: recipient.sentAt,
    now,
    ip,
    userAgent,
    graceSeconds: cfg.graceSeconds,
    ignoreIps: cfg.ignoreIps,
    scannerIps: cfg.scannerIps,
  });

  if (verdict.counted) {
    const sameLink = await MarketingEvent.exists({
      recipient: recipient._id,
      kind: "click",
      link: link.linkId,
      counted: true,
      at: { $gte: new Date(now.getTime() - CLICK_DEDUPE_MS) },
    });
    if (sameLink) verdict = { counted: false, reason: "duplicate", automated: false };
  }

  let retroIgnored = 0;
  if (verdict.counted) {
    // Burst rule: N different links within S seconds is a scanner, including the earlier clicks.
    const windowStart = new Date(now.getTime() - cfg.clickBurstSeconds * 1000);
    const others = await MarketingEvent.distinct("link", { recipient: recipient._id, kind: "click", at: { $gte: windowStart }, link: { $ne: link.linkId } });
    if (others.length + 1 >= cfg.clickBurstLinks) {
      const res = await MarketingEvent.updateMany(
        { recipient: recipient._id, kind: "click", counted: true, at: { $gte: windowStart } },
        { $set: { counted: false, ignoreReason: "scanner_burst" } }
      );
      retroIgnored = res.modifiedCount || 0;
      verdict = { counted: false, reason: "scanner_burst", automated: true };
    }
  }

  if (verdict.counted) {
    await MarketingRecipient.updateOne({ _id: recipient._id }, { $inc: { clickCount: 1 }, $set: { lastClickedAt: now } });
    await MarketingRecipient.updateOne({ _id: recipient._id, firstClickedAt: null }, { $set: { firstClickedAt: now } });
  } else if (retroIgnored) {
    const kept = await MarketingEvent.aggregate([
      { $match: { recipient: recipient._id, kind: "click", counted: true } },
      { $group: { _id: null, n: { $sum: 1 }, first: { $min: "$at" }, last: { $max: "$at" } } },
    ]);
    const k = kept[0];
    await MarketingRecipient.updateOne(
      { _id: recipient._id },
      k
        ? { $set: { clickCount: k.n, firstClickedAt: k.first, lastClickedAt: k.last } }
        : { $set: { clickCount: 0, firstClickedAt: null, lastClickedAt: null } }
    );
  }

  await MarketingEvent.create({
    recipient: recipient._id,
    campaign: recipient.campaign,
    kind: "click",
    link: link.linkId,
    at: now,
    counted: Boolean(verdict.counted),
    ignoreReason: verdict.reason || "",
    uaFamily: uaFamily(userAgent),
  });
  return { recorded: true, counted: Boolean(verdict.counted), reason: verdict.reason || "" };
}

module.exports = { findMarketingLink, findMarketingCode, recordMarketingOpen, recordMarketingClick };
