// The admin panel's menu: one list, every role's view of it, in the order it is drawn. Only data here (icons are named,
// AdminLayout draws them), so the list can be tested without a browser. See adminNav.test.mjs.
//
// Flat sidebar. An entry with `children` is a parent that opens a submenu; an
// entry with a `path` is a plain link. `roles` limits who sees an item (as before);
// `title` overrides the topbar title when it differs from the menu label.
// Parents are visible whenever at least one child is.
export const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", path: "/admin-dashboard", exact: true, icon: "dashboard" },
  {
    key: "doctors",
    label: "Doctors",
    icon: "ourDoctors",
    children: [
      { path: "/admin-dashboard/our-doctors", label: "Our Doctors", icon: "ourDoctors" },
      { path: "/admin-dashboard/manage-doctors", label: "Manage Doctors", icon: "users" },
    ],
  },
  {
    key: "users",
    label: "Users",
    icon: "users",
    children: [
      { path: "/admin-dashboard/manage-users", label: "Manage Users", icon: "users" },
      { path: "/admin-dashboard/deletion-requests", label: "Deletion Requests", icon: "document" },
    ],
  },
  // One list for doctor appointments and category consultations.
  { key: "appointments", label: "Appointments", path: "/admin-dashboard/appointments", icon: "calendar" },
  // The doctor-fee and payout record for every booking (and manual entries). Admin and super admin only; the payment admin has no access.
  { key: "entries", label: "Appointment entries", path: "/admin-dashboard/appointment-entries", roles: ["admin", "superadmin"], icon: "document" },
  { key: "direct-video", label: "Direct Video Consultation", path: "/admin-dashboard/direct-video-consultation", icon: "video" },
  {
    key: "documents",
    label: "Documents",
    icon: "document",
    children: [
      {
        path: "/admin-dashboard/manual-invoices",
        paymentAdminPath: "/payment-admin/manual-invoices",
        label: "Manual Invoices",
        roles: ["paymentadmin", "admin", "superadmin"],
        icon: "document",
      },
      { path: "/admin-dashboard/gop", label: "Guarantee of Payment", roles: ["admin", "superadmin"], icon: "shield" },
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
    icon: "link",
  },
  {
    key: "payment-history",
    path: "/admin-dashboard/payment-link-history",
    paymentAdminPath: "/payment-admin/payment-history",
    label: "Payment History",
    roles: ["paymentadmin"],
    icon: "chart",
  },
  { key: "partner-cases", label: "Partner Cases", path: "/admin-dashboard/partner-cases", roles: ["admin", "superadmin"], icon: "partners" },
  // Shared company mailboxes (support@, tech@). Same visibility rule as the
  // other admin pages: admin + superadmin, never the payment admin.
  { key: "email", label: "Email", path: "/admin-dashboard/email", roles: ["admin", "superadmin"], icon: "email" },
  // Live Chat (admin + superadmin only; employeeadmin is not a live agent). It has its own menu and opens in its own
  // browser tab (see liveChatTabs.js). The module itself is switched on and off by LIVECHAT_ENABLED on the server.
  {
    key: "live-chat",
    label: "Live Chat",
    path: "/admin-dashboard/live-chat",
    external: true,
    roles: ["admin", "superadmin"],
    icon: "chat",
  },
  { key: "search-analytics", label: "Search Analytics", path: "/admin-dashboard/search-analytics", roles: ["admin", "superadmin"], icon: "chart" },
  { key: "tickets", label: "Support Tickets", path: "/admin-dashboard/tickets", icon: "ticket" },
];

// Same visibility rules as before: the payment admin only sees items that name
// that role; everyone else sees items without `roles` or whose `roles` include theirs.
export const isVisibleTo = (item, role) => {
  if (role === "paymentadmin") return Boolean(item.roles?.includes("paymentadmin"));
  if (item.roles) return item.roles.includes(role);
  return !item.superadminOnly || role === "superadmin";
};

// A page belongs to a menu item when it is that item's page or any page under it
// (detail pages, …). The dashboard only matches itself.
export const pathMatches = (target, pathname, exact) =>
  pathname === target || (!exact && pathname.startsWith(`${target}/`));


// Where a menu entry goes for this role (the payment admin has its own URLs for some pages).
export const targetOf = (link, role) => (role === "paymentadmin" && link.paymentAdminPath ? link.paymentAdminPath : link.path);

// What this role sees, in order. Parents are shown only when at least one child is; Live Chat only in builds with
// VITE_LIVECHAT_ENABLED=true (otherwise the panel is as before). Children come back as `links`, each with its `target`.
export function buildNav(role, { liveChat = false } = {}) {
  const withTarget = (link) => ({ ...link, target: targetOf(link, role) });
  return NAV_ITEMS.filter((item) => item.key !== "live-chat" || liveChat)
    .map((item) => (item.children ? { ...item, links: item.children.filter((c) => isVisibleTo(c, role)).map(withTarget) } : item))
    .filter((item) => (item.children ? item.links.length > 0 : isVisibleTo(item, role)));
}
