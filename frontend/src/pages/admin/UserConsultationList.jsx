import { useCallback, useEffect, useState } from "react";
import api from "../../api";

const PAGE_SIZE = 10;

// Same labels and colours as the admin Appointments page (AdminAppointments.jsx).
// Kept as a local copy so that page — and its stylesheet, which also styles
// .adp-modal — stay untouched.
const STATUS_META = {
  upcoming: { label: "Upcoming", bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  assigned: { label: "Assigned", bg: "#f0fdfa", color: "#0f766e", border: "#99f6e4" },
  pending: { label: "Pending", bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },
  confirmed: { label: "Confirmed", bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" },
  complete: { label: "Complete", bg: "#f1f5f9", color: "#334155", border: "#cbd5e1" },
  cancelled: { label: "Cancelled", bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
};

const PAYMENT_META = {
  paid: { label: "Paid", bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" },
  unpaid: { label: "Unpaid", bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },
  refunded: { label: "Refunded", bg: "#f1f5f9", color: "#334155", border: "#cbd5e1" },
};

const GATEWAY_LABELS = { stripe: "Stripe", paypal: "PayPal" };

// The existing admin detail pages, opened as they are (in a new tab).
const DETAIL_ROUTES = {
  appointment: (id) => `/admin-dashboard/appointments/${id}`,
  category: (id) => `/admin-dashboard/category-consultations/${id}`,
};

function Pill({ meta, fallback }) {
  const m = meta || fallback;
  return (
    <span className="mu-pill" style={{ background: m.bg, color: m.color, borderColor: m.border }}>
      {m.label}
    </span>
  );
}

// "2026-10-12" → "12 Oct 2026" (parsed as a calendar date, so no timezone shift).
function formatDay(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value || "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function formatFee(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

function ConsultationRow({ item }) {
  const detailUrl = DETAIL_ROUTES[item.kind]?.(item.id);
  const payment = PAYMENT_META[item.paymentStatus] || PAYMENT_META.unpaid;
  const gateway = GATEWAY_LABELS[item.paymentGateway] || "";
  const fee = formatFee(item.fee);

  return (
    <tr>
      <td data-label="Date & time">
        <div className="mu-cell">
          <div className="mu-cell-main">{formatDay(item.date) || "Not provided"}</div>
          <div className="mu-cell-sub">{item.time}</div>
          {item.timezone && <div className="mu-cell-sub">{item.timezone}</div>}
        </div>
      </td>
      <td data-label="Doctor / category">
        <div className="mu-cell">
          <div className={`mu-cell-main${item.doctorName ? "" : " mu-cell-main--empty"}`}>
            {item.doctorName || "Not assigned"}
          </div>
          <div className="mu-cell-sub">{[item.title, item.subtitle].filter(Boolean).join(" · ")}</div>
        </div>
      </td>
      <td data-label="Type">
        <div className="mu-cell">
          <div className="mu-cell-main">{item.type}</div>
          {item.typeDetail && <div className="mu-cell-sub">{item.typeDetail}</div>}
        </div>
      </td>
      <td data-label="Status">
        <div className="mu-cell">
          <Pill meta={STATUS_META[item.status]} fallback={STATUS_META.upcoming} />
        </div>
      </td>
      <td data-label="Payment">
        <div className="mu-cell">
          <Pill meta={payment} fallback={PAYMENT_META.unpaid} />
          {(gateway || fee) && <div className="mu-cell-sub">{[fee, gateway].filter(Boolean).join(" · ")}</div>}
        </div>
      </td>
      <td data-label="" className="mu-cell-action">
        <a className="mu-view-btn" href={detailUrl} target="_blank" rel="noopener noreferrer">
          View
        </a>
      </td>
    </tr>
  );
}

// All of a user's consultations (Appointment + CategoryConsultation), newest
// booked first, ten at a time.
export default function UserConsultationList({ userId }) {
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextPage, setNextPage] = useState(1);
  // "loading" (first page) | "ready" | "error" (first page) | "more" | "more-error"
  const [phase, setPhase] = useState("loading");
  const [attempt, setAttempt] = useState(0);

  const fetchPage = useCallback(
    (page) => api.get(`/api/admin/users/${userId}/consultations`, { params: { page, limit: PAGE_SIZE } }),
    [userId],
  );

  useEffect(() => {
    let cancelled = false;
    fetchPage(1)
      .then((res) => {
        if (cancelled) return;
        setItems(res.data.items || []);
        setHasMore(Boolean(res.data.hasMore));
        setNextPage(2);
        setPhase("ready");
      })
      .catch((err) => {
        console.error("consultation list failed:", err);
        if (!cancelled) setPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage, attempt]);

  const retryFirstPage = () => {
    setPhase("loading");
    setAttempt((n) => n + 1);
  };

  const loadMore = async () => {
    setPhase("more");
    try {
      const res = await fetchPage(nextPage);
      setItems((prev) => [...prev, ...(res.data.items || [])]);
      setHasMore(Boolean(res.data.hasMore));
      setNextPage((n) => n + 1);
      setPhase("ready");
    } catch (err) {
      console.error("consultation list (more) failed:", err);
      setPhase("more-error");
    }
  };

  if (phase === "loading") {
    return (
      <div className="mu-consults" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="mu-skeleton mu-skeleton--row" />
        ))}
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="mu-stats-error">
        <span>Couldn't load consultations.</span>
        <button type="button" className="mu-link-btn" onClick={retryFirstPage}>
          Retry
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return <div className="mu-consults-empty">No consultations yet</div>;
  }

  return (
    <div className="mu-consults">
      <div className="mu-consults-scroll">
        <table className="mu-ctable">
          <thead>
            <tr>
              <th>Date &amp; time</th>
              <th>Doctor / category</th>
              <th>Type</th>
              <th>Status</th>
              <th>Payment</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <ConsultationRow key={`${item.kind}:${item.id}`} item={item} />
            ))}
          </tbody>
        </table>
      </div>

      {(hasMore || phase === "more-error") && (
        <div className="mu-consults-footer">
          {phase === "more-error" && <span className="mu-consults-error">Couldn't load more.</span>}
          <button type="button" className="mu-load-more" onClick={loadMore} disabled={phase === "more"}>
            {phase === "more" ? "Loading…" : phase === "more-error" ? "Retry" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
