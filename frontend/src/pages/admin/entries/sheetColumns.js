// Plain helpers for the Manual entries view, the spreadsheet that looks like the team's Excel sheet (no React, so `node --test` can check
// them: see sheetColumns.test.mjs). The rows come from GET /api/admin/entries?view=manual; row.manual.form has every field of the entry as
// text (fees as "100.00", the country by name, choices as their stored keys).
import { LOCKED_WHEN_PAID, cleanFeeInput, formatDay } from "./entriesFormat.js";

// "290" or "290.50": whole dollars have no decimals, like the sheet.
export const sheetMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
};
// Cents -> the same text.
export const sheetCents = (cents) => (Number.isFinite(cents) ? sheetMoney(cents / 100) : "");

// What the sheet calls each stored choice.
export const SERVICE_LABELS = { house_call: "House call", teleconsultation: "Teleconsultation", others: "Others" };
export const STATUS_LABELS = { open: "Open", in_progress: "In progress", completed: "Completed", cancelled: "Cancelled" };
export const MR_LABELS = { pending: "MR pending", received: "MR received" };
export const MR_SENT_LABELS = { not_sent: "Not sent", sent: "MR sent" };
export const INVOICE_LABELS = { not_sent: "Not sent", sent: "Invoice sent" };
export const RECEIVED_LABELS = { not_received: "Not received", partly_received: "Partly received", received: "Paid" };
export const PROVIDER_PAY_LABELS = { unpaid: "Need to pay", on_hold: "On hold", paid: "Paid", not_payable: "Not payable" };

const options = (labels) => Object.entries(labels);

// The columns, in the order of the team's sheet. `pin` marks the four that stay on the left; `kind` is how the cell is edited;
// `show(form)` is what the cell shows; `tone(form)` an optional colour class; `edit` is the form key it edits (none for the calculation).
export const SHEET_COLUMNS = [
  { key: "date", header: "Date", pin: "s1", kind: "date", show: (f) => formatDay(f.date) },
  { key: "company", header: "Company", pin: "s2", align: "l", kind: "text", show: (f) => f.company || "—" },
  { key: "caseNumber", header: "Case Number", pin: "s3", green: true, kind: "text", show: (f) => f.caseNumber || "—" },
  { key: "patientName", header: "Patient Name", pin: "s4", green: true, align: "l", kind: "text", show: (f) => f.patientName },
  { key: "serviceType", header: "Type of service", kind: "service", show: (f) => (f.serviceType === "others" ? f.otherService || "Others" : SERVICE_LABELS[f.serviceType] || "—") },
  { key: "country", header: "Patient Country", kind: "text", show: (f) => f.country || "—" },
  { key: "serviceProvider", header: "Service provider", align: "l", kind: "text", show: (f) => f.serviceProvider },
  { key: "caseStatus", header: "Status", kind: "select", choices: options(STATUS_LABELS), show: (f) => STATUS_LABELS[f.caseStatus] || f.caseStatus },
  { key: "consultationFee", header: "Consultation Fee", align: "nr", kind: "money", show: (f) => sheetMoney(f.consultationFee) },
  { key: "doctorFee", header: "Doctor's Fee", align: "nr", kind: "money", show: (f) => (f.doctorFee === "" ? "—" : sheetMoney(f.doctorFee)) },
  { key: "mrStatus", header: "MR status from provider", kind: "select", choices: options(MR_LABELS), show: (f) => MR_LABELS[f.mrStatus] || f.mrStatus },
  { key: "mrSentToCompany", header: "MR sent status to the companies", kind: "select", choices: options(MR_SENT_LABELS), show: (f) => MR_SENT_LABELS[f.mrSentToCompany] || f.mrSentToCompany },
  { key: "invoiceSent", header: "Invoice sent status", kind: "select", choices: options(INVOICE_LABELS), show: (f) => INVOICE_LABELS[f.invoiceSent] || f.invoiceSent },
  { key: "paymentReceived", header: "Payment received", kind: "select", choices: options(RECEIVED_LABELS), show: (f) => RECEIVED_LABELS[f.paymentReceived] || f.paymentReceived },
  {
    key: "paymentToProvider",
    header: "Payment to Provider",
    kind: "select",
    choices: options(PROVIDER_PAY_LABELS),
    show: (f) => PROVIDER_PAY_LABELS[f.paymentToProvider] || f.paymentToProvider,
    tone: (f) => (f.paymentToProvider === "paid" ? "paidc" : f.paymentToProvider === "unpaid" ? "need" : ""),
  },
  { key: "paymentReceivedDate", header: "Payment received date", kind: "date", show: (f) => (f.paymentReceivedDate ? formatDay(f.paymentReceivedDate) : "—") },
  { key: "paidDateToProvider", header: "Paid date to the provider", kind: "date", show: (f) => (f.paidDateToProvider ? formatDay(f.paidDateToProvider) : "—") },
  { key: "contactNumber", header: "Contact Number", kind: "text", show: (f) => f.contactNumber || "—" },
  { key: "providerNumber", header: "Service provider number", kind: "text", show: (f) => f.providerNumber || "—" },
  { key: "feedbackSent", header: "Feedback Message Sent", align: "w", kind: "area", show: (f) => f.feedbackSent || "—" },
  { key: "feedbackReceived", header: "Feedback Received", align: "w", kind: "area", show: (f) => f.feedbackReceived || "—" },
  { key: "", header: "Calculation", align: "nr", kind: "calc" },
  { key: "comment", header: "Comment", align: "w", kind: "area", show: (f) => f.comment || "—" },
];

// The headers of the sheet in order, then "Actions".
export const SHEET_HEADERS = [...SHEET_COLUMNS.map((c) => c.header), "Actions"];

// The calculation of a row as the sheet shows it: green, or red when negative. `cents` comes from the server (consultation fee minus the
// doctor's fee, empty until a doctor's fee is saved), so while editing it is worked out from the draft instead.
export function calcCell(cents) {
  if (!Number.isFinite(cents)) return { text: "—", negative: false };
  return { text: `${cents < 0 ? "−" : ""}${sheetCents(Math.abs(cents))}`, negative: cents < 0 };
}
export function draftCalc(draft) {
  const fee = cleanFeeInput(draft.consultationFee);
  const doctor = cleanFeeInput(draft.doctorFee);
  if (!fee.ok || fee.value === "" || !doctor.ok || doctor.value === "") return calcCell(null);
  return calcCell(Math.round(Number(fee.value) * 100) - Math.round(Number(doctor.value) * 100));
}

// The total row at the bottom: how many entries, and the sums of the three money columns, from what the server says about EVERY matching
// row (not just the page). Missing doctor's fees count as 0, like the sheet.
export function sheetTotals(totals) {
  const consult = totals?.feeChargedCents ?? 0;
  const doctor = totals?.doctorFeeCents ?? 0;
  return { entries: totals?.rows ?? 0, consult: sheetCents(consult) || "0", doctor: sheetCents(doctor) || "0", calc: calcCell(consult - doctor) };
}
export const entriesText = (n) => `${n} ${n === 1 ? "entry" : "entries"}`;

// ── Inline edit ──────────────────────────────────────────────────────────────

const PHONE = /^[0-9 +\-()]{0,20}$/;

// Applies the rules that follow from a draft before it is checked and sent: the payment dates fill in with today when they apply and clear
// when they do not, and the Other service text only exists for "Others".
export function settleDraft(draft, today) {
  const d = { ...draft };
  if (d.serviceType !== "others") d.otherService = "";
  if (d.paymentReceived === "not_received") d.paymentReceivedDate = "";
  else if (!d.paymentReceivedDate) d.paymentReceivedDate = today;
  if (d.paymentToProvider === "paid") {
    if (!d.paidDateToProvider) d.paidDateToProvider = today;
  } else {
    d.paidDateToProvider = "";
  }
  return d;
}

// The first problem of a draft: { key, msg } (the key is the cell to highlight), or null. The server checks the same things again.
export function firstProblem(draft) {
  const bad = (key, msg) => ({ key, msg });
  if (!draft.date) return bad("date", "Enter the date of the case.");
  if (!draft.patientName.trim()) return bad("patientName", "Enter the patient's name.");
  if (!draft.serviceProvider.trim()) return bad("serviceProvider", "Enter the service provider.");
  if (draft.serviceType === "others" && !draft.otherService.trim()) return bad("otherService", "Describe the other service, since you chose Others.");
  if (!PHONE.test(draft.providerNumber.trim())) return bad("providerNumber", "The service provider number can have digits, spaces and + - ( ) only, up to 20 characters.");
  if (!PHONE.test(draft.contactNumber.trim())) return bad("contactNumber", "The contact number can have digits, spaces and + - ( ) only, up to 20 characters.");
  const fee = cleanFeeInput(draft.consultationFee);
  if (!fee.ok || fee.value === "") return bad("consultationFee", "Consultation fee must be a number, like 49.00 (0 is fine).");
  const doctor = cleanFeeInput(draft.doctorFee);
  if (!doctor.ok) return bad("doctorFee", "Doctor's fee must be a number, like 36.75.");
  if (draft.paymentToProvider === "paid" && !(Number(doctor.value) > 0)) return bad("doctorFee", "Payment to Provider can only be Paid with a doctor's fee above 0.");
  return null;
}

// The fields that really changed (the draft settled, against what the row had), as the body of the save, plus the version the page saw.
// Fees go as clean text; nothing is sent when nothing changed (then `changed` is empty).
export function changedFields(original, draft, version) {
  const body = {};
  for (const key of Object.keys(draft)) {
    const was = original[key] ?? "";
    let now = draft[key] ?? "";
    if (key === "consultationFee" || key === "doctorFee") {
      now = cleanFeeInput(now).value;
      const wasFee = cleanFeeInput(was).value;
      if (Number(now || 0) === Number(wasFee || 0) && (now === "") === (wasFee === "")) continue;
    } else if (typeof now === "string") {
      now = now.trim();
    }
    if (String(now) !== String(typeof was === "string" ? was.trim() : was)) body[key] = now;
  }
  return { changed: Object.keys(body), body: { ...body, version } };
}

export const isLockedWhenPaid = (key, paid) => paid && LOCKED_WHEN_PAID.includes(key);
