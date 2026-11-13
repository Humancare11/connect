const crypto = require("crypto");

// Field-level encryption at rest for clinical PHI (prescriptions, medical
// certificates) — same AES-256-GCM scheme as utils/chatCrypto.js, but with
// its own key (and its own domain-separated fallback derivation below) so a
// compromised chat key can't also decrypt clinical records.
const KEY_VERSION = process.env.PHI_ENCRYPTION_KEY_VERSION || "v1";

// The configured key as 32 bytes, or null when PHI_ENCRYPTION_KEY is missing or malformed.
function configuredKey(env = process.env) {
  const configured = env.PHI_ENCRYPTION_KEY;
  if (!configured) return null;
  const key = Buffer.from(configured, /^[A-Fa-f0-9]{64}$/.test(configured) ? "hex" : "base64");
  return key.length === 32 ? key : null;
}

// The key used when PHI_ENCRYPTION_KEY is not usable: derived from JWT_SECRET. An environment that has been running on this
// fallback keeps reading its old data by setting PHI_ENCRYPTION_KEY to exactly fallbackKey().toString("hex")
// (npm run phi:fallback-key prints it on the server's own terminal).
function fallbackKey(env = process.env) {
  return crypto.createHash("sha256").update(`${env.JWT_SECRET || "dev-phi-key"}:phi`).digest();
}

function activeKey() {
  return configuredKey() || fallbackKey();
}

// First 8 hex characters of the SHA-256 of a key: enough to compare two environments, useless for recovering the key.
function keyFingerprint(key) {
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 8);
}

// Which key is in use, WITHOUT revealing it. source: "configured" | "invalid" (set but not a valid 32-byte key) | "fallback" (not set).
function phiKeyStatus(env = process.env) {
  const key = configuredKey(env);
  const source = key ? "configured" : env.PHI_ENCRYPTION_KEY ? "invalid" : "fallback";
  return { source, fingerprint: keyFingerprint(key || fallbackKey(env)) };
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

module.exports = { encryptPHI, decryptPHI, fallbackKey, keyFingerprint, phiKeyStatus };
