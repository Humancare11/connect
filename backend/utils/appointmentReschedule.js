// Admin-only reschedule of a booking, for both kinds: Appointment (doctor = a Doctor _id, lowercase statuses) and
// CategoryConsultation (doctor = an Enrollment _id, capitalized statuses).
//
// Rules:
//   • Allowed for an open booking that has a live doctor: pending, assigned or confirmed. Complete and cancelled are
//     closed (409); a booking with no doctor must be assigned one first (409). The OLD time may already be in the past
//     (a confirmed booking the patient never joined); only the NEW slot must be in the future.
//   • The new slot is on the same fixed grid the booking page uses (08:00 to 19:30, every 30 minutes, in the patient's
//     time zone). Enrollment.availability is deliberately not enforced, as at booking.
//   • The new slot must be free: the same doctor may hold no other pending / assigned / confirmed booking then, in either
//     collection (same date + clock time, or the same UTC instant). The check, the booking update and the history row run
//     in one transaction, with a per-doctor lock row so two admins cannot both take the same slot; the update itself is
//     conditional on what was read, so a booking changed under us gets a 409.
//   • The status is kept (a Pending or Assigned booking still waits for its doctor to confirm; a Confirmed one stays
//     Confirmed and joinable). reopenedByAdmin is not touched. Payment is not touched.
//   • Every move appends one AppointmentRescheduleHistory row (append-only). The admin's note lives only there and in
//     admin responses; doctors and patients and every message get the dates only.
const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");
const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const AppointmentRescheduleHistory = require("../models/AppointmentRescheduleHistory");
const RescheduleLock = require("../models/RescheduleLock");
const { LifecycleError, ACTIVE_DOCTOR_STATUSES } = require("./appointmentLifecycle");
const { unifiedStatus } = require("./adminBookingList");
const { timeToMinutes, buildUtcDateTime } = require("./bookingTime");
// Called through the module objects (not destructured) so tests can replace them.
const notify = require("./bookingNotifications");
const push = require("./pushNotifications");

const REASONS = ["Patient not available", "Doctor not available", "Patient requested", "Technical issue", "Other"];
const NOTE_MAX = 500;
const ACTIVE_CATEGORY_STATUSES = ["Assigned", "Confirmed"];
// Statuses (lowercase) a booking may be rescheduled from.
const RESCHEDULABLE = ["pending", "assigned", "confirmed"];
const IST = "Asia/Kolkata";
const SLOT_TAKEN = "The selected doctor is already booked for this slot.";
const CHANGED = "This booking was just changed by someone else. Refresh and try again.";

// The booking page's grid: 08:00, 08:30 ... 19:30.
const GRID = [];
for (let h = 8; h < 20; h += 1) {
  GRID.push(`${String(h).padStart(2, "0")}:00`);
  GRID.push(`${String(h).padStart(2, "0")}:30`);
}

// ── Formatting ───────────────────────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, "0");
const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const dateLabel = (date) => (/^\d{4}-\d{2}-\d{2}$/.test(date || "") ? dateFmt.format(new Date(`${date}T00:00:00Z`)) : date || "");
const minutesLabel = (min) => {
  const h = Math.floor(min / 60);
  return `${h % 12 || 12}:${pad(min % 60)} ${h >= 12 ? "PM" : "AM"}`;
};
const timeLabel = (time) => {
  const min = timeToMinutes(time);
  return min === null ? time || "" : minutesLabel(min);
};

// The new time, written the way the booking already writes its times ("05:30 PM" or "17:30").
function formatLike(oldTime, min) {
  if (/[AP]M/i.test(oldTime || "")) {
    const h = Math.floor(min / 60);
    return `${pad(h % 12 || 12)}:${pad(min % 60)} ${h >= 12 ? "PM" : "AM"}`;
  }
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

const istFmt = (instant) =>
  instant
    ? `${new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: IST }).format(instant)}, ` +
      new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: IST }).format(instant)
    : "";

// ── Loading ──────────────────────────────────────────────────────────────────

async function loadBooking(id) {
  if (!mongoose.isValidObjectId(id)) throw new LifecycleError(400, "Invalid booking id.");
  const appointment = await Appointment.findById(id).lean();
  if (appointment) return { kind: "appointment", doc: appointment };
  const consultation = await CategoryConsultation.findById(id).lean();
  if (consultation) return { kind: "category", doc: consultation };
  throw new LifecycleError(404, "Appointment not found.");
}

// The booking's clock time: Appointment.time, or a category booking's slot (flexible) / assignedSlot (next available).
function categoryTimeField(doc) {
  const flexible = (doc.appointmentType || (doc.urgency === "flexible" ? "FLEXIBLE_TIME" : "NEXT_AVAILABLE")) === "FLEXIBLE_TIME";
  return flexible ? "slot" : "assignedSlot";
}
const currentTimeOf = ({ kind, doc }) => (kind === "category" ? doc[categoryTimeField(doc)] || "" : doc.time || "");

// The time zone the booking's date/time strings are in. An Appointment records the patient's; where it has none it was
// stored as UTC at booking, so UTC is what we assume. A category booking records none; we assume IST (the team's zone).
function zoneOf({ kind, doc }) {
  if (kind === "category") return { tz: IST, assumed: true };
  return doc.patientTimezone ? { tz: doc.patientTimezone, assumed: false } : { tz: "UTC", assumed: true };
}

const instantOf = (loaded, date, time) => {
  if (!date || !time) return null;
  return buildUtcDateTime(date, time, zoneOf(loaded).tz);
};

// One slot as the admin should read it: the patient's wall clock (with its zone) and the same instant in IST.
function slotView(loaded, { date, time, utc }) {
  const zone = zoneOf(loaded);
  const instant = utc || instantOf(loaded, date, time);
  return {
    date: date || "",
    time: time || "",
    patient: { label: date && time ? `${dateLabel(date)}, ${timeLabel(time)}` : "", timezone: zone.tz, assumed: zone.assumed },
    ist: { label: instant ? istFmt(new Date(instant)) : "", timezone: IST },
  };
}

async function doctorOf({ kind, doc }) {
  if (kind === "category") {
    const enrollment = doc.assignedDoctorId ? await Enrollment.findById(doc.assignedDoctorId).lean() : null;
    return enrollment ? { userId: enrollment.doctorId ? String(enrollment.doctorId) : "", enrollmentId: String(enrollment._id), lockKey: String(enrollment.doctorId || enrollment._id) } : null;
  }
  if (!doc.doctorId) return null;
  const exists = await Doctor.exists({ _id: doc.doctorId });
  if (!exists) return null;
  const enrollment = await Enrollment.findOne({ doctorId: doc.doctorId }).select("_id").lean();
  return { userId: String(doc.doctorId), enrollmentId: enrollment ? String(enrollment._id) : "", lockKey: String(doc.doctorId) };
}

// Throws the 409 that says why this booking can't be rescheduled, or returns the doctor.
async function assertReschedulable(loaded) {
  const { kind, doc } = loaded;
  const status = unifiedStatus(kind, doc.status, Boolean(kind === "category" ? doc.assignedDoctorId : doc.doctorId));
  if (status === "complete" || status === "cancelled") {
    throw new LifecycleError(409, `A ${status} booking can't be rescheduled.`, "closed");
  }
  const doctor = await doctorOf(loaded);
  if (!doctor) {
    throw new LifecycleError(409, "This booking has no doctor yet. Assign a doctor before rescheduling it.", "no_doctor");
  }
  if (!RESCHEDULABLE.includes(status)) {
    throw new LifecycleError(409, `A ${status} booking can't be rescheduled.`, "status");
  }
  return { doctor, status };
}

// ── Clash check ──────────────────────────────────────────────────────────────

// What the doctor already has on `date`: clock minutes taken and UTC instants (ms) taken, in either collection,
// ignoring this booking. `instants` are the UTC instants of the slots being asked about.
async function busyFor(loaded, doctor, date, instants, session = null) {
  const selfId = loaded.doc._id;
  const [appointments, categories] = await Promise.all([
    Appointment.find({
      _id: { $ne: selfId },
      doctorId: doctor.userId,
      status: { $in: ACTIVE_DOCTOR_STATUSES },
      $or: [{ date }, ...(instants.length ? [{ appointmentDateTimeUtc: { $in: instants } }] : [])],
    })
      .select("date time appointmentDateTimeUtc")
      .session(session)
      .lean(),
    doctor.enrollmentId
      ? CategoryConsultation.find({
          _id: { $ne: selfId },
          assignedDoctorId: doctor.enrollmentId,
          date,
          status: { $in: ACTIVE_CATEGORY_STATUSES },
        })
          .select("slot assignedSlot appointmentType urgency")
          .session(session)
          .lean()
      : [],
  ]);
  const minutes = new Set();
  const utcs = new Set();
  for (const a of appointments) {
    if (a.date === date) {
      const m = timeToMinutes(a.time);
      if (m !== null) minutes.add(m);
    }
    if (a.appointmentDateTimeUtc) utcs.add(new Date(a.appointmentDateTimeUtc).getTime());
  }
  for (const c of categories) {
    for (const t of [c.slot, c.assignedSlot]) {
      const m = timeToMinutes(t);
      if (m !== null) minutes.add(m);
    }
  }
  return { minutes, utcs };
}

// ── Slots for the modal ──────────────────────────────────────────────────────

// GET /api/admin/bookings/:id/reschedule-slots?date=YYYY-MM-DD
// Without a date: just whether the booking can be rescheduled and where it stands now. With one: the grid for that
// day with each slot marked available / booked / past / current.
async function getSlots(id, date) {
  const loaded = await loadBooking(id);
  const zone = zoneOf(loaded);
  const currentTime = currentTimeOf(loaded);
  const out = {
    id: String(loaded.doc._id),
    kind: loaded.kind,
    reasons: REASONS,
    timezone: { patient: zone.tz, assumed: zone.assumed, ist: IST },
    current: slotView(loaded, { date: loaded.doc.date, time: currentTime, utc: loaded.kind === "appointment" ? loaded.doc.appointmentDateTimeUtc : null }),
    canReschedule: true,
    blockedReason: "",
    blockedCode: "",
  };
  let doctor = null;
  try {
    ({ doctor } = await assertReschedulable(loaded));
  } catch (error) {
    if (!(error instanceof LifecycleError)) throw error;
    return { ...out, canReschedule: false, blockedReason: error.message, blockedCode: error.code, slots: [] };
  }
  if (date === undefined || date === "") return { ...out, slots: [] };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new LifecycleError(400, "date must be in YYYY-MM-DD format.");

  const instants = GRID.map((t) => instantOf(loaded, date, t));
  const busy = await busyFor(loaded, doctor, date, instants.filter(Boolean));
  const now = Date.now();
  const curMin = timeToMinutes(currentTime);
  const slots = GRID.map((time, i) => {
    const min = timeToMinutes(time);
    const instant = instants[i];
    let status = "available";
    if (date === loaded.doc.date && min === curMin) status = "current";
    else if (instant && instant.getTime() <= now) status = "past";
    else if (busy.minutes.has(min) || (instant && busy.utcs.has(instant.getTime()))) status = "booked";
    return { time, label: minutesLabel(min), ist: instant ? istFmt(instant) : "", status };
  });
  return { ...out, slots };
}

// ── Reschedule ───────────────────────────────────────────────────────────────

const quiet = (promise) => Promise.resolve(promise).catch(() => {});

function validateInput(body = {}) {
  const date = typeof body.date === "string" ? body.date.trim() : "";
  const time = typeof body.time === "string" ? body.time.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new LifecycleError(400, "A new date (YYYY-MM-DD) is required.");
  if (!GRID.includes(time)) throw new LifecycleError(400, "The new time must be one of the slots from 08:00 to 19:30, every 30 minutes.");
  if (!REASONS.includes(body.reason)) throw new LifecycleError(400, `A reason is required. Choose one of: ${REASONS.join(", ")}.`);
  const reasonNote = typeof body.reasonNote === "string" ? body.reasonNote.trim() : "";
  if (body.reason === "Other" && !reasonNote) throw new LifecycleError(400, 'A note is required when the reason is "Other".');
  if (reasonNote.length > NOTE_MAX) throw new LifecycleError(400, `The note can be at most ${NOTE_MAX} characters.`);
  return { date, time, reason: body.reason, reasonNote, notify: body.notify !== false };
}

function emitRescheduled(app, kind, updated, doctorUserId) {
  const io = app.get("io");
  if (!io) return;
  const payload = {
    appointmentId: updated._id,
    status: unifiedStatus(kind, updated.status, true),
    rescheduled: true,
    date: updated.date,
    time: kind === "category" ? updated[categoryTimeField(updated)] : updated.time,
  };
  io.to(`patient_${updated.patientId}`).emit("appointment-updated", payload);
  io.to(`appointment_${updated._id}`).emit("appointment-updated", payload);
  io.to("admin_room").emit("appointment-updated", payload);
  if (doctorUserId) io.to(`doctor_${doctorUserId}`).emit("appointment-updated", payload);
}

async function rescheduleBooking(app, id, body, actor) {
  const input = validateInput(body);
  const loaded = await loadBooking(id);
  const { kind, doc } = loaded;
  const { doctor, status } = await assertReschedulable(loaded);

  const oldTime = currentTimeOf(loaded);
  const newMin = timeToMinutes(input.time);
  if (input.date === doc.date && newMin === timeToMinutes(oldTime)) {
    throw new LifecycleError(400, "That is already the current date and time. Choose a different slot.");
  }
  const newUtc = instantOf(loaded, input.date, input.time);
  if (!newUtc || newUtc.getTime() <= Date.now()) {
    throw new LifecycleError(400, "The new date and time must be in the future.");
  }
  const newTime = formatLike(oldTime || (kind === "category" ? "00:00 AM" : ""), newMin);
  const timeField = kind === "category" ? categoryTimeField(doc) : "time";
  const Model = kind === "category" ? CategoryConsultation : Appointment;

  // The lock row has to exist before the transaction (creating it inside could collide on its unique index).
  await RescheduleLock.updateOne({ doctorKey: doctor.lockKey }, { $setOnInsert: { n: 0 } }, { upsert: true }).catch((error) => {
    if (error?.code !== 11000) throw error;
  });

  const actorFields = { id: actor?.id || null, name: actor?.name || "Admin", email: actor?.email || "" };
  const sendMessages = input.notify && doc.isTesting !== true;
  const session = await mongoose.startSession();
  let updated = null;
  try {
    await session.withTransaction(async () => {
      // Serialise with any other reschedule into this doctor's calendar: both write this row, so one retries.
      await RescheduleLock.updateOne({ doctorKey: doctor.lockKey }, { $inc: { n: 1 } }, { session });

      const busy = await busyFor(loaded, doctor, input.date, [newUtc], session);
      if (busy.minutes.has(newMin) || busy.utcs.has(newUtc.getTime())) {
        throw new LifecycleError(409, SLOT_TAKEN, "slot_taken");
      }

      const filter = {
        _id: doc._id,
        status: doc.status,
        date: doc.date,
        [timeField]: doc[timeField] ?? null,
        [kind === "category" ? "assignedDoctorId" : "doctorId"]: doc[kind === "category" ? "assignedDoctorId" : "doctorId"],
      };
      const set = {
        date: input.date,
        [timeField]: newTime,
        lastRescheduledAt: new Date(),
        ...(kind === "appointment" ? { appointmentDateTimeUtc: newUtc } : {}),
      };
      updated = await Model.findOneAndUpdate(filter, { $set: set, $inc: { rescheduleCount: 1 } }, { returnDocument: "after", session }).lean();
      if (!updated) throw new LifecycleError(409, CHANGED, "changed");

      await AppointmentRescheduleHistory.create(
        [
          {
            appointmentId: doc._id,
            appointmentModel: kind === "category" ? "CategoryConsultation" : "Appointment",
            oldDate: doc.date,
            oldTime,
            oldUtc: kind === "appointment" ? doc.appointmentDateTimeUtc || null : null,
            newDate: input.date,
            newTime,
            newUtc: kind === "appointment" ? newUtc : null,
            timezone: kind === "appointment" ? doc.patientTimezone || "" : "",
            reason: input.reason,
            reasonNote: input.reasonNote,
            rescheduledBy: actorFields,
            rescheduledAt: new Date(),
            notified: sendMessages,
            statusAtTime: String(doc.status || ""),
            doctorKey: doctor.lockKey,
          },
        ],
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  // Call state. The room only checks the booking's status (never its time), so a confirmed booking is already joinable
  // at the new time. Anyone still in the room from the old slot is sent out, and the "terminated" block that closing a
  // room sets is lifted straight away, so the doctor and patient can join cleanly then. reopenedByAdmin is not touched.
  app.get("evictAllFromAppointmentRoom")?.(updated._id, { reason: "rescheduled" });
  app.get("allowAppointmentRoomRejoin")?.(updated._id);

  emitRescheduled(app, kind, updated, doctor.userId);

  if (sendMessages) {
    const newLabel = `${dateLabel(updated.date)}, ${timeLabel(newTime)}`;
    const data = { type: "appointment", appointmentId: String(updated._id) };
    push.sendPushToUser(updated.patientId, { title: "Appointment rescheduled", body: `Your appointment has moved to ${newLabel}.`, data });
    if (doctor.userId) push.sendPushToUser(doctor.userId, { title: "Appointment rescheduled", body: `An appointment has moved to ${newLabel}.`, data });
    quiet(
      notify.notifyBookingRescheduled({
        booking: updated,
        isCategory: kind === "category",
        old: { date: doc.date, time: oldTime, utc: kind === "appointment" ? doc.appointmentDateTimeUtc || null : null },
      })
    );
  }

  return { kind, id: String(updated._id), paid: updated.paymentStatus === "paid", status };
}

// ── History ──────────────────────────────────────────────────────────────────

// Admin timeline: the original booking, then each change (with the admin's note). Oldest first.
async function getHistory(id) {
  const loaded = await loadBooking(id);
  const rows = await AppointmentRescheduleHistory.find({ appointmentId: loaded.doc._id }).sort({ rescheduledAt: 1, _id: 1 }).lean();
  const zone = zoneOf(loaded);
  const view = (date, time, utc) => slotView(loaded, { date, time, utc });
  const first = rows[0];
  return {
    id: String(loaded.doc._id),
    kind: loaded.kind,
    timezone: { patient: zone.tz, assumed: zone.assumed, ist: IST },
    count: rows.length,
    original: first
      ? view(first.oldDate, first.oldTime, first.oldUtc)
      : view(loaded.doc.date, currentTimeOf(loaded), loaded.kind === "appointment" ? loaded.doc.appointmentDateTimeUtc : null),
    current: view(loaded.doc.date, currentTimeOf(loaded), loaded.kind === "appointment" ? loaded.doc.appointmentDateTimeUtc : null),
    changes: rows.map((r) => ({
      id: String(r._id),
      from: view(r.oldDate, r.oldTime, r.oldUtc),
      to: view(r.newDate, r.newTime, r.newUtc),
      reason: r.reason,
      reasonNote: r.reasonNote || "",
      by: r.rescheduledBy?.name || "Admin",
      at: r.rescheduledAt,
      notified: r.notified === true,
    })),
  };
}

// ── Read-only summary for doctors and patients ───────────────────────────────

// The previous and original booking times and when it last changed, with no reason and no admin name. Added to the doctor's
// and patient's own appointment responses. Returns {} for a booking that was never rescheduled.
async function summariesFor(ids) {
  const objectIds = ids.filter((v) => mongoose.isValidObjectId(v)).map((v) => new mongoose.Types.ObjectId(String(v)));
  if (!objectIds.length) return new Map();
  const rows = await AppointmentRescheduleHistory.find({ appointmentId: { $in: objectIds } })
    .sort({ rescheduledAt: 1, _id: 1 })
    .select("appointmentId oldDate oldTime rescheduledAt")
    .lean();
  const out = new Map();
  for (const r of rows) {
    const key = String(r.appointmentId);
    const prev = out.get(key);
    out.set(key, {
      count: (prev?.count || 0) + 1,
      originalDate: prev?.originalDate || r.oldDate,
      originalTime: prev?.originalTime || r.oldTime,
      previousDate: r.oldDate,
      previousTime: r.oldTime,
      lastAt: r.rescheduledAt,
    });
  }
  return out;
}

// `previous*` is the slot just before the current one (what the prototype shows crossed out), `original*` the first
// booking. `attachSummaries` adds `reschedule` to each plain booking object in `list`.
async function attachSummaries(list) {
  const map = await summariesFor(list.map((b) => b._id));
  return list.map((b) => {
    const s = map.get(String(b._id));
    return s ? { ...b, reschedule: { ...s, by: "admin" } } : b;
  });
}

module.exports = {
  REASONS,
  GRID,
  RESCHEDULABLE,
  getSlots,
  rescheduleBooking,
  getHistory,
  attachSummaries,
  summariesFor,
};
