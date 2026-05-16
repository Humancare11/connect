import { useState } from "react";
import api from "../../api";

const STRENGTH_LABELS = ["", "Very Weak", "Weak", "Fair", "Strong", "Very Strong"];
const STRENGTH_COLORS = ["", "#ef4444", "#f97316", "#eab308", "#3b82f6", "#1d4ed8"];

const TIPS = [
  { good: true,  text: "Use at least 8 characters" },
  { good: true,  text: "Mix uppercase & lowercase" },
  { good: true,  text: "Add numbers and symbols" },
  { good: false, text: "Avoid your name or email" },
  { good: false, text: "Don't reuse old passwords" },
  { good: false, text: "Never share your password" },
];

function getStrength(pwd) {
  if (!pwd) return 0;
  let s = 0;
  if (pwd.length >= 6)           s++;
  if (pwd.length >= 10)          s++;
  if (/[A-Z]/.test(pwd))         s++;
  if (/[0-9]/.test(pwd))         s++;
  if (/[^A-Za-z0-9]/.test(pwd))  s++;
  return s;
}

const glassCard = {
  background: "rgba(255,255,255,0.60)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.82)",
  boxShadow: "0 8px 32px rgba(8,58,176,0.12), 0 2px 8px rgba(8,58,176,0.06), inset 0 1px 0 rgba(255,255,255,0.95)",
};

function EyeIcon({ open }) {
  return open ? (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
    </svg>
  );
}

function PasswordField({ id, label, icon, placeholder, autoComplete, formData, show, errors, onChange, onToggle }) {
  const hasError = !!errors[id];
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <label htmlFor={id} style={{
        fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em",
        textTransform: "uppercase", color: "#6b7ca3",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}>
        {label} <span style={{ color: "#3b82f6", marginLeft: "2px" }}>*</span>
      </label>

      <div style={{ position: "relative" }}>
        <span style={{
          position: "absolute", left: "15px", top: "50%", transform: "translateY(-50%)",
          color: hasError ? "#ef4444" : focused ? "#3b82f6" : "#94a3b8",
          pointerEvents: "none", zIndex: 1, transition: "color 0.2s",
          display: "flex", alignItems: "center",
        }}>
          {icon}
        </span>

        <input
          id={id} name={id}
          type={show[id] ? "text" : "password"}
          value={formData[id]}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: "100%", boxSizing: "border-box",
            padding: "13px 48px 13px 44px",
            background: hasError
              ? "rgba(254,242,242,0.65)"
              : focused ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.62)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            border: `1.5px solid ${hasError ? "rgba(239,68,68,0.55)" : focused ? "rgba(59,130,246,0.65)" : "rgba(203,213,225,0.80)"}`,
            borderRadius: "13px",
            outline: "none",
            color: "#0b0443",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "14px",
            fontWeight: 400,
            boxShadow: hasError
              ? "0 0 0 3px rgba(239,68,68,0.10)"
              : focused ? "0 0 0 3px rgba(59,130,246,0.13)" : "none",
            transition: "all 0.2s ease",
          }}
        />

        <button
          type="button"
          onClick={() => onToggle(id)}
          tabIndex={-1}
          style={{
            position: "absolute", right: "13px", top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer",
            color: "#94a3b8", padding: "5px", borderRadius: "7px",
            display: "flex", alignItems: "center", transition: "color 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.color = "#3b82f6"}
          onMouseLeave={e => e.currentTarget.style.color = "#94a3b8"}
        >
          <EyeIcon open={show[id]} />
        </button>
      </div>

      {hasError && (
        <p style={{
          fontSize: "12px", color: "#ef4444", fontWeight: 600, margin: 0,
          display: "flex", alignItems: "center", gap: "5px",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          {errors[id]}
        </p>
      )}
    </div>
  );
}

export default function ChangePassword() {
  const [formData, setFormData] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [show, setShow]         = useState({ currentPassword: false, newPassword: false, confirmPassword: false });
  const [loading, setLoading]   = useState(false);
  const [errors, setErrors]     = useState({});
  const [saved, setSaved]       = useState(false);
  const [serverError, setServerError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: "" }));
    setSaved(false);
    setServerError("");
  };

  const toggleShow = (field) => setShow(prev => ({ ...prev, [field]: !prev[field] }));
  const strength = getStrength(formData.newPassword);

  const validate = () => {
    const errs = {};
    if (!formData.currentPassword) errs.currentPassword = "Current password is required";
    if (!formData.newPassword)     errs.newPassword = "New password is required";
    else if (formData.newPassword.length < 6) errs.newPassword = "Must be at least 6 characters";
    if (!formData.confirmPassword) errs.confirmPassword = "Please confirm your password";
    else if (formData.newPassword !== formData.confirmPassword) errs.confirmPassword = "Passwords do not match";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setServerError("");
    try {
      await api.put("/api/auth/change-password", {
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });
      setFormData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (err) {
      setServerError(err.response?.data?.msg || "Failed to change password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setErrors({});
    setSaved(false);
    setServerError("");
  };

  const passwordsMatch = formData.confirmPassword && !errors.confirmPassword &&
    formData.newPassword === formData.confirmPassword;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800&display=swap');
        * { box-sizing: border-box; }
        input::placeholder { color: #94a3b8 !important; }
        @keyframes hcp-spin { to { transform: rotate(360deg); } }
        @keyframes hcp-fadein { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        .hcp-fadein { animation: hcp-fadein 0.25s ease; }
        @media (max-width: 740px) {
          .hcp-grid { grid-template-columns: 1fr !important; }
          .hcp-tips-col { position: static !important; }
        }
        @media (max-width: 520px) {
          .hcp-actions { flex-direction: column-reverse !important; }
          .hcp-actions > button { width: 100% !important; justify-content: center !important; }
          .hcp-form-body { padding: 20px 18px 24px !important; }
          .hcp-card-head { padding: 20px 18px 16px !important; }
          .hcp-h1 { font-size: 22px !important; }
        }
      `}</style>

      <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#0b0443", maxWidth: "900px", margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: "32px" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#3b82f6", margin: "0 0 8px" }}>
            Account Security
          </p>
          <h1 className="hcp-h1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "28px", fontWeight: 800, margin: "0 0 8px", lineHeight: 1.2, color: "#0b0443", letterSpacing: "-0.5px" }}>
            Change Password
          </h1>
          <p style={{ fontSize: "14px", color: "#6b7ca3", margin: 0 }}>
            Update your account password to keep your account secure
          </p>
        </div>

        {/* ── Layout ── */}
        <div className="hcp-grid" style={{ display: "grid", gridTemplateColumns: "258px 1fr", gap: "20px", alignItems: "start" }}>

          {/* LEFT — Tips */}
          <div className="hcp-tips-col" style={{ position: "sticky", top: "88px" }}>
            <div style={{ ...glassCard, borderRadius: "22px", padding: "26px 22px 22px", display: "flex", flexDirection: "column", gap: "16px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, #083ab0, #3b82f6)", borderRadius: "22px 22px 0 0" }} />
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.95), transparent)" }} />

              {/* icon */}
              <div style={{ width: "50px", height: "50px", borderRadius: "15px", background: "linear-gradient(135deg, rgba(59,130,246,0.14), rgba(8,58,176,0.09))", border: "1px solid rgba(59,130,246,0.22)", display: "flex", alignItems: "center", justifyContent: "center", color: "#1d4ed8" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>

              <div>
                <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "15px", fontWeight: 700, color: "#0b0443", margin: "0 0 3px" }}>Security Tips</h3>
                <p style={{ fontSize: "12px", color: "#6b7ca3", margin: 0 }}>Follow these to stay safe</p>
              </div>

              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                {TIPS.map((tip, i) => (
                  <li key={i} style={{
                    display: "flex", alignItems: "flex-start", gap: "10px",
                    padding: "8px 11px", borderRadius: "10px",
                    background: tip.good ? "rgba(59,130,246,0.06)" : "rgba(239,68,68,0.05)",
                    border: `1px solid ${tip.good ? "rgba(59,130,246,0.14)" : "rgba(239,68,68,0.12)"}`,
                  }}>
                    <span style={{ fontSize: "12px", flexShrink: 0, marginTop: "1px" }}>{tip.good ? "✅" : "🚫"}</span>
                    <span style={{ fontSize: "12.5px", color: "#475569", lineHeight: 1.5, fontWeight: 500 }}>{tip.text}</span>
                  </li>
                ))}
              </ul>

              <div style={{ height: "1px", background: "rgba(255,255,255,0.65)", margin: "2px 0" }} />

              <div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "10px 12px", borderRadius: "10px", background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#3b82f6", flexShrink: 0, boxShadow: "0 0 0 3px rgba(59,130,246,0.20)" }} />
                <span style={{ fontSize: "12px", color: "#1d4ed8", fontWeight: 600 }}>Your data is encrypted &amp; secure</span>
              </div>
            </div>
          </div>

          {/* RIGHT — Form */}
          <div style={{ ...glassCard, borderRadius: "22px", overflow: "hidden", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, #083ab0, #3b82f6)" }} />
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.95), transparent)", zIndex: 1 }} />

            {/* Card header */}
            <div className="hcp-card-head" style={{ padding: "28px 28px 22px", borderBottom: "1px solid rgba(255,255,255,0.65)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{ width: "46px", height: "46px", borderRadius: "14px", background: "linear-gradient(135deg, rgba(59,130,246,0.14), rgba(8,58,176,0.09))", border: "1px solid rgba(59,130,246,0.22)", display: "flex", alignItems: "center", justifyContent: "center", color: "#1d4ed8", flexShrink: 0, boxShadow: "0 2px 10px rgba(59,130,246,0.12)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <div>
                  <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "17px", fontWeight: 700, color: "#0b0443", margin: "0 0 3px" }}>Update Password</h2>
                  <p style={{ fontSize: "13px", color: "#6b7ca3", margin: 0 }}>Fill in the fields below to set a new password</p>
                </div>
              </div>
            </div>

            {/* Toasts */}
            {saved && (
              <div className="hcp-fadein" style={{ margin: "20px 28px 0", padding: "13px 18px", borderRadius: "12px", background: "rgba(239,246,255,0.92)", border: "1px solid rgba(147,197,253,0.70)", color: "#1d4ed8", fontSize: "13px", fontWeight: 600, backdropFilter: "blur(8px)" }}>
                ✅ Password changed successfully! Please use your new password next time.
              </div>
            )}
            {serverError && (
              <div className="hcp-fadein" style={{ margin: "20px 28px 0", padding: "13px 18px", borderRadius: "12px", background: "rgba(254,242,242,0.92)", border: "1px solid rgba(252,165,165,0.70)", color: "#dc2626", fontSize: "13px", fontWeight: 600, backdropFilter: "blur(8px)" }}>
                ⚠️ {serverError}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="hcp-form-body" style={{ padding: "26px 28px 28px", display: "flex", flexDirection: "column", gap: "22px" }}>

              <PasswordField id="currentPassword" label="Current Password" icon={<KeyIcon />} placeholder="Enter your current password" autoComplete="current-password" formData={formData} show={show} errors={errors} onChange={handleChange} onToggle={toggleShow} />

              <div style={{ height: "1px", background: "rgba(255,255,255,0.65)", margin: "-6px 0" }} />

              <PasswordField id="newPassword" label="New Password" icon={<LockIcon />} placeholder="Create a strong new password" autoComplete="new-password" formData={formData} show={show} errors={errors} onChange={handleChange} onToggle={toggleShow} />

              {/* Strength meter */}
              {formData.newPassword && (
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "-10px" }}>
                  <div style={{ display: "flex", gap: "5px", flex: 1 }}>
                    {[1,2,3,4,5].map(n => (
                      <div key={n} style={{ flex: 1, height: "5px", borderRadius: "6px", background: n <= strength ? STRENGTH_COLORS[strength] : "rgba(203,213,225,0.55)", transition: "background 0.3s ease" }} />
                    ))}
                  </div>
                  <span style={{ fontSize: "11.5px", fontWeight: 700, whiteSpace: "nowrap", color: STRENGTH_COLORS[strength], minWidth: "76px", textAlign: "right", transition: "color 0.3s" }}>
                    {STRENGTH_LABELS[strength]}
                  </span>
                </div>
              )}

              <PasswordField id="confirmPassword" label="Confirm New Password" icon={<LockIcon />} placeholder="Re-enter your new password" autoComplete="new-password" formData={formData} show={show} errors={errors} onChange={handleChange} onToggle={toggleShow} />

              {/* Match indicator */}
              {formData.confirmPassword && !errors.confirmPassword && (
                <p style={{ fontSize: "12.5px", fontWeight: 600, margin: "-10px 0 0", color: passwordsMatch ? "#1d4ed8" : "#ef4444", display: "flex", alignItems: "center", gap: "6px" }}>
                  {passwordsMatch ? "✅ Passwords match" : "❌ Passwords don't match"}
                </p>
              )}

              {/* Actions */}
              <div className="hcp-actions" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "12px", paddingTop: "14px", marginTop: "4px", borderTop: "1px solid rgba(255,255,255,0.65)" }}>
                <button
                  type="button"
                  onClick={handleReset}
                  style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "11px 22px", borderRadius: "12px", background: "rgba(255,255,255,0.58)", backdropFilter: "blur(8px)", border: "1.5px solid rgba(203,213,225,0.82)", color: "#6b7ca3", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "13.5px", fontWeight: 600, cursor: "pointer", transition: "all 0.18s ease" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.90)"; e.currentTarget.style.color = "#0b0443"; e.currentTarget.style.borderColor = "rgba(148,163,184,0.90)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.58)"; e.currentTarget.style.color = "#6b7ca3"; e.currentTarget.style.borderColor = "rgba(203,213,225,0.82)"; }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
                  Clear
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "9px", padding: "11px 28px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg, #3b82f6, #083ab0)", color: "#fff", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "13.5px", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", minWidth: "165px", opacity: loading ? 0.75 : 1, boxShadow: "0 4px 18px rgba(59,130,246,0.36), 0 1px 4px rgba(8,58,176,0.22)", transition: "all 0.2s ease" }}
                  onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 10px 26px rgba(59,130,246,0.46), 0 2px 8px rgba(8,58,176,0.28)"; } }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 18px rgba(59,130,246,0.36), 0 1px 4px rgba(8,58,176,0.22)"; }}
                >
                  {loading ? (
                    <>
                      <span style={{ width: "14px", height: "14px", borderRadius: "50%", border: "2.5px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", display: "inline-block", animation: "hcp-spin 0.7s linear infinite", flexShrink: 0 }} />
                      Updating…
                    </>
                  ) : saved ? "✅ Updated!" : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                      Change Password
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