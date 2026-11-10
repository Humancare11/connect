// Support-ticket times. The ticket stores the raiser's IANA timezone (sent by their browser);
// the admin team works in Asia/Kolkata. Users only ever see times in their own zone.
export const ADMIN_TIMEZONE = "Asia/Kolkata";

export function isValidTimeZone(tz) {
  if (!tz || typeof tz !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// The browser's own zone, e.g. "America/New_York". "" when it cannot be read.
export function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

// An unusable zone falls back to the viewer's own browser zone instead of throwing.
const zone = (tz) => (isValidTimeZone(tz) ? tz : undefined);

const toDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

// "7 Nov 2026"
export function formatTicketDate(value, tz) {
  const d = toDate(value);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-GB", { timeZone: zone(tz), day: "numeric", month: "short", year: "numeric" }).format(d);
}

// "3:30 pm"
export function formatTicketClock(value, tz) {
  const d = toDate(value);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-GB", { timeZone: zone(tz), hour: "2-digit", minute: "2-digit", hour12: true }).format(d);
}

// "7 Nov 2026, 03:30 pm"
export function formatTicketDateTime(value, tz) {
  const d = toDate(value);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: zone(tz),
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

// "GMT+5:30" for that instant (daylight saving aware)
export function utcOffsetLabel(value, tz) {
  const d = toDate(value);
  if (!d) return "";
  const part = new Intl.DateTimeFormat("en-US", { timeZone: zone(tz), timeZoneName: "shortOffset" })
    .formatToParts(d)
    .find((p) => p.type === "timeZoneName");
  return part?.value || "";
}

// "Asia/Kolkata (GMT+5:30)"
export function zoneLabel(value, tz) {
  if (!toDate(value)) return "";
  const name = isValidTimeZone(tz) ? tz : browserTimeZone();
  const offset = utcOffsetLabel(value, tz);
  return name ? `${name}${offset ? ` (${offset})` : ""}` : offset;
}
