const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      default: null,
    },
    category:   { type: String, default: "" },
    specialty:  { type: String, default: "" },
    condition:  { type: String, default: "" },
    consultationPrice: { type: Number, default: 0 },
    patientDetails: {
      firstName: { type: String, default: "" },
      lastName:  { type: String, default: "" },
      email:     { type: String, default: "" },
      phone:     { type: String, default: "" },
      dob:       { type: String, default: "" },
      gender:    { type: String, default: "" },
    },

    // Patient's local date/time selection (display purposes, preserved as-is)
    date: {
      type: String,
      required: true,
      validate: {
        validator: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v),
        message: "date must be in YYYY-MM-DD format",
      },
    },
    time: {
      type: String,
      required: true,
    },

    // Canonical UTC instant of the appointment — used for sorting, conflict detection
    appointmentDateTimeUtc: { type: Date, default: null, index: true },

    // When the patient completed the booking (payment confirmed)
    bookedAt: { type: Date, required: true, default: Date.now },

    patientTimezone: { type: String, default: "" },
    doctorTimezone:  { type: String, default: "" },

    problem: { type: String, default: "" },

    status: {
      type: String,
      enum: ["upcoming", "assigned", "pending", "confirmed", "complete", "requested", "completed", "cancelled"],
      default: "upcoming",
      index: true,
    },
    assignedBy: {
      id:         { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      name:       { type: String, default: "" },
      email:      { type: String, default: "" },
      assignedAt: { type: Date, default: null },
    },
    sessionStarted: { type: Boolean, default: false },
    medicalReports: [
      {
        url:  { type: String },
        name: { type: String },
        type: { type: String },
        size: { type: Number },
      },
    ],
    paymentIntentId:  { type: String, default: "" },
    paymentAmount:    { type: Number, default: 0 },
    paymentStatus:    { type: String, enum: ["unpaid", "paid"], default: "unpaid", index: true },
    paymentGateway:   { type: String, enum: ["stripe", "paypal", ""], default: "" },
    doctorPayoutStatus: { type: String, enum: ["pending", "paid"], default: "pending" },
    doctorPayoutDate:   { type: Date },
    doctorPayoutRef:    { type: String, default: "" },
    doctorPayoutOverrideAmount: { type: Number, default: null },
  },
  { timestamps: true }
);

// ── Indexes ────────────────────────────────────────────────────────────────────

// Patient's appointment list (most recent first)
appointmentSchema.index({ patientId: 1, createdAt: -1 });

// Doctor's appointment list (most recent first)
appointmentSchema.index({ doctorId: 1, createdAt: -1 });

// Admin: all appointments sorted by booking time
appointmentSchema.index({ createdAt: -1 });

// Conflict detection: ensure one slot per doctor per day
appointmentSchema.index({ doctorId: 1, date: 1, time: 1, status: 1 });

// Time-range queries (e.g. "upcoming appointments in next 7 days")
appointmentSchema.index({ appointmentDateTimeUtc: 1, status: 1 });

module.exports = mongoose.model("Appointment", appointmentSchema);
