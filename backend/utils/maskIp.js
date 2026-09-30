// Phase 5.2: masked IP logging for direct-call joins. Never stores a full
// IP — see resolveMaskedIp() below, the only function call sites should use.
const net = require("net");
const { parseTrustProxy, normalizeIp } = require("./clientIp");

// IPv4: zero out the last octet (e.g. "92.84.12.xxx"). IPv6: keep the first
// 4 hextets (~/64, the typical customer-assigned prefix) and mask the rest —
// not a canonical/reversible form for every abbreviated input, but a
// reasonable, defensible truncation for a privacy-preserving log field. Empty
// string in, empty string out (never throws, never returns something that
// looks like a valid unmasked address).
function maskIp(rawIp) {
  const ip = normalizeIp(rawIp);
  if (!ip) return "";
  if (net.isIPv4(ip)) {
    const parts = ip.split(".");
    parts[3] = "xxx";
    return parts.join(".");
  }
  const hextets = ip.split(":");
  const kept = hextets.slice(0, 4);
  return `${kept.join(":")}::xxxx`;
}

// ON everywhere, including production — explicitly set
// DIRECT_CALL_IP_LOGGING_ENABLED=false to turn it off (nothing else about
// the call depends on this).
function ipLoggingEnabled() {
  return process.env.DIRECT_CALL_IP_LOGGING_ENABLED !== "false";
}

// Mirrors utils/clientIp.js's trust-proxy-aware resolution for the one-time
// HTTP handshake underlying a Socket.IO connection — Engine.IO doesn't run
// that handshake through Express, so req.ip isn't available here. Only the
// first X-Forwarded-For hop is honored (this app fronts with exactly one
// reverse proxy in production).
function getSocketClientIp(socket) {
  const trustProxy = parseTrustProxy(process.env.TRUST_PROXY);
  const xff = socket?.handshake?.headers?.["x-forwarded-for"];
  if (trustProxy && xff) {
    const first = String(xff).split(",")[0];
    const normalized = normalizeIp(first);
    if (normalized) return normalized;
  }
  return normalizeIp(socket?.handshake?.address);
}

// The one function call sites should use: "" when the flag is off or no IP
// could be resolved — callers must treat "" as "omit the field", never store
// it. Never returns a full, unmasked IP.
function resolveMaskedIp(socket) {
  if (!ipLoggingEnabled()) return "";
  const ip = getSocketClientIp(socket);
  return ip ? maskIp(ip) : "";
}

module.exports = { maskIp, ipLoggingEnabled, getSocketClientIp, resolveMaskedIp };
