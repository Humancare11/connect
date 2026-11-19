const mongoose = require("mongoose");

// One Email Marketing campaign. Counts (sent, opened, ...) are NOT stored here: they are read from the
// recipient rows, so they cannot drift. Retention (see services/marketing/purge.js) removes the recipients'
// personal fields after MARKETING_RETENTION_MONTHS; the campaign itself and its counts stay.
const campaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    mailbox: { type: mongoose.Schema.Types.ObjectId, ref: "Mailbox", required: true },
    // Snapshot of the From identity, so a later edit of the Mail ID cannot change a campaign.
    fromAddress: { type: String, required: true, lowercase: true, trim: true },
    fromName: { type: String, default: "", trim: true, maxlength: 80 },

    subject: { type: String, default: "", maxlength: 300 },
    // Already sanitised (services/marketing/sanitizer.js): the original is never stored.
    html: { type: String, default: "" },
    htmlRemoved: {
      scripts: { type: Number, default: 0 },
      eventHandlers: { type: Number, default: 0 },
      otherUnsafe: { type: Number, default: 0 },
    },
    fallbackName: { type: String, default: "there", trim: true, maxlength: 60 },
    fallbackCompany: { type: String, default: "", trim: true, maxlength: 60 },

    status: { type: String, enum: ["draft", "sending", "sent", "stopped"], default: "draft", index: true },
    // Why a running campaign is waiting (shown to the admin): "daily_cap" | "ses_unavailable" | "".
    holdReason: { type: String, default: "" },
    holdUntil: { type: Date, default: null },

    // What the last recipient parse found (the lists themselves are the recipient rows).
    invalidCount: { type: Number, default: 0 },
    duplicatesCount: { type: Number, default: 0 },
    suppressedCount: { type: Number, default: 0 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdByName: { type: String, default: "" },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    sentByName: { type: String, default: "" },
    confirmedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    stoppedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

campaignSchema.index({ createdAt: -1 });
campaignSchema.index({ status: 1, startedAt: 1 });

module.exports = mongoose.model("MarketingCampaign", campaignSchema);
