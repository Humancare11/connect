import { useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import socket from "../../socket";
import "./DoctorLayout.css";
import api from "../../api";
import { useDoctorAuth } from "../../context/DoctorAuthContext";

/* ── SVG icon set ─────────────────────────────────────────────── */
const IconDashboard = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
    <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
  </svg>
);
const IconProfile = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconCalendar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const IconPatients = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconQna = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 9h6M9 12h4"/>
    <path d="M20 2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6l4 4 4-4h2a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/>
  </svg>
);
const IconTicket = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 5v2"/><path d="M15 11v2"/><path d="M15 17v2"/>
    <path d="M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7a2 2 0 0 1 2-2z"/>
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

/* ── Nav config ───────────────────────────────────────────────── */
const menuItems = [
  { path: "/doctor-dashboard",              label: "Dashboard",    icon: <IconDashboard /> },
  { path: "/doctor-dashboard/profile",      label: "My Profile",   icon: <IconProfile /> },
  { path: "/doctor-dashboard/appointments", label: "Appointments", icon: <IconCalendar /> },
  { path: "/doctor-dashboard/patients",     label: "My Patients",  icon: <IconPatients /> },
  { path: "/doctor-dashboard/qna",          label: "Medical Q&A",  icon: <IconQna /> },
  { path: "/doctor-dashboard/raise-ticket", label: "Raise Ticket", icon: <IconTicket /> },
];

export default function DoctorLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { doctor, loading, logout: contextLogout } = useDoctorAuth();
  const [sideOpen, setSideOpen] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [formCompleted, setFormCompleted] = useState(false);
  const [enrollmentLoaded, setEnrollmentLoaded] = useState(false);

  useEffect(() => {
    if (!loading && !doctor) {
      navigate("/doctor-login");
      return;
    }
    if (doctor) {
      api.get(`/api/doctor/enrollment/${doctor._id || doctor.id}`)
        .then((res) => {
          const enrollment = res.data;
          setIsEnrolled(enrollment?.approvalStatus === "approved");
          setFormCompleted(enrollment?.formCompleted === true);
        })
        .catch(() => {
          setIsEnrolled(doctor.isEnrolled || false);
          setFormCompleted(false);
        })
        .finally(() => setEnrollmentLoaded(true));
    }
  }, [doctor, loading, navigate]);

  useEffect(() => {
    if (!enrollmentLoaded) return;
    if (!formCompleted) {
      navigate("/doctor-dashboard/enrollments", { replace: true });
    } else if (!isEnrolled) {
      navigate("/doctor-pending", { replace: true });
    }
  }, [enrollmentLoaded, formCompleted, isEnrolled, navigate]);

  useEffect(() => {
    if (!socket.connected) socket.connect();
    if (doctor?._id || doctor?.id) {
      socket.emit("user-online", { userId: doctor._id || doctor.id, role: "doctor" });
    }
  }, [doctor]);

  /* Close drawer on route change */
  useEffect(() => { setSideOpen(false); }, [location.pathname]);

  const logout = async () => {
    await contextLogout();
    navigate("/doctor-login");
  };

  if (loading || !doctor || !enrollmentLoaded) return null;

  const initials = doctor.name
    ? doctor.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "DR";

  const currentPage = menuItems.find((m) => m.path === location.pathname);

  return (
    <div className="dl-page">

      {/* Mobile overlay */}
      {sideOpen && (
        <div className="dl-overlay" onClick={() => setSideOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`dl-sidebar${sideOpen ? " dl-sidebar--open" : ""}`}>

        <div className="dl-brand">
          <span className="dl-brand-name">Humancare Connect</span>
        </div>

        <div className="dl-profile">
          <div className="dl-avatar">{initials}</div>
          <div className="dl-profile-name">{doctor.name || "Doctor"}</div>
          <div className="dl-profile-email">{doctor.email || doctor.specialty}</div>
          <span className="dl-profile-badge">
            Doctor
            <span className={`dl-online-dot${isEnrolled ? " dl-online-dot--active" : ""}`} />
          </span>
        </div>

        <nav className="dl-nav">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`dl-nav-item${location.pathname === item.path ? " dl-nav-item--active" : ""}`}
            >
              <span className="dl-nav-icon">{item.icon}</span>
              <span className="dl-nav-label">{item.label}</span>
              {location.pathname === item.path && (
                <span className="dl-nav-active-dot" />
              )}
            </Link>
          ))}
        </nav>

        <button className="dl-logout" onClick={logout}>
          <IconLogout />
          <span>Sign Out</span>
        </button>
      </aside>

      {/* ── Main ── */}
      <div className="dl-main">
        <header className="dl-topbar">

          {/* Burger */}
          <button
            className="dl-burger"
            onClick={() => setSideOpen((p) => !p)}
            aria-label="Toggle menu"
          >
            <span /><span /><span />
          </button>

          <div className="dl-topbar-left">
            <p className="dl-topbar-eyebrow">Humancare Connect</p>
            <h1 className="dl-topbar-title">
              {currentPage?.icon}
              {currentPage?.label || "Dashboard"}
            </h1>
          </div>

          <div className="dl-topbar-right">
            <Link to="/" className="dl-topbar-book">
              <IconPlus /> Home
            </Link>
          </div>
        </header>

        <main className="dl-content">{children}</main>
      </div>
    </div>
  );
}
