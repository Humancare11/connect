import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAdmin } from "../../../context/AdminContext";
import Icon from "./lcIcons";
import { LiveChatAdminProvider } from "./LiveChatAdminProvider";
import { useLiveChatAdmin } from "./useLiveChatAdmin";
import { useLiveChatTheme } from "./useLiveChatTheme";
import { registerLiveChatTab } from "./liveChatTabs";
import "./livechat-ui.css";
import "./livechat-extra.css";

// Layout of every Live Chat page (docs/live-chat-admin-ui.html): the Live Chat menu on the left, a top bar, and the
// page. All other admin pages keep AdminLayout. The theme, the Geist font and every style are scoped to this shell.
const BASE = "/admin-dashboard/live-chat";
const ITEMS = [
  { path: BASE, label: "Real-time visitors", icon: "eye", exact: true },
  { path: `${BASE}/ai-chats`, label: "AI chats", icon: "bot", badge: "ai" },
  { path: `${BASE}/agent-chats`, label: "Live agent chats", icon: "headset", badge: "live" },
  { path: `${BASE}/archive`, label: "Archive", icon: "archive" },
  { path: `${BASE}/team`, label: "Team", icon: "users" },
  { path: `${BASE}/reports`, label: "Reports", icon: "chart" },
  { path: `${BASE}/settings`, label: "AI agent settings", icon: "sliders" },
];
const FONT_URL = "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap";

const isChatRoute = (pathname) => /\/live-chat\/(ai-chats|agent-chats)(\/|$)/.test(pathname);
const matches = (item, pathname) => (item.exact ? pathname === item.path : pathname === item.path || pathname.startsWith(`${item.path}/`));
const initialsOf = (name) =>
  String(name || "")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

// Geist is loaded from Google Fonts only while a Live Chat page is open.
function useGeistFont() {
  useEffect(() => {
    const links = [];
    const add = (rel, href) => {
      const link = document.createElement("link");
      link.rel = rel;
      link.href = href;
      document.head.appendChild(link);
      links.push(link);
    };
    add("preconnect", "https://fonts.googleapis.com");
    add("stylesheet", FONT_URL);
    return () => links.forEach((link) => link.remove());
  }, []);
}

export default function LiveChatShell({ children }) {
  const { admin: user, logout: contextLogout } = useAdmin();
  const { unread } = useLiveChatAdmin();
  const { theme, toggle } = useLiveChatTheme();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const autoCollapsed = useRef(false); // collapsed by us on the chat pages (for room), given back when leaving

  useGeistFont();

  // The shell is a fixed box: the page itself must not scroll behind it (only the panes inside do).
  useEffect(() => {
    document.documentElement.classList.add("lc-shell-open");
    return () => document.documentElement.classList.remove("lc-shell-open");
  }, []);

  // This is THE Live Chat tab: announce it (so other admin tabs stay quiet) and let other tabs deep-link into it.
  useEffect(() => registerLiveChatTab((path) => navigate(path)), [navigate]);

  useEffect(() => {
    setPhoneOpen(false);
    if (isChatRoute(pathname)) {
      if (!collapsed) {
        autoCollapsed.current = true;
        setCollapsed(true);
      }
    } else if (autoCollapsed.current) {
      autoCollapsed.current = false;
      setCollapsed(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleSide = () => {
    if (window.matchMedia("(max-width: 768px)").matches) {
      setPhoneOpen((open) => !open);
      return;
    }
    autoCollapsed.current = false;
    setCollapsed((value) => !value);
  };

  // Same sign-out as AdminLayout.
  const logout = async () => {
    await contextLogout();
    navigate("/adminauth");
  };

  const roleLabel = user?.role === "superadmin" ? "Super Admin" : "Admin";

  return (
    <div className="lcx" data-theme={theme}>
      <div className={`lx-root${collapsed ? " collapsed" : ""}${phoneOpen ? " side-open" : ""}`}>
        <div className="lx-scrim" onClick={() => setPhoneOpen(false)} />
        <button className="lx-fab" type="button" onClick={toggleSide} aria-label="Open the menu" title="Menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <aside className="lx-sidebar" aria-label="Live Chat menu">
          <div className="lx-profile">
            <div className="lx-profile-avatar">{initialsOf(user?.name) || "A"}</div>
            <div className="lx-profile-info">
              <div className="lx-profile-name">{user?.name || "Admin"}</div>
              <div className="lx-profile-role">{roleLabel}</div>
            </div>
          </div>
          <nav className="lx-nav" data-lenis-prevent>
            <Link to="/admin-dashboard" className="lx-nav-item" title="Admin dashboard">
              <span className="lx-nav-icon">
                <Icon name="back" size={17} />
              </span>
              <span className="lx-nav-label">Admin dashboard</span>
            </Link>
            {ITEMS.map((item) => {
              const active = matches(item, pathname);
              const count = item.badge ? unread[item.badge] || 0 : 0;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`lx-nav-item${active ? " active" : ""}`}
                  title={item.label}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="lx-nav-icon">
                    <Icon name={item.icon} size={17} />
                  </span>
                  <span className="lx-nav-label">{item.label}</span>
                  {count > 0 && <span className="lx-nav-badge">{count > 99 ? "99+" : count}</span>}
                </Link>
              );
            })}
          </nav>
          <div className="lx-sidebar-footer">
            <button
              className="lx-collapse-btn"
              type="button"
              onClick={toggleSide}
              title="Collapse or expand sidebar"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="m11 17-5-5 5-5M18 17l-5-5 5-5" />
              </svg>
              <span className="lx-nav-label">Collapse</span>
            </button>
            <button
              className="lx-collapse-btn lx-theme-btn"
              type="button"
              onClick={toggle}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
              <span className="lx-nav-label">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
            </button>
            <button className="lx-logout-btn" type="button" onClick={logout}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className="lx-nav-label">Sign Out</span>
            </button>
          </div>
        </aside>
        <main className="lx-main">
          <div className="lx-content" data-lenis-prevent>
            {children}
          </div>
        </main>
      </div>
      <LiveChatAdminProvider user={user} />
    </div>
  );
}
