// Signed, stateless proof that a device was granted a direct-call role
// session — carries {roomId, role, sessionId}. The token itself is never
// looked up anywhere; it only proves the holder once had this sessionId.
// What actually decides whether a session is CURRENT is a compare against
// the room's own doctorSession/patientSession.sessionId in the DB (see
// directVideoRoomController.js / server.js) — so a superseded token stays
// cryptographically valid forever but is rejected the moment the room's
// current sessionId for that role no longer matches it. That's what makes
// a takeover / "regenerate and end session" actually revoke the old device
// without needing a token blocklist.
//
// Deliberately signed with its own secret, not JWT_SECRET — a leaked direct-
// call session token (an anonymous, PIN-gated room) and a leaked platform
// login token are very different severities; keeping the secrets separate
// means rotating one never touches the other.
const crypto = require("crypto");

const DEV_FALLBACK_SECRET = "dev-only-insecure-direct-session-secret";

function getSecret() {
  const secret = process.env.DIRECT_SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DIRECT_SESSION_SECRET is not set. Refusing to issue direct-call session tokens in production without it.");
    }
    return DEV_FALLBACK_SECRET;
  }
  return secret;
}

function signSessionToken({ roomId, role, sessionId }) {
  const payload = JSON.stringify({ roomId, role, sessionId });
  const body = Buffer.from(payload, "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", getSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

// Returns {roomId, role, sessionId} if the signature is valid, else null.
// Only verifies the SIGNATURE — callers must still check the decoded
// sessionId against the room's current session for that role (see above).
function verifySessionToken(token) {
  if (!token || typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", getSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!decoded?.roomId || !decoded?.role || !decoded?.sessionId) return null;
    return decoded;
  } catch {
    return null;
  }
}

module.exports = { signSessionToken, verifySessionToken };
