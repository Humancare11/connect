const mongoose = require("mongoose");

const paymentLinkSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    amountPaise: { type: Number, required: true, min: 1 },
    currency: { type: String, default: "usd", lowercase: true },
    note: { type: String, default: "", trim: true },
    status: { type: String, enum: ["pending", "paid", "expired"], default: "pending", index: true },
    paymentIntentId: { type: String, default: "" },
    cardDetails: {
      maskedNumber: { type: String, default: "" },
      brand: { type: String, default: "" },
      cardType: { type: String, default: "" },
      last4: { type: String, default: "" },
      network: { type: String, default: "" },
      country: { type: String, default: "" },
    },
    paidAt: { type: Date, default: null },
    // Who the invoice is addressed to (Bill to), and the invoice created with
    // the link. invoiceError holds the last failure while creating/settling it.
    // "b2c" = an individual (name + email, flat services), "b2b" = a business
    // with the full Bill to block. Links created before B2C existed are b2b.
    customerType: { type: String, enum: ["b2c", "b2b"], default: "b2b" },
    customerName: { type: String, default: "", trim: true },
    customerEmail: { type: String, default: "", trim: true, lowercase: true },
    manualInvoice: { type: mongoose.Schema.Types.ObjectId, ref: "ManualInvoice", default: null },
    invoiceError: { type: String, default: "" },
    // Email Stripe captured from the payer at checkout, if any.
    payerEmail: { type: String, default: "", trim: true, lowercase: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

paymentLinkSchema.index({ createdBy: 1, createdAt: -1 });
paymentLinkSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("PaymentLink", paymentLinkSchema);
