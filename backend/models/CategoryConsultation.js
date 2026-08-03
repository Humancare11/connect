const mongoose = require("mongoose");


const consultationSchema = new mongoose.Schema(
  {
    concern: {
      type: String,
      required: true,
      trim: true,
    },

    duration: {
      type: String,
      default: "",
    },

    severity: {
      type: String,
      required: true,
    },

    supportType: {
      type: String,
      required: true,
    },

    urgency: {
      type: String,
      required: true,
    },

    // Derived from `urgency` server-side on create. Kept as its own field
    // (rather than re-deriving from `urgency` everywhere it's displayed)
    // so admin views have one clear source of truth.
    appointmentType: {
      type: String,
      enum: ["NEXT_AVAILABLE", "FLEXIBLE_TIME"],
      default: "FLEXIBLE_TIME",
    },

    timeWindow: {
      type: String,
      default: "",
    },

    // Patient-chosen slot. Only set for FLEXIBLE_TIME bookings — null for
    // NEXT_AVAILABLE, since the patient never picks a time in that flow.
    slot: {
      type: String,
      default: null,
    },

    // The concrete appointment time an admin assigns for a NEXT_AVAILABLE
    // booking once a doctor is matched. Not used for FLEXIBLE_TIME bookings,
    // where `slot` already holds the agreed time.
    assignedSlot: {
      type: String,
      default: null,
    },

    date: {
      type: String,
      required: true,
    },

    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["Pending", "Assigned", "Confirmed", "Completed", "Cancelled"],
      default: "Pending",
    },

    assignedDoctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Enrollment",
      default: null,
    },

    assignedDoctorName: {
      type: String,
      default: "",
    },

    assignedAt: {
      type: Date,
      default: null,
    },
    medicalReports: [
      {
        url: { type: String },
        name: { type: String },
        type: { type: String },
        size: { type: Number },
      },
    ],
    consultationPrice: {
      type: Number,
      default: 0,
    },
    categoryName: {
      type: String,
      default: "",
    },
    specialtyName: {
      type: String,
      default: "",
    },
    conditionName: {
      type: String,
      default: "",
    },
    serviceName: {
      type: String,
      default: "",
    },
    pcpName: {
      type: String,
      default: "",
    },
    paymentIntentId: {
      type: String,
      default: "",
    },
    paymentAmount: {
      type: Number,
      default: 0,
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "refunded"],
      default: "unpaid",
    },
    paymentGateway: {
      type: String,
      enum: ["", "stripe", "paypal"],
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "CategoryConsultation",
  consultationSchema
);