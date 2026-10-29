import test from "node:test";
import assert from "node:assert/strict";
import { loadRazorpayScript, razorpayPrefill, buildRazorpayOptions, RAZORPAY_SCRIPT_URL } from "./razorpayCheckout.js";
import { paymentFields } from "./paymentFields.js";

// A tiny fake document / window: createElement gives a script whose onload / onerror the test fires by hand.
function fakeEnv() {
  const win = {};
  const appended = [];
  const doc = {
    createElement: () => ({ remove() { this.removed = true; } }),
    body: { appendChild: (el) => appended.push(el) },
  };
  return { win, doc, appended };
}

test("the Razorpay script is loaded once, only when asked for, from Razorpay's own URL", async () => {
  const { win, doc, appended } = fakeEnv();
  assert.equal(RAZORPAY_SCRIPT_URL, "https://checkout.razorpay.com/v1/checkout.js");
  assert.equal(appended.length, 0, "nothing is loaded just by importing the helper");
  const first = loadRazorpayScript(doc, win);
  const second = loadRazorpayScript(doc, win);
  assert.equal(appended.length, 1, "two callers share one script tag");
  assert.equal(appended[0].src, RAZORPAY_SCRIPT_URL);
  win.Razorpay = function Razorpay() {};
  appended[0].onload();
  assert.equal(await first, true);
  assert.equal(await second, true);
  assert.equal(await loadRazorpayScript(doc, win), true, "already there: no second tag");
  assert.equal(appended.length, 1);
});

test("a script that fails to load resolves false, is removed, and the next attempt tries again", async () => {
  const { win, doc, appended } = fakeEnv();
  const failed = loadRazorpayScript(doc, win);
  appended[0].onerror();
  assert.equal(await failed, false);
  assert.equal(appended[0].removed, true);
  const retry = loadRazorpayScript(doc, win);
  assert.equal(appended.length, 2, "a failure is not remembered");
  win.Razorpay = function Razorpay() {};
  appended[1].onload();
  assert.equal(await retry, true);
});

test("without a browser (server-side render) nothing is loaded", async () => {
  assert.equal(await loadRazorpayScript(null, null), false);
});

test("Checkout is pre-filled with the customer's name, email and phone", () => {
  assert.deepEqual(razorpayPrefill({ name: " Asha Rao ", email: "asha@example.com", mobile: "+919876543210" }), {
    name: "Asha Rao",
    email: "asha@example.com",
    contact: "+919876543210",
  });
  assert.deepEqual(razorpayPrefill({ name: "A", email: "a@b.c", phone: "98765" }), { name: "A", email: "a@b.c", contact: "98765" });
  assert.deepEqual(razorpayPrefill(null), { name: "", email: "", contact: "" });
});

test("the options come from the server's order: its amount (paise), INR, its key; the browser adds nothing to the price", () => {
  const order = { orderId: "order_ABC123", amountCents: 99900, currency: "INR", keyId: "rzp_test_k" };
  const opts = buildRazorpayOptions({ keyId: order.keyId, order, user: { name: "A", email: "a@b.c" }, onSuccess() {}, onDismiss() {} });
  assert.equal(opts.key, "rzp_test_k");
  assert.equal(opts.order_id, "order_ABC123");
  assert.equal(opts.amount, 99900);
  assert.equal(opts.currency, "INR");
  assert.deepEqual(opts.prefill, { name: "A", email: "a@b.c", contact: "" });
});

test("success is reported once with Checkout's three values; closing the window after paying is not a cancel", () => {
  const events = [];
  const opts = buildRazorpayOptions({
    keyId: "k",
    order: { orderId: "order_1", amountCents: 100 },
    onSuccess: (r) => events.push(["success", r]),
    onDismiss: () => events.push(["dismiss"]),
  });
  const response = { razorpay_order_id: "order_1", razorpay_payment_id: "pay_1", razorpay_signature: "sig" };
  opts.handler(response);
  opts.handler(response); // a repeated callback does nothing
  opts.modal.ondismiss(); // the window closing after a success is not a cancel
  assert.deepEqual(events, [["success", response]]);
});

test("closing the window without paying is reported as a dismiss (the user cancelled)", () => {
  const events = [];
  const opts = buildRazorpayOptions({
    keyId: "k",
    order: { orderId: "order_1", amountCents: 100 },
    onSuccess: () => events.push("success"),
    onDismiss: () => events.push("dismiss"),
  });
  opts.modal.ondismiss();
  assert.deepEqual(events, ["dismiss"]);
  assert.equal(opts.modal.confirm_close, true, "asks before closing a half-finished payment");
});

test("paymentFields: each gateway sends its own reference; Razorpay sends order id, payment id and signature", () => {
  assert.deepEqual(paymentFields("stripe", "pi_1"), { paymentIntentId: "pi_1" });
  assert.deepEqual(paymentFields("paypal", "O_1"), { paypalOrderId: "O_1" });
  assert.deepEqual(
    paymentFields("razorpay", { razorpay_order_id: "order_1", razorpay_payment_id: "pay_1", razorpay_signature: "sig" }),
    { razorpayOrderId: "order_1", razorpayPaymentId: "pay_1", razorpaySignature: "sig" },
  );
  // never a Stripe/PayPal field next to a Razorpay one
  const razorpay = paymentFields("razorpay", { razorpay_order_id: "o", razorpay_payment_id: "p", razorpay_signature: "s" });
  assert.equal("paymentIntentId" in razorpay || "paypalOrderId" in razorpay, false);
  assert.deepEqual(paymentFields("razorpay", null), { razorpayOrderId: undefined, razorpayPaymentId: undefined, razorpaySignature: undefined });
});
