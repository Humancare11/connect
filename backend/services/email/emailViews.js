const EmailMessage = require("../../models/EmailMessage");
const EmailView = require("../../models/EmailView");

// A refresh or a double-fired effect within this window is not a new "view".
const DEDUPE_WINDOW_MS = 60_000;

// Records that `actor` ({ id, name }) opened `message` (a lean/real EmailMessage).
// Every open is stored (append-only), the first one also stamps the message so
// list rows can show "first viewed by" without a join.
// The sender opening their own sent mail is not recorded (approved demo).
// → { recorded: boolean }
async function recordView(message, actor, { now = () => new Date() } = {}) {
  if (message.direction === "out" && message.sentByAdmin && String(message.sentByAdmin) === String(actor.id)) {
    return { recorded: false };
  }

  const at = now();

  // Atomic: only one admin can win "first viewer", even if two open at once.
  await EmailMessage.updateOne(
    { _id: message._id, firstViewedAt: null },
    { $set: { firstViewedBy: actor.id, firstViewedByName: actor.name, firstViewedAt: at } }
  );

  const recent = await EmailView.exists({
    message: message._id,
    admin: actor.id,
    viewedAt: { $gte: new Date(at.getTime() - DEDUPE_WINDOW_MS) },
  });
  if (recent) return { recorded: false };

  await EmailView.create({
    message: message._id,
    gmailThreadId: message.gmailThreadId || null,
    mailbox: message.mailbox,
    admin: actor.id,
    adminName: actor.name,
    viewedAt: at,
  });
  return { recorded: true };
}

// One entry per admin, in order of first view: when they first opened it, when
// they last did, and how many times.
async function summarizeViews(messageId) {
  const rows = await EmailView.aggregate([
    { $match: { message: messageId } },
    { $sort: { viewedAt: 1 } },
    {
      $group: {
        _id: "$admin",
        name: { $first: "$adminName" },
        firstAt: { $first: "$viewedAt" },
        lastAt: { $last: "$viewedAt" },
        count: { $sum: 1 },
      },
    },
    { $sort: { firstAt: 1 } },
  ]);
  return rows.map((r) => ({ admin: { id: String(r._id), name: r.name }, firstAt: r.firstAt, lastAt: r.lastAt, count: r.count }));
}

module.exports = { recordView, summarizeViews, DEDUPE_WINDOW_MS };
