const mongoose = require("mongoose");
const { bookingAdminFields } = require("../utils/bookingAdminFields");
const { bookingEntryFields } = require("../utils/bookingEntry");
const { bookingSourceFields, protectBookingSource } = require("../utils/bookingSource");


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

    // Which admin assigned the doctor (Appointment has the same object).
    assignedBy: {
      id:         { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      name:       { type: String, default: "" },
      email:      { type: String, default: "" },
      assignedAt: { type: Date, default: null },
    },

    // Enrollment of the first doctor, kept when an admin swaps in an alternate.
    originalDoctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Enrollment",
      default: null,
    },
    ...bookingAdminFields(),
    // Appointment entries: the doctor fee / payout record typed in by an admin (see utils/bookingEntry.js).
    ...bookingEntryFields(),
    // Booking source: platform, app version and the page the booking started from (see utils/bookingSource.js).
    ...bookingSourceFields(),
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
    // Set when an admin reopens a completed appointment; cleared again on completion.
    // Lets the doctor's list show a "Reopened by admin" note.
    reopenedByAdmin: {
      type: new mongoose.Schema(
        {
          id:   { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
          name: { type: String, default: "" },
          at:   { type: Date, default: null },
        },
        { _id: false }
      ),
      default: undefined,
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
    // Currency of paymentAmount / consultationPrice. Bookings made before
    // multi-currency existed have none stored and read as "usd".
    paymentCurrency: {
      type: String,
      enum: ["usd", "eur", "gbp", "inr"],
      default: "usd",
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "refunded"],
      default: "unpaid",
    },
    paymentGateway: {
      type: String,
      enum: ["", "stripe", "paypal", "razorpay"],
      default: "",
    },
    // Set only for a Razorpay payment (paymentIntentId then holds the same razorpayPaymentId).
    razorpayOrderId: { type: String, default: "" },
    razorpayPaymentId: { type: String, default: "" },
  },
  {
    timestamps: true,
  }
);

// Looks up a patient's bookings (patient "my appointments" list and the admin
// user-profile consultation summary).
consultationSchema.index({ patientId: 1 });

// The booking source is written once, at creation (see utils/bookingSource.js).
protectBookingSource(consultationSchema);

module.exports = mongoose.model(
  "CategoryConsultation",
  consultationSchema
);