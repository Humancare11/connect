// HTTP-level tests for POST /api/search using a local Express app with the
// real controller, router error handler and rate limiter. The catalog is the
// stub-built fixture; no database connection is opened.
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { buildFixtureCatalog } = require("./fixtures");
const { createSearchController } = require("../../controllers/searchController");
const searchRouter = require("../../routes/search");
const { searchLimiter } = require("../../middleware/rateLimiters");

let server;
let baseUrl;
let catalogCalls = 0;

test.before(async () => {
  const { catalog } = await buildFixtureCatalog();
  const app = express();
  app.use(express.json());
  const controller = createSearchController({
    getCatalog: async () => {
      catalogCalls += 1;
      return catalog;
    },
  });
  app.post("/api/search", controller);
  app.use("/api/search", searchRouter.handleSearchErrors);

  // Separate path exercising the real limiter in isolation.
  app.post("/limited", searchLimiter, (req, res) => res.json({ ok: true }));

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((resolve) => server.close(resolve)));

const post = (body, path = "/api/search", raw = false) =>
  fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw ? body : JSON.stringify(body),
  }).then(async (res) => ({ status: res.status, body: await res.json().catch(() => null) }));

// ── Validation ───────────────────────────────────────────────────────────
test("valid request returns the documented response shape", async () => {
  const { status, body } = await post({ q: "  Acne  " });
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.deepEqual(body.query, { normalized: "acne" });
  assert.deepEqual(Object.keys(body.results), ["categories", "specialties", "conditions", "services", "doctors", "blogs"]);
  assert.equal(body.meta.mode, "instant");
  assert.equal(body.meta.total, Object.values(body.results).flat().length);
});

test("mode full is accepted and uses deterministic search", async () => {
  const { status, body } = await post({ q: "acne", mode: "full" });
  assert.equal(status, 200);
  assert.equal(body.meta.mode, "full");
  assert.equal(body.results.conditions[0].title, "Acne");
});

test("types filter", async () => {
  const { body } = await post({ q: "acne", types: ["condition"] });
  assert.ok(body.results.conditions.length > 0);
  assert.equal(body.results.specialties.length + body.results.doctors.length + body.results.blogs.length, 0);
});

test("invalid inputs are rejected with 400 and never echoed", async () => {
  const cases = [
    {},
    { q: "a" },
    { q: "x".repeat(101) },
    { q: 42 },
    { q: null },
    { q: "acne", mode: "smart" },
    { q: "acne", types: [] },
    { q: "acne", types: ["patient"] },
    { q: "acne", types: "condition" },
    { q: "acne", extra: 1 },
    [{ q: "acne" }],
  ];
  for (const body of cases) {
    const res = await post(body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal(res.body.success, false);
    assert.ok(!JSON.stringify(res.body).includes("x".repeat(50)));
  }
});

test("malformed JSON is rejected by the search error handler", async () => {
  const res = await post('{"q": "secret health text"', "/api/search", true);
  assert.equal(res.status, 400);
  assert.ok(!JSON.stringify(res.body).includes("secret"));
});

// ── Security: operator / regex / object input ────────────────────────────
test("Mongo-operator objects are rejected before any catalog access", async () => {
  const before = catalogCalls;
  for (const q of [{ $gt: "" }, { $where: "1" }, { $regex: ".*" }, { $ne: null }, ["acne"]]) {
    const res = await post({ q });
    assert.equal(res.status, 400, JSON.stringify(q));
  }
  for (const body of [{ q: "acne", $where: "1" }, { q: "acne", mode: { $ne: "x" } }, { q: "acne", types: [{ $gt: "" }] }]) {
    assert.equal((await post(body)).status, 400, JSON.stringify(body));
  }
  assert.equal(catalogCalls, before);
});

test("operator-like and regex-like strings are treated as plain text", async () => {
  for (const q of ["$where", "$gt", "$regex", "{ $gt: '' }", ".*", "^.*$", "(a+)+$", "acne|.*", "[a-z]*"]) {
    const res = await post({ q });
    assert.equal(res.status, 200, q);
    assert.equal(res.body.success, true);
    // Nothing broad is returned: at most the literal words match.
    assert.ok(res.body.meta.total <= 5, `${q} returned ${res.body.meta.total}`);
  }
  // Patterns that would match everything if executed match nothing here.
  for (const q of [".*", "(a+)+$", "^.*$"]) {
    assert.equal((await post({ q })).body.meta.total, 0, q);
  }
});

// ── Rate limiting ────────────────────────────────────────────────────────
test("rate limiter returns 429 after 60 requests per minute from one IP", async () => {
  for (let i = 0; i < 60; i += 1) {
    assert.equal((await post({ q: "acne" }, "/limited")).status, 200);
  }
  const limited = await post({ q: "acne" }, "/limited");
  assert.equal(limited.status, 429);
});
