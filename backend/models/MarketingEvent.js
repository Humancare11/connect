const mongoose = require("mongoose");

const RETENTION_DAYS = Number(process.env.EMAIL_TRACKING_RETENTION_DAYS) || 180;

// One open or click request that reached a known marketing token, counted or ignored (with the reason).
// No IP address is stored and the user agent is reduced to a short family name. Events expire; the
// per-recipient summary on MarketingRecipient stays.
const eventSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "MarketingRecipient", required: true },
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: "MarketingCampaign", required: true },
    kind: { type: String, enum: ["open", "click"], required: true },
    link: { type: mongoose.Schema.Types.ObjectId, ref: "MarketingLink", default: null },
    at: { type: Date, required: true, default: Date.now },
    counted: { type: Boolean, required: true },
    ignoreReason: { type: String, default: "", maxlength: 40 },
    uaFamily: { type: String, default: "", maxlength: 24 },
  },
  { versionKey: false }
);

eventSchema.index({ recipient: 1, kind: 1, at: -1 });
eventSchema.index({ at: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 3600 });

module.exports = mongoose.model("MarketingEvent", eventSchema);
