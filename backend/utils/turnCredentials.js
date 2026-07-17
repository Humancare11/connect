const crypto = require("crypto");

// Short-lived, per-request TURN credentials using coturn's "TURN REST API"
// convention: username = "<expiry-unix-seconds>:<identifier>", credential =
// base64(HMAC-SHA1(secret, username)). coturn validates this natively when
// configured with `use-auth-secret` + a matching `static-auth-secret` — the
// TURN server itself never needs to store per-user credentials.
//
// This replaces a permanent, static TURN username/password that previously
// had to be shipped to every browser client (and was therefore readable by
// anyone opening devtools on the site, and usable as a free open relay
// indefinitely). A leaked short-lived credential is only useful until its
// expiry instead of forever, and each one is scoped to whichever
// authenticated user requested it.
const DEFAULT_TTL_SECONDS = 6 * 60 * 60; // 6 hours — comfortably longer than any single consultation

function generateTurnCredentials({ identifier, ttlSeconds = DEFAULT_TTL_SECONDS, secret } = {}) {
  // `secret` lets a caller mint a credential for a specific TURN region that
  // uses its own static-auth-secret (see routes/rtc.js for why regions each
  // need their own secret rather than sharing one). Falls back to the single
  // default secret when the caller doesn't specify one, so existing callers
  // are unaffected.
  const effectiveSecret = secret || process.env.TURN_STATIC_AUTH_SECRET;
  if (!effectiveSecret) return null;

  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const safeIdentifier =
    String(identifier || "guest")
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 64) || "guest";
  const username = `${expiresAt}:${safeIdentifier}`;
  const credential = crypto.createHmac("sha1", effectiveSecret).update(username).digest("base64");

  return { username, credential, ttlSeconds, expiresAt };
}

module.exports = { generateTurnCredentials, DEFAULT_TTL_SECONDS };
