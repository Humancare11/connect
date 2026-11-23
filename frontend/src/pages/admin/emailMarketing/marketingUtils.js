// Small pure helpers for the Email Marketing pages (kept free of React so they can be tested on their own).

export const rate = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : "–");

export const initials = (name) =>
  String(name || "?")
    .replace(/^dr\.?\s*/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

const AVATAR_COLORS = ["#2563eb", "#c0397a", "#6d4bd1", "#c46a12", "#0f8a5f"];
export const avatarColor = (name) => {
  let h = 0;
  for (const ch of String(name || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

// What a report row, a filter chip and the status pill say.
export const STATUS_LABELS = {
  replied: "Replied",
  clicked: "Clicked",
  opened: "Opened",
  delivered: "Not opened",
  sent: "Sent",
  bounced: "Bounced",
  complained: "Complained",
  unsub: "Unsubscribed",
  failed: "Failed",
  uncertain: "Uncertain",
  skipped: "Skipped",
  queued: "Waiting",
  sending: "Sending",
};
export const statusLabel = (status) => STATUS_LABELS[status] || status;

// The chips shown above the report table: the main ones always, the rest only when someone is in them.
const MAIN_FILTERS = ["all", "replied", "clicked", "opened", "delivered", "bounced", "unsub"];
const EXTRA_FILTERS = ["sent", "complained", "failed", "uncertain", "skipped", "queued", "sending"];

export function filterCounts(people) {
  const counts = { all: people.length };
  for (const p of people) counts[p.status] = (counts[p.status] || 0) + 1;
  return counts;
}

export function reportFilters(people) {
  const counts = filterCounts(people);
  const keys = [...MAIN_FILTERS, ...EXTRA_FILTERS.filter((k) => counts[k])];
  return keys.map((key) => ({ key, label: key === "all" ? "All" : statusLabel(key), count: counts[key] || 0 }));
}

export const filterPeople = (people, key) => (key === "all" ? people : people.filter((p) => p.status === key));

export const CAMPAIGN_STATUS = {
  draft: "Draft",
  sending: "Sending",
  sent: "Sent",
  stopped: "Stopped",
};
export const campaignStatusLabel = (status) => CAMPAIGN_STATUS[status] || status;

// Why a running campaign is waiting.
export function holdText(reason) {
  if (reason === "daily_cap") return "Today's sending limit was reached. Sending continues automatically tomorrow.";
  if (reason === "ses_unavailable") return "Amazon SES is not accepting mail right now. Sending will try again automatically.";
  return "";
}

// "About 3 min (sent steadily, not all at once)" or, for a big list, how many days the daily limit needs.
export function estimateText(estimate) {
  if (!estimate) return "";
  if (estimate.days > 1) return `About ${estimate.days} days (up to ${estimate.dailyCap} emails per day)`;
  return `About ${estimate.minutes} min (sent steadily, not all at once)`;
}

// Puts `insert` where the cursor / selection is. → { value, cursor }
export function insertAtCursor(value, start, end, insert) {
  const s = Math.max(0, Math.min(start ?? value.length, value.length));
  const e = Math.max(s, Math.min(end ?? s, value.length));
  return { value: value.slice(0, s) + insert + value.slice(e), cursor: s + insert.length };
}

const pad = (n) => String(n).padStart(2, "0");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "17 Nov 2026, 11:20 am" (the viewer's own time zone).
export function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const h = d.getHours();
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${h % 12 || 12}:${pad(d.getMinutes())} ${h < 12 ? "am" : "pm"}`;
}

// "just now", "8 min ago", "3 hr ago", else the date.
export function formatWhen(value, now = Date.now()) {
  if (!value) return "—";
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return "—";
  const mins = Math.floor((now - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.floor(mins / 60)} hr ago`;
  return formatDateTime(value);
}

export const mailboxLabel = (m) => `${m.displayName} — ${m.address}`;

// The message of a failed request, as the server wrote it.
export const errorMessage = (err, fallback = "Something went wrong. Please try again.") =>
  err?.response?.data?.msg || err?.response?.data?.message || fallback;

export const isEmail = (value) => /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[a-z]{2,}$/i.test(String(value || "").trim());

export const PLACEHOLDERS = ["{{name}}", "{{company}}"];

// Where the page lives (absolute, so the same code works from every nested route).
export const MK_BASE = "/admin-dashboard/email-marketing";

// Where "My signature" lives (opened in a new tab so a draft in progress is not lost).
export const MY_SIGNATURE_PATH = "/admin-dashboard/email/settings/my-signature";

// "added" | "none" (ticked, but the sender has no signature yet) | "off"
export function signatureStatus({ add, hasImage }) {
  if (!add) return "off";
  return hasImage ? "added" : "none";
}

// What changing the Content tab does to what the admin already has:
//   "none"    nothing is lost
//   "replace" typed HTML would be replaced by written text: ask first
//   "choose"  written text would be left behind: convert it to HTML first, start empty, or cancel
export function tabSwitchPlan({ from, to, html = "", sourceText = "" }) {
  if (from === to) return "none";
  if (to === "text") return String(html).trim() ? "replace" : "none";
  if (from === "text" && String(sourceText).trim()) return "choose";
  return "none";
}
