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
