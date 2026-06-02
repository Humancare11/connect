const SecurityIncident = require("../models/SecurityIncident");
const { logAudit, getIp } = require("./auditLogger");
const { revokeUserSessions } = require("./tokenRevocation");

const ALERT_RECIPIENTS = (process.env.SECURITY_ALERT_EMAILS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

async function recordSecurityIncident(req, opts) {
  try {
    const incident = await SecurityIncident.create({
      type: opts.type,
      severity: opts.severity || "medium",
      title: opts.title,
      description: opts.description || "",
      userId: opts.userId ? String(opts.userId) : req?.user?.id || "",
      userEmail: opts.userEmail || req?.user?.email || "",
      userRole: opts.userRole || req?.user?.role || "",
      ipAddress: opts.ipAddress || getIp(req),
      userAgent: req?.headers?.["user-agent"] || "",
      resource: opts.resource || "",
      resourceId: opts.resourceId ? String(opts.resourceId) : "",
      metadata: opts.metadata || {},
      alertSent: ALERT_RECIPIENTS.length > 0,
    });

    await logAudit(req, {
      action: "SECURITY_INCIDENT_RECORDED",
      resource: "SecurityIncident",
      resourceId: incident._id,
      userId: incident.userId || undefined,
      userEmail: incident.userEmail,
      userRole: incident.userRole || "anonymous",
      success: false,
      details: { type: incident.type, severity: incident.severity, title: incident.title },
    });

    if (ALERT_RECIPIENTS.length) {
      console.warn("[SecurityAlert]", {
        recipients: ALERT_RECIPIENTS,
        type: incident.type,
        severity: incident.severity,
        title: incident.title,
      });
    }

    if (
      incident.userId &&
      ["critical"].includes(incident.severity) &&
      ["privilege_escalation", "suspicious_activity"].includes(incident.type)
    ) {
      await revokeUserSessions(incident.userId, "suspicious_activity");
    }

    return incident;
  } catch (err) {
    console.error("[SecurityIncident] Failed to record incident:", err.message);
    return null;
  }
}

async function recordFailedLogin(req, { email, userId, userRole, portal }) {
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const ipAddress = getIp(req);
  const recentCount = await SecurityIncident.countDocuments({
    type: "failed_login",
    createdAt: { $gte: since },
    $or: [{ ipAddress }, { userEmail: email || "" }],
  });

  return recordSecurityIncident(req, {
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

module.exports = { recordSecurityIncident, recordFailedLogin };
