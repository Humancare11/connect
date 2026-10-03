const fs = require("fs");
const { JWT } = require("google-auth-library");
const { gmail } = require("@googleapis/gmail");
const { EMAIL_DOMAIN } = require("../../models/Mailbox");

// Only scope we ever request: read, send and label changes. It cannot
// permanently delete mail, which this module never needs.
const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.modify"];

// Service-account key, from one of:
//   GOOGLE_SA_JSON_B64   base64 of the downloaded JSON key (preferred for hosts
//                        where multi-line env values are awkward)
//   GOOGLE_SA_JSON_PATH  path to the JSON key file (handy locally)
// The key is never committed or logged.
let cachedCredentials = null;

function loadCredentials() {
  if (cachedCredentials) return cachedCredentials;

  let json;
  if (process.env.GOOGLE_SA_JSON_B64) {
    json = Buffer.from(process.env.GOOGLE_SA_JSON_B64, "base64").toString("utf8");
  } else if (process.env.GOOGLE_SA_JSON_PATH) {
    json = fs.readFileSync(process.env.GOOGLE_SA_JSON_PATH, "utf8");
  } else {
    throw new Error("Gmail is not configured. Set GOOGLE_SA_JSON_B64 or GOOGLE_SA_JSON_PATH.");
  }

  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Gmail service-account key is not valid JSON.");
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("Gmail service-account key is missing client_email or private_key.");
  }
  cachedCredentials = {
    email: parsed.client_email,
    // Keys pasted into env files often carry literal "\n" sequences.
    key: String(parsed.private_key).replace(/\\n/g, "\n"),
  };
  return cachedCredentials;
}

// Impersonation guard. Domain-wide delegation lets the key act as ANY user in
// the domain, so we only ever impersonate an active Mailbox row whose address
// is inside the company domain — never an address taken from a request.
function assertImpersonable(mailbox) {
  const address = String(mailbox?.address || "").toLowerCase();
  if (!mailbox || mailbox.isActive !== true || !address.endsWith(`@${EMAIL_DOMAIN}`)) {
    throw new Error("Refusing to access a mailbox that is not an active company mailbox.");
  }
  return address;
}

const apiCache = new Map();

// → the raw @googleapis/gmail `users` API, authorised as this mailbox.
function getGmailApi(mailbox) {
  const address = assertImpersonable(mailbox);
  if (!apiCache.has(address)) {
    const { email, key } = loadCredentials();
    const auth = new JWT({ email, key, scopes: GMAIL_SCOPES, subject: address });
    apiCache.set(address, gmail({ version: "v1", auth }));
  }
  return apiCache.get(address);
}

function resetGmailAuthCache() {
  cachedCredentials = null;
  apiCache.clear();
}

module.exports = { GMAIL_SCOPES, loadCredentials, assertImpersonable, getGmailApi, resetGmailAuthCache };
