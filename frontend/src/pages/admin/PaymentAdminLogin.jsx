import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import { useAdmin } from "../../context/AdminContext";
import "../log.css";

export default function PaymentAdminLogin() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
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

          <input
            type="password"
            name="password"
            placeholder="Enter your password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
