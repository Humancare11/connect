const mongoose = require("mongoose");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Enrollment = require("../models/Enrollment");
const HealthcareCategory = require("../models/HealthcareCategory");
const ServicePrice = require("../models/ServicePrice");
const ConsumedPayment = require("../models/ConsumedPayment");
const { paypalFetch } = require("./paypal");
const { toCents } = require("./currency");
const { resolveEffectiveCategoryPrice } = require("./categoryPricing");

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
  const feeAmount = enrollment?.consultantFees || 500;
  const feeCurrency = enrollment?.feeCurrency || "USD";
  return toCents(feeAmount, feeCurrency);
}

// Category price, matched by Mongo _id, by the stable `pricingSlug` (the
// short id — e.g. "general" — that survives a category being renamed), or
// by display name as a last resort for older callers that only have that.
// Applies the same CategoryPricing admin override (see categoryPricing.js)
// that /api/appointment-tree uses, so the amount actually charged always
// matches the amount the user was shown.
//
// `requireActive` gates whether a deactivated category can still resolve:
// - true (default) — used when *starting* a new charge (creating a Stripe/
//   PayPal payment for a fresh selection). A category that's currently
//   disabled must not be quotable.
// - false — used when *finalizing* a booking after the payment already
//   succeeded. By that point the charge is already real; the category
//   being deactivated (or renamed) in the meantime must not turn an
//   already-paid booking into an unrecoverable, orphaned charge.
async function resolveCategoryFeeCents(priceRef, { requireActive = true } = {}) {
  if (!priceRef) return null;
  const ref = String(priceRef).trim();
  if (!ref) return null;
  const query = mongoose.isValidObjectId(ref)
    ? { _id: ref }
    : { $or: [{ pricingSlug: ref.toLowerCase() }, { name: ref }] };
  if (requireActive) query.isActive = true;
  const category = await HealthcareCategory.findOne(query).lean();
  if (!category) return null;
  const { price, currency } = await resolveEffectiveCategoryPrice(category);
  return toCents(price, currency);
}

// Service price, matched by slug or by name — both are unique on ServicePrice.
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

async function verifyStripePaymentIntent({ paymentIntentId, expectedCents }) {
  let pi;
  try {
    pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch {
    throw new PaymentVerificationError("Invalid Stripe payment reference.");
  }
  if (pi.status !== "succeeded") {
    throw new PaymentVerificationError(
      "Stripe payment not completed. Please complete payment first.",
      402,
    );
  }
  if (pi.currency !== "usd") {
    throw new PaymentVerificationError("Unsupported payment currency.");
  }
  if (Number.isFinite(expectedCents) && pi.amount !== expectedCents) {
    throw new PaymentVerificationError(
      "Payment amount does not match the current price. Please restart checkout.",
    );
  }
  return { ref: pi.id, amountCents: pi.amount, gateway: "stripe" };
}

async function verifyPaypalOrder({ paypalOrderId, expectedCents }) {
  let order;
  try {
    order = await paypalFetch("GET", `/v2/checkout/orders/${paypalOrderId}`);
  } catch {
    throw new PaymentVerificationError("Invalid PayPal payment reference.");
  }
  if (order.status !== "COMPLETED") {
    throw new PaymentVerificationError("PayPal payment not completed.", 402);
  }
  const captureData = order.purchase_units?.[0]?.payments?.captures?.[0];
  const amountCents = Math.round(parseFloat(captureData?.amount?.value || "0") * 100);
  if (Number.isFinite(expectedCents) && amountCents !== expectedCents) {
    throw new PaymentVerificationError(
      "Payment amount does not match the current price. Please restart checkout.",
    );
  }
  return { ref: paypalOrderId, amountCents, gateway: "paypal" };
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
  resolveDoctorFeeCents,
  resolveCategoryFeeCents,
  resolveServiceFeeCents,
  verifyStripePaymentIntent,
  verifyPaypalOrder,
  claimPaymentOnce,
};
