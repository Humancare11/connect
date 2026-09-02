import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import { usePartner } from "../../context/PartnerContext";
import "./PartnerLogin.css";

function EyeIcon({ open }) {
  return open ? (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function PartnerLogin() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = usePartner();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/api/auth/partner-login", form, { authRole: "partner" });
      login(res.data.user, res.data.partner);
      navigate("/partner-dashboard", { replace: true });
    } catch (err) {
      setError(err.response?.data?.msg || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ptl-login-wrapper">
      <div className="ptl-login-card">
        <div className="ptl-login-brand">
          <div className="ptl-login-brand-mark">H</div>
          <span className="ptl-login-brand-name">Humancare</span>
        </div>

        <h1 className="ptl-login-title">Partner Portal</h1>
        <p className="ptl-login-subtitle">Sign in to submit and track care cases</p>

        {error && <p className="ptl-login-error">{error}</p>}

        <form onSubmit={submit} className="ptl-login-form">
          <div className="ptl-login-field">
            <label htmlFor="ptl-email">Email Address</label>
            <input
              id="ptl-email"
              type="email"
              placeholder="partner@company.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div className="ptl-login-field">
            <label htmlFor="ptl-password">Password</label>
            <div className="ptl-login-password-wrap">
              <input
                id="ptl-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                className="ptl-login-eye"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          <button type="submit" className="ptl-login-btn" disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
