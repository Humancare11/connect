// Razorpay Checkout (rupee payments for customers in India). Pure helpers plus the script loader; no React.
//
// The server creates the order (POST /api/razorpay/create-order), so the amount and the currency are the server's. The browser only
// opens Checkout for that order and hands the result back; the server verifies the signature and fetches the payment from Razorpay
// before it books anything. The Checkout script is loaded only when a rupee payment is about to start - never for any other customer.

export const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

// One load per window, shared by every caller; a failed load is forgotten so the next attempt tries again.
const loads = new WeakMap();

// Loads the Razorpay Checkout script once. Resolves true when window.Razorpay is available, false when it could not be loaded
// (a failed load is not remembered, so the next attempt tries again).
export function loadRazorpayScript(doc = typeof document === "undefined" ? null : document, win = typeof window === "undefined" ? null : window) {
  if (!doc || !win) return Promise.resolve(false);
  if (win.Razorpay) return Promise.resolve(true);
  if (loads.has(win)) return loads.get(win);
  const loading = new Promise((resolve) => {
    const script = doc.createElement("script");
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(Boolean(win.Razorpay));
    script.onerror = () => {
      script.remove();
      resolve(false);
    };
    doc.body.appendChild(script);
  }).then((ok) => {
    if (!ok) loads.delete(win);
    return ok;
  });
  loads.set(win, loading);
  return loading;
}

// What Checkout pre-fills from the signed-in customer (all optional).
export function razorpayPrefill(user) {
  return {
    name: String(user?.name || "").trim(),
    email: String(user?.email || "").trim(),
    contact: String(user?.mobile || user?.phone || "").trim(),
  };
}

// The options object for new window.Razorpay(...). `order` is the server's create-order response.
//   onSuccess(response)  - Checkout's { razorpay_order_id, razorpay_payment_id, razorpay_signature }; called once.
//   onDismiss()          - the customer closed the window without paying; not called after a success.
export function buildRazorpayOptions({ keyId, order, user, description = "Consultation booking fee", onSuccess, onDismiss }) {
  let settled = false;
  return {
    key: keyId,
    order_id: order?.orderId,
    amount: order?.amountCents,
    currency: "INR",
    name: "Humancare Connect",
    description,
    prefill: razorpayPrefill(user),
    theme: { color: "#0a1f44" },
    retry: { enabled: true },
    handler: (response) => {
      if (settled) return;
      settled = true;
      onSuccess?.(response);
    },
    modal: {
      confirm_close: true,
      ondismiss: () => {
        if (!settled) onDismiss?.();
      },
    },
  };
}
