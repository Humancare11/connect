const mongoose = require("mongoose");

// One row per Razorpay webhook delivery, keyed by the X-Razorpay-Event-Id header. The unique index is what makes the webhook
// idempotent: Razorpay retries a delivery until it gets a 2xx, and a duplicate insert (E11000) means "already handled".
const razorpayEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true },
    event: { type: String, required: true }, // payment.captured, payment.failed, refund.processed, ...
    paymentId: { type: String, default: "" },
    orderId: { type: String, default: "" },
    refundId: { type: String, default: "" },
    amount: { type: Number, default: 0 }, // paise
    currency: { type: String, default: "" },
    // payment.captured: whether a booking has already used this payment when the event arrived.
    claimed: { type: Boolean, default: false },
    // refund.*: whether our Payment row was found and updated.
    applied: { type: Boolean, default: false },
  },
  { timestamps: true },
);

razorpayEventSchema.index({ eventId: 1 }, { unique: true });
razorpayEventSchema.index({ paymentId: 1 });

module.exports = mongoose.model("RazorpayEvent", razorpayEventSchema);
