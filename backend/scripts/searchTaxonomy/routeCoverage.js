// PR 8: route coverage report (offline, read-only).
//
// Compares the committed migration plan with the routes App.jsx really
// declares. No database access; the live state comes from the plan's own
// snapshot. Used by tests/searchTaxonomy/pr8TaxonomySync.test.js and, run as
// a script, prints the report tables used in PR8_TAXONOMY_SYNCHRONIZATION_REPORT.md.
//
//   node scripts/searchTaxonomy/routeCoverage.js [--json]
const { slugify } = require("../../utils/slugify");
const { SPECIALTY_DISCOVERY_ROUTES, CONDITION_DISCOVERY_ROUTES } = require("../../services/search/discoveryRoutes");
const { CATEGORY_LANDING_ROUTES } = require("../../services/search/searchConstants");
const decisions = require("./searchTaxonomyDecisions");

const plannedRecords = (plan) => plan.operations.filter((o) => o.op === "CREATE_CONDITION");

// Paths a slug-based builder would try for a record (the thing NOT to trust).
function generatedSlugPaths(op) {
  const slug = slugify(op.document.name);
  const base = SPECIALTY_DISCOVERY_ROUTES[op.categoryName]?.[op.specialtyName];
  return [...(base ? [`${base}/${slug}`] : []), `/${slug}`];
}

function buildRouteCoverage({ plan, appRoutes }) {
  const records = plannedRecords(plan);
  const rows = records.map((op) => {
    const d = op.document;
    return {
      legacyId: d.legacyId,
      name: d.name,
      kind: d.kind,
      specialty: op.specialtyName,
      category: op.categoryName,
      route: d.route,
      routeStatus: op.routeStatus,
      routeExistsInApp: Boolean(d.route) && appRoutes.has(d.route),
      generated: generatedSlugPaths(op),
    };
  });

  const mergedRoutes = plan.legacyMapping.conditions.filter((c) => c.decision === "MERGE");
  const coveredRoutes = new Set([...rows.map((r) => r.route).filter(Boolean), ...mergedRoutes.map((m) => m.legacyRoute)]);

  return {
    // A. conditions/services with a dedicated route
    withDedicatedRoute: rows.filter((r) => r.route && r.routeExistsInApp),
    // B. without a dedicated route (specialty/category fallback)
    withoutDedicatedRoute: rows.filter((r) => !r.route),
    // C. route differs from the slug-generated path(s)
    routeDiffersFromSlug: rows.filter((r) => r.route && !r.generated.includes(r.route)),
    // D. page exists in App.jsx but had no taxonomy record before PR8
    //    (live DB holds 1 searchable condition); split by what PR8 does.
    pageWithoutRecord: {
      livePublicRecords: plan.liveSnapshot.conditions.filter((c) => c.globalSearch.startsWith("INCLUDED")).length,
      plannedForCreation: rows.length,
      mergedAsAlias: mergedRoutes.map((m) => ({ legacyId: m.legacyId, route: m.legacyRoute, into: m.mergeInto })),
      deliberatelyUnmapped: Object.entries(decisions.UNMAPPED_APP_PAGES).map(([route, reason]) => ({ route, reason })),
      uncovered: [...CONDITION_DISCOVERY_ROUTES].filter((r) => !coveredRoutes.has(r) && !decisions.UNMAPPED_APP_PAGES[r]),
    },
    // E. taxonomy records (planned) whose route does not exist
    recordRouteMissingInApp: rows.filter((r) => r.route && !r.routeExistsInApp),
    // F. duplicate / overlapping conditions
    overlaps: {
      keepSeparate: decisions.KEEP_SEPARATE,
      aliasWarnings: plan.collisions.filter((c) => /^B_/.test(c.check)),
      merges: plan.operations.filter((o) => o.op === "MERGE_ALIAS").map((o) => ({ alias: o.alias, into: o.canonical })),
    },
    // G. test / orphan records
    testOrOrphan: plan.liveSnapshot.conditions
      .filter((c) => c.review && c.review.assessment !== "REAL_RECORD_KEEP" && c.review.assessment !== "UNREVIEWED")
      .map((c) => ({ name: c.name, assessment: c.review.assessment, action: c.review.action })),
    totals: {
      pagesInApp: CONDITION_DISCOVERY_ROUTES.size,
      categoryPages: Object.keys(CATEGORY_LANDING_ROUTES).length,
      specialtyPages: Object.values(SPECIALTY_DISCOVERY_ROUTES).reduce((n, o) => n + Object.keys(o).length, 0),
      plannedRecords: rows.length,
    },
  };
}

if (require.main === module) {
  const { loadAppRoutes } = require("./prepareSearchTaxonomyMigration");
  const plan = require("./searchTaxonomyMigrationPlan.json");
  const coverage = buildRouteCoverage({ plan, appRoutes: loadAppRoutes().paths });
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(coverage, null, 2)}\n`);
  } else {
    const t = coverage.totals;
    console.log(`pages in App.jsx (condition/service): ${t.pagesInApp} | category pages: ${t.categoryPages} | specialty pages: ${t.specialtyPages} | planned records: ${t.plannedRecords}`);
    console.log(`A dedicated route: ${coverage.withDedicatedRoute.length} | B none: ${coverage.withoutDedicatedRoute.length} | C differs from slug: ${coverage.routeDiffersFromSlug.length} | E missing in App: ${coverage.recordRouteMissingInApp.length}`);
    console.log(`D uncovered pages: ${coverage.pageWithoutRecord.uncovered.length} | unmapped: ${coverage.pageWithoutRecord.deliberatelyUnmapped.length} | merged: ${coverage.pageWithoutRecord.mergedAsAlias.length}`);
    console.log(`F alias warnings: ${coverage.overlaps.aliasWarnings.length} | G test/orphan: ${coverage.testOrOrphan.length}`);
  }
}

module.exports = { buildRouteCoverage, generatedSlugPaths };
