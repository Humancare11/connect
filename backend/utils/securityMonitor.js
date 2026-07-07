const AuditLog = require("../models/AuditLog");
const { logAudit, getIp } = require("./auditLogger");
const { revokeUserSessions } = require("./tokenRevocation");

const ALERT_RECIPIENTS = (process.env.SECURITY_ALERT_EMAILS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

async function recordSecurityEvent(req, opts) {
  try {
    const userId = opts.userId ? String(opts.userId) : req?.user?.id || "";
    const userEmail = opts.userEmail || req?.user?.email || "";
    const userRole = opts.userRole || req?.user?.role || "anonymous";
    const severity = opts.severity || "medium";
    const type = opts.type;
    const title = opts.title;
    await logAudit(req, {
      action: "SECURITY_EVENT",
      resource: opts.resource || "Security",
      resourceId: opts.resourceId ? String(opts.resourceId) : null,
      userId: userId || undefined,
      userEmail,
      userRole,
      success: false,
      details: {
        type,
        severity,
        title,
        description: opts.description || "",
        metadata: opts.metadata || {},
        alertSent: ALERT_RECIPIENTS.length > 0,
      },
    });

    if (ALERT_RECIPIENTS.length) {
      console.warn("[SecurityAlert]", {
        recipients: ALERT_RECIPIENTS,
        type,
        severity,
        title,
      });
    }

    if (
      userId &&
      ["critical"].includes(severity) &&
      ["privilege_escalation", "suspicious_activity"].includes(type)
    ) {
      await revokeUserSessions(userId, "suspicious_activity");
    }

    return { type, severity, title, userId, userEmail, userRole };
  } catch (err) {
    console.error("[SecurityEvent] Failed to record security event:", err.message);
    return null;
  }
}

async function recordFailedLogin(req, { email, userId, userRole, portal }) {
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const ipAddress = getIp(req);
  const recentCount = await AuditLog.countDocuments({
    action: "SECURITY_EVENT",
    timestamp: { $gte: since },
    "details.type": "failed_login",
    $or: [{ ipAddress }, { userEmail: email || "" }],
  });

  return recordSecurityEvent(req, {
    type: "failed_login",
    severity: recentCount >= 4 ? "high" : "medium",
    title: recentCount >= 4 ? "Multiple failed login attempts" : "Failed login attempt",
    description: `Failed login on ${portal || "unknown"} portal.`,
    userId,
    userEmail: email,
    userRole,
    metadata: { portal, recentCount: recentCount + 1 },
  });
}

module.exports = { recordSecurityEvent, recordFailedLogin };
