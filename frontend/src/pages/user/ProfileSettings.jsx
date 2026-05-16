import { useEffect, useState } from "react";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";

/* ── shared glass style objects ── */
const glassCard = {
  background: "rgba(255,255,255,0.60)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.82)",
  boxShadow:
    "0 8px 32px rgba(8,58,176,0.12), 0 2px 8px rgba(8,58,176,0.06), inset 0 1px 0 rgba(255,255,255,0.95)",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "13px 14px 13px 44px",
  background: "rgba(255,255,255,0.62)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  border: "1.5px solid rgba(203,213,225,0.80)",
  borderRadius: "13px",
  outline: "none",
  color: "#0b0443",
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  fontSize: "14px",
  fontWeight: 400,
  transition: "all 0.2s ease",
};

/* ── Field wrapper ── */
function Field({ label, required, icon, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <label
        style={{
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#6b7ca3",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        {label}
        {required && (
          <span style={{ color: "#3b82f6", marginLeft: "3px" }}>*</span>
        )}
      </label>
      <div style={{ position: "relative" }}>
        <span
          style={{
            position: "absolute",
            left: "15px",
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: "15px",
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          {icon}
        </span>
        {children}
      </div>
    </div>
  );
}

/* ── Meta info row ── */
function MetaRow({ icon, label, value }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        padding: "9px 12px",
        background: "rgba(255,255,255,0.45)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        border: "1px solid rgba(255,255,255,0.65)",
        borderRadius: "10px",
      }}
    >
      <span style={{ fontSize: "16px", flexShrink: 0, marginTop: "1px" }}>{icon}</span>
      <div>
        <p
          style={{
            fontSize: "10px",
            color: "#6b7ca3",
            fontWeight: 700,
            letterSpacing: "0.5px",
            textTransform: "uppercase",
            margin: "0 0 2px",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          {label}
        </p>
        <p style={{ fontSize: "13px", color: "#0b0443", margin: 0, fontWeight: 500 }}>
          {value}
        </p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════ */
export default function ProfileSettings() {
  const { user, updateUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState("");
  const [formData, setFormData] = useState({
    name: "", email: "", mobile: "", gender: "", dob: "",
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name:   user.name   || "",
        email:  user.email  || "",
        mobile: user.mobile || "",
        gender: user.gender || "",
        dob:    user.dob    || "",
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setSaved(false);
    setError("");
  };

  const handleReset = () => {
    if (user) {
      setFormData({
        name:   user.name   || "",
        email:  user.email  || "",
        mobile: user.mobile || "",
        gender: user.gender || "",
        dob:    user.dob    || "",
      });
    }
    setSaved(false);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await api.put("/api/auth/update-profile", formData);
      updateUser({ ...user, ...formData });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Failed to update profile:", err);
      setError("Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const getMemberSince = () => {
    if (!user?.createdAt) return "—";
    return new Date(user.createdAt).toLocaleDateString("en-IN", {
      day: "numeric", month: "long", year: "numeric",
    });
  };

  const getAge = () => {
    if (!formData.dob) return null;
    const diff = Date.now() - new Date(formData.dob).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  };

  if (!user) return null;

  /* ── focus handler for inputs ── */
  const onFocus = (e) => {
    e.target.style.borderColor = "rgba(59,130,246,0.65)";
    e.target.style.background  = "rgba(255,255,255,0.88)";
    e.target.style.boxShadow   = "0 0 0 3px rgba(59,130,246,0.13)";
  };
  const onBlur = (e) => {
    e.target.style.borderColor = "rgba(203,213,225,0.80)";
    e.target.style.background  = "rgba(255,255,255,0.62)";
    e.target.style.boxShadow   = "none";
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        input::placeholder, textarea::placeholder { color: #94a3b8 !important; }
        select option { background: #fff; color: #0b0443; }
        @keyframes ps-fadein { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes ps-spin   { to { transform: rotate(360deg); } }
        .ps-fadein { animation: ps-fadein 0.25s ease; }
        @media (max-width: 860px) {
          .ps-body   { grid-template-columns: 1fr !important; }
          .ps-avatar-card { flex-direction: row !important; flex-wrap: wrap !important; padding: 22px 24px !important; }
          .ps-avatar-card-center { align-items: flex-start !important; text-align: left !important; }
          .ps-avatar-divider { display: none !important; }
          .ps-meta-grid { flex-direction: row !important; flex-wrap: wrap !important; }
          .ps-sticky { position: static !important; }
        }
        @media (max-width: 580px) {
          .ps-form-row { grid-template-columns: 1fr !important; }
          .ps-form-row-half { max-width: 100% !important; }
          .ps-form-body { padding: 20px 18px 24px !important; }
          .ps-card-head { padding: 20px 18px 16px !important; }
          .ps-actions { flex-direction: column-reverse !important; }
          .ps-actions > button { width: 100% !important; justify-content: center !important; }
        }
      `}</style>

      <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#0b0443", maxWidth: "980px", margin: "0 auto" }}>

        {/* ══ TWO-COLUMN BODY ══ */}
        <div
          className="ps-body"
          style={{ display: "grid", gridTemplateColumns: "268px 1fr", gap: "24px", alignItems: "start" }}
        >

          {/* ── LEFT: Avatar Card ── */}
          <div className="ps-sticky" style={{ position: "sticky", top: "88px" }}>
            <div
              className="ps-avatar-card"
              style={{
                ...glassCard,
                borderRadius: "22px",
                padding: "32px 24px 26px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Blue accent strip */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, #083ab0, #3b82f6)", borderRadius: "22px 22px 0 0" }} />
              {/* Shine */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.95), transparent)", pointerEvents: "none" }} />

              {/* Avatar ring */}
              <div
                className="ps-avatar-card-center"
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", marginTop: "8px" }}
              >
                <div style={{
                  width: "84px", height: "84px", borderRadius: "22px",
                  background: "linear-gradient(135deg, rgba(59,130,246,0.18), rgba(8,58,176,0.10))",
                  backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                  border: "1.5px solid rgba(59,130,246,0.28)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: "12px",
                  boxShadow: "0 4px 20px rgba(59,130,246,0.16)",
                }}>
                  <div style={{
                    width: "68px", height: "68px", borderRadius: "18px",
                    background: "rgba(59,130,246,0.14)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "28px", fontWeight: 800, color: "#1d4ed8",
                  }}>
                    {user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                </div>

                <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "15px", fontWeight: 700, color: "#0b0443", margin: 0, textAlign: "center" }}>
                  {user?.name}
                </h3>
                <p style={{ fontSize: "12px", color: "#6b7ca3", margin: 0, textAlign: "center", wordBreak: "break-all" }}>
                  {user?.email}
                </p>

                {/* Patient badge */}
                <span style={{
                  marginTop: "8px", padding: "3px 14px", borderRadius: "50px",
                  background: "rgba(59,130,246,0.10)",
                  backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
                  color: "#1d4ed8", border: "1px solid rgba(59,130,246,0.24)",
                  fontSize: "10px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase",
                }}>
                  Patient
                </span>
              </div>

              {/* Divider */}
              <div className="ps-avatar-divider" style={{ width: "100%", height: "1px", background: "rgba(255,255,255,0.65)", margin: "14px 0 8px" }} />

              {/* Meta rows */}
              <div className="ps-meta-grid" style={{ width: "100%", display: "flex", flexDirection: "column", gap: "8px" }}>
                <MetaRow icon="📅" label="Member since" value={getMemberSince()} />
                {formData.gender && (
                  <MetaRow icon="👤" label="Gender" value={formData.gender} />
                )}
                {getAge() && (
                  <MetaRow icon="🎂" label="Age" value={`${getAge()} years old`} />
                )}
                {formData.mobile && (
                  <MetaRow icon="📞" label="Mobile" value={formData.mobile} />
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Form Card ── */}
          <div style={{ ...glassCard, borderRadius: "22px", overflow: "hidden", position: "relative" }}>
            {/* Blue accent strip */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, #083ab0, #3b82f6)" }} />
            {/* Shine */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.95), transparent)", pointerEvents: "none", zIndex: 1 }} />

            {/* Card header */}
            <div
              className="ps-card-head"
              style={{ padding: "28px 28px 22px", borderBottom: "1px solid rgba(255,255,255,0.65)" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{
                  width: "46px", height: "46px", borderRadius: "14px",
                  background: "linear-gradient(135deg, rgba(59,130,246,0.14), rgba(8,58,176,0.09))",
                  border: "1px solid rgba(59,130,246,0.22)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#1d4ed8", flexShrink: 0,
                  boxShadow: "0 2px 10px rgba(59,130,246,0.12)",
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <div>
                  <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "17px", fontWeight: 700, color: "#0b0443", margin: "0 0 3px" }}>
                    Personal Information
                  </h2>
                  <p style={{ fontSize: "13px", color: "#6b7ca3", margin: 0 }}>
                    Update your details below and save
                  </p>
                </div>
              </div>
            </div>

            {/* Toasts */}
            {saved && (
              <div className="ps-fadein" style={{ margin: "20px 28px 0", padding: "13px 18px", borderRadius: "12px", background: "rgba(239,246,255,0.92)", border: "1px solid rgba(147,197,253,0.70)", color: "#1d4ed8", fontSize: "13px", fontWeight: 600, backdropFilter: "blur(8px)" }}>
                ✅ Profile updated successfully!
              </div>
            )}
            {error && (
              <div className="ps-fadein" style={{ margin: "20px 28px 0", padding: "13px 18px", borderRadius: "12px", background: "rgba(254,242,242,0.92)", border: "1px solid rgba(252,165,165,0.70)", color: "#dc2626", fontSize: "13px", fontWeight: 600, backdropFilter: "blur(8px)" }}>
                ⚠️ {error}
              </div>
            )}

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              className="ps-form-body"
              style={{ padding: "26px 28px 28px", display: "flex", flexDirection: "column", gap: "20px" }}
            >

              {/* Row 1: Name + Email */}
              <div className="ps-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" }}>
                <Field label="Full Name" required icon="👤">
                  <input
                    style={inputStyle} type="text" id="name" name="name"
                    value={formData.name} onChange={handleChange}
                    placeholder="Your full name" required
                    onFocus={onFocus} onBlur={onBlur}
                  />
                </Field>
                <Field label="Email Address" required icon="✉️">
                  <input
                    style={inputStyle} type="email" id="email" name="email"
                    value={formData.email} onChange={handleChange}
                    placeholder="you@email.com" required
                    onFocus={onFocus} onBlur={onBlur}
                  />
                </Field>
              </div>

              {/* Row 2: Mobile + Gender */}
              <div className="ps-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" }}>
                <Field label="Mobile Number" icon="📞">
                  <input
                    style={inputStyle} type="tel" id="mobile" name="mobile"
                    value={formData.mobile} onChange={handleChange}
                    placeholder="+91 98765 43210"
                    onFocus={onFocus} onBlur={onBlur}
                  />
                </Field>
                <Field label="Gender" icon="⚧">
                  <select
                    style={{
                      ...inputStyle,
                      cursor: "pointer",
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236b7ca3' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 14px center",
                      paddingRight: "36px",
                      appearance: "none",
                      WebkitAppearance: "none",
                    }}
                    id="gender" name="gender"
                    value={formData.gender} onChange={handleChange}
                    onFocus={onFocus} onBlur={onBlur}
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </Field>
              </div>

              {/* Row 3: DOB (half width) */}
              <div className="ps-form-row-half" style={{ maxWidth: "50%" }}>
                <Field label="Date of Birth" icon="🎂">
                  <input
                    style={inputStyle} type="date" id="dob" name="dob"
                    value={formData.dob} onChange={handleChange}
                    onFocus={onFocus} onBlur={onBlur}
                  />
                </Field>
              </div>

              {/* Actions */}
              <div
                className="ps-actions"
                style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "12px", paddingTop: "14px", marginTop: "4px", borderTop: "1px solid rgba(255,255,255,0.65)" }}
              >
                {/* Ghost reset */}
                <button
                  type="button"
                  onClick={handleReset}
                  style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "11px 22px", borderRadius: "12px", background: "rgba(255,255,255,0.58)", backdropFilter: "blur(8px)", border: "1.5px solid rgba(203,213,225,0.82)", color: "#6b7ca3", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "13.5px", fontWeight: 600, cursor: "pointer", transition: "all 0.18s ease" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.90)"; e.currentTarget.style.color = "#0b0443"; e.currentTarget.style.borderColor = "rgba(148,163,184,0.90)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.58)"; e.currentTarget.style.color = "#6b7ca3"; e.currentTarget.style.borderColor = "rgba(203,213,225,0.82)"; }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
                  </svg>
                  Reset
                </button>

                {/* Primary save */}
                <button
                  type="submit"
                  disabled={saving}
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "9px", padding: "11px 28px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg, #3b82f6, #083ab0)", color: "#fff", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "13.5px", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", minWidth: "150px", opacity: saving ? 0.75 : 1, boxShadow: "0 4px 18px rgba(59,130,246,0.36), 0 1px 4px rgba(8,58,176,0.22)", transition: "all 0.2s ease" }}
                  onMouseEnter={e => { if (!saving) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 10px 26px rgba(59,130,246,0.46), 0 2px 8px rgba(8,58,176,0.28)"; } }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 18px rgba(59,130,246,0.36), 0 1px 4px rgba(8,58,176,0.22)"; }}
                >
                  {saving ? (
                    <>
                      <span style={{ width: "14px", height: "14px", borderRadius: "50%", border: "2.5px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", display: "inline-block", animation: "ps-spin 0.7s linear infinite", flexShrink: 0 }} />
                      Saving…
                    </>
                  ) : saved ? "✅ Saved!" : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                        <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                      </svg>
                      Save Changes
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>

        </div>
      </div>
    </>
  );
}