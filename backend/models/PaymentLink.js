const mongoose = require("mongoose");

const paymentLinkSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    amountPaise: { type: Number, required: true, min: 1 },
    currency: { type: String, default: "inr", lowercase: true },
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
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

paymentLinkSchema.index({ createdBy: 1, createdAt: -1 });
paymentLinkSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("PaymentLink", paymentLinkSchema);
