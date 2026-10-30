const mongoose = require("mongoose");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Enrollment = require("../models/Enrollment");
const HealthcareCategory = require("../models/HealthcareCategory");
const ServicePrice = require("../models/ServicePrice");
const ConsumedPayment = require("../models/ConsumedPayment");
const { paypalFetch } = require("./paypal");
const { toCents } = require("./currency");
const { resolveEffectiveCategoryPrice } = require("./categoryPricing");
const { resolveEffectiveServicePrice } = require("./servicePricing");
const { getClientIp } = require("./clientIp");
const {
  SUPPORTED_CURRENCIES,
  DEFAULT_CURRENCY,
  resolveRequestCurrency,
  gatewayAllowsCurrency,
  isRazorpayConfigured,
} = require("./currencyConfig");
const { verifyPaymentSignature, fetchRazorpayOrder, fetchRazorpayPayment } = require("./razorpay");

// Thrown whenever a payment fails verification (wrong/missing amount, not
// completed, already used elsewhere). Controllers catch this and respond
// with err.status + err.message directly.
class PaymentVerificationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "PaymentVerificationError";
    this.status = status;
  }
}

// Doctor consultation fee, resolved server-side from the doctor's approved
// Enrollment record — never trust a client-supplied fee for this.
async function resolveDoctorFeeCents(doctorMongoId) {
  if (!doctorMongoId) return null;
  const enrollment = await Enrollment.findOne({
    doctorId: doctorMongoId,
    approvalStatus: "approved",
  }).lean();
  // Fail closed: a missing/zero/invalid fee must never be quietly replaced by
  // a default. Returning null here would make the verifiers skip the amount
  // check entirely, so reject instead.
  const rawFee = enrollment?.consultantFees;
  const feeAmount = Number(rawFee);
  if (rawFee === null || rawFee === undefined || !Number.isFinite(feeAmount) || feeAmount <= 0) {
    throw new PaymentVerificationError(
      "Consultation fee not configured. Please contact support.",
      400,
    );
  }
  const feeCurrency = enrollment?.feeCurrency || "USD";
  return toCents(feeAmount, feeCurrency);
}

// Logs a payment that was captured but could not be turned into a booking, so
// it can be found and refunded manually. Searchable prefix: [ORPHANED_PAYMENT].
// Best-effort look-up of the gateway amount; never throws.
async function logOrphanedPayment({ reason, paymentIntentId, paypalOrderId, doctorId, patientId }) {
  let amount = "unknown";
  try {
    if (paymentIntentId) {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      amount = `${pi.amount} ${pi.currency} (minor units)`;
    } else if (paypalOrderId) {
      const order = await paypalFetch("GET", `/v2/checkout/orders/${paypalOrderId}`);
      const cap = order.purchase_units?.[0]?.payments?.captures?.[0]?.amount;
      if (cap) amount = `${cap.value} ${cap.currency_code}`;
    }
  } catch {
    // amount stays "unknown"; the gateway dashboard has it
  }
  console.error(
    `[ORPHANED_PAYMENT] reason="${reason}" gateway=${paymentIntentId ? "stripe" : "paypal"} ` +
    `ref=${paymentIntentId || paypalOrderId || "unknown"} doctorId=${doctorId} ` +
    `patientId=${patientId} amount=${amount} - manual refund required`,
  );
}

// The three currencies a payment may be taken in. Anything else is refused
// before a gateway is called (create) and after the gateway answers (verify).
// Returns the upper-case code, or throws.
function assertAllowedCurrency(currency) {
  const code = String(currency || "").trim().toUpperCase();
  if (!SUPPORTED_CURRENCIES.includes(code)) {
    throw new PaymentVerificationError("Unsupported payment currency.");
  }
  return code;
}

// The gateway follows the currency: INR is taken by Razorpay only, USD / EUR / GBP by Stripe or PayPal only. Anything else is a
// mismatch and is refused (before a gateway is called when creating, and after it answers when verifying).
function assertGatewayCurrency(gateway, currency) {
  const code = assertAllowedCurrency(currency);
  if (gatewayAllowsCurrency(gateway, code)) return code;
  throw new PaymentVerificationError(
    code === "INR"
      ? "INR payments must be made through Razorpay."
      : "Razorpay only takes INR payments. Please restart checkout.",
  );
}

// The currency this customer is charged in, decided on the server only, from the IP of the request that creates the payment (see
// currencyConfig.resolveRequestCurrency): the same rule as the price shown, and never the profile country. Unknown IP -> USD, and
// always USD while MULTI_CURRENCY_ENABLED is off. The client never sends a currency we trust. The currency is stored on the Stripe
// intent / PayPal order / Razorpay order; booking finalisation verifies against what the payment itself says and does not look at
// the IP again.
async function decidePaymentCurrency(req) {
  try {
    const { currency } = await resolveRequestCurrency({ ip: getClientIp(req) });
    return assertAllowedCurrency(currency);
  } catch {
    return DEFAULT_CURRENCY;
  }
}

// Category price, matched by Mongo _id, by the stable `pricingSlug` (the
// short id - e.g. "general" - that survives a category being renamed), or
// by display name as a last resort for older callers that only have that.
// Applies the same CategoryPricing admin override (see categoryPricing.js)
// that /api/appointment-tree uses, so the amount actually charged always
// matches the amount the user was shown.
//
// Returns { amountMinor, currency } or null when the category isn't found.
// `amountMinor` is the category's stored price IN THAT CURRENCY (cents /
// pence) - nothing is converted between currencies. If `currency` is EUR or
// GBP and the category has no price in it yet, the USD price is returned and
// `currency` says "USD" (and [CURRENCY_FALLBACK_USED] is logged), so the
// caller always charges exactly what the result says.
//
// `requireActive` gates whether a deactivated category can still resolve:
// - true (default) - used when *starting* a new charge (creating a Stripe/
//   PayPal payment for a fresh selection). A category that's currently
//   disabled must not be quotable.
// - false - used when *finalizing* a booking after the payment already
//   succeeded. By that point the charge is already real; the category
//   being deactivated (or renamed) in the meantime must not turn an
//   already-paid booking into an unrecoverable, orphaned charge.
async function resolveCategoryFeeCents(priceRef, { requireActive = true, currency = DEFAULT_CURRENCY } = {}) {
  if (!priceRef) return null;
  const ref = String(priceRef).trim();
  if (!ref) return null;
  const query = mongoose.isValidObjectId(ref)
    ? { _id: ref }
    : { $or: [{ pricingSlug: ref.toLowerCase() }, { name: ref }] };
  if (requireActive) query.isActive = true;
  const category = await HealthcareCategory.findOne(query).lean();
  if (!category) return null;
  const resolved = await resolveEffectiveCategoryPrice(category, undefined, currency);
  const price = Number(resolved.price);
  return {
    amountMinor: Number.isFinite(price) && price > 0 ? Math.round(price * 100) : 0,
    currency: assertAllowedCurrency(resolved.currency),
  };
}

// Service price, matched by slug or by name - both are unique on ServicePrice. Like a category, a service is priced in the
// customer's currency: { amountMinor, currency } with the service's stored price IN THAT currency (nothing is converted), or the USD
// price labelled USD (and [CURRENCY_FALLBACK_USED] logged) when it has none yet. Null when the service is not found.
async function resolveServiceFeeCents(priceRef, { currency = DEFAULT_CURRENCY } = {}) {
  if (!priceRef) return null;
  const ref = String(priceRef).trim();
  if (!ref) return null;
  const service = await ServicePrice.findOne({
    $or: [{ slug: ref.toLowerCase() }, { name: ref }],
  }).lean();
  if (!service) return null;
  const resolved = resolveEffectiveServicePrice(service, currency);
  return {
    amountMinor: Math.round(resolved.price * 100), // the stored price in its own currency: never converted
    currency: assertAllowedCurrency(resolved.currency),
  };
}

// The payment must have been created for the customer who is booking. Stripe stores the user in metadata.userId, PayPal as the last
// ":" part of purchase_units[0].custom_id. A payment with no owner at all (made before this was recorded) is refused too: it could
// belong to anyone. `patientId` is always passed by the booking controllers; without it nothing can be verified, so that fails.
//
// Grace rule for the deploy window: when LEGACY_PAYMENT_OWNER_CUTOFF (an ISO date, the deploy time) is set, a payment with NO owner is
// accepted if it was created before that time AND is less than 24 hours old. Without the variable (or with an unreadable date), or
// with no usable creation time, an owner-less payment is refused. A payment that HAS an owner is never graced: it must match.
const LEGACY_GRACE_MS = 24 * 60 * 60 * 1000;
function isLegacyPaymentAccepted(createdAtMs, now = Date.now()) {
  const cutoff = Date.parse(String(process.env.LEGACY_PAYMENT_OWNER_CUTOFF || "").trim());
  if (!Number.isFinite(cutoff) || !Number.isFinite(createdAtMs)) return false;
  return createdAtMs < cutoff && now - createdAtMs < LEGACY_GRACE_MS;
}

function assertPaymentOwner(owner, patientId, createdAtMs) {
  if (!patientId) {
    throw new PaymentVerificationError("This payment cannot be verified for this account. Please restart checkout.", 403);
  }
  if (!owner) {
    if (isLegacyPaymentAccepted(createdAtMs)) {
      console.warn(`[LEGACY_PAYMENT_OWNER_GRACE] accepted an owner-less payment created ${new Date(createdAtMs).toISOString()} for patient ${patientId}`);
      return;
    }
    throw new PaymentVerificationError("This payment cannot be verified for this account. Please restart checkout.", 403);
  }
  if (String(owner) !== String(patientId)) {
    throw new PaymentVerificationError("This payment was made by a different account.", 403);
  }
}

// When a payment was created, in ms (NaN when unknown): Stripe `created` is unix seconds, PayPal `create_time` is ISO.
function stripeCreatedMs(pi) {
  return Number(pi?.created) * 1000;
}
function paypalCreatedMs(order) {
  return Date.parse(order?.create_time || order?.purchase_units?.[0]?.payments?.captures?.[0]?.create_time || "");
}

function paypalOwnerOf(order) {
  const customId = String(order?.purchase_units?.[0]?.custom_id || "");
  const at = customId.lastIndexOf(":");
  return at === -1 ? "" : customId.slice(at + 1);
}

// Checks one retrieved Stripe PaymentIntent: it succeeded, it was taken in an
// allowed currency, that currency is the one expected, and the amount matches.
function checkStripeIntent(pi, { expectedCents, expectedCurrency = DEFAULT_CURRENCY, patientId }) {
  if (pi.status !== "succeeded") {
    throw new PaymentVerificationError(
      "Stripe payment not completed. Please complete payment first.",
      402,
    );
  }
  assertPaymentOwner(pi.metadata?.userId, patientId, stripeCreatedMs(pi));
  const currency = assertGatewayCurrency("stripe", pi.currency);
  const expected = assertAllowedCurrency(expectedCurrency);
  const metaCurrency = pi.metadata?.currency;
  if (metaCurrency && String(metaCurrency).toUpperCase() !== currency) {
    throw new PaymentVerificationError("Payment currency does not match the current price. Please restart checkout.");
  }
  if (currency !== expected) {
    throw new PaymentVerificationError(
      expected === DEFAULT_CURRENCY
        ? "Unsupported payment currency."
        : "Payment currency does not match the current price. Please restart checkout.",
    );
  }
  if (Number.isFinite(expectedCents) && pi.amount !== expectedCents) {
    throw new PaymentVerificationError(
      "Payment amount does not match the current price. Please restart checkout.",
    );
  }
  return { ref: pi.id, amountCents: pi.amount, currency, gateway: "stripe" };
}

async function retrieveStripeIntent(paymentIntentId) {
  try {
    return await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch {
    throw new PaymentVerificationError("Invalid Stripe payment reference.");
  }
}

async function verifyStripePaymentIntent({ paymentIntentId, expectedCents, expectedCurrency = DEFAULT_CURRENCY, patientId }) {
  const pi = await retrieveStripeIntent(paymentIntentId);
  return checkStripeIntent(pi, { expectedCents, expectedCurrency, patientId });
}

// Checks one retrieved PayPal order: it is COMPLETED, its capture was taken in
// an allowed currency, that currency is the one expected, and the amount matches.
function checkPaypalOrder(order, { paypalOrderId, expectedCents, expectedCurrency = DEFAULT_CURRENCY, patientId }) {
  if (order.status !== "COMPLETED") {
    throw new PaymentVerificationError("PayPal payment not completed.", 402);
  }
  assertPaymentOwner(paypalOwnerOf(order), patientId, paypalCreatedMs(order));
  const captureData = order.purchase_units?.[0]?.payments?.captures?.[0];
  const currency = assertGatewayCurrency("paypal", captureData?.amount?.currency_code);
  const expected = assertAllowedCurrency(expectedCurrency);
  if (currency !== expected) {
    throw new PaymentVerificationError(
      expected === DEFAULT_CURRENCY
        ? "Unsupported payment currency."
        : "Payment currency does not match the current price. Please restart checkout.",
    );
  }
  const amountCents = Math.round(parseFloat(captureData?.amount?.value || "0") * 100);
  if (Number.isFinite(expectedCents) && amountCents !== expectedCents) {
    throw new PaymentVerificationError(
      "Payment amount does not match the current price. Please restart checkout.",
    );
  }
  return { ref: paypalOrderId, amountCents, currency, gateway: "paypal" };
}

async function retrievePaypalOrder(paypalOrderId) {
  try {
    return await paypalFetch("GET", `/v2/checkout/orders/${paypalOrderId}`);
  } catch {
    throw new PaymentVerificationError("Invalid PayPal payment reference.");
  }
}

async function verifyPaypalOrder({ paypalOrderId, expectedCents, expectedCurrency = DEFAULT_CURRENCY, patientId }) {
  const order = await retrievePaypalOrder(paypalOrderId);
  return checkPaypalOrder(order, { paypalOrderId, expectedCents, expectedCurrency, patientId });
}

// Razorpay ids are `order_XXXX` / `pay_XXXX`. Anything else (an object from a NoSQL-style payload, a long string) is refused outright.
const RAZORPAY_ORDER_ID = /^order_[A-Za-z0-9]{6,40}$/;
const RAZORPAY_PAYMENT_ID = /^pay_[A-Za-z0-9]{6,40}$/;

// Verifies a Razorpay payment for an INR booking, after the customer has paid:
//   1. Razorpay is configured, and the expected currency is INR (a Razorpay payment can never fund a USD / EUR / GBP booking);
//   2. razorpay_signature = HMAC_SHA256(order_id|payment_id, key secret), compared in constant time;
//   3. the payment AND its order are fetched from Razorpay itself (the browser's word is never taken): the payment is captured,
//      belongs to that order, is in INR, for exactly the expected amount, and not refunded;
//   4. the order was created for THIS customer (notes.userId), so another customer's paid order cannot be reused.
// Replay protection (one payment = one booking) is claimPaymentOnce, done by the caller in the booking's transaction.
async function verifyRazorpayPayment({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  expectedCents,
  expectedCurrency = "INR",
  patientId,
}) {
  if (!isRazorpayConfigured()) {
    throw new PaymentVerificationError("Razorpay payments are not available right now.", 503);
  }
  if (String(expectedCurrency || "").toUpperCase() !== "INR") {
    throw new PaymentVerificationError("Razorpay only takes INR payments. Please restart checkout.");
  }
  if (typeof razorpayOrderId !== "string" || !RAZORPAY_ORDER_ID.test(razorpayOrderId)
    || typeof razorpayPaymentId !== "string" || !RAZORPAY_PAYMENT_ID.test(razorpayPaymentId)) {
    throw new PaymentVerificationError("Invalid Razorpay payment reference.");
  }
  if (!verifyPaymentSignature({ orderId: razorpayOrderId, paymentId: razorpayPaymentId, signature: razorpaySignature })) {
    throw new PaymentVerificationError("Payment signature is invalid.", 400);
  }

  let payment;
  let order;
  try {
    [payment, order] = await Promise.all([fetchRazorpayPayment(razorpayPaymentId), fetchRazorpayOrder(razorpayOrderId)]);
  } catch {
    throw new PaymentVerificationError("Invalid Razorpay payment reference.");
  }

  if (!payment || payment.id !== razorpayPaymentId || payment.order_id !== razorpayOrderId || !order || order.id !== razorpayOrderId) {
    throw new PaymentVerificationError("Payment does not belong to this order.");
  }
  if (payment.status !== "captured") {
    throw new PaymentVerificationError("Razorpay payment not completed. Please complete payment first.", 402);
  }
  if (String(payment.currency || "").toUpperCase() !== "INR" || String(order.currency || "").toUpperCase() !== "INR") {
    throw new PaymentVerificationError("Razorpay only takes INR payments. Please restart checkout.");
  }
  if (Number(payment.amount_refunded || 0) > 0 || payment.refund_status) {
    throw new PaymentVerificationError("This payment has been refunded.");
  }
  if (Number.isFinite(expectedCents) && (payment.amount !== expectedCents || order.amount !== expectedCents)) {
    throw new PaymentVerificationError("Payment amount does not match the current price. Please restart checkout.");
  }
  if (!patientId || String(order.notes?.userId || "") !== String(patientId)) {
    throw new PaymentVerificationError("This payment was made by a different account.", 403);
  }
  return {
    ref: payment.id,
    amountCents: payment.amount,
    currency: "INR",
    gateway: "razorpay",
    razorpayOrderId,
    razorpayPaymentId: payment.id,
  };
}

// Verifies the payment behind a CATEGORY booking, after the customer has paid.
// The payment itself says which currency it was taken in (it was created by
// this server, in the currency this server decided); that currency must be an
// allowed one, and the amount must equal the category's stored price IN THAT
// currency. A category with no price in that currency (so the payment can't
// have been made in it) is refused, never converted.
//
// `unrecognizedMessage` is what the caller wants shown for an unknown category.
async function verifyCategoryPayment({
  paymentIntentId,
  paypalOrderId,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  patientId,
  priceRef,
  requireActive = false,
  unrecognizedMessage = "Unrecognized category. Please reselect and try again.",
}) {
  return verifyCatalogPayment({
    paymentIntentId,
    paypalOrderId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    patientId,
    unrecognizedMessage,
    resolveFee: (currency) => resolveCategoryFeeCents(priceRef, { requireActive, currency }),
  });
}

// The same verification for a SERVICE booking (Fit to fly, Lab requisitions, ...): the payment says which currency it was taken in,
// and the amount must equal the service's stored price in that currency. Same gateway, ownership and replay rules.
async function verifyServicePayment({
  paymentIntentId,
  paypalOrderId,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  patientId,
  priceRef,
  unrecognizedMessage = "Unrecognized service/category. Please reselect and try again.",
}) {
  return verifyCatalogPayment({
    paymentIntentId,
    paypalOrderId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    patientId,
    unrecognizedMessage,
    resolveFee: (currency) => resolveServiceFeeCents(priceRef, { currency }),
  });
}

// `resolveFee(currency)` gives { amountMinor, currency } for what is being booked (a category or a service) or null.
async function verifyCatalogPayment({
  paymentIntentId,
  paypalOrderId,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  patientId,
  unrecognizedMessage,
  resolveFee,
}) {
  const references = [paymentIntentId, paypalOrderId, razorpayPaymentId || razorpayOrderId].filter(Boolean).length;
  if (references !== 1) {
    throw new PaymentVerificationError("Send exactly one payment reference.");
  }

  // Razorpay: INR only. The category's INR price must exist (a category without one is charged in USD, which Razorpay never takes).
  if (razorpayPaymentId || razorpayOrderId) {
    const inrFee = await resolveFee("INR");
    if (!inrFee || !Number.isFinite(inrFee.amountMinor) || inrFee.amountMinor <= 0) {
      throw new PaymentVerificationError(unrecognizedMessage, 400);
    }
    return verifyRazorpayPayment({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      expectedCents: inrFee.amountMinor,
      expectedCurrency: inrFee.currency,
      patientId,
    });
  }

  let payment;
  let paidCurrency;
  if (paymentIntentId) {
    payment = await retrieveStripeIntent(paymentIntentId);
    paidCurrency = assertGatewayCurrency("stripe", payment.currency);
  } else {
    payment = await retrievePaypalOrder(paypalOrderId);
    paidCurrency = assertGatewayCurrency(
      "paypal",
      payment.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.currency_code,
    );
  }

  const fee = await resolveFee(paidCurrency);
  if (!fee || !Number.isFinite(fee.amountMinor) || fee.amountMinor <= 0) {
    throw new PaymentVerificationError(unrecognizedMessage, 400);
  }

  const expected = { expectedCents: fee.amountMinor, expectedCurrency: fee.currency, patientId };
  return paymentIntentId
    ? checkStripeIntent(payment, expected)
    : checkPaypalOrder(payment, { paypalOrderId, ...expected });
}

// What to charge, BEFORE a gateway is called, for a category or service
// selection: { amountMinor, currency } or null when it can't be priced.
// Everything comes from the server: the client sends only `priceType` and
// `priceRef`. A category or a service is priced in the currency the server decides
// for this customer (USD while MULTI_CURRENCY_ENABLED is off, and USD with a logged
// fallback if it has no price in that currency).
async function resolveChargeForSelection(req, { priceType, priceRef }) {
  const currency = await decidePaymentCurrency(req);
  const fee = priceType === "service"
    ? await resolveServiceFeeCents(priceRef, { currency })
    : await resolveCategoryFeeCents(priceRef, { currency });
  if (!fee || !Number.isFinite(fee.amountMinor) || fee.amountMinor <= 0) return null;
  assertAllowedCurrency(fee.currency); // refuse before any gateway is called
  return fee;
}

// Atomically marks a payment as used so it can never fund a second booking.
// Pass `session` to make this part of the same DB transaction as the booking
// write it's guarding, so a rolled-back booking (e.g. slot-taken conflict)
// releases the payment for retry instead of burning it.
async function claimPaymentOnce({ gateway, ref, consumedFor, resourceId, patientId, session }) {
  try {
    await ConsumedPayment.create(
      [{ gateway, ref, consumedFor, resourceId, patientId }],
      session ? { session } : undefined,
    );
  } catch (err) {
    if (err?.code === 11000) {
      throw new PaymentVerificationError(
        "This payment has already been used for a booking.",
        409,
      );
    }
    throw err;
  }
}

module.exports = {
  PaymentVerificationError,
  assertAllowedCurrency,
  assertGatewayCurrency,
  decidePaymentCurrency,
  resolveDoctorFeeCents,
  logOrphanedPayment,
  resolveCategoryFeeCents,
  resolveServiceFeeCents,
  verifyStripePaymentIntent,
  verifyPaypalOrder,
  verifyRazorpayPayment,
  verifyCategoryPayment,
  verifyServicePayment,
  resolveChargeForSelection,
  claimPaymentOnce,
};
