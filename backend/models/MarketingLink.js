const mongoose = require("mongoose");

// One tracked link of one recipient's mail. The redirect can only go to a URL stored here, which was in the
// campaign as the admin wrote it, so it can never become an open redirect. Only the token's SHA-256 is stored.
const linkSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "MarketingRecipient", required: true },
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: "MarketingCampaign", required: true },
    index: { type: Number, required: true },
    url: { type: String, required: true, maxlength: 2048 },
    tokenHash: { type: String, required: true },
    // api: /api/l/<token> (older mails) · own: ?r=<code> on our site · go: /go/<code> redirect
    kind: { type: String, enum: ["api", "own", "go"], default: "api" },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

linkSchema.index({ tokenHash: 1 }, { unique: true });
linkSchema.index({ recipient: 1, index: 1 });

module.exports = mongoose.model("MarketingLink", linkSchema);
