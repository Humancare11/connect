import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import api from "../api";
import "./PaymentLinkCheckout.css";
import { FiInfo } from "react-icons/fi";

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;
const stripeMode = stripePublishableKey.startsWith("pk_live_") ? "Live" : "Sandbox";

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


function CheckoutForm({ amountPaise, currency, token, email, onPaid }) {
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
        confirmParams: {
          payment_method_data: {
            billing_details: {
              email,
            },
          },
        },
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
      <PaymentElement
        onReady={() => setReady(true)}
        onLoadError={({ error: loadError }) => setError(loadError?.message || "Unable to load the card form. Please refresh and try again.")}
        options={{ layout: "tabs", paymentMethodOrder: ["card"] }}
      />
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
  const [billingEmail, setBillingEmail] = useState("");

  const amountLabel = useMemo(() => link ? formatMoney(link.amountPaise, link.currency) : "", [link]);

  useEffect(() => {
    setLoading(true);
    api.get(`/api/payments/payment-links/${token}`)
      .then((res) => setLink(res.data))
      .catch((err) => setError(err.response?.data?.msg || "Payment link not found."))
      .finally(() => setLoading(false));
  }, [token]);

  async function startPayment() {
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
  }

  useEffect(() => {
    if (link && !clientSecret && link.status !== "paid" && !error) {
      startPayment();
    }
  }, [link, clientSecret, error, token]);

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
        <div className="plc-topbar">
          <div className="plc-brand">
            <span className="plc-brand-icon">🩺</span>
            <strong>Humancare Connect</strong>
          </div>
          <span className="plc-badge">{stripeMode}</span>
        </div>

        {loading ? (
          <div className="plc-state">Loading payment...</div>
        ) : error && !link ? (
          <div className="plc-error">{error}</div>
        ) : paidRef || link?.status === "paid" ? (
          <div className="plc-grid plc-success-grid">
            <div className="plc-summary-panel">
              <span>Pay Humancare Connect</span>
              <h1>{amountLabel}</h1>
              <div className="plc-order-lines">
                <div><span>Online consultation</span><strong>{amountLabel}</strong></div>
                <div><span>Subtotal</span><strong>{amountLabel}</strong></div>
                <div><span>Tax</span><strong>{formatMoney(0, link.currency)}</strong></div>
                <div className="plc-total-line"><span>Total paid</span><strong>{amountLabel}</strong></div>
              </div>
            </div>

            <div className="plc-right-panel plc-success-panel">
              <div className="plc-success-mark">✓</div>
              <h2>Thanks for your payment</h2>
              <p>A payment to Humancare Connect, Inc will appear on your statement.</p>
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
              <div className="plc-powered">Powered by stripe</div>
            </div>
          </div>
        ) : (
          <div className="plc-grid">
            <div className="plc-summary-panel">
              <h1>{amountLabel}</h1>
              <div className="plc-order-lines">
                <div><span>Online consultation</span><strong>{amountLabel}</strong></div>
                <div><span>Subtotal</span><strong>{amountLabel}</strong></div>
                <div className="plc-order-line plc-tax-line">
                  <span className="plc-tax-label">
                    Tax
                    <span className="plc-info-icon" aria-label="Tax information">
                      <FiInfo />
                      <span className="plc-tooltip">
                        Tax is determined by billing information.
                      </span>
                    </span>
                  </span>
                  <strong>{formatMoney(0, link.currency)}</strong>
                </div>
                <div className="plc-total-line"><span>Total due</span><strong>{amountLabel}</strong></div>
              </div>
            </div>

            <div className="plc-right-panel">
              <div className="plc-payment-header">
                <span>Contact information</span>
              </div>
              <label className="plc-field">
                <span>Email</span>
                <input
                  type="email"
                  value={billingEmail}
                  onChange={(e) => setBillingEmail(e.target.value)}
                  placeholder="email@example.com"
                  required
                />
              </label>

              {!stripePromise ? (
                <div className="plc-error">Stripe publishable key is not configured.</div>
              ) : !clientSecret ? (
                <>
                  {error ? (
                    <div className="plc-error">{error}</div>
                  ) : (
                    <div className="plc-state">Preparing payment...</div>
                  )}
                </>
              ) : (
                <Elements stripe={stripePromise} options={{ clientSecret, appearance: ELEMENTS_APPEARANCE }}>
                  <CheckoutForm amountPaise={link.amountPaise} currency={link.currency} token={token} email={billingEmail} onPaid={handlePaid} />
                </Elements>
              )}

              <div className="plc-powered">Powered by stripe</div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
