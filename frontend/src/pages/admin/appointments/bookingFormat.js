// Plain helpers for the admin Appointments list (no React), so they can be tested
// with `node --test` (see bookingFormat.test.mjs). The rows come from
// GET /api/admin/bookings, which merges appointments and category consultations.

export const PAGE_SIZE = 25;

// Order of the tabs. "testing" is not a status: it lists every booking flagged as testing.
export const TAB_ORDER = ["all", "upcoming", "assigned", "pending", "confirmed", "complete", "cancelled", "testing"];

export const TAB_LABELS = {
  all: "All",
  upcoming: "Upcoming",
  assigned: "Assigned",
  pending: "Pending",
  confirmed: "Confirmed",
  complete: "Complete",
  cancelled: "Cancelled",
  testing: "Testing",
};

// The tab the page opens on, as the old Appointments page did.
export const DEFAULT_TAB = "upcoming";

export const STATUS_META = {
  upcoming: { label: "Upcoming", bg: "#e0f2fe", color: "#0369a1" },
  assigned: { label: "Assigned", bg: "#ede9fe", color: "#6d28d9" },
  pending: { label: "Pending", bg: "#fff2d6", color: "#9a6200" },
  confirmed: { label: "Confirmed", bg: "#e3edfc", color: "#1f5fbf" },
  complete: { label: "Complete", bg: "#dcfce7", color: "#15803d" },
  cancelled: { label: "Cancelled", bg: "#fde7e4", color: "#b4372f" },
};

export const isClosed = (status) => status === "complete" || status === "cancelled";

// "Assigned by" is empty until a doctor is assigned, so the Upcoming tab has no use for it.
export const showAssignedByColumn = (tab) => tab !== "upcoming";

export const tabFromParam = (value) => (TAB_ORDER.includes(value) ? value : DEFAULT_TAB);

export function pageFromParam(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

// Row number shown in the first column, continuing across pages.
export const rowNumber = (page, index) => (page - 1) * PAGE_SIZE + index + 1;

// "Showing 26-50 of 132"
export function rangeText(page, shown, total) {
  if (!total || !shown) return "";
  const from = (page - 1) * PAGE_SIZE + 1;
  return `Showing ${from}–${from + shown - 1} of ${total}`;
}

// 1 ... 4 5 6 ... 20: the first and last page and the current page +-1.
export function pageWindow(current, total) {
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

const DAY_FORMAT = { day: "numeric", month: "short", year: "numeric" };

// When the patient booked (an ISO instant), in the admin's own timezone.
export function formatBookedOn(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", DAY_FORMAT);
}

// The consultation: { date: "YYYY-MM-DD", time } or null for "Not scheduled". The date is
// a calendar day, so it is formatted from its parts (no timezone shift).
export function formatConsultation(consultation) {
  if (!consultation?.date) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(consultation.date);
  if (!match) return { day: String(consultation.date), time: consultation.time || "" };
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return { day: d.toLocaleDateString("en-GB", DAY_FORMAT), time: consultation.time || "" };
}

export function formatFee(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "—";
  // Always two decimals, as in the reference design: $99.00, $12.50.
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

// The last 8 characters of the booking id, shown as "...ABCD1234".
export const shortBookingId = (row) => `…${row.shortId || String(row.id).slice(-8).toUpperCase()}`;

// Hover text for an empty "Assigned by" next to a doctor: older bookings were assigned before the admin was recorded.
export function assignedByHint(row) {
  if (!row.doctorName || row.assignedBy) return "";
  return row.status === "assigned"
    ? "Assigned before tracking started"
    : "No admin assignment recorded: booked directly with the doctor, or assigned before tracking started";
}

// Hover text for the doctor cell when the doctor was swapped.
export const originalDoctorHint = (row) => (row.originalDoctorName ? `Originally with ${row.originalDoctorName}` : "");

// ── Row actions ──────────────────────────────────────────────────────────────
// Which buttons a row offers. They mirror the server's rules, so a button is enabled
// exactly when the server would accept the action (the server still has the last word).

export const CANCEL_REASONS = ["Patient requested", "Doctor unavailable", "Payment failed", "Duplicate booking", "Testing booking"];

const GATEWAY_NAMES = { stripe: "Stripe", paypal: "PayPal" };

// Cancelling does not refund. The reminder names where the money was taken.
export function refundWarning(row) {
  const name = GATEWAY_NAMES[String(row?.paymentGateway || "").toLowerCase()];
  return name ? `This booking was paid. Refund it in ${name}.` : "This booking was paid. Refund it with the payment provider.";
}

const hasDoctor = (row) => Boolean(row.doctorName);

// Any open booking with no doctor can be given one, whatever its status (older data has Assigned bookings with no doctor).
export const canAssign = (row) => !hasDoctor(row) && !isClosed(row.status);
export const canAlternate = (row) => hasDoctor(row) && !isClosed(row.status);
// A Complete booking with a doctor can be moved back to Confirmed. (Only the doctor confirms a new booking.)
export const canReactivate = (row) => hasDoctor(row) && row.status === "complete";
export const canAutoComplete = (row) => hasDoctor(row) && ["assigned", "confirmed"].includes(row.status);
export const canCancel = (row) => !isClosed(row.status);

// A Next Available category booking has no time until the admin picks one.
export const needsAppointmentTime = (row) => row.kind === "category" && !row.consultation;

export const AUTO_COMPLETE_HINT = "Only assigned or confirmed bookings can be auto completed";

// <input type="time"> uses "17:30"; bookings store "05:30 PM".
export function toTime12(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || "").trim());
  if (!match) return "";
  const hours = Number(match[1]);
  if (hours > 23 || Number(match[2]) > 59) return "";
  const period = hours >= 12 ? "PM" : "AM";
  return `${String(hours % 12 || 12).padStart(2, "0")}:${match[2]} ${period}`;
}

export function toTime24(display) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(display || "").trim());
  if (!match) return "";
  let hours = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hours += 12;
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

// What to tell the admin when an action fails. A 409 is nearly always "someone (or a
// doctor) got there first, your list is stale": say so and refresh. The one 409 worth
// reading is a busy doctor (code "slot_taken"): keep the dialog open to pick another.
export function explainActionError(err) {
  const status = err?.response?.status;
  const data = err?.response?.data;
  if (status === 409 && data?.code !== "slot_taken") {
    return { message: "This booking was already updated, refreshing", refresh: true };
  }
  if (data?.msg) return { message: data.msg, refresh: false };
  if (!err?.response) return { message: "Could not reach the server. Check your connection and try again.", refresh: false };
  return { message: "Something went wrong. Please try again.", refresh: false };
}

// ── Doctor picker ────────────────────────────────────────────────────────────

const plainName = (name) => String(name || "").replace(/^dr\.?\s+/i, "").trim().toLowerCase();

// The approved doctors matching the search (name, specialty, city, country), without the
// booking's current doctor, by name.
export function filterDoctors(doctors, query, currentDoctorName = "", limit = 60) {
  const q = String(query || "").trim().toLowerCase();
  const current = plainName(currentDoctorName);
  return (Array.isArray(doctors) ? doctors : [])
    .filter((d) => d && d.id)
    .filter((d) => !current || plainName(d.name) !== current)
    .filter((d) => !q || [d.name, d.specialty, d.city, d.country].some((v) => String(v || "").toLowerCase().includes(q)))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    .slice(0, limit);
}
