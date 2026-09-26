import { useEffect, useState } from "react";
import api from "../../api";

const PAGE_SIZE = 10;

// "Total" plus the status filter of the admin Appointments page, in the same
// order and with the same labels (its STATUS_ORDER / STATUS_META).
const STATUS_OPTIONS = [
  { value: "all", label: "Total" },
  { value: "upcoming", label: "Upcoming" },
  { value: "assigned", label: "Assigned" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "complete", label: "Complete" },
  { value: "cancelled", label: "Cancelled" },
];

// The existing admin detail pages, opened as they are (in a new tab).
const DETAIL_ROUTES = {
  appointment: (id) => `/admin-dashboard/appointments/${id}`,
  category: (id) => `/admin-dashboard/category-consultations/${id}`,
};

const KIND_LABELS = { appointment: "Doctor", category: "Category" };

// "2026-10-12" → "12 Oct 2026" (parsed as a calendar date, so no timezone shift).
function formatDay(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value || "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

// 1 … 4 5 6 … 20 — always the first and last page and the current page ±1.
function pageWindow(current, total) {
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

function Pagination({ page, totalPages, disabled, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="mu-pager" aria-label="Consultation pages">
      <button type="button" className="mu-pager-btn" disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>
        Prev
      </button>
      {pageWindow(page, totalPages).map((p, i) =>
        p === "gap" ? (
          <span key={`gap-${i}`} className="mu-pager-gap" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            className={`mu-pager-btn${p === page ? " mu-pager-btn--active" : ""}`}
            disabled={disabled}
            aria-current={p === page ? "page" : undefined}
            onClick={() => p !== page && onChange(p)}
          >
            {p}
          </button>
        )
      )}
      <button
        type="button"
        className="mu-pager-btn"
        disabled={disabled || page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}

// "Consultations Info": a status dropdown with the matching count, and that
// user's consultations (Appointment + CategoryConsultation, newest booked
// first) filtered to that status, ten per page. Counts and pages come from the
// backend, so the count is always the size of what the table is showing.
export default function UserConsultationList({ userId }) {
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, totalPages: 0 });
  // "loading" | "ready" | "error"
  const [phase, setPhase] = useState("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/api/admin/users/${userId}/consultations`, { params: { status, page, limit: PAGE_SIZE } })
      .then((res) => {
        if (cancelled) return;
        const { items = [], total = 0, totalPages = 0 } = res.data || {};
        // The last page emptied out (e.g. bookings changed underneath us): step back.
        if (items.length === 0 && page > 1 && totalPages > 0) {
          setPage(totalPages);
          return;
        }
        setData({ items, total, totalPages });
        setPhase("ready");
      })
      .catch((err) => {
        console.error("consultation list failed:", err);
        if (!cancelled) setPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, [userId, status, page, attempt]);

  const changeStatus = (next) => {
    setStatus(next);
    setPage(1);
    setPhase("loading");
  };
  const changePage = (next) => {
    setPage(next);
    setPhase("loading");
  };
  const retry = () => {
    setPhase("loading");
    setAttempt((n) => n + 1);
  };

  const loading = phase === "loading";

  return (
    <div className="mu-consults">
      <div className="mu-consult-head">
        <select
          className="mu-status-select"
          aria-label="Filter consultations by status"
          value={status}
          onChange={(e) => changeStatus(e.target.value)}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="mu-consult-count" aria-live="polite">
          {loading ? <span className="mu-skeleton mu-skeleton--num" /> : phase === "error" ? "–" : data.total}
        </span>
      </div>

      {loading && (
        <div aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="mu-skeleton mu-skeleton--row" />
          ))}
        </div>
      )}

      {phase === "error" && (
        <div className="mu-stats-error">
          <span>Couldn't load consultations.</span>
          <button type="button" className="mu-link-btn" onClick={retry}>
            Retry
          </button>
        </div>
      )}

      {phase === "ready" && data.items.length === 0 && (
        <div className="mu-consults-empty">
          {status === "all" ? "No consultations yet" : "No consultations with this status"}
        </div>
      )}

      {phase === "ready" && data.items.length > 0 && (
        <div className="mu-consults-scroll">
          <table className="mu-ctable">
            <thead>
              <tr>
                <th className="mu-col-sr">Sr. No</th>
                <th>Date</th>
                <th>App. ID</th>
                <th aria-label="View" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, index) => (
                <tr key={`${item.kind}:${item.id}`}>
                  <td className="mu-col-sr">{(page - 1) * PAGE_SIZE + index + 1}</td>
                  <td>
                    <div className="mu-cell-main">{formatDay(item.date) || "Not provided"}</div>
                    {item.time && <div className="mu-cell-sub">{item.time}</div>}
                  </td>
                  <td>
                    <div className="mu-cell-main mu-mono" title={item.id}>
                      {item.shortId}
                    </div>
                    <div className="mu-cell-sub">{KIND_LABELS[item.kind]}</div>
                  </td>
                  <td className="mu-cell-action">
                    <a
                      className="mu-view-btn"
                      href={DETAIL_ROUTES[item.kind]?.(item.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} totalPages={phase === "error" ? 0 : data.totalPages} disabled={loading} onChange={changePage} />
    </div>
  );
}
