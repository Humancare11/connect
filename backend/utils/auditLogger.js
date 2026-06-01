const AuditLog = require("../models/AuditLog");

function getIp(req) {
  return (
    (req?.headers?.["x-forwarded-for"] || "").split(",")[0].trim() ||
    req?.socket?.remoteAddress ||
    req?.ip ||
    "unknown"
  );
}

/**
 * Write a HIPAA audit log entry. Never throws — audit failures must not
 * interrupt the primary request flow.
 *
 * @param {import('express').Request} req
 * @param {object} opts
 * @param {string}  opts.action      - Uppercase action constant, e.g. LOGIN_SUCCESS
 * @param {string}  [opts.resource]  - Affected resource type, e.g. "Prescription"
 * @param {string}  [opts.resourceId]
 * @param {string}  [opts.patientId] - Patient whose PHI was accessed
 * @param {object}  [opts.details]   - Extra context (never include raw passwords)
 * @param {boolean} [opts.success]   - false for failed/denied actions
 * @param {string}  [opts.userId]    - Override when req.user isn't set (e.g. failed login)
 * @param {string}  [opts.userName]
 * @param {string}  [opts.userEmail]
 * @param {string}  [opts.userRole]
 */
async function logAudit(req, opts) {
  try {
    const {
      action,
      resource = "",
      resourceId = null,
      patientId = null,
      details = {},
      success = true,
      userId    = req?.user?.id    || null,
      userName  = req?.user?.name  || "Unknown",
      userEmail = req?.user?.email || "",
      userRole  = req?.user?.role  || "anonymous",
    } = opts;

    await AuditLog.create({
      userId:    userId    ? String(userId)    : null,
      userName,
      userEmail,
      userRole,
      action,
      resource,
      resourceId: resourceId ? String(resourceId) : null,
      patientId:  patientId  ? String(patientId)  : null,
      ipAddress:  getIp(req),
      userAgent:  req?.headers?.["user-agent"] || "",
      details,
      success,
    });
  } catch (err) {
    console.error("[AuditLog] Failed to write log entry:", err.message);
  }
}

module.exports = { logAudit, getIp };
