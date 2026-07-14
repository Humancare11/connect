import { useEffect, useMemo, useState } from "react";
import api from "../../api";
import { Link, useNavigate } from "react-router-dom";
// Reuse the exact same stylesheet AdminAppointments.jsx and
// AdminCategoryConsultationDetails.jsx already use, so this list picks up
// the same cards / pills / table look automatically.
import "./AdminAppointments.css";

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
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

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
    const confirmed = window.confirm(
      "Are you sure you want to delete this consultation?",
    );
    if (!confirmed) return;

    try {
      await api.delete(
        `/api/category-consultation/${id}`,
      );
      fetchConsultations();
    } catch (err) {
      console.error(err);
      alert("Failed to delete consultation");
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

  return (
    <div className="adp-page">
      <div className="adp-stats">
        {[
          { key: "pending", label: "Pending" },
          { key: "assigned", label: "Assigned" },
          { key: "complete", label: "Completed" },
          { key: "cancelled", label: "Cancelled" },
          { key: "all", label: "Total" },
        ].map((stat) => (
          <button
            type="button"
            key={stat.key}
            className={`adp-stat ${filter === stat.key ? "adp-stat--active" : ""}`}
            onClick={() => setFilter(stat.key)}
          >
            <span className="adp-stat-value">{counts[stat.key]}</span>
            <span className="adp-stat-label">{stat.label}</span>
          </button>
        ))}
      </div>

      <section className="adp-card">
        <div className="adp-card-header">
          <label className="adp-search" aria-label="Search category consultations">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              placeholder="Search concern, severity, urgency, slot..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
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
          </div>
        ) : displayed.length === 0 ? (
          <div className="adp-empty">
            <h3>No consultations found</h3>
            <p>No consultations match this view.</p>
          </div>
        ) : (
          <div className="adp-table-wrap">
            <table className="adp-flow-table">
              <thead>
                <tr>
                  <th>SR No</th>
                  <th>Concern</th>
                  <th>Severity</th>
                  <th>Support Type</th>
                  <th>Urgency</th>
                  <th>Time Window</th>
                  <th>Slot</th>
                  <th>Status</th>
                  <th>View</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((item, index) => (
                  <tr key={item._id}>
                    <td className="adp-sr-cell">{index + 1}</td>
                    <td>{item.concern || "-"}</td>
                    <td>{item.severity || "-"}</td>
                    <td>{item.supportType || "-"}</td>
                    <td>{item.urgency || "-"}</td>
                    <td>{item.timeWindow || "-"}</td>
                    <td>{item.slot || "-"}</td>
                    <td>
                      <StatusPill status={item.status} />
                    </td>
                    <td>
                      <Link
                        className="adp-view-btn"
                        to={`/admin-dashboard/category-consultations/${item._id}`}
                      >
                        View
                      </Link>
                    </td>
                    <td>
                      <div className="adp-list-actions">
                        <Link
                          className="adp-alt-btn"
                          to={`/admin-dashboard/category-consultations/assign-doctor/${item._id}`}
                        >
                          {canonicalStatus(item.status) === "assigned" ? "Alternate Doctor" : "Assign Doctor"}
                        </Link>
                        <button
                          type="button"
                          className="adp-secondary-link"
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
      </section>
    </div>
  );
}