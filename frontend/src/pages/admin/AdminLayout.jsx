import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import ErrorBoundary from "../../components/ui/ErrorBoundary";
import "./AdminDashboard.css";
import "./AdminShell.css";
import { useAdmin } from "../../context/AdminContext";
import DirectCallAlertsBell from "./DirectCallAlertsBell";
import { LiveChatAdminProvider } from "./livechat/LiveChatAdminProvider";
import { NAV_ITEMS, buildNav, pathMatches, targetOf } from "./adminNav";

const svg = (children) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const ICONS = {
  dashboard: svg(
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  ourDoctors: svg(
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
      <path d="M12 11v4M10 13h4" />
    </>
  ),
  users: svg(
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  calendar: svg(
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </>
  ),
  video: svg(
    <>
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </>
  ),
  link: svg(
    <>
      <path d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L11 4.93" />
      <path d="M14 11a5 5 0 0 0-7.07 0L4.81 13.12a5 5 0 0 0 7.07 7.07L13 19.07" />
    </>
  ),
  chart: svg(
    <>
      <path d="M3 3v18h18" />
      <path d="M7 14l3-3 3 2 5-6" />
    </>
  ),
  document: svg(
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </>
  ),
  shield: svg(
    <>
      <path d="M20 13c0 5-3.5 7.5-7.35 8.95a1 1 0 0 1-1.3 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.79 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  partners: svg(
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  chat: svg(
    <>
      <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </>
  ),
  email: svg(
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  ticket: svg(
    <>
      <path d="M15 5v2" /><path d="M15 11v2" /><path d="M15 17v2" />
      <path d="M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7a2 2 0 0 1 2-2z" />
    </>
  ),
};

// Extra icons used only by the shell itself.
const SHELL_ICONS = {
  chevronRight: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  ),
  chevronLeft: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m15 6-6 6 6 6" />
    </svg>
  ),
  chevronDown: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
  burger: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  ),
  signOut: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
    </svg>
  ),
};

const COLLAPSE_KEY = "hc-admin-sidebar-collapsed";

// Whether the sidebar is shrunk to icons, remembered per browser. Storage can be missing or blocked: then it is just not remembered.
const readCollapsed = () => {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
};
const saveCollapsed = (value) => {
  try {
    window.localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0");
  } catch {
    /* not remembered */
  }
};

// Counts shown on the right of a menu entry (and as a dot when the sidebar is collapsed). The menu has no counts today, so
// this is empty; an entry with a number here shows it (grey, or red for Email and Live Chat).
const NAV_COUNTS = {};
const HOT_KEYS = new Set(["email", "live-chat"]);

const ROLE_LABELS = { superadmin: "Super Admin", paymentadmin: "Payment Admin", admin: "Admin" };
const ROLE_CLASSES = { superadmin: "ash-role--super", paymentadmin: "ash-role--payment", admin: "ash-role--admin" };

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = (event) => setMatches(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

function NavCount({ itemKey }) {
  const count = NAV_COUNTS[itemKey];
  if (!count) return null;
  return (
    <>
      <span className={`ash-nav-count${HOT_KEYS.has(itemKey) ? " ash-nav-count--hot" : ""}`}>{count}</span>
      <span className="ash-nav-dot" aria-hidden="true" />
    </>
  );
}

// "Live Chat": a plain anchor that opens the Live Chat dashboard in a new tab on every click. No onClick, no script, no
// window features, no badge, no unread count.
function LiveChatNavLink({ item, mini }) {
  return (
    <a href={item.path} target="_blank" rel="noopener" className="ash-nav-item" title={mini ? `${item.label} (opens in a new tab)` : "Opens in a new tab"}>
      <span className="ash-nav-icon">{ICONS[item.icon]}</span>
      <span className="ash-nav-label">{item.label}</span>
      <NavCount itemKey={item.key} />
    </a>
  );
}

// A parent entry with a submenu: the submenu expands in place under its parent (click or keyboard) and pushes the entries
// below it down. When the sidebar is collapsed to icons, clicking a parent expands the sidebar and opens it.
function NavGroup({ item, links, active, isLinkActive, open, mini, onToggle, onNavigate }) {
  const menuId = `ad-submenu-${item.key}`;
  const onButtonKeyDown = (event) => {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      onToggle(item.key, false);
    }
  };

  return (
    <div className="ash-nav-group">
      <button
        type="button"
        className={`ash-nav-item ash-nav-parent${active ? " within" : ""}${open ? " open" : ""}`}
        aria-expanded={open}
        aria-controls={menuId}
        title={mini ? item.label : undefined}
        onClick={() => onToggle(item.key, !open)}
        onKeyDown={onButtonKeyDown}
      >
        <span className="ash-nav-icon">{ICONS[item.icon]}</span>
        <span className="ash-nav-label">{item.label}</span>
        <NavCount itemKey={item.key} />
        <span className="ash-nav-arrow" aria-hidden="true">{SHELL_ICONS.chevronRight}</span>
      </button>

      {/* Always rendered so aria-controls resolves; `hidden` keeps it out of the layout and the tab order. */}
      <div className="ash-subnav" id={menuId} hidden={!open || mini}>
        {links.map((link) => (
          <Link
            key={link.target}
            to={link.target}
            className={`ash-nav-item${isLinkActive(link) ? " active" : ""}`}
            aria-current={isLinkActive(link) ? "page" : undefined}
            onClick={onNavigate}
          >
            <span className="ash-nav-icon">{ICONS[link.icon]}</span>
            <span className="ash-nav-label">{link.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// The person at the right of the top bar: initials, name, role badge. Clicking opens a small menu (name, email, Sign out).
function ProfileMenu({ user, onSignOut }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const chip = useRef(null);
  const first = useRef(null);
  const initials = (user.name || "").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "A";
  const roleLabel = ROLE_LABELS[user.role] || "Admin";

  useEffect(() => {
    if (!open) return undefined;
    first.current?.focus();
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      chip.current?.focus();
    };
    const onPointerDown = (event) => {
      if (root.current && !root.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  return (
    <div className="ash-prof" ref={root}>
      <button
        ref={chip}
        type="button"
        className="ash-chip"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${user.name || "Account"}, ${roleLabel}. Account menu`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ash-avatar">{initials}</span>
        <span className="ash-chip-text">
          <b>{user.name}</b>
          <span className={`ash-role ${ROLE_CLASSES[user.role] || "ash-role--admin"}`}>{roleLabel.toUpperCase()}</span>
        </span>
        <span className="ash-chip-caret" aria-hidden="true">{SHELL_ICONS.chevronDown}</span>
      </button>
      {open && (
        <div className="ash-menu" role="menu">
          <div className="ash-menu-head">
            <b>{user.name}</b>
            {user.email && <small>{user.email}</small>}
          </div>
          <button
            ref={first}
            type="button"
            role="menuitem"
            className="ash-menu-item ash-menu-item--danger"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            {SHELL_ICONS.signOut}
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function AdminLayout({ children }) {
  const { admin: user, loading, logout: contextLogout } = useAdmin();
  const [sideOpen, setSideOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  // Which submenu is open (a NavItem key), or undefined = "not chosen yet" (the
  // phone drawer then shows the group containing the current page).
  const [openKey, setOpenKey] = useState(undefined);
  const isPhone = useMediaQuery("(max-width: 900px)");
  const burgerRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const mini = collapsed && !isPhone;

  useEffect(() => {
    if (
      !loading &&
      (!user || !["admin", "superadmin", "paymentadmin"].includes(user.role))
    ) {
      navigate("/adminauth");
    }
  }, [user, loading, navigate]);

  // The drawer only exists on phones: drop its open state when the desktop sidebar takes over.
  if (!isPhone && sideOpen) setSideOpen(false);

  // Escape closes the phone drawer and returns focus to the toggle.
  useEffect(() => {
    if (!sideOpen || !isPhone) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      setSideOpen(false);
      burgerRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sideOpen, isPhone]);

  const logout = async () => {
    await contextLogout();
    navigate(
      user?.role === "paymentadmin" ? "/payment-admin-login" : "/adminauth",
    );
  };

  if (loading || !user) return null;

  const pathname = location.pathname;
  const leavesOf = (item) => (item.children ? item.children : [item]);

  // Topbar title: the best (longest) match among ALL pages, either route variant —
  // a detail page under a menu page resolves to that page.
  const EXTRA_TITLES = {
    "/payment-admin/payment-links": "Payment Links",
  };
  let titleLeaf = null;
  let titleParent = null;
  let titleLength = -1;
  NAV_ITEMS.forEach((item) => {
    leavesOf(item).forEach((leaf) => {
      [leaf.path, leaf.paymentAdminPath].filter(Boolean).forEach((candidate) => {
        if (pathMatches(candidate, pathname, leaf.exact) && candidate.length > titleLength) {
          titleLeaf = leaf;
          titleParent = item.children ? item.label : null;
          titleLength = candidate.length;
        }
      });
    });
  });
  const pageTitle = (titleLeaf && (titleLeaf.title || titleLeaf.label)) || EXTRA_TITLES[pathname] || "Admin";
  const crumbParent = titleParent || "Workspace";

  // Menu entries this role can see (see adminNav.js).
  const visibleItems = buildNav(user.role, { liveChat: import.meta.env.VITE_LIVECHAT_ENABLED === "true" });

  // Highlight the best (longest) match among the visible pages, so exactly one
  // page — and its parent — is active.
  let activeTarget = null;
  visibleItems.flatMap((item) => (item.links ? item.links : [{ ...item, target: targetOf(item, user.role) }])).forEach((leaf) => {
    if (pathMatches(leaf.target, pathname, leaf.exact) && leaf.target.length > (activeTarget?.length ?? -1)) {
      activeTarget = leaf.target;
    }
  });
  const isLinkActive = (link) => link.target === activeTarget;

  const closeDrawer = () => setSideOpen(false);
  const toggleCollapsed = () => {
    setCollapsed((value) => {
      saveCollapsed(!value);
      return !value;
    });
  };
  // A parent was clicked: open or close its submenu. In the collapsed sidebar there is no room for it, so expand first.
  const toggleGroup = (key, open) => {
    if (mini) {
      setCollapsed(false);
      saveCollapsed(false);
      setOpenKey(key);
      return;
    }
    setOpenKey(open ? key : null);
  };

  return (
    <div className={`ad-root ash-root${mini ? " ash-mini" : ""}`}>
      {/* Live chat: one shared connection for every admin page (unread badges, toasts). Admin + superadmin only. */}
      <LiveChatAdminProvider user={user} />
      {sideOpen && isPhone && <div className="ash-scrim" onClick={() => setSideOpen(false)} />}

      {/* ── Sidebar ── */}
      {/* inert: a closed phone drawer is off-screen, so keep its links out of the tab order */}
      <aside
        id="ad-sidebar"
        className={`ash-sidebar${sideOpen ? " open" : ""}`}
        aria-label="Admin navigation"
        inert={isPhone && !sideOpen}
      >
        <div className="ash-brand">
          <span className="ash-logo" aria-hidden="true">H</span>
          <div className="ash-brand-text">
            <b>Humancare</b>
            <small>ADMIN CONSOLE</small>
          </div>
          <button
            type="button"
            className="ash-collapse"
            aria-label={mini ? "Expand sidebar" : "Collapse sidebar"}
            title={mini ? "Expand sidebar" : "Collapse sidebar"}
            onClick={toggleCollapsed}
          >
            {SHELL_ICONS.chevronLeft}
          </button>
        </div>

        <nav className="ash-nav" aria-label="Main">
          {visibleItems.map((item) => {
            if (item.links) {
              const active = item.links.some(isLinkActive);
              const open = openKey === item.key || (openKey === undefined && active);
              return (
                <NavGroup
                  key={item.key}
                  item={item}
                  links={item.links}
                  active={active}
                  isLinkActive={isLinkActive}
                  open={open}
                  mini={mini}
                  onToggle={toggleGroup}
                  onNavigate={closeDrawer}
                />
              );
            }
            if (item.external) return <LiveChatNavLink key={item.key} item={item} mini={mini} />;
            const target = targetOf(item, user.role);
            const active = target === activeTarget;
            return (
              <Link
                key={target}
                to={target}
                className={`ash-nav-item${active ? " active" : ""}`}
                aria-current={active ? "page" : undefined}
                title={mini ? item.label : undefined}
                onClick={closeDrawer}
              >
                <span className="ash-nav-icon">{ICONS[item.icon]}</span>
                <span className="ash-nav-label">{item.label}</span>
                <NavCount itemKey={item.key} />
              </Link>
            );
          })}
        </nav>

        <div className="ash-foot">
          <button type="button" className="ash-nav-item ash-signout" title="Sign out" onClick={logout}>
            <span className="ash-nav-icon">{SHELL_ICONS.signOut}</span>
            <span className="ash-nav-label">Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="ad-main ash-main" id="main-content" tabIndex={-1}>
        <header className="ash-topbar">
          <button
            ref={burgerRef}
            type="button"
            className="ad-menu-btn ash-menu-btn"
            aria-label={sideOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-controls="ad-sidebar"
            aria-expanded={sideOpen}
            onClick={() => setSideOpen((p) => !p)}
          >
            {SHELL_ICONS.burger}
          </button>
          <div className="ash-ttl">
            <div className="ash-crumb">
              {crumbParent}
              <span className="ash-crumb-sep" aria-hidden="true">{SHELL_ICONS.chevronRight}</span>
              <span>{pageTitle}</span>
            </div>
            <div className="ash-topbar-title">{pageTitle}</div>
          </div>
          <span className="ash-topbar-sp" />
          <div className="ash-topbar-right">
            {["admin", "superadmin"].includes(user.role) && <DirectCallAlertsBell />}
            <span className="ash-vr" aria-hidden="true" />
            <ProfileMenu user={user} onSignOut={logout} />
          </div>
        </header>

        <div className="ad-content"><ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary></div>
      </main>
    </div>
  );
}
