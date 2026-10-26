// Plain helpers for the admin "Appointment entries" page (no React), so they can be tested with `node --test`
// (see entriesFormat.test.mjs). The rows come from GET /api/admin/entries: bookings and manual entries in one list.

export const PAGE_SIZE = 25;

export const TAB_ORDER = ["all", "unpaid", "paid", "on_hold", "not_payable"];
export const TAB_LABELS = { all: "All", unpaid: "Unpaid", paid: "Paid", on_hold: "On hold", not_payable: "Not payable" };
export const STATUS_OPTIONS = TAB_ORDER.filter((key) => key !== "all").map((key) => [key, TAB_LABELS[key]]);

export const tabFromParam = (value) => (TAB_ORDER.includes(value) ? value : "all");
export const monthFromParam = (value) => (/^\d{4}-(0[1-9]|1[0-2])$/.test(value || "") ? value : "");
export const doctorFromParam = (value) => (/^[0-9a-f]{24}$/i.test(value || "") ? value : "");

export function pageFromParam(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

// The page state as the query string of the page's own URL: values that are the default are left out.
export function viewToParams({ tab, doctor, month, page }) {
  const params = {};
  if (tab && tab !== "all") params.tab = tab;
  if (doctor) params.doctor = doctor;
  if (month) params.month = month;
  if (page > 1) params.page = String(page);
  return params;
}

// ── Money ────────────────────────────────────────────────────────────────────

// 9900 -> "$99.00", 149900 -> "$1,499.00"
export const formatMoney = (cents) =>
  `$${((Number.isFinite(cents) ? cents : 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// 7425 -> "74.25"; null -> ""
export const centsToInput = (cents) => (Number.isFinite(cents) ? (cents / 100).toFixed(2) : "");

// What was typed in a fee box: "" (nothing), or a clean amount text like "74.25". Mirrors the server's rule (whole dollars up to
// 7 digits, at most 2 decimals, a leading $ is fine). { ok: false } for anything else.
export function cleanFeeInput(text) {
  const value = String(text ?? "").trim().replace(/^\$\s*/, "");
  if (value === "") return { ok: true, value: "" };
  return /^\d{1,7}(\.\d{1,2})?$/.test(value) ? { ok: true, value } : { ok: false, value };
}

// Are two fee texts the same amount ("74.5" and "74.50")? Used to skip a save that changes nothing.
export function sameFee(typed, cents) {
  if (typed === "") return cents === null || cents === undefined;
  return Number.isFinite(cents) && Math.round(Number(typed) * 100) === cents;
}

// ── Dates ────────────────────────────────────────────────────────────────────

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// "2026-10-16" -> "16 Oct 2026" (a calendar day, no time zone involved)
export function formatDay(day) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day || "");
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : "—";
}

// "2026-10" -> "October 2026"
export function formatMonth(month) {
  const m = /^(\d{4})-(\d{2})$/.exec(month || "");
  return m ? `${MONTHS_LONG[Number(m[2]) - 1]} ${m[1]}` : month || "";
}

// A moment (ISO text) as the booking day, in the browser's time zone like the Appointments list.
export function formatBooked(value) {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// "2:30 PM" -> "14:30" for a time input; anything else -> ""
export function timeToInput(time) {
  const m = /^(\d{1,2}):(\d{2})\s*([AP]M)$/i.exec(time || "");
  if (!m) return /^\d{2}:\d{2}$/.test(time || "") ? time : "";
  const h = Number(m[1]) % 12 + (m[3].toUpperCase() === "PM" ? 12 : 0);
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

// ── Rows ─────────────────────────────────────────────────────────────────────

export const isManual = (row) => row?.kind === "manual";

// The id column: a booking shows the last 8 characters of its id, a manual entry its "M-1A2B" code.
export const idText = (row) => (isManual(row) ? row.shortId : `…${String(row.id || "").slice(-8).toUpperCase()}`);

// The Web / App / Manual / Unknown label next to the id, with the CSS class suffix and the hover text.
export function sourceLabel(row) {
  const group = row?.sourceGroup || "Unknown";
  return { text: group, tone: group.toLowerCase(), title: row?.sourceDetail || "" };
}

// The Fee charged cell: the charge, plus "paid $X" when the patient paid a different amount.
export function feeCharged(row) {
  const charged = row.feeChargedCents ?? 0;
  const paid = row.amountPaidCents ?? 0;
  return { main: formatMoney(charged), paid: paid !== charged ? `paid ${formatMoney(paid)}` : "" };
}

// The grey text in an empty doctor fee box: "75% · 74.25" (never on a Not payable row), else "0.00". Never saved.
export function feePlaceholder(row) {
  if (row.entry.doctorFeeCents !== null && row.entry.doctorFeeCents !== undefined) return "0.00";
  if (row.entry.paidStatus === "not_payable" || !row.placeholder) return "0.00";
  return row.placeholder.text;
}

export const totalsText = (rows) => `Totals for ${rows} row${rows === 1 ? "" : "s"}`;

// "3 rows" / "1 row"
export const rowsText = (n) => `${n} row${n === 1 ? "" : "s"}`;

// "Showing 26–50 of 132"
export function rangeText(page, shown, total, limit = PAGE_SIZE) {
  if (!total || !shown) return "";
  const from = (page - 1) * limit + 1;
  return `Showing ${from}–${from + shown - 1} of ${total}`;
}

// The row number in the first column, continuing across pages.
export const rowNumber = (page, index, limit = PAGE_SIZE) => (page - 1) * limit + index + 1;

// The list with one row swapped for its fresh copy from the server (same kind and id); the rest is untouched.
export const replaceRow = (items, fresh) => items.map((row) => (row.kind === fresh.kind && row.id === fresh.id ? fresh : row));

export const rowKey = (row) => `${row.kind}:${row.id}`;

// ── Saving ───────────────────────────────────────────────────────────────────

// The server's words for a failed save, else a plain fallback.
export function saveErrorText(error) {
  return error?.response?.data?.msg || (error?.response ? "Couldn't save. Try again." : "Couldn't save. Check your connection and try again.");
}

// True when the server answered "someone else changed it" and sent the current row.
export const isStale = (error) => error?.response?.status === 409 && error.response.data?.code === "stale";

// The file name from a Content-Disposition header, else a dated fallback.
export function downloadName(header, fallbackDay = "") {
  const m = /filename="?([^";]+)"?/i.exec(header || "");
  return m ? m[1] : `entries${fallbackDay ? `-${fallbackDay}` : ""}.csv`;
}

// ── The manual-entry form ────────────────────────────────────────────────────

export const EMPTY_FORM = { patientName: "", country: "", doctorId: "", date: "", time: "10:00", feeCharged: "", doctorFee: "", comment: "" };

// The form's starting values for editing a manual row.
export function formFromRow(row) {
  return {
    patientName: row.patient?.name || "",
    country: row.patient?.countryName || row.patient?.country || "",
    doctorId: row.manual?.doctorId || "",
    date: row.consultation?.date || "",
    time: timeToInput(row.consultation?.time),
    feeCharged: centsToInput(row.feeChargedCents),
    doctorFee: "",
    comment: "",
  };
}

// First problem with the form, as a sentence, or "". The server checks the same things again.
export function formProblem(form) {
  if (!form.patientName.trim()) return "Enter the patient's name.";
  if (!form.date) return "Enter the consultation date.";
  const fee = cleanFeeInput(form.feeCharged);
  if (!fee.ok || fee.value === "") return "Enter the fee charged as a number, like 49.00 (0 is fine).";
  if (!cleanFeeInput(form.doctorFee).ok) return "Doctor fee must be a number, like 36.75.";
  return "";
}

// The body for POST /manual.
export function createBody(form) {
  return {
    patientName: form.patientName.trim(),
    country: form.country.trim(),
    doctorId: form.doctorId || null,
    date: form.date,
    time: form.time,
    feeCharged: cleanFeeInput(form.feeCharged).value,
    doctorFee: cleanFeeInput(form.doctorFee).value,
    comment: form.comment.trim(),
  };
}

// The body for PATCH /manual/:id/details (Edit): the fields of the form that Edit can change, plus the version the page saw.
export function editBody(form, version) {
  return {
    version,
    patientName: form.patientName.trim(),
    country: form.country.trim(),
    doctorId: form.doctorId || null,
    date: form.date,
    time: form.time,
    feeCharged: cleanFeeInput(form.feeCharged).value,
  };
}

// An approved doctor (an Enrollment from /api/admin/approved-doctors) as a dropdown option, sorted by name.
export function doctorOptions(enrollments) {
  return (enrollments || [])
    .map((e) => ({ id: String(e._id), name: e.doctorId?.name || `${e.firstName || ""} ${e.surname || ""}`.trim() || "Doctor" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
