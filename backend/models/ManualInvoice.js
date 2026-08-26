const mongoose = require("mongoose");

// One priced line on an itemized manual invoice. amountCents is stored
// (rather than derived on read) so the PDF/history always reflect exactly
// what was billed even if quantity/rate rounding rules change later.
const manualInvoiceItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0.01 },
    rate: { type: Number, required: true, min: 0 },
    amountCents: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

// Admin-created B2B invoices — deliberately kept separate from Payment/Invoice
// (patient bookings verified against a real Stripe/PayPal transaction). A
// manual invoice has no gateway transaction behind it and its recipient is
// not necessarily a registered User, so it doesn't fit either of those
// models' invariants (Payment requires a verified gatewayReference; Invoice
// requires exactly one per Payment).
const manualInvoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    clientName: { type: String, required: true, trim: true },
    clientEmail: { type: String, required: true, trim: true, lowercase: true },
    // Client/billing details shown in the "Billed To" block — all optional,
    // a manual invoice is often a quick one-off with no registered company.
    companyName: { type: String, default: "", trim: true },
    registrationNumber: { type: String, default: "", trim: true },
    address: { type: String, default: "", trim: true },
    country: { type: String, default: "", trim: true },
    postalCode: { type: String, default: "", trim: true },
    paymentTerms: { type: String, default: "Due on Receipt", trim: true },
    dueDate: { type: Date, default: null },
    // Itemized lines the total is built from. description below is now a
    // free-text "Notes" field, not a billable line item.
    items: { type: [manualInvoiceItemSchema], default: [] },
    description: { type: String, default: "", trim: true },
    amountCents: { type: Number, required: true, min: 1 },
    currency: { type: String, default: "usd" },
    // "due"  = bill sent, not yet paid — PDF shows "Amount Due".
    // "paid" = receipt — PDF shows "Total Paid" + the payment method below.
    status: { type: String, enum: ["due", "paid"], required: true, default: "due" },
    paymentMethod: { type: String, default: "", trim: true },
    paidAt: { type: Date, default: null },
    // S3 key of the CURRENT pdf. When a "due" invoice is marked paid, the
    // regenerated receipt overwrites this same object (same invoiceNumber ->
    // same key) — by design there is only ever one live PDF per invoice.
    pdfKey: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    emailedAt: { type: Date, default: null },
    emailError: { type: String, default: "" },
  },
  { timestamps: true }
);

manualInvoiceSchema.index({ createdBy: 1, createdAt: -1 });
manualInvoiceSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("ManualInvoice", manualInvoiceSchema);
