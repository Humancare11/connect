const crypto = require("crypto");

// Unsubscribe tokens: "<recipientId>.<HMAC>". The HMAC (SHA-256, keyed with MARKETING_UNSUB_SECRET) makes the
// link unforgeable; there is no expiry, because an unsubscribe link in an old mail must keep working.
// The token carries no email address.
const TOKEN_RE = /^[a-f0-9]{24}\.[A-Za-z0-9_-]{43}$/;

const sign = (secret, id) => crypto.createHmac("sha256", secret).update(`marketing-unsub:${id}`).digest("base64url");

function createUnsubscribeToken(recipientId, secret) {
  if (!secret || secret.length < 32) throw new Error("MARKETING_UNSUB_SECRET is not set (32+ characters).");
  const id = String(recipientId);
  return `${id}.${sign(secret, id)}`;
}

// → the recipient id, or null for anything that is not a token this server signed.
function verifyUnsubscribeToken(token, secret) {
  if (!secret || secret.length < 32 || typeof token !== "string" || !TOKEN_RE.test(token)) return null;
  const [id, mac] = token.split(".");
  const expected = Buffer.from(sign(secret, id));
  const given = Buffer.from(mac);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected) ? id : null;
}

const unsubscribeUrl = (baseUrl, token) => `${baseUrl}/api/u/${token}`;

module.exports = { createUnsubscribeToken, verifyUnsubscribeToken, unsubscribeUrl, TOKEN_RE };
