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
  const [doctors, setDoctors] = useState([]);
  const [reassigningId, setReassigningId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAppt, setModalAppt] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    api.get("/api/appointments/admin/all")
      .then(r => setAppointments(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api.get("/api/doctor/approved")
      .then((r) => setDoctors(r.data || []))
      .catch(console.error);
  }, []);

  const changeDoctor = async (appointmentId, newDoctorId) => {
    if (!newDoctorId) return;
    setReassigningId(appointmentId);

    try {
      const res = await api.put(`/api/appointments/${appointmentId}/change-doctor`, {
        doctorId: newDoctorId,
      });

      const updated = res.data.appointment;
      const chosenDoctor = doctors.find((doc) => doc.doctorId?.toString() === newDoctorId?.toString());

      setAppointments((prev) =>
        prev.map((appt) =>
          appt._id === appointmentId
            ? {
                ...appt,
                doctorId: updated?.doctorId || appt.doctorId,
                doctorMeta: chosenDoctor
                  ? {
                      specialty: chosenDoctor.specialty || "—",
                      city: chosenDoctor.city || "—",
                      country: chosenDoctor.country || "—",
                    }
                  : appt.doctorMeta,
              }
            : appt
        )
      );

      // close modal if open for this appointment
      if (modalAppt && modalAppt._id === appointmentId) {
        setModalOpen(false);
        setModalAppt(null);
      }

      alert("Doctor reassigned successfully. The patient has been notified by email.");
    } catch (error) {
      console.error(error);
      const message = error?.response?.data?.msg || "Could not change doctor.";
      alert(message);
    } finally {
      setReassigningId(null);
    }
  };

  const renderLocation = (entity) => {
    if (!entity) return "—";
    return [entity.city, entity.country].filter(Boolean).join(", ") || entity.location || "—";
  };

  const renderDoctorSpecialty = (appt) =>
    appt.doctorMeta?.specialty || appt.doctorId?.specialty || "—";

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
      {/* Alternate Doctor modal */}
      {modalOpen && modalAppt && (
        <div className="adp-modal-backdrop" onClick={() => { setModalOpen(false); setModalAppt(null); }}>
          <div className="adp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="adp-modal-header">
              <h3>Alternate Doctor — {modalAppt.patientId?.name || "Patient"}</h3>
              <button className="adp-modal-close" onClick={() => { setModalOpen(false); setModalAppt(null); }}>Close</button>
            </div>

            <div className="adp-modal-body">
              {/* Current doctor details */}
              <div className="adp-current-doctor">
                <h4>Current Doctor</h4>
                {(() => {
                  const curId = (modalAppt.doctorId?._id?.toString() || modalAppt.doctorId?.toString() || "");
                  const cur = doctors.find(d => d.mongoId?.toString() === curId) || {};
                  return (
                    <div className="adp-cur-grid">
                      <div className="adp-doctor-id-badge">Dr. {cur.doctorId || "ID"}</div>
                      <div><strong>Name:</strong> {cur.name || modalAppt.doctorId?.name || '—'}</div>
                      <div><strong>Specialty:</strong> {cur.specialty || modalAppt.doctorMeta?.specialty || '—'}</div>
                      <div><strong>Country:</strong> {cur.country || modalAppt.doctorMeta?.country || '—'}</div>
                      <div><strong>Consultation Fees:</strong> {cur.price ? `₹${cur.price}` : '—'}</div>
                    </div>
                  );
                })()}
              </div>

              {/* Search + results */}
              <div className="adp-search-doctor">
                <h4>Alternate Doctor</h4>
                <input
                  className="adp-search-input"
                  placeholder="Search by name or Doctor ID"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />

                <div className="adp-search-results">
                  {doctors.filter(d => {
                    if (!searchQuery.trim()) return false;
                    const q = searchQuery.toLowerCase();
                    return (d.name || '').toLowerCase().includes(q) || (d.doctorId || '').toString() === searchQuery || (d.id || '').toString() === searchQuery;
                  }).map((doc) => (
                    <div key={doc.doctorId || doc.id} className="adp-doctor-row">
                      <div style={{ flex: 1 }}>
                        <div className="adp-doctor-id-inline">Dr. {doc.doctorId || "ID"}</div>
                        <div style={{ fontWeight: 700 }}>{doc.name}</div>
                        <div style={{ fontSize: 13, color: '#64748b' }}>{doc.specialty || '—'}</div>
                        <div style={{ fontSize: 13, color: '#64748b' }}>Location: {doc.country || doc.city || '—'}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexDirection: 'column' }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{doc.price ? `₹${doc.price}` : '—'}</div>
                        <button
                          className="adp-assign-btn"
                          disabled={reassigningId === modalAppt._id}
                          onClick={() => changeDoctor(modalAppt._id, doc.doctorId)}
                        >
                          {reassigningId === modalAppt._id ? 'Assigning…' : 'Assign'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  <th>Appointment ID</th>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Date & Time</th>
                  <th>Alternate Doctor</th>
                  <th>Status</th>
                  <th>View</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map(a => {
                  const sc = STATUS_COLORS[a.status] || STATUS_COLORS.pending;
                  const isOpen = expandedId === a._id;
                  const currentDoctorId = a.doctorId?._id?.toString() || a.doctorId?.toString() || "";
                  const doctorOptions = doctors.slice();
                  const currentDoctorPresent = doctorOptions.some((doc) => doc.mongoId?.toString() === currentDoctorId);
                  if (!currentDoctorPresent && a.doctorId) {
                    doctorOptions.unshift({
                      doctorId: null,
                      mongoId: a.doctorId._id?.toString() || a.doctorId?.toString() || "",
                      name: a.doctorId.name || "Current doctor",
                      email: a.doctorId.email || "",
                      specialty: a.doctorMeta?.specialty || "—",
                      city: a.doctorMeta?.city || "—",
                      country: a.doctorMeta?.country || "—",
                    });
                  }

                  return (
                    <>
                      <tr key={a._id} className={`adp-row ${isOpen ? "adp-row--open" : ""}`}>
                        <td style={{ fontSize: 12, color: "#475569" }}>{a._id}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            <div className="adp-avatar" style={{ background: "#ede9fe", color: "#7c3aed" }}>{(a.patientId?.name || "P")[0].toUpperCase()}</div>
                            <div>
                              <div style={{ fontWeight: 600, color: "#0f172a" }}>{a.patientId?.name || "Unknown"}</div>
                              <div style={{ fontSize: 12, color: "#64748b" }}>{renderLocation(a.patientId)}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            <div className="adp-avatar" style={{ background: "#ecfdf5", color: "#059669" }}>{(a.doctorId?.name || "D")[0].toUpperCase()}</div>
                            <div>
                              <div>{a.doctorId?.name || "Unassigned"}</div>
                              <div style={{ fontSize: 12, color: "#64748b" }}>{renderDoctorSpecialty(a)}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <div style={{ fontWeight: 600 }}>{a.date}</div>
                          <div style={{ fontSize: 13, color: '#64748b' }}>{a.time || '—'}</div>
                        </td>
                        <td>
                          <button
                            className="adp-alt-btn"
                            onClick={() => {
                              setModalAppt(a);
                              setSearchQuery("");
                              setModalOpen(true);
                            }}
                          >
                            Alternate Doctor
                          </button>
                        </td>
                        <td>
                          <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, textTransform: "capitalize" }}>
                            {a.status}
                          </span>
                        </td>
                        <td>
                          <button
                            className="adp-view-btn"
                            onClick={() => setExpandedId(isOpen ? null : a._id)}
                          >
                            View
                          </button>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr key={`${a._id}-exp`} className="adp-expand-row">
                          <td colSpan={8}>
                            <div className="adp-expand">
                              <div className="adp-expand-grid">
                                <div className="adp-exp-item">
                                  <span className="adp-exp-label">Appointment ID</span>
                                  <span className="adp-exp-value">{a._id}</span>
                                </div>
                                <div className="adp-exp-item">
                                  <span className="adp-exp-label">Patient</span>
                                  <span className="adp-exp-value">{a.patientId?.name || "—"}</span>
                                </div>
                                <div className="adp-exp-item">
                                  <span className="adp-exp-label">Gender</span>
                                  <span className="adp-exp-value">{a.patientId?.gender || "—"}</span>
                                </div>
                                <div className="adp-exp-item">
                                  <span className="adp-exp-label">Patient city & country</span>
                                  <span className="adp-exp-value">{renderLocation(a.patientId)}</span>
                                </div>
                                <div className="adp-exp-item">
                                  <span className="adp-exp-label">Doctor</span>
                                  <span className="adp-exp-value">{a.doctorId?.name || "—"}</span>
                                </div>
                                <div className="adp-exp-item">
                                  <span className="adp-exp-label">Specialty</span>
                                  <span className="adp-exp-value">{renderDoctorSpecialty(a)}</span>
                                </div>
                                <div className="adp-exp-item">
                                  <span className="adp-exp-label">Doctor city & country</span>
                                  <span className="adp-exp-value">{renderLocation(a.doctorMeta)}</span>
                                </div>
                                <div className="adp-exp-item">
                                  <span className="adp-exp-label">Appointment Date</span>
                                  <span className="adp-exp-value">{a.date}</span>
                                </div>
                                <div className="adp-exp-item">
                                  <span className="adp-exp-label">Appointment Time</span>
                                  <span className="adp-exp-value">{a.time || "—"}</span>
                                </div>
                                <div className="adp-exp-item">
                                  <span className="adp-exp-label">Alternate Doctor</span>
                                  <span className="adp-exp-value">{doctors.find((doc) => doc.mongoId?.toString() === currentDoctorId)?.name || a.doctorId?.name || "—"}</span>
                                </div>
                                <div className="adp-exp-item">
                                  <span className="adp-exp-label">Status</span>
                                  <span className="adp-exp-value">{a.status}</span>
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
