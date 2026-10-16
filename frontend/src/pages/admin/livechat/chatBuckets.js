// Active / Recent / Archive for the admin chat lists. Same rules as backend/services/liveChat/buckets.js, computed from
// the time of the chat's last message (row.lastMessageAt) every few seconds, so a chat moves from Active to Recent on
// its own and a new message moves it back. The day is the India calendar day (Asia/Kolkata, fixed +05:30).
export const ACTIVE_WINDOW_MS = 10 * 60_000;
export const LIVECHAT_DAY_ZONE = "Asia/Kolkata";
const IST_OFFSET_MS = 5.5 * 3_600_000;
const DAY_MS = 86_400_000;

export const istDayStart = (ms) => Math.floor((ms + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS;
export const activityAt = (row) => new Date(row.lastMessageAt || row.startedAt || 0).getTime();

// "active" | "recent" | "archive". A chat waiting in the Queue is always active.
export function bucketOf(row, nowMs) {
  const at = activityAt(row);
  if (nowMs - at < ACTIVE_WINDOW_MS) return "active";
  if (row.mode === "queue") return "active";
  return at >= istDayStart(nowMs) ? "recent" : "archive";
}
