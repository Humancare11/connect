const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const mongoose = require("mongoose");
const crypto = require("crypto");
const Enrollment = require("../models/Enrollment");
const Doctor = require("../models/Doctor");
const PaymentLink = require("../models/PaymentLink");
const { verifyUserToken, verifyAdminToken, adminOnly, paymentAdminOnly } = require("../middleware/verifyToken");
const { toPaise } = require("../utils/currency");

const SUPPORTED_PAYMENT_LINK_CURRENCIES = ["usd", "inr", "eur", "gbp", "cad", "aud", "aed", "sar", "sgd", "jpy"];
const ZERO_DECIMAL_CURRENCIES = new Set(["jpy"]);

function currencyFactor(currency) {
  return ZERO_DECIMAL_CURRENCIES.has(String(currency).toLowerCase()) ? 1 : 100;
}

function toMinorUnits(amount, currency) {
  return Math.round(Number(amount) * currencyFactor(currency));
}

function fromFilterAmount(amount, currency) {
  return Math.round(Number(amount) * currencyFactor(currency || "usd"));
}

function paymentLinkUrl(req, token) {
  const origin = process.env.FRONTEND_URL || `${req.protocol}://${req.get("host")}`;
  return `${origin.replace(/\/+$/, "")}/pay/${token}`;
}

function serializePaymentLink(req, paymentLink) {
  const createdBy = paymentLink.createdBy && typeof paymentLink.createdBy === "object"
    ? {
        _id: paymentLink.createdBy._id,
        name: paymentLink.createdBy.name,
        email: paymentLink.createdBy.email,
        role: paymentLink.createdBy.role,
      }
    : paymentLink.createdBy;

  return {
    _id: paymentLink._id,
    token: paymentLink.token,
    url: paymentLinkUrl(req, paymentLink.token),
    amountPaise: paymentLink.amountPaise,
    currency: paymentLink.currency,
    note: paymentLink.note,
    status: paymentLink.status,
    paymentIntentId: paymentLink.paymentIntentId,
    cardDetails: paymentLink.cardDetails || null,
    paidAt: paymentLink.paidAt,
    createdAt: paymentLink.createdAt,
    updatedAt: paymentLink.updatedAt,
    createdBy,
  };
}

async function resolveDoctorId(value) {
  if (!value) return null;

  const numericId = Number(value);
  if (Number.isInteger(numericId)) {
    const doctor = await Doctor.findOne({ doctorId: numericId }).select("_id").lean();
    if (doctor?._id) return doctor._id;
  }

  if (mongoose.isValidObjectId(value)) {
    const enrollment = await Enrollment.findById(value).select("doctorId").lean();
    if (enrollment?.doctorId) return enrollment.doctorId;
    return value;
  }

  return null;
}

/* POST /api/payments/create-intent
   Creates a Stripe PaymentIntent for card payments only.
   Returns clientSecret and amount in paise. */
router.post("/create-intent", verifyUserToken, async (req, res) => {
  try {
    const { doctorId } = req.body;
    if (!doctorId) return res.status(400).json({ msg: "doctorId is required." });
    const resolvedDoctorId = await resolveDoctorId(doctorId);
    if (!resolvedDoctorId) return res.status(404).json({ msg: "Doctor not found." });

    const enrollment = await Enrollment.findOne({
      doctorId: resolvedDoctorId,
      approvalStatus: "approved",
    }).lean();

    const feeAmount = enrollment?.consultantFees || 500;
    const feeCurrency = enrollment?.feeCurrency || "USD";
    const feePaise = toPaise(feeAmount, feeCurrency);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: feePaise,
      currency: "inr",
      payment_method_types: ["card"],
      metadata: {
        doctorId: resolvedDoctorId.toString(),
        patientId: req.user.id,
      },
    });

    res.json({ clientSecret: paymentIntent.client_secret, amount: feePaise });
  } catch (err) {
    console.error("create-intent error:", err.message);
    res.status(500).json({ msg: err.message || "Failed to create payment intent." });
  }
});

/* GET /api/payments/fee?doctorId=...
   Returns the doctor's consultation fee in paise without creating a PaymentIntent.
   Used by the frontend to display the fee before the user selects a payment method. */
router.get("/fee", verifyUserToken, async (req, res) => {
  try {
    const { doctorId } = req.query;
    if (!doctorId) return res.status(400).json({ msg: "doctorId is required." });
    const resolvedDoctorId = await resolveDoctorId(doctorId);
    if (!resolvedDoctorId) return res.status(404).json({ msg: "Doctor not found." });

    const enrollment = await Enrollment.findOne({
      doctorId: resolvedDoctorId,
      approvalStatus: "approved",
    }).lean();
    const feeAmount = enrollment?.consultantFees || 500;
    const feeCurrency = enrollment?.feeCurrency || "USD";
    const feePaise = toPaise(feeAmount, feeCurrency);
    res.json({ feePaise, feeAmount, feeCurrency });
  } catch (err) {
    console.error("fee error:", err.message);
    res.status(500).json({ msg: "Failed to get fee." });
  }
});

/* GET /api/payments/admin/intent/:id
   Admin-only: fetch full Stripe PaymentIntent details including payment method. */
router.get("/admin/intent/:id", verifyAdminToken, adminOnly, async (req, res) => {
  try {
    const pi = await stripe.paymentIntents.retrieve(req.params.id, {
      expand: ["payment_method"],
    });

    const pm = pi.payment_method;
    const methodInfo = pm ? {
      type: pm.type,
      brand: pm.card?.brand || null,
      last4: pm.card?.last4 || null,
      network: pm.card?.network || null,
    } : null;

    res.json({
      id: pi.id,
      status: pi.status,
      amount: pi.amount,
      currency: pi.currency,
      created: pi.created,
      methodInfo,
    });
  } catch (err) {
    console.error("admin/intent error:", err.message);
    res.status(500).json({ msg: err.message || "Failed to fetch payment details." });
  }
});

router.post("/admin/payment-links", verifyAdminToken, paymentAdminOnly, async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    const currency = String(req.body.currency || "INR").trim().toLowerCase();
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ msg: "Enter a valid amount." });
    }
    if (!SUPPORTED_PAYMENT_LINK_CURRENCIES.includes(currency)) {
      return res.status(400).json({ msg: "Unsupported currency." });
    }

    const amountPaise = toMinorUnits(amount, currency);
    if (amountPaise < 1) {
      return res.status(400).json({ msg: `Minimum amount is ${currency.toUpperCase()} 1.` });
    }

    const token = crypto.randomBytes(18).toString("hex");
    const paymentLink = await PaymentLink.create({
      token,
      amountPaise,
      currency,
      note: String(req.body.note || "").slice(0, 250),
      createdBy: req.user.id,
    });

    res.status(201).json({
      ...serializePaymentLink(req, paymentLink),
    });
  } catch (err) {
    console.error("create payment link error:", err.message);
    res.status(500).json({ msg: "Failed to create payment link." });
  }
});

router.get("/admin/payment-links", verifyAdminToken, paymentAdminOnly, async (req, res) => {
  try {
    const { createdBy, status, currency, startDate, endDate, amountMin, amountMax, q } = req.query;
    const query = {};

    if (req.user.role === "paymentadmin") {
      query.createdBy = req.user.id;
    } else if (createdBy) {
      query.createdBy = createdBy;
    }
    if (status && ["pending", "paid", "expired"].includes(status)) {
      query.status = status;
    }
    if (currency && SUPPORTED_PAYMENT_LINK_CURRENCIES.includes(String(currency).toLowerCase())) {
      query.currency = String(currency).toLowerCase();
    }
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate) query.createdAt.$lte = new Date(`${endDate}T23:59:59.999Z`);
    }
    const min = amountMin === undefined || amountMin === "" ? null : Number(amountMin);
    const max = amountMax === undefined || amountMax === "" ? null : Number(amountMax);
    if (Number.isFinite(min) || Number.isFinite(max)) {
      query.amountPaise = {};
      if (Number.isFinite(min)) query.amountPaise.$gte = fromFilterAmount(min, currency);
      if (Number.isFinite(max)) query.amountPaise.$lte = fromFilterAmount(max, currency);
    }
    if (q) {
      const pattern = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [
        { token: pattern },
        { note: pattern },
        { paymentIntentId: pattern },
      ];
    }

    const links = await PaymentLink.find(query)
      .populate("createdBy", "name email role")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ links: links.map((link) => serializePaymentLink(req, link)) });
  } catch (err) {
    console.error("payment link history error:", err.message);
    res.status(500).json({ msg: "Failed to load payment link history." });
  }
});

router.get("/admin/payment-link-creators", verifyAdminToken, paymentAdminOnly, async (req, res) => {
  try {
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ msg: "Access denied. Super Admins only." });
    }

    const links = await PaymentLink.find({})
      .populate("createdBy", "name email role")
      .select("createdBy amountPaise currency status")
      .lean();

    const byCreator = new Map();
    for (const link of links) {
      const creator = link.createdBy;
      if (!creator?._id || creator.role !== "paymentadmin") continue;
      const id = String(creator._id);
      const current = byCreator.get(id) || {
        _id: creator._id,
        name: creator.name,
        email: creator.email,
        role: creator.role,
        totalLinks: 0,
        paidLinks: 0,
        pendingLinks: 0,
        totalAmountPaise: 0,
        paidAmountPaise: 0,
        currencyTotals: {},
      };

      current.totalLinks += 1;
      current.totalAmountPaise += link.amountPaise || 0;
      current.currencyTotals[link.currency || "inr"] = (current.currencyTotals[link.currency || "inr"] || 0) + (link.amountPaise || 0);
      if (link.status === "paid") {
        current.paidLinks += 1;
        current.paidAmountPaise += link.amountPaise || 0;
      }
      if (link.status === "pending") current.pendingLinks += 1;
      byCreator.set(id, current);
    }

    res.json({ creators: Array.from(byCreator.values()).sort((a, b) => b.totalLinks - a.totalLinks) });
  } catch (err) {
    console.error("payment link creators error:", err.message);
    res.status(500).json({ msg: "Failed to load payment admin history." });
  }
});

router.get("/payment-links/:token", async (req, res) => {
  try {
    const paymentLink = await PaymentLink.findOne({ token: req.params.token }).lean();
    if (!paymentLink) return res.status(404).json({ msg: "Payment link not found." });

    res.json({
      token: paymentLink.token,
      amountPaise: paymentLink.amountPaise,
      currency: paymentLink.currency,
      status: paymentLink.status,
      note: paymentLink.note,
      paidAt: paymentLink.paidAt,
      paymentIntentId: paymentLink.paymentIntentId,
    });
  } catch (err) {
    console.error("get payment link error:", err.message);
    res.status(500).json({ msg: "Failed to load payment link." });
  }
});

router.post("/payment-links/:token/create-intent", async (req, res) => {
  try {
    const paymentLink = await PaymentLink.findOne({ token: req.params.token });
    if (!paymentLink) return res.status(404).json({ msg: "Payment link not found." });
    if (paymentLink.status !== "pending") {
      return res.status(400).json({ msg: "This payment link is no longer payable." });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: paymentLink.amountPaise,
      currency: paymentLink.currency,
      payment_method_types: ["card"],
      metadata: {
        paymentLinkId: paymentLink._id.toString(),
        paymentLinkToken: paymentLink.token,
      },
    });

    paymentLink.paymentIntentId = paymentIntent.id;
    await paymentLink.save();

    res.json({ clientSecret: paymentIntent.client_secret, amount: paymentLink.amountPaise, currency: paymentLink.currency });
  } catch (err) {
    console.error("payment link intent error:", err.message);
    res.status(500).json({ msg: err.message || "Failed to create payment intent." });
  }
});

router.post("/payment-links/:token/confirm", async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    if (!paymentIntentId) return res.status(400).json({ msg: "paymentIntentId is required." });

    const paymentLink = await PaymentLink.findOne({ token: req.params.token });
    if (!paymentLink) return res.status(404).json({ msg: "Payment link not found." });

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["payment_method"],
    });
    if (paymentIntent.status !== "succeeded") {
      return res.status(402).json({ msg: "Payment is not completed." });
    }
    if (paymentIntent.amount !== paymentLink.amountPaise || paymentIntent.currency !== paymentLink.currency) {
      return res.status(400).json({ msg: "Payment amount does not match this link." });
    }

    paymentLink.status = "paid";
    paymentLink.paymentIntentId = paymentIntent.id;
    const paymentMethod = paymentIntent.payment_method;
    if (paymentMethod?.card) {
      paymentLink.cardDetails = {
        maskedNumber: `**** **** **** ${paymentMethod.card.last4 || ""}`.trim(),
        brand: paymentMethod.card.brand || "",
        cardType: paymentMethod.card.funding || paymentMethod.type || "card",
        last4: paymentMethod.card.last4 || "",
        network: paymentMethod.card.network || "",
        country: paymentMethod.card.country || "",
      };
    }
    paymentLink.paidAt = new Date();
    await paymentLink.save();

    res.json({
      status: paymentLink.status,
      amountPaise: paymentLink.amountPaise,
      currency: paymentLink.currency,
      paidAt: paymentLink.paidAt,
      paymentIntentId: paymentLink.paymentIntentId,
    });
  } catch (err) {
    console.error("confirm payment link error:", err.message);
    res.status(500).json({ msg: "Failed to confirm payment." });
  }
});

module.exports = router;
