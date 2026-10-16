// Where a chat shows in the admin console. Computed from the time of the last real message (either side) every time, so
// no job writes a status and nothing can be lost:
//   active   activity in the last ACTIVE_WINDOW_MS (whether or not the visitor is online), or the chat is waiting in the
//            Queue (a patient waiting for an agent is never hidden)
//   recent   quiet for 10 minutes, but still today (India time): the "Recent (temp archive)" group of the chat pages
//   archive  last activity before today (India time): the Archive page
// A new message puts the chat back in "active" (same chat, same history). Trash is separate and manual.
const { istTodayStart, LIVECHAT_DAY_ZONE } = require("./istDay");

const ACTIVE_WINDOW_MS = 10 * 60_000;

// Time of the last visible patient / AI / agent message. Chats from before lastActivityAt existed use lastMessageAt.
const activityOf = (conv) => new Date(conv.lastActivityAt || conv.lastMessageAt || conv.startedAt || 0).getTime();

function bucketOf(conv, nowMs) {
  if (conv.mode === "trashed") return "trashed";
  const at = activityOf(conv);
  if (nowMs - at < ACTIVE_WINDOW_MS) return "active";
  if (conv.mode === "queue") return "active";
  return at >= istTodayStart(nowMs).getTime() ? "recent" : "archive";
}

// Mongo fragments on "last activity" (lastActivityAt when set, else lastMessageAt).
const activityGte = (date) => ({ $or: [{ lastActivityAt: { $gte: date } }, { lastActivityAt: null, lastMessageAt: { $gte: date } }] });
const activityLt = (date) => ({ $or: [{ lastActivityAt: { $lt: date } }, { lastActivityAt: null, lastMessageAt: { $lt: date } }] });
const activityIn = ({ $gte, $lt } = {}) => ({
  $and: [...($gte ? [activityGte($gte)] : []), ...($lt ? [activityLt($lt)] : [])],
});

module.exports = { ACTIVE_WINDOW_MS, LIVECHAT_DAY_ZONE, activityOf, bucketOf, activityGte, activityLt, activityIn };
