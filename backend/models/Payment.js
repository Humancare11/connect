const mongoose = require("mongoose");

// Authoritative payment ledger for the User Dashboard's payment history.
// Created once per successfully-verified payment (Stripe/PayPal), after the
// booking it funds has already been written — see billing.js. The unique
// index on (gateway, gatewayReference) is a defense-in-depth idempotency
// guard: ConsumedPayment already prevents a payment from funding two
// bookings, this just prevents a duplicate ledger row if this step is ever
// retried for the same already-consumed payment.
const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
    },
    categoryConsultation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CategoryConsultation",
      default: null,
    },
    gateway: { type: String, enum: ["stripe", "paypal"], required: true },
    // Stripe PaymentIntent id or PayPal order id. Never exposed to the
    // frontend directly — see the /mine and /:id/invoice-url routes.
    gatewayReference: { type: String, required: true },
    amountCents: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "usd" },
    status: { type: String, enum: ["succeeded"], default: "succeeded" },
    description: { type: String, default: "", trim: true },
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      default: null,
    },
    // Bookkeeping for the invoice-reconciliation job (jobs/invoiceReconciliationJob.js).
    // Tracks how many times invoice generation has been attempted for this
    // payment so retries can be capped and rate-limited, independent of
    // whether generation ultimately succeeded.
    invoiceAttempts: { type: Number, default: 0 },
    lastInvoiceAttemptAt: { type: Date, default: null },
    lastInvoiceError: { type: String, default: "" },
  },
  { timestamps: true }
);

// Patient's payment history (most recent first) — the query the dashboard uses.
paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ gateway: 1, gatewayReference: 1 }, { unique: true });
// Reconciliation sweep: find payments whose invoice never got created.
paymentSchema.index({ invoice: 1, createdAt: 1 });

module.exports = mongoose.model("Payment", paymentSchema);
