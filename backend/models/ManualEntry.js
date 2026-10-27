const mongoose = require("mongoose");
const { bookingEntryFields } = require("../utils/bookingEntry");
const M = require("../utils/manualEntry");

// A row on the Appointment entries page for a case that has no booking (a house call or teleconsultation for a company, arranged by
// phone, through a partner...). It carries the same `entry` (doctor's fee, payment to provider, its date, comment) as a booking, so
// one set of rules edits both. Rules, validation and the row shape live in utils/manualEntry.js. Deleting is soft: `deletedAt` hides
// the row, nothing is removed. "Calculation (our margin)" is never stored: it is the consultation fee minus the doctor's fee.
const actorShape = () => ({
  id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  name: { type: String, default: "" },
  email: { type: String, default: "" },
  role: { type: String, default: "" },
});

const manualEntrySchema = new mongoose.Schema(
  {
    // The short id shown on the page ("M-1A2B"): 4 hex characters, unique.
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },

    // 1. Case. `date` is the case date ("YYYY-MM-DD", like a booking's consultation date).
    date: { type: String, required: true },
    company: { type: String, default: "", trim: true, maxlength: M.MAX_COMPANY_LENGTH },
    caseNumber: { type: String, default: "", trim: true, maxlength: M.MAX_CASE_NUMBER_LENGTH },
    serviceType: { type: String, enum: M.SERVICE_TYPES, default: "" },
    // Only for serviceType "others".
    otherService: { type: String, default: "", trim: true, maxlength: M.MAX_OTHER_SERVICE_LENGTH },
    caseStatus: { type: String, enum: M.CASE_STATUSES, default: "open" },

    // 2. Service provider: free text, shown in the table's Doctor column.
    doctorName: { type: String, default: "", trim: true, maxlength: M.MAX_PROVIDER_LENGTH },
    providerNumber: { type: String, default: "", trim: true, maxlength: M.MAX_PHONE_LENGTH },

    // 3. Patient. `country` is a country code when it matches one, otherwise the text that was typed.
    patientName: { type: String, required: true, trim: true, maxlength: M.MAX_NAME_LENGTH },
    country: { type: String, default: "", trim: true, maxlength: M.MAX_COUNTRY_LENGTH },
    contactNumber: { type: String, default: "", trim: true, maxlength: M.MAX_PHONE_LENGTH },

    // 4. Fees. The consultation fee is `feeChargedCents` (the table's Fee charged); the doctor's fee is entry.doctorFeeCents.
    feeChargedCents: { type: Number, required: true, min: 0 },

    // 5. Medical report and invoice.
    mrStatus: { type: String, enum: M.MR_STATUSES, default: "pending" },
    mrSentToCompany: { type: String, enum: M.SENT_STATUSES, default: "not_sent" },
    invoiceSent: { type: String, enum: M.SENT_STATUSES, default: "not_sent" },

    // 6. Payments. From the company here; to the provider is entry.paidStatus and entry.paidOn.
    paymentReceived: { type: String, enum: M.PAYMENT_RECEIVED, default: "not_received" },
    paymentReceivedDate: { type: String, default: "" },

    // 7. Feedback (the comment is entry.comment).
    feedbackSent: { type: String, default: "", maxlength: M.MAX_FEEDBACK_LENGTH },
    feedbackReceived: { type: String, default: "", maxlength: M.MAX_FEEDBACK_LENGTH },

    // Older rows (made before the form had these sections) have a time and the id of an approved doctor; both are kept as they were.
    time: { type: String, default: "" },
    doctorEnrollmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Enrollment", default: null },

    ...bookingEntryFields(),

    createdBy: actorShape(),
    deletedAt: { type: Date, default: null },
    deletedBy: actorShape(),
    // Created / edited / deleted, oldest first: { action, field, from, to, by, at }. Every change made in the form is here (the
    // doctor's fee, payment status, paid date and comment too); changes made in the table's cells are in entry.history like a booking's.
    log: {
      type: [
        new mongoose.Schema(
          {
            action: { type: String, enum: M.MANUAL_LOG_ACTIONS, required: true },
            field: { type: String, default: "" },
            from: { type: String, default: "" },
            to: { type: String, default: "" },
            by: actorShape(),
            at: { type: Date, default: Date.now },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true },
);

manualEntrySchema.index({ deletedAt: 1, date: -1 });
manualEntrySchema.index({ doctorName: 1 });

module.exports = mongoose.models.ManualEntry || mongoose.model("ManualEntry", manualEntrySchema);
