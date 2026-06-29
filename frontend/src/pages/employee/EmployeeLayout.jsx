import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEmployeeAdmin } from "../../context/EmployeeAdminContext";
import "../admin/AdminDashboard.css";

const EA_NAV_ITEMS = [
  {
    section: "Overview",
    items: [
      { path: "/employee-dashboard", label: "Dashboard", icon: DashboardIcon },
    ],
  },
  {
    section: "Task Master",
    items: [
      { path: "/employee-dashboard/my-tasks", label: "My Tasks", icon: TasksIcon },
      { path: "/employee-dashboard/assign-task", label: "Assign Task", icon: AssignTaskIcon },
    ],
  },
];

function DashboardIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );
}

function TasksIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  );
}

function AssignTaskIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14"/>
      <path d="M5 12h14"/>
      <path d="M4 4h16v16H4z"/>
    </svg>
  );
}

export default function EmployeeAdminLayout({ children }) {
  const { employeeAdmin, logout } = useEmployeeAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/employee-login", { replace: true });
  };

  const initials = employeeAdmin?.name
    ? employeeAdmin.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "EA";
  const pageTitle = EA_NAV_ITEMS
    .flatMap((section) => section.items)
    .find((item) => item.path === location.pathname)?.label || "Employee Admin";

  return (
    <div className="ad-root">
      {sidebarOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 199 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`ad-sidebar${sidebarOpen ? " open" : ""}`}>
        <div className="ad-profile">
          <div className="ad-profile-avatar">{initials}</div>
          <div className="ad-profile-info">
            <div className="ad-profile-name">{employeeAdmin?.name}</div>
            <div className="ad-profile-role">Employee Admin</div>
          </div>
        </div>

        <nav className="ad-nav">
          {EA_NAV_ITEMS.map((section) => (
            <div key={section.section}>
              <div className="ad-nav-section-label">{section.section}</div>
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`ad-nav-item${active ? " active" : ""}`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <span className="ad-nav-icon"><Icon /></span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="ad-sidebar-footer">
          <button className="ad-logout-btn" onClick={handleLogout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      <main className="ad-main">
        <header className="ad-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", color: "#cbd5e1", padding: 4 }}
              aria-label="Toggle menu"
            >
              <HamburgerIcon />
            </button>
            <div className="ad-topbar-title">{pageTitle}</div>
          </div>
          <div className="ad-topbar-right">
            <span className="ad-topbar-user">{employeeAdmin?.name?.split(" ")[0]}</span>
          </div>
        </header>

        <div className="ad-content">{children}</div>
      </main>
    </div>
  );
}
