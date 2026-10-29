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

// The list switches from a table to one card per booking when the table area is narrower than this (px). The stylesheet's
// @container rule uses the same number. The area is the page minus the sidebar, so it is about 260px less than the window.
export const CARD_BELOW = 1000;

// The Source dropdown: value (also the ?source= in the page URL and the API) and label. "all" is the default and is left out of the URL.
export const SOURCE_FILTERS = [
  ["all", "All"],
  ["web", "Web"],
  ["app", "App"],
  ["unknown", "Unknown"],
];
export const sourceFromParam = (value) => (SOURCE_FILTERS.some(([key]) => key === value) ? value : "all");

// The full text of a row's Source page cell, for the hover: "Header: Book Appointment (clicked on Service: Fit to fly)".
export function sourcePageText(page) {
  if (!page) return "Not recorded";
  const head = page.name ? `${page.type}: ${page.name}` : page.type;
  return page.clickedOn ? `${head} (clicked on ${page.clickedOn})` : head;
}

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

// A booking's currency for display: "USD", "EUR" or "GBP" (anything else, or none, is USD like bookings made before EUR / GBP).
export const currencyCode = (currency) => {
  const code = String(currency || "usd").toUpperCase();
  return ["USD", "EUR", "GBP"].includes(code) ? code : "USD";
};

export function formatFee(value, currency = "usd") {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "—";
  // Always two decimals, as in the reference design: $99.00, €12.50, £12.50.
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode(currency), minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

// The last 8 characters of the booking id, shown as "...ABCD1234".
export const shortBookingId = (row) => `…${row.shortId || String(row.id).slice(-8).toUpperCase()}`;

// Hover text for an empty "Assigned by" next to a doctor: older bookings were assigned before the admin was recorded.
export function assignedByHint(row) {
  if (!row.doctorName || row.assignedBy) return "";
  // A category consultation never has its doctor chosen by the patient, so with no recorded assigner it was
  // assigned before the assigner was tracked. An Assigned booking was assigned by an admin, so the same applies.
  return row.status === "assigned" || row.kind === "category"
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

// Cancelling does not refund. The reminder names where the money was taken and, for a EUR / GBP booking, the amount and currency
// to refund (a USD booking reads exactly as it always did).
export function refundWarning(row) {
  const name = GATEWAY_NAMES[String(row?.paymentGateway || "").toLowerCase()];
  const code = currencyCode(row?.currency);
  const paid = code !== "USD" ? ` (${Number(row?.fee) > 0 ? formatFee(row.fee, code) : code})` : "";
  return name ? `This booking was paid${paid}. Refund it in ${name}.` : `This booking was paid${paid}. Refund it with the payment provider.`;
}

const hasDoctor = (row) => Boolean(row.doctorName);

// Any open booking with no doctor can be given one, whatever its status (older data has Assigned bookings with no doctor).
export const canAssign = (row) => !hasDoctor(row) && !isClosed(row.status);
export const canAlternate = (row) => hasDoctor(row) && !isClosed(row.status);
// A Complete booking with a doctor can be moved back to Confirmed. (Only the doctor confirms a new booking.)
export const canReactivate = (row) => hasDoctor(row) && row.status === "complete";
export const canAutoComplete = (row) => hasDoctor(row) && ["assigned", "confirmed"].includes(row.status);
export const canCancel = (row) => !isClosed(row.status);

// The buttons a row shows, in order. Only the ones that work for that row: a button that could not be used is left out
// rather than greyed. View always; then Auto complete (a booking with a doctor that is Assigned or Confirmed) or
// Reactivate (a Complete booking with a doctor); then Cancel, for super admins only.
export function rowActions(row, { isSuperAdmin = false } = {}) {
  const out = ["view"];
  if (canAutoComplete(row)) out.push("autoComplete");
  if (canReactivate(row)) out.push("reactivate");
  if (isSuperAdmin && canCancel(row)) out.push("cancel");
  return out;
}

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
