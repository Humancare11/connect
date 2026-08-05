const mongoose = require("mongoose");

// Records every Stripe PaymentIntent / PayPal order that has been used to
// create a booking. The unique index is the actual security control: it's
// what makes a single successful payment usable for exactly one booking,
// regardless of which controller (Appointment or CategoryConsultation)
// consumes it. Insert failing with a duplicate-key error IS the replay check.
const consumedPaymentSchema = new mongoose.Schema(
  {
    gateway: { type: String, required: true, enum: ["stripe", "paypal"] },
    ref: { type: String, required: true }, // paymentIntentId or paypalOrderId
    consumedFor: { type: String, default: "" }, // e.g. "appointment", "categoryConsultation" — informational only
    resourceId: { type: mongoose.Schema.Types.ObjectId, default: null }, // the booking this payment funded
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

consumedPaymentSchema.index({ gateway: 1, ref: 1 }, { unique: true });

module.exports = mongoose.model("ConsumedPayment", consumedPaymentSchema);
