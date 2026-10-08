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
