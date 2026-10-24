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

test("the old Category Consultations pages and the old category assign page are deleted; the assign popup is gone", () => {
  for (const f of ["AdminCategoryConsultations.jsx", "AdminCategoryConsultationDetails.jsx", "AdminAssignCategoryDoctor.jsx"]) {
    assert.equal(exists("pages", "admin", f), false, f);
  }
  for (const f of ["DoctorPickerModal.jsx", "useApprovedDoctors.js"]) assert.equal(exists("pages", "admin", "appointments", f), false, f);
});

test("one full-page assign screen serves both kinds, at /admin-dashboard/appointments/:id/assign, wired to the new endpoints", () => {
  assert.equal(exists("pages", "admin", "AdminAssignDoctor.jsx"), true);
  assert.equal(exists("pages", "admin", "AdminAssignDoctor.css"), true);
  const app = read("App.jsx");
  assert.match(app, /const AdminAssignDoctor = lazy\(\(\) => import\("\.\/pages\/admin\/AdminAssignDoctor"\)\)/);
  assert.match(app, /path="\/admin-dashboard\/appointments\/:id\/assign"/);
  assert.doesNotMatch(app, /AdminCategoryConsultation|AdminAssignCategoryDoctor/);
  assert.match(app, /\{legacyAdminRedirects\}/);
  const page = read("pages", "admin", "AdminAssignDoctor.jsx");
  assert.match(page, /alternateDoctor, assignDoctor, revertDoctor/);
  assert.doesNotMatch(page, /change-doctor|category-consultation/);
});

test("the list's Assign doctor and Alternate doctor go to that page; there is no popup code for them", () => {
  const table = read("pages", "admin", "appointments", "BookingsTable.jsx");
  assert.match(table, /assignUrl\(row\.id, searchParams\.toString\(\)\)/);
  assert.doesNotMatch(table, /handlers\.(assign|alternate)/);
  const hook = read("pages", "admin", "appointments", "useBookingActions.js");
  assert.doesNotMatch(hook, /bookingApi\.(assign|alternate|revert)/);
});

test("the old URLs redirect: the list to Appointments (All tab), a category booking page to the booking, the old category assign page to the assign page; the assign URL itself is not redirected", () => {
  const r = read("pages", "admin", "legacyRedirects.jsx");
  assert.match(r, /path="\/admin-dashboard\/category-consultations" element=\{<Navigate to="\/admin-dashboard\/appointments\?tab=all" replace \/>\}/);
  assert.ok(r.includes('path="/admin-dashboard/category-consultations/assign-doctor/:id" element={<RedirectToBooking assign />}'));
  assert.ok(r.includes('path="/admin-dashboard/category-consultations/:id" element={<RedirectToBooking />}'));
  assert.doesNotMatch(r, /path="\/admin-dashboard\/appointments\/:id\/assign"/);
  assert.ok(r.includes('/admin-dashboard/appointments/${id}${assign ? "/assign" : ""}'));
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
