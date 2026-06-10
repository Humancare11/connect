import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import { useAdmin } from "../../context/AdminContext";
import "../log.css";

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

export default function PaymentAdminLogin() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAdmin();
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/api/auth/payment-admin-login", form);
      login(res.data.user);
      navigate("/payment-admin/payment-links", { replace: true });
    } catch (err) {
      setError(err.response?.data?.msg || "Payment Admin login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-form-box login-form-box" style={{ left: "50%", transform: "translateX(-50%)" }}>
        <form onSubmit={submit}>
          <h1>Payment Admin Login</h1>
          <span>Generate and manage payment links</span>

          {error && <p className="login-error">{error}</p>}

          <input
            type="email"
            name="email"
            placeholder="paymentadmin@example.com"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            required
          />

          <div className="password-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Enter your password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required
            />
            <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
              <EyeIcon open={showPassword} />
            </button>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
