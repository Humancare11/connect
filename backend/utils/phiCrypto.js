const crypto = require("crypto");

// Field-level encryption at rest for clinical PHI (prescriptions, medical
// certificates) — same AES-256-GCM scheme as utils/chatCrypto.js, but with
// its own key (and its own domain-separated fallback derivation below) so a
// compromised chat key can't also decrypt clinical records.
const KEY_VERSION = process.env.PHI_ENCRYPTION_KEY_VERSION || "v1";

function activeKey() {
  const configured = process.env.PHI_ENCRYPTION_KEY;
  if (configured) {
    const key = Buffer.from(configured, /^[A-Fa-f0-9]{64}$/.test(configured) ? "hex" : "base64");
    if (key.length === 32) return key;
  }
  return crypto.createHash("sha256").update(`${process.env.JWT_SECRET || "dev-phi-key"}:phi`).digest();
}

// Encrypts an arbitrary JSON-serializable value (the caller decides which
// fields go in) into the {cipherText, iv, authTag, keyVersion} shape stored
// directly on the document.
function encryptPHI(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", activeKey(), iv);
  const cipherText = Buffer.concat([
    cipher.update(JSON.stringify(value ?? null), "utf8"),
    cipher.final(),
  ]);
  return {
    cipherText: cipherText.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion: KEY_VERSION,
  };
}

// Inverse of encryptPHI. Returns null if `record` has no cipherText (e.g. a
// pre-encryption legacy document) — callers fall back to that document's own
// plaintext fields in that case rather than treating this as an error.
function decryptPHI(record) {
  if (!record?.cipherText) return null;
  const decipher = crypto.createDecipheriv("aes-256-gcm", activeKey(), Buffer.from(record.iv, "base64"));
  decipher.setAuthTag(Buffer.from(record.authTag, "base64"));
  const json = Buffer.concat([
    decipher.update(Buffer.from(record.cipherText, "base64")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(json);
}

module.exports = { encryptPHI, decryptPHI };
