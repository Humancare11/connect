const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");
const Enrollment = require("../models/Enrollment");

const isObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));

// NEXT_AVAILABLE bookings have no patient-chosen slot, so `cc.slot` is null
// until an admin assigns one (stored in `cc.assignedSlot`). Falls back to
// deriving from `urgency` for records created before appointmentType existed.
const resolveCategoryConsultationTime = (cc) => {
  const appointmentType =
    cc.appointmentType || (cc.urgency === "flexible" ? "FLEXIBLE_TIME" : "NEXT_AVAILABLE");
  if (appointmentType === "FLEXIBLE_TIME") return cc.slot;
  return cc.assignedSlot || "Next Available";
};

const normalizeCategoryConsultation = (cc, doctorId) => ({
  _id: cc._id,
  doctorId,
  patientId: cc.patientId,
  date: cc.date,
  time: resolveCategoryConsultationTime(cc),
  problem: cc.concern,
  status: cc.status,
  appointmentModel: "CategoryConsultation",
});

// Consultations can originate from two collections: the classic Appointment
// booking (doctorId set directly on the document) or a CategoryConsultation
// booking (assigned to a doctor indirectly via Enrollment). Both are valid
// consultations a doctor can act on, so this checks both and returns a
// normalized shape, or throws if the appointment doesn't exist / doesn't
// belong to this doctor.
//
// This is the ownership check every doctor-facing write tied to a specific
// appointment (consultation notes, prescriptions, medical certificates)
// must go through — writing PHI for a patient without confirming the
// requesting doctor actually has an appointment with that patient is an
// IDOR, not just a data-integrity issue.
async function ensureDoctorAppointment(appointmentId, doctorId) {
  if (!isObjectId(appointmentId)) {
    const err = new Error("Invalid appointment ID.");
    err.statusCode = 400;
    throw err;
  }

  const appointment = await Appointment.findOne({
    _id: appointmentId,
    doctorId,
  }).select("_id doctorId patientId date time problem status");

  if (appointment) {
    return { ...appointment.toObject(), appointmentModel: "Appointment" };
  }

  const enrollment = await Enrollment.findOne({ doctorId }).select("_id");
  if (enrollment) {
    const categoryConsultation = await CategoryConsultation.findOne({
      _id: appointmentId,
      assignedDoctorId: enrollment._id,
    }).select("_id patientId date slot assignedSlot appointmentType urgency concern status");

    if (categoryConsultation) {
      return normalizeCategoryConsultation(categoryConsultation, doctorId);
    }
  }

  const err = new Error("Appointment not found or access denied.");
  err.statusCode = 404;
  throw err;
}

module.exports = {
  isObjectId,
  ensureDoctorAppointment,
};
