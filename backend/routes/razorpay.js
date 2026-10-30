const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { verifyUserToken } = require("../middleware/verifyToken");
const Payment = require("../models/Payment");
const ConsumedPayment = require("../models/ConsumedPayment");
const RazorpayEvent = require("../models/RazorpayEvent");
const { isRazorpayConfigured } = require("../utils/currencyConfig");
const { resolveChargeForSelection } = require("../utils/paymentVerification");
const { createRazorpayOrder, getRazorpayKeyId, verifyWebhookSignature } = require("../utils/razorpay");

/* POST /api/razorpay/create-order
   Creates a Razorpay order for a CATEGORY or SERVICE booking, in INR, for an Indian customer. Like the Stripe / PayPal endpoints, the body
   carries only WHAT is being booked (priceType + priceRef): the amount and the currency are decided here on the server, and a
   client-sent amount or currency is never read. If the server decides this customer pays in anything other than INR (any other
   country, a category or service with no INR price, INR switched off), Razorpay is refused: the gateway follows the currency.
   Returns { orderId, amountCents (paise), currency: "INR", keyId } - keyId is the PUBLIC key Checkout needs. */
router.post("/create-order", verifyUserToken, async (req, res) => {
  try {
    if (!isRazorpayConfigured()) {
      return res.status(503).json({ msg: "Razorpay payments are not available right now." });
    }
    const { priceType, priceRef } = req.body || {};
    // Razorpay is for a category or a service booking (never the doctor fee), and the reference must be a plain string.
    if (!["category", "service"].includes(priceType) || typeof priceRef !== "string" || !priceRef.trim() || priceRef.length > 120) {
      return res.status(400).json({ msg: "Razorpay only takes INR payments for a category or service booking. Please restart checkout." });
    }
    const charge = await resolveChargeForSelection(req, { priceType, priceRef });
    if (!charge) {
      return res.status(400).json({
        msg: "Could not determine a valid price for this selection. Please reselect and try again.",
      });
    }
    if (charge.currency !== "INR") {
      return res.status(400).json({ msg: "Razorpay only takes INR payments. Please restart checkout." });
    }

    const order = await createRazorpayOrder({
      amountPaise: charge.amountMinor,
      receipt: `hc_${String(req.user.id).slice(-8)}_${Date.now().toString(36)}`,
      notes: {
        priceType,
        priceRef: String(priceRef || "").slice(0, 100),
        userId: String(req.user.id),
      },
    });
    if (!order?.id) throw new Error("Razorpay order creation failed");

    res.json({ orderId: order.id, amountCents: charge.amountMinor, currency: "INR", keyId: getRazorpayKeyId() });
  } catch (err) {
    console.error("razorpay/create-order:", err.message);
    res.status(err.status || 500).json({ msg: err.status ? err.message : "Failed to create Razorpay order." });
  }
});

/* POST /api/razorpay/webhook   (mounted in server.js BEFORE express.json(), with the raw body)
   Razorpay calls this for payment.captured, payment.failed and refund.* events. The X-Razorpay-Signature header (HMAC-SHA256 of the
   raw body with RAZORPAY_WEBHOOK_SECRET) is verified before anything is read. It is idempotent: every delivery is stored under its
   X-Razorpay-Event-Id (unique), and a repeated delivery is acknowledged without being handled twice.
     payment.captured  -> recorded; logs [RAZORPAY_UNCLAIMED_CAPTURE] when no booking has used the payment yet (it may simply be
                          about to: a customer who paid and then closed the tab is the case to look for).
     payment.failed    -> recorded.
     refund.processed  -> the matching Payment row gets refundedAmountCents / refundedAt (refunds are made in the Razorpay dashboard).
   Never changes a booking or a doctor payout. */
async function webhookHandler(req, res) {
  try {
    if (!String(process.env.RAZORPAY_WEBHOOK_SECRET || "").trim()) {
      return res.status(503).json({ msg: "Webhook is not configured." });
    }
    const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
    const signature = req.get("x-razorpay-signature") || "";
    if (!raw || !verifyWebhookSignature(raw, signature)) {
      return res.status(400).json({ msg: "Invalid signature." });
    }

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return res.status(400).json({ msg: "Invalid payload." });
    }
    const event = String(payload?.event || "");
    const payment = payload?.payload?.payment?.entity || {};
    const refund = payload?.payload?.refund?.entity || {};
    const eventId = String(req.get("x-razorpay-event-id") || "").trim()
      || `sha256:${crypto.createHash("sha256").update(raw).digest("hex")}`;
    if (!event) return res.status(400).json({ msg: "Invalid payload." });

    const paymentId = String(payment.id || refund.payment_id || "");
    const record = {
      eventId,
      event,
      paymentId,
      orderId: String(payment.order_id || ""),
      refundId: String(refund.id || ""),
      amount: Number(refund.amount ?? payment.amount) || 0,
      currency: String(refund.currency || payment.currency || ""),
    };

    let row;
    try {
      row = await RazorpayEvent.create(record);
    } catch (err) {
      if (err?.code === 11000) return res.json({ received: true, duplicate: true });
      throw err;
    }

    try {
      if (event === "payment.captured" && paymentId) {
        const claimed = Boolean(await ConsumedPayment.exists({ gateway: "razorpay", ref: paymentId }));
        row.claimed = claimed;
        await row.save();
        if (!claimed) {
          console.warn(
            `[RAZORPAY_UNCLAIMED_CAPTURE] payment=${paymentId} order=${record.orderId} amount=${record.amount} ${record.currency} ` +
              "- captured but no booking has used it yet; if none appears, refund it in Razorpay.",
          );
        }
      } else if (event === "refund.processed" && paymentId) {
        const updated = await Payment.findOneAndUpdate(
          { gateway: "razorpay", gatewayReference: paymentId },
          { $inc: { refundedAmountCents: record.amount }, $set: { refundedAt: new Date() } },
        );
        row.applied = Boolean(updated);
        await row.save();
      }
    } catch (err) {
      // Not handled: forget the delivery so Razorpay's retry is processed instead of being skipped as a duplicate.
      await RazorpayEvent.deleteOne({ _id: row._id }).catch(() => {});
      throw err;
    }

    res.json({ received: true });
  } catch (err) {
    console.error("razorpay/webhook:", err.message);
    res.status(500).json({ msg: "Webhook failed." });
  }
}

module.exports = router;
module.exports.webhookHandler = webhookHandler;
