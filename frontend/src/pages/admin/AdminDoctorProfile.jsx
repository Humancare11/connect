import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import api from "../../api";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const GENDERS = ["Male","Female","Others"];
const QUALIFICATIONS = ["MD","DO","NP","PA","Other"];
const CONSULTATION_MODES = ["Video Call","In-Person","Both","Phone Call"];
const CURRENCIES = ["USD","GBP","EUR","INR","AED","SAR","AUD","CAD","SGD","JPY","Other"];
const COUNTRIES = [
  "United States","United Kingdom","India","Canada","Australia","Germany","France",
  "Brazil","Mexico","South Africa","Nigeria","Kenya","UAE","Saudi Arabia","Singapore",
  "Japan","South Korea","Philippines","Pakistan","Bangladesh","Sri Lanka","Nepal","Other"
];
const SPECIALTIES = [
  "General Practice","Internal Medicine","Cardiology","Dermatology","Endocrinology",
  "Gastroenterology","Neurology","Oncology","Ophthalmology","Orthopedics","Pediatrics",
  "Psychiatry","Pulmonology","Radiology","Surgery","Urology","OB/GYN","Emergency Medicine",
  "Anesthesiology","Pathology","Other"
];

const STATUS_META = {
  approved:       { label: "Approved",       bg: "#dcfce7", color: "#166534" },
  rejected:       { label: "Rejected",       bg: "#fee2e2", color: "#991b1b" },
  submitted:      { label: "Submitted",      bg: "#ede9fe", color: "#5b21b6" },
  pending_review: { label: "Pending Review", bg: "#fef3c7", color: "#92400e" },
  in_progress:    { label: "In Progress",    bg: "#eff6ff", color: "#1d4ed8" },
};
const REQUEST_META = {
  none:            { label: "No Active Request",        bg: "#f8fafc", color: "#64748b" },
  new_enrollment:  { label: "New Enrollment",           bg: "#eff6ff", color: "#1d4ed8" },
  profile_update:  { label: "Profile Update Request",   bg: "#fef3c7", color: "#92400e" },
  profile_delete:  { label: "Profile Delete Request",   bg: "#fee2e2", color: "#991b1b" },
};
const STEP_LABELS = ["Identity","Professional","Availability","Payout","Submitted"];

function getProgress(e) {
  if (!e) return { completedSteps: 0, currentStep: 1, status: "in_progress" };
  const completedSteps = Math.max(0, Math.min(5, Number(e.completedSteps) || 0));
  const currentStep    = Math.max(1, Math.min(5, Number(e.currentStep)    || 1));
  const status         = e.applicationStatus || (e.approvalStatus === "approved" ? "approved" : e.approvalStatus === "rejected" ? "rejected" : e.formCompleted ? "submitted" : completedSteps >= 4 ? "pending_review" : "in_progress");
  return { completedSteps, currentStep, status, currentStepLabel: e.currentStepLabel || STEP_LABELS[Math.max(0, currentStep - 1)] };
}
function getRequestType(e) {
  if (!e) return "none";
  if (e.profileDeleteRequestStatus === "pending") return "profile_delete";
  if (e.pendingRequestType === "profile_delete")  return "profile_delete";
  if (e.pendingRequestType === "profile_update")  return "profile_update";
  if (e.pendingRequestType === "new_enrollment")  return "new_enrollment";
  return "none";
}

/* ── Section wrapper ── */
function Section({ icon, title, children }) {
  return (
    <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:14, overflow:"hidden", marginBottom:20 }}>
      <div style={{ padding:"14px 22px", borderBottom:"1px solid #f1f5f9", display:"flex", alignItems:"center", gap:10, background:"#f8fafc" }}>
        <span style={{ fontSize:18 }}>{icon}</span>
        <h4 style={{ margin:0, fontSize:14, fontWeight:700, color:"#223a5e" }}>{title}</h4>
      </div>
      <div style={{ padding:"18px 22px" }}>{children}</div>
    </div>
  );
}
/* ── Field display ── */
function Field({ label, value, full }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:3, gridColumn: full ? "1/-1" : undefined }}>
      <span style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.05em" }}>{label}</span>
      <span style={{ fontSize:14, color: value ? "#0f172a" : "#cbd5e1", fontStyle: value ? "normal" : "italic" }}>{value || "—"}</span>
    </div>
  );
}
/* ── Document item ── */
function DocItem({ label, filename }) {
  const isUrl = Boolean(filename && (filename.startsWith("http://") || filename.startsWith("https://")));
  const displayName = isUrl
    ? decodeURIComponent(filename.split("/").pop()).replace(/^\d{10,}-\d+-/, "") || "document"
    : filename;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12, padding:"16px 18px",
      background: isUrl ? "#f0fdf4" : filename ? "#f8fafc" : "#fafafa",
      border:`1.5px solid ${isUrl ? "#86efac" : "#e2e8f0"}`, borderRadius:12 }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
        <span style={{ fontSize:24, lineHeight:1, flexShrink:0, marginTop:2 }}>{isUrl ? "📄" : filename ? "📋" : "📂"}</span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>{label}</div>
          <div style={{ fontSize:13, color: filename ? "#1e293b" : "#94a3b8", fontStyle: filename ? "normal" : "italic", wordBreak:"break-all", lineHeight:1.5 }}>
            {filename ? displayName : "Not uploaded"}
          </div>
        </div>
        {isUrl && <span style={{ fontSize:11, background:"#dcfce7", color:"#166534", padding:"3px 10px", borderRadius:50, fontWeight:700, flexShrink:0 }}>✓ Submitted</span>}
        {filename && !isUrl && <span style={{ fontSize:11, background:"#fef9c3", color:"#854d0e", padding:"3px 10px", borderRadius:50, fontWeight:700, flexShrink:0 }}>⚠ No link</span>}
      </div>
      {isUrl ? (
        <a href={filename} target="_blank" rel="noopener noreferrer"
          style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:7, padding:"9px 14px", background:"#2563eb", color:"#fff", borderRadius:8, fontSize:13, fontWeight:700, textDecoration:"none" }}
          onMouseEnter={e => e.currentTarget.style.background="#1d4ed8"}
          onMouseLeave={e => e.currentTarget.style.background="#2563eb"}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          View Document
        </a>
      ) : filename ? (
        <div style={{ fontSize:12, color:"#92400e", background:"#fef3c7", padding:"8px 12px", borderRadius:7, lineHeight:1.5 }}>
          File name recorded but was not uploaded to server. Doctor needs to re-upload.
        </div>
      ) : (
        <div style={{ fontSize:12, color:"#94a3b8", padding:"6px 0", textAlign:"center", fontStyle:"italic" }}>— no document provided —</div>
      )}
    </div>
  );
}
/* ── Progress bar ── */
function ProgressBar({ progress }) {
  const color = progress.status === "approved" ? "#16a34a" : progress.status === "rejected" ? "#ef4444" : "#2563eb";
  return (
    <div>
      <div style={{ display:"flex", gap:4, marginBottom:6 }}>
        {STEP_LABELS.map((label, idx) => {
          const stepNo = idx + 1;
          const done   = stepNo <= progress.completedSteps;
          const active = stepNo === progress.currentStep && !done;
          return <div key={label} title={`Step ${stepNo}: ${label}`}
            style={{ flex:1, height:7, borderRadius:4, background: done ? color : active ? "#fbbf24" : "#e2e8f0", transition:"all 0.3s" }} />;
        })}
      </div>
      <div style={{ display:"flex", justifyContent:"space-between" }}>
        <span style={{ fontSize:11, fontWeight:700, color:"#64748b" }}>{progress.completedSteps}/5 STEPS COMPLETED</span>
        <span style={{ fontSize:11, color:"#94a3b8" }}>Current: {progress.currentStepLabel}</span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════
   EDIT MODAL
════════════════════════════════════ */
function EditModal({ enrollment, onClose, onSaved, showToast }) {
  const e = enrollment;
  const [data, setData] = useState({
    firstName:               e.firstName || "",
    surname:                 e.surname || "",
    gender:                  e.gender || "",
    dob:                     e.dob || "",
    email:                   e.email || e.doctorId?.email || "",
    countryCode:             e.countryCode || "",
    phoneNumber:             e.phoneNumber || "",
    country:                 e.country || "",
    state:                   e.state || "",
    city:                    e.city || "",
    zip:                     e.zip || "",
    address:                 e.address || "",
    specialization:          e.specialization || "",
    subSpecialization:       e.subSpecialization || "",
    qualification:           e.qualification || "",
    experience:              e.experience ? String(e.experience) : "",
    medicalSchool:           e.medicalSchool || "",
    registrationYear:        e.registrationYear || "",
    medicalCouncilName:      e.medicalCouncilName || "",
    medicalRegistrationNumber: e.medicalRegistrationNumber || "",
    medicalLicense:          e.medicalLicense || "",
    consultationMode:        e.consultationMode || "",
    consultantFees:          e.consultantFees ? String(e.consultantFees) : "",
    feeCurrency:             e.feeCurrency || "USD",
    clinicName:              e.clinicName || "",
    clinicAddress:           e.clinicAddress || "",
    aboutDoctor:             e.aboutDoctor || "",
    languagesKnown:          Array.isArray(e.languagesKnown) ? e.languagesKnown.join(", ") : (e.languagesKnown || ""),
    bankName:                e.bankName || "",
    accountHolderName:       e.accountHolderName || "",
    accountNumber:           e.accountNumber || "",
    ifscCode:                e.ifscCode || "",
    paypalId:                e.paypalId || "",
    payoutEmail:             e.payoutEmail || "",
  });
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState("");

  const f = (k) => (v) => setData(p => ({ ...p, [k]: typeof v === "string" ? v : v.target.value }));

  const handleSave = async () => {
    setBusy(true); setError("");
    try {
      const payload = {
        ...data,
        experience:    data.experience    ? Number(data.experience)    : undefined,
        consultantFees: data.consultantFees ? Number(data.consultantFees) : undefined,
        languagesKnown: data.languagesKnown
          ? data.languagesKnown.split(",").map(l => l.trim()).filter(Boolean)
          : [],
      };
      const res = await api.put(`/api/admin/doctors/${e._id}`, payload);
      onSaved(res.data.enrollment);
      showToast("Doctor profile updated successfully.");
      onClose();
    } catch (err) {
      setError(err?.response?.data?.msg || "Failed to save. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // Shared styles
  const INP = { padding:"9px 12px", border:"1.5px solid #e2e8f0", borderRadius:8, fontSize:14, fontFamily:"inherit", color:"#0f172a", outline:"none", width:"100%", boxSizing:"border-box", transition:"border-color 0.2s" };
  const SEL = { ...INP, cursor:"pointer", background:"#fff", appearance:"none",
    backgroundImage:"url(\"data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%2364748B' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
    backgroundRepeat:"no-repeat", backgroundPosition:"right 12px center", paddingRight:32 };
  const TA  = { ...INP, resize:"vertical", minHeight:80 };
  const LBL = { display:"block", fontSize:12, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.04em", marginBottom:5 };
  const G2  = { display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px 20px", marginBottom:8 };
  const SEC = { fontSize:13, fontWeight:700, color:"#1e293b", padding:"10px 0 8px", borderBottom:"2px solid #f1f5f9", marginBottom:16, marginTop:24, display:"flex", alignItems:"center", gap:8 };

  const FG = ({ label, children, full }) => (
    <div style={{ display:"flex", flexDirection:"column", gap:4, gridColumn: full ? "1/-1" : undefined }}>
      <label style={LBL}>{label}</label>
      {children}
    </div>
  );

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.65)", zIndex:2000,
      display:"flex", alignItems:"flex-start", justifyContent:"center",
      overflowY:"auto", padding:"20px 12px 60px" }}
      onClick={ev => { if (ev.target === ev.currentTarget) onClose(); }}>
      <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:820,
        boxShadow:"0 24px 80px rgba(0,0,0,0.25)", marginTop:20 }}>

        {/* Header */}
        <div style={{ padding:"20px 28px", borderBottom:"1px solid #e2e8f0", display:"flex",
          alignItems:"center", justifyContent:"space-between",
          position:"sticky", top:0, background:"#fff", zIndex:10,
          borderRadius:"16px 16px 0 0" }}>
          <div>
            <h2 style={{ margin:0, fontSize:18, fontWeight:800, color:"#0f172a" }}>✏️ Edit Doctor Profile</h2>
            <p style={{ margin:"3px 0 0", fontSize:13, color:"#64748b" }}>
              {`Dr. ${e.firstName || ""} ${e.surname || ""}`.trim() || "Doctor"} — changes save directly to the database.
            </p>
          </div>
          <button onClick={onClose} style={{ background:"#f1f5f9", border:"none", width:36, height:36,
            borderRadius:"50%", cursor:"pointer", fontSize:20, color:"#64748b",
            display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding:"4px 28px 28px" }}>

          {/* ── Personal ── */}
          <div style={SEC}>👤 Personal Information</div>
          <div style={G2}>
            <FG label="First Name"><input style={INP} value={data.firstName} onChange={f("firstName")} placeholder="First name" /></FG>
            <FG label="Last Name / Surname"><input style={INP} value={data.surname} onChange={f("surname")} placeholder="Surname" /></FG>
            <FG label="Gender">
              <select style={SEL} value={data.gender} onChange={f("gender")}>
                <option value="">Select…</option>
                {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </FG>
            <FG label="Date of Birth"><input style={INP} type="date" value={data.dob} onChange={f("dob")} /></FG>
            <FG label="Email"><input style={INP} type="email" value={data.email} onChange={f("email")} placeholder="doctor@email.com" /></FG>
            <FG label="Phone Number">
              <div style={{ display:"flex", gap:8 }}>
                <input style={{ ...INP, width:80, flexShrink:0 }} value={data.countryCode} onChange={f("countryCode")} placeholder="+1" />
                <input style={{ ...INP, flex:1 }} value={data.phoneNumber} onChange={f("phoneNumber")} placeholder="Phone number" />
              </div>
            </FG>
          </div>

          {/* ── Location ── */}
          <div style={SEC}>📍 Location</div>
          <div style={G2}>
            <FG label="Country">
              <select style={SEL} value={data.country} onChange={f("country")}>
                <option value="">Select country…</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FG>
            <FG label="State / Province"><input style={INP} value={data.state} onChange={f("state")} placeholder="State or province" /></FG>
            <FG label="City"><input style={INP} value={data.city} onChange={f("city")} placeholder="City" /></FG>
            <FG label="ZIP / Postal Code"><input style={INP} value={data.zip} onChange={f("zip")} placeholder="ZIP or postal code" /></FG>
            <FG label="Street Address" full><input style={INP} value={data.address} onChange={f("address")} placeholder="Full street address" /></FG>
          </div>

          {/* ── Professional ── */}
          <div style={SEC}>🩺 Professional Details</div>
          <div style={G2}>
            <FG label="Specialization">
              <select style={SEL} value={data.specialization} onChange={f("specialization")}>
                <option value="">Select…</option>
                {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FG>
            <FG label="Sub-Specialization"><input style={INP} value={data.subSpecialization} onChange={f("subSpecialization")} placeholder="e.g. Interventional Cardiology" /></FG>
            <FG label="Qualification">
              <select style={SEL} value={data.qualification} onChange={f("qualification")}>
                <option value="">Select…</option>
                {QUALIFICATIONS.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </FG>
            <FG label="Years of Experience">
              <input style={INP} type="text" inputMode="numeric" value={data.experience}
                onChange={e => f("experience")(e.target.value.replace(/[^0-9]/g,""))}
                placeholder="e.g. 10" />
            </FG>
            <FG label="Medical School"><input style={INP} value={data.medicalSchool} onChange={f("medicalSchool")} placeholder="School name" /></FG>
            <FG label="Graduation Year"><input style={INP} value={data.registrationYear} onChange={f("registrationYear")} placeholder="YYYY" /></FG>
            <FG label="Medical Council Name"><input style={INP} value={data.medicalCouncilName} onChange={f("medicalCouncilName")} placeholder="e.g. MCI, GMC, AMA" /></FG>
            <FG label="Reg. Number / NPI"><input style={INP} value={data.medicalRegistrationNumber} onChange={f("medicalRegistrationNumber")} placeholder="Registration or NPI" /></FG>
            <FG label="Medical License No."><input style={INP} value={data.medicalLicense} onChange={f("medicalLicense")} placeholder="License number" /></FG>
            <FG label="Consultation Mode">
              <select style={SEL} value={data.consultationMode} onChange={f("consultationMode")}>
                <option value="">Select…</option>
                {CONSULTATION_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </FG>
            <FG label="Consultation Fee">
              <div style={{ display:"flex", gap:0, border:"1.5px solid #e2e8f0", borderRadius:8, overflow:"hidden" }}>
                <select value={data.feeCurrency} onChange={f("feeCurrency")}
                  style={{ padding:"9px 8px", background:"#f8fafc", border:"none", borderRight:"1.5px solid #e2e8f0", fontFamily:"inherit", fontSize:13, fontWeight:700, cursor:"pointer", flexShrink:0, outline:"none" }}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input style={{ ...INP, border:"none", borderRadius:0, flex:1 }} type="number" min="0" step="1"
                  value={data.consultantFees} onChange={f("consultantFees")} placeholder="500" />
              </div>
            </FG>
            <FG label="Clinic Name"><input style={INP} value={data.clinicName} onChange={f("clinicName")} placeholder="Clinic or practice name" /></FG>
            <FG label="Clinic Address" full><input style={INP} value={data.clinicAddress} onChange={f("clinicAddress")} placeholder="Clinic address" /></FG>
            <FG label="About Doctor" full><textarea style={TA} value={data.aboutDoctor} onChange={f("aboutDoctor")} placeholder="Professional bio, areas of focus…" /></FG>
          </div>

          {/* ── Languages ── */}
          <div style={SEC}>🌐 Languages</div>
          <div style={{ marginBottom:8 }}>
            <FG label="Languages Known (comma-separated)">
              <input style={INP} value={data.languagesKnown} onChange={f("languagesKnown")} placeholder="English, Hindi, French…" />
              <span style={{ fontSize:11, color:"#94a3b8", marginTop:3 }}>Separate multiple languages with commas.</span>
            </FG>
          </div>

          {/* ── Payout ── */}
          <div style={SEC}>💳 Payout Information</div>
          <div style={G2}>
            <FG label="Bank Name"><input style={INP} value={data.bankName} onChange={f("bankName")} placeholder="Bank name" /></FG>
            <FG label="Account Holder Name"><input style={INP} value={data.accountHolderName} onChange={f("accountHolderName")} placeholder="Full name on account" /></FG>
            <FG label="Account Number"><input style={INP} value={data.accountNumber} onChange={f("accountNumber")} placeholder="Account number" /></FG>
            <FG label="SWIFT / IFSC / BIC"><input style={INP} value={data.ifscCode} onChange={f("ifscCode")} placeholder="SWIFT or routing code" /></FG>
            <FG label="PayPal ID"><input style={INP} value={data.paypalId} onChange={f("paypalId")} placeholder="PayPal email or username" /></FG>
            <FG label="Payout Email"><input style={INP} type="email" value={data.payoutEmail} onChange={f("payoutEmail")} placeholder="Payout email address" /></FG>
          </div>

          {/* Error */}
          {error && (
            <div style={{ padding:"12px 16px", background:"#fff1f2", border:"1px solid #fecdd3", borderRadius:8, color:"#be123c", fontSize:13, fontWeight:600, marginTop:4 }}>
              ⚠️ {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display:"flex", gap:12, justifyContent:"flex-end", marginTop:24, paddingTop:20, borderTop:"1px solid #e2e8f0" }}>
            <button onClick={onClose} disabled={busy}
              style={{ padding:"10px 24px", borderRadius:8, border:"1.5px solid #e2e8f0", background:"#fff", color:"#334155", fontWeight:600, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={busy}
              style={{ padding:"10px 28px", borderRadius:8, border:"none", background: busy ? "#93c5fd" : "#2563eb", color:"#fff", fontWeight:700, fontSize:14, cursor: busy ? "not-allowed" : "pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:8 }}>
              {busy ? "Saving…" : "💾 Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════
   MAIN PAGE
════════════════════════════════════ */
export default function AdminDoctorProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [enrollment, setEnrollment] = useState(location.state?.enrollment || null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [toast,      setToast]      = useState(null);
  const [busy,       setBusy]       = useState(false);
  const [editMode,   setEditMode]   = useState(false);

  const from     = location.state?.from || "manage-doctors";
  const backPath = from === "our-doctors" ? "/admin-dashboard/our-doctors" : "/admin-dashboard/manage-doctors";

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    setLoading(true); setError("");
    api.get(`/api/admin/doctors/${id}`)
      .then(res => setEnrollment(res.data))
      .catch(() => setError("Failed to load doctor profile. The record may not exist."))
      .finally(() => setLoading(false));
  }, [id]);

  const refresh = useCallback(async () => {
    try { const res = await api.get(`/api/admin/doctors/${id}`); setEnrollment(res.data); } catch {}
  }, [id]);

  const handleApprove = async () => {
    if (!enrollment) return; setBusy(true);
    try {
      const res = await api.put(`/api/admin/doctors/${enrollment._id}/approve`, {});
      setEnrollment(res.data?.enrollment || enrollment);
      showToast("Doctor approved successfully.");
    } catch (err) { showToast(err?.response?.data?.msg || "Approve failed.", false); }
    finally { setBusy(false); }
  };
  const handleReject = async () => {
    if (!enrollment) return; setBusy(true);
    try {
      const res = await api.put(`/api/admin/doctors/${enrollment._id}/reject`, {});
      setEnrollment(res.data?.enrollment || enrollment);
      showToast("Doctor rejected.");
    } catch (err) { showToast(err?.response?.data?.msg || "Reject failed.", false); }
    finally { setBusy(false); }
  };
  const handleApproveDelete = async () => {
    if (!enrollment) return;
    if (!window.confirm("This will permanently delete the doctor's profile. Proceed?")) return;
    setBusy(true);
    try {
      await api.put(`/api/admin/doctors/${enrollment._id}/delete/approve`, {});
      showToast("Doctor profile deleted.");
      setTimeout(() => navigate(backPath), 1500);
    } catch (err) { showToast(err?.response?.data?.msg || "Delete approval failed.", false); }
    finally { setBusy(false); }
  };
  const handleRejectDelete = async () => {
    if (!enrollment) return; setBusy(true);
    try {
      const res = await api.put(`/api/admin/doctors/${enrollment._id}/delete/reject`, {});
      setEnrollment(res.data?.enrollment || enrollment);
      showToast("Delete request rejected.");
    } catch (err) { showToast(err?.response?.data?.msg || "Delete rejection failed.", false); }
    finally { setBusy(false); }
  };

  /* ── Render states ── */
  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:300, flexDirection:"column", gap:14 }}>
      <div className="adp-spinner" />
      <p style={{ color:"#64748b", fontSize:14 }}>Loading doctor profile…</p>
    </div>
  );
  if (error || !enrollment) return (
    <div style={{ textAlign:"center", padding:"60px 20px" }}>
      <div style={{ fontSize:40, marginBottom:16 }}>⚠️</div>
      <h3 style={{ color:"#334155", marginBottom:8 }}>{error || "Doctor not found"}</h3>
      <button className="adp-btn adp-btn--view" onClick={() => navigate(backPath)}>← Back to List</button>
    </div>
  );

  const e           = enrollment;
  const progress    = getProgress(e);
  const requestType = getRequestType(e);
  const statusMeta  = STATUS_META[progress.status] || STATUS_META.in_progress;
  const requestMeta = REQUEST_META[requestType] || REQUEST_META.none;
  const fullName    = `Dr. ${e.firstName || ""} ${e.surname || ""}`.trim() || e.doctorId?.name || "Unknown Doctor";
  const initials    = `${(e.firstName || e.doctorId?.name || "D")[0]}${(e.surname || " ")[0]}`.toUpperCase();
  const phone       = [e.countryCode, e.phoneNumber].filter(Boolean).join(" ");
  const location_   = [e.city, e.state, e.country].filter(Boolean).join(", ");
  const langs       = Array.isArray(e.languagesKnown) ? e.languagesKnown.join(", ") : (e.languagesKnown || "");
  const canApprove  = e.approvalStatus !== "approved" && (progress.completedSteps >= 4 || e.approvalStatus === "rejected");

  return (
    <div style={{ maxWidth:980, margin:"0 auto", paddingBottom:40 }}>

      {/* Toast */}
      {toast && (
        <div className={`adp-toast ${toast.ok ? "adp-toast--ok" : "adp-toast--err"}`}>
          <span>{toast.ok ? "✓" : "!"}</span> {toast.msg}
        </div>
      )}

      {/* Edit Modal */}
      {editMode && (
        <EditModal
          enrollment={enrollment}
          onClose={() => setEditMode(false)}
          onSaved={setEnrollment}
          showToast={showToast}
        />
      )}

      {/* ── Top nav ── */}
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:24 }}>
        <button onClick={() => navigate(backPath)}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:8, border:"1.5px solid #e2e8f0", background:"#fff", color:"#334155", fontWeight:600, fontSize:13, cursor:"pointer" }}>
          ← Back
        </button>
        <div>
          <div style={{ fontSize:12, color:"#94a3b8", fontWeight:600 }}>DOCTOR PROFILE</div>
          <h1 style={{ margin:0, fontSize:20, fontWeight:800, color:"#0f172a" }}>{fullName}</h1>
        </div>
      </div>

      {/* ── Hero card ── */}
      <div style={{ background:"linear-gradient(135deg,#1e3a5f 0%,#1d4ed8 100%)", borderRadius:16, padding:"24px 28px", marginBottom:24, display:"flex", alignItems:"flex-start", gap:20, flexWrap:"wrap" }}>
        {/* Avatar — shows profile photo if available, else text initials */}
        <div style={{ width:72, height:72, borderRadius:"50%", overflow:"hidden", border:"2.5px solid rgba(255,255,255,0.5)", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(255,255,255,0.18)" }}>
          {e.profilePhoto ? (
            <img src={e.profilePhoto} alt={fullName} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
          ) : (
            <span style={{ fontSize:26, fontWeight:800, color:"#fff" }}>{initials}</span>
          )}
        </div>
        <div style={{ flex:1, minWidth:200 }}>
          <div style={{ fontSize:22, fontWeight:800, color:"#fff", marginBottom:4 }}>{fullName}</div>
          {(e.qualification || e.specialization) && (
            <div style={{ fontSize:14, color:"rgba(255,255,255,0.85)", marginBottom:4 }}>
              {[e.qualification, e.specialization].filter(Boolean).join(" · ")}
            </div>
          )}
          {e.experience && <div style={{ fontSize:13, color:"rgba(255,255,255,0.75)", marginBottom:2 }}>🏅 {e.experience} years experience</div>}
          {location_ && <div style={{ fontSize:13, color:"rgba(255,255,255,0.7)" }}>📍 {location_}</div>}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8, alignItems:"flex-end" }}>
          <span style={{ background: statusMeta.bg, color: statusMeta.color, padding:"5px 14px", borderRadius:50, fontSize:12, fontWeight:700 }}>{statusMeta.label}</span>
          <span style={{ background: requestMeta.bg, color: requestMeta.color, padding:"5px 14px", borderRadius:50, fontSize:12, fontWeight:700 }}>{requestMeta.label}</span>
          {e.doctorId?.doctorId && (
            <span style={{ background:"rgba(255,255,255,0.15)", color:"#fff", padding:"5px 14px", borderRadius:50, fontSize:12, fontWeight:700, border:"1px solid rgba(255,255,255,0.3)" }}>
              ID: {e.doctorId.doctorId}
            </span>
          )}
        </div>
      </div>

      {/* ── Progress & actions row ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:20, marginBottom:24, alignItems:"start" }}>
        <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:14, padding:"18px 22px" }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#64748b", marginBottom:10 }}>ENROLLMENT PROGRESS</div>
          <ProgressBar progress={progress} />
        </div>
        <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:14, padding:"18px 22px", display:"flex", flexDirection:"column", gap:10, minWidth:190 }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#64748b", marginBottom:4 }}>ADMIN ACTIONS</div>
          {/* Edit button — always available */}
          <button onClick={() => setEditMode(true)}
            style={{ padding:"9px 16px", borderRadius:8, border:"1.5px solid #2563eb", background:"#eff6ff", color:"#1d4ed8", fontWeight:700, fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:7, width:"100%" }}>
            ✏️ Edit Profile
          </button>

          {requestType === "profile_delete" ? (
            <>
              <button className="adp-btn adp-btn--approve" style={{ width:"100%", justifyContent:"center" }} onClick={handleApproveDelete} disabled={busy}>{busy ? "Processing…" : "Approve Delete"}</button>
              <button className="adp-btn adp-btn--reject"  style={{ width:"100%", justifyContent:"center" }} onClick={handleRejectDelete}  disabled={busy}>{busy ? "Processing…" : "Reject Delete"}</button>
            </>
          ) : (
            <>
              {canApprove && (
                <button className="adp-btn adp-btn--approve" style={{ width:"100%", justifyContent:"center" }} onClick={handleApprove} disabled={busy}>{busy ? "Processing…" : "✓ Approve"}</button>
              )}
              {e.approvalStatus !== "rejected" && (
                <button className="adp-btn adp-btn--reject" style={{ width:"100%", justifyContent:"center" }} onClick={handleReject} disabled={busy}>{busy ? "Processing…" : "✕ Reject"}</button>
              )}
              {!canApprove && e.approvalStatus === "approved" && (
                <span style={{ fontSize:13, color:"#16a34a", fontWeight:600, textAlign:"center" }}>✓ Approved</span>
              )}
            </>
          )}
          <button onClick={refresh}
            style={{ padding:"7px 14px", borderRadius:8, border:"1.5px solid #e2e8f0", background:"#f8fafc", color:"#64748b", fontWeight:600, fontSize:12, cursor:"pointer" }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* ── Personal & Contact ── */}
      <Section icon="👤" title="Personal & Contact Details">
        {/* Profile photo row */}
        {e.profilePhoto ? (
          <div style={{ display:"flex", alignItems:"center", gap:16, padding:"14px 18px", background:"#f0fdf4", border:"1px solid #86efac", borderRadius:10, marginBottom:18 }}>
            <img src={e.profilePhoto} alt={fullName}
              style={{ width:72, height:72, borderRadius:"50%", objectFit:"cover", border:"2.5px solid #16a34a", flexShrink:0 }} />
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:"#166534" }}>✅ Profile Photo Uploaded</div>
              <a href={e.profilePhoto} target="_blank" rel="noopener noreferrer"
                style={{ fontSize:12, color:"#2563eb", textDecoration:"none", marginTop:3, display:"inline-block" }}>
                View full size →
              </a>
            </div>
          </div>
        ) : (
          <div style={{ padding:"12px 16px", background:"#fafafa", border:"1px dashed #e2e8f0", borderRadius:10, marginBottom:18, fontSize:13, color:"#94a3b8", fontStyle:"italic" }}>
            📷 No profile photo uploaded yet.
          </div>
        )}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:"16px 24px" }}>
          <Field label="First Name"    value={e.firstName} />
          <Field label="Surname"       value={e.surname} />
          <Field label="Email"         value={e.email || e.doctorId?.email} />
          <Field label="Mobile"        value={phone} />
          <Field label="Gender"        value={e.gender} />
          <Field label="Date of Birth" value={e.dob} />
          <Field label="Languages"     value={langs} full={langs?.length > 40} />
        </div>
      </Section>

      {/* ── Location ── */}
      <Section icon="📍" title="Location">
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:"16px 24px" }}>
          <Field label="Country"        value={e.country} />
          <Field label="State"          value={e.state} />
          <Field label="City"           value={e.city} />
          <Field label="ZIP / Postal"   value={e.zip} />
          <Field label="Street Address" value={e.address} full />
        </div>
      </Section>

      {/* ── Professional ── */}
      <Section icon="🩺" title="Professional Details">
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:"16px 24px" }}>
          <Field label="Specialization"      value={e.specialization} />
          <Field label="Sub-Specialization"  value={e.subSpecialization} />
          <Field label="Qualification"       value={e.qualification} />
          <Field label="Experience"          value={e.experience ? `${e.experience} years` : ""} />
          <Field label="Medical School"      value={e.medicalSchool} />
          <Field label="Graduation Year"     value={e.registrationYear} />
          <Field label="Medical Council"     value={e.medicalCouncilName} />
          <Field label="Reg. Number / NPI"   value={e.medicalRegistrationNumber} />
          <Field label="Medical License No." value={e.medicalLicense} />
          <Field label="Consultation Mode"   value={e.consultationMode} />
          <Field label="Consultation Fee"    value={e.consultantFees ? `${e.feeCurrency || "USD"} ${e.consultantFees}` : ""} />
        </div>
        {(e.clinicName || e.clinicAddress) && (
          <div style={{ marginTop:16, paddingTop:16, borderTop:"1px solid #f1f5f9" }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10 }}>Clinic / Practice</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:"16px 24px" }}>
              <Field label="Clinic Name"    value={e.clinicName} />
              <Field label="Clinic Address" value={e.clinicAddress} full />
            </div>
          </div>
        )}
        {e.aboutDoctor && (
          <div style={{ marginTop:16, paddingTop:16, borderTop:"1px solid #f1f5f9" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8 }}>About Doctor</div>
            <p style={{ margin:0, fontSize:14, color:"#334155", lineHeight:1.7 }}>{e.aboutDoctor}</p>
          </div>
        )}
      </Section>

      {/* ── Documents ── */}
      <Section icon="📋" title="Submitted Documents">
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14 }}>
          <DocItem label="Government ID / Nationality Proof"  filename={e.idProof} />
          <DocItem label="Medical Degree Certificate"         filename={e.degreeFile} />
          <DocItem label="Medical License Document"           filename={e.medicalLicenseFile} />
          <DocItem label="Malpractice Insurance License"      filename={e.malpracticeInsuranceFile} />
        </div>
      </Section>

      {/* ── Availability ── */}
      <Section icon="🗓️" title="Availability Schedule">
        {e.timezone && (
          <div style={{ marginBottom:14, padding:"8px 14px", background:"#eff6ff", borderRadius:8, display:"inline-flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:12 }}>🕐</span>
            <span style={{ fontSize:13, fontWeight:600, color:"#1d4ed8" }}>Timezone: {e.timezone}</span>
          </div>
        )}
        {e.availability && typeof e.availability === "object" && Object.keys(e.availability).length > 0 ? (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:10 }}>
            {DAYS.map(day => {
              const d = e.availability[day]; if (!d) return null;
              return (
                <div key={day} style={{ padding:"12px 16px", borderRadius:10, border:`1.5px solid ${d.enabled ? "#bfdbfe" : "#e2e8f0"}`, background: d.enabled ? "#eff6ff" : "#f8fafc" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: d.enabled ? 8 : 0 }}>
                    <span style={{ fontWeight:700, fontSize:13, color: d.enabled ? "#1d4ed8" : "#94a3b8" }}>{day}</span>
                    <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:50, background: d.enabled ? "#dcfce7" : "#f1f5f9", color: d.enabled ? "#166534" : "#94a3b8" }}>
                      {d.enabled ? "Available" : "Off"}
                    </span>
                  </div>
                  {d.enabled && Array.isArray(d.blocks) && d.blocks.map((b, i) => (
                    <div key={i} style={{ fontSize:12, color:"#334155", fontWeight:500, marginTop:4 }}>{b.start} – {b.end}</div>
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ color:"#94a3b8", fontSize:14, fontStyle:"italic" }}>No availability schedule submitted.</p>
        )}
      </Section>

      {/* ── Payout ── */}
      <Section icon="💳" title="Payout Information">
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:"16px 24px" }}>
          <Field label="Bank Name"      value={e.bankName} />
          <Field label="Account Holder" value={e.accountHolderName} />
          <Field label="Account Number" value={e.accountNumber ? `****${String(e.accountNumber).slice(-4)}` : ""} />
          <Field label="SWIFT / BIC"    value={e.ifscCode} />
          <Field label="PayPal ID"      value={e.paypalId} />
          <Field label="Payout Email"   value={e.payoutEmail} />
        </div>
      </Section>

      {/* ── Profile Delete Request ── */}
      {requestType === "profile_delete" && (
        <Section icon="🗑️" title="Profile Delete Request">
          <div style={{ background:"#fff7f7", border:"1px solid #fecaca", borderRadius:10, padding:"14px 18px" }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:"12px 24px" }}>
              <Field label="Requested At" value={e.profileDeleteRequestedAt ? new Date(e.profileDeleteRequestedAt).toLocaleString() : ""} />
              <Field label="Reason"       value={e.profileDeleteReason} full />
            </div>
          </div>
        </Section>
      )}

      {/* ── Bottom action bar ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"18px 22px", background:"#fff", border:"1px solid #e2e8f0", borderRadius:14 }}>
        <button onClick={() => navigate(backPath)}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 20px", borderRadius:8, border:"1.5px solid #e2e8f0", background:"#fff", color:"#334155", fontWeight:600, fontSize:13, cursor:"pointer" }}>
          ← Back to List
        </button>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <button onClick={() => setEditMode(true)}
            style={{ padding:"9px 20px", borderRadius:8, border:"1.5px solid #2563eb", background:"#eff6ff", color:"#1d4ed8", fontWeight:700, fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
            ✏️ Edit Profile
          </button>
          {requestType === "profile_delete" ? (
            <>
              <button className="adp-btn adp-btn--approve" onClick={handleApproveDelete} disabled={busy}>{busy ? "Processing…" : "Approve Delete"}</button>
              <button className="adp-btn adp-btn--reject"  onClick={handleRejectDelete}  disabled={busy}>{busy ? "Processing…" : "Reject Delete"}</button>
            </>
          ) : (
            <>
              {canApprove && <button className="adp-btn adp-btn--approve" onClick={handleApprove} disabled={busy}>{busy ? "Processing…" : "✓ Approve"}</button>}
              {e.approvalStatus !== "rejected" && <button className="adp-btn adp-btn--reject" onClick={handleReject} disabled={busy}>{busy ? "Processing…" : "✕ Reject"}</button>}
            </>
          )}
        </div>
      </div>

    </div>
  );
}
