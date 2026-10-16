const mongoose = require("mongoose");

// Who deleted, restored or purged chats, when, how many and which chat IDs. Deliberately holds NO patient data: no
// names, emails, phones or message text (chat IDs are random public ids). `filters` keeps the Archive filters used
// for a "delete all matching" and only records that a search was used (`hasSearch`), never the search text, which
// may itself be an email or a phone number.
const deletionAuditSchema = new mongoose.Schema(
  {
    action: { type: String, enum: ["delete", "restore", "purge", "auto_purge"], required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // null for the daily job
    actorRole: { type: String, default: "", maxlength: 30 },
    count: { type: Number, default: 0 },
    conversationIds: [{ type: String, maxlength: 20 }],
    filters: {
      from: { type: String, default: "" },
      to: { type: String, default: "" },
      type: { type: String, default: "" },
      reason: { type: String, default: "" },
      hasSearch: { type: Boolean, default: false },
      matching: { type: Boolean, default: false }, // "delete all matching filters" rather than a selection
    },
    refusedCount: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
deletionAuditSchema.index({ createdAt: -1 });

module.exports = mongoose.model("LcChatDeletionAudit", deletionAuditSchema);
