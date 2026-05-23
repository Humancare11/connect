const express    = require("express");
const router     = express.Router();
const mongoose   = require("mongoose");
const { verifyUserToken } = require("../middleware/verifyToken");
const Enrollment = require("../models/Enrollment");
const Doctor     = require("../models/Doctor");
const { paypalFetch } = require("../utils/paypal");
const { convertAmount } = require("../utils/currency");

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

/* POST /api/paypal/create-order
   Creates a PayPal order for the doctor's consultation fee. Returns orderId. */
router.post("/create-order", verifyUserToken, async (req, res) => {
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
    const feeINR = convertAmount(feeAmount, feeCurrency, "INR").toFixed(2);

    const order = await paypalFetch("POST", "/v2/checkout/orders", {
      intent: "CAPTURE",
      purchase_units: [{
        amount: { currency_code: "INR", value: feeINR },
        description: "Doctor Consultation Fee",
      }],
    });

    if (!order.id) throw new Error(order.message || "PayPal order creation failed");
    res.json({ orderId: order.id });
  } catch (err) {
    console.error("paypal/create-order:", err.message);
    res.status(500).json({ msg: err.message || "Failed to create PayPal order." });
  }
});

/* POST /api/paypal/capture-order
   Captures an approved PayPal order. Returns orderId, status, amountPaise. */
router.post("/capture-order", verifyUserToken, async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ msg: "orderId is required." });

    const capture = await paypalFetch("POST", `/v2/checkout/orders/${orderId}/capture`, {});

    if (capture.status !== "COMPLETED") {
      return res.status(400).json({
        msg: `PayPal payment not completed (status: ${capture.status}).`,
      });
    }

    const captureData = capture.purchase_units[0].payments.captures[0];
    const amountINR   = parseFloat(captureData.amount.value);

    res.json({
      orderId:     capture.id,
      status:      "COMPLETED",
      amountPaise: Math.round(amountINR * 100),
    });
  } catch (err) {
    console.error("paypal/capture-order:", err.message);
    res.status(500).json({ msg: err.message || "Failed to capture PayPal payment." });
  }
});

module.exports = router;
