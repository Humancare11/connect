const crypto = require("crypto");

const KEY_VERSION = process.env.CHAT_ENCRYPTION_KEY_VERSION || "v1";

function activeKey() {
  const configured = process.env.CHAT_ENCRYPTION_KEY;
  if (configured) {
    const key = Buffer.from(configured, /^[A-Fa-f0-9]{64}$/.test(configured) ? "hex" : "base64");
    if (key.length === 32) return key;
  }
  return crypto.createHash("sha256").update(process.env.JWT_SECRET || "dev-chat-key").digest();
}

function encryptChatText(text) {
  const value = String(text || "");
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

function decryptChatText(record) {
  if (!record?.cipherText) return "";
  const decipher = crypto.createDecipheriv("aes-256-gcm", activeKey(), Buffer.from(record.iv, "base64"));
  decipher.setAuthTag(Buffer.from(record.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(record.cipherText, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

module.exports = { encryptChatText, decryptChatText };
