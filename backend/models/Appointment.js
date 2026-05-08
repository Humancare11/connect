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
      required: true,
    },
    date: {
      type: String,
      required: true,
    },
    time: {
      type: String,
      required: true,
    },
    problem: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "completed", "cancelled"],
      default: "pending",
    },
    sessionStarted: {
      type: Boolean,
      default: false,
    },
    medicalReports: [
      {
        url:  { type: String },
        name: { type: String },
        type: { type: String },
        size: { type: Number },
      },
    ],
    paymentIntentId: { type: String, default: "" },
    paymentAmount:   { type: Number, default: 0 },
    paymentStatus:   { type: String, enum: ["unpaid", "paid"], default: "unpaid" },
    paymentGateway:  { type: String, enum: ["stripe", "paypal", ""], default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Appointment", appointmentSchema);
