import { useState } from "react";
import "./ChangePassword.css";
import api from "../../api";

export default function ChangePassword() {
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [show, setShow] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
    setSaved(false);
    setServerError("");
  };

  const toggleShow = (field) =>
    setShow((prev) => ({ ...prev, [field]: !prev[field] }));

  // Password strength
  const getStrength = (pwd) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 6)  score++;
    if (pwd.length >= 10) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };

  const strengthLabel = ["", "Very Weak", "Weak", "Fair", "Strong", "Very Strong"];
  const strengthColor = ["", "#ef4444", "#f59e0b", "#eab308", "#19c9a3", "#22c55e"];

  const strength = getStrength(formData.newPassword);

  const validate = () => {
    const errs = {};
    if (!formData.currentPassword) errs.currentPassword = "Current password is required";
    if (!formData.newPassword) errs.newPassword = "New password is required";
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
      console.error("Failed to change password:", err);
      setServerError(err.response?.data?.msg || "Failed to change password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hc-cp__page">

      {/* Header */}
      <div className="hc-cp__header">
        <p className="hc-cp__eyebrow">Account</p>
        <h1 className="hc-cp__title">Change Password</h1>
        <p className="hc-cp__subtitle">Update your account password to keep your account secure</p>
      </div>

      <div className="hc-cp__body">

        {/* Left — Security tips */}
        <div className="hc-cp__tips-col">
          <div className="hc-cp__tips-card">
            <div className="hc-cp__tips-icon">🔐</div>
            <h3 className="hc-cp__tips-title">Security Tips</h3>
            <ul className="hc-cp__tips-list">
              {[
                { icon: "✅", text: "Use at least 8 characters" },
                { icon: "✅", text: "Mix uppercase & lowercase letters" },
                { icon: "✅", text: "Include numbers and symbols" },
                { icon: "🚫", text: "Avoid using your name or email" },
                { icon: "🚫", text: "Don't reuse old passwords" },
                { icon: "🚫", text: "Never share your password" },
              ].map((tip, i) => (
                <li key={i} className="hc-cp__tip-item">
                  <span className="hc-cp__tip-icon">{tip.icon}</span>
                  <span>{tip.text}</span>
                </li>
              ))}
            </ul>

            <div className="hc-cp__tips-divider" />

            <div className="hc-cp__security-badge">
              <span className="hc-cp__security-dot" />
              <span>Your data is encrypted & secure</span>
            </div>
          </div>
        </div>

        {/* Right — Form */}
        <div className="hc-cp__form-col">
          <div className="hc-cp__form-card">

            <div className="hc-cp__form-card-header">
              <h2 className="hc-cp__form-title">Update Password</h2>
              <p className="hc-cp__form-sub">Fill in the fields below to set a new password</p>
            </div>

            {/* Toasts */}
            {saved && (
              <div className="hc-cp__toast hc-cp__toast--success">
                ✅ Password changed successfully! Please use your new password next time.
              </div>
            )}
            {serverError && (
              <div className="hc-cp__toast hc-cp__toast--error">
                ⚠️ {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="hc-cp__form">

              {/* Current Password */}
              <div className="hc-cp__field">
                <label className="hc-cp__label" htmlFor="currentPassword">
                  Current Password <span className="hc-cp__required">*</span>
                </label>
                <div className={`hc-cp__input-wrap ${errors.currentPassword ? "hc-cp__input-wrap--error" : ""}`}>
                  <span className="hc-cp__input-icon">🔑</span>
                  <input
                    className="hc-cp__input"
                    type={show.currentPassword ? "text" : "password"}
                    id="currentPassword"
                    name="currentPassword"
                    value={formData.currentPassword}
                    onChange={handleChange}
                    placeholder="Enter current password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="hc-cp__eye-btn"
                    onClick={() => toggleShow("currentPassword")}
                    tabIndex={-1}
                  >
                    {show.currentPassword ? "🙈" : "👁️"}
                  </button>
                </div>
                {errors.currentPassword && (
                  <p className="hc-cp__error">{errors.currentPassword}</p>
                )}
              </div>

              <div className="hc-cp__separator" />

              {/* New Password */}
              <div className="hc-cp__field">
                <label className="hc-cp__label" htmlFor="newPassword">
                  New Password <span className="hc-cp__required">*</span>
                </label>
                <div className={`hc-cp__input-wrap ${errors.newPassword ? "hc-cp__input-wrap--error" : ""}`}>
                  <span className="hc-cp__input-icon">🔒</span>
                  <input
                    className="hc-cp__input"
                    type={show.newPassword ? "text" : "password"}
                    id="newPassword"
                    name="newPassword"
                    value={formData.newPassword}
                    onChange={handleChange}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="hc-cp__eye-btn"
                    onClick={() => toggleShow("newPassword")}
                    tabIndex={-1}
                  >
                    {show.newPassword ? "🙈" : "👁️"}
                  </button>
                </div>
                {errors.newPassword && (
                  <p className="hc-cp__error">{errors.newPassword}</p>
                )}

                {/* Strength meter */}
                {formData.newPassword && (
                  <div className="hc-cp__strength">
                    <div className="hc-cp__strength-bars">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <div
                          key={n}
                          className="hc-cp__strength-bar"
                          style={{
                            background: n <= strength ? strengthColor[strength] : "rgba(255,255,255,0.08)",
                            transition: "background 0.25s",
                          }}
                        />
                      ))}
                    </div>
                    <span
                      className="hc-cp__strength-label"
                      style={{ color: strengthColor[strength] }}
                    >
                      {strengthLabel[strength]}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="hc-cp__field">
                <label className="hc-cp__label" htmlFor="confirmPassword">
                  Confirm New Password <span className="hc-cp__required">*</span>
                </label>
                <div className={`hc-cp__input-wrap ${errors.confirmPassword ? "hc-cp__input-wrap--error" : ""}`}>
                  <span className="hc-cp__input-icon">🔒</span>
                  <input
                    className="hc-cp__input"
                    type={show.confirmPassword ? "text" : "password"}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="hc-cp__eye-btn"
                    onClick={() => toggleShow("confirmPassword")}
                    tabIndex={-1}
                  >
                    {show.confirmPassword ? "🙈" : "👁️"}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="hc-cp__error">{errors.confirmPassword}</p>
                )}
                {/* Match indicator */}
                {formData.confirmPassword && !errors.confirmPassword && (
                  <p className="hc-cp__match">
                    {formData.newPassword === formData.confirmPassword
                      ? "✅ Passwords match"
                      : "❌ Passwords don't match"}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="hc-cp__form-actions">
                <button
                  type="button"
                  className="hc-cp__btn hc-cp__btn--ghost"
                  onClick={() => {
                    setFormData({ currentPassword: "", newPassword: "", confirmPassword: "" });
                    setErrors({});
                    setSaved(false);
                    setServerError("");
                  }}
                >
                  Clear
                </button>
                <button
                  type="submit"
                  className={`hc-cp__btn hc-cp__btn--primary ${loading ? "hc-cp__btn--loading" : ""}`}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="hc-cp__btn-spinner" />
                      Updating…
                    </>
                  ) : saved ? "✅ Updated!" : "Change Password"}
                </button>
              </div>

            </form>
          </div>
        </div>

      </div>
    </div>
  );
}