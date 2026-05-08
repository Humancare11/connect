import { useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import socket from "../../socket";
import "./user.css";

export default function UserLayout({ children }) {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [user, loading, navigate]);

  const handleLogout = async () => {
    await logout();
    if (socket.connected) socket.disconnect();
    window.dispatchEvent(new Event("authChange"));
    navigate("/login");
  };

  const menuItems = [
    { path: "/user/dashboard", label: "Dashboard", icon: "🏠" },
    { path: "/user/appointments", label: "Appointments", icon: "📅" },
    { path: "/user/medical-questions", label: "Medical Questions", icon: "❓" },
    { path: "/user/my-records", label: "My Records", icon: "📋" },
    { path: "/user/raise-ticket", label: "Raise a Ticket", icon: "🎫" },
    { path: "/user/profile-settings", label: "Profile Settings", icon: "⚙️" },
    { path: "/user/change-password", label: "Change Password", icon: "🔒" },
  ];

  const currentPage = menuItems.find((m) => m.path === location.pathname);

  if (loading || !user) {
    return (
      <div className="hc-ul__loader">
        <div className="hc-ul__loader-spinner" />
      </div>
    );
  }

  return (
    <div className="hc-ul__page">
      {/* ── Sidebar ── */}
      <aside className="hc-ul__sidebar">
        <div className="hc-ul__brand">
          <div className="hc-ul__brand-dot" />
          <span className="hc-ul__brand-name">HumaniCare</span>
        </div>

        <div className="hc-ul__profile">
          <div className="hc-ul__avatar">
            {user.name?.charAt(0).toUpperCase()}
          </div>
          <div className="hc-ul__profile-info">
            <h4 className="hc-ul__profile-name">{user.name}</h4>
            <p className="hc-ul__profile-email">{user.email}</p>
          </div>
          <span className="hc-ul__profile-badge">Patient</span>
        </div>

        <nav className="hc-ul__nav">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`hc-ul__nav-item ${
                location.pathname === item.path
                  ? "hc-ul__nav-item--active"
                  : ""
              }`}
            >
              <span className="hc-ul__nav-icon">{item.icon}</span>
              <span className="hc-ul__nav-label">{item.label}</span>
              {location.pathname === item.path && (
                <span className="hc-ul__nav-active-dot" />
              )}
            </Link>
          ))}
        </nav>

        <button className="hc-ul__logout" onClick={handleLogout}>
          <span>🚪</span>
          <span>Logout</span>
        </button>
      </aside>

      {/* ── Main ── */}
      <div className="hc-ul__main">
        <header className="hc-ul__topbar">
          <div className="hc-ul__topbar-left">
            <p className="hc-ul__topbar-eyebrow">HumaniCare</p>
            <h1 className="hc-ul__topbar-title">
              {currentPage?.icon} {currentPage?.label || "Dashboard"}
            </h1>
          </div>
          <div className="hc-ul__topbar-right">
            <Link to="/find-a-doctor" className="hc-ul__topbar-book">
              + Book Appointment
            </Link>
            <div className="hc-ul__topbar-avatar">
              {user.name?.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="hc-ul__content">{children}</main>
      </div>
    </div>
  );
}