const mongoose = require("mongoose");

// Who read or deleted a call transcript, and when. Written on EVERY read and delete (utils/activityLogger.js is a deliberate no-op, so
// this is the real audit trail for the transcript).
//
//   • Never contains transcript text. For a delete it holds the reason the admin typed and how many rows were removed.
//   • Rows are never edited or deleted by the app, and nothing expires them.
//   • A read is only answered after its row is saved (fail closed): if this cannot be written, no transcript is returned.
const transcriptAccessLogSchema = new mongoose.Schema(
  {
    appointmentId: { type: mongoose.Schema.Types.ObjectId, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    role: { type: String, required: true, maxlength: 30 },
    action: { type: String, enum: ["view", "delete"], required: true },
    // view: rows returned. delete: rows removed (filled in once the delete has finished; null until then).
    count: { type: Number, default: null },
    reason: { type: String, default: "", maxlength: 300 },
    ip: { type: String, default: "", maxlength: 64 },
    userAgent: { type: String, default: "", maxlength: 300 },
    at: { type: Date, required: true },
  },
  { timestamps: false }
);

transcriptAccessLogSchema.index({ appointmentId: 1, at: 1 });
transcriptAccessLogSchema.index({ userId: 1, at: 1 });

module.exports = mongoose.model("TranscriptAccessLog", transcriptAccessLogSchema);
