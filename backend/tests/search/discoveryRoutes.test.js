// PR 7.1: every search destination must be an existing discovery page in
// frontend/src/App.jsx - never a guessed route, never the booking flow.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { CATEGORY_LANDING_ROUTES } = require("../../services/search/searchConstants");
const {
  SPECIALTY_DISCOVERY_ROUTES,
  CONDITION_DISCOVERY_ROUTES,
  DISCOVERY_FALLBACK_ROUTES,
} = require("../../services/search/discoveryRoutes");
const plan = require("../../scripts/searchTaxonomy/searchTaxonomyMigrationPlan.json");

const appSrc = fs
  .readFileSync(path.join(__dirname, "..", "..", "..", "frontend", "src", "App.jsx"), "utf8")
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, ""); // commented-out routes don't count
const appRoutes = new Set([...appSrc.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]));

const allRoutes = () => [
  ...Object.values(CATEGORY_LANDING_ROUTES),
  ...Object.values(SPECIALTY_DISCOVERY_ROUTES).flatMap(Object.values),
  ...CONDITION_DISCOVERY_ROUTES,
  ...Object.values(DISCOVERY_FALLBACK_ROUTES),
];

test("every discovery route is an active route in App.jsx", () => {
  for (const route of allRoutes()) assert.ok(appRoutes.has(route), `${route} is not routed in App.jsx`);
});

test("no discovery route is a booking, parameterised or unsafe path", () => {
  for (const route of allRoutes()) {
    assert.match(route, /^\/[A-Za-z0-9\-/&]*$/, route);
    assert.ok(!route.startsWith("/appointment-booking"), route);
    assert.ok(!route.includes(":") && !route.startsWith("//"), route);
  }
});

test("specialty pages sit under their category page", () => {
  for (const [category, specialties] of Object.entries(SPECIALTY_DISCOVERY_ROUTES)) {
    assert.ok(CATEGORY_LANDING_ROUTES[category], `unknown category ${category}`);
    for (const route of Object.values(specialties)) {
      // The only exception is the flat Expert Medical Opinion page.
      if (route === "/expert-medical-opinion") continue;
      assert.ok(route.startsWith(`${CATEGORY_LANDING_ROUTES[category]}/`), route);
    }
  }
});

test("every live specialty has a discovery page", () => {
  const categoryName = Object.fromEntries(plan.liveSnapshot.categories.map((c) => [c._id, c.name]));
  for (const specialty of plan.liveSnapshot.specialties) {
    const category = categoryName[specialty.categoryId];
    assert.ok(SPECIALTY_DISCOVERY_ROUTES[category]?.[specialty.name], `${category} / ${specialty.name}`);
  }
});

test("every approved taxonomy route verified in the app is a known condition page", () => {
  const verified = plan.operations
    .filter((op) => op.op === "CREATE_CONDITION" && op.routeStatus === "FOUND_IN_APP")
    .map((op) => op.document.route);
  assert.ok(verified.length > 100);
  for (const route of verified) assert.ok(CONDITION_DISCOVERY_ROUTES.has(route), route);
});
