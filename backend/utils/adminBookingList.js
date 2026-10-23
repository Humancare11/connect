// The unified admin Appointments list: Appointment (doctor consultations) and
// CategoryConsultation (category consultations) read as one list. The two
// collections stay as they are; this module maps both to one row shape and one
// set of status tabs.
//
// Unified statuses: upcoming | assigned | pending | confirmed | complete | cancelled.
// Appointment and CategoryConsultation spell them differently (lowercase vs
// capitalized), and a category booking that is Pending with no doctor yet is
// "upcoming" (the same state an Appointment calls upcoming).
//
// "Testing" is a separate tab, not a status: a testing booking keeps its real
// status and shows in that tab and, unless "Hide testing" is on, in the others.
// Filters use `isTesting: { $ne: true }`, so documents without the field count as
// not-testing and the backfill script is optional.
const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");

const STATUS_KEYS = ["upcoming", "assigned", "pending", "confirmed", "complete", "cancelled"];
const TAB_KEYS = ["all", ...STATUS_KEYS, "testing"];

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const MAX_PAGE = 1000;
const SORTS = { "-bookedAt": -1, bookedAt: 1 };

class ListQueryError extends Error {}

// Stored statuses per unified status.
const APPOINTMENT_STATUSES = {
  upcoming: ["upcoming", "requested"],
  assigned: ["assigned"],
  pending: ["pending"],
  confirmed: ["confirmed"],
  complete: ["complete", "completed"],
  cancelled: ["cancelled"],
};

const CATEGORY_FILTERS = {
  upcoming: { status: "Pending", assignedDoctorId: null },
  pending: { status: "Pending", assignedDoctorId: { $ne: null } },
  assigned: { status: "Assigned" },
  confirmed: { status: "Confirmed" },
  complete: { status: { $in: ["Completed", "Complete"] } },
  cancelled: { status: "Cancelled" },
};

function unifiedStatus(kind, status, hasDoctor) {
  const value = String(status || "").toLowerCase();
  if (kind === "category") {
    if (value === "pending") return hasDoctor ? "pending" : "upcoming";
    if (value === "completed") return "complete";
    return STATUS_KEYS.includes(value) ? value : "upcoming";
  }
  if (value === "requested") return "upcoming";
  if (value === "completed") return "complete";
  return STATUS_KEYS.includes(value) ? value : "upcoming";
}

// ── Query parsing ────────────────────────────────────────────────────────────

const parseInteger = (raw, name, fallback) => {
  if (raw === undefined || raw === "") return fallback;
  if (!/^\d+$/.test(String(raw))) throw new ListQueryError(`${name} must be a positive whole number.`);
  return Number(raw);
};

function parseListQuery(query = {}) {
  const status = String(query.status || "all").toLowerCase();
  if (!TAB_KEYS.includes(status)) {
    throw new ListQueryError(`Invalid status. Allowed values: ${TAB_KEYS.join(", ")}.`);
  }

  const page = parseInteger(query.page, "page", 1);
  if (page < 1 || page > MAX_PAGE) throw new ListQueryError(`page must be between 1 and ${MAX_PAGE}.`);
  const limit = parseInteger(query.limit, "limit", DEFAULT_LIMIT);
  if (limit < 1) throw new ListQueryError("limit must be at least 1.");

  const hideRaw = String(query.hideTesting ?? "false").toLowerCase();
  if (!["true", "1", "false", "0"].includes(hideRaw)) {
    throw new ListQueryError("hideTesting must be true or false.");
  }

  const sort = String(query.sort || "-bookedAt");
  if (!(sort in SORTS)) throw new ListQueryError(`Invalid sort. Allowed values: ${Object.keys(SORTS).join(", ")}.`);

  return {
    status,
    page,
    limit: Math.min(limit, MAX_LIMIT),
    hideTesting: hideRaw === "true" || hideRaw === "1",
    sort,
    q: String(query.q || "").trim().slice(0, 100),
  };
}

// ── Filters ──────────────────────────────────────────────────────────────────

function statusFilters({ status, hideTesting }) {
  if (status === "testing") {
    const testing = { isTesting: true };
    return { appointment: testing, category: testing };
  }
  const notTesting = hideTesting ? [{ isTesting: { $ne: true } }] : [];
  if (status === "all") {
    const filter = notTesting.length ? notTesting[0] : {};
    return { appointment: filter, category: filter };
  }
  return {
    appointment: { $and: [{ status: { $in: APPOINTMENT_STATUSES[status] } }, ...notTesting] },
    category: { $and: [CATEGORY_FILTERS[status], ...notTesting] },
  };
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Search narrows the rows only (never the tab counts). Matches booking id (full
// or the short form), patient name/email, doctor name and the category fields.
async function searchFilters(q) {
  if (!q) return null;
  const rx = new RegExp(escapeRegex(q), "i");

  const [users, doctors, enrollments] = await Promise.all([
    User.find({ $or: [{ name: rx }, { email: rx }] }).select("_id").limit(300).lean(),
    Doctor.find({ name: rx }).select("_id").limit(300).lean(),
    Enrollment.find({
      $or: [{ firstName: rx }, { surname: rx }, { $expr: { $regexMatch: { input: { $concat: [{ $ifNull: ["$firstName", ""] }, " ", { $ifNull: ["$surname", ""] }] }, regex: escapeRegex(q), options: "i" } } }],
    })
      .select("_id")
      .limit(300)
      .lean(),
  ]);

  const idClause = /^[0-9a-f]+$/i.test(q)
    ? [{ $expr: { $regexMatch: { input: { $toString: "$_id" }, regex: escapeRegex(q), options: "i" } } }]
    : [];
  const userIds = users.map((u) => u._id);

  return {
    appointment: {
      $or: [
        ...idClause,
        { patientId: { $in: userIds } },
        { doctorId: { $in: doctors.map((d) => d._id) } },
        { category: rx },
        { specialty: rx },
        { condition: rx },
        { originalDoctorName: rx },
      ],
    },
    category: {
      $or: [
        ...idClause,
        { patientId: { $in: userIds } },
        { assignedDoctorId: { $in: enrollments.map((e) => e._id) } },
        { assignedDoctorName: rx },
        { originalDoctorName: rx },
        { categoryName: rx },
        { specialtyName: rx },
        { conditionName: rx },
        { serviceName: rx },
        { pcpName: rx },
      ],
    },
  };
}

// ── Counts ───────────────────────────────────────────────────────────────────

// `groups`: [{ kind, status, hasDoctor, testing, n }] from the two $group
// aggregations. Status tabs and "all" skip testing bookings when hideTesting is
// on; the testing tab always counts every testing booking.
function computeCounts(groups, hideTesting) {
  const counts = { all: 0, upcoming: 0, assigned: 0, pending: 0, confirmed: 0, complete: 0, cancelled: 0, testing: 0 };
  for (const g of groups) {
    if (g.testing) counts.testing += g.n;
    if (hideTesting && g.testing) continue;
    counts.all += g.n;
    counts[unifiedStatus(g.kind, g.status, g.hasDoctor)] += g.n;
  }
  return counts;
}

async function loadCountGroups() {
  const testing = { $eq: ["$isTesting", true] };
  const [appointments, categories] = await Promise.all([
    Appointment.aggregate([{ $group: { _id: { status: "$status", testing }, n: { $sum: 1 } } }]),
    CategoryConsultation.aggregate([
      {
        $group: {
          _id: {
            status: "$status",
            testing,
            hasDoctor: { $gt: [{ $ifNull: ["$assignedDoctorId", null] }, null] },
          },
          n: { $sum: 1 },
        },
      },
    ]),
  ]);
  return [
    ...appointments.map((r) => ({ kind: "appointment", status: r._id.status, hasDoctor: true, testing: r._id.testing, n: r.n })),
    ...categories.map((r) => ({ kind: "category", status: r._id.status, hasDoctor: r._id.hasDoctor, testing: r._id.testing, n: r.n })),
  ];
}

// ── Rows ─────────────────────────────────────────────────────────────────────

const shortBookingId = (id) => String(id).slice(-8).toUpperCase();

const feeOf = (doc) => {
  const price = Number(doc.consultationPrice);
  if (Number.isFinite(price) && price > 0) return price;
  const paid = Number(doc.paymentAmount);
  return Number.isFinite(paid) && paid > 0 ? paid / 100 : 0;
};

const assignedByName = (doc) => doc.assignedBy?.name || doc.assignedBy?.email || null;

const patientOf = (doc) => ({
  name: doc.patientId?.name || "",
  country: doc.patientDetails?.country || doc.patientId?.country || "",
});

function toAppointmentRow(a) {
  const hasDoctor = Boolean(a.doctorId);
  return {
    kind: "appointment",
    id: String(a._id),
    shortId: shortBookingId(a._id),
    patient: patientOf(a),
    doctorName: a.doctorId?.name || null,
    originalDoctorName: a.originalDoctorName || "",
    category: a.category || "",
    bookedAt: a.bookedAt || a.createdAt || null,
    consultation: a.date ? { date: a.date, time: a.time || "", timezone: a.patientTimezone || "" } : null,
    fee: feeOf(a),
    status: unifiedStatus("appointment", a.status, hasDoctor),
    assignedBy: hasDoctor ? assignedByName(a) : null,
    isTesting: a.isTesting === true,
    paid: a.paymentStatus === "paid",
  };
}

function toCategoryRow(c) {
  const hasDoctor = Boolean(c.assignedDoctorId);
  const flexible = (c.appointmentType || (c.urgency === "flexible" ? "FLEXIBLE_TIME" : "NEXT_AVAILABLE")) === "FLEXIBLE_TIME";
  // Next-available bookings have no time until an admin assigns one.
  const time = flexible ? c.slot : c.assignedSlot;
  const enrollmentName = `${c.assignedDoctorId?.firstName || ""} ${c.assignedDoctorId?.surname || ""}`.trim();
  return {
    kind: "category",
    id: String(c._id),
    shortId: shortBookingId(c._id),
    patient: patientOf(c),
    doctorName: hasDoctor ? enrollmentName || c.assignedDoctorName || null : null,
    originalDoctorName: c.originalDoctorName || "",
    category: c.categoryName || "",
    bookedAt: c.createdAt || null,
    consultation: c.date && time ? { date: c.date, time, timezone: "" } : null,
    fee: feeOf(c),
    status: unifiedStatus("category", c.status, hasDoctor),
    assignedBy: hasDoctor ? assignedByName(c) : null,
    isTesting: c.isTesting === true,
    paid: c.paymentStatus === "paid",
  };
}

// ── The list ─────────────────────────────────────────────────────────────────

const combine = (...filters) => {
  const parts = filters.filter((f) => f && Object.keys(f).length);
  return parts.length ? { $and: parts } : {};
};

async function listAdminBookings(query) {
  const { status, page, limit, hideTesting, sort, q } = parseListQuery(query);
  const direction = SORTS[sort];

  const tab = statusFilters({ status, hideTesting });
  const search = await searchFilters(q);
  const appointmentFilter = combine(tab.appointment, search?.appointment);
  const categoryFilter = combine(tab.category, search?.category);

  const start = (page - 1) * limit;
  const need = start + limit;
  const order = { bookedAt: direction, _id: direction };
  const categoryOrder = { createdAt: direction, _id: direction };

  const [groups, appointmentTotal, categoryTotal, appointmentKeys, categoryKeys] = await Promise.all([
    loadCountGroups(),
    Appointment.countDocuments(appointmentFilter),
    CategoryConsultation.countDocuments(categoryFilter),
    Appointment.find(appointmentFilter).select("_id bookedAt createdAt").sort(order).limit(need).lean(),
    CategoryConsultation.find(categoryFilter).select("_id createdAt").sort(categoryOrder).limit(need).lean(),
  ]);

  const time = (row) => new Date(row.bookedAt || row.createdAt || 0).getTime();
  const merged = [
    ...appointmentKeys.map((row) => ({ ...row, kind: "appointment" })),
    ...categoryKeys.map((row) => ({ ...row, kind: "category" })),
  ].sort((x, y) => direction * (time(x) - time(y)) || direction * String(x._id).localeCompare(String(y._id)));
  const pageKeys = merged.slice(start, start + limit);

  const idsOf = (kind) => pageKeys.filter((k) => k.kind === kind).map((k) => k._id);
  const [appointments, categories] = await Promise.all([
    idsOf("appointment").length
      ? Appointment.find({ _id: { $in: idsOf("appointment") } })
          .select("patientId patientDetails doctorId category date time patientTimezone consultationPrice paymentAmount paymentStatus status assignedBy originalDoctorName isTesting bookedAt createdAt")
          .populate("patientId", "name country")
          .populate("doctorId", "name")
          .lean()
      : [],
    idsOf("category").length
      ? CategoryConsultation.find({ _id: { $in: idsOf("category") } })
          .select("patientId assignedDoctorId assignedDoctorName categoryName date slot assignedSlot appointmentType urgency consultationPrice paymentAmount paymentStatus status assignedBy originalDoctorName isTesting createdAt")
          .populate("patientId", "name country")
          .populate("assignedDoctorId", "firstName surname")
          .lean()
      : [],
  ]);

  const rows = new Map([
    ...appointments.map((a) => [`appointment:${a._id}`, toAppointmentRow(a)]),
    ...categories.map((c) => [`category:${c._id}`, toCategoryRow(c)]),
  ]);
  const items = pageKeys.map((k) => rows.get(`${k.kind}:${k._id}`)).filter(Boolean);

  const total = appointmentTotal + categoryTotal;
  return {
    items,
    counts: computeCounts(groups, hideTesting),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    status,
    hideTesting,
    sort,
  };
}

module.exports = {
  ListQueryError,
  STATUS_KEYS,
  TAB_KEYS,
  unifiedStatus,
  parseListQuery,
  computeCounts,
  listAdminBookings,
  toAppointmentRow,
  toCategoryRow,
};
