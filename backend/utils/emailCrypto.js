const crypto = require("crypto");

// Field-level encryption at rest for mail content (body text/html + snippet),
// same AES-256-GCM scheme as utils/phiCrypto.js but with its own key, so a
// compromised chat/PHI key can't also read the shared mailboxes.
//
// The key is EMAIL_ENCRYPTION_KEY: 32 bytes, as 64 hex chars or base64.
// Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// Outside production a domain-separated key derived from JWT_SECRET is used so
// local dev works without extra setup; production refuses to run without one.
const KEY_VERSION = process.env.EMAIL_ENCRYPTION_KEY_VERSION || "v1";

function activeKey() {
  const configured = process.env.EMAIL_ENCRYPTION_KEY;
  if (configured) {
    const key = Buffer.from(configured, /^[A-Fa-f0-9]{64}$/.test(configured) ? "hex" : "base64");
    if (key.length === 32) return key;
    throw new Error("EMAIL_ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64).");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("EMAIL_ENCRYPTION_KEY is required in production.");
  }
  return crypto
    .createHash("sha256")
    .update(`${process.env.JWT_SECRET || "dev-email-key"}:email`)
    .digest();
}

// Encrypts { text, html, snippet } into the {cipherText, iv, authTag, keyVersion}
// envelope stored on EmailMessage.content.
function encryptEmailContent({ text = "", html = "", snippet = "" } = {}) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", activeKey(), iv);
  const cipherText = Buffer.concat([
    cipher.update(JSON.stringify({ text, html, snippet }), "utf8"),
    cipher.final(),
  ]);
  return {
    cipherText: cipherText.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion: KEY_VERSION,
  };
}

// Inverse of encryptEmailContent. Returns empty content when there is no
// envelope (e.g. a failed send that never had a body saved).
function decryptEmailContent(envelope) {
  const empty = { text: "", html: "", snippet: "" };
  if (!envelope?.cipherText) return empty;
  const decipher = crypto.createDecipheriv("aes-256-gcm", activeKey(), Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
  const json = Buffer.concat([
    decipher.update(Buffer.from(envelope.cipherText, "base64")),
    decipher.final(),
  ]).toString("utf8");
  return { ...empty, ...JSON.parse(json) };
}

module.exports = { encryptEmailContent, decryptEmailContent };
