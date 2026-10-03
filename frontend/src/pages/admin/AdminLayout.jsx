import { useEffect, useRef, useState } from "react"; // useState still used for sideOpen
import { createPortal } from "react-dom";
import { useNavigate, useLocation, Link } from "react-router-dom";
import "./AdminDashboard.css";
import { useAdmin } from "../../context/AdminContext";
import DirectCallAlertsBell from "./DirectCallAlertsBell";

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
  qna: svg(
    <>
      <path d="M20 2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6l4 4 4-4h2a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" />
      <path d="M9 9h6M9 12h4" />
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

// Flat sidebar. An entry with `children` is a parent that opens a submenu; an
// entry with a `path` is a plain link. `roles` limits who sees an item (as before);
// `title` overrides the topbar title when it differs from the menu label.
// Parents are visible whenever at least one child is.
const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", path: "/admin-dashboard", exact: true, icon: ICONS.dashboard },
  {
    key: "doctors",
    label: "Doctors",
    icon: ICONS.ourDoctors,
    children: [
      { path: "/admin-dashboard/our-doctors", label: "Our Doctors", icon: ICONS.ourDoctors },
      { path: "/admin-dashboard/manage-doctors", label: "Manage Doctors", icon: ICONS.users },
    ],
  },
  { key: "users", label: "Users", title: "Manage Users", path: "/admin-dashboard/manage-users", icon: ICONS.users },
  {
    key: "appointments",
    label: "Appointments",
    icon: ICONS.calendar,
    children: [
      { path: "/admin-dashboard/appointments", label: "Appointments", icon: ICONS.calendar },
      { path: "/admin-dashboard/category-consultations", label: "Category Consultations", icon: ICONS.calendar },
    ],
  },
  { key: "direct-video", label: "Direct Video Consultation", path: "/admin-dashboard/direct-video-consultation", icon: ICONS.video },
  {
    key: "documents",
    label: "Documents",
    icon: ICONS.document,
    children: [
      {
        path: "/admin-dashboard/manual-invoices",
        paymentAdminPath: "/payment-admin/manual-invoices",
        label: "Manual Invoices",
        roles: ["paymentadmin", "admin", "superadmin"],
        icon: ICONS.document,
      },
      { path: "/admin-dashboard/gop", label: "Guarantee of Payment", roles: ["admin", "superadmin"], icon: ICONS.shield },
    ],
  },
  // Payment-admin-only pages. They aren't part of the requested menu order;
  // kept here (visible only to the payment admin role) until they get a home.
  {
    key: "payment-links",
    path: "/admin-dashboard/payment-links",
    paymentAdminPath: "/payment-admin/payment-links",
    label: "Payment Links",
    roles: ["paymentadmin"],
    icon: ICONS.link,
  },
  {
    key: "payment-history",
    path: "/admin-dashboard/payment-link-history",
    paymentAdminPath: "/payment-admin/payment-history",
    label: "Payment History",
    roles: ["paymentadmin"],
    icon: ICONS.chart,
  },
  { key: "partner-cases", label: "Partner Cases", path: "/admin-dashboard/partner-cases", roles: ["admin", "superadmin"], icon: ICONS.partners },
  // Shared company mailboxes (support@, tech@). Same visibility rule as the
  // other admin pages: admin + superadmin, never the payment admin.
  { key: "email", label: "Email", path: "/admin-dashboard/email", roles: ["admin", "superadmin"], icon: ICONS.email },
  { key: "qna", label: "Medical Question Ans", path: "/admin-dashboard/qna", icon: ICONS.qna },
  { key: "tickets", label: "Support Tickets", path: "/admin-dashboard/tickets", icon: ICONS.ticket },
];

// Same visibility rules as before: the payment admin only sees items that name
// that role; everyone else sees items without `roles` or whose `roles` include theirs.
const isVisibleTo = (item, role) => {
  if (role === "paymentadmin") return Boolean(item.roles?.includes("paymentadmin"));
  if (item.roles) return item.roles.includes(role);
  return !item.superadminOnly || role === "superadmin";
};

// A page belongs to a menu item when it is that item's page or any page under it
// (detail pages, assign-doctor pages, …). The dashboard only matches itself.
const pathMatches = (target, pathname, exact) =>
  pathname === target || (!exact && pathname.startsWith(`${target}/`));

const CLOSE_DELAY_MS = 200;
const FLYOUT_GAP_PX = 4;

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

// A parent entry with a submenu: a flyout to the right of the sidebar on
// desktop (hover, click, or keyboard), an inline accordion in the phone drawer.
function NavGroup({ item, links, active, isLinkActive, open, inline, onOpenChange, onNavigate }) {
  const buttonRef = useRef(null);
  const flyoutRef = useRef(null);
  const closeTimer = useRef(null);
  const pinned = useRef(false); // opened / kept open by a click or key, not just by hovering
  const focusFirstOnOpen = useRef(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const menuId = `ad-submenu-${item.key}`;

  const cancelClose = () => clearTimeout(closeTimer.current);
  const close = () => {
    cancelClose();
    pinned.current = false;
    onOpenChange(null);
  };
  const scheduleClose = () => {
    if (inline || pinned.current) return;
    cancelClose();
    closeTimer.current = setTimeout(close, CLOSE_DELAY_MS);
  };
  const show = () => {
    if (!inline && buttonRef.current) {
      const button = buttonRef.current.getBoundingClientRect();
      const sidebar = buttonRef.current.closest(".ad-sidebar").getBoundingClientRect();
      setPosition({ top: button.top, left: sidebar.right + FLYOUT_GAP_PX });
    }
    onOpenChange(item.key);
  };

  const onMouseEnter = () => {
    if (inline) return;
    cancelClose();
    if (!open) show();
  };

  const onClick = (event) => {
    cancelClose();
    if (!open) {
      pinned.current = true;
      focusFirstOnOpen.current = event.detail === 0; // opened with Enter / Space
      show();
    } else if (!inline && !pinned.current) {
      pinned.current = true; // opened by hover, clicked: keep it open
    } else {
      close();
    }
  };

  const focusItem = (index) => {
    const items = flyoutRef.current?.querySelectorAll('[role="menuitem"]');
    if (items?.length) items[(index + items.length) % items.length].focus();
  };

  // After a keyboard open, move focus into the submenu once it is rendered.
  useEffect(() => {
    if (open && focusFirstOnOpen.current) {
      focusFirstOnOpen.current = false;
      focusItem(0);
    }
  });

  // Close on an outside click, and when the page scrolls or resizes under the flyout.
  useEffect(() => {
    if (!open || inline) return undefined;
    const onPointerDown = (event) => {
      if (buttonRef.current?.contains(event.target) || flyoutRef.current?.contains(event.target)) return;
      close();
    };
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("resize", close);
    const nav = buttonRef.current?.closest(".ad-nav");
    nav?.addEventListener("scroll", close);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("resize", close);
      nav?.removeEventListener("scroll", close);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, inline]);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const onButtonKeyDown = (event) => {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      close();
    } else if ((event.key === "ArrowRight" || event.key === "ArrowDown") && !inline) {
      event.preventDefault();
      if (!open) {
        pinned.current = true;
        focusFirstOnOpen.current = true;
        show();
      } else focusItem(0);
    } else if (event.key === "Tab" && !event.shiftKey && open && !inline) {
      event.preventDefault();
      focusItem(0);
    }
  };

  const onMenuKeyDown = (event) => {
    const items = [...(flyoutRef.current?.querySelectorAll('[role="menuitem"]') || [])];
    const index = items.indexOf(document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      buttonRef.current?.focus();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(index - 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      buttonRef.current?.focus();
    } else if (event.key === "Tab") {
      if (event.shiftKey && index === 0) {
        event.preventDefault();
        buttonRef.current?.focus();
      } else if (!event.shiftKey && index === items.length - 1) {
        // Leave the submenu: close it and continue with the next sidebar entry.
        event.preventDefault();
        close();
        const focusables = [
          ...document.querySelectorAll(".ad-nav > a.ad-nav-item, .ad-nav > .ad-nav-group > .ad-nav-parent, .ad-logout-btn"),
        ];
        const at = focusables.indexOf(buttonRef.current);
        (focusables[at + 1] || buttonRef.current)?.focus();
      }
    }
  };

  const linkClass = (link) => `ad-nav-item ad-flyout-item${isLinkActive(link) ? " active" : ""}`;
  const handleNavigate = () => {
    close();
    onNavigate();
  };

  return (
    <div className="ad-nav-group">
      <button
        ref={buttonRef}
        type="button"
        className={`ad-nav-item ad-nav-parent${active ? " active" : ""}${open ? " open" : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        onMouseEnter={onMouseEnter}
        onMouseLeave={scheduleClose}
        onClick={onClick}
        onKeyDown={onButtonKeyDown}
      >
        <span className="ad-nav-icon">{item.icon}</span>
        {item.label}
        <span className="ad-nav-arrow" aria-hidden="true">›</span>
      </button>

      {open && inline && (
        <div className="ad-subnav" id={menuId}>
          {links.map((link) => (
            <Link key={link.target} to={link.target} className={`ad-nav-item${isLinkActive(link) ? " active" : ""}`} onClick={handleNavigate}>
              <span className="ad-nav-icon">{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </div>
      )}

      {open &&
        !inline &&
        createPortal(
          <div
            ref={flyoutRef}
            id={menuId}
            className="ad-flyout"
            role="menu"
            aria-label={item.label}
            style={{ top: position.top, left: position.left }}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            onKeyDown={onMenuKeyDown}
          >
            {links.map((link) => (
              <Link key={link.target} to={link.target} role="menuitem" className={linkClass(link)} onClick={handleNavigate}>
                <span className="ad-nav-icon">{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}

export default function AdminLayout({ children }) {
  const { admin: user, loading, logout: contextLogout } = useAdmin();
  const [sideOpen, setSideOpen] = useState(false);
  // Which submenu is open (a NavItem key), or undefined = "not chosen yet" (the
  // phone drawer then shows the group containing the current page).
  const [openKey, setOpenKey] = useState(undefined);
  const isPhone = useMediaQuery("(max-width: 768px)");
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

  const pathname = location.pathname;
  const targetOf = (link) =>
    user.role === "paymentadmin" && link.paymentAdminPath ? link.paymentAdminPath : link.path;
  const withTarget = (link) => ({ ...link, target: targetOf(link) });

  // Leaves = every page-level entry (children of parents, or plain items).
  const leavesOf = (item) => (item.children ? item.children : [item]);

  // Topbar title: the best (longest) match among ALL pages, either route variant —
  // a detail page under a menu page resolves to that page.
  const EXTRA_TITLES = {
    "/payment-admin/payment-links": "Payment Links",
  };
  let titleLeaf = null;
  let titleLength = -1;
  NAV_ITEMS.flatMap(leavesOf).forEach((leaf) => {
    [leaf.path, leaf.paymentAdminPath].filter(Boolean).forEach((candidate) => {
      if (pathMatches(candidate, pathname, leaf.exact) && candidate.length > titleLength) {
        titleLeaf = leaf;
        titleLength = candidate.length;
      }
    });
  });
  const pageTitle = (titleLeaf && (titleLeaf.title || titleLeaf.label)) || EXTRA_TITLES[pathname] || "Admin";

  // Menu entries this role can see. Parents need at least one visible child.
  const visibleItems = NAV_ITEMS.map((item) =>
    item.children
      ? { ...item, links: item.children.filter((c) => isVisibleTo(c, user.role)).map(withTarget) }
      : item
  ).filter((item) => (item.children ? item.links.length > 0 : isVisibleTo(item, user.role)));

  // Highlight the best (longest) match among the visible pages, so exactly one
  // page — and its parent — is active.
  let activeTarget = null;
  visibleItems.flatMap((item) => (item.links ? item.links : [withTarget(item)])).forEach((leaf) => {
    if (pathMatches(leaf.target, pathname, leaf.exact) && leaf.target.length > (activeTarget?.length ?? -1)) {
      activeTarget = leaf.target;
    }
  });
  const isLinkActive = (link) => link.target === activeTarget;

  const closeDrawer = () => setSideOpen(false);

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
          {visibleItems.map((item) => {
            if (item.links) {
              const active = item.links.some(isLinkActive);
              const open = openKey === item.key || (openKey === undefined && isPhone && active);
              return (
                <NavGroup
                  key={item.key}
                  item={item}
                  links={item.links}
                  active={active}
                  isLinkActive={isLinkActive}
                  open={open}
                  inline={isPhone}
                  onOpenChange={setOpenKey}
                  onNavigate={closeDrawer}
                />
              );
            }
            const link = withTarget(item);
            return (
              <Link
                key={link.target}
                to={link.target}
                className={`ad-nav-item${isLinkActive(link) ? " active" : ""}`}
                onClick={closeDrawer}
              >
                <span className="ad-nav-icon">{link.icon}</span>
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ad-sidebar-footer">
          <button className="ad-logout-btn" onClick={logout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="ad-topbar-title">{pageTitle}</div>
          </div>
          <div className="ad-topbar-right">
            <DirectCallAlertsBell />
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
