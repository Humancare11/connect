const EmailDownloadLink = require("../../models/EmailDownloadLink");
const EmailDownloadEvent = require("../../models/EmailDownloadEvent");
const EmailMessage = require("../../models/EmailMessage");
const { getTrackingState, trackingEnv } = require("./emailSettings");
const { hashToken, isTokenShape } = require("./trackingToken");
const { uaFamily } = require("./openClassifier");
const { classifyClick } = require("./clickRecorder");
const { anyOptedOut } = require("./optOuts");
const { logUnmatched } = require("./trackingDebug");

const MAX_EVENTS_PER_DAY = 200;
const DAY_MS = 24 * 3600 * 1000;
// The same file fetched twice this fast is a retry or a double-click, not two downloads.
const DOWNLOAD_DEDUPE_MS = 10_000;

// Looks a secure link up by token.
// → { linkId, messageId, attachmentId, expiresAt, expired } | null (unknown or malformed)
async function findDownloadLink(token, now = new Date()) {
  if (!isTokenShape(token)) return null;
  const link = await EmailDownloadLink.findOne({ tokenHash: hashToken(token) }).select("_id message attachment expiresAt").lean();
  if (!link) return null;
  return {
    linkId: link._id,
    messageId: link.message,
    attachmentId: link.attachment,
    expiresAt: link.expiresAt,
    expired: new Date(link.expiresAt).getTime() <= new Date(now).getTime(),
  };
}

// Records one fetch of a secure-link attachment. Called AFTER the file was sent, so
// nothing here can slow or change the download. Never throws for bad input.
// → { recorded: false, why } | { recorded: true, counted, reason }
//
// Security scanners (Microsoft Safe Attachments / Safe Links, Mimecast, Proofpoint,
// Barracuda, …) fetch files at delivery to scan them. They are served the file but not
// counted: a request inside the grace window, a known scanner user agent or address, no
// user agent, or our own address. HEAD requests never get here.
async function recordDownload({ token, ip = "", userAgent = "" }, { now = new Date(), state, env = process.env, logger } = {}) {
  const link = await findDownloadLink(token, now);
  if (!link) return { recorded: false, why: "unknown_token" };

  // Serving works whatever the switches say; only recording follows them.
  const current = state || (await getTrackingState({ env, now: now.getTime() }));
  if (!current.active) return { recorded: false, why: "tracking_off" };
  const cfg = trackingEnv(env);

  const message = await EmailMessage.findOne({ _id: link.messageId, direction: "out" }).select("_id status messageDate to cc").lean();
  if (!message || message.status === "failed") return { recorded: false, why: "unknown_token" };

  // A recipient who opted out since the mail went out stops being recorded at once.
  if (await anyOptedOut([...(message.to || []), ...(message.cc || [])])) return { recorded: false, why: "opted_out" };

  const recent = await EmailDownloadEvent.countDocuments({ message: message._id, at: { $gte: new Date(now.getTime() - DAY_MS) } });
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
    const again = await EmailDownloadEvent.exists({
      message: message._id,
      link: link.linkId,
      counted: true,
      at: { $gte: new Date(now.getTime() - DOWNLOAD_DEDUPE_MS) },
    });
    if (again) verdict = { counted: false, reason: "duplicate", automated: false };
  }

  if (verdict.counted) {
    await EmailMessage.updateOne(
      { _id: message._id },
      { $inc: { "tracking.downloadCount": 1 }, $set: { "tracking.lastDownloadedAt": now } }
    );
    await EmailMessage.updateOne({ _id: message._id, "tracking.firstDownloadedAt": null }, { $set: { "tracking.firstDownloadedAt": now } });
  }

  const family = uaFamily(userAgent);
  await EmailDownloadEvent.create({
    message: message._id,
    link: link.linkId,
    at: now,
    counted: verdict.counted,
    ignoreReason: verdict.reason,
    uaFamily: family,
  });
  logUnmatched({ kind: "download", ip, family, verdict }, { env, now: now.getTime(), ...(logger ? { logger } : {}) });
  return { recorded: true, counted: verdict.counted, reason: verdict.reason };
}

module.exports = { recordDownload, findDownloadLink, MAX_EVENTS_PER_DAY, DOWNLOAD_DEDUPE_MS };
