// Field encryption for Live Chat data (AES-256-GCM, same scheme as chatCrypto.js / phiCrypto.js) under its own
// key, LIVECHAT_ENCRYPTION_KEY. chatCrypto.js is deliberately untouched.
//
// Outside production a domain-separated key derived from JWT_SECRET is used when the env key is not set, so
// local development works. checkLiveChatConfig() makes the key mandatory in production.
const crypto = require("crypto");
const { AsyncLocalStorage } = require("async_hooks");
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

// Keys used to READ data: the current key first, then the previous ones (LIVECHAT_ENCRYPTION_KEY_PREVIOUS, comma
// separated) so data written before a key change stays readable. New data is always written with the current key.
function previousKeys(env = process.env) {
  return String(env.LIVECHAT_ENCRYPTION_KEY_PREVIOUS || "")
    .split(",")
    .map((part) => parseLiveChatKey(part))
    .filter(Boolean);
}
const readKeys = () => [activeKey(), ...previousKeys()];

// First 8 hex characters of SHA-256 of a key: enough to compare two environments, useless to an attacker.
const keyFingerprint = (key) => crypto.createHash("sha256").update(key).digest("hex").slice(0, 8);

// What a reader sees instead of data that no key can decrypt. It never reaches the AI (see decryptLiveChatOrEmpty).
const UNREADABLE_TEXT = "[Message can't be shown – encryption key mismatch]";
const isUnreadable = (text) => text === UNREADABLE_TEXT;

// Per-request report of what could not be decrypted (count + ids, never content), logged once by the route wrapper.
const reportStore = new AsyncLocalStorage();
function runWithDecryptReport(work) {
  const report = { count: 0, ids: new Set() };
  return reportStore.run(report, () => Promise.resolve(work(report)).then((value) => ({ value, report }), (error) => Promise.reject(Object.assign(error, { decryptReport: report }))));
}
let lastLooseLog = 0;
function noteUnreadable(id) {
  const report = reportStore.getStore();
  if (report) {
    report.count += 1;
    if (id) report.ids.add(String(id));
    return;
  }
  if (Date.now() - lastLooseLog > 60_000) {
    lastLooseLog = Date.now();
    console.error("[livechat] some stored text could not be decrypted (key mismatch); showing a placeholder");
  }
}

// { ok, text }: tries the current key, then the previous keys. Never throws.
function tryDecryptLiveChatText(record, keys = readKeys()) {
  if (!record?.cipherText) return { ok: true, text: "" };
  for (const key of keys) {
    try {
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(record.iv, "base64"));
      decipher.setAuthTag(Buffer.from(record.authTag, "base64"));
      return { ok: true, text: Buffer.concat([decipher.update(Buffer.from(record.cipherText, "base64")), decipher.final()]).toString("utf8") };
    } catch {
      /* try the next key */
    }
  }
  return { ok: false, text: "" };
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

// Never throws: text no key can decrypt becomes UNREADABLE_TEXT, so one bad record cannot break a list or a chat.
function decryptLiveChatText(record, id) {
  const result = tryDecryptLiveChatText(record);
  if (result.ok) return result.text;
  noteUnreadable(id);
  return UNREADABLE_TEXT;
}

// Same, but "" when unreadable: for anything that goes to the AI, to an email or into a greeting.
function decryptLiveChatOrEmpty(record) {
  const result = tryDecryptLiveChatText(record);
  if (!result.ok) noteUnreadable();
  return result.ok ? result.text : "";
}

// Keyed hash so a contact can be looked up by email without storing the email in the clear.
function hashLiveChatEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  if (!value) return "";
  return crypto.createHmac("sha256", activeKey()).update(`email:${value}`).digest("hex");
}

// Blind indexes for the Archive search: keyed hashes (HMAC-SHA256 under the live-chat key, one prefix per kind) so an
// exact email or phone can be found without a plaintext copy. They depend on LIVECHAT_ENCRYPTION_KEY: if the key
// changes they must be rebuilt (scripts/backfillLiveChatSearchKeys.js).
const normalizePhone = (phone) => String(phone || "").replace(/\D/g, ""); // digits only: "+1 302-303-9993" = "13023039993"
function hashLiveChatPhone(phone) {
  const value = normalizePhone(phone);
  if (!value) return "";
  return crypto.createHmac("sha256", activeKey()).update(`phone:${value}`).digest("hex");
}
const searchKeysOf = (email, phone) => ({ emailHash: hashLiveChatEmail(email), phoneHash: hashLiveChatPhone(phone) });

module.exports = { ENC_FIELD, UNREADABLE_TEXT, isUnreadable, previousKeys, readKeys, activeKey, keyFingerprint, tryDecryptLiveChatText, runWithDecryptReport, noteUnreadable, decryptLiveChatOrEmpty, encryptLiveChatText, decryptLiveChatText, hashLiveChatEmail, hashLiveChatPhone, normalizePhone, searchKeysOf };
