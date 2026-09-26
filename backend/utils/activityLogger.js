const { getClientIp } = require("./clientIp");

// Client IP for audit/consent records. Resolved via Express's trusted-proxy
// handling (see TRUST_PROXY in server.js) rather than the raw, client-
// controllable first X-Forwarded-For entry.
function getIp(req) {
  return getClientIp(req) || req?.socket?.remoteAddress || req?.ip || "unknown";
}

// Intentionally a no-op — activity/audit logging (PHI access, admin actions,
// security events) is not persisted to the database by design. Every
// existing call site across the app already awaits this without inspecting
// the result and without letting a rejection surface to the end user, so
// this stays safe to no-op: nothing depends on it actually writing anywhere.
async function recordActivity(_req, _opts) {
  return null;
}

module.exports = { recordActivity, getIp };
