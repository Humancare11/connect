// "Appointment entries": the doctor-payout record kept on each booking (Appointment and CategoryConsultation share it), typed
// in by an admin. Four editable values: the doctor fee, whether the DOCTOR has been paid, the date, and a comment.
//
// This file has the schema fragment, the rules for one edit, and small helpers. It does not touch the database: the
// list and update routes use it (and add the version check around the write).
//
// Money is stored as whole cents (doctorFeeCents). `null` means "nothing typed yet" and is not the same as 0. Old
// bookings have no `entry` at all and read as the defaults (unpaid, no fee, no date, no comment): no backfill.
const mongoose = require("mongoose");

const PAID_STATUSES = ["unpaid", "paid", "on_hold", "not_payable"];
const PAID_STATUS_LABELS = { unpaid: "Unpaid", paid: "Paid", on_hold: "On hold", not_payable: "Not payable" };
const ENTRY_FIELDS = ["doctorFee", "paidStatus", "paidOn", "comment"];
const ENTRY_TABS = ["all", ...PAID_STATUSES];

const MAX_FEE_CENTS = 100_000_000; // $1,000,000.00
const MAX_COMMENT_LENGTH = 500;
const MAX_HISTORY = 50;
// The doctor's automatic share when no fee is typed: what is left after the platform's 25% (the rule getDoctorPayments uses).
const PLATFORM_RATE = 0.25;

// Roles. Only the admin and the super admin can open this page, and both can type. The payment admin has no access.
const VIEW_ROLES = ["admin", "superadmin"];
const EDIT_ROLES = ["admin", "superadmin"];
const canViewEntries = (role) => VIEW_ROLES.includes(role);
const canEditEntries = (role) => EDIT_ROLES.includes(role);

const actorShape = () => ({
  id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  name: { type: String, default: "" },
  email: { type: String, default: "" },
  role: { type: String, default: "" },
});
const editStamp = () => ({ by: actorShape(), at: { type: Date, default: null } });

// Spread into a schema definition, next to bookingAdminFields().
const bookingEntryFields = () => ({
  entry: {
    doctorFeeCents: { type: Number, default: null, min: 0, max: MAX_FEE_CENTS },
    paidStatus: { type: String, enum: PAID_STATUSES, default: "unpaid" },
    // A calendar day, "YYYY-MM-DD" (like the consultation date), "" when not set.
    paidOn: { type: String, default: "" },
    comment: { type: String, default: "", maxlength: MAX_COMMENT_LENGTH },
    // Bumped by every successful edit; the update route only writes if the version the page saw is still the stored one.
    v: { type: Number, default: 0 },
    // The doctor the booking had when a fee was typed or the row was marked Paid. A different doctor now = a warning flag.
    doctorAtEntry: { type: String, default: "" },
    // Who last changed each field, and when.
    edits: {
      doctorFee: editStamp(),
      paidStatus: editStamp(),
      paidOn: editStamp(),
      comment: editStamp(),
    },
    // The last MAX_HISTORY changes, oldest first: { field, from, to, by, at }.
    history: {
      type: [
        new mongoose.Schema(
          {
            field: { type: String, enum: ENTRY_FIELDS },
            from: { type: String, default: "" },
            to: { type: String, default: "" },
            by: actorShape(),
            at: { type: Date, default: Date.now },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
});

// ── Money ──────────────────────────────────────────────────────────────────────────────────────────────────────────

// What someone typed -> whole cents, null (empty), or undefined (not a valid amount).
// Accepts 12, "12", "12.5", "12.50", " $12.50 ". Rejects negatives, 3 decimals, commas, letters and anything over the cap.
function parseFeeToCents(input) {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") {
    if (!Number.isFinite(input) || input < 0) return undefined;
    const cents = Math.round(input * 100);
    return Math.abs(input * 100 - cents) > 1e-6 || cents > MAX_FEE_CENTS ? undefined : cents;
  }
  if (typeof input !== "string") return undefined;
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const text = trimmed.replace(/^\$\s*/, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(text)) return undefined;
  const cents = Math.round(Number(text) * 100);
  return cents > MAX_FEE_CENTS ? undefined : cents;
}

// 7425 -> "74.25"
const centsToFixed = (cents) => (Number.isFinite(cents) ? (cents / 100).toFixed(2) : "");

// The doctor's automatic share of what the patient actually PAID (paymentAmount, in cents); null when nothing was paid.
// Same arithmetic as getDoctorPayments: the platform keeps Math.round(25%), the doctor gets the rest.
function defaultDoctorShareCents(paidCents) {
  if (!Number.isFinite(paidCents) || paidCents <= 0) return null;
  return paidCents - Math.round(paidCents * PLATFORM_RATE);
}

// 9900 -> "$99.00", 149900 -> "$1,499.00"
const formatUsdCents = (cents) =>
  `$${(Math.abs(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// 9900, "eur" -> "€99.00" (symbol first; USD, EUR and GBP only - anything else is shown as USD).
const formatMoneyCents = (cents, currency = "usd") => {
  const code = ["USD", "EUR", "GBP"].includes(String(currency).toUpperCase()) ? String(currency).toUpperCase() : "USD";
  const symbol = { USD: "$", EUR: "€", GBP: "£" }[code];
  return `${symbol}${(Math.abs(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// The grey placeholder shown while no doctor fee is typed: { cents: 7425, text: "75% · 74.25", title: "75% of $99.00 paid" },
// or null when nothing was paid. It is only ever displayed, never saved.
function doctorFeePlaceholder(paidCents, currency = "usd") {
  const cents = defaultDoctorShareCents(paidCents);
  if (cents === null) return null;
  const percent = Math.round((1 - PLATFORM_RATE) * 100);
  return { cents, text: `${percent}% · ${centsToFixed(cents)}`, title: `${percent}% of ${formatMoneyCents(paidCents, currency)} paid` };
}

// Dollars (as the Appointments list shows the fee) -> cents.
const dollarsToCents = (dollars) => (Number.isFinite(Number(dollars)) ? Math.round(Number(dollars) * 100) : 0);

// ── Dates ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const isCalendarDay = (text) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
};

const addDays = (day, n) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

// ── Reading an entry ───────────────────────────────────────────────────────────────────────────────────────────────

// The stored entry (or nothing, for an old booking) as the API returns it. `paidCents` is what the patient actually paid
// (paymentAmount), used for the grey 75% placeholder shown while no fee is typed. The placeholder is never stored.
function entryView(entry, { paidCents = 0, doctorId = "", currency = "usd" } = {}) {
  const e = entry || {};
  const fee = Number.isFinite(e.doctorFeeCents) ? e.doctorFeeCents : null;
  const status = PAID_STATUSES.includes(e.paidStatus) ? e.paidStatus : "unpaid";
  const doctorNow = doctorId ? String(doctorId) : "";
  return {
    doctorFeeCents: fee,
    placeholder: fee === null ? doctorFeePlaceholder(paidCents, currency) : null,
    paidStatus: status,
    paidOn: typeof e.paidOn === "string" ? e.paidOn : "",
    comment: typeof e.comment === "string" ? e.comment : "",
    version: Number.isInteger(e.v) ? e.v : 0,
    doctorChanged: Boolean(e.doctorAtEntry && doctorNow && e.doctorAtEntry !== doctorNow),
    edits: Object.fromEntries(
      ENTRY_FIELDS.map((f) => {
        const s = e.edits?.[f];
        return [f, s?.at ? { by: s.by?.name || s.by?.email || "", at: s.at } : null];
      }),
    ),
  };
}

// The Mongo match for one tab, for both collections. Bookings with no `entry` yet are Unpaid.
function paidStatusMatch(tab) {
  if (tab === "all" || !PAID_STATUSES.includes(tab)) return {};
  if (tab === "unpaid") return { $or: [{ "entry.paidStatus": { $exists: false } }, { "entry.paidStatus": null }, { "entry.paidStatus": "unpaid" }] };
  return { "entry.paidStatus": tab };
}

// ── One edit ───────────────────────────────────────────────────────────────────────────────────────────────────────

const fail = (status, code, msg) => ({ ok: false, status, code, msg });

// Checks one edit against the rules and works out exactly what to write. Pure: the caller does the (versioned) write.
//   current  the stored `entry` (or undefined for an old booking)
//   edit     { field: "doctorFee" | "paidStatus" | "paidOn" | "comment", value }
//   ctx      { hasDoctor, doctorId, today: "YYYY-MM-DD", actor: { id, name, email, role }, now?: Date, noDoctorMessage? }
//            (`noDoctorMessage` words the "no doctor" refusal for rows whose doctor is a free-text service provider)
// Success: { ok: true, noop, changes: [{ field, from, to }], set: { "entry.x": v }, history: [...], entry }
//   (`entry` is the view of the entry after the edit; `set` and `history` are what to write, without the version bump).
// Failure: { ok: false, status, code, msg }  (status is the HTTP status the route should answer with)
function applyEntryEdit(current, edit, ctx) {
  const { hasDoctor = false, doctorId = "", today, actor = {}, now = new Date(), noDoctorMessage = "Assign a doctor before marking this Paid." } = ctx || {};
  if (!actor || !canEditEntries(actor.role)) return fail(403, "forbidden", "Only an admin or super admin can change these.");
  if (!edit || !ENTRY_FIELDS.includes(edit.field)) return fail(400, "bad_field", "That field can't be edited.");
  if (!isCalendarDay(today || "")) return fail(500, "bad_today", "No valid date for today.");

  const before = {
    doctorFeeCents: Number.isFinite(current?.doctorFeeCents) ? current.doctorFeeCents : null,
    paidStatus: PAID_STATUSES.includes(current?.paidStatus) ? current.paidStatus : "unpaid",
    paidOn: typeof current?.paidOn === "string" ? current.paidOn : "",
    comment: typeof current?.comment === "string" ? current.comment : "",
  };
  const after = { ...before };
  const changes = [];
  const text = (field, value) => (field === "doctorFee" ? centsToFixed(value) : value === null ? "" : String(value));
  const record = (field, from, to) => {
    if (from !== to) changes.push({ field, from: text(field, from), to: text(field, to) });
  };

  const { field } = edit;
  const value = edit.value;

  if (field === "doctorFee") {
    const cents = parseFeeToCents(value);
    if (cents === undefined) return fail(400, "invalid_fee", "Enter an amount like 74.25 (up to 2 decimals, no negatives, at most 1,000,000).");
    if (cents === null && before.paidStatus === "paid") return fail(409, "fee_required", "This row is Paid, so it needs a doctor fee. Change the status first.");
    if (cents !== null && cents <= 0 && before.paidStatus === "paid") return fail(409, "fee_required", "A Paid row needs a doctor fee above 0. Change the status first.");
    after.doctorFeeCents = cents;
    record("doctorFee", before.doctorFeeCents, cents);
  } else if (field === "paidStatus") {
    if (!PAID_STATUSES.includes(value)) return fail(400, "invalid_status", "Pick Unpaid, Paid, On hold or Not payable.");
    if (value === "paid") {
      if (!hasDoctor) return fail(409, "doctor_required", noDoctorMessage);
      if (!(before.doctorFeeCents > 0)) return fail(409, "fee_required", "Enter a doctor fee above 0 before marking this Paid.");
      if (!before.paidOn) {
        after.paidOn = today;
        record("paidOn", "", today);
      }
    }
    after.paidStatus = value;
    record("paidStatus", before.paidStatus, value);
  } else if (field === "paidOn") {
    const day = value === null || value === undefined ? "" : String(value).trim();
    if (day !== "") {
      if (!isCalendarDay(day)) return fail(400, "invalid_date", "Enter a real date.");
      if (day < "2000-01-01" || day > addDays(today, 1)) return fail(400, "invalid_date", "That date is out of range.");
    }
    if (day === "" && before.paidStatus === "paid") return fail(409, "paid_on_required", "A Paid row needs a Paid on date. Change the status first.");
    after.paidOn = day;
    record("paidOn", before.paidOn, day);
  } else {
    if (value !== null && value !== undefined && typeof value !== "string") return fail(400, "invalid_comment", "The comment must be text.");
    // eslint-disable-next-line no-control-regex
    const clean = String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
    if (clean.length > MAX_COMMENT_LENGTH) return fail(400, "comment_too_long", `Keep the comment under ${MAX_COMMENT_LENGTH + 1} characters.`);
    after.comment = clean;
    record("comment", before.comment, clean);
  }

  if (changes.length === 0) return { ok: true, noop: true, changes, set: {}, history: [], entry: after };

  const by = { id: actor.id || null, name: actor.name || "", email: actor.email || "", role: actor.role || "" };
  const set = {};
  const history = [];
  const STORE = { doctorFee: "doctorFeeCents", paidStatus: "paidStatus", paidOn: "paidOn", comment: "comment" };
  for (const change of changes) {
    set[`entry.${STORE[change.field]}`] = after[STORE[change.field]];
    set[`entry.edits.${change.field}`] = { by, at: now };
    history.push({ field: change.field, from: change.from, to: change.to, by, at: now });
  }
  // Remember which doctor this money was entered against.
  if (doctorId && (field === "doctorFee" || field === "paidStatus") && (after.doctorFeeCents !== null || after.paidStatus === "paid")) {
    set["entry.doctorAtEntry"] = String(doctorId);
  }
  return { ok: true, noop: false, changes, set, history, entry: after };
}

module.exports = {
  PAID_STATUSES,
  PAID_STATUS_LABELS,
  ENTRY_FIELDS,
  ENTRY_TABS,
  MAX_FEE_CENTS,
  MAX_COMMENT_LENGTH,
  MAX_HISTORY,
  PLATFORM_RATE,
  VIEW_ROLES,
  EDIT_ROLES,
  canViewEntries,
  canEditEntries,
  bookingEntryFields,
  parseFeeToCents,
  centsToFixed,
  dollarsToCents,
  defaultDoctorShareCents,
  doctorFeePlaceholder,
  formatUsdCents,
  formatMoneyCents,
  isCalendarDay,
  entryView,
  paidStatusMatch,
  applyEntryEdit,
};
