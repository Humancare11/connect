import { useEffect, useMemo, useState } from "react";
import api from "../../api";
import "./PaymentLinks.css";

const SUPPORTED_CURRENCIES = [
  { code: "USD", name: "US Dollar" },
  { code: "INR", name: "Indian Rupee" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "AED", name: "UAE Dirham" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "JPY", name: "Japanese Yen" },
];
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

function statusLabel(status) {
  return status === "paid" ? "Paid" : status === "expired" ? "Expired" : "Pending";
}

export default function PaymentLinks() {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [note, setNote] = useState("");
  const [created, setCreated] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const previewAmount = useMemo(() => {
    const value = Number(amount);
    return Number.isFinite(value) && value > 0 ? Math.round(value * currencyFactor(currency)) : 0;
  }, [amount, currency]);

  const generatedUrl = created?.url || (created ? `${window.location.origin}/pay/${created.token}` : "");

  const fetchHistory = () => {
    setHistoryLoading(true);
    api.get("/api/payments/admin/payment-links")
      .then((res) => setHistory(res.data.links || []))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const createLink = async (event) => {
    event.preventDefault();
    setError("");
    setCopied(false);
    setCreated(null);
    setLoading(true);
    try {
      const res = await api.post("/api/payments/admin/payment-links", { amount, currency, note });
      setCreated(res.data);
      setAmount("");
      setNote("");
      fetchHistory();
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to generate payment link.");
    } finally {
      setLoading(false);
    }
  };

  const copyHistoryLink = async (url) => {
    await navigator.clipboard.writeText(url);
  };

  const copyLink = async () => {
    if (!generatedUrl) return;
    await navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="pl-admin pl-admin--wide">
      <div className="pl-admin__header pl-admin__header--surface">
        <div>
          <p className="pl-admin__eyebrow">Payment Admin</p>
          <h1>Generate Payment Link</h1>
          <p>Create a fixed-amount payment page and send the link to a client.</p>
        </div>
        <div className="pl-header-metric">
          <span>Recent activity</span>
          <strong>{history.length}</strong>
        </div>
      </div>

      <div className="pl-admin__grid">
        <form className="pl-card pl-form" onSubmit={createLink}>
          <div className="pl-form__title">
            <h2>Payment Details</h2>
            <p>Choose the currency and amount exactly as the customer should pay.</p>
          </div>

          <div className="pl-form-grid">
            <label className="pl-field pl-field--amount">
              <span>Amount</span>
              <div className="pl-amount-input">
                <span>{currency}</span>
                <input
                  type="number"
                  min="1"
                  step={ZERO_DECIMAL_CURRENCIES.has(currency) ? "1" : "0.01"}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder={currency === "JPY" ? "12000" : "500.00"}
                  required
                />
              </div>
            </label>

            <label className="pl-field">
              <span>Currency</span>
              <select
                className="pl-select"
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
              >
                {SUPPORTED_CURRENCIES.map((item) => (
                  <option key={item.code} value={item.code}>{item.code} - {item.name}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="pl-field">
            <span>Note</span>
            <textarea
              rows={3}
              maxLength={250}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional internal note"
            />
          </label>

          {error && <div className="pl-error">{error}</div>}

          <button className="pl-primary" type="submit" disabled={loading || !previewAmount}>
            {loading ? "Generating..." : "Generate Link"}
          </button>
        </form>

        <div className="pl-card pl-preview">
          <span className="pl-preview__label">Client will pay</span>
          <strong>{previewAmount ? formatMoney(previewAmount, currency) : formatMoney(0, currency)}</strong>
          <p>This exact amount and currency will appear on the customer payment page.</p>
        </div>
      </div>

      {created && (
        <div className="pl-card pl-result">
          <div>
            <span className="pl-result__label">Generated payment link</span>
            <a href={generatedUrl} target="_blank" rel="noreferrer">{generatedUrl}</a>
            <span className="pl-result__amount">{formatMoney(created.amountPaise, created.currency)}</span>
          </div>
          <button className="pl-secondary" type="button" onClick={copyLink}>
            {copied ? "Copied" : "Copy Link"}
          </button>
        </div>
      )}

      <div className="pl-card pl-history">
        <div className="pl-history__head">
          <div>
            <span className="pl-result__label">History</span>
            <h2>Recent Payments</h2>
          </div>
          <button className="pl-secondary" type="button" onClick={fetchHistory}>Refresh</button>
        </div>

        {historyLoading ? (
          <div className="pl-empty">Loading history...</div>
        ) : history.length === 0 ? (
          <div className="pl-empty">No payment links generated yet.</div>
        ) : (
          <div className="pl-table-wrap">
            <table className="pl-table">
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Note</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 8).map((link) => (
                  <tr key={link._id || link.token}>
                    <td>{formatDate(link.createdAt)}</td>
                    <td className="pl-strong">{formatMoney(link.amountPaise, link.currency)}</td>
                    <td><span className={`pl-status pl-status--${link.status}`}>{statusLabel(link.status)}</span></td>
                    <td>{link.note || "-"}</td>
                    <td>
                      <button className="pl-link-btn" type="button" onClick={() => copyHistoryLink(link.url)}>
                        Copy
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
