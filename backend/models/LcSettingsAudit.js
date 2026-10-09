const mongoose = require("mongoose");

// A change to the Live Chat settings: who, when, and what (field, before, after). One row per save. Settings are
// configuration, not patient data, but long values are shortened so the log stays small.
const settingsAuditSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actorName: { type: String, default: "", maxlength: 120 },
    actorRole: { type: String, default: "", maxlength: 30 },
    changes: [
      {
        _id: false,
        field: { type: String, required: true, maxlength: 120 },
        before: { type: String, default: "", maxlength: 600 },
        after: { type: String, default: "", maxlength: 600 },
      },
    ],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

settingsAuditSchema.index({ createdAt: -1 });

module.exports = mongoose.model("LcSettingsAudit", settingsAuditSchema);
