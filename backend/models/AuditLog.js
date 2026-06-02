const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema({
  userId:    { type: String, default: null },
  userName:  { type: String, default: "Unknown" },
  userEmail: { type: String, default: "" },
  userRole:  {
    type: String,
    enum: ["user", "doctor", "admin", "superadmin", "paymentadmin", "anonymous"],
    default: "anonymous",
  },
  action:     { type: String, required: true },
  resource:   { type: String, default: "" },
  resourceId: { type: String, default: null },
  patientId:  { type: String, default: null },
  ipAddress:  { type: String, default: "" },
  userAgent:  { type: String, default: "" },
  details:    { type: mongoose.Schema.Types.Mixed, default: {} },
  success:    { type: Boolean, default: true },
  timestamp:  { type: Date, default: Date.now },
}, { timestamps: false });

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ patientId: 1 });
auditLogSchema.index({ userRole: 1 });
auditLogSchema.index({ success: 1, timestamp: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
