const mongoose = require("mongoose");
const { bookingEntryFields } = require("../utils/bookingEntry");
const { MANUAL_LOG_ACTIONS, MAX_NAME_LENGTH, MAX_COUNTRY_LENGTH } = require("../utils/manualEntry");

// A row on the Appointment entries page for a consultation that has no booking (arranged by phone, through a partner...).
// It carries the same `entry` (doctor fee, paid status, paid on, comment) as a booking, so one set of rules edits both.
// Rules, validation and the row shape live in utils/manualEntry.js. Deleting is soft: `deletedAt` hides the row, nothing is removed.
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
    patientName: { type: String, required: true, trim: true, maxlength: MAX_NAME_LENGTH },
    // A country code when it matches one, otherwise the text that was typed.
    country: { type: String, default: "", trim: true, maxlength: MAX_COUNTRY_LENGTH },
    // The approved doctor's Enrollment id (what the page's doctor filter uses) and the name at the time it was chosen.
    doctorEnrollmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Enrollment", default: null },
    doctorName: { type: String, default: "", trim: true, maxlength: MAX_NAME_LENGTH },
    // Same formats as a booking: "YYYY-MM-DD" and "h:mm AM".
    date: { type: String, required: true },
    time: { type: String, default: "" },
    feeChargedCents: { type: Number, required: true, min: 0 },

    ...bookingEntryFields(),

    createdBy: actorShape(),
    deletedAt: { type: Date, default: null },
    deletedBy: actorShape(),
    // Created / edited / deleted, oldest first: { action, field, from, to, by, at }. Edits of the doctor fee, paid status,
    // paid on and comment are in entry.history like a booking's; this log is for the rest.
    log: {
      type: [
        new mongoose.Schema(
          {
            action: { type: String, enum: MANUAL_LOG_ACTIONS, required: true },
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
manualEntrySchema.index({ doctorEnrollmentId: 1 });

module.exports = mongoose.models.ManualEntry || mongoose.model("ManualEntry", manualEntrySchema);
