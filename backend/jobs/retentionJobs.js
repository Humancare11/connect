const AuditLog = require("../models/AuditLog");
const ChatMessage = require("../models/ChatMessage");
const Prescription = require("../models/Prescription");
const MedicalCertificate = require("../models/MedicalCertificate");
const RetentionPolicy = require("../models/RetentionPolicy");
const { logAudit } = require("../utils/auditLogger");
const { deleteUploadsOlderThan } = require("../utils/uploadStorage");

function cutoff(days) {
  return new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);
}

async function runRetentionCleanup(req = null) {
  const policies = await RetentionPolicy.find({ enabled: true }).lean();
  const byKey = Object.fromEntries(policies.map((policy) => [policy.key, policy]));
  const result = {};

  if (byKey.auditLogs) {
    const deleted = await AuditLog.deleteMany({
      timestamp: { $lt: cutoff(byKey.auditLogs.retentionDays) },
      action: { $not: /^LOGIN_/ },
    });
    result.auditLogs = deleted.deletedCount || 0;
  }

  if (byKey.authLogs) {
    const deleted = await AuditLog.deleteMany({
      timestamp: { $lt: cutoff(byKey.authLogs.retentionDays) },
      action: /^LOGIN_/,
    });
    result.authLogs = deleted.deletedCount || 0;
  }

  if (byKey.chatMessages) {
    const deleted = await ChatMessage.deleteMany({ createdAt: { $lt: cutoff(byKey.chatMessages.retentionDays) } });
    result.chatMessages = deleted.deletedCount || 0;
  }

  if (byKey.medicalRecords) {
    const olderThan = cutoff(byKey.medicalRecords.retentionDays);
    const [prescriptions, certificates] = await Promise.all([
      Prescription.deleteMany({ createdAt: { $lt: olderThan } }),
      MedicalCertificate.deleteMany({ createdAt: { $lt: olderThan } }),
    ]);
    result.medicalRecords = (prescriptions.deletedCount || 0) + (certificates.deletedCount || 0);
  }

  if (byKey.uploadedFiles) {
    const olderThan = cutoff(byKey.uploadedFiles.retentionDays);
    result.uploadedFiles = await deleteUploadsOlderThan(olderThan);
  }

  await logAudit(req, {
    action: "RETENTION_CLEANUP_RUN",
    resource: "RetentionPolicy",
    details: result,
  });

  return { msg: "Retention cleanup completed.", deleted: result };
}

function scheduleRetentionCleanup() {
  const intervalMs = 24 * 60 * 60 * 1000;
  setInterval(() => {
    runRetentionCleanup().catch((err) => console.error("retention cleanup error:", err));
  }, intervalMs).unref();
}

module.exports = { runRetentionCleanup, scheduleRetentionCleanup };
