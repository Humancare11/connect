import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import { useEmployeeAdmin } from "../../context/EmployeeAdminContext";
import "./EmployeeLogin.css";

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

export default function EmployeeAdminLogin() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useEmployeeAdmin();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/api/auth/employee-admin-login", form);
      login(res.data.user);
      navigate("/employee-dashboard", { replace: true });
    } catch (err) {
      setError(err.response?.data?.msg || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="eal-login-wrapper">
      <div className="eal-login-card">
        <div className="eal-login-brand">
          <div className="eal-login-brand-mark">H</div>
          <span className="eal-login-brand-name">HumaniCare</span>
        </div>

        <h1 className="eal-login-title">Employee Admin Portal</h1>
        <p className="eal-login-subtitle">Sign in to access your workspace</p>

        {error && <p className="eal-login-error">{error}</p>}

        <form onSubmit={submit} className="eal-login-form">
          <div className="eal-login-field">
            <label htmlFor="ea-email">Email Address</label>
            <input
              id="ea-email"
              type="email"
              placeholder="you@humancare.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div className="eal-login-field">
            <label htmlFor="ea-password">Password</label>
            <div className="eal-login-password-wrap">
              <input
                id="ea-password"
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
                className="eal-login-eye"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          <button type="submit" className="eal-login-btn" disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
