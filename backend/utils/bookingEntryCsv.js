// The Appointment entries CSV: one line per row of the list the filters match (bookings and manual entries), with the
// booking-source columns and, for manual entries, the extra fields of their form. Pure text building; utils/bookingEntryList.js
// loads the rows.
//
// Money is plain numbers with two decimals ("74.25"). The doctor fee column holds only what was SAVED: the grey 75%
// suggestion on the page is never exported. Text from visitors and admins is made formula-safe, then quoted.
const { PAID_STATUS_LABELS, centsToFixed } = require("./bookingEntry");
const { csvSafe } = require("./bookingSource");
const { displayValue } = require("./manualHistory");
const { LABELS: MANUAL_LABELS } = require("./manualEntry");

const COLUMNS = [
  "Booking ID",
  "Source",
  "Platform",
  "Source page type",
  "Source page name",
  "Clicked on",
  "Booked (UTC)",
  "Consultation date",
  "Consultation time",
  "Patient",
  "Country",
  "Doctor",
  "Doctor changed",
  "Fee charged",
  "Amount paid",
  "Doctor fee",
  "Paid status",
  "Paid on",
  "Comment",
  "Booking status",
  "Testing",
  // Manual entries only (empty on a booking row): the case, the provider and patient numbers, the margin, the medical report and
  // invoice, the payment from the company, and the feedback.
  "Company",
  "Case number",
  "Type of service",
  "Other service",
  "Case status",
  "Service provider number",
  "Contact number",
  "Calculation (our margin)",
  "Calculation (% of consultation fee)",
  "MR status",
  "MR sent to company",
  "Invoice sent",
  "Payment received",
  "Payment received date",
  "Feedback message sent",
  "Feedback received",
];

// A CSV field: quoted when it holds a comma, quote or line break.
const field = (value) => {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const bookedAt = (value) => {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 16).replace("T", " ") : "";
};

const yesNo = (flag) => (flag ? "Yes" : "No");

// The manual-only cells (16 of them); a booking row has none. The margin is the consultation fee minus the doctor's fee, as plain
// numbers like the other money columns, and stays empty until a doctor's fee is saved. Text is made formula-safe like the rest.
function manualCells(row) {
  const m = row.kind === "manual" ? row.manual : null;
  if (!m) return Array(16).fill("");
  const c = m.csv || {};
  const calc = m.calculation || {};
  return [
    csvSafe(c.company || ""),
    csvSafe(c.caseNumber || ""),
    c.serviceType || "",
    csvSafe(c.otherService || ""),
    c.caseStatus || "",
    csvSafe(c.providerNumber || ""),
    csvSafe(c.contactNumber || ""),
    Number.isFinite(calc.cents) ? centsToFixed(calc.cents) : "",
    Number.isFinite(calc.percent) ? calc.percent.toFixed(1) : "",
    c.mrStatus || "",
    c.mrSentToCompany || "",
    c.invoiceSent || "",
    c.paymentReceived || "",
    c.paymentReceivedDate || "",
    csvSafe(c.feedbackSent || ""),
    csvSafe(c.feedbackReceived || ""),
  ];
}

// One row of the list -> the cells, in COLUMNS order.
function csvCells(row) {
  const manual = row.kind === "manual";
  const source = row.sourceCsv || {};
  const money = (cents) => (Number.isFinite(cents) ? centsToFixed(cents) : "");
  return [
    manual ? row.shortId : row.id,
    source.Source ?? row.sourceGroup ?? "",
    source.Platform ?? "",
    source["Source page type"] ?? "",
    source["Source page name"] ?? "",
    source["Clicked on"] ?? "",
    bookedAt(row.bookedAt),
    row.consultation?.date || "",
    row.consultation?.time || "",
    csvSafe(row.patient?.name || ""),
    csvSafe(row.patient?.countryName || row.patient?.country || ""),
    csvSafe(row.doctorName || ""),
    yesNo(row.doctorChanged),
    money(row.feeChargedCents),
    money(row.amountPaidCents),
    money(row.entry?.doctorFeeCents),
    PAID_STATUS_LABELS[row.entry?.paidStatus] || "Unpaid",
    row.entry?.paidOn || "",
    csvSafe(row.entry?.comment || ""),
    manual ? "Manual" : row.status || "",
    yesNo(row.isTesting),
    ...manualCells(row),
  ];
}

// The Auto entries view: bookings only, so the manual-only columns are left off.
const AUTO_COLUMNS = COLUMNS.slice(0, COLUMNS.indexOf("Company"));
const autoCells = (row) => csvCells(row).slice(0, AUTO_COLUMNS.length);

// The Manual entries view: the same columns, in the same order, as the manual table (the team's sheet), with the same words
// ("MR received", "Need to pay", "Paid" for a payment received...). Numbers are plain; text is made formula-safe.
const MANUAL_COLUMNS = [
  "Date", "Company", "Case Number", "Patient Name", "Type of service", "Patient Country", "Service provider", "Status", "Consultation Fee", "Doctor's Fee",
  "MR status from provider", "MR sent status to the companies", "Invoice sent status", "Payment received", "Payment to Provider", "Payment received date",
  "Paid date to the provider", "Contact Number", "Service provider number", "Feedback Message Sent", "Feedback Received", "Calculation", "Comment",
];
function manualSheetCells(row) {
  const m = row.manual;
  const f = m.form;
  const money = (cents) => (Number.isFinite(cents) ? centsToFixed(cents) : "");
  const sheet = (label, value) => displayValue(label, value);
  const dash = (text) => (text === "—" ? "" : text);
  const calc = m.calculation || {};
  return [
    f.date,
    csvSafe(f.company),
    csvSafe(f.caseNumber),
    csvSafe(f.patientName),
    csvSafe(f.serviceType === "others" ? f.otherService || "Others" : MANUAL_LABELS.serviceType[f.serviceType] || ""),
    csvSafe(f.country),
    csvSafe(f.serviceProvider),
    dash(sheet("Status", f.caseStatus)),
    money(row.feeChargedCents),
    money(row.entry?.doctorFeeCents),
    dash(sheet("MR status from provider", f.mrStatus)),
    dash(sheet("MR sent status to the companies", f.mrSentToCompany)),
    dash(sheet("Invoice sent status", f.invoiceSent)),
    dash(sheet("Payment received", f.paymentReceived)),
    dash(sheet("Payment to Provider", f.paymentToProvider)),
    f.paymentReceivedDate,
    f.paidDateToProvider,
    csvSafe(f.contactNumber),
    csvSafe(f.providerNumber),
    csvSafe(f.feedbackSent),
    csvSafe(f.feedbackReceived),
    money(calc.cents),
    csvSafe(f.comment),
  ];
}

// The whole file. `view` picks the layout: "manual" (the sheet), "auto" (bookings only), anything else everything in one file (as it was
// first built). A byte order mark first so a spreadsheet reads the names as UTF-8; lines end with CRLF.
function buildEntriesCsv(rows, view = "all") {
  const head = view === "manual" ? MANUAL_COLUMNS : view === "auto" ? AUTO_COLUMNS : COLUMNS;
  const cells = view === "manual" ? manualSheetCells : view === "auto" ? autoCells : csvCells;
  const lines = [head, ...rows.map(cells)].map((c) => c.map(field).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}

module.exports = { COLUMNS, AUTO_COLUMNS, MANUAL_COLUMNS, csvCells, manualSheetCells, buildEntriesCsv };
