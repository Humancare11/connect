import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import api from "../api";
import "./PaymentLinkCheckout.css";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const ELEMENTS_APPEARANCE = {
  theme: "stripe",
  variables: {
    colorPrimary: "#1d4ed8",
    colorText: "#0f172a",
    colorDanger: "#dc2626",
    borderRadius: "8px",
    fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
  },
};

const ZERO_DECIMAL_CURRENCIES = new Set(["JPY"]);

function currencyFactor(currency) {
  return ZERO_DECIMAL_CURRENCIES.has(String(currency).toUpperCase()) ? 1 : 100;
}

function formatMoney(amountMinor, currency = "INR") {
  const code = String(currency || "INR").toUpperCase();
  return (amountMinor / currencyFactor(code)).toLocaleString("en-IN", {
    style: "currency",
    currency: code,
    maximumFractionDigits: ZERO_DECIMAL_CURRENCIES.has(code) ? 0 : 2,
  });
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CheckoutForm({ amountPaise, currency, token, onPaid }) {
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (!stripe || !elements) return;
    setError("");
    setPaying(true);
    try {
      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });
      if (confirmError) {
        setError(confirmError.message || "Payment failed.");
        return;
      }
      if (paymentIntent?.status === "succeeded") {
        const res = await api.post(`/api/payments/payment-links/${token}/confirm`, { paymentIntentId: paymentIntent.id });
        onPaid({ paymentIntentId: paymentIntent.id, ...res.data });
      }
    } catch (err) {
      setError(err.response?.data?.msg || "Payment failed. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <form className="plc-form" onSubmit={submit}>
      <PaymentElement onReady={() => setReady(true)} options={{ layout: "tabs", paymentMethodOrder: ["card"] }} />
      {error && <div className="plc-error">{error}</div>}
      <button type="submit" disabled={!stripe || !ready || paying}>
        {paying ? "Processing..." : `Pay ${formatMoney(amountPaise, currency)}`}
      </button>
    </form>
  );
}

export default function PaymentLinkCheckout() {
  const { token } = useParams();
  const [link, setLink] = useState(null);
  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [paidRef, setPaidRef] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState("");

  const amountLabel = useMemo(() => link ? formatMoney(link.amountPaise, link.currency) : "", [link]);

  useEffect(() => {
    setLoading(true);
    api.get(`/api/payments/payment-links/${token}`)
      .then((res) => setLink(res.data))
      .catch((err) => setError(err.response?.data?.msg || "Payment link not found."))
      .finally(() => setLoading(false));
  }, [token]);

  const startPayment = async () => {
    setError("");
    setCreating(true);
    try {
      const res = await api.post(`/api/payments/payment-links/${token}/create-intent`);
      setClientSecret(res.data.clientSecret);
    } catch (err) {
      setError(err.response?.data?.msg || "Unable to initialize payment.");
    } finally {
      setCreating(false);
    }
  };

  const handlePaid = (payment) => {
    const paidAt = payment.paidAt || new Date().toISOString();
    setPaidRef(payment.paymentIntentId);
    setReceipt({
      paymentIntentId: payment.paymentIntentId,
      amountPaise: payment.amountPaise || link.amountPaise,
      currency: payment.currency || link.currency,
      paidAt,
      note: link.note,
    });
    setLink((prev) => prev ? { ...prev, status: "paid", paidAt, paymentIntentId: payment.paymentIntentId } : prev);
  };

  const printReceipt = () => {
    window.print();
  };

  const downloadReceipt = () => {
    const data = receipt || {
      paymentIntentId: paidRef || link?.paymentIntentId,
      amountPaise: link?.amountPaise,
      currency: link?.currency,
      paidAt: link?.paidAt,
      note: link?.note,
    };
    const lines = [
      "HumaniCare Payment Receipt",
      `Transaction ID: ${data.paymentIntentId || "-"}`,
      `Amount Paid: ${formatMoney(data.amountPaise || 0, data.currency)}`,
      `Currency: ${String(data.currency || "").toUpperCase()}`,
      `Payment Date: ${formatDate(data.paidAt)}`,
      `Note: ${data.note || "-"}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const linkEl = document.createElement("a");
    linkEl.href = url;
    linkEl.download = `payment-receipt-${data.paymentIntentId || "receipt"}.txt`;
    linkEl.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="plc-page">
      <section className="plc-card">
        {loading ? (
          <div className="plc-state">Loading payment...</div>
        ) : error && !link ? (
          <div className="plc-error">{error}</div>
        ) : paidRef || link?.status === "paid" ? (
          <div className="plc-success plc-receipt">
            <div className="plc-success-mark">✓</div>
            <span>Payment Successful</span>
            <h1>{amountLabel}</h1>
            <div className="plc-receipt-box">
              <div><span>Transaction ID</span><strong>{paidRef || link?.paymentIntentId || "-"}</strong></div>
              <div><span>Amount Paid</span><strong>{amountLabel}</strong></div>
              <div><span>Currency</span><strong>{String(link?.currency || "").toUpperCase()}</strong></div>
              <div><span>Payment Date</span><strong>{formatDate(receipt?.paidAt || link?.paidAt || new Date())}</strong></div>
            </div>
            <div className="plc-actions">
              <button type="button" onClick={downloadReceipt}>Download Receipt</button>
              <button type="button" className="plc-print" onClick={printReceipt}>Print Receipt</button>
            </div>
          </div>
        ) : (
          <>
            <div className="plc-header">
              <span>Secure Card Payment</span>
              <h1>{amountLabel}</h1>
              <div className="plc-summary">
                <div><span>Amount</span><strong>{amountLabel}</strong></div>
                <div><span>Currency</span><strong>{String(link?.currency || "").toUpperCase()}</strong></div>
                <div><span>Status</span><strong>Awaiting Payment</strong></div>
              </div>
              {link?.note && <small>{link.note}</small>}
            </div>

            {!clientSecret ? (
              <>
                {error && <div className="plc-error">{error}</div>}
                <button className="plc-start" type="button" onClick={startPayment} disabled={creating}>
                  {creating ? "Preparing..." : "Continue to Payment"}
                </button>
              </>
            ) : (
              <Elements stripe={stripePromise} options={{ clientSecret, appearance: ELEMENTS_APPEARANCE }}>
                <CheckoutForm amountPaise={link.amountPaise} currency={link.currency} token={token} onPaid={handlePaid} />
              </Elements>
            )}
          </>
        )}
      </section>
    </main>
  );
}
