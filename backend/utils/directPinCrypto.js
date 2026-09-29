// Encryption (not hashing) for direct-call Doctor/Patient PINs — see the
// implementation plan's reasoning: a patient forgetting a 6-digit PIN is the
// realistic common case, and the admin needs to resend the SAME PIN rather
// than force a full regenerate-and-reshare-to-both-parties. Treated as a
// secret throughout: never logged, never in a URL, only ever decrypted for
// an explicit, logged admin "view PIN" action or the one-time create/
// regenerate response.
const crypto = require("crypto");

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

// Fixed, obviously-fake key so local/e2e runs need no extra setup — refused
// outright in production so a real deployment can never silently run on it.
const DEV_FALLBACK_KEY_HEX = "0".repeat(64);

function getEncKey() {
  const hex = process.env.DIRECT_PIN_ENC_KEY;
  if (!hex) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "DIRECT_PIN_ENC_KEY is not set. Refusing to create/read direct-call PINs in production without it."
      );
    }
    return Buffer.from(DEV_FALLBACK_KEY_HEX, "hex");
  }
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error("DIRECT_PIN_ENC_KEY must be a 64-character hex string (32 bytes) — generate with `openssl rand -hex 32`.");
  }
  return key;
}

function encryptPin(pin) {
  const key = getEncKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(pin), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function decryptPin(encoded) {
  if (!encoded) return "";
  const key = getEncKey();
  const buf = Buffer.from(encoded, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

// 6-digit numeric, zero-padded (so "007123" is a valid, equally-likely PIN,
// not skewed toward higher numbers).
function generatePin() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

module.exports = { encryptPin, decryptPin, generatePin };
