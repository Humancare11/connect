const mongoose = require("mongoose");

// One person of one campaign. Personal fields (email, name, company) are removed after the retention
// period; everything else stays so the campaign's counts remain true.
//
// status:  queued -> sending -> sent -> delivered | bounced | complained     (SES events move it on)
//          sending -> uncertain  a crash happened between handing the mail to SES and recording it. It is
//                                NEVER retried automatically (could double-send); an admin may retry it.
//          failed (SES refused it) | skipped (unsubscribed / suppressed / campaign stopped)
const recipientSchema = new mongoose.Schema(
  {
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: "MarketingCampaign", required: true },
    email: { type: String, lowercase: true, trim: true, maxlength: 254 },
    name: { type: String, default: "", trim: true, maxlength: 120 },
    company: { type: String, default: "", trim: true, maxlength: 160 },

    status: {
      type: String,
      enum: ["queued", "sending", "sent", "delivered", "bounced", "complained", "failed", "uncertain", "skipped"],
      default: "queued",
    },
    skipReason: { type: String, default: "", maxlength: 40 },
    errorCode: { type: String, default: "", maxlength: 80 },
    attempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    nextAttemptAt: { type: Date, default: null },

    sesMessageId: { type: String, default: "" },
    sentAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    bouncedAt: { type: Date, default: null },
    bounceType: { type: String, default: "", maxlength: 40 },
    complainedAt: { type: Date, default: null },
    unsubscribedAt: { type: Date, default: null },

    // Open tracking (same rules as the Email page: see services/marketing/tracking.js). Only the SHA-256 of the token is stored.
    openTokenHash: { type: String, default: "" },
    openCount: { type: Number, default: 0 },
    appleOpenCount: { type: Number, default: 0 },
    firstOpenedAt: { type: Date, default: null },
    lastOpenedAt: { type: Date, default: null },
    lastCountedAt: { type: Date, default: null },
    clickCount: { type: Number, default: 0 },
    firstClickedAt: { type: Date, default: null },
    lastClickedAt: { type: Date, default: null },
    repliedAt: { type: Date, default: null },

    purgedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

recipientSchema.index({ campaign: 1, status: 1 });
// One row per address per campaign. A purged row has no address, so the index ignores it.
recipientSchema.index({ campaign: 1, email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } });
recipientSchema.index({ openTokenHash: 1 }, { unique: true, partialFilterExpression: { openTokenHash: { $type: "string", $gt: "" } } });
recipientSchema.index({ sesMessageId: 1 }, { partialFilterExpression: { sesMessageId: { $type: "string", $gt: "" } } });
recipientSchema.index({ sentAt: 1 });
recipientSchema.index({ createdAt: 1 });

module.exports = mongoose.model("MarketingRecipient", recipientSchema);
