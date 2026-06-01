const mongoose = require("mongoose");

const investigationActionSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    notes: { type: String, default: "" },
    status: { type: String, default: "" },
    actorId: { type: String, default: "" },
    actorEmail: { type: String, default: "" },
    actorRole: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const securityIncidentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "failed_login",
        "unauthorized_access",
        "privilege_escalation",
        "large_data_export",
        "phi_after_hours",
        "suspicious_activity",
        "token_revoked",
      ],
      required: true,
      index: true,
    },
    severity: { type: String, enum: ["low", "medium", "high", "critical"], default: "medium", index: true },
    status: { type: String, enum: ["open", "investigating", "resolved", "false_positive"], default: "open", index: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    userId: { type: String, default: "", index: true },
    userEmail: { type: String, default: "" },
    userRole: { type: String, default: "" },
    ipAddress: { type: String, default: "", index: true },
    userAgent: { type: String, default: "" },
    resource: { type: String, default: "" },
    resourceId: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    alertSent: { type: Boolean, default: false },
    investigationHistory: { type: [investigationActionSchema], default: [] },
  },
  { timestamps: true }
);

securityIncidentSchema.index({ createdAt: -1 });
securityIncidentSchema.index({ status: 1, severity: 1, createdAt: -1 });

module.exports = mongoose.model("SecurityIncident", securityIncidentSchema);
