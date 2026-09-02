const mongoose = require("mongoose");

// A care case submitted by a Partner Company through the Partner Dashboard.
// Deliberately its own collection — it is neither a patient-booked
// `Appointment` nor a `Gop`. Both the Partner portal and the Admin portal
// read/write the same documents here; there is no synchronisation layer.
//
// Ownership contract (enforced in routes/partner.js + routes/adminPartnerCases.js):
//   • `partner`, `submittedBy`, `caseNumber` are immutable after creation.
//   • Partner may only: create a case, append `messages`, append `attachments`,
//     and cancel while status === "submitted".
//   • `status`, `assignedDoctor`, `assignedBy`, `videoLink`, `amountCents`,
//     `currency`, `invoice`, `adminNotes` are ADMIN-ONLY. They must never be
//     accepted from a partner request.
//   • `adminNotes` is internal and is never serialised back to a partner.

const attachmentSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    key: { type: String, default: "" },
    url: { type: String, default: "" },
    type: { type: String, default: "" },
    size: { type: String, default: "" },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    body: { type: String, required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId },
    authorName: { type: String, default: "" },
    authorRole: { type: String, enum: ["partner", "admin", "system"], required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    at: { type: Date, default: Date.now },
    byId: { type: mongoose.Schema.Types.ObjectId },
    byName: { type: String, default: "" },
    byRole: { type: String, default: "" },
  },
  { _id: false }
);

const CASE_STATUSES = [
  "submitted",
  "assigned",
  "in-progress",
  "completed",
  "invoiced",
  "cancelled",
];

const partnerCaseSchema = new mongoose.Schema(
  {
    caseNumber: { type: String, required: true, unique: true, index: true },

    // ── Ownership (immutable) ──
    partner: { type: mongoose.Schema.Types.ObjectId, ref: "Partner", required: true, index: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // ── Partner-authored content ──
    serviceType: {
      type: String,
      enum: ["teleconsultation", "house-call", "in-clinic"],
      required: true,
    },
    urgency: {
      type: String,
      enum: ["routine", "urgent", "emergency"],
      default: "routine",
      index: true,
    },
    preferredDate: { type: String, default: "" }, // "YYYY-MM-DD"
    preferredTime: { type: String, default: "" },

    patient: {
      name: { type: String, required: true, trim: true },
      dob: { type: String, default: "" },
      gender: { type: String, default: "" },
      phone: { type: String, default: "" },
      language: { type: String, default: "" },
      policyId: { type: String, default: "" },
      complaint: { type: String, default: "" },
    },
    location: {
      country: { type: String, default: "" },
      state: { type: String, default: "" },
      pharmacyAddress: { type: String, default: "" },
      clinicName: { type: String, default: "" },
      address: { type: String, default: "" },
    },
    attachments: { type: [attachmentSchema], default: [] },

    // ── Admin-controlled (partner sees read-only, except adminNotes) ──
    status: { type: String, enum: CASE_STATUSES, default: "submitted", index: true },
    assignedDoctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", default: null },
    assignedBy: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, default: "" },
      at: { type: Date, default: null },
    },
    videoLink: { type: String, default: "" },
    adminNotes: { type: String, default: "" }, // internal — NEVER serialised to partner

    amountCents: { type: Number, default: null, min: 0 },
    currency: { type: String, default: "usd" },
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: "ManualInvoice", default: null },

    linkedAppointment: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", default: null },

    // ── Shared ──
    messages: { type: [messageSchema], default: [] },
    statusHistory: { type: [statusHistorySchema], default: [] },
  },
  { timestamps: true }
);

partnerCaseSchema.index({ partner: 1, createdAt: -1 });
partnerCaseSchema.index({ status: 1, createdAt: -1 });
partnerCaseSchema.index({ partner: 1, status: 1 });

partnerCaseSchema.statics.CASE_STATUSES = CASE_STATUSES;

module.exports = mongoose.model("PartnerCase", partnerCaseSchema);
module.exports.CASE_STATUSES = CASE_STATUSES;
