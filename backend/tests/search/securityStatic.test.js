// Static guarantees about the search modules' source code.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

// Modules that handle the user's query must not touch the database or
// compile user input into a RegExp.
const QUERY_HANDLING = [
  "services/search/queryNormalizer.js",
  "services/search/deterministicMatcher.js",
  "services/search/resultBuilder.js",
  "controllers/searchController.js",
];

test("query-handling modules import no models or mongoose", () => {
  for (const file of QUERY_HANDLING) {
    const src = read(file);
    assert.ok(!/require\(["']mongoose["']\)/.test(src), `${file} requires mongoose`);
    assert.ok(!/models\//.test(src), `${file} imports a model`);
  }
});

test("no dynamic RegExp construction in search modules", () => {
  for (const file of [...QUERY_HANDLING, "services/search/searchCatalog.js", "routes/search.js"]) {
    assert.ok(!/new RegExp\(|RegExp\(/.test(read(file)), `${file} builds a RegExp`);
  }
});

test("search modules never log the query or call external services", () => {
  for (const file of [...QUERY_HANDLING, "services/search/searchCatalog.js", "routes/search.js"]) {
    const src = read(file);
    assert.ok(!/console\.\w+\([^)]*\b(q|query|req\.body)\b/.test(src), `${file} may log the query`);
    assert.ok(!/fetch\(|axios|https?\.request|openai/i.test(src), `${file} makes an outbound call`);
  }
});

test("the legacy searchRoutes.js is not imported anywhere", () => {
  for (const file of ["server.js", "routes/search.js", "controllers/searchController.js"]) {
    assert.ok(!/require\([^)]*searchRoutes/.test(read(file)), `${file} imports searchRoutes`);
  }
});

test("catalog loads only the allowed models", () => {
  const requires = [...read("services/search/searchCatalog.js").matchAll(/require\(["']([^"']+)["']\)/g)].map((m) => m[1]);
  assert.deepEqual(requires.filter((r) => r.includes("models/")).sort(), [
    "../../models/Blog", // published posts only; explicit field selection
    "../../models/Doctor",
    "../../models/Enrollment",
    "../../models/HealthcareCategory",
    "../../models/HealthcareCondition",
    "../../models/HealthcareSpecialty",
  ]);
});

// ── Search analytics boundary (Phase 1) ────────────────────────────────────
// Query-handling modules still never touch the database (tests above). The one
// deliberate exception is search analytics, and only inside this boundary:
//   models/SearchInteraction.js             raw settled searches (standalone)
//   models/SearchTermDailyStat.js           daily rollup rows (standalone)
//   services/searchAnalytics/recorder.js    the only writer of SearchInteraction
//   services/searchAnalytics/rollup.js      reads SearchInteraction, writes SearchTermDailyStat
//   services/searchAnalytics/adminQueries.js  READ-ONLY aggregates for the Admin APIs
// Phase 2 wired the recorder into the search controller; Phase 4 added the
// rollup job, started from server.js through jobs/searchAnalyticsJobs.js;
// Phase 5 added the Admin read APIs (routes/adminSearchAnalytics.js ->
// controllers/searchAnalyticsAdminController.js -> adminQueries.js).
const ANALYTICS_FILES = [
  "services/search/queryRedaction.js",
  "services/searchAnalytics/constants.js",
  "services/searchAnalytics/classifyOutcome.js",
  "services/searchAnalytics/recorder.js",
  "services/searchAnalytics/backgroundRunner.js",
  "services/searchAnalytics/searchEvents.js",
  "services/searchAnalytics/rollup.js",
  "services/searchAnalytics/adminParams.js",
  "services/searchAnalytics/coverage.js",
  "services/searchAnalytics/adminQueries.js",
  "jobs/searchAnalyticsJobs.js",
  "models/SearchInteraction.js",
  "models/SearchTermDailyStat.js",
];
// The only analytics modules allowed to import a model, and which ones.
const MODEL_IMPORTS = {
  "services/searchAnalytics/recorder.js": ["../../models/SearchInteraction"],
  "services/searchAnalytics/rollup.js": ["../../models/SearchInteraction", "../../models/SearchTermDailyStat"],
  "services/searchAnalytics/adminQueries.js": ["../../models/SearchInteraction", "../../models/SearchTermDailyStat"],
};

function sourceFiles(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = dir === "." ? entry.name : `${dir}/${entry.name}`;
    if (entry.isDirectory()) return ["node_modules", "tests", "scripts", "uploads"].includes(entry.name) ? [] : sourceFiles(rel);
    return entry.name.endsWith(".js") ? [rel] : [];
  });
}

test("only the recorder, the rollup and the read-only admin queries import the analytics models", () => {
  for (const model of ["SearchInteraction", "SearchTermDailyStat"]) {
    assert.ok(fs.existsSync(path.join(root, `models/${model}.js`)));
  }
  const importers = (model) => sourceFiles(".").filter((file) => new RegExp(`models/${model}`).test(read(file))).sort();
  assert.deepEqual(importers("SearchInteraction"), [
    "services/searchAnalytics/adminQueries.js", "services/searchAnalytics/recorder.js", "services/searchAnalytics/rollup.js",
  ]);
  assert.deepEqual(importers("SearchTermDailyStat"), ["services/searchAnalytics/adminQueries.js", "services/searchAnalytics/rollup.js"]);
});

test("analytics modules require no other model and no mongoose outside the model files", () => {
  for (const file of ANALYTICS_FILES) {
    const requires = [...read(file).matchAll(/require\(["']([^"']+)["']\)/g)].map((m) => m[1]);
    assert.deepEqual(requires.filter((r) => r.includes("models/")), MODEL_IMPORTS[file] || [], file);
    assert.equal(requires.includes("mongoose"), file.startsWith("models/"), file);
  }
});

test("the rollup only reads raw interactions: it never writes the SearchInteraction collection", () => {
  const src = read("services/searchAnalytics/rollup.js");
  // `Interaction` is the injected raw-interaction model; `Stat` is the rollup model.
  assert.ok(!/\bInteraction\s*\.\s*(updateOne|updateMany|insertMany|insertOne|create|deleteOne|deleteMany|bulkWrite|replaceOne|findOneAndUpdate|findOneAndReplace|findOneAndDelete|findByIdAndUpdate|remove|save|collection)\b/.test(src));
  assert.ok(!/\bSearchInteraction\s*\.\s*(updateOne|updateMany|insertMany|insertOne|create|deleteOne|deleteMany|bulkWrite|replaceOne|findOneAndUpdate|remove|save)\b/.test(src));
  assert.deepEqual([...src.matchAll(/\bInteraction\.(\w+)\(/g)].map((m) => m[1]).sort(), ["aggregate", "aggregate", "aggregate", "aggregate", "findOne"]);
});

test("the rollup and its job log only fixed messages built from a day and an error name", () => {
  const rollup = read("services/searchAnalytics/rollup.js");
  const calls = [...rollup.matchAll(/(?<!function )\blog\(logger, ([^;]*)\);/g)].map((m) => m[1].trim());
  assert.deepEqual(calls, [
    '"[search-analytics] rollup backlog: an unfinalized day is older than 80 days"',
    "`[search-analytics] rollup failed for ${dayKey(day)}: ${safeName(err)}`",
    "`[search-analytics] rollup planning failed: ${safeName(err)}`",
  ]);
  const job = read("jobs/searchAnalyticsJobs.js");
  const jobCalls = [...job.matchAll(/\blogger\(([^;]*)\);/g)].map((m) => m[1].trim());
  assert.deepEqual(jobCalls, ["`[search-analytics] rollup job failed: ${typeof err?.name === \"string\" ? err.name.slice(0, 60) : \"Error\"}`"]);
});

// Phase 2 wired analytics into exactly one place: the search controller (which
// the route reaches). Everything else on the live path must stay independent
// of analytics - in particular no startup hook, job, ranking or AI code.
test("analytics wiring is confined to the search controller", () => {
  const controller = read("controllers/searchController.js");
  const required = [...controller.matchAll(/require\(["']([^"']+)["']\)/g)].map((m) => m[1]).filter((r) => /searchAnalytics|models\//.test(r));
  assert.deepEqual(required.sort(), [
    "../services/searchAnalytics/constants",
    "../services/searchAnalytics/searchEvents",
  ]);
  // The response is sent before analytics is even called, and the call is guarded.
  const sendAt = controller.indexOf("res.json(body)");
  const hookAt = controller.indexOf("analytics.afterFullSearch(");
  assert.ok(sendAt > 0 && hookAt > sendAt, "analytics must be called after res.json");
  assert.ok(!/await\s+[^;\n]*analytics/.test(controller), "analytics must never be awaited");
  // The settle handler answers before scheduling anything.
  const settleSrc = controller.slice(controller.indexOf("function createSettleController"));
  assert.ok(settleSrc.indexOf("res.status(204).end()") < settleSrc.indexOf("analytics.afterSettle("));
});

test("the feature flag defaults to off and is read only as the exact string \"true\"", () => {
  const events = read("services/searchAnalytics/searchEvents.js");
  assert.ok(/SEARCH_ANALYTICS_ENABLED === "true"/.test(events));
  assert.ok(!/SEARCH_ANALYTICS_ENABLED\s*(\|\||\?\?)/.test(events), "no default-on fallback");
  // Only searchEvents.js reads the flag; elsewhere it may appear in comments only.
  const code = (file) => read(file).split("\n").filter((line) => !/^\s*\/\//.test(line)).join("\n");
  for (const file of ["server.js", "controllers/searchController.js", "routes/search.js", "middleware/rateLimiters.js"]) {
    assert.ok(!/SEARCH_ANALYTICS_ENABLED/.test(code(file)), `${file} must not read the flag directly`);
  }
});

test("startup references analytics only through the rollup scheduler hook and the one admin route mount", () => {
  const lines = read("server.js").split("\n").filter((line) => /searchanalytics|searchinteraction|searchtermdailystat/i.test(line));
  assert.deepEqual(lines.map((line) => line.trim().replace(/\s*\/\/.*$/, "")), [
    'const { scheduleSearchAnalyticsRollup } = require("./jobs/searchAnalyticsJobs");',
    "scheduleSearchAnalyticsRollup();",
    'app.use("/api/admin/search-analytics", require("./routes/adminSearchAnalytics"));',
  ]);
  // The existing jobs stay independent of analytics.
  for (const file of fs.readdirSync(path.join(root, "jobs")).filter((f) => f.endsWith(".js") && f !== "searchAnalyticsJobs.js")) {
    assert.ok(!/searchAnalytics|SearchInteraction|SearchTermDailyStat/.test(read(`jobs/${file}`)), `jobs/${file} references analytics`);
  }
});

test("analytics is not referenced by routing, ranking, catalog or AI code", () => {
  for (const file of [
    "routes/search.js",
    "services/search/searchService.js",
    "services/search/searchAiService.js",
    "services/search/searchCatalog.js",
    "services/search/deterministicMatcher.js",
    "services/search/resultBuilder.js",
    "services/search/queryNormalizer.js",
  ]) {
    assert.ok(!/searchAnalytics|SearchInteraction/.test(read(file)), `${file} references search analytics`);
  }
});

test("analytics code reads no caller identity and builds no dynamic RegExp", () => {
  for (const file of ANALYTICS_FILES) {
    const src = read(file);
    assert.ok(!/\breq\b|\bres\b/.test(src), `${file} refers to a request/response object`);
    assert.ok(!/\.ip\b|\.ips\b|headers|cookies|\.user\b|socket|remoteAddress|x-forwarded/i.test(src), `${file} reads caller identity`);
    assert.ok(!/RegExp\(/.test(src), `${file} builds a RegExp`);
    assert.ok(!/fetch\(|axios|https?\.request|openai/i.test(src), `${file} makes an outbound call`);
  }
});

test("analytics code never logs query text, documents or error messages", () => {
  for (const file of ANALYTICS_FILES) {
    const src = read(file);
    assert.ok(!/console\.\w+\(/.test(src), `${file} calls console directly`);
    assert.ok(!/\.message\b|\.stack\b/.test(src), `${file} reads an error message or stack`);
  }
  // The recorder's only log call passes a fixed string built from name and code.
  const recorder = read("services/searchAnalytics/recorder.js");
  const calls = [...recorder.matchAll(/logger\(([^;]*)\);/g)].map((m) => m[1].trim());
  assert.deepEqual(calls, ["`[search-analytics] write failed: ${name} ${code}`"]);
});

test("the background runner logs only a fixed string with the error name", () => {
  const src = read("services/searchAnalytics/backgroundRunner.js");
  const calls = [...src.matchAll(/logger\(([^;]*)\);/g)].map((m) => m[1].trim());
  assert.deepEqual(calls, ["`[search-analytics] background task failed: ${name}`"]);
  assert.deepEqual([...src.matchAll(/require\(["']([^"']+)["']\)/g)], []); // no models, no imports at all
});

test("analytics uses awaited Mongoose validation, never validateSync", () => {
  for (const file of ANALYTICS_FILES) assert.ok(!/validateSync\(/.test(read(file)), `${file} calls validateSync`);
});

test("the analytics modules are referenced only from inside their own boundary", () => {
  // Nothing outside services/searchAnalytics may import or call analytics,
  // except the two models (shared constants), the search controller (Phase 2
  // wiring) and the rollup scheduler (Phase 4).
  const outside = sourceFiles(".").filter((file) => !file.startsWith("services/searchAnalytics/"));
  const users = outside.filter((file) => /searchAnalytics\/|backgroundRunner|recordSearchInteraction/.test(read(file)));
  assert.deepEqual(users.sort(), [
    "controllers/searchAnalyticsAdminController.js",
    "controllers/searchController.js",
    "jobs/searchAnalyticsJobs.js",
    "models/SearchInteraction.js",
    "models/SearchTermDailyStat.js",
  ]);
});

// ── Superadmin read APIs (Phase 5) ──────────────────────────────────────────
test("admin queries are read-only: aggregate / find only, never a write", () => {
  const src = read("services/searchAnalytics/adminQueries.js");
  const used = [...src.matchAll(/\b(Interaction|Stat)\.(\w+)\(/g)].map((m) => `${m[1]}.${m[2]}`).sort();
  assert.deepEqual(used, [
    "Interaction.aggregate", "Interaction.aggregate", "Interaction.aggregate", "Interaction.aggregate", "Interaction.aggregate", "Interaction.aggregate",
    "Stat.aggregate", "Stat.find", "Stat.find",
  ]);
  assert.ok(!/\.(updateOne|updateMany|insertOne|insertMany|create|deleteOne|deleteMany|bulkWrite|replaceOne|findOneAndUpdate|findOneAndDelete|findOneAndReplace|save|remove|drop|createIndex|collection)\b/.test(src));
  assert.ok(!/[{,]\s*\$(out|merge)\s*:/.test(src), "no aggregation stage may write");
  // The 3-interaction privacy floor lives in the data layer: on every term-day cell, and on the term total.
  assert.ok(src.includes("{ $match: { cell: { $gte: MIN_TERM_INTERACTIONS } } }"));
  assert.ok(src.includes("{ $match: { n: { $gte: MIN_TERM_INTERACTIONS } } }"));
  // /trend is budgeted: every database operation goes through the budget.
  assert.ok(src.includes("budget.run("));
});

test("the admin controller touches no model, writes nothing and logs only a fixed template", () => {
  const src = read("controllers/searchAnalyticsAdminController.js");
  const requires = [...src.matchAll(/require\(["']([^"']+)["']\)/g)].map((m) => m[1]);
  assert.deepEqual(requires.filter((r) => r.includes("models/")), []);
  assert.ok(!requires.includes("mongoose"));
  assert.ok(!/console\.(log|warn|error|info|debug)\(/.test(src), "no direct console calls");
  assert.ok(!/\.message\b|\.stack\b/.test(src), "never reads an error message");
  const calls = [...src.matchAll(/\blogger\(([^;]*)\);/g)].map((m) => m[1].trim());
  assert.equal(calls.length, 2);
  assert.ok(calls.some((call) => call.startsWith("`[search-analytics] admin read failed: ${endpoint} ${")));
  assert.ok(calls.some((call) => call === "`[search-analytics] admin read failed: ${endpoint} TrendBudgetError`")); // fixed text, no error detail
  assert.ok(!/req\.(body|headers|cookies|ip|user|params)/.test(src), "only the validated query is read");
  assert.ok(!/\.{3}(row|result|doc|loaded|params|query)\b/.test(src), "responses are built field by field, never by spreading a record");
});

test("the admin route uses the admin guard (never superadmin-only or a looser one), no-store first, and serves only GET", () => {
  const src = read("routes/adminSearchAnalytics.js");
  assert.ok(src.includes("guard = [verifyAdminToken, adminOnly, searchAnalyticsAdminLimiter]"));
  assert.ok(src.includes("router.use(noStore, ...guard)"));
  assert.ok(!/router\.(post|put|patch|delete)\(/.test(src));
  assert.ok(!/superAdminOnly|paymentAdminOnly|manualInvoiceAccess|employeeAdminOnly/.test(src), "only the adminOnly role guard is used");
  assert.ok(!fs.existsSync(path.join(root, "routes/superadminSearchAnalytics.js")), "the old superadmin route file is gone");
  assert.ok(!/search-analytics/.test(read("routes/superadmin.js")), "no superadmin alias of the analytics APIs");
  assert.ok(!/SearchInteraction|SearchTermDailyStat|models\//.test(src), "the route touches no model");
});

test("the shared redaction module is pure", () => {
  const src = read("services/search/queryRedaction.js");
  assert.deepEqual([...src.matchAll(/require\(["']([^"']+)["']\)/g)], []);
  assert.ok(!/console\.|process\.env|fs\./.test(src));
});

test("the AI service uses the shared redactQuery and no longer defines its own", () => {
  const src = read("services/search/searchAiService.js");
  assert.ok(/require\("\.\/queryRedaction"\)/.test(src));
  assert.ok(!/function redactQuery/.test(src));
});
