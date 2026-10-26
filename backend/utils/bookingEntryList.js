// The "Appointment entries" list: one row per booked appointment, read from the two booking collections as one list.
//
// Rows: every Appointment, and only the PAID CategoryConsultations (an unpaid or refunded one has nothing to pay a doctor
// for). Cancelled and testing bookings are left out unless asked for (includeCancelled / includeTesting). Manual entries
// (their own collection, no booking behind them) are rows too; the include flags do not apply to them, and a soft-deleted
// one is never a row.
//
// Everything the page shows comes from here: the rows of one page, the count for each paid-status tab, the totals over
// every matching row (not just the page), and the doctors and months to pick from. All of it is worked out on the server.
//   Tab counts follow the include flags and the doctor and month filters, but not the search text.
//   Totals and the page follow the tab, the search text and every filter.
const mongoose = require("mongoose");
const { Country } = require("country-state-city");
const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const ManualEntry = require("../models/ManualEntry");
const { toAppointmentRow, toCategoryRow } = require("./adminBookingList");
const { sourceCsvColumns } = require("./bookingSource");
const { ENTRY_TABS, PAID_STATUSES, paidStatusMatch, entryView, dollarsToCents } = require("./bookingEntry");
const { toManualRow, codeSearchText } = require("./manualEntry");

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const MAX_PAGE = 1000;
// The CSV is cut at this many rows (the response says so when it was); rows are loaded in chunks of EXPORT_CHUNK.
const MAX_EXPORT_ROWS = 20000;
const EXPORT_CHUNK = 500;
// "-" = newest first (the default), no "-" = oldest first. Bookings with no consultation date always come last.
const SORTS = {
  "-consultation": { by: "consultation", dir: -1 },
  consultation: { by: "consultation", dir: 1 },
  "-bookedAt": { by: "bookedAt", dir: -1 },
  bookedAt: { by: "bookedAt", dir: 1 },
};

class EntryListQueryError extends Error {}

// ── Query parsing ────────────────────────────────────────────────────────────

const parseInteger = (raw, name, fallback) => {
  if (raw === undefined || raw === "") return fallback;
  if (!/^\d+$/.test(String(raw))) throw new EntryListQueryError(`${name} must be a positive whole number.`);
  return Number(raw);
};

const parseFlag = (raw, name) => {
  const value = String(raw ?? "false").toLowerCase();
  if (!["true", "1", "false", "0"].includes(value)) throw new EntryListQueryError(`${name} must be true or false.`);
  return value === "true" || value === "1";
};

function parseEntriesQuery(query = {}) {
  const tab = String(query.tab || "all").toLowerCase();
  if (!ENTRY_TABS.includes(tab)) throw new EntryListQueryError(`Invalid tab. Allowed values: ${ENTRY_TABS.join(", ")}.`);

  const page = parseInteger(query.page, "page", 1);
  if (page < 1 || page > MAX_PAGE) throw new EntryListQueryError(`page must be between 1 and ${MAX_PAGE}.`);
  const limit = parseInteger(query.limit, "limit", DEFAULT_LIMIT);
  if (limit < 1) throw new EntryListQueryError("limit must be at least 1.");

  const sort = String(query.sort || "-consultation");
  if (!(sort in SORTS)) throw new EntryListQueryError(`Invalid sort. Allowed values: ${Object.keys(SORTS).join(", ")}.`);

  let month = "";
  if (query.month !== undefined && query.month !== "") {
    month = String(query.month);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month < "2000-01") throw new EntryListQueryError("month must look like 2026-10.");
  }

  let doctor = "";
  if (query.doctor !== undefined && query.doctor !== "") {
    doctor = String(query.doctor);
    if (!mongoose.isValidObjectId(doctor) || !/^[0-9a-f]{24}$/i.test(doctor)) throw new EntryListQueryError("doctor must be a doctor id.");
  }

  for (const key of ["q", "tab", "sort", "month", "doctor"]) {
    if (Array.isArray(query[key])) throw new EntryListQueryError(`${key} must be given once.`);
  }

  return {
    tab,
    page,
    limit: Math.min(limit, MAX_LIMIT),
    sort,
    month,
    doctor,
    includeCancelled: parseFlag(query.includeCancelled, "includeCancelled"),
    includeTesting: parseFlag(query.includeTesting, "includeTesting"),
    q: String(query.q || "").trim().slice(0, 100),
  };
}

// ── Filters ──────────────────────────────────────────────────────────────────

const combine = (...filters) => {
  const parts = filters.filter((f) => f && Object.keys(f).length);
  return parts.length ? { $and: parts } : {};
};

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// "2026-10" -> every consultation date from 2026-10-01 up to (not including) 2026-11-01 (dates are "YYYY-MM-DD" text).
function monthRange(month) {
  const [year, mon] = month.split("-").map(Number);
  const next = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, "0")}`;
  return { $gte: `${month}-01`, $lt: `${next}-01` };
}

// The doctor filter. The page's doctor list uses the doctor's Enrollment id (as the assign page does); an Appointment points at
// the Doctor record and a category consultation at the Enrollment, so one id has to become one filter for each. A manual entry has no
// doctor record: its service provider is free text, so it matches when that text is exactly the doctor's name.
async function doctorFilters(id) {
  if (!id) return null;
  const byName = (...names) => ({ doctorName: { $in: names.filter(Boolean) } });
  const enrollmentName = (e) => `${e.firstName || ""} ${e.surname || ""}`.trim();
  const enrollment = await Enrollment.findById(id).select("_id doctorId firstName surname").lean();
  if (enrollment) {
    const doctor = enrollment.doctorId ? await Doctor.findById(enrollment.doctorId).select("name").lean() : null;
    return {
      appointment: enrollment.doctorId ? { doctorId: enrollment.doctorId } : { _id: { $in: [] } },
      category: { assignedDoctorId: enrollment._id },
      manual: byName(doctor?.name, enrollmentName(enrollment)),
    };
  }
  const doctor = await Doctor.findById(id).select("_id name").lean();
  if (doctor) {
    const enrollments = await Enrollment.find({ doctorId: doctor._id }).select("_id firstName surname").lean();
    return {
      appointment: { doctorId: doctor._id },
      category: { assignedDoctorId: { $in: enrollments.map((e) => e._id) } },
      manual: byName(doctor.name, ...enrollments.map(enrollmentName)),
    };
  }
  const nobody = { _id: { $in: [] } };
  return { appointment: nobody, category: nobody, manual: nobody };
}

// Which bookings are rows at all (the include flags), before the tab, search and the doctor and month filters.
function eligibility({ includeCancelled, includeTesting }) {
  return {
    appointment: combine(includeCancelled ? null : { status: { $ne: "cancelled" } }, includeTesting ? null : { isTesting: { $ne: true } }),
    category: combine({ paymentStatus: "paid" }, includeCancelled ? null : { status: { $ne: "Cancelled" } }, includeTesting ? null : { isTesting: { $ne: true } }),
    // A manual entry is never cancelled or a test; only a deleted one is not a row.
    manual: { deletedAt: null },
  };
}

// Search: patient (name, email), doctor, booking id (full, or any part such as the short form) and country (by name or code).
// A search over a very common word looks at the first few hundred people it finds, like the Appointments search.
async function searchFilters(q) {
  if (!q) return null;
  const rx = new RegExp(escapeRegex(q), "i");
  const lower = q.toLowerCase();
  const codes = q.length >= 2 ? Country.getAllCountries().filter((c) => c.name.toLowerCase().includes(lower)).map((c) => c.isoCode) : [];

  const [users, countryUsers, doctors, enrollments] = await Promise.all([
    User.find({ $or: [{ name: rx }, { email: rx }] }).select("_id").limit(300).lean(),
    User.find({ $or: [{ country: rx }, ...(codes.length ? [{ country: { $in: codes } }] : [])] }).select("_id").limit(2000).lean(),
    Doctor.find({ name: rx }).select("_id").limit(300).lean(),
    Enrollment.find({
      $or: [{ firstName: rx }, { surname: rx }, { $expr: { $regexMatch: { input: { $concat: [{ $ifNull: ["$firstName", ""] }, " ", { $ifNull: ["$surname", ""] }] }, regex: escapeRegex(q), options: "i" } } }],
    })
      .select("_id doctorId")
      .limit(300)
      .lean(),
  ]);
  const doctorEnrollments = doctors.length ? await Enrollment.find({ doctorId: { $in: doctors.map((d) => d._id) } }).select("_id").limit(300).lean() : [];

  const idClause = /^[0-9a-f]+$/i.test(q) ? [{ $expr: { $regexMatch: { input: { $toString: "$_id" }, regex: escapeRegex(q), options: "i" } } }] : [];
  const patientIds = [...users, ...countryUsers].map((u) => u._id);
  const countryValues = [rx, ...codes];
  const apptDoctorIds = [...doctors.map((d) => d._id), ...enrollments.map((e) => e.doctorId).filter(Boolean)];
  const categoryDoctorIds = [...enrollments.map((e) => e._id), ...doctorEnrollments.map((e) => e._id)];

  // A manual entry: patient name, service provider, company, case number, country (name or code), its "M-1A2B" code (any part, with
  // or without "M-") or its id.
  const code = codeSearchText(q);
  const codeClause = /^[0-9A-F]+$/.test(code) ? [{ code: new RegExp(escapeRegex(code)) }] : [];
  return {
    manual: { $or: [...idClause, ...codeClause, { patientName: rx }, { doctorName: rx }, { company: rx }, { caseNumber: rx }, { country: { $in: countryValues } }] },
    appointment: {
      $or: [...idClause, { patientId: { $in: patientIds } }, { doctorId: { $in: apptDoctorIds } }, { "patientDetails.country": { $in: countryValues } }],
    },
    category: {
      $or: [...idClause, { patientId: { $in: patientIds } }, { assignedDoctorId: { $in: categoryDoctorIds } }, { assignedDoctorName: rx }],
    },
  };
}

// ── Aggregations ─────────────────────────────────────────────────────────────

// What the Appointments list shows as the fee, in cents: the listed price when there is one, else what was paid.
const FEE_CENTS = {
  $let: {
    vars: {
      price: { $convert: { input: "$consultationPrice", to: "double", onError: 0, onNull: 0 } },
      paid: { $convert: { input: "$paymentAmount", to: "double", onError: 0, onNull: 0 } },
    },
    in: { $cond: [{ $gt: ["$$price", 0] }, { $round: [{ $multiply: ["$$price", 100] }, 0] }, { $cond: [{ $gt: ["$$paid", 0] }, "$$paid", 0] }] },
  },
};

const emptyCounts = () => ({ all: 0, ...Object.fromEntries(PAID_STATUSES.map((s) => [s, 0])) });

async function loadTotals(appointmentFilter, categoryFilter, manualFilter) {
  const group = (filter, fee = FEE_CENTS) => [
    { $match: filter },
    { $group: { _id: null, rows: { $sum: 1 }, feeChargedCents: { $sum: fee }, doctorFeeCents: { $sum: { $ifNull: ["$entry.doctorFeeCents", 0] } } } },
  ];
  const [a, c, m] = await Promise.all([
    Appointment.aggregate(group(appointmentFilter)),
    CategoryConsultation.aggregate(group(categoryFilter)),
    ManualEntry.aggregate(group(manualFilter, { $ifNull: ["$feeChargedCents", 0] })),
  ]);
  const totals = { rows: 0, feeChargedCents: 0, doctorFeeCents: 0 };
  for (const row of [...a, ...c, ...m]) {
    totals.rows += row.rows;
    totals.feeChargedCents += row.feeChargedCents;
    totals.doctorFeeCents += row.doctorFeeCents;
  }
  return totals;
}

// The first `need` keys of one collection in the page order; the two lists are then merged and cut to the page.
function keysPipeline(filter, sort, need, bookedExpr) {
  const hasDate = { $cond: [{ $gt: [{ $strLenCP: { $convert: { input: "$date", to: "string", onError: "", onNull: "" } } }, 0] }, 1, 0] };
  const order = sort.by === "consultation" ? { _hasDate: -1, date: sort.dir, _booked: sort.dir, _id: sort.dir } : { _booked: sort.dir, _id: sort.dir };
  return [
    { $match: filter },
    { $addFields: { _hasDate: hasDate, _booked: bookedExpr } },
    { $sort: order },
    { $limit: need },
    { $project: { _id: 1, date: 1, _hasDate: 1, _booked: 1 } },
  ];
}

// The doctors and consultation months that have rows (with the include flags applied, but not the tab, search, doctor or month).
async function loadChoices(filter) {
  const months = { $group: { _id: { $substrCP: [{ $convert: { input: "$date", to: "string", onError: "", onNull: "" } }, 0, 7] } } };
  const [apptDoctors, catDoctors, apptMonths, catMonths, manualMonths] = await Promise.all([
    Appointment.aggregate([{ $match: combine(filter.appointment, { doctorId: { $ne: null } }) }, { $group: { _id: "$doctorId" } }]),
    CategoryConsultation.aggregate([{ $match: combine(filter.category, { assignedDoctorId: { $ne: null } }) }, { $group: { _id: "$assignedDoctorId" } }]),
    Appointment.aggregate([{ $match: filter.appointment }, months]),
    CategoryConsultation.aggregate([{ $match: filter.category }, months]),
    ManualEntry.aggregate([{ $match: filter.manual }, months]),
  ]);

  const doctorIds = apptDoctors.map((r) => r._id);
  const enrollmentIds = catDoctors.map((r) => r._id);
  const [doctors, enrollments] = await Promise.all([
    Doctor.find({ _id: { $in: doctorIds } }).select("name").lean(),
    Enrollment.find({ $or: [{ _id: { $in: enrollmentIds } }, { doctorId: { $in: doctorIds } }] }).select("firstName surname doctorId").lean(),
  ]);
  const doctorName = new Map(doctors.map((d) => [String(d._id), d.name || ""]));
  const list = new Map();
  const covered = new Set();
  for (const e of enrollments) {
    const wanted = enrollmentIds.some((id) => String(id) === String(e._id)) || (e.doctorId && doctorName.has(String(e.doctorId)));
    if (!wanted) continue;
    if (e.doctorId) covered.add(String(e.doctorId));
    const name = (e.doctorId && doctorName.get(String(e.doctorId))) || `${e.firstName || ""} ${e.surname || ""}`.trim() || "Doctor";
    list.set(String(e._id), { id: String(e._id), name });
  }
  for (const d of doctors) if (!covered.has(String(d._id))) list.set(String(d._id), { id: String(d._id), name: d.name || "Doctor" });

  const monthList = [...new Set([...apptMonths, ...catMonths, ...manualMonths].map((r) => r._id).filter((m) => /^\d{4}-\d{2}$/.test(m)))].sort().reverse();
  return { doctors: [...list.values()].sort((x, y) => x.name.localeCompare(y.name)), months: monthList };
}

// ── Rows ─────────────────────────────────────────────────────────────────────

const ENTRY_SELECT = "entry.doctorFeeCents entry.paidStatus entry.paidOn entry.comment entry.v entry.doctorAtEntry entry.edits source";

const findAppointments = (ids) =>
  Appointment.find({ _id: { $in: ids } })
    .select(`patientId patientDetails doctorId category date time patientTimezone consultationPrice paymentAmount paymentStatus paymentGateway status assignedBy originalDoctorName isTesting bookedAt createdAt ${ENTRY_SELECT}`)
    .populate("patientId", "name country")
    .populate("doctorId", "name")
    .lean();

const findCategories = (ids) =>
  CategoryConsultation.find({ _id: { $in: ids } })
    .select(`patientId assignedDoctorId assignedDoctorName categoryName date slot assignedSlot appointmentType urgency consultationPrice paymentAmount paymentStatus paymentGateway status assignedBy originalDoctorName isTesting createdAt ${ENTRY_SELECT}`)
    .populate("patientId", "name country")
    .populate("assignedDoctorId", "firstName surname")
    .lean();

const findManuals = (ids) => ManualEntry.find({ _id: { $in: ids }, deletedAt: null }).lean();

const paidCentsOf = (doc) => {
  const paid = Number(doc.paymentAmount);
  return Number.isFinite(paid) && paid > 0 ? Math.round(paid) : 0;
};

const countryNameOf = (value) => (value ? Country.getCountryByCode(String(value))?.name || String(value) : "");

// One booking as an entries row. `doctorKey` identifies the doctor the way the entry remembers it (the Doctor id for an
// appointment, the Enrollment id for a category consultation).
function toEntryRow(kind, doc) {
  const base = kind === "category" ? toCategoryRow(doc) : toAppointmentRow(doc);
  const paidCents = paidCentsOf(doc);
  const doctorKey = kind === "category" ? doc.assignedDoctorId?._id : doc.doctorId?._id;
  const entry = entryView(doc.entry, { paidCents, doctorId: base.doctorName ? doctorKey || "" : "" });
  return {
    kind,
    id: base.id,
    shortId: base.shortId,
    bookedAt: base.bookedAt,
    consultation: base.consultation ? { date: base.consultation.date, time: base.consultation.time } : null,
    patient: { name: base.patient.name, country: base.patient.country, countryName: countryNameOf(base.patient.country) },
    doctorName: base.doctorName,
    feeChargedCents: dollarsToCents(base.fee),
    amountPaidCents: paidCents,
    status: base.status,
    isTesting: base.isTesting,
    entry: {
      doctorFeeCents: entry.doctorFeeCents,
      paidStatus: entry.paidStatus,
      paidOn: entry.paidOn,
      comment: entry.comment,
      version: entry.version,
      edits: entry.edits,
    },
    placeholder: entry.placeholder,
    doctorChanged: entry.doctorChanged,
    // Where the booking came from (the same three fields as the Appointments list) and its CSV columns.
    sourceGroup: base.sourceGroup,
    sourceDetail: base.sourceDetail,
    sourcePage: base.sourcePage,
    sourceCsv: sourceCsvColumns(doc.source),
    // A booking cancelled after its doctor was marked Paid: only visible with includeCancelled, flagged for a refund check.
    cancelledAfterPaid: base.status === "cancelled" && entry.paidStatus === "paid",
  };
}

// ── The list ─────────────────────────────────────────────────────────────────

// The filters of one request: which bookings are rows at all (`eligible`), after the doctor and month filters (`scoped`), and
// after the tab and the search as well (`full`). One object per source.
async function buildScopes(params) {
  const { tab, month, doctor, includeCancelled, includeTesting, q } = params;
  const eligible = eligibility({ includeCancelled, includeTesting });
  const [doctorFilter, search] = await Promise.all([doctorFilters(doctor), searchFilters(q)]);
  const monthFilter = month ? { date: monthRange(month) } : null;

  const scoped = {
    appointment: combine(eligible.appointment, monthFilter, doctorFilter?.appointment),
    category: combine(eligible.category, monthFilter, doctorFilter?.category),
    manual: combine(eligible.manual, monthFilter, doctorFilter?.manual),
  };
  const tabMatch = paidStatusMatch(tab);
  const full = {
    appointment: combine(scoped.appointment, tabMatch, search?.appointment),
    category: combine(scoped.category, tabMatch, search?.category),
    manual: combine(scoped.manual, tabMatch, search?.manual),
  };
  return { eligible, scoped, full };
}

// The key lists of the three sources (each already in page order) as one list in page order.
function mergeKeys({ appointment, category, manual }, order) {
  const time = (row) => new Date(row._booked || 0).getTime();
  const cmp = (x, y) => {
    if (order.by === "consultation") {
      if (x._hasDate !== y._hasDate) return y._hasDate - x._hasDate;
      const dx = String(x.date || "");
      const dy = String(y.date || "");
      if (dx !== dy) return order.dir * (dx < dy ? -1 : 1);
    }
    return order.dir * (time(x) - time(y)) || order.dir * String(x._id).localeCompare(String(y._id));
  };
  return [
    ...appointment.map((k) => ({ ...k, kind: "appointment" })),
    ...category.map((k) => ({ ...k, kind: "category" })),
    ...manual.map((k) => ({ ...k, kind: "manual" })),
  ].sort(cmp);
}

// Full rows for a list of keys, in the same order (a key whose row has gone is skipped).
async function loadRows(keys) {
  const idsOf = (kind) => keys.filter((k) => k.kind === kind).map((k) => k._id);
  const [appointments, categories, manuals] = await Promise.all([
    idsOf("appointment").length ? findAppointments(idsOf("appointment")) : [],
    idsOf("category").length ? findCategories(idsOf("category")) : [],
    idsOf("manual").length ? findManuals(idsOf("manual")) : [],
  ]);
  const rows = new Map([
    ...appointments.map((a) => [`appointment:${a._id}`, toEntryRow("appointment", a)]),
    ...categories.map((c) => [`category:${c._id}`, toEntryRow("category", c)]),
    ...manuals.map((m) => [`manual:${m._id}`, toManualRow(m)]),
  ]);
  return keys.map((k) => rows.get(`${k.kind}:${k._id}`)).filter(Boolean);
}

async function listBookingEntries(query) {
  const params = parseEntriesQuery(query);
  const { tab, page, limit, sort, month, doctor, includeCancelled, includeTesting, q } = params;
  const order = SORTS[sort];

  const { eligible, scoped, full } = await buildScopes(params);

  const start = (page - 1) * limit;
  const need = start + limit;
  const [{ counts, summary }, totals, choices, appointmentKeys, categoryKeys, manualKeys] = await Promise.all([
    loadCounts(scoped),
    loadTotals(full.appointment, full.category, full.manual),
    loadChoices(eligible),
    Appointment.aggregate(keysPipeline(full.appointment, order, need, { $ifNull: ["$bookedAt", "$createdAt"] })),
    CategoryConsultation.aggregate(keysPipeline(full.category, order, need, "$createdAt")),
    ManualEntry.aggregate(keysPipeline(full.manual, order, need, "$createdAt")),
  ]);

  const pageKeys = mergeKeys({ appointment: appointmentKeys, category: categoryKeys, manual: manualKeys }, order).slice(start, start + limit);

  return {
    items: await loadRows(pageKeys),
    counts,
    summary,
    totals,
    doctors: choices.doctors,
    months: choices.months,
    page,
    limit,
    total: totals.rows,
    totalPages: Math.ceil(totals.rows / limit),
    tab,
    sort,
    filters: { doctor, month, includeCancelled, includeTesting },
  };
}

// The count for each tab, and the three boxes at the top (what is still owed to doctors, what has been paid, rows with no doctor
// fee yet): the include flags and the doctor and month filters apply, the search text and the tab do not.
//   toPayCents          saved doctor fees on Unpaid rows
//   paidCents           saved doctor fees on Paid rows
//   feeNotEnteredCount  rows with no saved doctor fee, not counting Not payable rows
async function loadCounts(scoped) {
  const group = (filter) => [
    { $match: filter },
    {
      $group: {
        _id: { $ifNull: ["$entry.paidStatus", "unpaid"] },
        n: { $sum: 1 },
        feeCents: { $sum: { $ifNull: ["$entry.doctorFeeCents", 0] } },
        noFee: { $sum: { $cond: [{ $eq: [{ $ifNull: ["$entry.doctorFeeCents", null] }, null] }, 1, 0] } },
      },
    },
  ];
  const [a, c, m] = await Promise.all([
    Appointment.aggregate(group(scoped.appointment)),
    CategoryConsultation.aggregate(group(scoped.category)),
    ManualEntry.aggregate(group(scoped.manual)),
  ]);
  const counts = emptyCounts();
  const summary = { toPayCents: 0, paidCents: 0, feeNotEnteredCount: 0 };
  for (const row of [...a, ...c, ...m]) {
    const key = PAID_STATUSES.includes(row._id) ? row._id : "unpaid";
    counts[key] += row.n;
    counts.all += row.n;
    if (key === "unpaid") summary.toPayCents += row.feeCents;
    if (key === "paid") summary.paidCents += row.feeCents;
    if (key !== "not_payable") summary.feeNotEnteredCount += row.noFee;
  }
  return { counts, summary };
}

// Every row the filters match (the page and limit are ignored), for the CSV: at most `cap` of them, in the list's order.
// Returns { rows, total, truncated }.
async function listAllEntryRows(query, cap = MAX_EXPORT_ROWS) {
  const params = parseEntriesQuery(query);
  const order = SORTS[params.sort];
  const { full } = await buildScopes(params);
  const [totals, appointmentKeys, categoryKeys, manualKeys] = await Promise.all([
    loadTotals(full.appointment, full.category, full.manual),
    Appointment.aggregate(keysPipeline(full.appointment, order, cap, { $ifNull: ["$bookedAt", "$createdAt"] })),
    CategoryConsultation.aggregate(keysPipeline(full.category, order, cap, "$createdAt")),
    ManualEntry.aggregate(keysPipeline(full.manual, order, cap, "$createdAt")),
  ]);
  const keys = mergeKeys({ appointment: appointmentKeys, category: categoryKeys, manual: manualKeys }, order).slice(0, cap);
  const rows = [];
  for (let i = 0; i < keys.length; i += EXPORT_CHUNK) rows.push(...(await loadRows(keys.slice(i, i + EXPORT_CHUNK))));
  return { rows, total: totals.rows, truncated: totals.rows > keys.length };
}

// One row, loaded the way the list loads it (for the answer to an edit). Null when it is not a row of the list.
async function loadEntryRow(kind, id) {
  if (kind === "appointment") {
    const [doc] = await findAppointments([id]);
    return doc ? toEntryRow("appointment", doc) : null;
  }
  if (kind === "category") {
    const [doc] = await findCategories([id]);
    return doc && doc.paymentStatus === "paid" ? toEntryRow("category", doc) : null;
  }
  return null;
}

module.exports = { EntryListQueryError, SORTS, MAX_EXPORT_ROWS, parseEntriesQuery, listBookingEntries, listAllEntryRows, loadEntryRow, toEntryRow, eligibility, FEE_CENTS };
