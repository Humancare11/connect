import { useState, useEffect } from "react";
import PhoneInputLib from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { getNames } from "country-list";
import "./DoctorEnrollments.css";
import api from "../../api";

const PhoneInput = PhoneInputLib.default ?? PhoneInputLib;

const LANGUAGES = ["English", "Hindi", "Bengali", "Tamil", "Telugu", "Marathi", "Gujarati", "Kannada", "Malayalam", "Punjabi"];

const SPECIALITIES = {
  "Cardiologist": ["Interventional Cardiology", "Non-Invasive Cardiology", "Electrophysiology", "Heart Failure", "Preventive Cardiology"],
  "Dermatologist": ["Cosmetic Dermatology", "Dermatopathology", "Pediatric Dermatology", "Trichology", "Laser Dermatology"],
  "Orthopedic Surgeon": ["Joint Replacement", "Spine Surgery", "Sports Injury", "Pediatric Orthopedics", "Trauma Surgery"],
  "Neurologist": ["Stroke Specialist", "Epilepsy Specialist", "Neurophysiology", "Movement Disorders", "Neurocritical Care"],
  "Oncologist": ["Medical Oncology", "Surgical Oncology", "Radiation Oncology", "Pediatric Oncology", "Gynecologic Oncology"],
  "Pediatrician": ["Neonatology", "Pediatric Cardiology", "Pediatric Neurology", "Pediatric Oncology", "Developmental Pediatrics"],
  "OB-GYN": ["Infertility Specialist", "Gynecologic Oncology", "Maternal-Fetal Medicine", "Reproductive Endocrinology", "Laparoscopic Surgery"],
  "Psychiatrist": ["Child Psychiatry", "Addiction Psychiatry", "Geriatric Psychiatry", "Forensic Psychiatry", "Psychotherapy"],
  "Radiologist": ["Interventional Radiology", "Neuroradiology", "Musculoskeletal Radiology", "Pediatric Radiology", "Breast Imaging"],
  "Urologist": ["Andrology", "Endourology", "Uro-Oncology", "Pediatric Urology", "Reconstructive Urology"],
};

// Only these fields are truly required
const REQUIRED = new Set([
  "firstName", "surname", "email", "phoneNumber", "gender", "dob",
  "qualification", "specialization", "experience", "consultantFees", "consultationMode",
  "medicalRegistrationNumber", "medicalLicense",
  "accountHolderName", "bankName", "accountNumber", "ifscCode",
]);

const V = {
  email: v => !v ? "Required" : !/\S+@\S+\.\S+/.test(v) ? "Invalid email" : "",
  phoneNumber: v => !v ? "Required" : v.length < 10 ? "Invalid number" : "",
  firstName: v => !v ? "Required" : "",
  surname: v => !v ? "Required" : "",
  gender: v => !v ? "Required" : "",
  dob: v => { if (!v) return "Required"; const a = Math.floor((Date.now() - new Date(v)) / 31557600000); return a < 23 ? "Min age 23" : a > 80 ? "Invalid date" : ""; },
  qualification: v => !v ? "Required" : "",
  specialization: v => !v ? "Required" : "",
  experience: v => !v ? "Required" : v < 1 ? "Min 1 yr" : v > 60 ? "Max 60 yrs" : "",
  consultantFees: v => !v ? "Required" : v < 100 ? "Min ₹100" : "",
  consultationMode: v => !v ? "Required" : "",
  medicalRegistrationNumber: v => !v ? "Required" : "",
  medicalLicense: v => !v ? "Required" : "",
  accountHolderName: v => !v ? "Required" : "",
  bankName: v => !v ? "Required" : "",
  accountNumber: v => !v ? "Required" : !/^\d{9,18}$/.test(v) ? "9–18 digits" : "",
  ifscCode: v => !v ? "Required" : !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.toUpperCase()) ? "e.g. SBIN0001234" : "",
  payoutEmail: v => v && !/\S+@\S+\.\S+/.test(v) ? "Invalid email" : "",
  aboutDoctor: v => v && v.length > 300 ? "Max 300 chars" : "",
};

function Field({ label, error, hint, req, children }) {
  return (
    <div className={`de-field ${error ? "de-field--err" : ""}`}>
      <label className="de-label">
        {label}
        {req && <span className="de-req"> *</span>}
        {!req && <span className="de-opt"> optional</span>}
      </label>
      {children}
      {hint && !error && <span className="de-hint">{hint}</span>}
      {error && <span className="de-err-msg">⚠ {error}</span>}
    </div>
  );
}

const SECTIONS = [
  { id: "personal", label: "Personal", num: "01" },
  { id: "practice", label: "Practice", num: "02" },
  { id: "credentials", label: "Credentials", num: "03" },
  { id: "payout", label: "Payout", num: "04" },
];

export default function DoctorEnrollments({ onComplete, initialData, doctorId }) {
  const [countries, setCountries] = useState([]);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(!!initialData);
  const [hasExistingPhoto, setHasExistingPhoto] = useState(false);
  const [hasExistingCert, setHasExistingCert] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [activeSection, setActiveSection] = useState("personal");

  const [hasSubmitted, setHasSubmitted] = useState(false);

  const [form, setForm] = useState({
    email: "", phoneNumber: "", firstName: "", surname: "", gender: "", dob: "",
    qualification: "", specialization: "", subSpecialization: "", consultantFees: "",
    address: "", country: "", state: "", city: "", zip: "",
    profilePhoto: null, experience: "", aboutDoctor: "", consultationMode: "",
    languagesKnown: [], clinicName: "", clinicAddress: "",
    medicalRegistrationNumber: "", medicalLicense: "", medicalCertification: null,
    idProof: "", medicalCouncilName: "", registrationYear: "", idProofType: "",
    payoutEmail: "", accountHolderName: "", bankName: "", accountNumber: "", ifscCode: "",
  });

  useEffect(() => {
    setCountries(getNames().sort((a, b) => a.localeCompare(b)));
    if (initialData) {
      setForm(p => ({ ...p, ...initialData, profilePhoto: null, medicalCertification: null }));
      setHasExistingPhoto(!!(initialData.hasProfilePhoto || initialData.profilePhoto));
      setHasExistingCert(!!(initialData.hasCertification || initialData.medicalCertification));
    }
  }, [initialData]);

  const set = (name, val) => {
    setForm(p => ({ ...p, [name]: val, ...(name === "specialization" && { subSpecialization: "" }) }));
    if (errors[name]) setErrors(p => ({ ...p, [name]: "" }));
  };

  const onChange = e => {
    const { name, value, type, checked } = e.target;
    set(name, type === "checkbox" ? checked : value);
  };

  const onFile = e => {
    const { name, files } = e.target;
    const file = files[0]; if (!file) return;
    set(name, file);
    if (name === "profilePhoto") { const r = new FileReader(); r.onloadend = () => setPhotoPreview(r.result); r.readAsDataURL(file); }
  };

  const toggleLang = lang => {
    set("languagesKnown", form.languagesKnown.includes(lang)
      ? form.languagesKnown.filter(l => l !== lang)
      : [...form.languagesKnown, lang]);
  };

  const validateAll = () => {
    const errs = {};
    Object.entries(V).forEach(([field, fn]) => {
      const e = fn(form[field]);
      if (e) errs[field] = e;
    });
    setErrors(errs);
    if (Object.keys(errs).length) {
      // scroll to first error section
      const firstErrField = Object.keys(errs)[0];
      const el = document.querySelector(`[name="${firstErrField}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    return true;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!validateAll()) return;
    setSubmitting(true);
    const { profilePhoto, medicalCertification, ...rest } = form;
    try {
      const res = await api.post("/api/doctor/enrollment", {
        ...rest, doctorId,
        hasProfilePhoto: hasExistingPhoto || !!profilePhoto,
        hasCertification: hasExistingCert || !!medicalCertification,
      });
      setShowSuccess(true);
      const enrollmentResult = res.data?.enrollment || res.data;
      setTimeout(() => { setShowSuccess(false); setIsReadOnly(true); setHasSubmitted(true); onComplete?.(enrollmentResult); }, 3000);
    } catch (err) { console.error(err); }
    finally { setSubmitting(false); }
  };

  const charLen = form.aboutDoctor.length;
  const isUpdate = !!initialData || hasSubmitted;
  const successTitle = isUpdate ? "Update Request Submitted" : "Application Submitted";
  const successMessage = isUpdate
    ? "Your profile update request is pending admin approval. We'll notify you once it's reviewed."
    : "We'll review your profile and respond within 2–3 business days.";

  return (
    <div className="de-root">

      {/* Success overlay */}
      {showSuccess && (
        <div className="de-success-overlay">
          <div className="de-success-box">
            <div className="de-success-ring">
              <svg viewBox="0 0 60 60" fill="none">
                <circle cx="30" cy="30" r="28" stroke="var(--de-teal)" strokeWidth="2.5" />
                <polyline points="16,30 25,40 44,20" stroke="var(--de-teal)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3>{successTitle}</h3>
            <p>{successMessage}</p>
          </div>
        </div>
      )}

      {/* Page header */}
      <header className="de-header">
        <div className="de-header-inner">
          <div className="de-header-logo">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="9" fill="var(--de-teal)" />
              <path d="M16 7v18M7 16h18" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span>HumaniCare</span>
          </div>
          <div className="de-header-text">
            <h1>Doctor Enrollment</h1>
            <p>Fill in your details below to join the platform</p>
            {initialData?.approvalStatus && (
              <div className="de-status-note">
                {initialData.approvalStatus === "approved" ? (
                  <p>Your profile is approved. Any edits will be submitted as an update request for admin review.</p>
                ) : initialData.approvalStatus === "pending" ? (
                  <p>Your latest profile submission is pending admin approval. You can review your data here.</p>
                ) : (
                  <p>Your latest submission was rejected. Update your details and resubmit for review.</p>
                )}
              </div>
            )}
          </div>
          {(initialData || hasSubmitted) && isReadOnly && (
            <button className="de-edit-btn" onClick={() => setIsReadOnly(false)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit Profile
            </button>
          )}
        </div>
      </header>

      <div className="de-body">

        {/* Sticky sidebar nav */}
        <nav className="de-sidenav">
          {SECTIONS.map(s => (
            <button key={s.id}
              className={`de-sidenav-item ${activeSection === s.id ? "de-sidenav-item--active" : ""}`}
            >
              <span className="de-sidenav-num">{s.num}</span>
              <span className="de-sidenav-label">{s.label}</span>
            </button>
          ))}
          <div className="de-sidenav-track">
            <div className="de-sidenav-fill"
              style={{ height: `${(SECTIONS.findIndex(s => s.id === activeSection) + 1) * 25}%` }} />
          </div>
        </nav>

        {/* Scroll form */}
        <form className="de-form" onSubmit={handleSubmit}>

          {/* ─── SECTION 1: PERSONAL ─── */}
          <section id="personal" className="de-section">
            <div className="de-section-heading">
              <span className="de-section-num">01</span>
              <div>
                <h2>Personal Information</h2>
                <p>Your identity and contact details</p>
              </div>
            </div>

            {/* Photo */}
            <div className="de-photo-row">
              <div className="de-photo-avatar">
                {photoPreview
                  ? <img src={photoPreview} alt="preview" />
                  : hasExistingPhoto
                    ? <span className="de-photo-placeholder">📸</span>
                    : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="7" r="4" /><path d="M20 21a8 8 0 1 0-16 0" /></svg>
                }
              </div>
              <div className="de-photo-meta">
                <p className="de-photo-title">Profile Photo <span className="de-opt">optional</span></p>
                <p className="de-photo-sub">JPG or PNG · max 2 MB</p>
                {!isReadOnly && (
                  <div className="de-photo-actions">
                    <label className="de-upload-pill">
                      <input type="file" name="profilePhoto" accept="image/jpeg,image/png" onChange={onFile} style={{ display: "none" }} />
                      {form.profilePhoto || hasExistingPhoto ? "Change" : "Upload Photo"}
                    </label>
                    {(photoPreview || hasExistingPhoto) && (
                      <button type="button" className="de-remove-link"
                        onClick={() => { setPhotoPreview(null); setHasExistingPhoto(false); set("profilePhoto", null); }}>
                        Remove
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="de-grid-2">
              <Field label="First Name" error={errors.firstName} req>
                <input className="de-input" name="firstName" value={form.firstName} onChange={onChange} disabled={isReadOnly} placeholder="Rahul" />
              </Field>
              <Field label="Surname" error={errors.surname} req>
                <input className="de-input" name="surname" value={form.surname} onChange={onChange} disabled={isReadOnly} placeholder="Sharma" />
              </Field>
              <Field label="Gender" error={errors.gender} req>
                <select className="de-input de-select" name="gender" value={form.gender} onChange={onChange} disabled={isReadOnly}>
                  <option value="">Select</option>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </Field>
              <Field label="Date of Birth" error={errors.dob} req>
                <input className="de-input" type="date" name="dob" value={form.dob} onChange={onChange} disabled={isReadOnly} />
              </Field>
              <Field label="Email Address" error={errors.email} req>
                <input className="de-input" type="email" name="email" value={form.email} onChange={onChange} disabled={isReadOnly} placeholder="doctor@example.com" />
              </Field>
              <Field label="Phone Number" error={errors.phoneNumber} req>
                <div className={`de-phone ${errors.phoneNumber ? "de-phone--err" : ""}`}>
                  <PhoneInput country="in" value={form.phoneNumber} onChange={v => set("phoneNumber", v)} disabled={isReadOnly}
                    inputStyle={{ width: "100%", height: "46px", fontSize: "14px", background: "transparent", color: "var(--de-text)", border: "none", outline: "none" }}
                    buttonStyle={{ background: "transparent", border: "none", borderRight: "1px solid var(--de-border)" }}
                    dropdownStyle={{ background: "#1a2535", color: "#e0eaff", border: "1px solid rgba(255,255,255,0.1)" }} />
                </div>
              </Field>
            </div>
          </section>

          {/* ─── SECTION 2: PRACTICE ─── */}
          <section id="practice" className="de-section">
            <div className="de-section-heading">
              <span className="de-section-num">02</span>
              <div>
                <h2>Practice Details</h2>
                <p>Your medical expertise and clinic information</p>
              </div>
            </div>

            <div className="de-grid-2">
              <Field label="Qualification" error={errors.qualification} req>
                <input className="de-input" name="qualification" value={form.qualification} onChange={onChange} disabled={isReadOnly} placeholder="MBBS, MD, MS…" />
              </Field>
              <Field label="Years of Experience" error={errors.experience} req>
                <input className="de-input" type="number" name="experience" value={form.experience} onChange={onChange} disabled={isReadOnly} placeholder="e.g. 5" min="1" max="60" />
              </Field>
              <Field label="Specialization" error={errors.specialization} req>
                <select className="de-input de-select" name="specialization" value={form.specialization} onChange={onChange} disabled={isReadOnly}>
                  <option value="">Select</option>
                  {Object.keys(SPECIALITIES).map(s => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Sub-Specialization">
                <select className="de-input de-select" name="subSpecialization" value={form.subSpecialization} onChange={onChange} disabled={isReadOnly || !form.specialization}>
                  <option value="">Select (optional)</option>
                  {SPECIALITIES[form.specialization]?.map((s, i) => <option key={i}>{s}</option>)}
                </select>
              </Field>
              <Field label="Consultation Fee (₹)" error={errors.consultantFees} req>
                <input className="de-input" type="number" name="consultantFees" value={form.consultantFees} onChange={onChange} disabled={isReadOnly} placeholder="Min ₹100" />
              </Field>
              <Field label="Consultation Mode" error={errors.consultationMode} req>
                <div className="de-toggle-group">
                  {["Online", "Offline", "Both"].map(m => (
                    <button key={m} type="button"
                      className={`de-toggle ${form.consultationMode === m ? "de-toggle--on" : ""}`}
                      onClick={() => !isReadOnly && set("consultationMode", m)}
                      disabled={isReadOnly}>{m}</button>
                  ))}
                </div>
                {errors.consultationMode && <span className="de-err-msg">⚠ {errors.consultationMode}</span>}
              </Field>
            </div>

            <Field label="Languages Known" hint="Select all you speak">
              <div className="de-chips">
                {LANGUAGES.map(l => (
                  <button key={l} type="button"
                    className={`de-chip ${form.languagesKnown.includes(l) ? "de-chip--on" : ""}`}
                    onClick={() => !isReadOnly && toggleLang(l)} disabled={isReadOnly}>{l}</button>
                ))}
              </div>
            </Field>

            <Field label="About Yourself" error={errors.aboutDoctor} hint="Max 300 characters">
              <textarea className="de-input de-textarea" name="aboutDoctor" value={form.aboutDoctor}
                onChange={onChange} disabled={isReadOnly} rows={4} maxLength={300}
                placeholder="Your experience, approach to patient care, areas of expertise…" />
              {!isReadOnly && (
                <div className="de-charcount">
                  <div className="de-charbar"><div className="de-charbar-fill" style={{
                    width: `${(charLen / 300) * 100}%`,
                    background: charLen > 280 ? "var(--de-red)" : charLen > 0 ? "var(--de-teal)" : "transparent"
                  }} /></div>
                  <span style={{ color: charLen > 280 ? "var(--de-red)" : "var(--de-muted)" }}>{charLen}/300</span>
                </div>
              )}
            </Field>

            <div className="de-subsection-label">Clinic (optional)</div>
            <div className="de-grid-2">
              <Field label="Clinic Name">
                <input className="de-input" name="clinicName" value={form.clinicName} onChange={onChange} disabled={isReadOnly} placeholder="Apollo Clinic, City Hospital…" />
              </Field>
              <Field label="Country">
                <select className="de-input de-select" name="country" value={form.country} onChange={onChange} disabled={isReadOnly}>
                  <option value="">Select country</option>
                  {countries.map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Clinic Address">
                <input className="de-input" name="clinicAddress" value={form.clinicAddress} onChange={onChange} disabled={isReadOnly} placeholder="Full clinic address" />
              </Field>
              <Field label="City">
                <input className="de-input" name="city" value={form.city} onChange={onChange} disabled={isReadOnly} placeholder="Mumbai" />
              </Field>
            </div>
          </section>

          {/* ─── SECTION 3: CREDENTIALS ─── */}
          <section id="credentials" className="de-section">
            <div className="de-section-heading">
              <span className="de-section-num">03</span>
              <div>
                <h2>Credentials & Verification</h2>
                <p>Medical registration and identity documents</p>
              </div>
            </div>

            <div className="de-grid-2">
              <Field label="Medical Registration Number" error={errors.medicalRegistrationNumber} req>
                <input className="de-input" name="medicalRegistrationNumber" value={form.medicalRegistrationNumber} onChange={onChange} disabled={isReadOnly} placeholder="MCI / State reg number" />
              </Field>
              <Field label="Medical License Number" error={errors.medicalLicense} req>
                <input className="de-input" name="medicalLicense" value={form.medicalLicense} onChange={onChange} disabled={isReadOnly} placeholder="State medical license" />
              </Field>
              <Field label="Medical Council">
                <select className="de-input de-select" name="medicalCouncilName" value={form.medicalCouncilName} onChange={onChange} disabled={isReadOnly}>
                  <option value="">Select (optional)</option>
                  <option>Medical Council of India</option>
                  <option>State Medical Council</option>
                  <option>Dental Council of India</option>
                  <option>Other</option>
                </select>
              </Field>
              <Field label="Registration Year">
                <input className="de-input" type="number" name="registrationYear" value={form.registrationYear} onChange={onChange} disabled={isReadOnly} placeholder="e.g. 2010" min="1950" max={new Date().getFullYear()} />
              </Field>
              <Field label="ID Proof Type">
                <select className="de-input de-select" name="idProofType" value={form.idProofType} onChange={onChange} disabled={isReadOnly}>
                  <option value="">Optional</option>
                  <option value="Aadhaar">Aadhaar Card</option>
                  <option value="PAN">PAN Card</option>
                  <option value="Passport">Passport</option>
                </select>
              </Field>
              <Field label="ID Proof Number">
                <input className="de-input" name="idProof" value={form.idProof} onChange={onChange} disabled={isReadOnly} placeholder="Optional ID number" />
              </Field>
            </div>

            {/* Cert upload */}
            <Field label="Medical Certification" hint="PDF, JPG, PNG · max 2 MB · optional">
              {hasExistingCert ? (
                <div className="de-file-done">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                  <span>Certificate uploaded</span>
                  {!isReadOnly && <button type="button" className="de-replace-btn" onClick={() => setHasExistingCert(false)}>Replace</button>}
                </div>
              ) : !isReadOnly ? (
                <label className="de-upload-zone">
                  <input type="file" name="medicalCertification" accept=".pdf,.jpg,.jpeg,.png" onChange={onFile} style={{ display: "none" }} />
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                  <span className="de-upload-text">{form.medicalCertification ? form.medicalCertification.name : "Click to upload"}</span>
                  <span className="de-upload-hint">PDF, JPG or PNG</span>
                </label>
              ) : null}
            </Field>

            <div className="de-notice">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
              <p>Documents reviewed in <strong>2–3 business days</strong>. You'll receive an email once approved.</p>
            </div>
          </section>

          {/* ─── SECTION 4: PAYOUT ─── */}
          <section id="payout" className="de-section">
            <div className="de-section-heading">
              <span className="de-section-num">04</span>
              <div>
                <h2>Payout Setup</h2>
                <p>Bank account details to receive consultation payments</p>
              </div>
            </div>

            <div className="de-grid-2">
              <Field label="Account Holder Name" error={errors.accountHolderName} req>
                <input className="de-input" name="accountHolderName" value={form.accountHolderName} onChange={onChange} disabled={isReadOnly} placeholder="As printed on bank account" />
              </Field>
              <Field label="Bank Name" error={errors.bankName} req>
                <input className="de-input" name="bankName" value={form.bankName} onChange={onChange} disabled={isReadOnly} placeholder="State Bank of India" />
              </Field>
              <Field label="Account Number" error={errors.accountNumber} req>
                <input className="de-input" name="accountNumber" value={form.accountNumber} onChange={onChange} disabled={isReadOnly} placeholder="9–18 digit account number" />
              </Field>
              <Field label="IFSC Code" error={errors.ifscCode} req hint="e.g. SBIN0001234">
                <input className="de-input" name="ifscCode" value={form.ifscCode} onChange={onChange} disabled={isReadOnly} placeholder="SBIN0001234" maxLength={11} style={{ textTransform: "uppercase" }} />
              </Field>
              <Field label="Payout Email" error={errors.payoutEmail} hint="Payment notifications only">
                <input className="de-input" type="email" name="payoutEmail" value={form.payoutEmail} onChange={onChange} disabled={isReadOnly} placeholder="payments@example.com" />
              </Field>
            </div>

            <div className="de-notice de-notice--secure">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              <p>Bank details are <strong>encrypted end-to-end</strong> and used solely for payouts.</p>
            </div>
          </section>

          {/* Submit bar */}
          {!isReadOnly && (
            <div className="de-submit-bar">
              <p className="de-submit-note">Fields marked <span className="de-req">*</span> are required</p>
              <button type="submit" className="de-submit-btn" disabled={submitting}>
                {submitting
                  ? <><span className="de-spin" />Submitting…</>
                  : isUpdate ? "Update Application" : "Submit Application"
                }
              </button>
            </div>
          )}

        </form>
      </div>
    </div>
  );
}