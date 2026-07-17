import { useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import socket from "../../socket";
import "./DoctorLayout.css";
import api, { getUserAuthToken } from "../../api";
import { useDoctorAuth } from "../../context/DoctorAuthContext";

/* ── SVG icon set ─────────────────────────────────────────────── */
const IconDashboard = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);
const IconProfile = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const IconCalendar = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IconPatients = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IconQna = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 9h6M9 12h4" />
    <path d="M20 2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6l4 4 4-4h2a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" />
  </svg>
);
const IconNotes = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M8 13h8" />
    <path d="M8 17h6" />
  </svg>
);
const IconTicket = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M15 5v2" />
    <path d="M15 11v2" />
    <path d="M15 17v2" />
    <path d="M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7a2 2 0 0 1 2-2z" />
  </svg>
);
const IconSettings = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.33 1V21a2 2 0 1 1-4 0v-.1a1.65 1.65 0 0 0-.33-1 1.65 1.65 0 0 0-1-.6 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1-.33H3a2 2 0 1 1 0-4h.1a1.65 1.65 0 0 0 1-.33 1.65 1.65 0 0 0 .6-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .33-1V3a2 2 0 1 1 4 0v.1a1.65 1.65 0 0 0 .33 1 1.65 1.65 0 0 0 1 .6 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.27.31.49.67.6 1 .11.33.17.67.17 1 0 .33-.06.67-.17 1-.11.33-.33.69-.6 1z" />
  </svg>
);
const IconLogout = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
const IconPlus = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

/* ── Nav config ───────────────────────────────────────────────── */
const menuItems = [
  { path: "/doctor-dashboard", label: "Dashboard", icon: <IconDashboard /> },
  {
    path: "/doctor-dashboard/profile",
    label: "My Profile",
    icon: <IconProfile />,
  },
  {
    path: "/doctor-dashboard/appointments",
    label: "Appointments",
    icon: <IconCalendar />,
  },
  {
    path: "/doctor-dashboard/patients",
    label: "My Patients",
    icon: <IconPatients />,
  },
  {
    path: "/doctor-dashboard/notes",
    label: "Notes",
    icon: <IconNotes />,
  },
  { path: "/doctor-dashboard/qna", label: "Medical Q&A", icon: <IconQna /> },
  {
    path: "/doctor-dashboard/raise-ticket",
    label: "Raise Ticket",
    icon: <IconTicket />,
  },
  {
    path: "/doctor-dashboard/settings",
    label: "Settings",
    icon: <IconSettings />,
  },
  {
    key: "publicProfile",
    path: null,
    label: "Doctor Profile For Patients",
    icon: <IconSettings />,
  },
];

export default function DoctorLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { doctor, loading, logout: contextLogout } = useDoctorAuth();
  const [sideOpen, setSideOpen] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [formCompleted, setFormCompleted] = useState(false);
  const [enrollmentLoaded, setEnrollmentLoaded] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  useEffect(() => {
    if (!loading && !doctor) {
      navigate("/doctor-login");
      return;
    }
    if (doctor) {
      api
        .get(`/api/doctor/enrollment/${doctor._id || doctor.id}`)
        .then((res) => {
          const enrollment = res.data;
          setIsEnrolled(
            enrollment?.approvalStatus === "approved" ||
              enrollment?.pendingRequestType === "profile_update",
          );
          setFormCompleted(enrollment?.formCompleted === true);
          setIsOnline(enrollment?.isOnline || false);
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
      navigate("/doctor-dashboard/enrollments", { replace: true });
    }
  }, [enrollmentLoaded, formCompleted, isEnrolled, navigate]);

  useEffect(() => {
    if (!socket.connected) socket.connect();
    if (doctor?._id || doctor?.id) {
      // Pass an explicit, doctor-scoped token so the server can verify this
      // registration fresh instead of relying only on whatever this socket
      // connection's cookies looked like when it first connected — see the
      // matching comment on the server's "user-online" handler for why that
      // distinction matters (it's what prevents a stale identity from an
      // earlier role on this same connection from sticking).
      socket.emit("user-online", {
        userId: doctor._id || doctor.id,
        role: "doctor",
        token: getUserAuthToken("doctor"),
      });
    }
  }, [doctor]);

  /* Close drawer on route change */
  useEffect(() => {
    setSideOpen(false);
  }, [location.pathname]);

  const toggleOnlineStatus = async () => {
    setTogglingStatus(true);
    try {
      const { data } = await api.post("/api/doctor/toggle-online", {
        doctorId: doctor._id || doctor.id,
      });
      setIsOnline(data.isOnline);
    } catch (err) {
      console.error("Could not update status:", err);
    } finally {
      setTogglingStatus(false);
    }
  };

  const logout = async () => {
    await contextLogout();
    navigate("/doctor-login");
  };

  if (loading || !doctor || !enrollmentLoaded) return null;

  const initials = doctor.name
    ? doctor.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "DR";

  const slugify = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");

  const pathForItem = (item) => {
    if (item.key === "publicProfile") {
      const name = slugify(doctor.name || "doctor");
      if (doctor.doctorId) return `/doctors/${doctor.doctorId}-${name}`;
      const id = doctor._id || doctor.id || "";
      return id ? `/doctors/${id}-${name}` : "/doctors/test-doctor";
    }
    return item.path;
  };

  const currentPage = menuItems.find(
    (m) => pathForItem(m) === location.pathname,
  );

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
          <div className="dl-profile-email">
            {doctor.email || doctor.specialty}
          </div>
          <span className="dl-profile-badge">
            Doctor
            <span
              className={`dl-online-dot${isEnrolled ? " dl-online-dot--active" : ""}`}
            />
          </span>
        </div>

        <nav className="dl-nav">
          {menuItems.map((item) => {
            const linkPath = pathForItem(item);
            return (
              <Link
                key={item.key || item.path}
                to={linkPath}
                className={`dl-nav-item${location.pathname === linkPath ? " dl-nav-item--active" : ""}`}
              >
                <span className="dl-nav-icon">{item.icon}</span>
                <span className="dl-nav-label">{item.label}</span>
                {location.pathname === linkPath && (
                  <span className="dl-nav-active-dot" />
                )}
              </Link>
            );
          })}
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
            <span />
            <span />
            <span />
          </button>

          <div className="dl-topbar-left">
            <p className="dl-topbar-eyebrow">Humancare Connect</p>
            <h1 className="dl-topbar-title">
              {currentPage?.icon}
              {currentPage?.label || "Dashboard"}
            </h1>
          </div>

          <div className="dl-topbar-right">
            <button
              type="button"
              role="switch"
              aria-checked={isOnline}
              onClick={toggleOnlineStatus}
              disabled={togglingStatus}
              style={{
                position: "relative",
                width: "48px",
                height: "26px",
                borderRadius: "999px",
                border: "none",
                background: isOnline ? "#10b981" : "#d1d5db",
                cursor: togglingStatus ? "not-allowed" : "pointer",
                opacity: togglingStatus ? 0.6 : 1,
                transition: "background 0.25s ease",
                padding: 0,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: "3px",
                  left: isOnline ? "25px" : "3px",
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  background: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                  transition: "left 0.25s ease",
                }}
              />
            </button>

            <span
              style={{
                fontWeight: 600,
                fontSize: "14px",
                color: isOnline ? "#10b981" : "#6b7280",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: isOnline ? "#10b981" : "#6b7280",
                  animation: isOnline ? "pulse 2s infinite" : "none",
                }}
              />
              {togglingStatus ? "Updating..." : isOnline ? "Online" : "Offline"}
            </span>

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
