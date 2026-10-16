const EmailLink = require("../../models/EmailLink");
const EmailMessage = require("../../models/EmailMessage");
const EmailClickEvent = require("../../models/EmailClickEvent");
const { getTrackingState, trackingEnv } = require("./emailSettings");
const { hashToken, isTokenShape } = require("./trackingToken");
const { SCANNER_UA, uaFamily } = require("./openClassifier");
const { matchScanner } = require("./scannerLists");
const { ipMatches } = require("./ipRules");
const { anyOptedOut } = require("./optOuts");
const { logUnmatched } = require("./trackingDebug");

const MAX_EVENTS_PER_DAY = 200;
const DAY_MS = 24 * 3600 * 1000;
// The same link twice this fast is a double-click, not two clicks.
const CLICK_DEDUPE_MS = 10_000;

// Decides whether one request for a tracked link is a person clicking it.
// → { counted, reason, automated }
// Security scanners (Microsoft Safe Links, Mimecast, Proofpoint, Barracuda, …) often
// follow every link of a mail at delivery, so these are ignored: a request inside the
// grace window, a known scanner user agent or address, or no user agent at all.
// (HEAD requests never get here, and several different links hit within seconds
// is caught by the burst rule in recordClick.)
function classifyClick({ sentAt, now = new Date(), ip = "", userAgent = "", graceSeconds = 60, ignoreIps = [], scannerIps = [] }) {
  if (ignoreIps.length && ipMatches(ip, ignoreIps)) return { counted: false, reason: "own_ip", automated: false };
  const age = new Date(now).getTime() - new Date(sentAt).getTime();
  if (age < graceSeconds * 1000) return { counted: false, reason: "grace_window", automated: true };
  if (!String(userAgent || "").trim()) return { counted: false, reason: "no_user_agent", automated: true };
  const hit = matchScanner({ userAgent, ip, scannerIps });
  if (hit) return { counted: false, reason: `scanner_${hit.vendor}`, automated: true };
  if (SCANNER_UA.test(userAgent)) return { counted: false, reason: "scanner_ua", automated: true };
  return { counted: true, reason: "", automated: false };
}

// Looks a link up by token. → { url, linkId, messageId } | null
async function findLink(token) {
  if (!isTokenShape(token)) return null;
  const link = await EmailLink.findOne({ tokenHash: hashToken(token) }).select("_id message url").lean();
  return link ? { url: link.url, linkId: link._id, messageId: link.message } : null;
}

// Records one click on a tracked link. Called AFTER the visitor was redirected, so
// nothing here can slow or change the redirect. Never throws for bad input.
//   { token, ip, userAgent }
// → { recorded: false, why } | { recorded: true, counted, reason }
async function recordClick({ token, ip = "", userAgent = "" }, { now = new Date(), state, env = process.env, logger } = {}) {
  const link = await findLink(token);
  if (!link) return { recorded: false, why: "unknown_token" };

  // The redirect always works; only the recording follows the switches.
  const current = state || (await getTrackingState({ env, now: now.getTime() }));
  if (!current.linksActive) return { recorded: false, why: "links_off" };
  const cfg = trackingEnv(env);

  const message = await EmailMessage.findOne({ _id: link.messageId, direction: "out" }).select("_id status messageDate to cc").lean();
  if (!message || message.status === "failed") return { recorded: false, why: "unknown_token" };

  // Someone on the opt-out list (added after the mail went out) stops being recorded at once.
  if (await anyOptedOut([...(message.to || []), ...(message.cc || [])])) return { recorded: false, why: "opted_out" };

  const recent = await EmailClickEvent.countDocuments({ message: message._id, at: { $gte: new Date(now.getTime() - DAY_MS) } });
  if (recent >= MAX_EVENTS_PER_DAY) return { recorded: false, why: "flood" };

  let verdict = classifyClick({
    sentAt: message.messageDate,
    now,
    ip,
    userAgent,
    graceSeconds: cfg.graceSeconds,
    ignoreIps: cfg.ignoreIps,
    scannerIps: cfg.scannerIps,
  });

  if (verdict.counted) {
    const sameLink = await EmailClickEvent.exists({
      message: message._id,
      link: link.linkId,
      counted: true,
      at: { $gte: new Date(now.getTime() - CLICK_DEDUPE_MS) },
    });
    if (sameLink) verdict = { counted: false, reason: "duplicate", automated: false };
  }

  let retroIgnored = 0;
  if (verdict.counted) {
    // Burst rule: a scanner opens every link of a mail within seconds. If this click
    // makes N different links in S seconds, they are all a scanner, including the
    // earlier ones that looked fine on their own.
    const windowStart = new Date(now.getTime() - cfg.clickBurstSeconds * 1000);
    const others = await EmailClickEvent.distinct("link", { message: message._id, at: { $gte: windowStart }, link: { $ne: link.linkId } });
    if (others.length + 1 >= cfg.clickBurstLinks) {
      const res = await EmailClickEvent.updateMany(
        { message: message._id, counted: true, at: { $gte: windowStart } },
        { $set: { counted: false, ignoreReason: "scanner_burst" } }
      );
      retroIgnored = res.modifiedCount || 0;
      verdict = { counted: false, reason: "scanner_burst", automated: true };
    }
  }

  if (verdict.counted) {
    await EmailMessage.updateOne(
      { _id: message._id },
      { $inc: { "tracking.clickCount": 1 }, $set: { "tracking.lastClickedAt": now } }
    );
    await EmailMessage.updateOne({ _id: message._id, "tracking.firstClickedAt": null }, { $set: { "tracking.firstClickedAt": now } });
  } else if (retroIgnored) {
    await EmailMessage.updateOne({ _id: message._id }, { $inc: { "tracking.clickCount": -retroIgnored } });
    const kept = await EmailClickEvent.aggregate([
      { $match: { message: message._id, counted: true } },
      { $group: { _id: null, n: { $sum: 1 }, first: { $min: "$at" }, last: { $max: "$at" } } },
    ]);
    const k = kept[0];
    await EmailMessage.updateOne(
      { _id: message._id },
      k
        ? { $set: { "tracking.clickCount": k.n, "tracking.firstClickedAt": k.first, "tracking.lastClickedAt": k.last } }
        : { $set: { "tracking.clickCount": 0, "tracking.firstClickedAt": null, "tracking.lastClickedAt": null } }
    );
  }

  const family = uaFamily(userAgent);
  await EmailClickEvent.create({
    message: message._id,
    link: link.linkId,
    at: now,
    counted: verdict.counted,
    ignoreReason: verdict.reason,
    uaFamily: family,
  });
  logUnmatched({ kind: "click", ip, family, verdict }, { env, now: now.getTime(), ...(logger ? { logger } : {}) });
  return { recorded: true, counted: verdict.counted, reason: verdict.reason };
}

module.exports = { recordClick, classifyClick, findLink, MAX_EVENTS_PER_DAY, CLICK_DEDUPE_MS };
