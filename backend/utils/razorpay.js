// utils/razorpay.js
//
// Thin wrapper around the official "razorpay" package. Everything the rest of the app needs from Razorpay goes through here, so
// tests replace ONE function (setRazorpayClientForTests) instead of the network.
//
// Env (all server-side; see docs/razorpay.md):
//   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET   the API keys. INR is switched on only when BOTH are set (and MULTI_CURRENCY_ENABLED).
//   RAZORPAY_WEBHOOK_SECRET                the secret configured on the webhook in the Razorpay dashboard.
//
// Capture mode: orders are created with payment_capture = 1 (AUTO-capture). A payment is "captured" the moment the customer pays,
// so there is no authorize-then-capture step to forget (a manually-captured payment is auto-refunded by Razorpay after 5 days).
const crypto = require("crypto");
const { isRazorpayConfigured } = require("./currencyConfig");

let clientOverride = null;
let cachedClient = null;
let cachedFor = "";

// Tests only: pass an object with orders.create / orders.fetch / payments.fetch (or null to go back to the real client).
function setRazorpayClientForTests(client) {
  clientOverride = client;
}

function getRazorpayClient() {
  if (clientOverride) return clientOverride;
  const keyId = String(process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
  if (!keyId || !keySecret) {
    const err = new Error("Razorpay is not configured.");
    err.status = 503;
    throw err;
  }
  if (!cachedClient || cachedFor !== `${keyId}:${keySecret}`) {
    const Razorpay = require("razorpay");
    cachedClient = new Razorpay({ key_id: keyId, key_secret: keySecret });
    cachedFor = `${keyId}:${keySecret}`;
  }
  return cachedClient;
}

// The public key id the browser needs to open Checkout (never the secret).
function getRazorpayKeyId() {
  return String(process.env.RAZORPAY_KEY_ID || "").trim();
}

function hmacHex(secret, payload) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

// Constant-time comparison of two hex strings; false for anything that is not a same-length string.
function safeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

// Checkout's callback signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret).
function verifyPaymentSignature({ orderId, paymentId, signature }) {
  const secret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
  if (!secret || !orderId || !paymentId || typeof signature !== "string") return false;
  return safeEqualHex(hmacHex(secret, `${orderId}|${paymentId}`), signature.trim().toLowerCase());
}

// Webhook signature: HMAC_SHA256(raw request body, webhook secret), sent in X-Razorpay-Signature.
function verifyWebhookSignature(rawBody, signature) {
  const secret = String(process.env.RAZORPAY_WEBHOOK_SECRET || "").trim();
  if (!secret || !rawBody || typeof signature !== "string") return false;
  return safeEqualHex(hmacHex(secret, rawBody), signature.trim().toLowerCase());
}

// Creates the order on the server. `amountPaise` is an integer number of paise; the currency is always INR.
async function createRazorpayOrder({ amountPaise, receipt, notes }) {
  return getRazorpayClient().orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt,
    notes,
    payment_capture: 1,
  });
}

async function fetchRazorpayOrder(orderId) {
  return getRazorpayClient().orders.fetch(orderId);
}

async function fetchRazorpayPayment(paymentId) {
  return getRazorpayClient().payments.fetch(paymentId);
}

module.exports = {
  isRazorpayConfigured,
  setRazorpayClientForTests,
  getRazorpayClient,
  getRazorpayKeyId,
  verifyPaymentSignature,
  verifyWebhookSignature,
  createRazorpayOrder,
  fetchRazorpayOrder,
  fetchRazorpayPayment,
};
