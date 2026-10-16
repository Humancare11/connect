const mongoose = require("mongoose");

const RETENTION_DAYS = Number(process.env.EMAIL_TRACKING_RETENTION_DAYS) || 180;

// One row per request that fetched a secure-link attachment, counted or ignored
// (with the reason) so the rules can be tuned later. No IP address is stored and the
// user agent is reduced to a short family name. The per-mail summary stays on
// EmailMessage.tracking when events expire.
const downloadEventSchema = new mongoose.Schema(
  {
    message: { type: mongoose.Schema.Types.ObjectId, ref: "EmailMessage", required: true },
    link: { type: mongoose.Schema.Types.ObjectId, ref: "EmailDownloadLink", required: true },
    at: { type: Date, required: true, default: Date.now },
    counted: { type: Boolean, required: true },
    ignoreReason: { type: String, default: "", maxlength: 40 },
    uaFamily: { type: String, default: "", maxlength: 24 },
  },
  { versionKey: false }
);

downloadEventSchema.index({ message: 1, at: -1 });
downloadEventSchema.index({ message: 1, link: 1, at: -1 });
downloadEventSchema.index({ at: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 3600 });

module.exports = mongoose.model("EmailDownloadEvent", downloadEventSchema);
module.exports.RETENTION_DAYS = RETENTION_DAYS;
