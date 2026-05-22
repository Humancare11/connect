import { useEffect, useState } from "react";
import api from "../../api";

/* ── Inline styles injected once ───────────────────────────────────────────── */
const MODAL_CSS = `
.od-overlay{position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;}
.od-modal{background:#fff;border-radius:18px;width:100%;max-width:800px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(15,23,42,0.22);}
.od-modal-head{display:flex;align-items:center;justify-content:space-between;padding:20px 28px;border-bottom:1px solid #f1f5f9;flex-shrink:0;}
.od-modal-body{flex:1;overflow-y:auto;padding:24px 28px 16px;}
.od-modal-foot{padding:14px 28px;border-top:1px solid #f1f5f9;display:flex;justify-content:flex-end;flex-shrink:0;}
.od-section{background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:14px;}
.od-section-head{padding:12px 18px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:8px;}
.od-section-head h4{margin:0;font-size:13px;font-weight:700;color:#223a5e;}
.od-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:12px 18px;padding:14px 18px;}
.od-row label{display:block;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px;}
.od-row span{font-size:13px;color:#1e293b;font-weight:500;word-break:break-word;}
.od-row span.empty{color:#94a3b8;font-style:italic;}
`;

/* ── View Modal ─────────────────────────────────────────────────────────────── */
function DoctorViewModal({ doctor, onClose }) {
  if (!doctor) return null;
  const d = doctor;
  const fullName = `Dr. ${d.firstName || ""} ${d.surname || ""}`.trim() || d.doctorId?.name || "—";
  const initials = `${(d.firstName || d.doctorId?.name || "D")[0]}${(d.surname || " ")[0]}`.toUpperCase();
  const phone    = [d.countryCode, d.phoneNumber].filter(Boolean).join(" ");
  const location = [d.city, d.state, d.country].filter(Boolean).join(", ");
  const langs    = Array.isArray(d.languagesKnown) ? d.languagesKnown.join(", ") : d.languagesKnown;

  return (
    <div className="od-overlay" onClick={onClose}>
      <style>{MODAL_CSS}</style>
      <div className="od-modal" onClick={e => e.stopPropagation()}>

        <div className="od-modal-head">
          <span style={{ fontSize: 15, fontWeight: 700, color: "#223a5e" }}>Doctor Profile</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#64748b" }}>✕</button>
        </div>

        <div className="od-modal-body">

          {/* Hero */}
          <div style={{ background: "linear-gradient(135deg,#223a5e 0%,#0c8b7a 100%)", borderRadius: 14, padding: "20px 24px", marginBottom: 14, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div style={{ width: 62, height: 62, borderRadius: "50%", background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "#fff", border: "2.5px solid rgba(255,255,255,0.4)", flexShrink: 0 }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 19, fontWeight: 800, color: "#fff", marginBottom: 3 }}>{fullName}</div>
              {(d.qualification || d.specialization) && (
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", marginBottom: 3 }}>{[d.qualification, d.specialization].filter(Boolean).join(" · ")}</div>
              )}
              {d.experience && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>🏅 {d.experience} years experience</div>}
              {location && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>📍 {location}</div>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
              <span style={{ background: "#dcfce7", color: "#166534", padding: "4px 12px", borderRadius: 50, fontSize: 11, fontWeight: 700 }}>✓ Approved</span>
              {d.consultantFees && (
                <span style={{ background: "rgba(255,255,255,0.15)", color: "#fff", padding: "4px 12px", borderRadius: 50, fontSize: 12, fontWeight: 700, border: "1px solid rgba(255,255,255,0.3)" }}>
                  ${d.consultantFees} / visit
                </span>
              )}
            </div>
          </div>

          {/* Personal */}
          <div className="od-section">
            <div className="od-section-head"><span>👤</span><h4>Personal Details</h4></div>
            <div className="od-grid">
              {[
                ["Doctor ID",    d.doctorId?.doctorId],
                ["First Name",   d.firstName],
                ["Surname",      d.surname],
                ["Email",        d.email || d.doctorId?.email],
                ["Phone",        phone],
                ["Gender",       d.gender],
                ["Date of Birth",d.dob],
                ["Languages",    langs],
              ].map(([label, val]) => (
                <div key={label} className="od-row">
                  <label>{label}</label>
                  <span className={val ? "" : "empty"}>{val || "—"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Location */}
          <div className="od-section">
            <div className="od-section-head"><span>📍</span><h4>Location</h4></div>
            <div className="od-grid">
              {[["Country",d.country],["State",d.state],["City",d.city],["ZIP",d.zip],].map(([l,v]) => (
                <div key={l} className="od-row"><label>{l}</label><span className={v?"":"empty"}>{v||"—"}</span></div>
              ))}
              <div className="od-row" style={{ gridColumn: "1/-1" }}>
                <label>Address</label><span className={d.address ? "" : "empty"}>{d.address || "—"}</span>
              </div>
            </div>
          </div>

          {/* Professional */}
          <div className="od-section">
            <div className="od-section-head"><span>🩺</span><h4>Professional Details</h4></div>
            <div className="od-grid">
              {[
                ["Specialization",     d.specialization],
                ["Sub-Specialization", d.subSpecialization],
                ["Qualification",      d.qualification],
                ["Experience",         d.experience ? `${d.experience} years` : null],
                ["Medical School",     d.medicalSchool],
                ["Graduation Year",    d.registrationYear],
                ["Medical Council",    d.medicalCouncilName],
                ["Reg. Number",        d.medicalRegistrationNumber],
                ["License No.",        d.medicalLicense],
                ["Consultation Mode",  d.consultationMode],
              ].map(([l, v]) => (
                <div key={l} className="od-row"><label>{l}</label><span className={v?"":"empty"}>{v||"—"}</span></div>
              ))}
            </div>
          </div>

          {/* Fees */}
          <div className="od-section">
            <div className="od-section-head"><span>💲</span><h4>Consultation Fee</h4></div>
            <div className="od-grid">
              <div className="od-row"><label>Fee</label><span>{d.consultantFees ? `$${d.consultantFees}` : "—"}</span></div>
              <div className="od-row"><label>Currency</label><span>{d.feeCurrency || "USD"}</span></div>
            </div>
          </div>

          {/* Clinic */}
          {(d.clinicName || d.clinicAddress) && (
            <div className="od-section">
              <div className="od-section-head"><span>🏥</span><h4>Clinic / Practice</h4></div>
              <div className="od-grid">
                <div className="od-row"><label>Clinic Name</label><span>{d.clinicName || "—"}</span></div>
                <div className="od-row" style={{ gridColumn: "1/-1" }}><label>Address</label><span>{d.clinicAddress || "—"}</span></div>
              </div>
            </div>
          )}

          {/* About */}
          {d.aboutDoctor && (
            <div className="od-section">
              <div className="od-section-head"><span>📝</span><h4>About</h4></div>
              <div style={{ padding: "12px 18px" }}>
                <p style={{ margin: 0, fontSize: 13, color: "#334155", lineHeight: 1.7 }}>{d.aboutDoctor}</p>
              </div>
            </div>
          )}

          {/* Payout */}
          <div className="od-section">
            <div className="od-section-head"><span>💳</span><h4>Payout Information</h4></div>
            <div className="od-grid">
              {[
                ["Bank Name",      d.bankName],
                ["Account Holder", d.accountHolderName],
                ["Account Number", d.accountNumber ? `****${d.accountNumber.slice(-4)}` : null],
                ["SWIFT / BIC",    d.ifscCode],
                ["Payout Email",   d.payoutEmail],
                ["PayPal ID",      d.paypalId],
              ].map(([l, v]) => (
                <div key={l} className="od-row"><label>{l}</label><span className={v?"":"empty"}>{v||"—"}</span></div>
              ))}
            </div>
          </div>

        </div>

        <div className="od-modal-foot">
          <button
            onClick={onClose}
            style={{ padding: "8px 22px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", color: "#64748b", fontWeight: 600, cursor: "pointer", fontSize: 13 }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────────────── */
export default function OurDoctors() {
  const [doctors,  setDoctors]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState("all");
  const [selected, setSelected] = useState(null);
  const [workflowStats, setWorkflowStats] = useState({
    totalDoctors: 0,
    profileUpdateRequests: 0,
    profileDeleteRequests: 0,
  });

  useEffect(() => {
    Promise.all([
      api.get("/api/admin/approved-doctors"),
      api.get("/api/admin/doctor-workflow-stats"),
    ])
      .then(([doctorRes, statsRes]) => {
        setDoctors(doctorRes.data || []);
        setWorkflowStats({
          totalDoctors: Number(statsRes?.data?.totalDoctors || 0),
          profileUpdateRequests: Number(statsRes?.data?.profileUpdateRequests || 0),
          profileDeleteRequests: Number(statsRes?.data?.profileDeleteRequests || 0),
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const specializations = [...new Set(doctors.map(d => d.specialization).filter(Boolean))].sort();

  const displayed = doctors.filter(d => {
    const name  = `${d.firstName || ""} ${d.surname || ""}`.trim() || d.doctorId?.name || "";
    const email = d.email || d.doctorId?.email || "";
    const id    = String(d.doctorId?.doctorId || "");
    const q     = search.trim().toLowerCase();
    const matchSearch = !q || name.toLowerCase().includes(q) || email.toLowerCase().includes(q) || id.includes(q);
    const matchFilter = filter === "all" || d.specialization === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div>
      {selected && <DoctorViewModal doctor={selected} onClose={() => setSelected(null)} />}

      {/* Header */}
      <div className="adp-header">
        <span className="adp-eyebrow">Admin Panel</span>
        <h1 className="adp-title">Our Doctors</h1>
        <p className="adp-sub">All approved and active doctors on the platform.</p>
      </div>

      {/* Stats */}
      <div className="adp-stats" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        {[
          { label: "Total Doctors", value: workflowStats.totalDoctors || doctors.length },
          { label: "Profile Update Requests", value: workflowStats.profileUpdateRequests },
          { label: "Profile Delete Requests", value: workflowStats.profileDeleteRequests },
        ].map(s => (
          <div key={s.label} className="adp-stat">
            <div className="adp-stat-value">{s.value}</div>
            <div className="adp-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="adp-card">
        <div className="adp-card-header">
          {/* Specialization tabs */}
          <div className="adp-tabs" style={{ flexWrap: "wrap" }}>
            <button className={`adp-tab ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
              All <span className="adp-tab-count">{doctors.length}</span>
            </button>
            {specializations.slice(0, 5).map(sp => (
              <button key={sp} className={`adp-tab ${filter === sp ? "active" : ""}`} onClick={() => setFilter(sp)}>
                {sp}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="adp-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              placeholder="Search by name, email or Doctor ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="adp-loading"><div className="adp-spinner" /><p>Loading doctors…</p></div>
        ) : displayed.length === 0 ? (
          <div className="adp-empty">
            <div className="adp-empty-icon">🩺</div>
            <h3>No approved doctors found</h3>
            <p>{search || filter !== "all" ? "Try adjusting your search or filter." : "No doctors have been approved yet."}</p>
          </div>
        ) : (
          <div className="adp-table-wrap">
            <table className="adp-table">
              <thead>
                <tr>
                  <th>Sr No</th>
                  <th>Doctor ID</th>
                  <th>Doctor</th>
                  <th>Specialization</th>
                  <th>Fees</th>
                  <th>Mobile Number</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((d, idx) => {
                  const name  = `${d.firstName || ""} ${d.surname || ""}`.trim() || d.doctorId?.name || "—";
                  const email = d.email || d.doctorId?.email || "";
                  const phone = [d.countryCode, d.phoneNumber].filter(Boolean).join(" ");
                  return (
                    <tr key={d._id}>
                      <td>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>{idx + 1}</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, fontSize: 13, color: "#223a5e", background: "#eff6ff", padding: "3px 10px", borderRadius: 8, letterSpacing: 1, border: "1px solid #bfdbfe" }}>
                          {d.doctorId?.doctorId || "—"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div className="adp-avatar">{name[0]?.toUpperCase() || "D"}</div>
                          <div>
                            <div style={{ fontWeight: 600, color: "#0f172a" }}>Dr. {name}</div>
                            <div style={{ fontSize: 12, color: "#94a3b8" }}>{email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {d.specialization
                          ? <span style={{ background: "#f0fdf4", color: "#166534", padding: "3px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600 }}>{d.specialization}</span>
                          : <span style={{ color: "#94a3b8" }}>—</span>}
                      </td>
                      <td>
                        {d.consultantFees
                          ? <span style={{ fontWeight: 700, color: "#0c8b7a" }}>${d.consultantFees}</span>
                          : <span style={{ color: "#94a3b8" }}>—</span>}
                      </td>
                      <td>
                        {phone
                          ? <span style={{ fontFamily: "monospace", fontSize: 13 }}>{phone}</span>
                          : <span style={{ color: "#94a3b8" }}>—</span>}
                      </td>
                      <td>
                        <button className="adp-btn adp-btn--view" onClick={() => setSelected(d)}>View</button>
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
