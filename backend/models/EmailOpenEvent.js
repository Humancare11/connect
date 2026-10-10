const mongoose = require("mongoose");

const RETENTION_DAYS = Number(process.env.EMAIL_TRACKING_RETENTION_DAYS) || 180;

// One row per image request that reached a known tracking token. Counted or
// ignored (with the reason), so the rules can be tuned later. No IP address is
// stored and the user agent is reduced to a short family name.
const openEventSchema = new mongoose.Schema(
  {
    message: { type: mongoose.Schema.Types.ObjectId, ref: "EmailMessage", required: true },
    at: { type: Date, required: true, default: Date.now },
    counted: { type: Boolean, required: true },
    ignoreReason: { type: String, default: "", maxlength: 40 },
    uaFamily: { type: String, default: "", maxlength: 24 },
  },
  { versionKey: false }
);

openEventSchema.index({ message: 1, at: -1 });
// Events expire; the per-mail summary on EmailMessage.tracking stays.
openEventSchema.index({ at: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 3600 });

module.exports = mongoose.model("EmailOpenEvent", openEventSchema);
module.exports.RETENTION_DAYS = RETENTION_DAYS;
