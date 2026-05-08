import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import socket from "../socket";
import api from "../api";
import { useDoctorAuth } from "../context/DoctorAuthContext";
import "./test.css";

const menuItems = [
  { path: "/doctor-dashboard",              label: "Dashboard",    icon: "dashboard" },
  { path: "/doctor-dashboard/enrollments",  label: "Enrollments",  icon: "enrollments" },
  { path: "/doctor-dashboard/appointments", label: "Appointments", icon: "appointments" },
  { path: "/doctor-dashboard/patients",     label: "My Patients",  icon: "patients" },
  { path: "/doctor-dashboard/messages",     label: "Messages",     icon: "messages" },
  { path: "/doctor-dashboard/analytics",    label: "Analytics",    icon: "analytics" },
  { path: "/doctor-dashboard/settings",     label: "Settings",     icon: "settings" },
];

const NavIcon = ({ name }) => {
  const icons = {
    dashboard: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
    enrollments: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
      </svg>
    ),
    appointments: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
      </svg>
    ),
    patients: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    messages: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    analytics: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
      </svg>
    ),
    settings: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  };
  return icons[name] || null;
};

export default function DoctorLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { doctor, loading, logout: contextLogout } = useDoctorAuth();
  const [sideOpen, setSideOpen] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const tick = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!doctor) {
      navigate("/doctor-login");
      return;
    }

    api.get(`/api/doctor/enrollment/${doctor._id || doctor.id}`)
      .then(res => {
        if (res.data) setIsEnrolled(true);
      })
      .catch(() => {
        setIsEnrolled(doctor.isEnrolled || false);
      });
  }, [doctor, loading, navigate]);

  useEffect(() => {
    if (!socket.connected) socket.connect();
    if (doctor?.id || doctor?._id) {
      socket.emit("user-online", { userId: doctor._id || doctor.id, role: "doctor" });
    }
  }, [doctor]);

  const logout = async () => {
    await contextLogout();
    navigate("/doctor-login");
  };

  if (loading || !doctor) return null;

  const initials = doctor.name
    ? doctor.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "DR";

  const firstName = doctor.name?.split(" ")[0] || "Doctor";

  const getGreeting = () => {
    const h = time.getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const isItemDisabled = (path) =>
    !isEnrolled &&
    path !== "/doctor-dashboard/enrollments" &&
    path !== "/doctor-dashboard";

  return (
    <div className="dl-page">
      {sideOpen && (
        <div className="dl-overlay" onClick={() => setSideOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`dl-sidebar${sideOpen ? " dl-sidebar--open" : ""}`}>
        {/* Brand */}
        <div className="dl-brand">
          <div className="dl-brand-mark">H</div>
          <span className="dl-brand-name">HumaniCare</span>
        </div>

        {/* Doctor Profile Card inside sidebar */}
        <div className="dl-profile-card">
          <div className="dl-profile-avatar">{initials}</div>
          <div className="dl-profile-info">
            <div className="dl-profile-name">{doctor.name || "Doctor"}</div>
            <div className="dl-profile-role">
              {doctor.specialty || "General Physician"}
            </div>
          </div>
          <div className={`dl-online-badge ${isEnrolled ? "dl-online-badge--active" : ""}`} title={isEnrolled ? "Active" : "Pending"} />
        </div>

        {/* Nav label */}
        <div className="dl-nav-label">Navigation</div>

        {/* Nav Items */}
        <nav className="dl-nav">
          {menuItems.map((item) => {
            const disabled = isItemDisabled(item.path);
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`dl-nav-item${active ? " dl-nav-item--active" : ""}${disabled ? " dl-nav-item--disabled" : ""}`}
                onClick={(e) => {
                  if (disabled) { e.preventDefault(); return; }
                  setSideOpen(false);
                }}
              >
                <span className="dl-nav-icon">
                  <NavIcon name={item.icon} />
                </span>
                <span className="dl-nav-label-text">{item.label}</span>
                {item.path === "/doctor-dashboard/messages" && isEnrolled && (
                  <span className="dl-nav-badge">3</span>
                )}
                {active && <span className="dl-nav-active-bar" />}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="dl-sidebar-footer">
          {!isEnrolled && (
            <Link to="/doctor-dashboard/enrollments" className="dl-enroll-nudge">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Complete enrollment
            </Link>
          )}
          <button className="dl-logout-btn" onClick={logout}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="dl-main">
        {/* Topbar */}
        <header className="dl-topbar">
          <div className="dl-topbar-left">
            <button className="dl-hamburger" onClick={() => setSideOpen((p) => !p)} aria-label="Toggle menu">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div className="dl-greeting-wrap">
              <p className="dl-greeting-sub">{getGreeting()},</p>
              <p className="dl-greeting-name">Dr. {firstName} 👋</p>
            </div>
          </div>

          <div className="dl-topbar-right">
            {/* Search */}
            <div className="dl-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input placeholder="Search…" />
            </div>

            {/* Notification */}
            <button className="dl-icon-btn" aria-label="Notifications">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              <span className="dl-notif-dot" />
            </button>

            {/* Avatar */}
            <div className="dl-topbar-avatar" title={doctor.name}>
              {initials}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="dl-content">
          {!isEnrolled && (
            <div className="dl-enroll-banner">
              <div className="dl-enroll-banner-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <div className="dl-enroll-banner-text">
                <strong>Enrollment required</strong> — Complete your profile to unlock all features.
              </div>
              <Link to="/doctor-dashboard/enrollments" className="dl-enroll-banner-cta">
                Enroll now →
              </Link>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
