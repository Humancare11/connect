import { useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import socket from "../../socket";
import "./user.css";

/* ── SVG icon set ─────────────────────────────────────────────── */
const IconDashboard = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
    <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
  </svg>
);
const IconCalendar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const IconQuestion = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
    <circle cx="12" cy="17" r="0.5" fill="currentColor"/>
  </svg>
);
const IconRecords = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);
const IconTicket = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 5v2"/><path d="M15 11v2"/><path d="M15 17v2"/>
    <path d="M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7a2 2 0 0 1 2-2z"/>
  </svg>
);
const IconUser = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconLock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const IconLogout = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);
const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
/* Brand cross mark */
const IconMedical = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
    <path d="M6.5 1.5h3v4h4v3h-4v4h-3v-4h-4v-3h4z"/>
  </svg>
);

/* ── Nav config ───────────────────────────────────────────────── */
const menuItems = [
  { path: "/user/dashboard",          label: "Dashboard",         icon: <IconDashboard /> },
  { path: "/user/appointments",        label: "Appointments",      icon: <IconCalendar /> },
  { path: "/user/medical-questions",   label: "Medical Questions", icon: <IconQuestion /> },
  { path: "/user/my-records",          label: "My Records",        icon: <IconRecords /> },
  { path: "/user/raise-ticket",        label: "Raise a Ticket",    icon: <IconTicket /> },
  { path: "/user/profile-settings",   label: "Profile Settings",  icon: <IconUser /> },
  { path: "/user/change-password",     label: "Change Password",   icon: <IconLock /> },
];

export default function UserLayout({ children }) {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sideOpen, setSideOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [user, loading, navigate]);

  /* Close drawer on route change */
  useEffect(() => { setSideOpen(false); }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    if (socket.connected) socket.disconnect();
    window.dispatchEvent(new Event("authChange"));
    navigate("/login");
  };

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

      {/* Mobile overlay */}
      {sideOpen && (
        <div className="hc-ul__overlay" onClick={() => setSideOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`hc-ul__sidebar${sideOpen ? " hc-ul__sidebar--open" : ""}`}>

        <div className="hc-ul__brand">
          <div className="hc-ul__brand-mark">
            <IconMedical />
          </div>
          <span className="hc-ul__brand-name">HumaniCare</span>
        </div>

        <div className="hc-ul__profile">
          <div className="hc-ul__avatar">
            {user.name?.charAt(0).toUpperCase()}
          </div>
          <div className="hc-ul__profile-name">{user.name}</div>
          <div className="hc-ul__profile-email">{user.email}</div>
          <span className="hc-ul__profile-badge">Patient</span>
        </div>

        <nav className="hc-ul__nav">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`hc-ul__nav-item${location.pathname === item.path ? " hc-ul__nav-item--active" : ""}`}
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
          <IconLogout />
          <span>Sign Out</span>
        </button>
      </aside>

      {/* ── Main ── */}
      <div className="hc-ul__main">
        <header className="hc-ul__topbar">

          {/* Burger */}
          <button
            className="hc-ul__burger"
            onClick={() => setSideOpen((p) => !p)}
            aria-label="Toggle menu"
          >
            <span /><span /><span />
          </button>

          <div className="hc-ul__topbar-left">
            <p className="hc-ul__topbar-eyebrow">HumaniCare</p>
            <h1 className="hc-ul__topbar-title">
              {currentPage?.icon}
              {currentPage?.label || "Dashboard"}
            </h1>
          </div>

          <div className="hc-ul__topbar-right">
            <Link to="/find-a-doctor" className="hc-ul__topbar-book">
              <IconPlus /> Book Appointment
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
