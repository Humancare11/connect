const mongoose = require("mongoose");

// A change to the Live Chat settings: who, when, and what (field, before, after). One row per save. Settings are
// configuration, not patient data, but long values are shortened so the log stays small, except prices and business facts, which are logged in full.
const settingsAuditSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actorName: { type: String, default: "", maxlength: 120 },
    actorRole: { type: String, default: "", maxlength: 30 },
    changes: [
      {
        _id: false,
        field: { type: String, required: true, maxlength: 120 },
        // Prices and business facts are kept in full (up to 8000 characters); everything else is shortened to 400.
        before: { type: String, default: "", maxlength: 9000 },
        after: { type: String, default: "", maxlength: 9000 },
      },
    ],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

settingsAuditSchema.index({ createdAt: -1 });

module.exports = mongoose.model("LcSettingsAudit", settingsAuditSchema);
