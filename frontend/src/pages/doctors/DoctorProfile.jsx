import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { normalizeFileUrl } from "../../api";
import { useDoctorAuth } from "../../context/DoctorAuthContext";
import { uploadFileDirectToS3 } from "../../utils/directUpload";
import "./DoctorProfile.css";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"];
const QUALIFICATIONS = ["MD", "DO", "NP", "PA", "Other"];
const CONSULTATION_MODES = ["Video Call", "In-Person", "Both", "Phone Call"];
const CURRENCIES = ["USD", "GBP", "EUR", "INR", "AED", "SAR", "AUD", "CAD", "SGD", "JPY", "Other"];
const COUNTRIES = [
  "United States", "United Kingdom", "India", "Canada", "Australia", "Germany", "France",
  "Brazil", "Mexico", "South Africa", "Nigeria", "Kenya", "UAE", "Saudi Arabia",
  "Singapore", "Japan", "South Korea", "Philippines", "Pakistan", "Bangladesh", "Other",
];
const SPECIALTIES = [
  "General Practice", "Internal Medicine", "Cardiology", "Dermatology", "Endocrinology",
  "Gastroenterology", "Neurology", "Oncology", "Ophthalmology", "Orthopedics", "Pediatrics",
  "Psychiatry", "Pulmonology", "Radiology", "Surgery", "Urology", "OB/GYN", "Emergency Medicine",
  "Anesthesiology", "Pathology", "Other",
];
const DOCUMENT_FIELDS = new Set(["profilePhoto", "idProof", "degreeFile", "medicalLicenseFile", "malpracticeInsuranceFile"]);

const STATUS_META = {
  pending: { label: "Pending", bg: "#fef3c7", color: "#92400e" },
  approved: { label: "Approved", bg: "#dcfce7", color: "#166534" },
  rejected: { label: "Rejected", bg: "#fee2e2", color: "#991b1b" },
};

const REQUEST_META = {
  pending: {
    label: "Profile Update Pending",
    bg: "#fffbeb",
    border: "#fde68a",
    color: "#92400e",
    text: "Your submitted profile changes are waiting for admin review. Your dashboard access remains active.",
  },
  approved: {
    label: "Profile Update Approved",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    color: "#166534",
    text: "Your latest profile update request was approved.",
  },
  rejected: {
    label: "Profile Update Rejected",
    bg: "#fff1f2",
    border: "#fecdd3",
    color: "#991b1b",
    text: "Your latest profile update request was rejected. Your previously approved profile remains active.",
  },
};

const CSS = `
.dp-adminlike { max-width:980px; margin:0 auto; padding-bottom:40px; }
.dp-topnav { display:flex; align-items:center; justify-content:space-between; gap:14px; margin-bottom:24px; }
.dp-kicker { font-size:12px; color:#94a3b8; font-weight:700; letter-spacing:.04em; text-transform:uppercase; }
.dp-title { margin:0; font-size:20px; font-weight:800; color:#0f172a; }
.dp-hero { background:linear-gradient(135deg,#1e3a5f 0%,#1d4ed8 100%); border-radius:16px; padding:24px 28px; margin-bottom:24px; display:flex; align-items:flex-start; gap:20px; flex-wrap:wrap; }
.dp-avatar { width:72px; height:72px; border-radius:50%; overflow:hidden; border:2.5px solid rgba(255,255,255,.5); flex-shrink:0; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,.18); color:#fff; font-size:26px; font-weight:800; }
.dp-avatar img { width:100%; height:100%; object-fit:cover; display:block; }
.dp-hero-main { flex:1; min-width:220px; }
.dp-name { font-size:22px; font-weight:800; color:#fff; margin:0 0 4px; }
.dp-hero-meta { font-size:14px; color:rgba(255,255,255,.85); margin:0 0 4px; }
.dp-chipbox { display:flex; flex-direction:column; gap:8px; align-items:flex-end; }
.dp-chip { display:inline-flex; align-items:center; justify-content:center; border-radius:50px; padding:5px 14px; font-size:12px; font-weight:700; white-space:nowrap; }
.dp-chip-ghost { background:rgba(255,255,255,.15); color:#fff; border:1px solid rgba(255,255,255,.3); }
.dp-card { background:#fff; border:1px solid #e2e8f0; border-radius:14px; overflow:hidden; margin-bottom:20px; }
.dp-card-head { padding:14px 22px; border-bottom:1px solid #f1f5f9; display:flex; align-items:center; gap:10px; background:#f8fafc; }
.dp-card-head h4 { margin:0; font-size:14px; font-weight:800; color:#223a5e; }
.dp-card-body { padding:18px 22px; }
.dp-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:16px 24px; }
.dp-grid-wide { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:16px 20px; }
.dp-field, .dp-read { display:flex; flex-direction:column; gap:4px; min-width:0; }
.dp-read label { font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:.05em; }
.dp-field label { display:block; font-size:12px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:.04em; margin-bottom:5px; }
.dp-read span { font-size:14px; color:#0f172a; line-height:1.45; word-break:break-word; }
.dp-read span.empty { color:#cbd5e1; font-style:italic; }
.dp-field input, .dp-field select, .dp-field textarea { width:100%; box-sizing:border-box; border:1.5px solid #e2e8f0; border-radius:8px; padding:9px 12px; font:inherit; font-size:14px; color:#0f172a; background:#fff; outline:none; transition:border-color .2s; }
.dp-field select { appearance:none; background-image:url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%2364748B' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 12px center; padding-right:32px; cursor:pointer; }
.dp-field textarea { min-height:110px; resize:vertical; line-height:1.55; }
.dp-field input:focus, .dp-field select:focus, .dp-field textarea:focus { border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.1); }
.dp-actions { display:flex; justify-content:flex-end; gap:10px; flex-wrap:wrap; }
.dp-btn { border:none; border-radius:8px; padding:9px 16px; font:inherit; font-size:13px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:7px; }
.dp-btn:disabled { opacity:.6; cursor:not-allowed; }
.dp-btn-primary { background:#2563eb; color:#fff; }
.dp-btn-soft { background:#eff6ff; color:#1d4ed8; border:1.5px solid #bfdbfe; }
.dp-btn-secondary { background:#fff; color:#334155; border:1.5px solid #e2e8f0; }
.dp-notice { border:1px solid; border-radius:12px; padding:14px 18px; margin-bottom:18px; }
.dp-notice-title { margin:0 0 4px; font-size:14px; font-weight:800; }
.dp-notice-text { margin:0; font-size:13px; line-height:1.55; }
.dp-doc { display:flex; flex-direction:column; gap:12px; padding:16px 18px; border-radius:12px; border:1.5px solid #e2e8f0; background:#fafafa; }
.dp-doc.has-file { border-color:#86efac; background:#f0fdf4; }
.dp-doc-title { font-size:11px; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:.05em; margin-bottom:4px; }
.dp-doc-name { font-size:13px; color:#1e293b; word-break:break-all; line-height:1.45; }
.dp-upload-row { display:flex; align-items:center; gap:18px; padding:16px; border:1.5px solid #e2e8f0; background:#f8fafc; border-radius:12px; flex-wrap:wrap; }
.dp-photo-upload { width:92px; height:92px; border-radius:50%; overflow:hidden; border:2.5px solid #bfdbfe; background:#e2e8f0; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; }
.dp-photo-upload img { width:100%; height:100%; object-fit:cover; display:block; }
.dp-change { border:1px solid #e2e8f0; border-radius:10px; overflow:hidden; background:#fff; margin-top:10px; }
.dp-change-head { padding:9px 12px; background:#f8fafc; border-bottom:1px solid #f1f5f9; font-size:13px; font-weight:800; color:#334155; }
.dp-change-cols { display:grid; grid-template-columns:1fr 1fr; }
.dp-change-col { padding:11px 12px; min-width:0; }
.dp-change-col + .dp-change-col { border-left:1px solid #f1f5f9; background:#f0fdf4; }
.dp-spinner { width:36px; height:36px; border-radius:50%; border:3px solid #e2e8f0; border-top-color:#2563eb; animation:dpSpin .8s linear infinite; }
@keyframes dpSpin { to { transform:rotate(360deg); } }
@media (max-width:760px){ .dp-topnav,.dp-hero{align-items:stretch}.dp-chipbox{align-items:flex-start}.dp-grid-wide,.dp-change-cols{grid-template-columns:1fr}.dp-change-col+.dp-change-col{border-left:0;border-top:1px solid #f1f5f9} }
`;

function slugifyDoctorName(name) {
  return (name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function displayValue(value) {
  if (value === undefined || value === null || value === "") return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function displayFileName(value) {
  if (!value) return "";
  const raw = String(value);
  try {
    const url = new URL(raw);
    return decodeURIComponent(url.pathname.split("/").pop() || "document");
  } catch {
    return decodeURIComponent(raw.split("?")[0].split("/").pop() || "document");
  }
}

function Section({ icon, title, children }) {
  return (
    <section className="dp-card">
      <div className="dp-card-head"><span>{icon}</span><h4>{title}</h4></div>
      <div className="dp-card-body">{children}</div>
    </section>
  );
}

function ReadField({ label, value, full }) {
  return (
    <div className="dp-read" style={{ gridColumn: full ? "1/-1" : undefined }}>
      <label>{label}</label>
      <span className={value ? "" : "empty"}>{value || "-"}</span>
    </div>
  );
}

function InputField({ label, children, full }) {
  return (
    <div className="dp-field" style={{ gridColumn: full ? "1/-1" : undefined }}>
      <label>{label}</label>
      {children}
    </div>
  );
}

async function getDoctorDocumentUrl(doctorId, field) {
  const { data } = await api.get(`/api/doctor/enrollment/${doctorId}/documents/${field}/access-url`);
  return data.url;
}

function SignedImage({ doctorId, field, alt, fallback, className }) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setSrc("");
    setFailed(false);
    if (!doctorId || !DOCUMENT_FIELDS.has(field)) return undefined;
    getDoctorDocumentUrl(doctorId, field)
      .then((url) => { if (alive) setSrc(url); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [doctorId, field]);

  if (failed || !src) return fallback || null;
  return <img className={className} src={src} alt={alt} onError={() => setFailed(true)} />;
}

function DocumentCard({ label, value, doctorId, field, editable, onChange }) {
  const ref = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const uploaded = await uploadFileDirectToS3(file);
      onChange?.(uploaded.key || uploaded.url || "");
    } catch (err) {
      setError(err?.response?.data?.msg || err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`dp-doc ${value ? "has-file" : ""}`}>
      <input ref={ref} type="file" style={{ display: "none" }} onChange={(event) => upload(event.target.files?.[0])} />
      <div>
        <div className="dp-doc-title">{label}</div>
        <div className="dp-doc-name">{value ? displayFileName(value) : "Not uploaded"}</div>
        {error && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>{error}</div>}
      </div>
      <div className="dp-actions" style={{ justifyContent: "flex-start" }}>
        {value && (
          <button
            type="button"
            className="dp-btn dp-btn-primary"
            onClick={async () => {
              const url = await getDoctorDocumentUrl(doctorId, field);
              window.open(url, "_blank", "noopener,noreferrer");
            }}
          >
            View
          </button>
        )}
        {editable && (
          <button type="button" className="dp-btn dp-btn-secondary" disabled={uploading} onClick={() => ref.current?.click()}>
            {uploading ? "Uploading..." : value ? "Replace" : "Upload"}
          </button>
        )}
      </div>
    </div>
  );
}

function PhotoEditor({ value, doctorId, editable, onChange, initials }) {
  const ref = useRef(null);
  const [preview, setPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const directUrl = normalizeFileUrl(value);
  const showDirect = directUrl && /^https?:\/\//i.test(directUrl);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const upload = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const uploaded = await uploadFileDirectToS3(file);
      onChange(uploaded.key || uploaded.url || "");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="dp-upload-row">
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={(event) => upload(event.target.files?.[0])} />
      <div className="dp-photo-upload" onClick={() => editable && ref.current?.click()}>
        {preview ? (
          <img src={preview} alt="Profile preview" />
        ) : showDirect ? (
          <img src={directUrl} alt="Profile" />
        ) : value ? (
          <SignedImage doctorId={doctorId} field="profilePhoto" alt="Profile" fallback={<span>{initials}</span>} />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      <div style={{ minWidth: 180, flex: 1 }}>
        <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 14 }}>
          {uploading ? "Uploading..." : value ? "Profile photo uploaded" : "No profile photo"}
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>JPG, PNG, or WebP. Click the avatar to replace.</div>
        {editable && (
          <button type="button" className="dp-btn dp-btn-soft" style={{ marginTop: 10 }} disabled={uploading} onClick={() => ref.current?.click()}>
            {value ? "Replace Photo" : "Upload Photo"}
          </button>
        )}
      </div>
    </div>
  );
}

function ProfileUpdateStatus({ enrollment }) {
  const status = enrollment.profileUpdateRequestStatus ||
    (enrollment.pendingRequestType === "profile_update" ? "pending" : "none");
  const meta = REQUEST_META[status];
  if (!meta) return null;
  const changes = Array.isArray(enrollment.pendingProfileChanges) ? enrollment.pendingProfileChanges : [];
  return (
    <div className="dp-notice" style={{ background: meta.bg, borderColor: meta.border, color: meta.color }}>
      <p className="dp-notice-title">{meta.label}</p>
      <p className="dp-notice-text">{meta.text}</p>
      {enrollment.profileUpdateRequestedAt && (
        <p className="dp-notice-text" style={{ marginTop: 4 }}>Submitted {new Date(enrollment.profileUpdateRequestedAt).toLocaleString()}</p>
      )}
      {status === "pending" && changes.map((change) => (
        <div key={change.field} className="dp-change">
          <div className="dp-change-head">{change.label || change.field}</div>
          <div className="dp-change-cols">
            <div className="dp-change-col">
              <div className="dp-doc-title">Current approved</div>
              <div className="dp-doc-name">{displayValue(change.previousValue) || "-"}</div>
            </div>
            <div className="dp-change-col">
              <div className="dp-doc-title">Submitted update</div>
              <div className="dp-doc-name">{displayValue(change.newValue) || "-"}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DoctorProfile() {
  const { doctor } = useDoctorAuth();
  const navigate = useNavigate();
  const [enrollment, setEnrollment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const doctorId = doctor?._id || doctor?.id;

  useEffect(() => {
    if (!doctorId) return;
    setLoading(true);
    api.get(`/api/doctor/enrollment/${doctorId}`)
      .then((res) => setEnrollment(res.data || null))
      .catch(() => setEnrollment(null))
      .finally(() => setLoading(false));
  }, [doctorId]);

  const initialForm = useMemo(() => {
    const e = enrollment || {};
    return {
      firstName: e.firstName || "",
      surname: e.surname || "",
      email: e.email || "",
      countryCode: e.countryCode || "",
      phoneNumber: e.phoneNumber || "",
      gender: e.gender || "",
      dob: e.dob || "",
      languagesKnown: Array.isArray(e.languagesKnown) ? e.languagesKnown.join(", ") : e.languagesKnown || "",
      country: e.country || "",
      state: e.state || "",
      city: e.city || "",
      zip: e.zip || "",
      address: e.address || "",
      specialization: e.specialization || "",
      subSpecialization: e.subSpecialization || "",
      qualification: e.qualification || "",
      experience: e.experience != null ? String(e.experience) : "",
      medicalSchool: e.medicalSchool || "",
      registrationYear: e.registrationYear || "",
      medicalCouncilName: e.medicalCouncilName || "",
      medicalRegistrationNumber: e.medicalRegistrationNumber || "",
      medicalLicense: e.medicalLicense || "",
      idProofType: e.idProofType || "",
      consultationMode: e.consultationMode || "",
      consultantFees: e.consultantFees != null ? String(e.consultantFees) : "",
      feeCurrency: e.feeCurrency || "USD",
      clinicName: e.clinicName || "",
      clinicAddress: e.clinicAddress || "",
      aboutDoctor: e.aboutDoctor || "",
      profilePhoto: e.profilePhoto || "",
      idProof: e.idProof || "",
      degreeFile: e.degreeFile || "",
      medicalLicenseFile: e.medicalLicenseFile || "",
      malpracticeInsuranceFile: e.malpracticeInsuranceFile || "",
      bankName: e.bankName || "",
      accountHolderName: e.accountHolderName || "",
      accountNumber: e.accountNumber || "",
      ifscCode: e.ifscCode || "",
      paypalId: e.paypalId || "",
      payoutEmail: e.payoutEmail || "",
      timezone: e.timezone || "",
      availability: e.availability || {},
    };
  }, [enrollment]);

  const beginEdit = () => {
    setForm(initialForm);
    setToast(null);
    setEditMode(true);
  };

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    setToast(null);
    try {
      const payload = {
        doctorId,
        ...form,
        languagesKnown: form.languagesKnown ? form.languagesKnown.split(",").map((item) => item.trim()).filter(Boolean) : [],
        experience: form.experience === "" ? undefined : Number(form.experience),
        consultantFees: form.consultantFees === "" ? undefined : Number(form.consultantFees),
      };
      const { data } = await api.post("/api/doctor/enrollment", payload);
      setEnrollment(data?.enrollment || enrollment);
      setEditMode(false);
      setToast({ ok: true, text: data?.message || "Profile saved." });
    } catch (err) {
      setToast({ ok: false, text: err?.response?.data?.message || "Could not save profile." });
    } finally {
      setSaving(false);
    }
  };

  const input = (key, placeholder = "", type = "text") => (
    <input type={type} value={form[key] || ""} placeholder={placeholder} onChange={(event) => update(key, event.target.value)} />
  );
  const select = (key, options, placeholder = "Select...") => (
    <select value={form[key] || ""} onChange={(event) => update(key, event.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );

  if (loading) {
    return (
      <>
        <style>{CSS}</style>
        <div style={{ minHeight: 300, display: "flex", justifyContent: "center", alignItems: "center" }}><div className="dp-spinner" /></div>
      </>
    );
  }

  if (!enrollment) {
    return (
      <>
        <style>{CSS}</style>
        <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>No profile found. Complete your enrollment first.</div>
      </>
    );
  }

  const e = enrollment;
  const source = editMode ? form : e;
  const fullName = `Dr. ${source.firstName || ""} ${source.surname || ""}`.trim() || doctor?.name || "Doctor";
  const initials = `${(source.firstName || "D")[0]}${(source.surname || "R")[0]}`.toUpperCase();
  const statusMeta = STATUS_META[e.approvalStatus] || STATUS_META.pending;
  const location = [source.city, source.state, source.country].filter(Boolean).join(", ");
  const publicSlug = doctor?.doctorId ? `${doctor.doctorId}-${slugifyDoctorName(fullName)}` : "";
  const languages = Array.isArray(e.languagesKnown) ? e.languagesKnown.join(", ") : e.languagesKnown;

  return (
    <>
      <style>{CSS}</style>
      <div className="dp-adminlike">
        <div className="dp-topnav">
          <div>
            <div className="dp-kicker">Doctor Profile {editMode && <span style={{ color: "#2563eb" }}>· EDIT MODE</span>}</div>
            <h1 className="dp-title">{fullName}</h1>
          </div>
          <div className="dp-actions">
            {editMode ? (
              <>
                <button className="dp-btn dp-btn-secondary" type="button" onClick={() => { setEditMode(false); setForm({}); }} disabled={saving}>Cancel</button>
                <button className="dp-btn dp-btn-primary" type="button" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
              </>
            ) : (
              <button className="dp-btn dp-btn-soft" type="button" onClick={beginEdit}>Edit Profile</button>
            )}
          </div>
        </div>

        {toast && (
          <div className="dp-notice" style={{ background: toast.ok ? "#f0fdf4" : "#fff1f2", borderColor: toast.ok ? "#bbf7d0" : "#fecdd3", color: toast.ok ? "#166534" : "#991b1b" }}>
            <p className="dp-notice-text" style={{ fontWeight: 800 }}>{toast.text}</p>
          </div>
        )}

        <div className="dp-hero">
          <div className="dp-avatar">
            {source.profilePhoto ? (
              <SignedImage doctorId={doctorId} field="profilePhoto" alt={fullName} fallback={<span>{initials}</span>} />
            ) : <span>{initials}</span>}
          </div>
          <div className="dp-hero-main">
            <div className="dp-name">{fullName}</div>
            {(source.qualification || source.specialization) && <div className="dp-hero-meta">{[source.qualification, source.specialization].filter(Boolean).join(" · ")}</div>}
            {source.experience && <div className="dp-hero-meta">{source.experience} years experience</div>}
            {location && <div className="dp-hero-meta">{location}</div>}
          </div>
          <div className="dp-chipbox">
            <span className="dp-chip" style={{ background: statusMeta.bg, color: statusMeta.color }}>{statusMeta.label}</span>
            <span className="dp-chip dp-chip-ghost">ID: {doctor?.doctorId || "-"}</span>
            {source.consultantFees && <span className="dp-chip dp-chip-ghost">{source.feeCurrency || "USD"} {source.consultantFees} / visit</span>}
            {publicSlug && e.approvalStatus === "approved" && !editMode && (
              <button className="dp-chip dp-chip-ghost" type="button" style={{ cursor: "pointer" }} onClick={() => navigate(`/doctors/${publicSlug}`)}>View Public Profile</button>
            )}
          </div>
        </div>

        <ProfileUpdateStatus enrollment={e} />

        {editMode && e.approvalStatus === "approved" && (
          <div className="dp-notice" style={{ background: "#fffbeb", borderColor: "#fde68a", color: "#92400e" }}>
            <p className="dp-notice-title">Admin review required</p>
            <p className="dp-notice-text">Saving changes submits the whole profile update for admin review. Your dashboard access remains active.</p>
          </div>
        )}

        {editMode ? (
          <>
            <Section icon="📷" title="Profile Photo">
              <PhotoEditor value={form.profilePhoto} doctorId={doctorId} editable onChange={(value) => update("profilePhoto", value)} initials={initials} />
            </Section>

            <Section icon="👤" title="Personal & Contact Details">
              <div className="dp-grid-wide">
                <InputField label="First Name">{input("firstName", "First name")}</InputField>
                <InputField label="Surname">{input("surname", "Surname")}</InputField>
                <InputField label="Email">{input("email", "Email", "email")}</InputField>
                <InputField label="Phone">
                  <div style={{ display: "grid", gridTemplateColumns: "74px 1fr", gap: 8 }}>
                    {input("countryCode", "+1")}
                    {input("phoneNumber", "Phone number")}
                  </div>
                </InputField>
                <InputField label="Gender">{select("gender", GENDERS)}</InputField>
                <InputField label="Date of Birth">{input("dob", "", "date")}</InputField>
                <InputField label="Languages Known" full>{input("languagesKnown", "English, Hindi, Spanish")}</InputField>
              </div>
            </Section>

            <Section icon="📍" title="Location">
              <div className="dp-grid-wide">
                <InputField label="Country">{select("country", COUNTRIES)}</InputField>
                <InputField label="State">{input("state", "State")}</InputField>
                <InputField label="City">{input("city", "City")}</InputField>
                <InputField label="ZIP / Postal">{input("zip", "ZIP")}</InputField>
                <InputField label="Street Address" full>{input("address", "Street address")}</InputField>
              </div>
            </Section>

            <Section icon="🩺" title="Professional Details">
              <div className="dp-grid-wide">
                <InputField label="Specialization">{select("specialization", SPECIALTIES, "Select specialty")}</InputField>
                <InputField label="Sub-Specialization">{input("subSpecialization", "Sub-specialization")}</InputField>
                <InputField label="Qualification">{select("qualification", QUALIFICATIONS)}</InputField>
                <InputField label="Experience">{input("experience", "Years", "number")}</InputField>
                <InputField label="Medical School">{input("medicalSchool", "Medical school")}</InputField>
                <InputField label="Graduation Year">{input("registrationYear", "YYYY")}</InputField>
                <InputField label="Medical Council">{input("medicalCouncilName", "Council")}</InputField>
                <InputField label="Registration Number">{input("medicalRegistrationNumber", "Registration number")}</InputField>
                <InputField label="Medical License No.">{input("medicalLicense", "License number")}</InputField>
                <InputField label="Consultation Mode">{select("consultationMode", CONSULTATION_MODES)}</InputField>
                <InputField label="Consultation Fee">{input("consultantFees", "Fee", "number")}</InputField>
                <InputField label="Fee Currency">{select("feeCurrency", CURRENCIES)}</InputField>
                <InputField label="Clinic Name">{input("clinicName", "Clinic name")}</InputField>
                <InputField label="Clinic Address">{input("clinicAddress", "Clinic address")}</InputField>
                <InputField label="About Doctor" full>
                  <textarea value={form.aboutDoctor || ""} onChange={(event) => update("aboutDoctor", event.target.value)} />
                </InputField>
              </div>
            </Section>

            <Section icon="📋" title="Submitted Documents">
              <div className="dp-grid">
                <DocumentCard editable label="Government ID / Nationality Proof" value={form.idProof} doctorId={doctorId} field="idProof" onChange={(value) => update("idProof", value)} />
                <DocumentCard editable label="Medical Degree Certificate" value={form.degreeFile} doctorId={doctorId} field="degreeFile" onChange={(value) => update("degreeFile", value)} />
                <DocumentCard editable label="Medical License Document" value={form.medicalLicenseFile} doctorId={doctorId} field="medicalLicenseFile" onChange={(value) => update("medicalLicenseFile", value)} />
                <DocumentCard editable label="Malpractice Insurance License" value={form.malpracticeInsuranceFile} doctorId={doctorId} field="malpracticeInsuranceFile" onChange={(value) => update("malpracticeInsuranceFile", value)} />
              </div>
            </Section>

            <Section icon="💳" title="Payout Information">
              <div className="dp-grid-wide">
                <InputField label="Bank Name">{input("bankName", "Bank name")}</InputField>
                <InputField label="Account Holder">{input("accountHolderName", "Account holder")}</InputField>
                <InputField label="Account Number">{input("accountNumber", "Account number")}</InputField>
                <InputField label="SWIFT / BIC">{input("ifscCode", "SWIFT / BIC")}</InputField>
                <InputField label="PayPal ID">{input("paypalId", "PayPal ID")}</InputField>
                <InputField label="Payout Email">{input("payoutEmail", "Payout email", "email")}</InputField>
              </div>
            </Section>
          </>
        ) : (
          <>
            <Section icon="👤" title="Personal & Contact Details">
              {e.profilePhoto ? (
                <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 18px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, marginBottom: 18 }}>
                  <div className="dp-avatar" style={{ width: 72, height: 72, borderColor: "#16a34a" }}>
                    <SignedImage doctorId={doctorId} field="profilePhoto" alt={fullName} fallback={<span>{initials}</span>} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#166534" }}>Profile photo uploaded</div>
                    <button className="dp-btn dp-btn-secondary" style={{ marginTop: 8 }} type="button" onClick={async () => window.open(await getDoctorDocumentUrl(doctorId, "profilePhoto"), "_blank", "noopener,noreferrer")}>View full size</button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: "12px 16px", background: "#fafafa", border: "1px dashed #e2e8f0", borderRadius: 10, marginBottom: 18, fontSize: 13, color: "#94a3b8" }}>No profile photo uploaded.</div>
              )}
              <div className="dp-grid">
                <ReadField label="First Name" value={e.firstName} />
                <ReadField label="Surname" value={e.surname} />
                <ReadField label="Email" value={e.email || doctor?.email} />
                <ReadField label="Mobile" value={[e.countryCode, e.phoneNumber].filter(Boolean).join(" ")} />
                <ReadField label="Gender" value={e.gender} />
                <ReadField label="Date of Birth" value={e.dob} />
                <ReadField label="Languages" value={languages} full={languages?.length > 40} />
              </div>
            </Section>

            <Section icon="📍" title="Location">
              <div className="dp-grid">
                <ReadField label="Country" value={e.country} />
                <ReadField label="State" value={e.state} />
                <ReadField label="City" value={e.city} />
                <ReadField label="ZIP / Postal" value={e.zip} />
                <ReadField label="Street Address" value={e.address} full />
              </div>
            </Section>

            <Section icon="🩺" title="Professional Details">
              <div className="dp-grid">
                <ReadField label="Specialization" value={e.specialization} />
                <ReadField label="Sub-Specialization" value={e.subSpecialization} />
                <ReadField label="Qualification" value={e.qualification} />
                <ReadField label="Experience" value={e.experience ? `${e.experience} years` : ""} />
                <ReadField label="Medical School" value={e.medicalSchool} />
                <ReadField label="Graduation Year" value={e.registrationYear} />
                <ReadField label="Medical Council" value={e.medicalCouncilName} />
                <ReadField label="Registration Number" value={e.medicalRegistrationNumber} />
                <ReadField label="Medical License No." value={e.medicalLicense} />
                <ReadField label="Consultation Mode" value={e.consultationMode} />
                <ReadField label="Consultation Fee" value={e.consultantFees ? `${e.feeCurrency || "USD"} ${e.consultantFees}` : ""} />
                <ReadField label="Clinic Name" value={e.clinicName} />
                <ReadField label="Clinic Address" value={e.clinicAddress} full />
              </div>
              {e.aboutDoctor && <p style={{ margin: "16px 0 0", paddingTop: 16, borderTop: "1px solid #f1f5f9", fontSize: 14, color: "#334155", lineHeight: 1.7 }}>{e.aboutDoctor}</p>}
            </Section>

            <Section icon="📋" title="Submitted Documents">
              <div className="dp-grid">
                <DocumentCard label="Government ID / Nationality Proof" value={e.idProof} doctorId={doctorId} field="idProof" />
                <DocumentCard label="Medical Degree Certificate" value={e.degreeFile} doctorId={doctorId} field="degreeFile" />
                <DocumentCard label="Medical License Document" value={e.medicalLicenseFile} doctorId={doctorId} field="medicalLicenseFile" />
                <DocumentCard label="Malpractice Insurance License" value={e.malpracticeInsuranceFile} doctorId={doctorId} field="malpracticeInsuranceFile" />
              </div>
            </Section>

            <Section icon="🗓️" title="Availability Schedule">
              {e.timezone && <div style={{ marginBottom: 14, fontSize: 13, fontWeight: 700, color: "#1d4ed8" }}>Timezone: {e.timezone}</div>}
              {e.availability && typeof e.availability === "object" && Object.keys(e.availability).length > 0 ? (
                <div className="dp-grid">
                  {DAYS.map((day) => {
                    const dayData = e.availability?.[day];
                    if (!dayData) return null;
                    return (
                      <div key={day} style={{ padding: "12px 16px", borderRadius: 10, border: `1.5px solid ${dayData.enabled ? "#bfdbfe" : "#e2e8f0"}`, background: dayData.enabled ? "#eff6ff" : "#f8fafc" }}>
                        <div style={{ fontWeight: 800, fontSize: 13, color: dayData.enabled ? "#1d4ed8" : "#94a3b8", marginBottom: dayData.enabled ? 8 : 0 }}>{day}</div>
                        {dayData.enabled && Array.isArray(dayData.blocks) && dayData.blocks.map((block, index) => (
                          <div key={`${block.start}-${block.end}-${index}`} style={{ fontSize: 12, color: "#334155", fontWeight: 600 }}>{block.start} - {block.end}</div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ) : <p style={{ color: "#94a3b8", fontSize: 14, fontStyle: "italic" }}>No availability schedule submitted.</p>}
            </Section>

            <Section icon="💳" title="Payout Information">
              <div className="dp-grid">
                <ReadField label="Bank Name" value={e.bankName} />
                <ReadField label="Account Holder" value={e.accountHolderName} />
                <ReadField label="Account Number" value={e.accountNumber ? `****${String(e.accountNumber).slice(-4)}` : ""} />
                <ReadField label="SWIFT / BIC" value={e.ifscCode} />
                <ReadField label="PayPal ID" value={e.paypalId} />
                <ReadField label="Payout Email" value={e.payoutEmail} />
              </div>
            </Section>
          </>
        )}
      </div>
    </>
  );
}
