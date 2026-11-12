const mongoose = require("mongoose");

// One row of the live call transcript. Either a spoken line ("line") or a stretch where nothing was transcribed ("gap": the speaker
// muted, the recognizer was down, the mic stalled...). Written by the SPEAKER'S OWN browser, so recordedBy is the speaker; the server
// takes it from the login token, never from the request body.
//
//   • Rows are never edited. The only way to remove them is the admin delete (DELETE /api/appointments/:id/transcript), which is audited.
//   • The words (original text and its translations) are encrypted at rest with the PHI key (utils/phiCrypto.js) and hidden unless
//     asked for (select: false). Nothing about them is ever logged.
//   • clientId makes a retry safe: the same line sent twice by the same person for the same appointment is stored once.
//   • noticePending is a fact about the moment the line was saved: true = the server did not yet have BOTH people's "this call is being
//     transcribed" notices on file. It is never recomputed afterwards; the notice times are shown next to it.
//   • No automatic deletion (no TTL index): retention is manual, by an admin.
const encSchema = new mongoose.Schema(
  {
    cipherText: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    keyVersion: { type: String, default: "v1" },
  },
  { _id: false }
);

const GAP_REASONS = ["muted", "recognizer_down", "mic_stalled", "backgrounded", "interrupted", "other"];
const CONFIDENCE_TIERS = ["normal", "low", "unclear", "unknown"];

const transcriptSegmentSchema = new mongoose.Schema(
  {
    appointmentId: { type: mongoose.Schema.Types.ObjectId, required: true },
    // Same idea as ConsultationNote: a booking is either an Appointment or a CategoryConsultation.
    appointmentModel: { type: String, enum: ["Appointment", "CategoryConsultation"], required: true },
    kind: { type: String, enum: ["line", "gap"], required: true },

    clientId: { type: String, required: true, maxlength: 64 },
    // The login id of the browser that sent this row = the speaker (for a doctor: the Doctor account id).
    recordedBy: { type: mongoose.Schema.Types.ObjectId, required: true },
    speakerRole: { type: String, enum: ["patient", "doctor"], required: true },

    // receivedAt = the server's clock when the row arrived. spokeAt = the server's estimate of when it was said
    // (receivedAt minus the age the browser reported, so a wrong browser clock cannot move it). Rows are ordered by spokeAt.
    receivedAt: { type: Date, required: true },
    spokeAt: { type: Date, required: true },
    noticePending: { type: Boolean, default: false },
    // true when the row reached the server more than TRANSCRIPT_LATE_UPLOAD_MINUTES (default 30) after the appointment was completed or
    // cancelled. The row is saved anyway (never rejected); the doctor / admin view shows the mark. A fact about the moment of saving.
    lateUpload: { type: Boolean, default: false },

    // ---- line ----
    sourceLang: { type: String, default: "", maxlength: 20 },
    languageSource: { type: String, enum: ["declared", "auto", ""], default: "" },
    confidence: { type: Number, min: 0, max: 1, default: null },
    // Worked out by the server from the thresholds in utils/speech/config.js, so they can be tuned without a new app release.
    confidenceTier: { type: String, enum: CONFIDENCE_TIERS, default: "unknown" },
    flags: {
      suspectedEcho: { type: Boolean, default: false },
      languageNotInList: { type: Boolean, default: false },
    },
    // True when a translation into another language is stored with the line ("Machine-translated, may contain errors").
    machineTranslated: { type: Boolean, default: false },
    // { original, translations: { en: "...", de: "..." } } encrypted
    enc: { type: encSchema, default: undefined, select: false },

    // ---- gap ----
    gapReason: { type: String, enum: [...GAP_REASONS, null], default: null },
    gapFrom: { type: Date, default: null },
    gapTo: { type: Date, default: null },
  },
  { timestamps: false }
);

// One row per person per appointment per clientId: what makes a retried batch safe.
transcriptSegmentSchema.index({ appointmentId: 1, recordedBy: 1, clientId: 1 }, { unique: true });
// Reading a transcript in order.
transcriptSegmentSchema.index({ appointmentId: 1, spokeAt: 1 });

module.exports = mongoose.model("TranscriptSegment", transcriptSegmentSchema);
module.exports.GAP_REASONS = GAP_REASONS;
module.exports.CONFIDENCE_TIERS = CONFIDENCE_TIERS;
