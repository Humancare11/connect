// The payment reference fields of a booking request, by gateway. Stripe sends the PaymentIntent id, PayPal the order id, Razorpay
// the three values Checkout returned (order id, payment id, signature). The server verifies all of them itself.
export function paymentFields(gateway, paymentRef) {
  if (gateway === "razorpay") {
    return {
      razorpayOrderId: paymentRef?.razorpay_order_id,
      razorpayPaymentId: paymentRef?.razorpay_payment_id,
      razorpaySignature: paymentRef?.razorpay_signature,
    };
  }
  if (gateway === "paypal") return { paypalOrderId: paymentRef };
  return { paymentIntentId: paymentRef };
}
