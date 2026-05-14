const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Enrollment = require("../models/Enrollment");
const { verifyUserToken, verifyAdminToken, adminOnly } = require("../middleware/verifyToken");

/* POST /api/payments/create-intent
   Creates a Stripe PaymentIntent for card payments only.
   Returns clientSecret and amount in paise. */
router.post("/create-intent", verifyUserToken, async (req, res) => {
  try {
    const { doctorId } = req.body;
    if (!doctorId) return res.status(400).json({ msg: "doctorId is required." });

    const enrollment = await Enrollment.findOne({
      doctorId,
      approvalStatus: "approved",
    }).lean();

    const feePaise = Math.round((enrollment?.consultantFees || 500) * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: feePaise,
      currency: "inr",
      payment_method_types: ["card"],
      metadata: {
        doctorId: doctorId.toString(),
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

    const enrollment = await Enrollment.findOne({
      doctorId,
      approvalStatus: "approved",
    }).lean();
    const feePaise = Math.round((enrollment?.consultantFees || 500) * 100);
    res.json({ feePaise });
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

module.exports = router;
