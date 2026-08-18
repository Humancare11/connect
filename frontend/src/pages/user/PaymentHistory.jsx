import { useCallback, useEffect, useState } from "react";
import "./PaymentHistory.css";
import api from "../../api";

function formatDate(d) {
  if (!d) return "—";
  const parsed = new Date(d);
  if (isNaN(parsed)) return d;
  return parsed.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

function formatAmount(amountCents, currency = "usd") {
  const amount = (Number(amountCents) || 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: String(currency || "usd").toUpperCase(),
    }).format(amount);
  } catch {
    return `${String(currency || "USD").toUpperCase()} ${amount.toFixed(2)}`;
  }
}

function gatewayLabel(gateway) {
  return gateway === "paypal" ? "PayPal" : "Card (Stripe)";
}

export default function PaymentHistory() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [downloadingId, setDownloadingId] = useState("");

  const loadPayments = useCallback(async (targetPage = 1) => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/api/payments/mine", { params: { page: targetPage, limit: 20 } });
      setPayments(Array.isArray(res.data?.payments) ? res.data.payments : []);
      setTotalPages(res.data?.totalPages || 1);
      setPage(res.data?.page || targetPage);
    } catch (err) {
      console.error("Failed to load payment history", err);
      if (err.response) {
        // Server responded with an error — surface the backend's own
        // message when it has one (e.g. session expired) instead of a
        // one-size-fits-all string that hides what actually went wrong.
        setError(
          err.response.status === 401
            ? "Your session has expired. Please log in again to view your payment history."
            : err.response.data?.msg || "We couldn't load your payment history. Please try again."
        );
      } else if (err.request) {
        setError("We couldn't reach the server. Please check your connection and try again.");
      } else {
        setError("We couldn't load your payment history. Please try again.");
      }
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayments(1);
  }, [loadPayments]);

  const handleDownload = async (paymentId) => {
    setDownloadingId(paymentId);
    try {
      const res = await api.get(`/api/payments/${paymentId}/invoice-url`);
      const url = res.data?.url;
      if (url) {
        // Presigned S3 URL — short-lived, opened directly, never proxied
        // through this app's own origin as a static asset.
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      console.error("Failed to fetch invoice URL", err);
      window.alert(
        err?.response?.data?.msg || "Invoice isn't ready yet. Please try again in a moment."
      );
    } finally {
      setDownloadingId("");
    }
  };

  return (
    <div className="ph-page">
      <div className="ph-header">
        <div>
          <p className="ph-eyebrow">Billing</p>
          <h1 className="ph-title">Payment History</h1>
          <p className="ph-subtitle">View your past payments and download invoices for your records.</p>
        </div>
      </div>

      <div className="ph-panel">
        {loading ? (
          <div className="ph-state">Loading payment history…</div>
        ) : error ? (
          <div className="ph-state ph-state--error">{error}</div>
        ) : payments.length === 0 ? (
          <div className="ph-state">No payments yet. Your payment history will appear here after your first booking.</div>
        ) : (
          <>
            <div className="ph-table-wrap">
              <table className="ph-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Method</th>
                    <th>Amount</th>
                    <th>Invoice</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p._id}>
                      <td>{formatDate(p.paidAt)}</td>
                      <td>{p.description || "Consultation booking fee"}</td>
                      <td>{gatewayLabel(p.gateway)}</td>
                      <td className="ph-amount">{formatAmount(p.amountCents, p.currency)}</td>
                      <td>
                        {p.invoice ? (
                          <span className="ph-invoice-no">{p.invoice.invoiceNumber}</span>
                        ) : (
                          <span className="ph-invoice-pending">Generating…</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="ph-download-btn"
                          disabled={!p.invoice || downloadingId === p._id}
                          onClick={() => handleDownload(p._id)}
                        >
                          {downloadingId === p._id ? "…" : "⬇ Download"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="ph-pagination">
                <button disabled={page <= 1} onClick={() => loadPayments(page - 1)}>
                  Previous
                </button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <button disabled={page >= totalPages} onClick={() => loadPayments(page + 1)}>
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
