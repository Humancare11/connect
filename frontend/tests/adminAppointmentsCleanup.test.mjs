// Static checks for the merge of Category Consultations into Appointments: the old pages, routes and sidebar entry are
// gone, the old URLs redirect, nothing links to them, and the retired styles are gone. Reads source files only.
// Run: node --test tests/adminAppointmentsCleanup.test.mjs  (from frontend/).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const read = (...p) => fs.readFileSync(path.join(src, ...p), "utf8");
const exists = (...p) => fs.existsSync(path.join(src, ...p));
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));

test("the old pages are deleted", () => {
  for (const f of ["AdminCategoryConsultations.jsx", "AdminCategoryConsultationDetails.jsx", "AdminAssignCategoryDoctor.jsx", "AdminAssignDoctor.jsx", "AdminAssignDoctor.css"]) {
    assert.equal(exists("pages", "admin", f), false, f);
  }
});

test("App.jsx no longer imports or routes the old pages, and uses the shared redirects", () => {
  const app = read("App.jsx");
  assert.doesNotMatch(app, /AdminCategoryConsultation|AdminAssignCategoryDoctor|AdminAssignDoctor/);
  assert.doesNotMatch(app, /element=\{<Admin(Category|Assign)/);
  assert.match(app, /\{legacyAdminRedirects\}/);
});

test("the old URLs redirect: the list to Appointments (All tab), booking pages to the booking", () => {
  const r = read("pages", "admin", "legacyRedirects.jsx");
  assert.match(r, /path="\/admin-dashboard\/category-consultations" element=\{<Navigate to="\/admin-dashboard\/appointments\?tab=all" replace \/>\}/);
  for (const p of ["/admin-dashboard/category-consultations/assign-doctor/:id", "/admin-dashboard/category-consultations/:id", "/admin-dashboard/appointments/:id/assign"]) {
    assert.ok(r.includes(`path="${p}" element={<RedirectToBooking />}`), p);
  }
  assert.match(r, /\/admin-dashboard\/appointments\/\$\{id\}/);
});

test("the sidebar has one Appointments entry and no Category Consultations", () => {
  const nav = read("pages", "admin", "AdminLayout.jsx");
  assert.doesNotMatch(nav, /category-consultations|Category Consultations/);
  assert.match(nav, /key: "appointments", label: "Appointments", path: "\/admin-dashboard\/appointments"/);
  assert.doesNotMatch(read("seo", "routes.js"), /category-consultations/);
});

test("nothing in the app links to the retired URLs or calls the retired endpoints", () => {
  const offenders = walk(src)
    .filter((f) => /\.(jsx?|mjs|css)$/.test(f) && !f.endsWith("legacyRedirects.jsx"))
    .filter((f) => /category-consultations|category-consultation\/[^"'`]*assign-doctor|\/change-doctor|adp-cc-/.test(fs.readFileSync(f, "utf8")))
    .map((f) => path.relative(src, f));
  assert.deepEqual(offenders, []);
});

test("the user profile's consultation list opens the booking in Appointments", () => {
  assert.match(read("pages", "admin", "UserConsultationList.jsx"), /category: \(id\) => `\/admin-dashboard\/appointments\/\$\{id\}`/);
});

test("the View page has a super-admin-only Delete, for category consultations, behind a confirmation", () => {
  const view = read("pages", "admin", "AdminAppointmentDetails.jsx");
  assert.match(view, /admin\?\.role === "superadmin" && appointment\.isCategoryConsultation/);
  assert.match(view, /api\.delete\(`\/api\/admin\/bookings\/\$\{id\}`\)/);
  assert.match(view, /tone: "danger"/);
  assert.doesNotMatch(view, /\/assign`/);
});
