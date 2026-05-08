import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Doctor.css";
import api from "../../api";
import { useDoctorAuth } from "../../context/DoctorAuthContext";

export default function DoctorRegister() {
  const navigate = useNavigate();
  const { login } = useDoctorAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const set = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setError("");
  };

  const validate = () => {
    if (!form.name.trim()) return "Full name is required.";
    if (!form.email.trim()) return "Email is required.";
    if (!/\S+@\S+\.\S+/.test(form.email)) return "Enter a valid email.";
    if (form.password.length < 6)
      return "Password must be at least 6 characters.";
    if (form.password !== form.confirmPassword)
      return "Passwords do not match.";
    return "";
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    const err = validate();
    if (err) {
      setError(err);
      return;
    }

    setLoading(true);
    setError("");

    try {
      await api.post("/api/doctor/register", {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        confirmPassword: form.confirmPassword,
      });

      // ✅ Register doesn't return a token — just redirect to login
      navigate("/doctor-login");
    } catch (err) {
      // ✅ Backend sends "msg" not "message"
      setError(
        err.response?.data?.msg ||
          "Could not connect to server. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dr-page">
      <div className="dr-panel dr-panel--left">
        <div className="dr-panel-inner">
          <Link to="/" className="dr-brand">
            <div className="dr-brand-mark">H</div>
            <span className="dr-brand-name">HumaniCare</span>
          </Link>

          <div className="dr-panel-hero">
            <div className="dr-panel-icon">🩺</div>
            <h2 className="dr-panel-title">
              Join our network,
              <br />
              Doctor
            </h2>
            <p className="dr-panel-sub">
              Register to start your journey with HumaniCare.
            </p>
          </div>
        </div>
      </div>

      <div className="dr-panel dr-panel--right">
        <div className="dr-form-wrap">
          <div className="dr-form-header">
            <h1 className="dr-form-title">Doctor Registration</h1>
            <p className="dr-form-sub">Create your professional account</p>
          </div>

          {error && (
            <div className="dr-error">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} noValidate>
            <div className="dr-fields">
              <div className="dr-field">
                <label>
                  Full Name <span className="dr-req">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={set("name")}
                  placeholder="Dr. John Doe"
                  autoFocus
                  disabled={loading}
                />
              </div>

              <div className="dr-field">
                <label>
                  Email Address <span className="dr-req">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  placeholder="doctor@example.com"
                  disabled={loading}
                />
              </div>

              <div className="dr-field">
                <label>
                  Password <span className="dr-req">*</span>
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={set("password")}
                  placeholder="Create a password"
                  disabled={loading}
                />
              </div>

              <div className="dr-field">
                <label>
                  Confirm Password <span className="dr-req">*</span>
                </label>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={set("confirmPassword")}
                  placeholder="Repeat your password"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="dr-btn-row dr-btn-row--single">
              <button
                type="submit"
                className="dr-btn-primary"
                disabled={loading}
              >
                {loading ? "Registering…" : "Register →"}
              </button>
            </div>
          </form>

          <p className="dr-switch">
            Already have an account? <Link to="/doctor-login">Login here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
