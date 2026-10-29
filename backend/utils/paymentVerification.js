const mongoose = require("mongoose");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Enrollment = require("../models/Enrollment");
const HealthcareCategory = require("../models/HealthcareCategory");
const ServicePrice = require("../models/ServicePrice");
const ConsumedPayment = require("../models/ConsumedPayment");
const { paypalFetch } = require("./paypal");
const { toCents } = require("./currency");
const { resolveEffectiveCategoryPrice } = require("./categoryPricing");
const User = require("../models/User");
const { getClientIp } = require("./clientIp");
const { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY, resolveRequestCurrency } = require("./currencyConfig");

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

// The currency this logged-in customer is charged in, decided on the server
// only: their profile country first, then the IP, else USD (see
// currencyConfig.resolveRequestCurrency). Always USD while
// MULTI_CURRENCY_ENABLED is off. The client never sends a currency we trust.
async function decidePaymentCurrency(req) {
  try {
    let userCountry = "";
    if (req?.user?.id) {
      const user = await User.findById(req.user.id).select("country").lean();
      userCountry = user?.country || "";
    }
    const { currency } = await resolveRequestCurrency({ userCountry, ip: getClientIp(req) });
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

// Service price, matched by slug or by name - both are unique on ServicePrice.
// Services stay USD-only.
async function resolveServiceFeeCents(priceRef) {
  if (!priceRef) return null;
  const ref = String(priceRef).trim();
  if (!ref) return null;
  const service = await ServicePrice.findOne({
    $or: [{ slug: ref.toLowerCase() }, { name: ref }],
  }).lean();
  if (!service) return null;
  return toCents(service.price, "USD");
}

// Checks one retrieved Stripe PaymentIntent: it succeeded, it was taken in an
// allowed currency, that currency is the one expected, and the amount matches.
function checkStripeIntent(pi, { expectedCents, expectedCurrency = DEFAULT_CURRENCY }) {
  if (pi.status !== "succeeded") {
    throw new PaymentVerificationError(
      "Stripe payment not completed. Please complete payment first.",
      402,
    );
  }
  const currency = assertAllowedCurrency(pi.currency);
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

async function verifyStripePaymentIntent({ paymentIntentId, expectedCents, expectedCurrency = DEFAULT_CURRENCY }) {
  const pi = await retrieveStripeIntent(paymentIntentId);
  return checkStripeIntent(pi, { expectedCents, expectedCurrency });
}

// Checks one retrieved PayPal order: it is COMPLETED, its capture was taken in
// an allowed currency, that currency is the one expected, and the amount matches.
function checkPaypalOrder(order, { paypalOrderId, expectedCents, expectedCurrency = DEFAULT_CURRENCY }) {
  if (order.status !== "COMPLETED") {
    throw new PaymentVerificationError("PayPal payment not completed.", 402);
  }
  const captureData = order.purchase_units?.[0]?.payments?.captures?.[0];
  const currency = assertAllowedCurrency(captureData?.amount?.currency_code);
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

async function verifyPaypalOrder({ paypalOrderId, expectedCents, expectedCurrency = DEFAULT_CURRENCY }) {
  const order = await retrievePaypalOrder(paypalOrderId);
  return checkPaypalOrder(order, { paypalOrderId, expectedCents, expectedCurrency });
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
  priceRef,
  requireActive = false,
  unrecognizedMessage = "Unrecognized category. Please reselect and try again.",
}) {
  let payment;
  let paidCurrency;
  if (paymentIntentId) {
    payment = await retrieveStripeIntent(paymentIntentId);
    paidCurrency = assertAllowedCurrency(payment.currency);
  } else {
    payment = await retrievePaypalOrder(paypalOrderId);
    paidCurrency = assertAllowedCurrency(
      payment.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.currency_code,
    );
  }

  const fee = await resolveCategoryFeeCents(priceRef, { requireActive, currency: paidCurrency });
  if (!fee || !Number.isFinite(fee.amountMinor) || fee.amountMinor <= 0) {
    throw new PaymentVerificationError(unrecognizedMessage, 400);
  }

  const expected = { expectedCents: fee.amountMinor, expectedCurrency: fee.currency };
  return paymentIntentId
    ? checkStripeIntent(payment, expected)
    : checkPaypalOrder(payment, { paypalOrderId, ...expected });
}

// What to charge, BEFORE a gateway is called, for a category or service
// selection: { amountMinor, currency } or null when it can't be priced.
// Everything comes from the server: the client sends only `priceType` and
// `priceRef`. Services are always USD; a category is priced in the currency the
// server decides for this customer (USD while MULTI_CURRENCY_ENABLED is off,
// and USD with a logged fallback if the category has no price in that currency).
async function resolveChargeForSelection(req, { priceType, priceRef }) {
  if (priceType === "service") {
    const cents = await resolveServiceFeeCents(priceRef);
    return Number.isFinite(cents) && cents > 0
      ? { amountMinor: cents, currency: DEFAULT_CURRENCY }
      : null;
  }
  const currency = await decidePaymentCurrency(req);
  const fee = await resolveCategoryFeeCents(priceRef, { currency });
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
  decidePaymentCurrency,
  resolveDoctorFeeCents,
  logOrphanedPayment,
  resolveCategoryFeeCents,
  resolveServiceFeeCents,
  verifyStripePaymentIntent,
  verifyPaypalOrder,
  verifyCategoryPayment,
  resolveChargeForSelection,
  claimPaymentOnce,
};
