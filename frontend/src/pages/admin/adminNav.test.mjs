// The admin menu, per role, in order. The expected lists were recorded from the sidebar as it was drawn BEFORE the
// sidebar was redesigned (docs/ui-baseline/sidebar-items.json); the redesign must not add, remove or reorder anything.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNav, NAV_ITEMS } from "./adminNav.js";

const shape = (role, liveChat) =>
  buildNav(role, { liveChat }).map((item) =>
    item.links ? { label: item.label, children: item.links.map((l) => [l.label, l.target]) } : { label: item.label, to: item.path, newTab: Boolean(item.external) },
  );

const SHARED = [
  { label: "Dashboard", to: "/admin-dashboard", newTab: false },
  { label: "Doctors", children: [["Our Doctors", "/admin-dashboard/our-doctors"], ["Manage Doctors", "/admin-dashboard/manage-doctors"]] },
  { label: "Users", children: [["Manage Users", "/admin-dashboard/manage-users"], ["Deletion Requests", "/admin-dashboard/deletion-requests"]] },
  { label: "Appointments", to: "/admin-dashboard/appointments", newTab: false },
  { label: "Appointment entries", to: "/admin-dashboard/appointment-entries", newTab: false },
  { label: "Direct Video Consultation", to: "/admin-dashboard/direct-video-consultation", newTab: false },
  { label: "Documents", children: [["Manual Invoices", "/admin-dashboard/manual-invoices"], ["Guarantee of Payment", "/admin-dashboard/gop"]] },
  { label: "Partner Cases", to: "/admin-dashboard/partner-cases", newTab: false },
  { label: "Email", to: "/admin-dashboard/email", newTab: false },
];
const TAIL = [
  { label: "Search Analytics", to: "/admin-dashboard/search-analytics", newTab: false },
  { label: "Support Tickets", to: "/admin-dashboard/tickets", newTab: false },
];
const LIVE = { label: "Live Chat", to: "/admin-dashboard/live-chat", newTab: true };

test("admin and super admin: the same twelve entries in the same order, Live Chat (new tab) only in live-chat builds", () => {
  for (const role of ["admin", "superadmin"]) {
    assert.deepEqual(shape(role, true), [...SHARED, LIVE, ...TAIL], role);
    assert.deepEqual(shape(role, false), [...SHARED, ...TAIL], `${role} without live chat`);
  }
});

test("payment admin: Documents (Manual Invoices only, on its own URL), Payment Links, Payment History", () => {
  for (const liveChat of [true, false]) {
    assert.deepEqual(shape("paymentadmin", liveChat), [
      { label: "Documents", children: [["Manual Invoices", "/payment-admin/manual-invoices"]] },
      { label: "Payment Links", to: "/admin-dashboard/payment-links", newTab: false },
      { label: "Payment History", to: "/admin-dashboard/payment-link-history", newTab: false },
    ]);
  }
});

test("every entry names an icon, and no entry carries a count unless the app supplies one", () => {
  const all = NAV_ITEMS.flatMap((item) => [item, ...(item.children || [])]);
  for (const entry of all) {
    assert.equal(typeof entry.icon, "string", entry.label);
    assert.equal(entry.count, undefined, `${entry.label}: counts come from the app, not the menu list`);
  }
});
