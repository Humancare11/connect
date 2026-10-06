const EmailMessage = require("../../models/EmailMessage");
const EmailOpenEvent = require("../../models/EmailOpenEvent");
const { getTrackingState, trackingEnv } = require("./emailSettings");
const { hashToken, isTokenShape } = require("./trackingToken");
const { classifyOpen, uaFamily } = require("./openClassifier");

// More stored events than this per mail per day is a script, not a person.
const MAX_EVENTS_PER_DAY = 200;
const DAY_MS = 24 * 3600 * 1000;

// Records one request for a tracking image. Called AFTER the image has been
// sent, so nothing here can slow the response or change it. Never throws for
// bad input; returns what happened (useful in tests, never shown to anyone).
//   { token, ip, userAgent }
// → { recorded: false, why } | { recorded: true, counted, reason }
async function recordOpen({ token, ip = "", userAgent = "" }, { now = new Date(), state, env = process.env } = {}) {
  if (!isTokenShape(token)) return { recorded: false, why: "bad_token" };

  // The Super Admin switch is honoured at hit time: turning tracking off stops recording at once.
  const current = state || (await getTrackingState({ env, now: now.getTime() }));
  if (!current.active) return { recorded: false, why: "tracking_off" };
  const cfg = trackingEnv(env);

  const message = await EmailMessage.findOne({ "tracking.tokenHash": hashToken(token), direction: "out" })
    .select("_id status messageDate")
    .lean();
  if (!message || message.status === "failed") return { recorded: false, why: "unknown_token" };

  const recent = await EmailOpenEvent.countDocuments({ message: message._id, at: { $gte: new Date(now.getTime() - DAY_MS) } });
  if (recent >= MAX_EVENTS_PER_DAY) return { recorded: false, why: "flood" };

  let verdict = classifyOpen({
    sentAt: message.messageDate,
    now,
    ip,
    userAgent,
    graceSeconds: cfg.graceSeconds,
    ignoreIps: cfg.ignoreIps,
  });

  if (verdict.counted) {
    // Atomic: only one of several simultaneous hits can win, and a repeat inside
    // the dedupe window (same client re-rendering the mail) is not counted again.
    const threshold = new Date(now.getTime() - cfg.dedupeMinutes * 60_000);
    const updated = await EmailMessage.findOneAndUpdate(
      { _id: message._id, $or: [{ "tracking.lastCountedAt": null }, { "tracking.lastCountedAt": { $lt: threshold } }] },
      {
        $inc: { "tracking.openCount": 1 },
        $set: { "tracking.lastOpenedAt": now, "tracking.lastCountedAt": now, "tracking.status": "opened", "tracking.unavailableReason": "" },
      },
      { returnDocument: "after" }
    );
    if (updated) {
      await EmailMessage.updateOne({ _id: message._id, "tracking.firstOpenedAt": null }, { $set: { "tracking.firstOpenedAt": now } });
    } else {
      verdict = { counted: false, reason: "duplicate", automated: false };
    }
  } else if (verdict.automated) {
    // Looks machine-made: until a real open shows up the honest answer is "only automatic loads seen".
    await EmailMessage.updateOne(
      { _id: message._id, "tracking.status": "pending" },
      { $set: { "tracking.status": "unavailable", "tracking.unavailableReason": "automated_only" } }
    );
  }

  await EmailOpenEvent.create({
    message: message._id,
    at: now,
    counted: verdict.counted,
    ignoreReason: verdict.reason,
    uaFamily: uaFamily(userAgent),
  });
  return { recorded: true, counted: verdict.counted, reason: verdict.reason };
}

module.exports = { recordOpen, MAX_EVENTS_PER_DAY };
