// Admin actions on a booking from the unified Appointments list. They work on
// both collections: Appointment (doctor = a Doctor _id, lowercase statuses) and
// CategoryConsultation (doctor = an Enrollment _id, capitalized statuses).
//
// The API identifies a doctor by his or her Enrollment _id for both kinds (the
// `id` that GET /api/doctor/approved returns); it is mapped to the right
// reference per kind here.
//
// Rules shared by every action:
//   • Every status change is a conditional update that matches the status (and
//     doctor) that was read, so two admins acting at once cannot both win. The
//     loser gets 409.
//   • A testing booking (isTesting) sends no email and no push notification.
//     In-app socket events still go out so open screens stay in sync.
const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");
const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const { LifecycleError, ACTIVE_DOCTOR_STATUSES } = require("./appointmentLifecycle");
const { unifiedStatus } = require("./adminBookingList");
const { CANCEL_REASONS } = require("./bookingAdminFields");
// Called through the module objects (not destructured) so tests can replace them.
const notify = require("./bookingNotifications");
const push = require("./pushNotifications");

const ACTIVE_CATEGORY_STATUSES = ["Assigned", "Confirmed"];
const SLOT_TAKEN = "The selected doctor is already booked for this slot.";
const CHANGED = "This booking was just changed by someone else. Refresh and try again.";
const MAX_TESTING_IDS = 100;
const TIME_PATTERN = /^\d{1,2}:\d{2}\s?(AM|PM)$/i;

// ── Loading ──────────────────────────────────────────────────────────────────

async function loadBooking(id) {
  if (!mongoose.isValidObjectId(id)) throw new LifecycleError(400, "Invalid booking id.");
  const appointment = await Appointment.findById(id).lean();
  if (appointment) return { kind: "appointment", doc: appointment };
  const consultation = await CategoryConsultation.findById(id).lean();
  if (consultation) return { kind: "category", doc: consultation };
  throw new LifecycleError(404, "Appointment not found.");
}

const modelOf = (kind) => (kind === "category" ? CategoryConsultation : Appointment);
const doctorFieldOf = (kind) => (kind === "category" ? "assignedDoctorId" : "doctorId");
const currentDoctorKey = ({ kind, doc }) => {
  const value = doc[doctorFieldOf(kind)];
  return value ? String(value) : "";
};
const statusOf = ({ kind, doc }) => unifiedStatus(kind, doc.status, Boolean(currentDoctorKey({ kind, doc })));
const isClosed = (loaded) => ["complete", "cancelled"].includes(statusOf(loaded));

const fullName = (enrollment) => `${enrollment?.firstName || ""} ${enrollment?.surname || ""}`.trim();

// ── Doctors ──────────────────────────────────────────────────────────────────

// An approved, enabled doctor, from his or her Enrollment _id.
async function resolveDoctor(enrollmentId) {
  if (!enrollmentId) throw new LifecycleError(400, "A doctorId is required.");
  if (!mongoose.isValidObjectId(enrollmentId)) throw new LifecycleError(400, "Invalid doctorId.");
  const enrollment = await Enrollment.findById(enrollmentId).lean();
  if (!enrollment) throw new LifecycleError(404, "Doctor not found.");
  if (enrollment.approvalStatus !== "approved") throw new LifecycleError(400, "This doctor is not approved.");
  const doctor = enrollment.doctorId ? await Doctor.findById(enrollment.doctorId).lean() : null;
  if (!doctor) throw new LifecycleError(404, "Doctor not found.");
  if (doctor.accountDisabled) throw new LifecycleError(400, "This doctor's account is disabled.");
  return { enrollment, doctor };
}

// The doctor a booking has right now: name, Doctor _id, and Enrollment _id.
async function currentDoctor(loaded) {
  const { kind, doc } = loaded;
  if (kind === "category") {
    const enrollment = await Enrollment.findById(doc.assignedDoctorId).lean();
    return {
      name: fullName(enrollment) || doc.assignedDoctorName || "",
      userId: enrollment?.doctorId ? String(enrollment.doctorId) : "",
      enrollmentId: String(doc.assignedDoctorId),
      key: String(doc.assignedDoctorId),
    };
  }
  const [doctor, enrollment] = await Promise.all([
    Doctor.findById(doc.doctorId).select("name").lean(),
    Enrollment.findOne({ doctorId: doc.doctorId }).select("_id").lean(),
  ]);
  return {
    name: doctor?.name || "",
    userId: String(doc.doctorId),
    enrollmentId: enrollment ? String(enrollment._id) : "",
    key: String(doc.doctorId),
  };
}

const displayName = (kind, { enrollment, doctor }) =>
  kind === "category" ? fullName(enrollment) || doctor.name : doctor.name || fullName(enrollment);

// Same rule as booking: the doctor must not hold another active booking at this
// date/time, in either collection (UTC instant and date+time strings).
async function assertSlotFree(loaded, { enrollment, doctor }, timeOverride) {
  const { kind, doc } = loaded;
  let time = doc.time;
  if (kind === "category") {
    const flexible = (doc.appointmentType || (doc.urgency === "flexible" ? "FLEXIBLE_TIME" : "NEXT_AVAILABLE")) === "FLEXIBLE_TIME";
    time = timeOverride || (flexible ? doc.slot : doc.assignedSlot);
    if (!doc.date || !time || time === "Next Available") return;
  }

  const clauses = [{ date: doc.date, time }];
  if (kind === "appointment" && doc.appointmentDateTimeUtc) clauses.unshift({ appointmentDateTimeUtc: doc.appointmentDateTimeUtc });

  const [appointmentConflict, categoryConflict] = await Promise.all([
    Appointment.exists({
      _id: { $ne: doc._id },
      doctorId: doctor._id,
      status: { $in: ACTIVE_DOCTOR_STATUSES },
      $or: clauses,
    }),
    CategoryConsultation.exists({
      _id: { $ne: doc._id },
      assignedDoctorId: enrollment._id,
      date: doc.date,
      status: { $in: ACTIVE_CATEGORY_STATUSES },
      $or: [{ slot: time }, { assignedSlot: time }],
    }),
  ]);
  if (appointmentConflict || categoryConflict) throw new LifecycleError(409, SLOT_TAKEN);
}

// ── Writing ──────────────────────────────────────────────────────────────────

// Applies `$set` only if the booking still has the status and doctor that were
// read; otherwise someone else got there first.
async function conditionalUpdate(loaded, set) {
  const { kind, doc } = loaded;
  const updated = await modelOf(kind).findOneAndUpdate(
    { _id: doc._id, status: doc.status, [doctorFieldOf(kind)]: doc[doctorFieldOf(kind)] ?? null },
    { $set: set },
    { new: true }
  );
  if (!updated) throw new LifecycleError(409, CHANGED);
  return updated;
}

const assignedByFor = (actor) => ({
  id: actor?.id || null,
  name: actor?.name || "Admin",
  email: actor?.email || "",
  assignedAt: new Date(),
});

// Fields for putting `target` on the booking, as Assigned (or leaving a
// Pending booking Pending) with the call locked until the doctor confirms.
function doctorChangeFields(loaded, target, actor) {
  const { kind, doc } = loaded;
  const assignedBy = assignedByFor(actor);
  const name = displayName(kind, target);
  if (kind === "category") {
    return { assignedDoctorId: target.enrollment._id, assignedDoctorName: name, assignedAt: assignedBy.assignedAt, assignedBy };
  }
  return {
    doctorId: target.doctor._id,
    doctorTimezone: target.enrollment.timezone || doc.doctorTimezone || "",
    sessionStarted: false,
    assignedBy,
  };
}

const assignedStatus = (kind) => (kind === "category" ? "Assigned" : "assigned");

// ── Notifications (all skipped for testing bookings) ─────────────────────────

const quiet = (promise) => Promise.resolve(promise).catch(() => {});

function emitBookingUpdate(app, updated, kind, extra = {}) {
  const io = app.get("io");
  if (!io) return;
  const payload = {
    appointmentId: updated._id,
    status: unifiedStatus(kind, updated.status, true),
    ...extra,
  };
  io.to(`patient_${updated.patientId}`).emit("appointment-updated", payload);
  io.to(`appointment_${updated._id}`).emit("appointment-updated", payload);
  io.to("admin_room").emit("appointment-updated", payload);
}

// After a doctor was assigned or swapped. `previous` is the removed doctor
// (from currentDoctor) or null on a first assignment.
function afterDoctorChange(app, { kind, updated, target, previous }) {
  const testing = updated.isTesting === true;
  emitBookingUpdate(app, updated, kind);

  const targetUserId = String(target.doctor._id);
  const io = app.get("io");
  if (io) io.to(`doctor_${targetUserId}`).emit("appointment-updated", { appointmentId: updated._id, status: unifiedStatus(kind, updated.status, true) });
  if (previous?.userId) {
    app.get("evictDoctorFromAppointmentRoom")?.(updated._id, previous.userId);
    if (io) io.to(`doctor_${previous.userId}`).emit("appointment-updated", { appointmentId: updated._id, status: unifiedStatus(kind, updated.status, true) });
  }
  if (testing) return;

  if (io) {
    io.to(`doctor_${targetUserId}`).emit("new-appointment", {
      appointmentId: updated._id,
      patientId: updated.patientId,
      status: unifiedStatus(kind, updated.status, true),
      date: updated.date,
      time: kind === "category" ? updated.assignedSlot || updated.slot : updated.time,
    });
  }

  if (kind === "category") {
    quiet(notify.notifyConsultationDoctorChanged({
      consultation: updated,
      newEnrollment: target.enrollment,
      previousEnrollmentId: previous ? previous.enrollmentId : null,
    }));
  } else {
    quiet(notify.notifyAppointmentDoctorChanged({
      appointment: updated,
      newDoctor: target.doctor,
      previousDoctorId: previous ? previous.userId : null,
    }));
  }
  quiet(notify.notifyPatientDoctorChanged({
    booking: updated,
    isCategory: kind === "category",
    doctorName: displayName(kind, target),
    reassigned: Boolean(previous),
  }));
}

// ── Actions ──────────────────────────────────────────────────────────────────

// Doctor-less Upcoming (or Pending with no doctor) -> Assigned.
async function assignDoctor(app, id, { doctorId, appointmentTime } = {}, actor) {
  const loaded = await loadBooking(id);
  const { kind, doc } = loaded;

  if (currentDoctorKey(loaded)) {
    throw new LifecycleError(409, "This booking already has a doctor. Use Alternate doctor to change it.");
  }
  const status = statusOf(loaded);
  if (!["upcoming", "pending"].includes(status)) {
    throw new LifecycleError(409, `Only upcoming bookings can be assigned a doctor. This one is ${status}.`);
  }

  const target = await resolveDoctor(doctorId);

  // Next Available category bookings have no time until the admin gives one.
  const needsTime = kind === "category" && (doc.appointmentType || "NEXT_AVAILABLE") === "NEXT_AVAILABLE";
  const time = needsTime ? String(appointmentTime || "").trim() : "";
  if (needsTime && !time) throw new LifecycleError(400, "An appointment time is required for a Next Available booking.");
  if (needsTime && !TIME_PATTERN.test(time)) throw new LifecycleError(400, 'The appointment time must look like "05:30 PM".');

  await assertSlotFree(loaded, target, time);

  const updated = await conditionalUpdate(loaded, {
    ...doctorChangeFields(loaded, target, actor),
    status: assignedStatus(kind),
    ...(needsTime ? { assignedSlot: time } : {}),
  });
  afterDoctorChange(app, { kind, updated, target, previous: null });
  return { kind, id: String(updated._id), paid: updated.paymentStatus === "paid" };
}

// Replace the doctor ("Alternate doctor") or restore the original ("Go back").
async function swapDoctor(app, id, { doctorId, revert = false } = {}, actor) {
  const loaded = await loadBooking(id);
  const { kind, doc } = loaded;
  const current = currentDoctorKey(loaded);

  if (!current) throw new LifecycleError(409, "This booking has no doctor yet. Assign a doctor first.");
  const status = statusOf(loaded);
  if (isClosed(loaded)) {
    throw new LifecycleError(409, `A ${status} booking can't change doctor.`);
  }

  let target;
  if (revert) {
    if (!doc.originalDoctorId) throw new LifecycleError(409, "This booking has no original doctor to go back to.");
    const enrollment = kind === "category"
      ? await Enrollment.findById(doc.originalDoctorId).select("_id").lean()
      : await Enrollment.findOne({ doctorId: doc.originalDoctorId }).select("_id").lean();
    try {
      target = await resolveDoctor(enrollment?._id ? String(enrollment._id) : "");
    } catch (error) {
      if (error instanceof LifecycleError) throw new LifecycleError(409, "The original doctor is no longer available.");
      throw error;
    }
  } else {
    target = await resolveDoctor(doctorId);
  }

  const targetKey = kind === "category" ? String(target.enrollment._id) : String(target.doctor._id);
  if (targetKey === current) throw new LifecycleError(400, "That doctor is already assigned to this booking.");

  await assertSlotFree(loaded, target);
  const previous = await currentDoctor(loaded);

  const set = {
    ...doctorChangeFields(loaded, target, actor),
    // The new doctor hasn't confirmed yet.
    ...(status === "confirmed" ? { status: assignedStatus(kind) } : {}),
  };
  if (revert) {
    set.originalDoctorId = null;
    set.originalDoctorName = "";
  } else if (!doc.originalDoctorId) {
    // Only the first change records the original; later alternates keep it.
    set.originalDoctorId = kind === "category" ? previous.enrollmentId : previous.userId;
    set.originalDoctorName = previous.name;
  }

  const updated = await conditionalUpdate(loaded, set);
  afterDoctorChange(app, { kind, updated, target, previous });
  return { kind, id: String(updated._id), paid: updated.paymentStatus === "paid" };
}

const alternateDoctor = (app, id, body, actor) => swapDoctor(app, id, { doctorId: body?.doctorId }, actor);
const revertDoctor = (app, id, actor) => swapDoctor(app, id, { revert: true }, actor);

// Admin confirms on the doctor's behalf: Assigned -> Confirmed, call enabled.
// Same effect and notifications as the doctor's own confirm.
async function confirmBooking(app, id) {
  const loaded = await loadBooking(id);
  const { kind, doc } = loaded;
  if (statusOf(loaded) !== "assigned" || !currentDoctorKey(loaded)) {
    throw new LifecycleError(409, `Only assigned bookings can be confirmed. This one is ${statusOf(loaded)}.`);
  }

  const updated = await conditionalUpdate(loaded, {
    status: kind === "category" ? "Confirmed" : "confirmed",
    ...(kind === "appointment" ? { sessionStarted: true } : {}),
  });

  emitBookingUpdate(app, updated, kind);
  if (updated.isTesting !== true) {
    push.sendPushToUser(updated.patientId, {
      title: "Appointment confirmed",
      body: "Your doctor has confirmed your appointment.",
      data: { type: "appointment", appointmentId: String(updated._id) },
    });
  }
  return { kind, id: String(doc._id), paid: updated.paymentStatus === "paid" };
}

// Cancels any open booking. The reason is recorded and nothing is refunded:
// `paid` tells the admin the money still has to be refunded by hand. The doctor's
// slot is free again straight away, because the slot check only counts
// Assigned / Pending / Confirmed bookings.
async function cancelBooking(app, id, { reason } = {}, actor) {
  if (!CANCEL_REASONS.includes(reason)) {
    throw new LifecycleError(400, `A cancel reason is required. Choose one of: ${CANCEL_REASONS.join(", ")}.`);
  }
  const loaded = await loadBooking(id);
  const { kind } = loaded;
  if (isClosed(loaded)) {
    throw new LifecycleError(409, `A ${statusOf(loaded)} booking can't be cancelled.`);
  }
  const doctor = currentDoctorKey(loaded) ? await currentDoctor(loaded) : null;

  const updated = await conditionalUpdate(loaded, {
    status: kind === "category" ? "Cancelled" : "cancelled",
    cancelReason: reason,
    cancelledBy: { id: actor?.id || null, name: actor?.name || "Admin", email: actor?.email || "" },
    cancelledAt: new Date(),
  });

  emitBookingUpdate(app, updated, kind);
  const io = app.get("io");
  if (io && doctor?.userId) {
    io.to(`doctor_${doctor.userId}`).emit("appointment-updated", { appointmentId: updated._id, status: "cancelled" });
  }
  app.get("evictAllFromAppointmentRoom")?.(updated._id, { reason: "cancelled" });

  if (updated.isTesting !== true) {
    push.sendPushToUser(updated.patientId, {
      title: "Appointment cancelled",
      body: "Your appointment has been cancelled.",
      data: { type: "appointment", appointmentId: String(updated._id) },
    });
    if (doctor) quiet(notify.notifyDoctorBookingCancelled({ booking: updated, isCategory: kind === "category" }));
  }
  return { kind, id: String(updated._id), paid: updated.paymentStatus === "paid" };
}

// Mark or unmark up to 100 bookings as testing, whatever their status. Sends
// nothing. Answers per id: "ok" or "not_found".
async function setTesting(ids, value, actor) {
  if (!Array.isArray(ids) || ids.length === 0) throw new LifecycleError(400, "ids must be a non-empty list.");
  if (ids.length > MAX_TESTING_IDS) throw new LifecycleError(400, `Up to ${MAX_TESTING_IDS} bookings at a time.`);
  if (typeof value !== "boolean") throw new LifecycleError(400, "value must be true or false.");

  const unique = [...new Set(ids.map(String))];
  const valid = unique.filter((id) => mongoose.isValidObjectId(id));
  const [appointments, categories] = await Promise.all([
    Appointment.find({ _id: { $in: valid } }).select("_id").lean(),
    CategoryConsultation.find({ _id: { $in: valid } }).select("_id").lean(),
  ]);
  const kindById = new Map([
    ...appointments.map((d) => [String(d._id), "appointment"]),
    ...categories.map((d) => [String(d._id), "category"]),
  ]);

  const set = value
    ? { isTesting: true, testingMarkedBy: { id: actor?.id || null, name: actor?.name || "Admin", email: actor?.email || "" }, testingMarkedAt: new Date() }
    : { isTesting: false, testingMarkedBy: { id: null, name: "", email: "" }, testingMarkedAt: null };
  await Promise.all([
    appointments.length ? Appointment.updateMany({ _id: { $in: appointments.map((d) => d._id) } }, { $set: set }) : null,
    categories.length ? CategoryConsultation.updateMany({ _id: { $in: categories.map((d) => d._id) } }, { $set: set }) : null,
  ]);

  const results = unique.map((id) => ({ id, status: kindById.has(id) ? "ok" : "not_found", ...(kindById.has(id) ? { kind: kindById.get(id) } : {}) }));
  return { results, updated: kindById.size };
}

module.exports = {
  assignDoctor,
  alternateDoctor,
  revertDoctor,
  confirmBooking,
  cancelBooking,
  setTesting,
};
