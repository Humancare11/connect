import { useEffect, useState } from "react"; // useState still used for sideOpen
import { useNavigate, useLocation, Link } from "react-router-dom";
import "./AdminDashboard.css";
import { useAdmin } from "../../context/AdminContext";
import { Cat } from "lucide-react";

const NAV_ITEMS = [
  {
    section: "Overview",
    items: [
      {
        path: "/admin-dashboard",
        label: "Dashboard",
        icon: (
<<<<<<< HEAD
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
=======
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
>>>>>>> bedf268684c04f8db54b27ed3a53dbb343adcd6c
          </svg>
        ),
      },
    ],
  },
  {
    section: "Doctors",
    items: [
      {
        path: "/admin-dashboard/our-doctors",
        label: "Our Doctors",
        icon: (
<<<<<<< HEAD
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
=======
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
>>>>>>> bedf268684c04f8db54b27ed3a53dbb343adcd6c
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
            <path d="M12 11v4M10 13h4" />
          </svg>
        ),
      },
      {
        path: "/admin-dashboard/manage-doctors",
        label: "Manage Doctors",
        icon: (
<<<<<<< HEAD
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
=======
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
>>>>>>> bedf268684c04f8db54b27ed3a53dbb343adcd6c
          </svg>
        ),
      },
      // {
      //   path: "/admin-dashboard/doctor-payments",
      //   label: "Doctor Payments",
      //   icon: (
      //     <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      //       <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
      //       <line x1="1" y1="10" x2="23" y2="10"/>
      //       <path d="M12 14h.01"/>
      //     </svg>
      //   ),
      // },
    ],
  },
  {
    section: "Management",
    items: [
      {
        path: "/admin-dashboard/manage-users",
        label: "Manage Users",
        icon: (
<<<<<<< HEAD
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
=======
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
>>>>>>> bedf268684c04f8db54b27ed3a53dbb343adcd6c
          </svg>
        ),
      },
      {
        path: "/admin-dashboard/appointments",
        label: "Appointments",
        icon: (
<<<<<<< HEAD
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        ),
      },
      {
        path: "/admin-dashboard/category-consultations",
        label: "Categories Management",
        icon: (
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
=======
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
>>>>>>> bedf268684c04f8db54b27ed3a53dbb343adcd6c
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        ),
      },
      {
        path: "/admin-dashboard/payment-links",
        paymentAdminPath: "/payment-admin/payment-links",
        label: "Payment Links",
        roles: ["paymentadmin"],
        icon: (
<<<<<<< HEAD
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
=======
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
>>>>>>> bedf268684c04f8db54b27ed3a53dbb343adcd6c
            <path d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L11 4.93" />
            <path d="M14 11a5 5 0 0 0-7.07 0L4.81 13.12a5 5 0 0 0 7.07 7.07L13 19.07" />
          </svg>
        ),
      },
      {
        path: "/admin-dashboard/payment-link-history",
        paymentAdminPath: "/payment-admin/payment-history",
        label: "Payment History",
        roles: ["paymentadmin"],
        icon: (
<<<<<<< HEAD
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
=======
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
>>>>>>> bedf268684c04f8db54b27ed3a53dbb343adcd6c
            <path d="M3 3v18h18" />
            <path d="M7 14l3-3 3 2 5-6" />
          </svg>
        ),
      },
    ],
  },
  {
    section: "Content",
    items: [
      {
        path: "/admin-dashboard/qna",
        label: "Medical Q&A",
        icon: (
<<<<<<< HEAD
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
=======
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
>>>>>>> bedf268684c04f8db54b27ed3a53dbb343adcd6c
            <path d="M20 2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6l4 4 4-4h2a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" />
            <path d="M9 9h6M9 12h4" />
          </svg>
        ),
      },
      {
        path: "/admin-dashboard/tickets",
        label: "Support Tickets",
        icon: (
<<<<<<< HEAD
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 5v2" />
            <path d="M15 11v2" />
            <path d="M15 17v2" />
=======
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5v2" /><path d="M15 11v2" /><path d="M15 17v2" />
>>>>>>> bedf268684c04f8db54b27ed3a53dbb343adcd6c
            <path d="M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7a2 2 0 0 1 2-2z" />
          </svg>
        ),
      },
    ],
  },
];

export default function AdminLayout({ children }) {
  const { admin: user, loading, logout: contextLogout } = useAdmin();
  const [sideOpen, setSideOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (
      !loading &&
      (!user || !["admin", "superadmin", "paymentadmin"].includes(user.role))
    ) {
      navigate("/adminauth");
    }
  }, [user, loading, navigate]);

  const logout = async () => {
    await contextLogout();
    navigate(
      user?.role === "paymentadmin" ? "/payment-admin-login" : "/adminauth",
    );
  };

  if (loading || !user) return null;

  const initials = user.name
    ? user.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "AD";

  const EXTRA_TITLES = {
<<<<<<< HEAD
    "/superadmin-dashboard": "Manage Admins",
    "/admin-dashboard/audit-logs": "Audit Logs",
=======
>>>>>>> bedf268684c04f8db54b27ed3a53dbb343adcd6c
    "/payment-admin/payment-links": "Payment Links",
  };
  const pageTitle =
    NAV_ITEMS.flatMap((s) => s.items).find(
      (i) =>
        i.path === location.pathname ||
        i.paymentAdminPath === location.pathname,
    )?.label ||
    EXTRA_TITLES[location.pathname] ||
    "Admin";

<<<<<<< HEAD
  const visibleNavSections = (
    user.role === "paymentadmin"
      ? NAV_ITEMS.map((section) => ({
          section: "Payment Links",
          items: section.items.filter((item) =>
            item.roles?.includes("paymentadmin"),
          ),
        })).filter((section) => section.items.length > 0)
      : NAV_ITEMS
=======
  const visibleNavSections = (user.role === "paymentadmin"
    ? NAV_ITEMS.map(section => ({
      section: "Payment Links",
      items: section.items.filter(item => item.roles?.includes("paymentadmin")),
    })).filter(section => section.items.length > 0)
    : NAV_ITEMS
>>>>>>> bedf268684c04f8db54b27ed3a53dbb343adcd6c
  )
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.roles) return item.roles.includes(user.role);
        return !item.superadminOnly || user.role === "superadmin";
      }),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="ad-root">
      {sideOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.4)",
            zIndex: 199,
          }}
          onClick={() => setSideOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`ad-sidebar${sideOpen ? " open" : ""}`}>
        {/* <div className="ad-brand">
          <div className="ad-brand-mark">H</div>
          <span className="ad-brand-name">Humancare</span>
        </div> */}

        <div className="ad-profile">
          <div className="ad-profile-avatar">{initials}</div>
          <div className="ad-profile-info">
            <div className="ad-profile-name">{user.name}</div>
            <div className="ad-profile-role">
              {user.role === "superadmin"
                ? "Super Admin"
                : user.role === "paymentadmin"
                  ? "Payment Admin"
                  : "Admin"}
            </div>
          </div>
        </div>

        <nav className="ad-nav">
          {visibleNavSections.map((section) => (
            <div key={section.section}>
              <div className="ad-nav-section-label">{section.section}</div>
<<<<<<< HEAD
              {section.items.map((item) => {
                const target =
                  user.role === "paymentadmin" && item.paymentAdminPath
                    ? item.paymentAdminPath
                    : item.path;
=======
              {section.items.map(item => {
                const target = user.role === "paymentadmin" && item.paymentAdminPath ? item.paymentAdminPath : item.path;
>>>>>>> bedf268684c04f8db54b27ed3a53dbb343adcd6c
                const active = location.pathname === target;
                return (
                  <Link
                    key={target}
                    to={target}
                    className={`ad-nav-item${active ? " active" : ""}`}
                    onClick={() => setSideOpen(false)}
                  >
                    <span className="ad-nav-icon">{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
<<<<<<< HEAD

          {user.role === "superadmin" && (
            <>
              <div className="ad-nav-section-label">Super Admin</div>
              <Link
                to="/superadmin-dashboard"
                className={`ad-nav-item${location.pathname === "/superadmin-dashboard" ? " active" : ""}`}
                onClick={() => setSideOpen(false)}
              >
                <span className="ad-nav-icon">
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </span>
                Manage Admins
              </Link>
              <Link
                to="/admin-dashboard/audit-logs"
                className={`ad-nav-item${location.pathname === "/admin-dashboard/audit-logs" ? " active" : ""}`}
                onClick={() => setSideOpen(false)}
              >
                <span className="ad-nav-icon">
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </span>
                Audit Logs
              </Link>
              <Link
                to="/superadmin-dashboard/pricing-management"
                className={`ad-nav-item${location.pathname === "/superadmin-dashboard/pricing-management" ? " active" : ""}`}
                onClick={() => setSideOpen(false)}
              >
                <span className="ad-nav-icon">
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </span>
                Pricing Management
              </Link>
              <Link
                to="/superadmin-dashboard/healthcare-management"
                className={`ad-nav-item${location.pathname === "/superadmin-dashboard/healthcare-management" ? " active" : ""}`}
                onClick={() => setSideOpen(false)}
              >
                <span className="ad-nav-icon">
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 19V5" />
                    <path d="M4 5h16l-2 5 2 5H4" />
                    <path d="M8 9h5" />
                    <path d="M8 13h7" />
                  </svg>
                </span>
                Healthcare Management
              </Link>
            </>
          )}
=======
>>>>>>> bedf268684c04f8db54b27ed3a53dbb343adcd6c
        </nav>

        <div className="ad-sidebar-footer">
          <button className="ad-logout-btn" onClick={logout}>
<<<<<<< HEAD
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
=======
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
>>>>>>> bedf268684c04f8db54b27ed3a53dbb343adcd6c
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="ad-main">
        <header className="ad-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              onClick={() => setSideOpen((p) => !p)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                color: "#64748b",
                padding: 4,
              }}
            >
<<<<<<< HEAD
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
=======
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
>>>>>>> bedf268684c04f8db54b27ed3a53dbb343adcd6c
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="ad-topbar-title">{pageTitle}</div>
          </div>
          <div className="ad-topbar-right">
            <span className="ad-topbar-user">
              👋 {user.name?.split(" ")[0]}
            </span>
          </div>
        </header>

        <div className="ad-content">{children}</div>
      </main>
    </div>
  );
}
