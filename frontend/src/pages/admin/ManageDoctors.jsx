import { useEffect, useState } from "react";
import api from "../../api";

const STATUS_COLORS = {
  approved: { bg: "#dcfce7", color: "#166534", label: "Approved" },
  pending:  { bg: "#fef9c3", color: "#854d0e", label: "Pending Approval" },
  rejected: { bg: "#fee2e2", color: "#991b1b", label: "Rejected" },
};

const MODAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@700;800&display=swap');
.adp-overlay { position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px; }
.adp-modal-new { background:#fff;border-radius:18px;width:100%;max-width:780px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(15,23,42,0.22); }
.adp-modal-new-head { display:flex;align-items:center;justify-content:space-between;padding:20px 28px;border-bottom:1px solid #f1f5f9;flex-shrink:0; }
.adp-modal-new-body { flex:1;overflow-y:auto;padding:24px 28px 8px; }
.adp-modal-new-foot { padding:16px 28px;border-top:1px solid #f1f5f9;display:flex;justify-content:flex-end;gap:10px;flex-shrink:0; }
.dm-section { background:#fff;border-radius:12px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(34,58,94,0.05);overflow:hidden;margin-bottom:16px; }
.dm-section-head { padding:13px 20px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:9px; }
.dm-section-head h4 { margin:0;font-size:14px;font-weight:700;color:#223a5e; }
.dm-section-body { padding:16px 20px; }
.dm-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px 20px; }
.dm-row label { display:block;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px; }
.dm-row span { font-size:13px;color:#1e293b;font-weight:500;word-break:break-word; }
.dm-row span.empty { color:#94a3b8;font-style:italic; }
`;

function DmSection({ icon, title, children }) {
  return (
    <div className="dm-section">
      <div className="dm-section-head">
        <span style={{ fontSize: 16 }}>{icon}</span>
        <h4>{title}</h4>
      </div>
      <div className="dm-section-body">
        <div className="dm-grid">{children}</div>
      </div>
    </div>
  );
}

function DmRow({ label, value, fullWidth }) {
  return (
    <div className="dm-row" style={fullWidth ? { gridColumn: "1/-1" } : {}}>
      <label>{label}</label>
      <span className={value ? "" : "empty"}>{value || "—"}</span>
    </div>
  );
}

function DoctorModal({ doctor, onClose, onAction }) {
  if (!doctor) return null;
  const d = doctor;
  const fullName = `Dr. ${d.firstName || ""} ${d.surname || ""}`.trim() || d.doctorId?.name || "—";
  const initials = `${(d.firstName || d.doctorId?.name || "D")[0]}${(d.surname || " ")[0]}`.toUpperCase();
  const status = d.approvalStatus || "pending";
  const statusStyle = STATUS_COLORS[status] || STATUS_COLORS.pending;
  const locationStr = [d.city, d.state, d.country].filter(Boolean).join(", ");
  const langStr = Array.isArray(d.languagesKnown) ? d.languagesKnown.join(", ") : d.languagesKnown;

  return (
    <div className="adp-overlay" onClick={onClose}>
      <style>{MODAL_CSS}</style>
      <div className="adp-modal-new" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="adp-modal-new-head">
          <span style={{ fontSize: 16, fontWeight: 700, color: "#223a5e", fontFamily: "'Outfit',sans-serif" }}>Doctor Profile</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#64748b", lineHeight: 1 }}>✕</button>
        </div>

        <div className="adp-modal-new-body">

          {/* Hero card */}
          <div style={{
            background: "linear-gradient(135deg,#223a5e 0%,#0c8b7a 100%)",
            borderRadius: 14, padding: "22px 26px", marginBottom: 16,
            display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap",
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 700, color: "#fff", border: "2.5px solid rgba(255,255,255,0.4)", flexShrink: 0,
            }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: "'Outfit',sans-serif", marginBottom: 4 }}>{fullName}</div>
              {(d.qualification || d.specialization) && (
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", marginBottom: 4 }}>
                  {[d.qualification, d.specialization].filter(Boolean).join(" · ")}
                </div>
              )}
              {d.experience && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginBottom: 4 }}>🏅 {d.experience} years experience</div>}
              {locationStr && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>📍 {locationStr}</div>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
              <span style={{ background: statusStyle.bg, color: statusStyle.color, padding: "4px 12px", borderRadius: 50, fontSize: 11, fontWeight: 700 }}>
                {statusStyle.label}
              </span>
              {d.consultantFees && (
                <span style={{ background: "rgba(255,255,255,0.15)", color: "#fff", padding: "4px 12px", borderRadius: 50, fontSize: 12, fontWeight: 700, border: "1px solid rgba(255,255,255,0.3)" }}>
                  ${d.consultantFees} / visit
                </span>
              )}
            </div>
          </div>

          {/* Personal */}
          <DmSection icon="👤" title="Personal Details">
            <DmRow label="First Name"    value={d.firstName} />
            <DmRow label="Surname"       value={d.surname} />
            <DmRow label="Email"         value={d.email || d.doctorId?.email} />
            <DmRow label="Phone"         value={[d.countryCode, d.phoneNumber].filter(Boolean).join(" ")} />
            <DmRow label="Gender"        value={d.gender} />
            <DmRow label="Date of Birth" value={d.dob} />
            <DmRow label="Languages"     value={langStr} />
          </DmSection>

          {/* Location */}
          <DmSection icon="📍" title="Location">
            <DmRow label="Country"        value={d.country} />
            <DmRow label="State / Region" value={d.state} />
            <DmRow label="City"           value={d.city} />
            <DmRow label="ZIP / Postal"   value={d.zip} />
            <DmRow label="Address"        value={d.address} fullWidth />
          </DmSection>

          {/* Professional */}
          <DmSection icon="🩺" title="Professional Details">
            <DmRow label="Specialization"      value={d.specialization} />
            <DmRow label="Sub-Specialization"  value={d.subSpecialization} />
            <DmRow label="Qualification"       value={d.qualification} />
            <DmRow label="Experience"          value={d.experience ? `${d.experience} years` : null} />
            <DmRow label="Medical School"      value={d.medicalSchool} />
            <DmRow label="Graduation Year"     value={d.registrationYear} />
            <DmRow label="Medical Council"     value={d.medicalCouncilName} />
            <DmRow label="Reg. Number"         value={d.medicalRegistrationNumber} />
            <DmRow label="Medical License No." value={d.medicalLicense} />
            {d.medicalLicenseFile && (
              <div className="dm-row" style={{ gridColumn: "1/-1" }}>
                <label>Medical License Document</label>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 15 }}>📄</span>
                  <span style={{ color: "#0c8b7a", fontWeight: 600 }}>{d.medicalLicenseFile}</span>
                  <span style={{ fontSize: 10, color: "#94a3b8", background: "#f1f5f9", padding: "1px 7px", borderRadius: 50 }}>Uploaded</span>
                </span>
              </div>
            )}
          </DmSection>

          {/* About */}
          {d.aboutDoctor && (
            <div className="dm-section">
              <div className="dm-section-head">
                <span style={{ fontSize: 16 }}>📝</span>
                <h4>About</h4>
              </div>
              <div className="dm-section-body">
                <p style={{ margin: 0, fontSize: 13, color: "#334155", lineHeight: 1.7 }}>{d.aboutDoctor}</p>
              </div>
            </div>
          )}

          {/* Consultation Fee */}
          <DmSection icon="💲" title="Consultation Fee">
            <DmRow label="Fee (USD)" value={d.consultantFees ? `$${d.consultantFees}` : null} />
          </DmSection>

          {/* Clinic */}
          {(d.clinicName || d.clinicAddress) && (
            <DmSection icon="🏥" title="Clinic / Practice">
              <DmRow label="Clinic Name"    value={d.clinicName} />
              <DmRow label="Clinic Address" value={d.clinicAddress} />
            </DmSection>
          )}

          {/* Payout */}
          <DmSection icon="💳" title="Payout Information">
            <DmRow label="Bank Name"      value={d.bankName} />
            <DmRow label="Account Holder" value={d.accountHolderName} />
            <DmRow label="Account Number" value={d.accountNumber ? `****${d.accountNumber.slice(-4)}` : null} />
            <DmRow label="SWIFT / BIC"    value={d.ifscCode} />
            <DmRow label="Payout Email"   value={d.payoutEmail} />
            <DmRow label="PayPal ID"      value={d.paypalId} />
          </DmSection>

          {/* Status */}
          <div style={{ background: statusStyle.bg, borderRadius: 12, padding: "16px 20px", border: `1.5px solid ${statusStyle.color}33`, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>
                {status === "approved" ? "✅" : status === "rejected" ? "❌" : "⏳"}
              </span>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: statusStyle.color }}>Enrollment Status: {statusStyle.label}</p>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: statusStyle.color, opacity: 0.8 }}>
                  {status === "approved" && "Profile is live and visible to patients."}
                  {status === "pending"  && "Application is under admin review."}
                  {status === "rejected" && "Application was rejected."}
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Footer actions */}
        <div className="adp-modal-new-foot">
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
