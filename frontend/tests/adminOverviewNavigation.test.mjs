// Static checks for the /admin-dashboard page: every destination on it is an existing route, the filter deep links
// are ones the target page really reads, and the "failed metric shows a dash, never 0" rule is still in place.
// Run: node --test tests/adminOverviewNavigation.test.mjs  (from frontend/). Reads source files only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const read = (...parts) => fs.readFileSync(path.join(src, ...parts), "utf8");
const overview = read("pages/admin/AdminOverview.jsx");
const app = read("App.jsx");

const pathsBlock = overview.match(/const DASHBOARD_PATHS = \{([\s\S]*?)\};/)[1];
const paths = Object.fromEntries([...pathsBlock.matchAll(/(\w+):\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]));

test("the dashboard declares the approved destinations", () => {
  assert.equal(paths.ourDoctors, "/admin-dashboard/our-doctors");
  assert.equal(paths.manageDoctors, "/admin-dashboard/manage-doctors");
  assert.equal(paths.users, "/admin-dashboard/manage-users");
  assert.equal(paths.appointments, "/admin-dashboard/appointments");
  assert.equal(paths.tickets, "/admin-dashboard/tickets");
});

test("every destination (ignoring the query string) is a route in App.jsx", () => {
  for (const [name, target] of Object.entries(paths)) {
    const route = target.split("?")[0];
    assert.ok(app.includes(`path="${route}"`), `${name}: no <Route path="${route}">`);
  }
});

test("the Approved Doctors card goes to Our Doctors", () => {
  assert.match(overview, /label: "Approved Doctors"[^}]*to: P\.ourDoctors/);
});

test("filter deep links are read by the target page", () => {
  const users = read("pages/admin/ManageUsers.jsx");
  assert.match(users, /searchParams\.get\("q"\)/);
  assert.match(users, /get\("filter"\) === "deletion_requests"/);
  assert.match(paths.usersDeletionRequests, /\?filter=deletion_requests$/);
  const appts = read("pages/admin/AdminAppointments.jsx");
  assert.match(appts, /searchParams\.get\("tab"\)/);
  const order = appts.match(/STATUS_ORDER = \[([^\]]*)\]/)[1];
  for (const status of ["upcoming", "assigned", "pending", "confirmed", "complete", "cancelled", "all"]) {
    assert.ok(order.includes(`"${status}"`), status);
  }
});

test("every clickable element is a real link or button, not a div with a click handler", () => {
  assert.doesNotMatch(overview, /role="button"/);
  assert.doesNotMatch(overview, /<div[^>]*onClick/);
});

test("failed or missing metrics show a dash, never a made-up zero", () => {
  assert.match(overview, /const DASH = "(\\u2014|—)"/);
  assert.match(overview, /value === null \|\| value === undefined \? DASH/);
});

test("the new stylesheet does not touch the shared ad-, adp- or ado- selectors", () => {
  const css = read("pages/admin/AdminOverview.css").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(css, /\.(ad|adp|ado)-/);
});
