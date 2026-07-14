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

    timeWindow: {
      type: String,
      required: true,
    },

    slot: {
      type: String,
      required: true,
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
        url:  { type: String },
        name: { type: String },
        type: { type: String },
        size: { type: Number },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "CategoryConsultation",
  consultationSchema
);