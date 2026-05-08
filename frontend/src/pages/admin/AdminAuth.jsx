import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import { useAdmin } from "../../context/AdminContext";

export default function AdminAuthPage() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

          <input
            type="password"
            name="password"
            placeholder="Enter your password"
            value={superAdminForm.password}
            onChange={handleSuperAdminChange}
            required
          />

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

          <input
            type="password"
            name="password"
            placeholder="Enter your password"
            value={adminForm.password}
            onChange={handleAdminChange}
            required
          />

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