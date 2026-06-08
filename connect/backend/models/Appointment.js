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
    category: { type: String, default: "" },
    specialty: { type: String, default: "" },
    condition: { type: String, default: "" },
    consultationPrice: { type: Number, default: 0 },
    patientDetails: {
      firstName: { type: String, default: "" },
      lastName: { type: String, default: "" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
      dob: { type: String, default: "" },
      gender: { type: String, default: "" },
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
      enum: ["requested", "pending", "confirmed", "completed", "cancelled"],
      default: "requested",
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
    doctorPayoutStatus: { type: String, enum: ["pending", "paid"], default: "pending" },
    doctorPayoutDate:   { type: Date },
    doctorPayoutRef:    { type: String, default: "" },
    doctorPayoutOverrideAmount: { type: Number, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Appointment", appointmentSchema);
