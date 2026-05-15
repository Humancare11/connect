import { useEffect, useState } from "react";
import api from "../../api";
import { useDoctorAuth } from "../../context/DoctorAuthContext";

const STATUS_COLORS = {
  approved: { bg: "#dcfce7", color: "#166534", label: "Approved" },
  pending:  { bg: "#fef9c3", color: "#854d0e", label: "Pending Approval" },
  rejected: { bg: "#fee2e2", color: "#991b1b", label: "Rejected" },
};

const SPECIALTIES = [
  "General Practice","Internal Medicine","Cardiology","Dermatology","Endocrinology",
  "Gastroenterology","Neurology","Oncology","Ophthalmology","Orthopedics","Pediatrics",
  "Psychiatry","Pulmonology","Radiology","Surgery","Urology","OB/GYN","Emergency Medicine",
  "Anesthesiology","Pathology","Other"
];
const QUALIFICATIONS = ["MD","DO","NP","PA","Other"];
const GENDERS = ["Male","Female","Non-binary","Prefer not to say"];
const COUNTRIES = [
  "United States","United Kingdom","India","Canada","Australia","Germany","France",
  "Brazil","Mexico","South Africa","Nigeria","Kenya","UAE","Saudi Arabia","Singapore",
  "Japan","South Korea","Philippines","Pakistan","Bangladesh","Sri Lanka","Nepal","Other"
];

// ── Styles ──────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&display=swap');
.dp-root { max-width: 880px; margin: 0 auto; padding: 0 4px 48px; }
.dp-section {
  background: #fff; border-radius: 14px; border: 1px solid #e2e8f0;
  box-shadow: 0 1px 4px rgba(34,58,94,0.06); overflow: hidden; margin-bottom: 20px;
}
.dp-section-head {
  padding: 16px 24px; border-bottom: 1px solid #f1f5f9;
  display: flex; align-items: center; justify-content: space-between;
}
.dp-section-title { display: flex; align-items: center; gap: 10px; }
.dp-section-title h3 { margin: 0; font-size: 15px; font-weight: 700; color: #223a5e; font-family: 'Outfit',sans-serif; }
.dp-section-body { padding: 20px 24px; }
.dp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px 24px; }
.dp-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 24px; }
.dp-row label { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: .05em; display: block; margin-bottom: 3px; }
.dp-row span  { font-size: 14px; color: #1e293b; font-weight: 500; word-break: break-word; }
.dp-row span.empty { color: #94a3b8; font-style: italic; }
.dp-field { display: flex; flex-direction: column; gap: 5px; }
.dp-field label { font-size: 12px; font-weight: 600; color: #223a5e; }
.dp-input, .dp-select, .dp-textarea {
  padding: 9px 12px; border: 1.5px solid #e2e8f0; border-radius: 8px;
  font-size: 14px; color: #1e293b; font-family: inherit; outline: none;
  transition: border-color .2s, box-shadow .2s; background: #fff; width: 100%;
}
.dp-input:focus, .dp-select:focus, .dp-textarea:focus {
  border-color: #0c8b7a; box-shadow: 0 0 0 3px rgba(12,139,122,.1);
}
.dp-select { cursor: pointer; appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%2364748B' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px;
}
.dp-textarea { resize: vertical; min-height: 80px; }
.dp-fee-wrap { display: flex; align-items: center; border: 1.5px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #fff; }
.dp-fee-wrap:focus-within { border-color: #0c8b7a; box-shadow: 0 0 0 3px rgba(12,139,122,.1); }
.dp-fee-sym { padding: 9px 12px; background: #f1f5f9; color: #475569; font-weight: 700; font-size: 15px; border-right: 1.5px solid #e2e8f0; }
.dp-fee-usd { padding: 9px 10px; font-size: 11px; color: #94a3b8; white-space: nowrap; }
.dp-btn { padding: 9px 20px; border-radius: 50px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; transition: .2s; }
.dp-btn-primary { background: #0c8b7a; color: #fff; }
.dp-btn-primary:hover { background: #0a7a6b; }
.dp-btn-primary:disabled { opacity: .5; cursor: not-allowed; }
.dp-btn-secondary { background: #f1f5f9; color: #223a5e; }
.dp-btn-secondary:hover { background: #e2e8f0; }
.dp-btn-ghost { background: transparent; border: 1.5px solid #e2e8f0; color: #475569; }
.dp-btn-ghost:hover { border-color: #0c8b7a; color: #0c8b7a; }
.dp-edit-bar { display: flex; justify-content: flex-end; gap: 10px; padding-top: 24px; border-top: 1px solid #f1f5f9; margin-top: 28px; flex-wrap: wrap; }
.dp-warn { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 10px; padding: 12px 16px; font-size: 13px; color: #92400e; margin-bottom: 20px; }
.dp-success { background: #dcfce7; border: 1px solid #86efac; border-radius: 10px; padding: 12px 16px; font-size: 13px; color: #166534; margin-bottom: 20px; }
.dp-error { background: #fee2e2; border: 1px solid #fca5a5; border-radius: 10px; padding: 12px 16px; font-size: 13px; color: #991b1b; margin-bottom: 20px; }
@media (max-width: 600px) {
  .dp-grid { grid-template-columns: 1fr 1fr; }
  .dp-grid-2 { grid-template-columns: 1fr; }
}
`;

// ── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value }) {
  return (
    <div className="dp-row">
      <label>{label}</label>
      <span className={value ? "" : "empty"}>{value || "—"}</span>
    </div>
  );
}

function SectionHead({ icon, title, editing, onEdit, onSave, onCancel, saving }) {
  return (
    <div className="dp-section-head">
      <div className="dp-section-title">
        <span style={{ fontSize: 18 }}>{icon}</span>
        <h3>{title}</h3>
      </div>
      {!editing
        ? <button className="dp-btn dp-btn-ghost" style={{ fontSize: 12, padding: "5px 14px" }} onClick={onEdit}>✏️ Edit</button>
        : (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="dp-btn dp-btn-secondary" style={{ fontSize: 12, padding: "5px 14px" }} onClick={onCancel} disabled={saving}>Cancel</button>
            <button className="dp-btn dp-btn-primary" style={{ fontSize: 12, padding: "5px 14px" }} onClick={onSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )
      }
    </div>
  );
}

// ── Consultation Fee Section (dedicated PATCH — no re-approval) ──────────────
function FeeSection({ doctorId, initialFee, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [fee, setFee] = useState(initialFee ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    const val = Number(fee);
    if (fee === "" || isNaN(val) || val < 0) { setError("Enter a valid dollar amount."); return; }
    setSaving(true); setError("");
    try {
      await api.patch(`/api/doctor/enrollment/${doctorId}/consultation-fee`, { consultantFees: val });
      setSuccess(true); setEditing(false); onSaved(val);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update fee.");
    } finally { setSaving(false); }
  };

  return (
    <div className="dp-section">
      <SectionHead
        icon="💲" title="Consultation Fee"
        editing={editing}
        onEdit={() => { setFee(initialFee ?? ""); setEditing(true); setError(""); setSuccess(false); }}
        onSave={handleSave} onCancel={() => { setEditing(false); setFee(initialFee ?? ""); setError(""); }}
        saving={saving}
      />
      <div className="dp-section-body">
        {!editing ? (
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: initialFee ? "#0c8b7a" : "#94a3b8", fontFamily: "'Outfit',sans-serif" }}>
              {initialFee ? `$${initialFee}` : "—"}
            </div>
            <div style={{ fontSize: 13, color: "#64748b" }}>{initialFee ? "per consultation (USD)" : "No fee set"}</div>
            {success && <span style={{ marginLeft: "auto", fontSize: 12, color: "#166534", fontWeight: 600, background: "#dcfce7", padding: "4px 12px", borderRadius: 50 }}>✓ Saved</span>}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Updating your fee does <strong>not</strong> require re-approval.</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div className="dp-fee-wrap" style={{ maxWidth: 200 }}>
                <span className="dp-fee-sym">$</span>
                <input className="dp-input" style={{ border: "none", boxShadow: "none", borderRadius: 0 }} type="number" min="0" step="1"
                  value={fee} onChange={e => { setFee(e.target.value); setError(""); }} placeholder="e.g. 50" />
                <span className="dp-fee-usd">USD</span>
              </div>
            </div>
            {error && <p style={{ margin: 0, fontSize: 12, color: "#dc2626" }}>{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function DoctorProfile() {
  const { doctor } = useDoctorAuth();
  const [enrollment, setEnrollment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [consultantFees, setConsultantFees] = useState(null);

  // per-section edit state
  const [editSection, setEditSection] = useState(null); // "personal" | "professional" | "about" | "clinic" | "payout"
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState({ type: "", text: "" });

  useEffect(() => {
    if (!doctor) return;
    const id = doctor._id || doctor.id;
    api.get(`/api/doctor/enrollment/${id}`)
      .then(res => {
        const d = res.data || null;
        setEnrollment(d);
        setConsultantFees(d?.consultantFees ?? null);
      })
      .catch(() => setEnrollment(null))
      .finally(() => setLoading(false));
  }, [doctor]);

  const openEdit = (section) => {
    if (!enrollment) return;
    setForm({
      firstName:               enrollment.firstName || "",
      surname:                 enrollment.surname || "",
      email:                   enrollment.email || "",
      countryCode:             enrollment.countryCode || "",
      phoneNumber:             enrollment.phoneNumber || "",
      gender:                  enrollment.gender || "",
      dob:                     enrollment.dob || "",
      country:                 enrollment.country || "",
      state:                   enrollment.state || "",
      city:                    enrollment.city || "",
      zip:                     enrollment.zip || "",
      address:                 enrollment.address || "",
      languagesKnown:          (enrollment.languagesKnown || []).join(", "),
      specialization:          enrollment.specialization || "",
      subSpecialization:       enrollment.subSpecialization || "",
      qualification:           enrollment.qualification || "",
      experience:              enrollment.experience ? String(enrollment.experience) : "",
      medicalSchool:           enrollment.medicalSchool || "",
      registrationYear:        enrollment.registrationYear || "",
      medicalCouncilName:      enrollment.medicalCouncilName || "",
      medicalRegistrationNumber: enrollment.medicalRegistrationNumber || "",
      medicalLicense:          enrollment.medicalLicense || "",
      consultationMode:        enrollment.consultationMode || "",
      aboutDoctor:             enrollment.aboutDoctor || "",
      clinicName:              enrollment.clinicName || "",
      clinicAddress:           enrollment.clinicAddress || "",
      bankName:                enrollment.bankName || "",
      accountHolderName:       enrollment.accountHolderName || "",
      accountNumber:           enrollment.accountNumber || "",
      ifscCode:                enrollment.ifscCode || "",
      payoutEmail:             enrollment.payoutEmail || "",
      paypalId:                enrollment.paypalId || "",
    });
    setEditSection(section);
    setSaveMsg({ type: "", text: "" });
  };

  const closeEdit = () => { setEditSection(null); setSaveMsg({ type: "", text: "" }); };

  const handleSave = async () => {
    setSaving(true); setSaveMsg({ type: "", text: "" });
    try {
      const langArr = form.languagesKnown
        ? form.languagesKnown.split(",").map(l => l.trim()).filter(Boolean)
        : [];
      const payload = {
        doctorId: doctor._id || doctor.id,
        ...form,
        languagesKnown: langArr,
        experience: form.experience ? Number(form.experience) : undefined,
      };
      const res = await api.post("/api/doctor/enrollment", payload);
      const updated = res.data?.enrollment || null;
      setEnrollment(updated);
      if (updated?.consultantFees != null) setConsultantFees(updated.consultantFees);
      setEditSection(null);
      setSaveMsg({ type: "success", text: res.data?.message || "Profile updated." });
      setTimeout(() => setSaveMsg({ type: "", text: "" }), 5000);
    } catch (err) {
      setSaveMsg({ type: "error", text: err?.response?.data?.message || "Failed to save changes." });
    } finally { setSaving(false); }
  };

  // ── helpers ──
  const f = (key) => form[key] ?? "";
  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));
  const inp = (key, placeholder, type = "text") => (
    <input className="dp-input" type={type} placeholder={placeholder}
      value={f(key)} onChange={e => set(key, e.target.value)} />
  );
  const sel = (key, options, placeholder = "Select…") => (
    <select className="dp-select" value={f(key)} onChange={e => set(key, e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  // ── loading / no data ──
  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid #e2e8f0", borderTopColor: "#0c8b7a", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!enrollment) return (
    <div style={{ textAlign: "center", padding: "60px 24px" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
      <h3 style={{ color: "#223a5e", marginBottom: 8, fontFamily: "'Outfit',sans-serif" }}>No profile found</h3>
      <p style={{ color: "#64748b" }}>Your profile will appear here once enrollment is complete.</p>
    </div>
  );

  const fullName = `Dr. ${enrollment.firstName || ""} ${enrollment.surname || ""}`.trim();
  const initials = `${(enrollment.firstName || " ")[0]}${(enrollment.surname || " ")[0]}`.toUpperCase();
  const statusStyle = STATUS_COLORS[enrollment.approvalStatus] || STATUS_COLORS.pending;
  const locationStr = [enrollment.city, enrollment.state, enrollment.country].filter(Boolean).join(", ");
  const langStr = Array.isArray(enrollment.languagesKnown) ? enrollment.languagesKnown.join(", ") : enrollment.languagesKnown;
  const doctorId = doctor._id || doctor.id;
  const isApproved = enrollment.approvalStatus === "approved";

  return (
    <>
      <style>{CSS}</style>
      <div className="dp-root">

        {/* ── Global save/error messages ── */}
        {saveMsg.text && (
          <div className={saveMsg.type === "success" ? "dp-success" : "dp-error"}>
            {saveMsg.type === "success" ? "✓ " : "⚠ "}{saveMsg.text}
          </div>
        )}

        {/* ── Header card ── */}
        <div style={{
          background: "linear-gradient(135deg,#223a5e 0%,#0c8b7a 100%)",
          borderRadius: 16, padding: "28px 32px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap",
          boxShadow: "0 4px 16px rgba(34,58,94,0.15)",
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, fontWeight: 700, color: "#fff", fontFamily: "'Outfit',sans-serif",
            border: "3px solid rgba(255,255,255,0.4)", flexShrink: 0,
          }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 800, color: "#fff", fontFamily: "'Outfit',sans-serif" }}>{fullName}</h1>
            {(enrollment.qualification || enrollment.specialization) && (
              <p style={{ margin: "0 0 6px", fontSize: 14, color: "rgba(255,255,255,0.85)" }}>
                {[enrollment.qualification, enrollment.specialization].filter(Boolean).join(" · ")}
              </p>
            )}
            {enrollment.experience && (
              <p style={{ margin: "0 0 6px", fontSize: 13, color: "rgba(255,255,255,0.75)" }}>
                🏅 {enrollment.experience} years of experience
              </p>
            )}
            {locationStr && (
              <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>📍 {locationStr}</p>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, flexShrink: 0 }}>
            <span style={{ background: statusStyle.bg, color: statusStyle.color, padding: "5px 14px", borderRadius: 50, fontSize: 12, fontWeight: 700 }}>
              {statusStyle.label}
            </span>
            {consultantFees && (
              <span style={{ background: "rgba(255,255,255,0.15)", color: "#fff", padding: "5px 14px", borderRadius: 50, fontSize: 13, fontWeight: 700, border: "1.5px solid rgba(255,255,255,0.3)" }}>
                ${consultantFees} / visit
              </span>
            )}
          </div>
        </div>

        {/* re-approval warning shown whenever a section is open for editing */}
        {editSection && isApproved && (
          <div className="dp-warn">
            ⚠️ Saving changes will resubmit your profile for admin re-approval. You may temporarily lose dashboard access until re-approved.
          </div>
        )}

        {/* ── Consultation Fee ── */}
        <FeeSection doctorId={doctorId} initialFee={consultantFees} onSaved={setConsultantFees} />

        {/* ════ PERSONAL DETAILS ════ */}
        <div className="dp-section">
          <SectionHead icon="👤" title="Personal Details"
            editing={editSection === "personal"}
            onEdit={() => openEdit("personal")} onSave={handleSave} onCancel={closeEdit}
            saving={saving}
          />
          <div className="dp-section-body">
            {editSection !== "personal" ? (
              <div className="dp-grid">
                <InfoRow label="First Name"       value={enrollment.firstName} />
                <InfoRow label="Surname"          value={enrollment.surname} />
                <InfoRow label="Email"            value={enrollment.email} />
                <InfoRow label="Phone"            value={[enrollment.countryCode, enrollment.phoneNumber].filter(Boolean).join(" ")} />
                <InfoRow label="Gender"           value={enrollment.gender} />
                <InfoRow label="Date of Birth"    value={enrollment.dob} />
                <InfoRow label="Languages"        value={langStr} />
              </div>
            ) : (
              <div className="dp-grid-2">
                <div className="dp-field"><label>First Name</label>{inp("firstName","First name")}</div>
                <div className="dp-field"><label>Surname</label>{inp("surname","Surname")}</div>
                <div className="dp-field"><label>Email</label>{inp("email","Email","email")}</div>
                <div className="dp-field"><label>Phone</label>
                  <div style={{ display:"flex", gap:8 }}>
                    <input className="dp-input" style={{width:70,flexShrink:0}} placeholder="+1" value={f("countryCode")} onChange={e=>set("countryCode",e.target.value)} />
                    <input className="dp-input" placeholder="555-000-0000" value={f("phoneNumber")} onChange={e=>set("phoneNumber",e.target.value)} />
                  </div>
                </div>
                <div className="dp-field"><label>Gender</label>{sel("gender",GENDERS)}</div>
                <div className="dp-field"><label>Date of Birth</label><input className="dp-input" type="date" value={f("dob")} onChange={e=>set("dob",e.target.value)} /></div>
                <div className="dp-field" style={{ gridColumn:"1/-1" }}>
                  <label>Languages Known <span style={{fontWeight:400,color:"#94a3b8"}}>(comma-separated)</span></label>
                  {inp("languagesKnown","English, Hindi, Spanish…")}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ════ LOCATION ════ */}
        <div className="dp-section">
          <SectionHead icon="📍" title="Location"
            editing={editSection === "location"}
            onEdit={() => openEdit("location")} onSave={handleSave} onCancel={closeEdit}
            saving={saving}
          />
          <div className="dp-section-body">
            {editSection !== "location" ? (
              <div className="dp-grid">
                <InfoRow label="Country"         value={enrollment.country} />
                <InfoRow label="State / Region"  value={enrollment.state} />
                <InfoRow label="City"            value={enrollment.city} />
                <InfoRow label="ZIP / Postal"    value={enrollment.zip} />
                <InfoRow label="Address"         value={enrollment.address} />
              </div>
            ) : (
              <div className="dp-grid-2">
                <div className="dp-field"><label>Country</label>{sel("country",COUNTRIES)}</div>
                <div className="dp-field"><label>State / Region</label>{inp("state","e.g. California")}</div>
                <div className="dp-field"><label>City</label>{inp("city","City")}</div>
                <div className="dp-field"><label>ZIP / Postal Code</label>{inp("zip","ZIP")}</div>
                <div className="dp-field" style={{ gridColumn:"1/-1" }}><label>Street Address</label>{inp("address","Street address")}</div>
              </div>
            )}
          </div>
        </div>

        {/* ════ PROFESSIONAL DETAILS ════ */}
        <div className="dp-section">
          <SectionHead icon="🩺" title="Professional Details"
            editing={editSection === "professional"}
            onEdit={() => openEdit("professional")} onSave={handleSave} onCancel={closeEdit}
            saving={saving}
          />
          <div className="dp-section-body">
            {editSection !== "professional" ? (
              <div className="dp-grid">
                <InfoRow label="Specialization"       value={enrollment.specialization} />
                <InfoRow label="Sub-Specialization"  value={enrollment.subSpecialization} />
                <InfoRow label="Qualification"       value={enrollment.qualification} />
                <InfoRow label="Experience"          value={enrollment.experience ? `${enrollment.experience} years` : null} />
                <InfoRow label="Medical School"      value={enrollment.medicalSchool} />
                <InfoRow label="Graduation Year"     value={enrollment.registrationYear} />
                <InfoRow label="Medical Council"     value={enrollment.medicalCouncilName} />
                <InfoRow label="Reg. Number"         value={enrollment.medicalRegistrationNumber} />
                <InfoRow label="Medical License No." value={enrollment.medicalLicense} />
                {enrollment.medicalLicenseFile && (
                  <div className="dp-row" style={{ gridColumn: "1/-1" }}>
                    <label>Medical License Document</label>
                    <span style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:18 }}>📄</span>
                      <span style={{ fontWeight:500, color:"#0c8b7a" }}>{enrollment.medicalLicenseFile}</span>
                      <span style={{ fontSize:11, color:"#94a3b8", background:"#f1f5f9", padding:"2px 8px", borderRadius:50 }}>Uploaded</span>
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="dp-grid-2">
                <div className="dp-field"><label>Specialization</label>{sel("specialization",SPECIALTIES,"Select specialty…")}</div>
                <div className="dp-field"><label>Sub-Specialization</label>{inp("subSpecialization","e.g. Interventional Cardiology")}</div>
                <div className="dp-field"><label>Qualification</label>{sel("qualification",QUALIFICATIONS,"Select…")}</div>
                <div className="dp-field"><label>Years of Experience</label><input className="dp-input" type="number" min="0" value={f("experience")} onChange={e=>set("experience",e.target.value)} placeholder="e.g. 10" /></div>
                <div className="dp-field"><label>Medical School</label>{inp("medicalSchool","School name")}</div>
                <div className="dp-field"><label>Graduation Year</label>{inp("registrationYear","YYYY")}</div>
                <div className="dp-field"><label>Medical Council</label>{inp("medicalCouncilName","e.g. MCI, GMC, AMA")}</div>
                <div className="dp-field"><label>Registration Number</label>{inp("medicalRegistrationNumber","Reg. number")}</div>
                <div className="dp-field"><label>Medical License No.</label>{inp("medicalLicense","License number")}</div>
              </div>
            )}
          </div>
        </div>

        {/* ════ ABOUT ════ */}
        <div className="dp-section">
          <SectionHead icon="📝" title="About"
            editing={editSection === "about"}
            onEdit={() => openEdit("about")} onSave={handleSave} onCancel={closeEdit}
            saving={saving}
          />
          <div className="dp-section-body">
            {editSection !== "about" ? (
              <p style={{ margin: 0, fontSize: 14, color: enrollment.aboutDoctor ? "#334155" : "#94a3b8", lineHeight: 1.7, fontStyle: enrollment.aboutDoctor ? "normal" : "italic" }}>
                {enrollment.aboutDoctor || "No bio added yet."}
              </p>
            ) : (
              <div className="dp-field">
                <label>Professional Bio</label>
                <textarea className="dp-textarea" style={{ minHeight: 120 }} placeholder="Brief professional bio, areas of focus, patient care philosophy…"
                  value={f("aboutDoctor")} onChange={e=>set("aboutDoctor",e.target.value)} />
              </div>
            )}
          </div>
        </div>

        {/* ════ CLINIC / PRACTICE ════ */}
        <div className="dp-section">
          <SectionHead icon="🏥" title="Clinic / Practice"
            editing={editSection === "clinic"}
            onEdit={() => openEdit("clinic")} onSave={handleSave} onCancel={closeEdit}
            saving={saving}
          />
          <div className="dp-section-body">
            {editSection !== "clinic" ? (
              <div className="dp-grid">
                <InfoRow label="Clinic Name"    value={enrollment.clinicName} />
                <InfoRow label="Clinic Address" value={enrollment.clinicAddress} />
              </div>
            ) : (
              <div className="dp-grid-2">
                <div className="dp-field"><label>Clinic Name</label>{inp("clinicName","e.g. City Health Clinic")}</div>
                <div className="dp-field"><label>Clinic Address</label>{inp("clinicAddress","Street address of clinic")}</div>
              </div>
            )}
          </div>
        </div>

        {/* ════ PAYOUT INFORMATION ════ */}
        <div className="dp-section">
          <SectionHead icon="💳" title="Payout Information"
            editing={editSection === "payout"}
            onEdit={() => openEdit("payout")} onSave={handleSave} onCancel={closeEdit}
            saving={saving}
          />
          <div className="dp-section-body">
            {editSection !== "payout" ? (
              <div className="dp-grid">
                <InfoRow label="Bank Name"       value={enrollment.bankName} />
                <InfoRow label="Account Holder"  value={enrollment.accountHolderName} />
                <InfoRow label="Account Number"  value={enrollment.accountNumber ? `****${enrollment.accountNumber.slice(-4)}` : null} />
                <InfoRow label="SWIFT / BIC"     value={enrollment.ifscCode} />
                <InfoRow label="Payout Email"    value={enrollment.payoutEmail} />
                <InfoRow label="PayPal ID"       value={enrollment.paypalId} />
              </div>
            ) : (
              <div className="dp-grid-2">
                <div className="dp-field"><label>Bank Name</label>{inp("bankName","Bank name")}</div>
                <div className="dp-field"><label>Account Holder Name</label>{inp("accountHolderName","Full name on account")}</div>
                <div className="dp-field"><label>Account Number</label>{inp("accountNumber","Account number")}</div>
                <div className="dp-field"><label>SWIFT / BIC Code</label>{inp("ifscCode","SWIFT / BIC code")}</div>
                <div className="dp-field"><label>Payout Email</label>{inp("payoutEmail","Email for payouts","email")}</div>
                <div className="dp-field"><label>PayPal ID</label>{inp("paypalId","PayPal email or username")}</div>
              </div>
            )}
          </div>
        </div>

        {/* ── Enrollment Status ── */}
        <div style={{ background: statusStyle.bg, borderRadius: 14, padding: "20px 24px", border: `1.5px solid ${statusStyle.color}33` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 22 }}>
              {enrollment.approvalStatus === "approved" ? "✅" : enrollment.approvalStatus === "rejected" ? "❌" : "⏳"}
            </span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: statusStyle.color }}>Enrollment Status: {statusStyle.label}</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: statusStyle.color, opacity: 0.8 }}>
                {enrollment.approvalStatus === "approved" && "Your profile is live and visible to patients on the platform."}
                {enrollment.approvalStatus === "pending"  && "Your application is under review. You'll be notified once approved."}
                {enrollment.approvalStatus === "rejected" && "Your application was rejected. Update your details and save to resubmit."}
              </p>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
