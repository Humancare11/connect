import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import api from "../../api";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

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

/* ── Field row ── */
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
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10 }}>
      <span style={{ fontSize:24, flexShrink:0 }}>📄</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.04em", marginBottom:2 }}>{label}</div>
        {filename
          ? <div style={{ fontSize:13, color:"#0f172a", fontWeight:500, wordBreak:"break-all" }}>{filename}</div>
          : <div style={{ fontSize:13, color:"#cbd5e1", fontStyle:"italic" }}>Not uploaded</div>
        }
      </div>
      {filename && <span style={{ fontSize:12, background:"#dcfce7", color:"#166534", padding:"2px 10px", borderRadius:50, fontWeight:700, flexShrink:0 }}>Uploaded</span>}
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
          return (
            <div key={label} title={`Step ${stepNo}: ${label}`}
              style={{ flex:1, height:7, borderRadius:4, background: done ? color : active ? "#fbbf24" : "#e2e8f0", transition:"all 0.3s" }} />
          );
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
   MAIN PAGE
════════════════════════════════════ */
export default function AdminDoctorProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [enrollment, setEnrollment] = useState(location.state?.enrollment || null);
  const [loading,    setLoading]    = useState(!location.state?.enrollment);
  const [error,      setError]      = useState("");
  const [toast,      setToast]      = useState(null);
  const [busy,       setBusy]       = useState(false);

  const from = location.state?.from || "manage-doctors";
  const backPath = from === "our-doctors" ? "/admin-dashboard/our-doctors" : "/admin-dashboard/manage-doctors";

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (enrollment) return;
    api.get(`/api/admin/doctors/${id}`)
      .then(res => setEnrollment(res.data))
      .catch(() => setError("Failed to load doctor profile. The record may not exist."))
      .finally(() => setLoading(false));
  }, [id, enrollment]);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get(`/api/admin/doctors/${id}`);
      setEnrollment(res.data);
    } catch {}
  }, [id]);

  const handleApprove = async () => {
    if (!enrollment) return;
    setBusy(true);
    try {
      const res = await api.put(`/api/admin/doctors/${enrollment._id}/approve`, {});
      setEnrollment(res.data?.enrollment || enrollment);
      showToast("Doctor approved successfully.");
    } catch (err) { showToast(err?.response?.data?.msg || "Approve failed.", false); }
    finally { setBusy(false); }
  };

  const handleReject = async () => {
    if (!enrollment) return;
    setBusy(true);
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
    if (!enrollment) return;
    setBusy(true);
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

  const e = enrollment;
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

      {/* ── Top nav ── */}
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:24 }}>
        <button
          onClick={() => navigate(backPath)}
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
        <div style={{ width:70, height:70, borderRadius:"50%", background:"rgba(255,255,255,0.18)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, fontWeight:800, color:"#fff", border:"2.5px solid rgba(255,255,255,0.4)", flexShrink:0 }}>
          {initials}
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
          <span style={{ background: statusMeta.bg, color: statusMeta.color, padding:"5px 14px", borderRadius:50, fontSize:12, fontWeight:700 }}>
            {statusMeta.label}
          </span>
          <span style={{ background: requestMeta.bg, color: requestMeta.color, padding:"5px 14px", borderRadius:50, fontSize:12, fontWeight:700 }}>
            {requestMeta.label}
          </span>
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

        {/* Action buttons */}
        <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:14, padding:"18px 22px", display:"flex", flexDirection:"column", gap:10, minWidth:190 }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#64748b", marginBottom:4 }}>ADMIN ACTIONS</div>
          {requestType === "profile_delete" ? (
            <>
              <button className="adp-btn adp-btn--approve" style={{ width:"100%", justifyContent:"center" }} onClick={handleApproveDelete} disabled={busy}>
                {busy ? "Processing…" : "Approve Delete"}
              </button>
              <button className="adp-btn adp-btn--reject" style={{ width:"100%", justifyContent:"center" }} onClick={handleRejectDelete} disabled={busy}>
                {busy ? "Processing…" : "Reject Delete"}
              </button>
            </>
          ) : (
            <>
              {canApprove && (
                <button className="adp-btn adp-btn--approve" style={{ width:"100%", justifyContent:"center" }} onClick={handleApprove} disabled={busy}>
                  {busy ? "Processing…" : "✓ Approve"}
                </button>
              )}
              {e.approvalStatus !== "rejected" && (
                <button className="adp-btn adp-btn--reject" style={{ width:"100%", justifyContent:"center" }} onClick={handleReject} disabled={busy}>
                  {busy ? "Processing…" : "✕ Reject"}
                </button>
              )}
              {!canApprove && e.approvalStatus === "approved" && (
                <span style={{ fontSize:13, color:"#16a34a", fontWeight:600, textAlign:"center" }}>✓ Approved</span>
              )}
            </>
          )}
          <button
            onClick={refresh}
            style={{ padding:"7px 14px", borderRadius:8, border:"1.5px solid #e2e8f0", background:"#f8fafc", color:"#64748b", fontWeight:600, fontSize:12, cursor:"pointer" }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* ── Personal & Contact ── */}
      <Section icon="👤" title="Personal & Contact Details">
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
          <Field label="Country"     value={e.country} />
          <Field label="State"       value={e.state} />
          <Field label="City"        value={e.city} />
          <Field label="ZIP / Postal" value={e.zip} />
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
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:12 }}>
          <DocItem label="Government ID / Nationality Proof"  filename={e.idProof} />
          <DocItem label="Medical Degree Certificate"         filename={e.medicalLicenseFile && e.medicalLicenseFile !== e.idProof ? null : null} />
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
              const d = e.availability[day];
              if (!d) return null;
              return (
                <div key={day} style={{ padding:"12px 16px", borderRadius:10, border:`1.5px solid ${d.enabled ? "#bfdbfe" : "#e2e8f0"}`, background: d.enabled ? "#eff6ff" : "#f8fafc" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: d.enabled ? 8 : 0 }}>
                    <span style={{ fontWeight:700, fontSize:13, color: d.enabled ? "#1d4ed8" : "#94a3b8" }}>{day}</span>
                    <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:50, background: d.enabled ? "#dcfce7" : "#f1f5f9", color: d.enabled ? "#166534" : "#94a3b8" }}>
                      {d.enabled ? "Available" : "Off"}
                    </span>
                  </div>
                  {d.enabled && Array.isArray(d.blocks) && d.blocks.map((b, i) => (
                    <div key={i} style={{ fontSize:12, color:"#334155", fontWeight:500, marginTop:4 }}>
                      {b.start} – {b.end}
                    </div>
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
