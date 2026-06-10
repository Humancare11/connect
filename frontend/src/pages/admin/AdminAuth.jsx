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

export default function AdminAuthPage() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState({ super: false, admin: false });

  const [adminForm, setAdminForm] = useState({ email: "", password: "" });
  const [superAdminForm, setSuperAdminForm] = useState({ email: "", password: "" });

  const navigate = useNavigate();
  const { login } = useAdmin();

  const handleAdminChange = (e) =>
    setAdminForm({ ...adminForm, [e.target.name]: e.target.value });

  const handleSuperAdminChange = (e) =>
    setSuperAdminForm({ ...superAdminForm, [e.target.name]: e.target.value });

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/api/auth/admin-login", adminForm);
      const { user } = res.data;

      if (user.role !== "admin") {
        setError("This account is not an Admin. Use Super Admin login.");
        setLoading(false);
        return;
      }

      login(user);
      navigate("/admin-dashboard");
    } catch (err) {
      setError(err.response?.data?.msg || "Admin login failed. Please try again.");
    }

    setLoading(false);
  };

  const handleSuperAdminSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/api/auth/admin-login", superAdminForm);
      const { user } = res.data;

      if (user.role !== "superadmin") {
        setError("This account is not a Super Admin. Use Admin login.");
        setLoading(false);
        return;
      }

      login(user);
      navigate("/superadmin-dashboard");
    } catch (err) {
      setError(err.response?.data?.msg || "Super Admin login failed. Please try again.");
    }

    setLoading(false);
  };

  return (
    <div
      className={`auth-wrapper ${isSuperAdmin ? "panel-active" : ""
        }`}
    >
      {/* SUPER ADMIN LOGIN */}
      <div className="auth-form-box register-form-box">
        <form onSubmit={handleSuperAdminSubmit}>
          <h1>Super Admin Login</h1>

          {/* <div className="social-links">
            <a href="#"><FaFacebookF /></a>
            <a href="#"><FaGoogle /></a>
            <a href="#"><FaLinkedinIn /></a>
          </div> */}

          <span>Restricted access — Super Admin only</span>

          {error && <p className="login-error">{error}</p>}

          <input
            type="email"
            name="email"
            placeholder="superadmin@example.com"
            value={superAdminForm.email}
            onChange={handleSuperAdminChange}
            required
          />

          <div className="password-wrapper">
            <input
              type={showPasswords.super ? "text" : "password"}
              name="password"
              placeholder="Enter your password"
              value={superAdminForm.password}
              onChange={handleSuperAdminChange}
              required
            />
            <button type="button" className="password-toggle" onClick={() => setShowPasswords((p) => ({ ...p, super: !p.super }))} tabIndex={-1}>
              <EyeIcon open={showPasswords.super} />
            </button>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <div className="mobile-switch">
            <p>Regular Admin?</p>
            <button
              type="button"
              onClick={() => {
                setIsSuperAdmin(false);
                setError("");
              }}
            >
              Admin Login
            </button>
          </div>
        </form>
      </div>

      {/* ADMIN LOGIN */}
      <div className="auth-form-box login-form-box">
        <form onSubmit={handleAdminSubmit}>
          <h1>Admin Login</h1>

          {/* <div className="social-links">
            <a href="#"><FaFacebookF /></a>
            <a href="#"><FaGoogle /></a>
            <a href="#"><FaLinkedinIn /></a>
          </div> */}

          <span>Manage doctors, users and content</span>

          {error && <p className="login-error">{error}</p>}

          <input
            type="email"
            name="email"
            placeholder="admin@example.com"
            value={adminForm.email}
            onChange={handleAdminChange}
            required
          />

          <div className="password-wrapper">
            <input
              type={showPasswords.admin ? "text" : "password"}
              name="password"
              placeholder="Enter your password"
              value={adminForm.password}
              onChange={handleAdminChange}
              required
            />
            <button type="button" className="password-toggle" onClick={() => setShowPasswords((p) => ({ ...p, admin: !p.admin }))} tabIndex={-1}>
              <EyeIcon open={showPasswords.admin} />
            </button>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <div className="mobile-switch">
            <p>Super Admin?</p>
            <button
              type="button"
              onClick={() => {
                setIsSuperAdmin(true);
                setError("");
              }}
            >
              Super Admin Login
            </button>
          </div>
        </form>
      </div>

      {/* Sliding Panel */}
      <div className="slide-panel-wrapper">
        <div className="slide-panel">
          {/* Left Panel */}
          <div className="panel-content panel-content-left">
            <h1>Admin Portal</h1>
            <p>
              Manage doctors, users, and platform securely.
            </p>
            <button
              className="transparent-btn"
              onClick={() => {
                setIsSuperAdmin(false);
                setError("");
              }}
            >
              Admin Login
            </button>
          </div>

          {/* Right Panel */}
          <div className="panel-content panel-content-right">
            <h1>Super Admin Portal</h1>
            <p>
              Full platform control. Create and manage admin
              accounts.
            </p>
            <button
              className="transparent-btn"
              onClick={() => {
                setIsSuperAdmin(true);
                setError("");
              }}
            >
              Super Admin Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
