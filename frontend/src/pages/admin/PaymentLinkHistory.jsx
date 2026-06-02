import { useEffect, useMemo, useState } from "react";
import api from "../../api";
import { useAdmin } from "../../context/AdminContext";
import "./PaymentLinks.css";

const SUPPORTED_CURRENCIES = ["USD", "INR", "EUR", "GBP", "CAD", "AUD", "AED", "SAR", "SGD", "JPY"];
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

function cardLabel(cardDetails) {
  if (!cardDetails?.last4) return "-";
  const brand = cardDetails.brand ? cardDetails.brand.toUpperCase() : "CARD";
  const type = cardDetails.cardType ? ` ${cardDetails.cardType}` : "";
  return `${cardDetails.maskedNumber || `**** **** **** ${cardDetails.last4}`} · ${brand}${type} · Last 4 ${cardDetails.last4}`;
}

export default function PaymentLinkHistory() {
  const { admin } = useAdmin();
  const isSuperAdmin = admin?.role === "superadmin";
  const [links, setLinks] = useState([]);
  const [creators, setCreators] = useState([]);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    status: "",
    createdBy: "",
    currency: "",
    amountMin: "",
    amountMax: "",
    q: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [filters]);

  const fetchLinks = () => {
    setLoading(true);
    setError("");
    api.get(`/api/payments/admin/payment-links${query ? `?${query}` : ""}`)
      .then((res) => setLinks(res.data.links || []))
      .catch((err) => setError(err.response?.data?.msg || "Failed to load payment history."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isSuperAdmin) return;
    api.get("/api/payments/admin/payment-link-creators")
      .then((res) => setCreators(res.data.creators || []))
      .catch(() => setCreators([]));
  }, [isSuperAdmin]);

  useEffect(() => {
    fetchLinks();
  }, [query]);

  const setFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({ startDate: "", endDate: "", status: "", createdBy: "", currency: "", amountMin: "", amountMax: "", q: "" });
  };

  const copyLink = async (url) => {
    await navigator.clipboard.writeText(url);
  };

  return (
    <div className="pl-admin pl-admin--wide">
      <div className="pl-admin__header pl-admin__header--surface">
        <div>
          <p className="pl-admin__eyebrow">{isSuperAdmin ? "Super Admin" : "Payment Admin"}</p>
          <h1>Payment History</h1>
          <p>Filter and review generated payment links, payment status, card metadata, and creator details.</p>
        </div>
      </div>

      <div className="pl-card pl-filterbar pl-filterbar--advanced">
        <label className="pl-filter-search">
          <span>Search</span>
          <input
            type="search"
            placeholder="Search note, token, transaction ID"
            value={filters.q}
            onChange={(event) => setFilter("q", event.target.value)}
          />
        </label>
        <label>
          <span>Date From</span>
          <input type="date" value={filters.startDate} onChange={(event) => setFilter("startDate", event.target.value)} />
        </label>
        <label>
          <span>Date To</span>
          <input type="date" value={filters.endDate} onChange={(event) => setFilter("endDate", event.target.value)} />
        </label>
        <label>
          <span>Status</span>
          <select value={filters.status} onChange={(event) => setFilter("status", event.target.value)}>
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="expired">Expired</option>
          </select>
        </label>
        {isSuperAdmin && (
          <label>
            <span>Payment Admin</span>
            <select value={filters.createdBy} onChange={(event) => setFilter("createdBy", event.target.value)}>
              <option value="">All Payment Admins</option>
              {creators.map((creator) => (
                <option key={creator._id} value={creator._id}>
                  {creator.name} ({creator.email})
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span>Currency</span>
          <select value={filters.currency} onChange={(event) => setFilter("currency", event.target.value)}>
            <option value="">All Currencies</option>
            {SUPPORTED_CURRENCIES.map((code) => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Min Amount</span>
          <input type="number" min="0" step="0.01" value={filters.amountMin} onChange={(event) => setFilter("amountMin", event.target.value)} />
        </label>
        <label>
          <span>Max Amount</span>
          <input type="number" min="0" step="0.01" value={filters.amountMax} onChange={(event) => setFilter("amountMax", event.target.value)} />
        </label>
        <div className="pl-filter-actions">
          <button className="pl-secondary" type="button" onClick={fetchLinks}>Refresh</button>
          <button className="pl-link-btn" type="button" onClick={resetFilters}>Reset</button>
        </div>
      </div>

      <div className="pl-card pl-history">
        <div className="pl-history__head">
          <div>
            <span className="pl-result__label">Records</span>
            <h2>{links.length} payment record{links.length === 1 ? "" : "s"}</h2>
          </div>
        </div>

        {error && <div className="pl-error">{error}</div>}
        {loading ? (
          <div className="pl-empty">Loading payment history...</div>
        ) : links.length === 0 ? (
          <div className="pl-empty">No payment records found.</div>
        ) : (
          <div className="pl-table-wrap">
            <table className="pl-table pl-table--wide">
              <thead>
                <tr>
                  <th>Created Date</th>
                  <th>Amount</th>
                  <th>Currency</th>
                  <th>Status</th>
                  <th>Note</th>
                  <th>Payment Admin Name</th>
                  <th>Card Details</th>
                  <th>Payment Link</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link) => (
                  <tr key={link._id || link.token}>
                    <td>{formatDate(link.createdAt)}</td>
                    <td className="pl-strong">{formatMoney(link.amountPaise, link.currency)}</td>
                    <td>{String(link.currency || "").toUpperCase()}</td>
                    <td><span className={`pl-status pl-status--${link.status}`}>{statusLabel(link.status)}</span></td>
                    <td>{link.note || "-"}</td>
                    <td>
                      <div className="pl-person">
                        <strong>{link.createdBy?.name || "Unknown"}</strong>
                        <span>{link.createdBy?.email || "-"}</span>
                      </div>
                    </td>
                    <td>{cardLabel(link.cardDetails)}</td>
                    <td>
                      <button className="pl-link-btn" type="button" onClick={() => copyLink(link.url)}>
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
