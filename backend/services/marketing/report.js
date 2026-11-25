const mongoose = require("mongoose");
const MarketingRecipient = require("../../models/MarketingRecipient");
const EmailMessage = require("../../models/EmailMessage");

// Read side of Email Marketing: counts per campaign, live progress, and the per-recipient report.
// All numbers are computed from the recipient rows, so they can never drift from the truth.

const has = (field) => ({ $cond: [{ $ne: [{ $ifNull: [`$${field}`, null] }, null] }, 1, 0] });
const gt0 = (field) => ({ $cond: [{ $gt: [{ $ifNull: [`$${field}`, 0] }, 0] }, 1, 0] });
const is = (...statuses) => ({ $cond: [{ $in: ["$status", statuses] }, 1, 0] });

const GROUP = {
  total: { $sum: 1 },
  sent: { $sum: has("sentAt") },
  delivered: { $sum: has("deliveredAt") },
  opened: { $sum: gt0("openCount") },
  clicked: { $sum: gt0("clickCount") },
  replied: { $sum: has("repliedAt") },
  bounced: { $sum: is("bounced") },
  complained: { $sum: is("complained") },
  unsubscribed: { $sum: has("unsubscribedAt") },
  failed: { $sum: is("failed") },
  uncertain: { $sum: is("uncertain") },
  skipped: { $sum: is("skipped") },
  remaining: { $sum: is("queued", "sending") },
  appleOnly: { $sum: { $cond: [{ $and: [{ $gt: [{ $ifNull: ["$appleOpenCount", 0] }, 0] }, { $eq: [{ $ifNull: ["$openCount", 0] }, 0] }] }, 1, 0] } },
};

const EMPTY = Object.fromEntries(Object.keys(GROUP).map((k) => [k, 0]));

// → Map(campaignId string -> counts)
async function countsFor(campaignIds) {
  const ids = campaignIds.map((id) => new mongoose.Types.ObjectId(String(id)));
  if (!ids.length) return new Map();
  const rows = await MarketingRecipient.aggregate([{ $match: { campaign: { $in: ids } } }, { $group: { _id: "$campaign", ...GROUP } }]);
  const out = new Map();
  for (const r of rows) {
    const { _id, ...counts } = r;
    out.set(String(_id), counts);
  }
  return out;
}

const countsOrEmpty = (map, id) => map.get(String(id)) || { ...EMPTY };

// The status shown on a row of the report: what is most useful to read.
function displayStatus(r) {
  if (r.status === "bounced") return "bounced";
  if (r.status === "complained") return "complained";
  if (r.unsubscribedAt) return "unsub";
  if (r.repliedAt) return "replied";
  if (r.clickCount > 0) return "clicked";
  if (r.openCount > 0) return "opened";
  if (r.status === "delivered") return "delivered";
  return r.status; // sent | queued | sending | failed | uncertain | skipped
}

const latest = (...dates) => {
  const times = dates.filter(Boolean).map((d) => new Date(d).getTime());
  return times.length ? new Date(Math.max(...times)) : null;
};

// SES rewrites the Message-ID of what it sends; a reply carries that id in In-Reply-To / References, as
// <sesMessageId@...amazonses.com>. Matching on the part before "@" links a reply to its recipient.
const idsIn = (value) => [...String(value || "").matchAll(/<?([A-Za-z0-9._+=-]+)@[^>\s]*>?/g)].map((m) => m[1]);

// Marks recipients as replied from mail that arrived in the campaign's Mail ID since it started. Reads the Email
// page's own stored mail; changes nothing there. Best effort: a failure never breaks the report.
async function linkReplies(campaign) {
  if (!campaign.startedAt) return 0;
  const waiting = await MarketingRecipient.find({ campaign: campaign._id, sesMessageId: { $gt: "" }, repliedAt: null })
    .select("_id sesMessageId")
    .lean();
  if (!waiting.length) return 0;
  const byId = new Map(waiting.map((r) => [r.sesMessageId, r._id]));

  const inbound = await EmailMessage.find({
    mailbox: campaign.mailbox,
    direction: "in",
    isReceipt: { $ne: true },
    messageDate: { $gte: campaign.startedAt },
  })
    .select("messageDate inReplyTo references")
    .sort({ messageDate: -1 })
    .limit(5000)
    .lean();

  const firstReply = new Map();
  for (const m of inbound) {
    for (const id of [...idsIn(m.inReplyTo), ...(m.references || []).flatMap(idsIn)]) {
      const recipientId = byId.get(id);
      if (!recipientId) continue;
      const key = String(recipientId);
      const prev = firstReply.get(key);
      if (!prev || m.messageDate < prev.at) firstReply.set(key, { id: recipientId, at: m.messageDate });
    }
  }
  if (!firstReply.size) return 0;
  await MarketingRecipient.bulkWrite(
    [...firstReply.values()].map((r) => ({ updateOne: { filter: { _id: r.id, repliedAt: null }, update: { $set: { repliedAt: r.at } } } }))
  );
  return firstReply.size;
}

async function progressOf(campaign) {
  const counts = countsOrEmpty(await countsFor([campaign._id]), campaign._id);
  return {
    status: campaign.status,
    holdReason: campaign.holdReason || "",
    total: counts.total,
    sent: counts.sent,
    failed: counts.failed + counts.uncertain,
    uncertain: counts.uncertain,
    skipped: counts.skipped,
    remaining: counts.remaining,
  };
}

async function buildReport(campaign) {
  try {
    await linkReplies(campaign);
  } catch (err) {
    console.error("[marketing] reply linking failed:", err?.name || "error");
  }
  const [counts, rows] = await Promise.all([
    countsFor([campaign._id]).then((m) => countsOrEmpty(m, campaign._id)),
    MarketingRecipient.find({ campaign: campaign._id }).sort({ _id: 1 }).limit(5000).lean(),
  ]);
  return {
    counts,
    people: rows.map((r) => ({
      id: String(r._id),
      name: r.name || "",
      company: r.company || "",
      email: r.email || "",
      purged: Boolean(r.purgedAt),
      status: displayStatus(r),
      errorCode: r.errorCode || "",
      when: latest(r.repliedAt, r.lastClickedAt, r.lastOpenedAt, r.unsubscribedAt, r.bouncedAt, r.complainedAt, r.deliveredAt, r.sentAt),
    })),
  };
}

module.exports = { countsFor, countsOrEmpty, progressOf, buildReport, linkReplies, displayStatus, idsIn };
