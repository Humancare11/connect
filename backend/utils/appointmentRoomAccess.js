// Who may be in an appointment's call room, for both booking kinds: Appointment
// (doctorId is a Doctor _id, lowercase statuses) and CategoryConsultation (the
// doctor is an Enrollment in assignedDoctorId, capitalized statuses).
//
//   • Only the booking's own patient and doctor may join.
//   • Once Complete or Cancelled, nobody may (re)join. This is what stops a
//     participant evicted on complete/cancel from rejoining straight away,
//     since ownership alone never changes then.
//   • Until the doctor (or an admin on their behalf) has confirmed the booking,
//     nobody may join: only `confirmed` opens the room. This matches the Join
//     buttons on the doctor side.
const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");
const Enrollment = require("../models/Enrollment");
const { classifyAppointmentLookupError } = require("./roomDenyReason");

// Compared case-insensitively ("complete"/"cancelled" vs "Completed"/"Cancelled").
const TERMINAL_APPOINTMENT_STATUSES = new Set(["complete", "completed", "cancelled"]);

const DENIED_MESSAGE = "Access to this call room was denied.";
const NOT_CONFIRMED_MESSAGE = "Your doctor hasn't confirmed this appointment yet. You can join once it's confirmed.";
const NOT_CONFIRMED_DOCTOR_MESSAGE = "This appointment isn't confirmed yet. Confirm it from your dashboard to join.";

// The text for `room-access-denied`, by the reason decideAppointmentAccess gave.
function deniedMessage(reason, role) {
  if (reason !== "not_confirmed") return DENIED_MESSAGE;
  return role === "doctor" ? NOT_CONFIRMED_DOCTOR_MESSAGE : NOT_CONFIRMED_MESSAGE;
}

// `identity` is { userId, role } as resolved from the socket.
async function decideAppointmentAccess(identity, appointmentId) {
  const userId = String(identity.userId);
  let appointment = null;
  let allowed = false;
  // Which kind of booking the id is, for the call report.
  let kind = "appointment";

  try {
    appointment = await Appointment.findById(appointmentId)
      .select("patientId doctorId status")
      .lean();

    if (appointment) {
      allowed =
        (identity.role === "user" && String(appointment.patientId) === userId) ||
        (identity.role === "doctor" && appointment.doctorId && String(appointment.doctorId) === userId);
    } else {
      const cc = await CategoryConsultation.findById(appointmentId)
        .select("patientId assignedDoctorId status")
        .lean();

      if (cc) {
        appointment = cc;
        kind = "category_consultation";

        if (identity.role === "user") {
          allowed = String(cc.patientId) === userId;
        } else if (identity.role === "doctor" && cc.assignedDoctorId) {
          const enrollment = await Enrollment.findOne({ doctorId: identity.userId }).select("_id").lean();
          allowed = !!enrollment && String(cc.assignedDoctorId) === String(enrollment._id);
        }
      }
    }
  } catch (err) {
    // Only a malformed id is permanent; a DB error must not read as "invalid".
    const reason = classifyAppointmentLookupError(err);
    if (reason === "server_error") console.error("[socket] appointment lookup failed:", err?.message);
    return { allowed: false, reason };
  }

  if (!appointment) return { allowed: false, reason: "appointment_not_found" };

  const status = String(appointment.status || "").toLowerCase();
  if (TERMINAL_APPOINTMENT_STATUSES.has(status)) {
    return { allowed: false, reason: "appointment_ended", identity, appointment, kind };
  }

  // Not on this booking: say nothing about its status.
  if (!allowed) return { allowed: false, reason: "not_participant", identity, appointment, kind };

  if (status !== "confirmed") return { allowed: false, reason: "not_confirmed", identity, appointment, kind };

  return { allowed: true, reason: "participant", identity, appointment, kind };
}

module.exports = {
  TERMINAL_APPOINTMENT_STATUSES,
  decideAppointmentAccess,
  deniedMessage,
};
