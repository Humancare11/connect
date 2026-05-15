import { useEffect, useState } from "react"; // useState still used for sideOpen
import { useNavigate, useLocation, Link } from "react-router-dom";
import "./AdminDashboard.css";
import { useAdmin } from "../../context/AdminContext";

const NAV_ITEMS = [
  {
    section: "Overview",
    items: [
      {
        path: "/admin-dashboard",
        label: "Dashboard",
        icon: (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
        ),
      },
    ],
  },
  {
    section: "Management",
    items: [
      {
        path: "/admin-dashboard/manage-doctors",
        label: "Manage Doctors",
        icon: (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        ),
      },
      {
        path: "/admin-dashboard/manage-users",
        label: "Manage Users",
        icon: (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        ),
      },
      {
        path: "/admin-dashboard/appointments",
        label: "Appointments",
        icon: (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        ),
      },
      {
        path: "/admin-dashboard/payments",
        label: "Payments",
        superadminOnly: true,
        icon: (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
            <line x1="1" y1="10" x2="23" y2="10"/>
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
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6l4 4 4-4h2a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/>
            <path d="M9 9h6M9 12h4"/>
          </svg>
        ),
      },
      {
        path: "/admin-dashboard/tickets",
        label: "Support Tickets",
        icon: (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5v2"/><path d="M15 11v2"/><path d="M15 17v2"/>
            <path d="M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7a2 2 0 0 1 2-2z"/>
          </svg>
        ),
      },
    ],
  },
];

export default function AdminLayout({ children }) {
  const { admin: user, loading, logout: contextLogout } = useAdmin();
  const [sideOpen, setSideOpen] = useState(false);
  const navigate  = useNavigate();
  const location  = useLocation();

  useEffect(() => {
    if (!loading && (!user || !["admin", "superadmin"].includes(user.role))) {
      navigate("/adminauth");
    }
  }, [user, loading, navigate]);

  const logout = async () => {
    await contextLogout();
    navigate("/adminauth");
  };

  if (loading || !user) return null;

  const initials = user.name
    ? user.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : "AD";

  const pageTitle = NAV_ITEMS.flatMap(s => s.items).find(i => i.path === location.pathname)?.label || "Admin";

  return (
    <div className="ad-root">
      {sideOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 199 }}
          onClick={() => setSideOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`ad-sidebar${sideOpen ? " open" : ""}`}>
        {/* <div className="ad-brand">
          <div className="ad-brand-mark">H</div>
          <span className="ad-brand-name">HumaniCare</span>
        </div> */}

        <div className="ad-profile">
          <div className="ad-profile-avatar">{initials}</div>
          <div className="ad-profile-info">
            <div className="ad-profile-name">{user.name}</div>
            <div className="ad-profile-role">
              {user.role === "superadmin" ? "Super Admin" : "Admin"}
            </div>
          </div>
        </div>

        <nav className="ad-nav">
          {NAV_ITEMS.map(section => (
            <div key={section.section}>
              <div className="ad-nav-section-label">{section.section}</div>
              {section.items
                .filter(item => !item.superadminOnly || user.role === "superadmin")
                .map(item => {
                  const active = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
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

          {user.role === "superadmin" && (
            <>
              <div className="ad-nav-section-label">Super Admin</div>
              <Link
                to="/superadmin-dashboard"
                className="ad-nav-item"
                onClick={() => setSideOpen(false)}
              >
                <span className="ad-nav-icon">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </span>
                Manage Admins
              </Link>
            </>
          )}
        </nav>

        <div className="ad-sidebar-footer">
          <button className="ad-logout-btn" onClick={logout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
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
              onClick={() => setSideOpen(p => !p)}
              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", color: "#64748b", padding: 4 }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div className="ad-topbar-title">{pageTitle}</div>
          </div>
          <div className="ad-topbar-right">
            <span className="ad-topbar-user">👋 {user.name?.split(" ")[0]}</span>
          </div>
        </header>

        <div className="ad-content">{children}</div>
      </main>
    </div>
  );
}
