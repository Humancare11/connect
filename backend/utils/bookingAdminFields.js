// Admin-side fields shared by Appointment and CategoryConsultation, so the
// unified admin Appointments list can treat both the same way.
const mongoose = require("mongoose");

const CANCEL_REASONS = [
  "Patient requested",
  "Doctor unavailable",
  "Payment failed",
  "Duplicate booking",
  "Testing booking",
];

const adminActorFields = () => ({
  id:    { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  name:  { type: String, default: "" },
  email: { type: String, default: "" },
});

// Spread into a schema definition.
const bookingAdminFields = () => ({
  // Real per-booking testing flag. Testing bookings are hidden when "Hide testing"
  // is on, left out of the overview counts, and never send patient/doctor messages.
  isTesting: { type: Boolean, default: false, index: true },
  testingMarkedBy: adminActorFields(),
  testingMarkedAt: { type: Date, default: null },

  // The first doctor this booking had when an admin swapped it for an alternate.
  // Set once (never overwritten by a later alternate) and cleared by "Go back".
  originalDoctorName: { type: String, default: "" },

  // Who confirmed the booking and when. Only the doctor confirms (role "doctor"); older records may say "admin".
  confirmedBy: { ...adminActorFields(), role: { type: String, default: "" } },
  confirmedAt: { type: Date, default: null },

  // Who moved a Complete booking back to Confirmed, and when.
  reactivatedBy: adminActorFields(),
  reactivatedAt: { type: Date, default: null },

  cancelReason: { type: String, enum: [...CANCEL_REASONS, ""], default: "" },
  cancelledBy: adminActorFields(),
  cancelledAt: { type: Date, default: null },
});

module.exports = { CANCEL_REASONS, bookingAdminFields };
