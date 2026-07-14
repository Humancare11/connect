import { useState, useEffect, Fragment } from "react";
import { Link, useLocation } from "react-router-dom";
import "./DoctorAppointments.css";
import api from "../../api";
import { useDoctorAuth } from "../../context/DoctorAuthContext";

const STATUS_META = {
  assigned: { label: "Assigned", icon: "A", color: "teal" },
  pending: { label: "Pending", icon: "⏳", color: "amber" },
  confirmed: { label: "Confirmed", icon: "✓", color: "teal" },
  cancelled: { label: "Cancelled", icon: "✕", color: "red" },
  complete: { label: "Complete", icon: "C", color: "slate" },
  completed: { label: "Complete", icon: "C", color: "slate" },
};

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function DoctorAppointments() {
  const { doctor } = useDoctorAuth();
  const location = useLocation();
  const doctorName = doctor?.name || "Doctor";

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [focusedId, setFocusedId] = useState("");
  const [confirmingId, setConfirmingId] = useState(null);
  const [completingId, setCompletingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [completeConfirmId, setCompleteConfirmId] = useState(null);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    api
      .get("/api/appointments/doctor")
      .then((res) => setAppointments(res.data))
      .catch((err) => console.error("Failed to load appointments", err))
      .finally(() => setLoading(false));
  }, []);

  /* Deep-link: ?activityId=<id> — expand and scroll to that row */
  useEffect(() => {
    const activityId = new URLSearchParams(location.search).get("activityId");
    if (!activityId || appointments.length === 0) {
      setFocusedId("");
      return;
    }

    const target = appointments.find((a) => a._id === activityId);
    if (!target) {
      setFocusedId("");
      return;
    }

    setFocusedId(activityId);
    setSelectedId(activityId);
    setFilter("all");

    setTimeout(() => {
      document
        .getElementById(`appt-row-${activityId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  }, [appointments, location.search]);

  const confirmAppointment = async (id) => {
    setConfirmingId(id);
    try {
      await api.put(`/api/appointments/${id}/confirm`, {});
      setAppointments((prev) =>
        prev.map((a) =>
          a._id === id
            ? { ...a, status: "confirmed", sessionStarted: true }
            : a,
        ),
      );
    } catch {
      showToast("Could not confirm appointment.", false);
    } finally {
      setConfirmingId(null);
    }
  };

  const completeAppointment = async (id) => {
    setCompleteConfirmId(null);
    setCompletingId(id);
    try {
      await api.put(`/api/appointments/${id}/complete`, {});
      setAppointments((prev) =>
        prev.map((a) => (a._id === id ? { ...a, status: "complete" } : a)),
      );
      showToast("Consultation marked as completed.");
    } catch {
      showToast("Could not complete appointment.", false);
    } finally {
      setCompletingId(null);
    }
  };

  const TABS = ["all", "assigned", "pending", "confirmed", "complete"];

  const counts = {
    all: appointments.length,
    assigned: appointments.filter((a) => a.status === "assigned").length,
    pending: appointments.filter((a) => a.status === "pending").length,
    confirmed: appointments.filter((a) => a.status === "confirmed").length,
    complete: appointments.filter((a) => ["complete", "completed"].includes(a.status)).length,
  };

  const filtered =
    filter === "all"
      ? appointments
      : appointments.filter((a) => (filter === "complete" ? ["complete", "completed"].includes(a.status) : a.status === filter));

  return (
    <div className="da-root">
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 9999,
            background: toast.ok ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${toast.ok ? "#86efac" : "#fca5a5"}`,
            color: toast.ok ? "#15803d" : "#dc2626",
            borderRadius: 10,
            padding: "12px 18px",
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            animation: "adp-fadein 0.2s ease",
          }}
        >
          {toast.ok ? "✓" : "!"} {toast.msg}
        </div>
      )}

      {completeConfirmId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9998,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setCompleteConfirmId(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: "28px 32px",
              maxWidth: 400,
              width: "100%",
              textAlign: "center",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
            <h3 style={{ margin: "0 0 8px", fontSize: 17, color: "#111827" }}>
              Mark as Completed?
            </h3>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: "#6b7280" }}>
              This will mark the consultation as completed. This action cannot
              be undone.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                onClick={() => setCompleteConfirmId(null)}
                style={{
                  padding: "9px 20px",
                  borderRadius: 8,
                  border: "1.5px solid #d1d5db",
                  background: "#fff",
                  color: "#374151",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => completeAppointment(completeConfirmId)}
                style={{
                  padding: "9px 22px",
                  borderRadius: 8,
                  border: "none",
                  background: "#059669",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Yes, Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="da-header">
        <div>
          <span className="da-eyebrow">Humancare</span>
          <h1 className="da-greeting">
            {getGreeting()}, {doctorName} <span className="da-wave">👋</span>
          </h1>
          <p className="da-sub">Manage your patient appointments</p>
        </div>
      </header>

      {/* Stats */}
      <div className="da-stats">
        {[
          { key: "assigned", label: "Assigned", dot: "teal" },
          { key: "pending", label: "Pending", dot: "amber" },
          { key: "confirmed", label: "Confirmed", dot: "teal" },
          { key: "complete", label: "Complete", dot: "green" },
          { key: "all", label: "Total", dot: "purple" },
        ].map(({ key, label, dot }, i) => (
          <div
            key={key}
            className={`da-stat ${filter === key ? "da-stat--active" : ""}`}
            style={{ animationDelay: `${i * 0.07}s` }}
            onClick={() => setFilter(key)}
          >
            <span className={`da-dot da-dot--${dot}`} />
            <div>
              <div className="da-stat-num">{counts[key] ?? 0}</div>
              <div className="da-stat-label">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Panel */}
      <div className="da-panel">
        <div className="da-panel-top">
          <div>
            <h2 className="da-panel-title">Appointments</h2>
          </div>
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="da-table-wrap">
            <table className="da-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Problem</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((appt, idx) => {
                  const meta = STATUS_META[appt.status] || {
                    label: appt.status,
                    color: "slate",
                    icon: "•",
                  };

                  const isOpen = selectedId === appt._id;

                  return (
                    <Fragment key={appt._id}>
                      {/* MAIN ROW */}
                      <tr
                        id={`appt-row-${appt._id}`}
                        className={`da-row ${isOpen ? "da-row--open" : ""} ${focusedId === appt._id ? "da-row--focused" : ""}`}
                        style={{ animationDelay: `${idx * 0.04}s` }}
                      >
                        <td>
                          <div className="da-patient">
                            <div className="da-avatar">
                              {(appt.patientId?.name || "?")
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                            <span className="da-patient-name">
                              {appt.patientId?.name || "Unknown"}
                            </span>
                          </div>
                        </td>

                        <td className="da-mono">{formatDate(appt.date)}</td>

                        <td className="da-mono">{appt.time || "—"}</td>

                        <td className="da-problem">{appt.problem || "—"}</td>

                        <td>
                          <span className={`da-badge da-badge--${meta.color}`}>
                            {meta.icon} {meta.label}
                          </span>
                        </td>

                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="da-action-group">
                            {/* CONFIRM */}
                            {["assigned", "pending"].includes(appt.status) && (
                              <button
                                className="da-btn da-btn--confirm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  confirmAppointment(appt._id);
                                }}
                                disabled={confirmingId === appt._id}
                              >
                                {confirmingId === appt._id ? (
                                  <span className="da-spinner" />
                                ) : (
                                  "Confirm"
                                )}
                              </button>
                            )}

                            {/* JOIN */}
                            {appt.status === "confirmed" && (
                              <Link
                                className="da-btn da-btn--join"
                                to={`/video-call/${appt._id}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                Join
                              </Link>
                            )}

                            {/* COMPLETE CONSULTATION */}
                            {appt.status === "confirmed" && (
                              <button
                                className="da-btn da-btn--complete"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCompleteConfirmId(appt._id);
                                }}
                                disabled={completingId === appt._id}
                              >
                                {completingId === appt._id ? (
                                  <span className="da-spinner" />
                                ) : (
                                  "Complete"
                                )}
                              </button>
                            )}

                            {/* 🔽 ONLY THIS OPENS DATA */}
                            <button
                              className={`da-btn da-btn--ghost ${
                                isOpen ? "da-btn--ghost-on" : ""
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedId(isOpen ? null : appt._id);
                              }}
                            >
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                style={{
                                  transform: isOpen ? "rotate(180deg)" : "none",
                                  transition: "transform 0.22s",
                                }}
                              >
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* EXPAND */}
                      {isOpen && (
                        <tr className="da-expand-row">
                          <td colSpan={6}>
                            <div className="da-expand">
                              <div className="da-expand-grid">
                                <div className="da-exp-item">
                                  <span className="da-exp-label">Patient</span>
                                  <span className="da-exp-value">
                                    {appt.patientId?.name || "—"}
                                  </span>
                                </div>
                                <div className="da-exp-item">
                                  <span className="da-exp-label">Email</span>
                                  <span className="da-exp-value">
                                    {appt.patientId?.email || "—"}
                                  </span>
                                </div>
                                {appt.patientId?.mobile && (
                                  <div className="da-exp-item">
                                    <span className="da-exp-label">Mobile</span>
                                    <span className="da-exp-value">
                                      {appt.patientId.mobile}
                                    </span>
                                  </div>
                                )}
                                <div className="da-exp-item da-exp-item--full">
                                  <span className="da-exp-label">Problem</span>
                                  <span className="da-exp-value">
                                    {appt.problem || "—"}
                                  </span>
                                </div>
                              </div>

                              <div className="da-reports">
                                <p className="da-reports-label">
                                  Medical Reports
                                </p>
                                {appt.medicalReports?.length > 0 ? (
                                  <div className="da-reports-list">
                                    {appt.medicalReports.map((r, i) => (
                                      <a
                                        key={i}
                                        href={r.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="da-report-chip"
                                        title={r.name}
                                      >
                                        <span>
                                          {r.type?.includes("pdf")
                                            ? "📄"
                                            : r.type?.startsWith("image/")
                                              ? "🖼️"
                                              : "📎"}
                                        </span>
                                        <span className="da-report-chip-name">
                                          {r.name}
                                        </span>
                                        <span className="da-report-chip-arrow">
                                          ↗
                                        </span>
                                      </a>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="da-no-reports">
                                    No medical reports attached
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
