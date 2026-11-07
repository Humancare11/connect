// Pure helpers for the Reschedule dialog and the history timeline (no React), so they can be tested on their own.

const pad = (n) => String(n).padStart(2, "0");

// "YYYY-MM-DD" for a Date, by its local calendar day.
export const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Today and the next days, as ISO dates (the dialog offers 14).
export function nextDays(count = 14, from = new Date()) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    out.push(isoDay(d));
  }
  return out;
}

// "Fri 06 Nov" for an ISO date.
export function dayLabel(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) return iso || "";
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
}

// The slot grid in Morning / Afternoon / Evening groups (empty groups left out).
export function groupSlots(slots = []) {
  const groups = [
    { name: "Morning", slots: [] },
    { name: "Afternoon", slots: [] },
    { name: "Evening", slots: [] },
  ];
  for (const slot of slots) {
    const hour = Number(String(slot.time).slice(0, 2));
    groups[hour < 12 ? 0 : hour < 17 ? 1 : 2].slots.push(slot);
  }
  return groups.filter((g) => g.slots.length);
}

// "11:30 AM" from a label such as "06 Nov 2026, 11:30 AM".
export const timePart = (label) => String(label || "").split(", ").slice(-1)[0] || "";

// Why the form can't be submitted yet, as "a new date, a time slot", or "" when it is complete.
export function missingFields({ date, time, reason, note }) {
  return [!date && "a new date", !time && "a time slot", !reason && "a reason", reason === "Other" && !String(note || "").trim() && 'a note for "Other"']
    .filter(Boolean)
    .join(", ");
}

// A slot's hover text: why it can't be picked.
export const SLOT_WHY = { booked: "Already booked", past: "In the past", current: "Current slot" };

// The line under the dialog's time grid that says which zone the times are in.
export function zoneNote(timezone) {
  if (!timezone) return "";
  const zone = timezone.patient;
  if (timezone.assumed) {
    return `No time zone is recorded for this booking, so ${zone} is assumed for its times. IST is shown beneath each time.`;
  }
  return `Times are the patient's local time (${zone}). IST is shown beneath each time.`;
}

// ── Calendar and time-zone helpers for the redesigned dialog ─────────────────

const IST_ZONES = new Set(["Asia/Kolkata", "Asia/Calcutta"]);
export const isIstZone = (zone) => IST_ZONES.has(String(zone || ""));

// "2026-11" -> { year: 2026, month: 10 } (month is 0-based like Date) and back.
export const parseMonth = (key) => {
  const [y, m] = String(key).split("-").map(Number);
  return { year: y, month: m - 1 };
};
export const monthKey = (year, month) => {
  const d = new Date(year, month, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
export const shiftMonth = (key, delta) => {
  const { year, month } = parseMonth(key);
  return monthKey(year, month + delta);
};
export const monthTitle = (key) => {
  const { year, month } = parseMonth(key);
  return new Date(year, month, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
};

// The cells of a month: `null` for the blanks before the 1st, then one ISO date per day (Sunday-first, like the design).
export function monthCells(key) {
  const { year, month } = parseMonth(key);
  const blanks = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  return [...Array(blanks).fill(null), ...Array.from({ length: count }, (_, i) => `${year}-${pad(month + 1)}-${pad(i + 1)}`)];
}

// "Fri, 06 Nov 2026" for an ISO date.
export function longDay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) return iso || "";
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

// Header chip: "America/New_York (EST)", "India (IST)".
export function zoneChip(zone, at = new Date()) {
  if (isIstZone(zone)) return "India (IST)";
  let short = "";
  try {
    short = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "short" }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value || "";
  } catch {
    short = "";
  }
  return short ? `${zone} (${short})` : String(zone || "");
}

// The grey / orange note above the slots. `diff` is true when the patient's zone is not IST (IST is then shown under each slot).
export function zoneInfo(timezone) {
  if (!timezone) return { text: "", diff: false };
  const diff = !isIstZone(timezone.patient);
  if (timezone.assumed) return { text: zoneNote(timezone), diff };
  return { text: diff ? `Times are the patient's time (${timezone.patient}). India time is shown under each slot.` : "Times are in IST, same for patient and admin.", diff };
}

// What is still needed, for the footer: "date, time, reason" (a note instead of the reason when "Other" has none).
export function needList({ date, time, reason, note }) {
  return [!date && "date", date && !time && "time", !reason && "reason", reason === "Other" && !String(note || "").trim() && "a note"].filter(Boolean);
}
