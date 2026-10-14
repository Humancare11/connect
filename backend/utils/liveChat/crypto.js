// Field encryption for Live Chat data (AES-256-GCM, same scheme as chatCrypto.js / phiCrypto.js) under its own
// key, LIVECHAT_ENCRYPTION_KEY. chatCrypto.js is deliberately untouched.
//
// Outside production a domain-separated key derived from JWT_SECRET is used when the env key is not set, so
// local development works. checkLiveChatConfig() makes the key mandatory in production.
const crypto = require("crypto");
const { parseLiveChatKey } = require("./config");

const KEY_VERSION = process.env.LIVECHAT_ENCRYPTION_KEY_VERSION || "v1";

// Mongoose shape for an encrypted value. Spread into a schema path: `email: ENC_FIELD`.
const ENC_FIELD = {
  cipherText: { type: String, default: "" },
  iv: { type: String, default: "" },
  authTag: { type: String, default: "" },
  keyVersion: { type: String, default: "" },
};

function activeKey() {
  const configured = parseLiveChatKey(process.env.LIVECHAT_ENCRYPTION_KEY);
  if (configured) return configured;
  return crypto
    .createHash("sha256")
    .update(`${process.env.JWT_SECRET || "dev-livechat-key"}:livechat`)
    .digest();
}

function encryptLiveChatText(text) {
  const value = String(text ?? "");
  if (!value) return { cipherText: "", iv: "", authTag: "", keyVersion: KEY_VERSION };
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", activeKey(), iv);
  const cipherText = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    cipherText: cipherText.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion: KEY_VERSION,
  };
}

function decryptLiveChatText(record) {
  if (!record?.cipherText) return "";
  const decipher = crypto.createDecipheriv("aes-256-gcm", activeKey(), Buffer.from(record.iv, "base64"));
  decipher.setAuthTag(Buffer.from(record.authTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(record.cipherText, "base64")), decipher.final()]).toString("utf8");
}

// Keyed hash so a contact can be looked up by email without storing the email in the clear.
function hashLiveChatEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  if (!value) return "";
  return crypto.createHmac("sha256", activeKey()).update(`email:${value}`).digest("hex");
}

module.exports = { ENC_FIELD, encryptLiveChatText, decryptLiveChatText, hashLiveChatEmail };
