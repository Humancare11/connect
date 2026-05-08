import { useEffect, useState } from "react";
import api from "../../api";
import "./AdminAppointments.css";

const STATUS_COLORS = {
  pending:   { bg: "#fef3c7", color: "#d97706", border: "#fcd34d" },
  confirmed: { bg: "#ecfdf5", color: "#059669", border: "#6ee7b7" },
  completed: { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
  cancelled: { bg: "#fef2f2", color: "#dc2626", border: "#fca5a5" },
};

function fileIcon(type = "") {
  if (type.includes("pdf")) return "📄";
  if (type.startsWith("image/")) return "🖼️";
  if (type.includes("word") || type.includes("doc")) return "📝";
  return "📎";
}

export default function AdminAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    api.get("/api/appointments/admin/all")
      .then(r => setAppointments(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const counts = {
    all:       appointments.length,
    pending:   appointments.filter(a => a.status === "pending").length,
    confirmed: appointments.filter(a => a.status === "confirmed").length,
    completed: appointments.filter(a => a.status === "completed").length,
    cancelled: appointments.filter(a => a.status === "cancelled").length,
  };

  const displayed = appointments.filter(a => {
    const patient = a.patientId?.name || "";
    const doctor  = a.doctorId?.name  || "";
    const matchSearch = !search.trim() || patient.toLowerCase().includes(search.toLowerCase()) || doctor.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || a.status === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div>
      <div className="adp-header">
        <span className="adp-eyebrow">Admin Panel</span>
        <h1 className="adp-title">Appointments</h1>
        <p className="adp-sub">Monitor all appointments across the platform.</p>
      </div>

      <div className="adp-stats">
        {[
          { label: "Total",     value: counts.all,       cls: "" },
          { label: "Pending",   value: counts.pending,   cls: "adp-stat--amber" },
          { label: "Confirmed", value: counts.confirmed, cls: "adp-stat--green" },
          { label: "Completed", value: counts.completed, cls: "adp-stat--blue" },
          { label: "Cancelled", value: counts.cancelled, cls: "" },
        ].map(s => (
          <div key={s.label} className={`adp-stat ${s.cls}`} style={{ cursor: "pointer" }} onClick={() => setFilter(s.label.toLowerCase() === "total" ? "all" : s.label.toLowerCase())}>
            <div className="adp-stat-value">{s.value}</div>
            <div className="adp-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="adp-card">
        <div className="adp-card-header">
          <div className="adp-tabs">
            {["all","pending","confirmed","completed","cancelled"].map(f => (
              <button key={f} className={`adp-tab ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                <span className="adp-tab-count">{counts[f]}</span>
              </button>
            ))}
          </div>
          <div className="adp-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input placeholder="Search patient or doctor…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="adp-loading"><div className="adp-spinner" /><p>Loading appointments…</p></div>
        ) : displayed.length === 0 ? (
          <div className="adp-empty">
            <div className="adp-empty-icon">📅</div>
            <h3>No appointments found</h3>
            <p>No appointments match your current filter.</p>
          </div>
        ) : (
          <div className="adp-table-wrap">
            <table className="adp-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Problem</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {displayed.map(a => {
                  const sc = STATUS_COLORS[a.status] || STATUS_COLORS.pending;
                  const isOpen = expandedId === a._id;
                  return (
                    <>
                      <tr key={a._id} className={`adp-row ${isOpen ? "adp-row--open" : ""}`}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            <div className="adp-avatar" style={{ background: "#ede9fe", color: "#7c3aed" }}>{(a.patientId?.name || "P")[0].toUpperCase()}</div>
                            <span style={{ fontWeight: 600, color: "#0f172a" }}>{a.patientId?.name || "Unknown"}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            <div className="adp-avatar" style={{ background: "#ecfdf5", color: "#059669" }}>{(a.doctorId?.name || "D")[0].toUpperCase()}</div>
                            <span>{a.doctorId?.name || "Unassigned"}</span>
                          </div>
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>{a.date}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{a.time}</td>
                        <td className="adp-problem">{a.problem || "—"}</td>
                        <td>
                          <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, textTransform: "capitalize" }}>
                            {a.status}
                          </span>
                        </td>
                        <td>
                          <button
                            className={`adp-expand-btn ${isOpen ? "adp-expand-btn--open" : ""}`}
                            onClick={() => setExpandedId(isOpen ? null : a._id)}
                            title="View details"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </button>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr key={`${a._id}-exp`} className="adp-expand-row">
                          <td colSpan={7}>
                            <div className="adp-expand">
                              <div className="adp-expand-grid">
                                <div className="adp-exp-item">
                                  <span className="adp-exp-label">Patient email</span>
                                  <span className="adp-exp-value">{a.patientId?.email || "—"}</span>
                                </div>
                                <div className="adp-exp-item">
                                  <span className="adp-exp-label">Doctor email</span>
                                  <span className="adp-exp-value">{a.doctorId?.email || "—"}</span>
                                </div>
                                <div className="adp-exp-item adp-exp-item--full">
                                  <span className="adp-exp-label">Problem</span>
                                  <span className="adp-exp-value">{a.problem || "—"}</span>
                                </div>
                              </div>

                              {a.medicalReports?.length > 0 ? (
                                <div className="adp-reports">
                                  <p className="adp-reports-label">
                                    Medical Reports
                                    <span className="adp-reports-count">{a.medicalReports.length}</span>
                                  </p>
                                  <div className="adp-reports-list">
                                    {a.medicalReports.map((r, i) => (
                                      <a
                                        key={i}
                                        href={r.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="adp-report-chip"
                                        title={r.name}
                                      >
                                        <span>{fileIcon(r.type)}</span>
                                        <span className="adp-report-name">{r.name}</span>
                                        <span className="adp-report-arrow">↗</span>
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <p className="adp-no-reports">No medical reports attached</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
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
