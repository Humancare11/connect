// Completing and reopening an appointment, shared by every path that does it:
//   • the doctor's "Complete" action              (appointmentController.completeAppointment)
//   • the admin's "Complete" and "Reopen" actions (appointmentController)
//   • a prescription saved from the appointments page (medicalController)
//
// Works on both collections: classic Appointment (lowercase statuses, doctorId
// is a Doctor _id) and CategoryConsultation (capitalized statuses, the doctor is
// an Enrollment in assignedDoctorId, whose .doctorId is the Doctor _id).
//
// Status changes are conditional updates (`status` must still be what we read),
// so two simultaneous requests cannot both apply side effects.
const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");
// Called through the module objects so tests can replace them.
const push = require("./pushNotifications");
const notifications = require("./bookingNotifications");

// Same set the booking flow uses to decide whether a doctor's slot is taken.
const ACTIVE_DOCTOR_STATUSES = ["assigned", "pending", "confirmed"];
const ACTIVE_CATEGORY_STATUSES = ["Assigned", "Confirmed"];

class LifecycleError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const isCompleteStatus = (status) => ["complete", "completed"].includes(String(status || "").toLowerCase());

// Returns { doc, isCategory } or null. `doc` is a Mongoose document; for a
// category consultation, assignedDoctorId is populated with its Enrollment.
async function loadAppointmentAny(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  const appointment = await Appointment.findById(id);
  if (appointment) return { doc: appointment, isCategory: false };
  const consultation = await CategoryConsultation.findById(id).populate("assignedDoctorId");
  if (consultation) return { doc: consultation, isCategory: true };
  return null;
}

// The Doctor _id (as a string) that owns this appointment, or "".
const doctorUserIdOf = ({ doc, isCategory }) => {
  const value = isCategory ? doc.assignedDoctorId?.doctorId : doc.doctorId;
  return value ? String(value._id || value) : "";
};

const emitStatus = (app, loaded, status, extra = {}) => {
  const io = app.get("io");
  if (!io) return;
  const { doc } = loaded;
  const payload = { appointmentId: doc._id, status, ...extra };
  io.to(`patient_${doc.patientId}`).emit("appointment-updated", payload);
  io.to(`appointment_${doc._id}`).emit("appointment-updated", payload);
  io.to("admin_room").emit("appointment-updated", payload);
  const doctorUserId = doctorUserIdOf(loaded);
  if (doctorUserId) io.to(`doctor_${doctorUserId}`).emit("appointment-updated", payload);
};

// Moves an assigned/confirmed appointment to complete. An appointment that is
// already complete is a success (`alreadyComplete: true`, no side effects).
async function completeLoaded(app, loaded) {
  const { doc, isCategory } = loaded;
  const status = String(doc.status || "").toLowerCase();

  if (isCompleteStatus(status)) return { appointment: doc, alreadyComplete: true };
  if (!["assigned", "confirmed"].includes(status)) {
    throw new LifecycleError(400, "Only assigned or confirmed appointments can be marked complete.");
  }

  const Model = isCategory ? CategoryConsultation : Appointment;
  const updated = await Model.findOneAndUpdate(
    { _id: doc._id, status: { $in: isCategory ? ["Assigned", "Confirmed"] : ["assigned", "confirmed"] } },
    { $set: { status: isCategory ? "Completed" : "complete" }, $unset: { reopenedByAdmin: 1 } },
    { new: true }
  );

  if (!updated) {
    // Lost a race: someone changed the status after we read it.
    const fresh = await Model.findById(doc._id).select("status").lean();
    if (fresh && isCompleteStatus(fresh.status)) return { appointment: doc, alreadyComplete: true };
    throw new LifecycleError(409, "The appointment status just changed. Please refresh and try again.");
  }

  emitStatus(app, loaded, "complete");
  app.get("evictAllFromAppointmentRoom")?.(doc._id, { reason: "completed" });

  // Testing bookings never message anyone.
  if (doc.isTesting !== true) {
    push.sendPushToUser(doc.patientId, {
      title: "Appointment completed",
      body: "Your appointment has been marked as complete.",
      data: { type: "appointment", appointmentId: String(doc._id) },
    });
  }

  return { appointment: updated, alreadyComplete: false };
}

// Same slot-conflict rules as booking: the doctor must not hold another active
// appointment at this date/time (by UTC instant and by date+time strings).
// Category consultations have no booking-time check; for them we compare the
// concrete slot (never "Next Available") against the doctor's other active work.
async function assertSlotStillFree(loaded) {
  const { doc, isCategory } = loaded;
  const doctorUserId = doctorUserIdOf(loaded);
  const conflictError = new LifecycleError(
    409,
    "This appointment can't be reopened: the doctor already has another active appointment at the same date and time. " +
      "Resolve or reassign the other appointment first."
  );

  if (!isCategory) {
    const clauses = [{ date: doc.date, time: doc.time }];
    if (doc.appointmentDateTimeUtc) clauses.unshift({ appointmentDateTimeUtc: doc.appointmentDateTimeUtc });
    const conflict = await Appointment.findOne({
      _id: { $ne: doc._id },
      doctorId: doc.doctorId,
      status: { $in: ACTIVE_DOCTOR_STATUSES },
      $or: clauses,
    })
      .select("_id")
      .lean();
    if (conflict) throw conflictError;
    return;
  }

  const flexible = (doc.appointmentType || (doc.urgency === "flexible" ? "FLEXIBLE_TIME" : "NEXT_AVAILABLE")) === "FLEXIBLE_TIME";
  const slot = flexible ? doc.slot : doc.assignedSlot;
  if (!doc.date || !slot || slot === "Next Available") return;

  const [appointmentConflict, categoryConflict] = await Promise.all([
    Appointment.findOne({
      doctorId: doctorUserId,
      date: doc.date,
      time: slot,
      status: { $in: ACTIVE_DOCTOR_STATUSES },
    })
      .select("_id")
      .lean(),
    CategoryConsultation.findOne({
      _id: { $ne: doc._id },
      assignedDoctorId: doc.assignedDoctorId._id,
      date: doc.date,
      status: { $in: ACTIVE_CATEGORY_STATUSES },
      $or: [{ slot }, { assignedSlot: slot }],
    })
      .select("_id")
      .lean(),
  ]);
  if (appointmentConflict || categoryConflict) throw conflictError;
}

// Admin action: complete -> confirmed again. `actor` is { id, name }.
async function reopenLoaded(app, loaded, actor) {
  const { doc, isCategory } = loaded;

  if (!isCompleteStatus(doc.status)) {
    throw new LifecycleError(400, "Only completed appointments can be reopened.");
  }
  if (!doctorUserIdOf(loaded)) {
    throw new LifecycleError(400, "This appointment has no assigned doctor, so it can't be reopened. Assign a doctor first.");
  }

  await assertSlotStillFree(loaded);

  const Model = isCategory ? CategoryConsultation : Appointment;
  const updated = await Model.findOneAndUpdate(
    { _id: doc._id, status: { $in: isCategory ? ["Completed"] : ["complete", "completed"] } },
    {
      $set: {
        status: isCategory ? "Confirmed" : "confirmed",
        ...(isCategory ? {} : { sessionStarted: true }),
        reopenedByAdmin: { id: actor?.id || null, name: actor?.name || "Admin", at: new Date() },
      },
    },
    { new: true }
  );
  if (!updated) {
    throw new LifecycleError(409, "The appointment status just changed. Please refresh and try again.");
  }

  // Lift the post-completion block so the doctor and patient can rejoin now.
  app.get("allowAppointmentRoomRejoin")?.(doc._id);
  emitStatus(app, loaded, "confirmed", { reopened: true });

  // Testing bookings never message anyone.
  if (doc.isTesting !== true) {
    const data = { type: "appointment", appointmentId: String(doc._id) };
    push.sendPushToUser(doc.patientId, {
      title: "Appointment reopened",
      body: "Your appointment has been reopened by our team.",
      data,
    });
    // Doctors authenticate from the Doctor collection; push tokens are stored on
    // User, so this is a no-op unless the doctor also has a registered device.
    push.sendPushToUser(doctorUserIdOf(loaded), {
      title: "Appointment reopened",
      body: "An appointment has been reopened by an admin.",
      data,
    });

    // Email fallback for the doctor (never throws or rejects).
    notifications.notifyDoctorAppointmentReopened({ appointment: doc, isCategory });
  }

  return { appointment: updated };
}

module.exports = {
  LifecycleError,
  ACTIVE_DOCTOR_STATUSES,
  isCompleteStatus,
  loadAppointmentAny,
  doctorUserIdOf,
  completeLoaded,
  reopenLoaded,
};
