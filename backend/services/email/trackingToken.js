const crypto = require("crypto");

// Tracking tokens: 24 random bytes → 32 URL-safe characters. Unguessable, carry
// no data (no ids, no addresses), and only their SHA-256 is stored, so reading
// the database never reveals a usable tracking URL.
const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;

const hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

function newToken() {
  const token = crypto.randomBytes(24).toString("base64url");
  return { token, hash: hashToken(token) };
}

const isTokenShape = (value) => typeof value === "string" && TOKEN_RE.test(value);

// The path looks like an ordinary image; it avoids words ("track", "pixel",
// "open") that tracker blocklists match on.
const trackingUrl = (baseUrl, token) => `${baseUrl}/api/e/${token}.gif`;

module.exports = { TOKEN_RE, hashToken, newToken, isTokenShape, trackingUrl };
