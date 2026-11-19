const crypto = require("crypto");

// Verifies that a message really came from Amazon SNS, using the signature SNS puts on every message
// (https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html). No extra package:
// the certificate is fetched from an amazonaws.com host only, and the message must be for OUR topic.

const CERT_HOST_RE = /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/;

class SnsVerifyError extends Error {
  constructor(message) {
    super(message);
    this.name = "SnsVerifyError";
  }
}

const NOTIFICATION_KEYS = ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"];
const CONFIRMATION_KEYS = ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"];

function isSnsUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" && CERT_HOST_RE.test(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function stringToSign(msg) {
  const keys = msg.Type === "Notification" ? NOTIFICATION_KEYS : CONFIRMATION_KEYS;
  return keys.filter((k) => msg[k] !== undefined).map((k) => `${k}\n${msg[k]}\n`).join("");
}

const certCache = new Map();

async function defaultFetchCert(url) {
  if (certCache.has(url)) return certCache.get(url);
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new SnsVerifyError("Could not load the signing certificate.");
  const pem = await res.text();
  certCache.set(url, pem);
  return pem;
}

// → the parsed message. Throws SnsVerifyError for anything that is not a valid message for `topicArn`.
async function verifySnsMessage(rawBody, { topicArn, fetchCert = defaultFetchCert } = {}) {
  if (!topicArn) throw new SnsVerifyError("No topic is configured.");
  let msg;
  try {
    msg = JSON.parse(String(rawBody || ""));
  } catch {
    throw new SnsVerifyError("Not JSON.");
  }
  if (!msg || typeof msg !== "object" || Array.isArray(msg)) throw new SnsVerifyError("Not a message.");
  if (!["Notification", "SubscriptionConfirmation", "UnsubscribeConfirmation"].includes(msg.Type)) throw new SnsVerifyError("Unknown type.");
  if (msg.TopicArn !== topicArn) throw new SnsVerifyError("Wrong topic.");
  if (!["1", "2"].includes(String(msg.SignatureVersion))) throw new SnsVerifyError("Unsupported signature version.");
  if (typeof msg.Signature !== "string" || !isSnsUrl(msg.SigningCertURL) || !/\.pem$/i.test(new URL(msg.SigningCertURL).pathname)) {
    throw new SnsVerifyError("Bad certificate URL.");
  }

  let pem;
  try {
    pem = await fetchCert(msg.SigningCertURL);
  } catch (err) {
    if (err instanceof SnsVerifyError) throw err;
    throw new SnsVerifyError("Could not load the signing certificate.");
  }
  const verifier = crypto.createVerify(String(msg.SignatureVersion) === "2" ? "RSA-SHA256" : "RSA-SHA1");
  verifier.update(stringToSign(msg), "utf8");
  let ok = false;
  try {
    ok = verifier.verify(pem, msg.Signature, "base64");
  } catch {
    ok = false;
  }
  if (!ok) throw new SnsVerifyError("Bad signature.");
  return msg;
}

// Confirms a subscription by opening its SubscribeURL (only ever an amazonaws.com SNS address).
async function confirmSubscription(msg, { fetchImpl = fetch } = {}) {
  if (!isSnsUrl(msg.SubscribeURL)) throw new SnsVerifyError("Bad subscribe URL.");
  const res = await fetchImpl(msg.SubscribeURL, { signal: AbortSignal.timeout(5000) });
  return Boolean(res.ok);
}

module.exports = { verifySnsMessage, confirmSubscription, stringToSign, isSnsUrl, SnsVerifyError };
