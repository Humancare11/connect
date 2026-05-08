import { useEffect, useState } from "react";
import api from "../../api";

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="adp-detail-row">
      <span className="adp-detail-label">{label}</span>
      <span className="adp-detail-value">{value}</span>
    </div>
  );
}

function DoctorModal({ doctor, onClose, onAction }) {
  if (!doctor) return null;
  const name  = `${doctor.firstName || ""} ${doctor.surname || ""}`.trim() || doctor.doctorId?.name || "—";
  const email = doctor.email || doctor.doctorId?.email || "—";
  const status = doctor.approvalStatus;

  return (
    <div className="adp-overlay" onClick={onClose}>
      <div className="adp-modal" onClick={e => e.stopPropagation()}>
        <div className="adp-modal-header">
          <h3 className="adp-modal-title">Doctor Profile</h3>
          <button className="adp-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="adp-modal-body">
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, padding: "14px 18px", background: "#f8fafc", borderRadius: 12 }}>
            <div className="adp-avatar" style={{ width: 52, height: 52, fontSize: 20, borderRadius: 14, background: "linear-gradient(135deg,#19c9a3,#0ea5e9)", color: "#fff" }}>
              {name[0]?.toUpperCase() || "D"}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>{name}</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>{email}</div>
              <span className={`adp-badge adp-badge--${status}`} style={{ marginTop: 6 }}>{status}</span>
            </div>
          </div>
          <DetailRow label="Specialization"    value={doctor.specialization} />
          <DetailRow label="Qualification"     value={doctor.qualification} />
          <DetailRow label="Experience"        value={doctor.experience ? `${doctor.experience} years` : null} />
          <DetailRow label="License Number"    value={doctor.licenseNumber} />
          <DetailRow label="Hospital / Clinic" value={doctor.hospitalName} />
          <DetailRow label="Phone"             value={doctor.phone} />
          <DetailRow label="City"              value={doctor.city} />
          <DetailRow label="Consultation Fee"  value={doctor.consultationFee ? `₹${doctor.consultationFee}` : null} />
          <DetailRow label="About"             value={doctor.about} />
        </div>
        <div className="adp-modal-footer">
          <button className="adp-btn adp-btn--ghost" onClick={onClose}>Close</button>
          {status !== "approved" && (
            <button className="adp-btn adp-btn--approve" onClick={() => onAction(doctor._id, "approve")}>✓ Approve</button>
          )}
          {status !== "rejected" && (
            <button className="adp-btn adp-btn--reject" onClick={() => onAction(doctor._id, "reject")}>✕ Reject</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ManageDoctors() {
  const [enrollments, setEnrollments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState(null);
  const [search,      setSearch]      = useState("");
  const [filter,      setFilter]      = useState("all");
  const [toast,       setToast]       = useState(null);

  useEffect(() => {
    api.get("/api/admin/doctors")
      .then(r => setEnrollments(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const handleAction = async (id, action) => {
    try {
      const res = await api.put(`/api/admin/doctors/${id}/${action}`, {});
      setEnrollments(prev => prev.map(e => e._id === id ? { ...e, approvalStatus: res.data.enrollment.approvalStatus } : e));
      setSelected(prev => prev?._id === id ? { ...prev, approvalStatus: res.data.enrollment.approvalStatus } : prev);
      showToast(`Doctor ${action}d successfully.`);
    } catch (err) {
      showToast("Action failed. Please try again.", false);
    }
  };

  const counts = {
    all:      enrollments.length,
    pending:  enrollments.filter(e => e.approvalStatus === "pending").length,
    approved: enrollments.filter(e => e.approvalStatus === "approved").length,
    rejected: enrollments.filter(e => e.approvalStatus === "rejected").length,
  };

  const displayed = enrollments.filter(e => {
    const name  = `${e.firstName || ""} ${e.surname || ""}`.trim() || e.doctorId?.name || "";
    const email = e.email || e.doctorId?.email || "";
    const matchSearch = !search.trim() || name.toLowerCase().includes(search.toLowerCase()) || email.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || e.approvalStatus === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div>
      {toast && (
        <div className={`adp-toast ${toast.ok ? "adp-toast--ok" : "adp-toast--err"}`}>
          <span>{toast.ok ? "✓" : "!"}</span> {toast.msg}
        </div>
      )}
      {selected && <DoctorModal doctor={selected} onClose={() => setSelected(null)} onAction={(id, action) => { handleAction(id, action); }} />}

      <div className="adp-header">
        <span className="adp-eyebrow">Admin Panel</span>
        <h1 className="adp-title">Manage Doctors</h1>
        <p className="adp-sub">Review enrollment requests, approve or reject doctor registrations.</p>
      </div>

      <div className="adp-stats" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        {[
          { label: "Total",    value: counts.all,      cls: "" },
          { label: "Pending",  value: counts.pending,  cls: "adp-stat--amber" },
          { label: "Approved", value: counts.approved, cls: "adp-stat--green" },
          { label: "Rejected", value: counts.rejected, cls: "" },
        ].map(s => (
          <div key={s.label} className={`adp-stat ${s.cls}`}>
            <div className="adp-stat-value">{s.value}</div>
            <div className="adp-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="adp-card">
        <div className="adp-card-header">
          <div className="adp-tabs">
            {["all","pending","approved","rejected"].map(f => (
              <button key={f} className={`adp-tab ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
                <span className="adp-tab-count">{counts[f]}</span>
              </button>
            ))}
          </div>
          <div className="adp-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="adp-loading"><div className="adp-spinner" /><p>Loading doctors…</p></div>
        ) : displayed.length === 0 ? (
          <div className="adp-empty">
            <div className="adp-empty-icon">🩺</div>
            <h3>No doctors found</h3>
            <p>No enrollment requests match your filter.</p>
          </div>
        ) : (
          <div className="adp-table-wrap">
            <table className="adp-table">
              <thead>
                <tr>
                  <th>Doctor</th>
                  <th>Specialization</th>
                  <th>Experience</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map(e => {
                  const name  = `${e.firstName || ""} ${e.surname || ""}`.trim() || e.doctorId?.name || "—";
                  const email = e.email || e.doctorId?.email || "—";
                  return (
                    <tr key={e._id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div className="adp-avatar">{name[0]?.toUpperCase() || "D"}</div>
                          <div>
                            <div style={{ fontWeight: 600, color: "#0f172a" }}>{name}</div>
                            <div style={{ fontSize: 12, color: "#94a3b8" }}>{email}</div>
                          </div>
                        </div>
                      </td>
                      <td>{e.specialization || "—"}</td>
                      <td>{e.experience ? `${e.experience} yrs` : "—"}</td>
                      <td><span className={`adp-badge adp-badge--${e.approvalStatus}`}>{e.approvalStatus}</span></td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="adp-btn adp-btn--view" onClick={() => setSelected(e)}>View</button>
                          {e.approvalStatus !== "approved" && (
                            <button className="adp-btn adp-btn--approve" onClick={() => handleAction(e._id, "approve")}>Approve</button>
                          )}
                          {e.approvalStatus !== "rejected" && (
                            <button className="adp-btn adp-btn--reject" onClick={() => handleAction(e._id, "reject")}>Reject</button>
                          )}
                        </div>
                      </td>
                    </tr>
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
