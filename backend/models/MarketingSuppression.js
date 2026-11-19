const mongoose = require("mongoose");

// The global "never send marketing mail to this address" list. Checked before EVERY marketing send.
// Entries are kept for good (they are what keeps honouring an unsubscribe); the retention purge does not touch them.
// It affects marketing mail only: OTP, appointment and account emails never look at it.
const suppressionSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    reason: { type: String, enum: ["unsubscribe", "bounce", "complaint", "manual"], required: true },
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: "MarketingCampaign", default: null },
    at: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

module.exports = mongoose.model("MarketingSuppression", suppressionSchema);
