// The Appointment entries CSV: one line per row of the list the filters match (bookings and manual entries), with the
// booking-source columns. Pure text building; utils/bookingEntryList.js loads the rows.
//
// Money is plain numbers with two decimals ("74.25"). The doctor fee column holds only what was SAVED: the grey 75%
// suggestion on the page is never exported. Text from visitors and admins is made formula-safe, then quoted.
const { PAID_STATUS_LABELS, centsToFixed } = require("./bookingEntry");
const { csvSafe } = require("./bookingSource");

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
  ];
}

// The whole file. A byte order mark first so a spreadsheet reads the names as UTF-8; lines end with CRLF.
function buildEntriesCsv(rows) {
  const lines = [COLUMNS, ...rows.map(csvCells)].map((cells) => cells.map(field).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}

module.exports = { COLUMNS, csvCells, buildEntriesCsv };
