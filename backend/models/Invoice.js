const mongoose = require("mongoose");

// One invoice per Payment. The PDF itself lives in S3 (private bucket) —
// pdfKey is the S3 object key, never a public URL. Downloads are always
// served through a short-lived presigned URL (see routes/payments.js), the
// same pattern already used for medical-report attachments.
const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
      unique: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amountCents: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "usd" },
    issuedAt: { type: Date, default: Date.now },
    pdfKey: { type: String, required: true },
    emailedAt: { type: Date, default: null },
    emailError: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Invoice", invoiceSchema);
