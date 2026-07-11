const { recordActivity, getIp } = require("./activityLogger");
const { revokeUserSessions } = require("./tokenRevocation");

const ALERT_RECIPIENTS = (process.env.SECURITY_ALERT_EMAILS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const failedLoginAttempts = new Map();

function pruneFailedLoginAttempts(now = Date.now()) {
  for (const [key, attempts] of failedLoginAttempts.entries()) {
    const recent = attempts.filter((timestamp) => now - timestamp < FAILED_LOGIN_WINDOW_MS);
    if (recent.length) failedLoginAttempts.set(key, recent);
    else failedLoginAttempts.delete(key);
  }
}

async function recordSecurityEvent(req, opts) {
  try {
    const userId = opts.userId ? String(opts.userId) : req?.user?.id || "";
    const userEmail = opts.userEmail || req?.user?.email || "";
    const userRole = opts.userRole || req?.user?.role || "anonymous";
    const severity = opts.severity || "medium";
    const type = opts.type;
    const title = opts.title;
    await recordActivity(req, {
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
  const now = Date.now();
  const ipAddress = getIp(req);
  const keys = [`ip:${ipAddress}`, `email:${email || ""}`];
  pruneFailedLoginAttempts(now);
  const recentCount = Math.max(...keys.map((key) => failedLoginAttempts.get(key)?.length || 0));
  for (const key of keys) {
    const attempts = failedLoginAttempts.get(key) || [];
    attempts.push(now);
    failedLoginAttempts.set(key, attempts);
  }

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
