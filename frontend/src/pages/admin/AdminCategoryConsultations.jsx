import { useEffect, useMemo, useState } from "react";
import api from "../../api";
import { Link, useNavigate } from "react-router-dom";
// Reuse the exact same stylesheet AdminAppointments.jsx and
// AdminCategoryConsultationDetails.jsx already use, so this list picks up
// the same cards / pills / table look automatically.
import "./AdminAppointments.css";
import { useToast } from "../../components/ui/Toast";
import RetryButton from "../../components/ui/RetryButton";
import { useConfirm } from "../../components/ui/ConfirmDialog";

const STATUS_META = {
  pending: { label: "Pending", bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },
  assigned: { label: "Assigned", bg: "#f0fdfa", color: "#0f766e", border: "#99f6e4" },
  confirmed: { label: "Confirmed", bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" },
  complete: { label: "Completed", bg: "#f1f5f9", color: "#334155", border: "#cbd5e1" },
  cancelled: { label: "Cancelled", bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
};

// Your API stores status as "Pending" / "Assigned" / "Completed" / "Cancelled".
// This normalizes it to the lowercase keys StatusPill/STATUS_META expect.
function canonicalStatus(status) {
  const s = (status || "pending").toLowerCase();
  if (s === "completed") return "complete";
  return STATUS_META[s] ? s : "pending";
}

// Mirrors the server-side derivation in CategoryConsultationController so a
// pre-migration record (no appointmentType stored yet) still displays right.
function resolveAppointmentType(item) {
  if (item.appointmentType) return item.appointmentType;
  return item.urgency === "flexible" ? "FLEXIBLE_TIME" : "NEXT_AVAILABLE";
}

function appointmentDisplay(item) {
  if (resolveAppointmentType(item) === "FLEXIBLE_TIME") {
    return item.slot || "-";
  }
  return item.assignedSlot || "Next Available";
}

// "05:40 PM" -> 17.667 (hours since midnight), for bucketing into a window.
function timeStringToHour(display) {
  const match = String(display || "").match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let [, hours, minutes, period] = match;
  hours = parseInt(hours, 10);
  minutes = parseInt(minutes, 10);
  if (period.toUpperCase() === "PM" && hours !== 12) hours += 12;
  if (period.toUpperCase() === "AM" && hours === 12) hours = 0;
  return hours + minutes / 60;
}

// Matches the Morning/Afternoon/Evening/Night ranges from CategoryConsultant.
function windowLabelForHour(hour) {
  if (hour === null) return "";
  if (hour >= 6 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 18) return "Afternoon";
  if (hour >= 18 && hour < 24) return "Evening";
  return "Night";
}

// NEXT_AVAILABLE bookings have no patient-chosen time window — show "-"
// until a doctor is assigned, then derive the window from the assigned time.
function timeWindowDisplay(item) {
  if (resolveAppointmentType(item) === "FLEXIBLE_TIME") {
    return item.timeWindow || "-";
  }
  return windowLabelForHour(timeStringToHour(item.assignedSlot)) || "-";
}

// Highlights the "awaiting assignment" state so it reads as a call-to-action
// next to a resolved appointment time, not just more table text.
function AppointmentCell({ item }) {
  const value = appointmentDisplay(item);
  if (value !== "Next Available") return <>{value}</>;
  return (
    <span
      className="adp-status-pill"
      style={{ background: "#eef2ff", color: "#4338ca", borderColor: "#c7d2fe" }}
    >
      Next Available
    </span>
  );
}

const PAGE_SIZE = 5;

const FILTER_OPTIONS = [
  { key: "all", label: "All statuses" },
  { key: "pending", label: "Pending" },
  { key: "assigned", label: "Assigned" },
  { key: "complete", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

// 1 … 4 5 6 … 20: the first and last page and the current page ±1.
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

function StatusPill({ status }) {
  const key = canonicalStatus(status);
  const meta = STATUS_META[key];
  return (
    <span
      className="adp-status-pill"
      style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}
    >
      {meta.label}
    </span>
  );
}

export default function AdminCategoryConsultations() {
  const confirm = useConfirm();
  const toast = useToast();
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);

  const navigate = useNavigate();

  const fetchConsultations = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get(
        "/api/category-consultation",
      );
      setConsultations(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (err) {
      console.error("Failed to load consultations", err);
      setError(err.response?.data?.msg || "Failed to load consultations.");
    } finally {
      setLoading(false);
    }
  };

  const deleteConsultation = async (id) => {
    const confirmed = await confirm({
      title: "Delete consultation",
      message: "Are you sure you want to delete this consultation?",
      confirmText: "Delete",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      await api.delete(
        `/api/category-consultation/${id}`,
      );
      fetchConsultations();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete consultation");
    }
  };

  useEffect(() => {
    fetchConsultations();
  }, []);

  const counts = useMemo(() => {
    const base = { all: consultations.length, pending: 0, assigned: 0, complete: 0, cancelled: 0 };
    consultations.forEach((item) => {
      const key = canonicalStatus(item.status);
      if (base[key] !== undefined) base[key] += 1;
    });
    return base;
  }, [consultations]);

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    return consultations.filter((item) => {
      const status = canonicalStatus(item.status);
      const matchesFilter = filter === "all" || status === filter;
      if (!matchesFilter) return false;
      if (!q) return true;

      return [
        item._id,
        item.concern,
        item.severity,
        item.supportType,
        item.urgency,
        item.timeWindow,
        item.slot,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [consultations, filter, search]);

  // A search or filter change starts again at page 1; the page is also kept inside the
  // available range (e.g. after deleting the last row of the last page).
  const totalPages = Math.max(1, Math.ceil(displayed.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageItems = displayed.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <div className="adp-page">
      <section className="adp-card adp-cc-card">
        <div className="adp-card-header">
          <label className="adp-search" aria-label="Search category consultations">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="Search concern, severity, urgency, slot..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <select
            className="adp-cc-filter"
            aria-label="Filter by status"
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setPage(1);
            }}
          >
            {FILTER_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label} ({counts[option.key]})
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="adp-loading">
            <div className="adp-spinner" />
            <p>Loading consultations...</p>
          </div>
        ) : error ? (
          <div className="adp-empty">
            <h3>Could not load consultations</h3>
            <p>{error}</p>
            <RetryButton onRetry={fetchConsultations} />
          </div>
        ) : displayed.length === 0 ? (
          <div className="adp-empty">
            <h3>No consultations found</h3>
            <p>No consultations match this view.</p>
          </div>
        ) : (
          <div className="adp-table-wrap adp-cc-wrap">
            <table className="adp-flow-table adp-cc">
              <thead>
                <tr>
                  <th>SR No</th>
                  <th>Consultation Date</th>
                  <th>Time Window</th>
                  <th>Appointment</th>
                  <th>Source Page</th>
                  <th>Status</th>
                  <th>View</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((item, index) => (
                  <tr key={item._id}>
                    <td className="adp-sr-cell">{pageStart + index + 1}</td>
                    <td data-label="Consultation Date">{item.date || "-"}</td>
                    <td data-label="Time Window">{timeWindowDisplay(item)}</td>
                    <td data-label="Appointment"><AppointmentCell item={item} /></td>
                    <td data-label="Source Page">
                      {item.pcpName ? (
                        <div style={{ fontSize: "0.85rem" }}>
                          <div><strong>PCP:</strong> <br /> {item.pcpName}</div>
                        </div>
                      ) : item.conditionName ? (
                        <div style={{ fontSize: "0.85rem" }}>
                          <div><strong>Condition:</strong> <br /> {item.conditionName}</div>
                        </div>
                      ) : item.specialtyName ? (
                        <div style={{ fontSize: "0.85rem" }}>
                          <div><strong>Speciality:</strong> <br /> {item.specialtyName}</div>
                        </div>
                      ) : item.serviceName ? (
                        <div style={{ fontSize: "0.85rem" }}>
                          <div><strong>Service:</strong> <br /> {item.serviceName}</div>
                        </div>
                      ) : (
                        <span style={{ fontSize: "0.85rem", color: "#666" }}>{item.categoryName || "Category"}</span>
                      )}
                    </td>
                    <td className="adp-cc-status">
                      <StatusPill status={item.status} />
                    </td>
                    <td className="adp-cc-view">
                      <Link
                        className="adp-view-btn"
                        to={`/admin-dashboard/category-consultations/${item._id}`}
                      >
                        View
                      </Link>
                    </td>
                    <td className="adp-cc-actions">
                      <div className="adp-list-actions">
                        {canonicalStatus(item.status) !== "complete" && (
                          <Link
                            className="adp-alt-btn"
                            to={`/admin-dashboard/category-consultations/assign-doctor/${item._id}`}
                          >
                            {canonicalStatus(item.status) === "assigned" ? "Alternate Doctor" : "Assign Doctor"}
                          </Link>
                        )}
                        <button
                          type="button"
                          className="adp-secondary-link adp-cc-delete"
                          onClick={() => deleteConsultation(item._id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && displayed.length > 0 && (
          <div className="adp-cc-foot">
            <span>
              Showing {pageStart + 1}–{pageStart + pageItems.length} of {displayed.length} consultation
              {displayed.length === 1 ? "" : "s"}
            </span>
            {totalPages > 1 && (
              <nav className="adp-cc-pager" aria-label="Consultation pages">
                <button
                  type="button"
                  className="adp-cc-pager-btn"
                  aria-label="Previous page"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <span className="adp-cc-pager-text">Previous</span>
                  <span className="adp-cc-pager-chev" aria-hidden="true">‹</span>
                </button>
                {pageWindow(currentPage, totalPages).map((p, i) =>
                  p === "gap" ? (
                    <span key={`gap-${i}`} className="adp-cc-pager-gap" aria-hidden="true">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      className={`adp-cc-pager-btn${p === currentPage ? " adp-cc-pager-btn--active" : ""}`}
                      aria-current={p === currentPage ? "page" : undefined}
                      onClick={() => p !== currentPage && setPage(p)}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  className="adp-cc-pager-btn"
                  aria-label="Next page"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <span className="adp-cc-pager-text">Next</span>
                  <span className="adp-cc-pager-chev" aria-hidden="true">›</span>
                </button>
              </nav>
            )}
          </div>
        )}
      </section>
    </div>
  );
}