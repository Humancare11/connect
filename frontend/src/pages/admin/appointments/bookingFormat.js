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
  // Whole dollars have no decimals; anything with cents shows both.
  const digits = Number.isInteger(amount) ? 0 : 2;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount);
}

// The last 8 characters of the booking id, shown as "...ABCD1234".
export const shortBookingId = (row) => `…${row.shortId || String(row.id).slice(-8).toUpperCase()}`;

// Hover text for the doctor cell when the doctor was swapped.
export const originalDoctorHint = (row) => (row.originalDoctorName ? `Originally with ${row.originalDoctorName}` : "");
