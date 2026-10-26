// "Manual entries" on the Appointment entries page: a consultation that has no booking (arranged by phone, through a
// partner...) typed in by an admin. They live in their own collection (models/ManualEntry.js) and carry the same `entry` as a
// booking, so the doctor fee / paid status / paid on / comment rules in utils/bookingEntry.js apply to them unchanged.
//
// This file has the rules for creating one, editing its details (only while the row is not Paid), and deleting it (soft, and
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
} = require("./bookingEntry");

const MANUAL_LOG_ACTIONS = ["created", "edited", "deleted"];
const MAX_NAME_LENGTH = 80;
const MAX_COUNTRY_LENGTH = 60;
// The fields "Edit" can change, while the row is not Paid.
const DETAIL_FIELDS = ["patientName", "country", "doctor", "date", "time", "fee"];
const CODE_LENGTH = 4;

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

// "14:30" (a time input) or "2:30 PM" -> "2:30 PM"; "" -> ""; anything else -> undefined.
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

function parseDate(input, today) {
  const day = String(input ?? "").trim();
  if (!isCalendarDay(day)) return undefined;
  return day < "2000-01-01" || day > addDays(today, 366) ? undefined : day;
}

const parseName = (input) => {
  if (typeof input !== "string") return undefined;
  const name = stripControl(input);
  return name && name.length <= MAX_NAME_LENGTH ? name : undefined;
};

// Whether the country text is acceptable (empty is fine).
const parseCountry = (input) => {
  if (input !== null && input !== undefined && typeof input !== "string") return undefined;
  const country = normalizeCountry(input);
  return country.length <= MAX_COUNTRY_LENGTH ? country : undefined;
};

const parseComment = (input) => {
  if (input !== null && input !== undefined && typeof input !== "string") return undefined;
  const text = String(input ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim(); // eslint-disable-line no-control-regex
  return text.length > MAX_COMMENT_LENGTH ? undefined : text;
};

// ── Create ─────────────────────────────────────────────────────────────────────────────────────────────────────────

// Checks the "Add manual entry" form. Success: { ok: true, value } with everything cleaned (the doctor is still an id to look up).
// Failure: { ok: false, status: 400, code, msg }.
function validateManualCreate(body, { today }) {
  const b = body && typeof body === "object" ? body : {};
  const patientName = parseName(b.patientName);
  if (!patientName) return fail(400, "invalid_name", `Enter the patient's name (up to ${MAX_NAME_LENGTH} characters).`);
  const country = parseCountry(b.country);
  if (country === undefined) return fail(400, "invalid_country", "That country is too long.");
  const date = parseDate(b.date, today);
  if (!date) return fail(400, "invalid_date", "Enter a real consultation date.");
  const time = parseTime(b.time);
  if (time === undefined) return fail(400, "invalid_time", "Enter a real time, like 10:30.");
  const feeChargedCents = parseFeeToCents(b.feeCharged);
  if (feeChargedCents === undefined || feeChargedCents === null) {
    return fail(400, "invalid_fee_charged", "Enter the fee charged as an amount like 49.00 (0 is fine for a free consultation).");
  }
  const doctorFeeCents = parseFeeToCents(b.doctorFee);
  if (doctorFeeCents === undefined) return fail(400, "invalid_fee", "Enter the doctor fee as an amount like 36.75, or leave it empty.");
  const comment = parseComment(b.comment);
  if (comment === undefined) return fail(400, "comment_too_long", `Keep the comment under ${MAX_COMMENT_LENGTH + 1} characters.`);
  const doctorId = b.doctorId === null || b.doctorId === undefined || b.doctorId === "" ? "" : String(b.doctorId);
  return { ok: true, value: { patientName, country, date, time, feeChargedCents, doctorFeeCents, comment, doctorId } };
}

const actorOf = (actor) => ({ id: actor?.id || null, name: actor?.name || "", email: actor?.email || "", role: actor?.role || "" });

// The document to insert for a checked form. `doctor` is { enrollmentId, name } or null. The first fee and comment are written
// like edits (who/when stamps and a history line) so the audit trail starts at creation.
function buildManualDocument(value, { actor, doctor = null, code, now = new Date() }) {
  const by = actorOf(actor);
  const edits = {};
  const history = [];
  const entry = { paidStatus: "unpaid", paidOn: "", v: 0 };
  if (value.doctorFeeCents !== null) {
    entry.doctorFeeCents = value.doctorFeeCents;
    edits.doctorFee = { by, at: now };
    history.push({ field: "doctorFee", from: "", to: centsToFixed(value.doctorFeeCents), by, at: now });
  }
  entry.comment = value.comment;
  if (value.comment) {
    edits.comment = { by, at: now };
    history.push({ field: "comment", from: "", to: value.comment, by, at: now });
  }
  return {
    code,
    patientName: value.patientName,
    country: value.country,
    doctorEnrollmentId: doctor?.enrollmentId || null,
    doctorName: doctor?.name || "",
    date: value.date,
    time: value.time,
    feeChargedCents: value.feeChargedCents,
    entry: { ...entry, edits, history },
    createdBy: by,
    log: [{ action: "created", field: "", from: "", to: "", by, at: now }],
  };
}

// ── Edit the details (not while Paid) ──────────────────────────────────────────────────────────────────────────────

const isPaid = (doc) => doc?.entry?.paidStatus === "paid";

// What "Edit" sends: any of patientName, country, doctorId, date, time, feeCharged. Pure: the caller does the versioned write.
//   doc  the stored manual row; ctx { actor, today, doctor: { enrollmentId, name } | null | undefined, now? }
//        `doctor` is only looked at when body.doctorId is present: null = no doctor, an object = the resolved approved doctor.
// Success: { ok: true, noop, changes: [{ field, from, to }], set, log }  (`set` is what to write, without the version bump)
function applyManualDetailsEdit(doc, body, ctx) {
  const { actor, today, doctor, now = new Date() } = ctx || {};
  if (!actor || !canEditEntries(actor.role)) return fail(403, "forbidden", "Only an admin or super admin can change these.");
  if (isPaid(doc)) return fail(409, "locked_paid", "This row is Paid, so its details are locked. Change the status first.");
  const b = body && typeof body === "object" ? body : {};
  const given = ["patientName", "country", "doctorId", "date", "time", "feeCharged"].filter((k) => k in b);
  if (!given.length) return fail(400, "nothing_to_change", "Nothing to change.");

  const next = {};
  const changes = [];
  const note = (field, from, to) => {
    if (from !== to) changes.push({ field, from, to });
  };

  if ("patientName" in b) {
    const v = parseName(b.patientName);
    if (!v) return fail(400, "invalid_name", `Enter the patient's name (up to ${MAX_NAME_LENGTH} characters).`);
    next.patientName = v;
    note("patientName", doc.patientName || "", v);
  }
  if ("country" in b) {
    const v = parseCountry(b.country);
    if (v === undefined) return fail(400, "invalid_country", "That country is too long.");
    next.country = v;
    note("country", doc.country || "", v);
  }
  if ("doctorId" in b) {
    const wanted = b.doctorId === null || b.doctorId === "" ? "" : String(b.doctorId);
    if (wanted && !doctor) return fail(400, "invalid_doctor", "Pick a doctor from the approved list.");
    next.doctorEnrollmentId = wanted ? doctor.enrollmentId : null;
    next.doctorName = wanted ? doctor.name : "";
    note("doctor", doc.doctorName || "", next.doctorName);
  }
  if ("date" in b) {
    const v = parseDate(b.date, today);
    if (!v) return fail(400, "invalid_date", "Enter a real consultation date.");
    next.date = v;
    note("date", doc.date || "", v);
  }
  if ("time" in b) {
    const v = parseTime(b.time);
    if (v === undefined) return fail(400, "invalid_time", "Enter a real time, like 10:30.");
    next.time = v;
    note("time", doc.time || "", v);
  }
  if ("feeCharged" in b) {
    const v = parseFeeToCents(b.feeCharged);
    if (v === undefined || v === null) return fail(400, "invalid_fee_charged", "Enter the fee charged as an amount like 49.00 (0 is fine).");
    next.feeChargedCents = v;
    note("fee", centsToFixed(doc.feeChargedCents), centsToFixed(v));
  }

  if (!changes.length) return { ok: true, noop: true, changes, set: {}, log: [] };
  const by = actorOf(actor);
  const log = changes.map((c) => ({ action: "edited", field: c.field, from: String(c.from), to: String(c.to), by, at: now }));
  return { ok: true, noop: false, changes, set: next, log };
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

// A stored manual row as an entries row (the same shape as a booking's, plus what Edit and Delete need). What the patient
// "paid" is the fee charged, so the grey 75% placeholder is worked out from it; a fee of 0 shows none.
function toManualRow(doc) {
  const paidCents = Number.isFinite(doc.feeChargedCents) ? doc.feeChargedCents : 0;
  const entry = entryView(doc.entry, { paidCents });
  const locked = entry.paidStatus === "paid";
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
      doctorId: doc.doctorEnrollmentId ? String(doc.doctorEnrollmentId) : "",
      time: doc.time || "",
      addedBy: doc.createdBy?.name || doc.createdBy?.email || "",
      addedAt: doc.createdAt || null,
      locked,
      canDelete: !locked,
    },
  };
}

module.exports = {
  MANUAL_LOG_ACTIONS,
  MAX_NAME_LENGTH,
  MAX_COUNTRY_LENGTH,
  DETAIL_FIELDS,
  newCode,
  displayCode,
  codeSearchText,
  normalizeCountry,
  countryNameOf,
  parseTime,
  parseDate,
  validateManualCreate,
  buildManualDocument,
  applyManualDetailsEdit,
  checkManualDelete,
  manualDeleteWrite,
  toManualRow,
  isPaid,
};
