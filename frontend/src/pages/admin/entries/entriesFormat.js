// Plain helpers for the admin "Appointment entries" page (no React), so they can be tested with `node --test`
// (see entriesFormat.test.mjs). The rows come from GET /api/admin/entries: bookings and manual entries in one list.

export const PAGE_SIZE = 25;

export const TAB_ORDER = ["all", "unpaid", "paid", "on_hold", "not_payable"];
export const TAB_LABELS = { all: "All", unpaid: "Unpaid", paid: "Paid", on_hold: "On hold", not_payable: "Not payable" };
export const STATUS_OPTIONS = TAB_ORDER.filter((key) => key !== "all").map((key) => [key, TAB_LABELS[key]]);

// The two views: Auto entries (bookings from the website and app) and Manual entries. Auto is the default and is left out of the address.
export const VIEWS = ["auto", "manual"];
export const viewFromParam = (value) => (VIEWS.includes(value) ? value : "auto");

export const tabFromParam = (value) => (TAB_ORDER.includes(value) ? value : "all");
export const monthFromParam = (value) => (/^\d{4}-(0[1-9]|1[0-2])$/.test(value || "") ? value : "");
export function pageFromParam(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

// The page state as the query string of the page's own URL: values that are the default are left out.
export function viewToParams({ view, tab, month, page }) {
  const params = {};
  if (view && view !== "auto") params.view = view;
  if (tab && tab !== "all") params.tab = tab;
  if (month) params.month = month;
  if (page > 1) params.page = String(page);
  return params;
}

// ── The money boxes (a super admin only) ───

// A margin can be negative: "-$15.00" rather than "$-15.00".
export const formatSigned = (cents, currency = "usd") => `${cents < 0 ? "-" : ""}${formatMoney(Math.abs(cents), currency)}`;

// Money is never added across currencies, so the server sends every total per currency ({ usd: {...}, eur: {...}, gbp: {...} }).
// This shows one figure of such a set: just "$1,200.00" when only USD has anything (what the page always showed), otherwise one
// part per currency, like "USD $1,200.00 · EUR €300.00". USD is always counted as present.
export function moneyByCurrency(byCurrency, pick, { signed = false } = {}) {
  const buckets = byCurrency || {};
  const shown = MONEY_CURRENCIES.filter((c) => c === "usd" || Object.values(buckets[c] || {}).some((v) => Number(v)));
  const one = (c) => {
    const cents = Number(pick(buckets[c] || {})) || 0;
    return signed ? formatSigned(cents, c) : formatMoney(cents, c);
  };
  return shown.length === 1 ? one("usd") : shown.map((c) => `${c.toUpperCase()} ${one(c)}`).join(" · ");
}

// The footer figure of the entries table: "fee charged" or "doctor fee" over every matching row, per currency.
export const totalsMoney = (totals, key) => moneyByCurrency(totals?.byCurrency, (bucket) => bucket[key]);

// The USD part of the totals in the old flat shape { rows, feeChargedCents, doctorFeeCents } (manual entries are USD only).
export const usdTotals = (totals) => (totals ? { rows: totals.rows, ...(totals.byCurrency?.usd || {}) } : totals);

// The boxes of a view, from the server's `summary` (which only a super admin gets). No summary, no boxes.
export function summaryBoxes(view, summary) {
  if (!summary) return [];
  const manual = view === "manual";
  const by = summary.byCurrency || {};
  const negativeMargin = MONEY_CURRENCIES.some((c) => Number(by[c]?.marginCents) < 0);
  return [
    { key: "received", label: manual ? "Received from companies" : "Received from patients", text: moneyByCurrency(by, (b) => b.receivedCents), tone: "ok" },
    { key: "toPay", label: "To pay providers", text: moneyByCurrency(by, (b) => b.toPayCents), tone: "warn" },
    { key: "margin", label: "Our margin", text: moneyByCurrency(by, (b) => b.marginCents, { signed: true }), tone: negativeMargin ? "neg" : "" },
  ];
}

// ── Money ────────────────────────────────────────────────────────────────────

export const MONEY_CURRENCIES = ["usd", "eur", "gbp"];
const CURRENCY_SYMBOLS = { usd: "$", eur: "€", gbp: "£" };

// A booking's currency as one of "usd" / "eur" / "gbp" (anything missing or unknown is USD, like old bookings).
export const currencyOf = (row) => {
  const code = String(row?.currency || "usd").toLowerCase();
  return MONEY_CURRENCIES.includes(code) ? code : "usd";
};

// 9900 -> "$99.00", 149900 -> "$1,499.00"; 3000 with "eur" -> "€30.00", with "gbp" -> "£30.00". USD when no currency is given.
export const formatMoney = (cents, currency = "usd") => {
  const code = MONEY_CURRENCIES.includes(String(currency).toLowerCase()) ? String(currency).toLowerCase() : "usd";
  return `${CURRENCY_SYMBOLS[code]}${((Number.isFinite(cents) ? cents : 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

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

// ── Months (the month picker) ───

export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// The month the browser's clock is in, as "YYYY-MM".
export const thisMonth = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

// "2026-12" + 1 -> "2027-01"; "2026-01" - 1 -> "2025-12"
export function stepMonth(month, delta) {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

// "2026" + 3 -> "2026-04" (a month of the year, by its 0-based index)
export const monthOf = (year, index) => `${year}-${String(index + 1).padStart(2, "0")}`;

// What the ‹ and › arrows do. From "All time" ‹ goes to the latest month that has entries (never one in the future) and › does
// nothing; from a month they step by one, and › stops at the current month. Returns the new month, or null when the arrow has nowhere to go.
export function arrowTarget(month, direction, { months = [], now = thisMonth() } = {}) {
  if (!month) {
    if (direction > 0) return null;
    return [...months].filter((m) => m <= now).sort().at(-1) || now;
  }
  const next = stepMonth(month, direction);
  return next > now ? null : next;
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
  const currency = currencyOf(row);
  return { main: formatMoney(charged, currency), paid: paid !== charged ? `paid ${formatMoney(paid, currency)}` : "" };
}

// The grey text in an empty doctor fee box. Only a placeholder: nothing is saved until someone types.
export const FEE_PLACEHOLDER = "0.00";

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

// The choices of the form's drop-downs, [value, label].
export const SERVICE_TYPES = [["house_call", "House call"], ["teleconsultation", "Teleconsultation"], ["others", "Others"]];
export const CASE_STATUSES = [["open", "Open"], ["in_progress", "In progress"], ["completed", "Completed"], ["cancelled", "Cancelled"]];
export const MR_STATUSES = [["pending", "Pending"], ["received", "Received"]];
export const SENT_STATUSES = [["not_sent", "Not sent"], ["sent", "Sent"]];
export const PAYMENT_RECEIVED = [["not_received", "Not received"], ["partly_received", "Partly received"], ["received", "Received"]];
export const PAYMENT_TO_PROVIDER = [["unpaid", "Unpaid"], ["on_hold", "On hold"], ["paid", "Paid"], ["not_payable", "Not payable"]];

export const MAX_FEEDBACK = 1000;
export const MAX_PHONE = 20;

// Once Payment to provider is Paid these cannot change (the server enforces the same list).
export const LOCKED_WHEN_PAID = [
  "date", "company", "caseNumber", "serviceType", "otherService", "caseStatus",
  "serviceProvider", "providerNumber", "patientName", "country", "contactNumber", "consultationFee", "doctorFee",
];

// A blank form, with today as the date (the day as "YYYY-MM-DD").
export const newForm = (today) => ({
  date: today, company: "", caseNumber: "", serviceType: "teleconsultation", otherService: "", caseStatus: "open",
  serviceProvider: "", providerNumber: "",
  patientName: "", country: "", contactNumber: "",
  consultationFee: "", doctorFee: "",
  mrStatus: "pending", mrSentToCompany: "not_sent", invoiceSent: "not_sent",
  paymentReceived: "not_received", paymentReceivedDate: "", paymentToProvider: "unpaid", paidDateToProvider: "",
  feedbackSent: "", feedbackReceived: "", comment: "",
});

// The form's starting values for editing a manual row: what the server saved, as text.
export const formFromRow = (row) => ({ ...newForm(""), ...(row.manual?.form || {}) });

// A field's new value, plus what follows from it: the payment dates default to today when they become usable, and a payment received date
// goes when nothing was received.
export function changeField(form, key, value, today) {
  const next = { ...form, [key]: value };
  if (key === "paymentReceived") {
    next.paymentReceivedDate = value === "not_received" ? "" : form.paymentReceivedDate || today;
  }
  if (key === "paymentToProvider" && value === "paid" && !form.paidDateToProvider) next.paidDateToProvider = today;
  return next;
}

export const phoneOk = (text) => text.length <= MAX_PHONE && /^[0-9 +\-()]*$/.test(text);

const cents = (text) => {
  const clean = cleanFeeInput(text);
  return clean.ok && clean.value !== "" ? Math.round(Number(clean.value) * 100) : null;
};

// "Calculation (our margin)": consultation fee minus the doctor's fee, and that as a percentage of the consultation fee. Never saved.
// { empty: true } until both fees are numbers; { text: "$30.00", percent: "30.0%", negative } otherwise (no percent for a 0 fee).
export function calculation(form) {
  const consult = cents(form.consultationFee);
  const doctor = cents(form.doctorFee);
  if (consult === null || doctor === null) return { empty: true, text: "—", percent: "", negative: false };
  const margin = consult - doctor;
  const sign = margin < 0 ? "-" : "";
  return {
    empty: false,
    text: `${sign}${formatMoney(Math.abs(margin))}`,
    percent: consult > 0 ? `${(Math.round((margin / consult) * 1000) / 10).toFixed(1)}%` : "",
    negative: margin < 0,
  };
}

// First problem with the form, as a sentence, or "". The server checks the same things again.
export function formProblem(form) {
  if (!form.date) return "Enter the date of the case.";
  if (form.serviceType === "others" && !form.otherService.trim()) return "Describe the other service.";
  if (!form.serviceProvider.trim()) return "Enter the service provider.";
  if (!phoneOk(form.providerNumber.trim())) return "The service provider number can have digits, spaces and + - ( ) only, up to 20 characters.";
  if (!form.patientName.trim()) return "Enter the patient's name.";
  if (!phoneOk(form.contactNumber.trim())) return "The contact number can have digits, spaces and + - ( ) only, up to 20 characters.";
  const fee = cleanFeeInput(form.consultationFee);
  if (!fee.ok || fee.value === "") return "Enter the consultation fee as a number, like 49.00 (0 is fine).";
  if (!cleanFeeInput(form.doctorFee).ok) return "The doctor's fee must be a number, like 36.75.";
  if (form.paymentToProvider === "paid") {
    if (!(cents(form.doctorFee) > 0)) return "Enter a doctor's fee above 0 before marking this Paid.";
    if (!form.paidDateToProvider) return "Enter the date it was paid to the provider.";
  }
  if (form.paymentReceived !== "not_received" && !form.paymentReceivedDate) return "Enter the date the payment was received.";
  return "";
}

// The body for POST /manual and (with `version`) PATCH /manual/:id/details. The Other service text only goes with "Others", the received
// date only with a payment received, and the Paid date only when Paid.
export function formBody(form, version) {
  const body = {
    date: form.date,
    company: form.company.trim(),
    caseNumber: form.caseNumber.trim(),
    serviceType: form.serviceType,
    otherService: form.serviceType === "others" ? form.otherService.trim() : "",
    caseStatus: form.caseStatus,
    serviceProvider: form.serviceProvider.trim(),
    providerNumber: form.providerNumber.trim(),
    patientName: form.patientName.trim(),
    country: form.country.trim(),
    contactNumber: form.contactNumber.trim(),
    consultationFee: cleanFeeInput(form.consultationFee).value,
    doctorFee: cleanFeeInput(form.doctorFee).value,
    mrStatus: form.mrStatus,
    mrSentToCompany: form.mrSentToCompany,
    invoiceSent: form.invoiceSent,
    paymentReceived: form.paymentReceived,
    paymentReceivedDate: form.paymentReceived === "not_received" ? "" : form.paymentReceivedDate,
    paymentToProvider: form.paymentToProvider,
    feedbackSent: form.feedbackSent.trim(),
    feedbackReceived: form.feedbackReceived.trim(),
    comment: form.comment.trim(),
  };
  if (form.paymentToProvider === "paid") body.paidDateToProvider = form.paidDateToProvider;
  if (version !== undefined) body.version = version;
  return body;
}

// The Company and Case number line under a manual row's patient name.
export const caseLine = (row) => row.manual?.caseLine || "";
