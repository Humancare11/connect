// Small helpers shared by the Real-time visitors table and its side panel.
export const ACTIVITY = {
  browsing: "Browsing",
  chatting: "Chatting",
  waiting: "Waiting for agent",
  invited: "Invited",
  ai: "Chatting",
};
export const ACTIVITY_CLASS = { ai: "chatting" };
export const ACTIVITY_ORDER = { waiting: 0, chatting: 1, ai: 1, invited: 2, browsing: 3 };
export const ACTIVITY_FILTERS = [
  ["all", "All activity"],
  ["browsing", "Browsing"],
  ["chatting", "Chatting"],
  ["waiting", "Waiting for agent"],
  ["invited", "Invited"],
];

export const initials = (name) =>
  String(name || "")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export const duration = (seconds) => {
  const s = Math.max(0, Math.floor(seconds));
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
};

export const flag = (code) =>
  /^[A-Z]{2}$/.test(code || "") ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : "";

export const pageLabel = (visitor) => visitor.page?.title || visitor.page?.path || "–";
export const displayName = (visitor) => visitor.name || visitor.ip || "Visitor";

const AVATAR_COLORS = ["#9b5cf0", "#2f6fe0", "#c79a14", "#2e9e6a", "#d6538f"];
export const avatarColor = (visitor) =>
  AVATAR_COLORS[[...String(visitor.visitorId)].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

// "3:42 PM, Tue" in the visitor's time zone, plus whether it is night there. Empty when the zone is unknown.
export function localTime(timeZone, now) {
  if (!timeZone) return null;
  try {
    const date = new Date(now);
    const text = `${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone })}, ${date.toLocaleDateString("en-US", { weekday: "short", timeZone })}`;
    const hour = Number(date.toLocaleTimeString("en-US", { hour: "numeric", hour12: false, timeZone })) % 24;
    return { text, night: hour < 6 || hour >= 19 };
  } catch {
    return null;
  }
}
