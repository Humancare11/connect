const mongoose = require("mongoose");

// Admin-issued "Guarantee of Payment" — authorizes a service provider (a
// doctor performing a house call, typically) to proceed with a case at an
// agreed fee, before any Payment/invoice exists. Deliberately its own model
// rather than reusing ManualInvoice: a GOP has no due/paid billing state —
// it is a one-time authorization document, not a bill — and its subject is
// a case + provider, not a billed client.
const gopSchema = new mongoose.Schema(
  {
    gopNumber: { type: String, required: true, unique: true, index: true },

    caseType: { type: String, required: true, trim: true },

    // Patient — informational only, never a registered platform User (the
    // patient is very often not the one being billed or logging in here).
    patientName: { type: String, required: true, trim: true },
    patientDob: { type: Date, default: null },
    patientPhone: { type: String, default: "", trim: true },
    patientLocation: { type: String, default: "", trim: true },
    patientComplaint: { type: String, default: "", trim: true },

    requestedService: { type: String, default: "", trim: true },

    // Provider — who the authorization is issued to, and who the generated
    // PDF is emailed to.
    providerName: { type: String, required: true, trim: true },
    providerContact: { type: String, default: "", trim: true },
    providerAddress: { type: String, default: "", trim: true },
    providerEmail: { type: String, required: true, trim: true, lowercase: true },

    amountCents: { type: Number, required: true, min: 1 },
    currency: { type: String, default: "eur" },

    // The name printed as "Authorized by" on the document — free text
    // entered on the form (see GOP.jsx), prefilled with but not locked to
    // the generating admin's own name, since the person authorizing a case
    // isn't always the one at the keyboard.
    authorizedByName: { type: String, required: true, trim: true },

    // S3 key of the generated PDF — a GOP is never regenerated/edited after
    // issuance (unlike a manual invoice, which can flip due -> paid), so
    // this key never changes once set.
    pdfKey: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    emailedAt: { type: Date, default: null },
    emailError: { type: String, default: "" },
  },
  { timestamps: true }
);

gopSchema.index({ createdBy: 1, createdAt: -1 });

module.exports = mongoose.model("Gop", gopSchema);
