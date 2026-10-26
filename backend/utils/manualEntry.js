// "Manual entries" on the Appointment entries page: a case that has no booking (a house call or teleconsultation arranged for a
// company, by phone, through a partner...) typed in by an admin. They live in their own collection (models/ManualEntry.js) and carry
// the same `entry` as a booking, so the doctor fee / paid status / paid on / comment rules in utils/bookingEntry.js apply unchanged.
//
// The form has seven sections (case, service provider, patient, fees, medical report and invoice, payments, feedback). Four of its
// fields ARE the row's entry: "Doctor's fee" = entry.doctorFeeCents, "Payment to provider" = entry.paidStatus, "Paid date to the
// provider" = entry.paidOn and "Comment" = entry.comment, so the table and the three boxes keep working. "Service provider" is free
// text kept in `doctorName`, which the table shows in the Doctor column. "Calculation (our margin)" is never stored.
//
// This file has the rules for creating one, editing it (some fields lock once it is Paid to the provider) and deleting it (soft, and
// not while Paid), plus the row shape the page gets. It does not touch the database: the routes do the (versioned) writes.
const crypto = require("node:crypto");
const { Country } = require("country-state-city");
const {
  MAX_COMMENT_LENGTH,
  canEditEntries,
  parseFeeToCents,
  centsToFixed,
  isCalendarDay,
  entryView,
  applyEntryEdit,
} = require("./bookingEntry");

const MANUAL_LOG_ACTIONS = ["created", "edited", "deleted"];

const SERVICE_TYPES = ["", "house_call", "teleconsultation", "others"];
const CASE_STATUSES = ["open", "in_progress", "completed", "cancelled"];
const MR_STATUSES = ["pending", "received"];
const SENT_STATUSES = ["not_sent", "sent"];
const PAYMENT_RECEIVED = ["not_received", "partly_received", "received"];
const PAYMENT_TO_PROVIDER = ["unpaid", "on_hold", "paid", "not_payable"];

// What the page and the CSV call each value.
const LABELS = {
  serviceType: { "": "", house_call: "House call", teleconsultation: "Teleconsultation", others: "Others" },
  caseStatus: { open: "Open", in_progress: "In progress", completed: "Completed", cancelled: "Cancelled" },
  mrStatus: { pending: "Pending", received: "Received" },
  sent: { not_sent: "Not sent", sent: "Sent" },
  paymentReceived: { not_received: "Not received", partly_received: "Partly received", received: "Received" },
};

const MAX_NAME_LENGTH = 80;
const MAX_COUNTRY_LENGTH = 60;
const MAX_PROVIDER_LENGTH = 120;
const MAX_COMPANY_LENGTH = 120;
const MAX_CASE_NUMBER_LENGTH = 60;
const MAX_OTHER_SERVICE_LENGTH = 120;
const MAX_PHONE_LENGTH = 20;
const MAX_FEEDBACK_LENGTH = 1000;
const CODE_LENGTH = 4;

// Every key of the form, as the API names it, and where each one is stored.
const FORM_KEYS = [
  "date", "company", "caseNumber", "serviceType", "otherService", "caseStatus",
  "serviceProvider", "providerNumber",
  "patientName", "country", "contactNumber",
  "consultationFee", "doctorFee",
  "mrStatus", "mrSentToCompany", "invoiceSent",
  "paymentReceived", "paymentReceivedDate", "paymentToProvider", "paidDateToProvider",
  "feedbackSent", "feedbackReceived", "comment",
];
// Once the row is Paid to the provider these cannot change (the rest, and the Paid date, can).
const LOCKED_WHEN_PAID = [
  "date", "company", "caseNumber", "serviceType", "otherService", "caseStatus",
  "serviceProvider", "providerNumber",
  "patientName", "country", "contactNumber",
  "consultationFee", "doctorFee",
];
const REQUIRED_ON_CREATE = ["date", "serviceProvider", "patientName", "consultationFee"];

const DEFAULTS = {
  date: "", company: "", caseNumber: "", serviceType: "", otherService: "", caseStatus: "open",
  serviceProvider: "", providerNumber: "", patientName: "", country: "", contactNumber: "",
  consultationFee: 0, doctorFee: null,
  mrStatus: "pending", mrSentToCompany: "not_sent", invoiceSent: "not_sent",
  paymentReceived: "not_received", paymentReceivedDate: "",
  paymentToProvider: "unpaid", paidDateToProvider: "",
  feedbackSent: "", feedbackReceived: "", comment: "",
};

const fail = (status, code, msg) => ({ ok: false, status, code, msg });

// "M-1A2B" is shown, "1A2B" is stored. Random, so the caller retries on a duplicate (the collection has a unique index).
const newCode = () => crypto.randomBytes(CODE_LENGTH).toString("hex").slice(0, CODE_LENGTH).toUpperCase();
const displayCode = (code) => `M-${code}`;
// What a person may type into the search box for a code: "M-1A2B", "m1a2b", "1a2b", "a2b".
const codeSearchText = (q) => String(q || "").trim().replace(/^m-?/i, "").toUpperCase();

// eslint-disable-next-line no-control-regex
const stripControl = (text) => String(text ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();

// ── Parsing what was typed ─────────────────────────────────────────────────────────────────────────────────────────

// A country typed as a code ("IN") or a name ("india") is stored as the code; anything else is kept as text.
function normalizeCountry(input) {
  const text = stripControl(input);
  if (!text) return "";
  const lower = text.toLowerCase();
  const hit = Country.getAllCountries().find((c) => c.isoCode.toLowerCase() === lower || c.name.toLowerCase() === lower);
  return hit ? hit.isoCode : text;
}

const countryNameOf = (value) => (value ? Country.getCountryByCode(String(value))?.name || String(value) : "");

// "14:30" (a time input) or "2:30 PM" -> "2:30 PM"; "" -> ""; anything else -> undefined. (Only old rows have a time.)
function parseTime(input) {
  const text = String(input ?? "").trim();
  if (!text) return "";
  let m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(text);
  if (m) {
    const h = Number(m[1]);
    return `${h % 12 || 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
  }
  m = /^(1[0-2]|0?[1-9]):([0-5]\d)\s*([AaPp][Mm])$/.exec(text);
  return m ? `${Number(m[1])}:${m[2]} ${m[3].toUpperCase()}` : undefined;
}

const addDays = (day, n) => {
  const [y, mo, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d + n)).toISOString().slice(0, 10);
};

// The case date: a real day from 2000 up to a year ahead.
function parseDate(input, today) {
  const day = String(input ?? "").trim();
  if (!isCalendarDay(day)) return undefined;
  return day < "2000-01-01" || day > addDays(today, 366) ? undefined : day;
}

// A payment date: a real day from 2000 up to tomorrow (like the Paid on date); "" is allowed.
function parsePaymentDay(input, today) {
  const day = String(input ?? "").trim();
  if (day === "") return "";
  if (!isCalendarDay(day)) return undefined;
  return day < "2000-01-01" || day > addDays(today, 1) ? undefined : day;
}

// Loose: digits, spaces and + - ( ), at most 20 characters. "" is allowed.
const PHONE = /^[0-9 +\-()]*$/;
function parsePhone(input) {
  if (input !== null && input !== undefined && typeof input !== "string") return undefined;
  const text = String(input ?? "").trim();
  return text.length <= MAX_PHONE_LENGTH && PHONE.test(text) ? text : undefined;
}

// Free text of at most `max` characters, control characters removed and spaces tidied. "" is allowed unless `required`.
function parseText(input, max, required = false) {
  if (input !== null && input !== undefined && typeof input !== "string") return undefined;
  const text = stripControl(input);
  if (required && !text) return undefined;
  return text.length <= max ? text : undefined;
}

// A longer note: line breaks and tabs are kept.
function parseNote(input, max) {
  if (input !== null && input !== undefined && typeof input !== "string") return undefined;
  const text = String(input ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\r\n?/g, "\n").trim(); // eslint-disable-line no-control-regex
  return text.length <= max ? text : undefined;
}

const parseCountry = (input) => {
  if (input !== null && input !== undefined && typeof input !== "string") return undefined;
  const country = normalizeCountry(input);
  return country.length <= MAX_COUNTRY_LENGTH ? country : undefined;
};

const parseEnum = (input, list) => (typeof input === "string" && list.includes(input) ? input : undefined);

// Checks the keys of `body` that are in the form (any subset). Success: { ok: true, value } with each present key cleaned
// (fees in cents; doctorFee null when empty). Failure: { ok: false, status: 400, code, msg } for the first problem.
function parseManualFields(body, { today }) {
  const b = body && typeof body === "object" ? body : {};
  const value = {};
  const bad = (code, msg) => fail(400, code, msg);
  const has = (key) => Object.prototype.hasOwnProperty.call(b, key);

  if (has("date")) {
    const v = parseDate(b.date, today);
    if (!v) return bad("invalid_date", "Enter a real date for the case.");
    value.date = v;
  }
  if (has("company")) {
    const v = parseText(b.company, MAX_COMPANY_LENGTH);
    if (v === undefined) return bad("invalid_company", `Keep the company under ${MAX_COMPANY_LENGTH + 1} characters.`);
    value.company = v;
  }
  if (has("caseNumber")) {
    const v = parseText(b.caseNumber, MAX_CASE_NUMBER_LENGTH);
    if (v === undefined) return bad("invalid_case_number", `Keep the case number under ${MAX_CASE_NUMBER_LENGTH + 1} characters.`);
    value.caseNumber = v;
  }
  if (has("serviceType")) {
    const v = parseEnum(b.serviceType === null ? "" : b.serviceType, SERVICE_TYPES);
    if (v === undefined) return bad("invalid_service_type", "Pick House call, Teleconsultation or Others.");
    value.serviceType = v;
  }
  if (has("otherService")) {
    const v = parseText(b.otherService, MAX_OTHER_SERVICE_LENGTH);
    if (v === undefined) return bad("invalid_other_service", `Keep the other service under ${MAX_OTHER_SERVICE_LENGTH + 1} characters.`);
    value.otherService = v;
  }
  if (has("caseStatus")) {
    const v = parseEnum(b.caseStatus, CASE_STATUSES);
    if (v === undefined) return bad("invalid_case_status", "Pick Open, In progress, Completed or Cancelled.");
    value.caseStatus = v;
  }
  if (has("serviceProvider")) {
    const v = parseText(b.serviceProvider, MAX_PROVIDER_LENGTH, true);
    if (v === undefined) return bad("invalid_provider", `Enter the service provider (up to ${MAX_PROVIDER_LENGTH} characters).`);
    value.serviceProvider = v;
  }
  if (has("providerNumber")) {
    const v = parsePhone(b.providerNumber);
    if (v === undefined) return bad("invalid_phone", "The service provider number can have digits, spaces and + - ( ) only, up to 20 characters.");
    value.providerNumber = v;
  }
  if (has("patientName")) {
    const v = parseText(b.patientName, MAX_NAME_LENGTH, true);
    if (v === undefined) return bad("invalid_name", `Enter the patient's name (up to ${MAX_NAME_LENGTH} characters).`);
    value.patientName = v;
  }
  if (has("country")) {
    const v = parseCountry(b.country);
    if (v === undefined) return bad("invalid_country", "That country is too long.");
    value.country = v;
  }
  if (has("contactNumber")) {
    const v = parsePhone(b.contactNumber);
    if (v === undefined) return bad("invalid_phone", "The contact number can have digits, spaces and + - ( ) only, up to 20 characters.");
    value.contactNumber = v;
  }
  if (has("consultationFee")) {
    const v = parseFeeToCents(b.consultationFee);
    if (v === undefined || v === null) return bad("invalid_fee_charged", "Enter the consultation fee as an amount like 49.00 (0 is fine).");
    value.consultationFee = v;
  }
  if (has("doctorFee")) {
    const v = parseFeeToCents(b.doctorFee);
    if (v === undefined) return bad("invalid_fee", "Enter the doctor's fee as an amount like 36.75, or leave it empty.");
    value.doctorFee = v;
  }
  for (const [key, list, label] of [
    ["mrStatus", MR_STATUSES, "Pick Pending or Received for the medical report."],
    ["mrSentToCompany", SENT_STATUSES, "Pick Not sent or Sent for the medical report sent to the company."],
    ["invoiceSent", SENT_STATUSES, "Pick Not sent or Sent for the invoice."],
    ["paymentReceived", PAYMENT_RECEIVED, "Pick Not received, Partly received or Received for the payment from the company."],
    ["paymentToProvider", PAYMENT_TO_PROVIDER, "Pick Unpaid, On hold, Paid or Not payable for the payment to the provider."],
  ]) {
    if (!has(key)) continue;
    const v = parseEnum(b[key], list);
    if (v === undefined) return bad(`invalid_${key}`, label);
    value[key] = v;
  }
  for (const [key, label] of [["paymentReceivedDate", "payment received date"], ["paidDateToProvider", "paid date to the provider"]]) {
    if (!has(key)) continue;
    const v = parsePaymentDay(b[key], today);
    if (v === undefined) return bad("invalid_payment_date", `Enter a real ${label}.`);
    value[key] = v;
  }
  for (const key of ["feedbackSent", "feedbackReceived"]) {
    if (!has(key)) continue;
    const v = parseNote(b[key], MAX_FEEDBACK_LENGTH);
    if (v === undefined) return bad(`invalid_${key}`, `Keep the feedback under ${MAX_FEEDBACK_LENGTH + 1} characters.`);
    value[key] = v;
  }
  if (has("comment")) {
    const v = parseNote(b.comment, MAX_COMMENT_LENGTH);
    if (v === undefined) return bad("comment_too_long", `Keep the comment under ${MAX_COMMENT_LENGTH + 1} characters.`);
    value.comment = v;
  }
  return { ok: true, value };
}

// Rules that look at several fields together. `eff` is the whole form after the change. Fixes up what follows from the rest
// (the Other service text only exists for "Others"; a payment date only exists once something was received) and refuses the rest.
function settleForm(eff, { today }) {
  const out = { ...eff };
  if (out.serviceType === "others") {
    if (!out.otherService) return fail(400, "other_service_required", "Describe the other service.");
  } else {
    out.otherService = "";
  }
  if (out.paymentReceived === "not_received") out.paymentReceivedDate = "";
  else if (!out.paymentReceivedDate) out.paymentReceivedDate = today;
  return { ok: true, form: out };
}

// ── Money ────────────────────────────────────────────────────────────────────────────────────────────────────────────

// "Calculation (our margin)": consultation fee minus the doctor's fee, and that as a percentage of the consultation fee.
// Never stored. Empty (null) until a doctor's fee is entered; the percentage is empty when the consultation fee is 0.
function margin(consultationCents, doctorFeeCents) {
  if (!Number.isFinite(consultationCents) || !Number.isFinite(doctorFeeCents)) return { cents: null, percent: null };
  const cents = consultationCents - doctorFeeCents;
  const percent = consultationCents > 0 ? Math.round((cents / consultationCents) * 1000) / 10 : null;
  return { cents, percent };
}

// ── The entry part of a form (doctor's fee, payment to provider, its date, comment) ─────────────────────────────────

// Runs the four entry fields through the same one-edit rules a booking row uses, one after the other, so Paid needs a service
// provider and a doctor's fee above 0 and fills today's date. `wanted` has any of doctorFeeCents (null clears), paidStatus,
// paidOn, comment. Success: { ok: true, set, history, changes, entry }  Failure: { ok: false, status, code, msg }.
function composeEntryEdits(entry, wanted, ctx) {
  let current = entry;
  const set = {};
  const history = [];
  const changes = [];
  const steps = [];
  if ("doctorFeeCents" in wanted) steps.push({ field: "doctorFee", value: wanted.doctorFeeCents === null ? "" : centsToFixed(wanted.doctorFeeCents) });
  if ("paidStatus" in wanted) steps.push({ field: "paidStatus", value: wanted.paidStatus });
  if ("paidOn" in wanted) steps.push({ field: "paidOn", value: wanted.paidOn });
  if ("comment" in wanted) steps.push({ field: "comment", value: wanted.comment });
  for (const step of steps) {
    const r = applyEntryEdit(current, step, { ...ctx, doctorId: "", noDoctorMessage: "Add a service provider before marking this Paid." });
    if (!r.ok) return r;
    Object.assign(set, r.set);
    history.push(...r.history);
    changes.push(...r.changes);
    current = r.entry;
  }
  return { ok: true, set, history, changes, entry: current };
}

// What a stored entry looks like to applyEntryEdit.
const entryState = (entry) => ({
  doctorFeeCents: Number.isFinite(entry?.doctorFeeCents) ? entry.doctorFeeCents : null,
  paidStatus: entry?.paidStatus || "unpaid",
  paidOn: entry?.paidOn || "",
  comment: entry?.comment || "",
});

// The entry part of a form value: only the keys that were given (and a Paid date only while the status is Paid).
function entryWanted(value, effectiveStatus) {
  const wanted = {};
  if ("doctorFee" in value) wanted.doctorFeeCents = value.doctorFee;
  if ("paymentToProvider" in value) wanted.paidStatus = value.paymentToProvider;
  if ("paidDateToProvider" in value && effectiveStatus === "paid" && value.paidDateToProvider) wanted.paidOn = value.paidDateToProvider;
  if ("comment" in value) wanted.comment = value.comment;
  return wanted;
}

const actorOf = (actor) => ({ id: actor?.id || null, name: actor?.name || "", email: actor?.email || "", role: actor?.role || "" });

// Writes `set` ({ "entry.a.b": v }) into a plain object.
function applySet(target, set) {
  for (const [path, v] of Object.entries(set)) {
    const keys = path.split(".");
    let node = target;
    for (const k of keys.slice(0, -1)) node = node[k] ||= {};
    node[keys.at(-1)] = v;
  }
  return target;
}

// ── Create ─────────────────────────────────────────────────────────────────────────────────────────────────────────

// Checks the "Add manual entry" form. The date, service provider, patient name and consultation fee are required. Success:
// { ok: true, value } with every key of the form filled (defaults for what was not given). Failure: { ok: false, status: 400, code, msg }.
function validateManualCreate(body, { today }) {
  const b = body && typeof body === "object" ? body : {};
  for (const key of REQUIRED_ON_CREATE) {
    const missing = b[key] === undefined || b[key] === null || (typeof b[key] === "string" && !b[key].trim());
    if (!missing) continue;
    const msgs = {
      date: ["invalid_date", "Enter the date of the case."],
      serviceProvider: ["invalid_provider", "Enter the service provider."],
      patientName: ["invalid_name", "Enter the patient's name."],
      consultationFee: ["invalid_fee_charged", "Enter the consultation fee as an amount like 49.00 (0 is fine)."],
    };
    return fail(400, ...msgs[key]);
  }
  const parsed = parseManualFields(b, { today });
  if (!parsed.ok) return parsed;
  const settled = settleForm({ ...DEFAULTS, ...parsed.value }, { today });
  if (!settled.ok) return settled;
  return { ok: true, value: settled.form };
}

// The document to insert for a checked form (see validateManualCreate). The first doctor's fee, Paid status and comment are written like
// edits (who/when stamps, a history line, and the Paid rules) so the audit trail starts at creation.
// Returns { ok: true, doc } or the refusal (Paid without a doctor's fee, say).
function buildManualDocument(value, { actor, code, now = new Date(), today }) {
  const by = actorOf(actor);
  const wanted = entryWanted(value, value.paymentToProvider);
  const composed = composeEntryEdits(entryState(null), wanted, { hasDoctor: Boolean(value.serviceProvider), today, actor, now });
  if (!composed.ok) return composed;

  const entry = { paidStatus: "unpaid", paidOn: "", comment: "", v: 0, edits: {}, history: [] };
  applySet({ entry }, composed.set); // the keys are "entry.…" paths
  entry.history = composed.history;
  return {
    ok: true,
    doc: {
      code,
      date: value.date,
      company: value.company,
      caseNumber: value.caseNumber,
      serviceType: value.serviceType,
      otherService: value.otherService,
      caseStatus: value.caseStatus,
      doctorName: value.serviceProvider,
      providerNumber: value.providerNumber,
      patientName: value.patientName,
      country: value.country,
      contactNumber: value.contactNumber,
      feeChargedCents: value.consultationFee,
      mrStatus: value.mrStatus,
      mrSentToCompany: value.mrSentToCompany,
      invoiceSent: value.invoiceSent,
      paymentReceived: value.paymentReceived,
      paymentReceivedDate: value.paymentReceivedDate,
      feedbackSent: value.feedbackSent,
      feedbackReceived: value.feedbackReceived,
      entry,
      createdBy: by,
      log: [{ action: "created", field: "", from: "", to: "", by, at: now }],
    },
  };
}

// ── Edit ───────────────────────────────────────────────────────────────────────────────────────────────────────────

const isPaid = (doc) => doc?.entry?.paidStatus === "paid";

// The form as the stored row has it (keys of the form).
function formOf(doc) {
  const e = entryState(doc?.entry);
  return {
    date: doc.date || "",
    company: doc.company || "",
    caseNumber: doc.caseNumber || "",
    serviceType: doc.serviceType || "",
    otherService: doc.otherService || "",
    caseStatus: doc.caseStatus || "open",
    serviceProvider: doc.doctorName || "",
    providerNumber: doc.providerNumber || "",
    patientName: doc.patientName || "",
    country: doc.country || "",
    contactNumber: doc.contactNumber || "",
    consultationFee: Number.isFinite(doc.feeChargedCents) ? doc.feeChargedCents : 0,
    doctorFee: e.doctorFeeCents,
    mrStatus: doc.mrStatus || "pending",
    mrSentToCompany: doc.mrSentToCompany || "not_sent",
    invoiceSent: doc.invoiceSent || "not_sent",
    paymentReceived: doc.paymentReceived || "not_received",
    paymentReceivedDate: doc.paymentReceivedDate || "",
    paymentToProvider: e.paidStatus,
    paidDateToProvider: e.paidOn,
    feedbackSent: doc.feedbackSent || "",
    feedbackReceived: doc.feedbackReceived || "",
    comment: e.comment,
  };
}

const MONEY_KEYS = ["consultationFee", "doctorFee"];
const showValue = (key, v) => (MONEY_KEYS.includes(key) ? (v === null || v === undefined ? "" : centsToFixed(v)) : String(v ?? ""));

// What the popup's Save sends when editing: any of the keys of the form, plus the version the page saw (checked by the route). Pure:
// the caller does the versioned write. Rules:
//   - only an admin or super admin may edit
//   - once Payment to provider is Paid, the case fields, the service provider, the patient fields and both fees are locked (409);
//     the medical report and invoice, the payment received fields, the feedback, the comment and the Paid date stay editable
//   - Paid needs a service provider and a doctor's fee above 0 (the same one-edit rules as the table)
// Success: { ok: true, noop, changes: [{ field, from, to }], set, history, log }  (`set` has top-level keys and "entry.*" keys; the
// route adds the version bump, and pushes `history` onto entry.history and `log` onto log)
function applyManualFormEdit(doc, body, ctx) {
  const { actor, today, now = new Date() } = ctx || {};
  if (!actor || !canEditEntries(actor.role)) return fail(403, "forbidden", "Only an admin or super admin can change these.");
  const b = body && typeof body === "object" ? body : {};
  const given = FORM_KEYS.filter((k) => Object.prototype.hasOwnProperty.call(b, k));
  if (!given.length) return fail(400, "nothing_to_change", "Nothing to change.");

  const parsed = parseManualFields(b, { today });
  if (!parsed.ok) return parsed;
  const stored = formOf(doc);
  const eff = { ...stored, ...parsed.value };
  const settled = settleForm(eff, { today });
  if (!settled.ok) return settled;
  const next = settled.form;

  // Which keys of the form actually change (the settled form, so a derived change such as clearing Other service counts).
  const changedKeys = FORM_KEYS.filter((k) => next[k] !== stored[k] && !["doctorFee", "paymentToProvider", "paidDateToProvider", "comment"].includes(k));
  if ("doctorFee" in parsed.value && next.doctorFee !== stored.doctorFee) changedKeys.push("doctorFee");

  if (isPaid(doc)) {
    const locked = changedKeys.filter((k) => LOCKED_WHEN_PAID.includes(k));
    if (locked.length) return fail(409, "locked_paid", "This row is Paid to the provider, so its case, provider, patient and fee fields are locked. Change Payment to provider first.");
  }

  const wanted = entryWanted(parsed.value, next.paymentToProvider);
  const composed = composeEntryEdits(entryState(doc.entry), wanted, { hasDoctor: Boolean(next.serviceProvider), today, actor, now });
  if (!composed.ok) return composed;

  const changes = [];
  const set = {};
  const detailStore = {
    date: "date", company: "company", caseNumber: "caseNumber", serviceType: "serviceType", otherService: "otherService", caseStatus: "caseStatus",
    serviceProvider: "doctorName", providerNumber: "providerNumber", patientName: "patientName", country: "country", contactNumber: "contactNumber",
    consultationFee: "feeChargedCents", mrStatus: "mrStatus", mrSentToCompany: "mrSentToCompany", invoiceSent: "invoiceSent",
    paymentReceived: "paymentReceived", paymentReceivedDate: "paymentReceivedDate", feedbackSent: "feedbackSent", feedbackReceived: "feedbackReceived",
  };
  for (const [key, field] of Object.entries(detailStore)) {
    if (next[key] === stored[key]) continue;
    set[field] = next[key];
    changes.push({ field: key, from: showValue(key, stored[key]), to: showValue(key, next[key]) });
  }
  Object.assign(set, composed.set);
  // The entry changes (doctor's fee, status, paid date, comment) are in the row's log too, under the form's names.
  const entryNames = { doctorFee: "doctorFee", paidStatus: "paymentToProvider", paidOn: "paidDateToProvider", comment: "comment" };
  for (const c of composed.changes) changes.push({ field: entryNames[c.field], from: c.from, to: c.to });

  if (!changes.length) return { ok: true, noop: true, changes, set: {}, history: [], log: [] };
  const by = actorOf(actor);
  const log = changes.map((c) => ({ action: "edited", field: c.field, from: String(c.from), to: String(c.to), by, at: now }));
  return { ok: true, noop: false, changes, set, history: composed.history, log };
}

// ── Delete ─────────────────────────────────────────────────────────────────────────────────────────────────────────

// A manual row can be deleted (softly) unless it is already deleted or Paid.
function checkManualDelete(doc, actor) {
  if (!actor || !canEditEntries(actor.role)) return fail(403, "forbidden", "Only an admin or super admin can delete this.");
  if (!doc || doc.deletedAt) return fail(404, "not_found", "That entry was not found.");
  if (isPaid(doc)) return fail(409, "delete_paid", "This row is Paid. Change the status first, then delete it.");
  return { ok: true };
}

// The soft-delete write: what to $set and the log line to $push.
function manualDeleteWrite(actor, now = new Date()) {
  const by = actorOf(actor);
  return { set: { deletedAt: now, deletedBy: by }, log: { action: "deleted", field: "", from: "", to: "", by, at: now } };
}

// ── The row the page gets ──────────────────────────────────────────────────────────────────────────────────────────

// The form values of a stored row as the popup shows them (fees as "49.00" text, the country by name).
function formView(doc) {
  const f = formOf(doc);
  return {
    ...f,
    country: countryNameOf(f.country),
    consultationFee: centsToFixed(f.consultationFee),
    doctorFee: f.doctorFee === null ? "" : centsToFixed(f.doctorFee),
  };
}

// A stored manual row as an entries row (the same shape as a booking's, plus what Edit and Delete need). What the patient
// "paid" is the consultation fee, so the grey 75% placeholder is worked out from it; a fee of 0 shows none.
function toManualRow(doc) {
  const paidCents = Number.isFinite(doc.feeChargedCents) ? doc.feeChargedCents : 0;
  const entry = entryView(doc.entry, { paidCents });
  const locked = entry.paidStatus === "paid";
  const calc = margin(paidCents, entry.doctorFeeCents);
  return {
    kind: "manual",
    id: String(doc._id),
    shortId: displayCode(doc.code),
    bookedAt: doc.createdAt || null,
    consultation: doc.date ? { date: doc.date, time: doc.time || "" } : null,
    patient: { name: doc.patientName, country: doc.country || "", countryName: countryNameOf(doc.country) },
    doctorName: doc.doctorName || null,
    feeChargedCents: paidCents,
    amountPaidCents: paidCents,
    status: "manual",
    isTesting: false,
    entry: {
      doctorFeeCents: entry.doctorFeeCents,
      paidStatus: entry.paidStatus,
      paidOn: entry.paidOn,
      comment: entry.comment,
      version: entry.version,
      edits: entry.edits,
    },
    placeholder: entry.placeholder,
    doctorChanged: false,
    sourceGroup: "Manual",
    sourceDetail: "Added by hand on the entries page",
    sourcePage: null,
    sourceCsv: { Source: "Manual", Platform: "", "Source page type": "", "Source page name": "", "Clicked on": "" },
    cancelledAfterPaid: false,
    manual: {
      // The small grey line under the patient's name: "Company · Case number".
      caseLine: [doc.company, doc.caseNumber].map((s) => String(s || "").trim()).filter(Boolean).join(" · "),
      addedBy: doc.createdBy?.name || doc.createdBy?.email || "",
      addedAt: doc.createdAt || null,
      locked,
      canDelete: !locked,
      form: formView(doc),
      calculation: calc,
      // For the CSV: the new fields by their column values.
      csv: {
        company: doc.company || "",
        caseNumber: doc.caseNumber || "",
        serviceType: LABELS.serviceType[doc.serviceType || ""] ?? "",
        otherService: doc.otherService || "",
        caseStatus: LABELS.caseStatus[doc.caseStatus || "open"] || "Open",
        providerNumber: doc.providerNumber || "",
        contactNumber: doc.contactNumber || "",
        mrStatus: LABELS.mrStatus[doc.mrStatus || "pending"] || "Pending",
        mrSentToCompany: LABELS.sent[doc.mrSentToCompany || "not_sent"] || "Not sent",
        invoiceSent: LABELS.sent[doc.invoiceSent || "not_sent"] || "Not sent",
        paymentReceived: LABELS.paymentReceived[doc.paymentReceived || "not_received"] || "Not received",
        paymentReceivedDate: doc.paymentReceivedDate || "",
        feedbackSent: doc.feedbackSent || "",
        feedbackReceived: doc.feedbackReceived || "",
      },
    },
  };
}

module.exports = {
  MANUAL_LOG_ACTIONS,
  SERVICE_TYPES,
  CASE_STATUSES,
  MR_STATUSES,
  SENT_STATUSES,
  PAYMENT_RECEIVED,
  PAYMENT_TO_PROVIDER,
  LABELS,
  FORM_KEYS,
  LOCKED_WHEN_PAID,
  MAX_NAME_LENGTH,
  MAX_COUNTRY_LENGTH,
  MAX_PROVIDER_LENGTH,
  MAX_COMPANY_LENGTH,
  MAX_CASE_NUMBER_LENGTH,
  MAX_OTHER_SERVICE_LENGTH,
  MAX_PHONE_LENGTH,
  MAX_FEEDBACK_LENGTH,
  newCode,
  displayCode,
  codeSearchText,
  normalizeCountry,
  countryNameOf,
  parseTime,
  parseDate,
  parsePhone,
  margin,
  validateManualCreate,
  buildManualDocument,
  applyManualFormEdit,
  checkManualDelete,
  manualDeleteWrite,
  formOf,
  toManualRow,
  isPaid,
};
