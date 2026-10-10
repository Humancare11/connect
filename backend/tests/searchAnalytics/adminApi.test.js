// Admin Search Analytics read APIs, end to end: the REAL authentication and
// authorization middleware (verifyAdminToken + adminOnly) with real signed
// tokens and sessions, the real router/controller/queries, against an ephemeral
// in-memory MongoDB (the repository's test pattern). No configured database is
// touched; the JWT secret below exists only inside this test process.
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = "phase5-test-only-secret";

const User = require("../../models/User");
const Session = require("../../models/Session");
const Doctor = require("../../models/Doctor");
const SearchInteraction = require("../../models/SearchInteraction");
const SearchTermDailyStat = require("../../models/SearchTermDailyStat");
const { verifyAdminToken, adminOnly, signAccessToken } = require("../../middleware/verifyToken");
const { searchAnalyticsAdminLimiter } = require("../../middleware/rateLimiters");
const { createSearchAnalyticsAdminController } = require("../../controllers/searchAnalyticsAdminController");
const searchAnalyticsRouter = require("../../routes/adminSearchAnalytics");
const { runRollup } = require("../../services/searchAnalytics/rollup");
const { interaction, many } = require("./rawInteractions");

const NOW = new Date("2026-10-09T09:00:00.000Z"); // "now" for every window computation
const BASE = "/api/admin/search-analytics";
const ACNE = "/skin-and-hair-care/dermatology/acne";
const ID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/;

describe("admin search analytics read APIs", { timeout: 300000 }, () => {
  let mongod;
  let server;
  let baseUrl;
  let logs;
  let superadmin;
  let flagOn = true;
  let queryOverrides = {};
  let seq = 0;

  // The real guard (no limiter, so tests are not rate-limited), the real controller, a fixed clock.
  const controller = createSearchAnalyticsAdminController({
    now: () => NOW,
    logger: (message) => logs.push(message),
    isEnabled: () => flagOn,
    queries: new Proxy({}, {
      get: (_target, name) => queryOverrides[name] || require("../../services/searchAnalytics/adminQueries")[name],
    }),
  });

  async function identity(role) {
    seq += 1;
    // Doctor sessions are validated against the Doctor collection, every other role against User.
    const Model = role === "doctor" ? Doctor : User;
    const user = await Model.create({ name: `${role} ${seq}`, email: `${role}${seq}@example.com`, password: "x", ...(role === "doctor" ? {} : { role }) });
    const session = await Session.create({ userId: String(user._id), role, lastActivityAt: new Date(), expiresAt: new Date(Date.now() + 3_600_000) });
    return { user, session, token: signAccessToken({ id: user._id, _id: user._id, email: user.email, role }, session._id) };
  }

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([User.init(), SearchInteraction.createIndexes(), SearchTermDailyStat.createIndexes(), Session.init()]);
    const app = express();
    app.use(express.json());
    app.use(BASE, searchAnalyticsRouter.create({ guard: [verifyAdminToken, adminOnly], controller }));
    // The router exactly as server.js mounts it (real limiter), on a second path, for the wiring test.
    app.use("/limited", searchAnalyticsRouter);
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await Promise.all([SearchInteraction.collection.deleteMany({}), SearchTermDailyStat.collection.deleteMany({})]);
    logs = [];
    flagOn = true;
    queryOverrides = {};
    superadmin = await identity("superadmin");
  });

  const seed = (docs) => SearchInteraction.collection.insertMany(docs);
  const when = (day, time = "12:00:00.000") => `${day}T${time}Z`;
  async function get(path, { token = superadmin.token, base = BASE, method = "GET", headers = {} } = {}) {
    const res = await fetch(`${baseUrl}${base}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers } });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, headers: res.headers, text, json };
  }

  // ── The scenario most content tests share ─────────────────────────────────
  const seedScenario = () => seed([
    ...many(6, { term: "acne", topResultPath: ACNE, createdAt: when("2026-10-08") }),
    ...many(6, { term: "ankle sprain", outcome: "no_results", createdAt: when("2026-10-07") }),
    ...many(6, { term: "oncology care", outcome: "fallback_only", createdAt: when("2026-10-06") }),
    ...many(4, { term: "heartburn", outcome: "fallback_only", createdAt: when("2026-10-05") }),
    ...many(2, { term: "heartburn", settledBy: "submit", aiStatus: "used", topResultPath: "/chronic-care/gastroenterology/acid-reflux-gerd", createdAt: when("2026-10-05", "13:00:00.000") }),
    ...many(6, { term: "ai down", settledBy: "submit", aiStatus: "unavailable", outcome: "no_results", createdAt: when("2026-10-08") }),
    ...many(5, { term: "half down", outcome: "no_results", createdAt: when("2026-10-08") }),
    ...many(5, { term: "half down", settledBy: "submit", aiStatus: "unavailable", outcome: "no_results", createdAt: when("2026-10-08") }),
    ...many(3, { term: "mostly down", outcome: "no_results", createdAt: when("2026-10-07") }),
    ...many(7, { term: "mostly down", settledBy: "submit", aiStatus: "unavailable", outcome: "no_results", createdAt: when("2026-10-07") }),
    ...many(6, { term: "pimple help", outcome: "fallback_only", topResultPath: ACNE, topResultDedicated: true, dedicatedPageAvailable: true, createdAt: when("2026-10-08") }),
    ...many(3, { term: "knee pain", settledBy: "select", createdAt: when("2026-10-08") }),
    ...many(2, { term: "secretrare", createdAt: when("2026-10-08") }),
    ...many(1, { term: "onlyone", createdAt: when("2026-10-08") }),
    ...many(2, { term: "tiny alpha", createdAt: when("2026-10-07") }),
  ]);
  const SUPPRESSED_TEXT = ["secretrare", "onlyone", "tiny alpha", "alpha"];
  const everyEndpoint = ["/summary", "/terms", "/gaps", "/trend", "/trend?termKey=secretrare", "/terms?outcome=found", "/terms?sort=recent&limit=100", "/gaps?minCount=3"];

  // ── Authentication and authorization ──────────────────────────────────────
  test("no token, a bad token and a malformed token are 401 with no-store and no data", async () => {
    await seedScenario();
    for (const path of ["/summary", "/terms", "/gaps", "/trend", "/nothing-here"]) {
      for (const token of [null, "garbage", "a.b.c", `${superadmin.token}x`]) {
        const res = await get(path, { token });
        assert.equal(res.status, 401, `${path} ${token}`);
        assert.equal(res.headers.get("cache-control"), "no-store");
        assert.ok(!/interactions|term/.test(res.text.replace(/ ?No token provided\. Please login\.| ?Invalid, expired, or timed out session\. Please login again\./, "")));
      }
    }
  });

  test("admin and superadmin get in; every other role is 403 with no-store and no data", async () => {
    await seedScenario();
    for (const role of ["user", "paymentadmin", "employeeadmin", "partner", "doctor"]) {
      const who = await identity(role);
      const res = await get("/summary", { token: who.token });
      assert.equal(res.status, 403, role);
      assert.equal(res.headers.get("cache-control"), "no-store");
      assert.deepEqual(Object.keys(res.json), ["msg"]);
    }
    const ok = await get("/summary");
    assert.equal(ok.status, 200);
    const admin = await identity("admin");
    for (const path of ["/summary", "/terms", "/gaps", "/trend"]) {
      const res = await get(path, { token: admin.token });
      assert.equal(res.status, 200, `admin ${path}`);
      assert.equal(res.headers.get("cache-control"), "no-store");
      assert.equal(res.json.success, true);
    }
  });

  test("a revoked session, a disabled account and an expired-looking token are 401", async () => {
    const revoked = await identity("superadmin");
    await Session.updateOne({ _id: revoked.session._id }, { revokedAt: new Date() });
    assert.equal((await get("/summary", { token: revoked.token })).status, 401);

    const disabled = await identity("superadmin");
    await User.updateOne({ _id: disabled.user._id }, { accountDisabled: true });
    assert.equal((await get("/summary", { token: disabled.token })).status, 401);

    const stale = await identity("superadmin");
    await Session.updateOne({ _id: stale.session._id }, { lastActivityAt: new Date(Date.now() - 60 * 60 * 1000) });
    assert.equal((await get("/summary", { token: stale.token })).status, 401);
  });

  test("adminOnly's shared behaviour is unchanged: a refused role gets 403 each time (high-severity event, no session revocation)", async () => {
    const payment = await identity("paymentadmin");
    assert.equal((await get("/summary", { token: payment.token })).status, 403);
    assert.equal((await get("/summary", { token: payment.token })).status, 403);
    assert.equal((await Session.findById(payment.session._id)).revokedAt ?? null, null);
  });

  test("authorization is checked before anything is read", async () => {
    let reads = 0;
    queryOverrides = { loadSummary: async () => { reads += 1; return {}; }, loadWindowTerms: async () => { reads += 1; return {}; }, loadTrend: async () => { reads += 1; return []; } };
    for (const path of ["/summary", "/terms", "/gaps", "/trend"]) {
      assert.equal((await get(path, { token: (await identity("user")).token })).status, 403);
      assert.equal((await get(path, { token: null })).status, 401);
    }
    assert.equal(reads, 0);
  });

  test("only GET is served; other methods are 405 for a superadmin and 401 without a token", async () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      for (const path of ["/summary", "/terms", "/gaps", "/trend"]) {
        const res = await get(path, { method });
        assert.equal(res.status, 405, `${method} ${path}`);
        assert.equal(res.headers.get("allow"), "GET");
        assert.equal(res.headers.get("cache-control"), "no-store");
        assert.equal((await get(path, { method, token: null })).status, 401);
      }
    }
    const unknown = await get("/nothing-here");
    assert.equal(unknown.status, 404);
    assert.deepEqual(unknown.json, { success: false, error: { code: "NOT_FOUND", message: "Not found." } });
  });

  test("the default router (as server.js mounts it) admits only admin and superadmin", async () => {
    assert.equal((await get("/summary", { base: "/limited", token: null })).status, 401);
    assert.equal((await get("/summary", { base: "/limited", token: "garbage" })).status, 401);
    for (const role of ["user", "paymentadmin", "employeeadmin", "partner", "doctor"]) {
      const refused = await get("/terms", { base: "/limited", token: (await identity(role)).token });
      assert.equal(refused.status, 403, role);
      assert.equal(refused.headers.get("cache-control"), "no-store");
    }
    for (const role of ["superadmin", "admin"]) {
      const ok = await get("/summary", { base: "/limited", token: (await identity(role)).token });
      assert.equal(ok.status, 200, role);
      assert.equal(ok.json.success, true);
    }
  });

  test("the route as mounted in server.js has the full guard in order: no-store, auth, admin, per-admin limiter", async () => {
    const guardStack = searchAnalyticsRouter.stack.filter((layer) => !layer.route).map((layer) => layer.handle.name || "anonymous");
    assert.equal(guardStack[0], "noStore");
    assert.equal(guardStack[1], "anonymous"); // verifyAdminToken (async function expression)
    assert.equal(guardStack[2], "adminOnly");
    assert.equal(searchAnalyticsRouter.stack[3].handle, searchAnalyticsAdminLimiter);
    // The limiter runs after authentication and is keyed by the admin, not by the text or the IP alone.
    let last;
    for (let i = 1; i <= 61; i += 1) last = await get("/summary", { base: "/limited" });
    assert.equal(last.status, 429);
    assert.equal(last.headers.get("cache-control"), "no-store");
    assert.equal((await get("/summary", { base: "/limited", token: (await identity("superadmin")).token })).status, 200); // another admin has their own budget
  });

  // ── Dates ────────────────────────────────────────────────────────────────
  test("the window is whole UTC days: both ends inclusive, the millisecond outside is excluded", async () => {
    await seed([
      ...many(3, { term: "edge", createdAt: "2026-10-01T00:00:00.000Z" }), // first instant of `from`
      ...many(3, { term: "edge", createdAt: "2026-10-03T23:59:59.999Z" }), // last instant of `to`
      ...many(5, { term: "outside", createdAt: "2026-09-30T23:59:59.999Z" }), // 1 ms before `from`
      ...many(5, { term: "outside", createdAt: "2026-10-04T00:00:00.000Z" }), // first instant after `to`
    ]);
    const res = await get("/summary?from=2026-10-01&to=2026-10-03");
    assert.equal(res.status, 200);
    assert.deepEqual(res.json.window, { from: "2026-10-01", to: "2026-10-03", days: 3 });
    assert.equal(res.json.data.interactions, 6);
    const terms = await get("/terms?from=2026-10-01&to=2026-10-03");
    assert.deepEqual(terms.json.data.items.map((i) => i.term), ["edge"]);
    assert.ok(!terms.text.includes("outside"));
  });

  test("window limits: 90 days raw-backed, 396 days trend, nothing older, nothing in the future", async () => {
    assert.equal((await get("/summary?from=2026-07-12&to=2026-10-09")).status, 200); // exactly 90 days
    assert.equal((await get("/summary?from=2026-07-11&to=2026-10-09")).status, 400); // 91
    assert.equal((await get("/terms?from=2026-07-11&to=2026-10-09")).status, 400);
    assert.equal((await get("/gaps?from=2026-07-11&to=2026-10-09")).status, 400);
    assert.equal((await get("/trend?from=2025-09-09&to=2026-10-09")).status, 200); // exactly 396 days
    assert.equal((await get("/trend?from=2025-09-08&to=2026-10-09")).status, 400); // 397
    assert.equal((await get("/summary?to=2026-10-10")).status, 400); // tomorrow
    assert.equal((await get("/summary?from=2026-10-03&to=2026-10-02")).status, 400);
    assert.equal((await get("/summary?from=2026-02-30")).status, 400);
    const defaults = await get("/summary");
    assert.deepEqual(defaults.json.window, { from: "2026-09-10", to: "2026-10-09", days: 30 });
  });

  // ── Suppressed terms (k = 3) ──────────────────────────────────────────────
  test("terms below 3 interactions never appear in any endpoint, field, filter or error", async () => {
    await seedScenario();
    for (const path of everyEndpoint) {
      const res = await get(path);
      for (const secret of SUPPRESSED_TEXT) assert.ok(!res.text.includes(secret), `${path} leaked ${secret}`);
    }
    // Not even in error responses or when asked for them directly.
    for (const path of ["/trend?termKey=secretrare&from=bad", "/terms?outcome=secretrare", "/trend?termKey=tiny%20alpha", "/terms?minCount=1", "/terms?sort=secretrare"]) {
      const res = await get(path);
      for (const secret of SUPPRESSED_TEXT) assert.ok(!res.text.includes(secret.replace("tiny alpha", "tiny")), `${path} leaked ${secret}`);
    }
  });

  test("the data layer itself never loads a term below 3 interactions (separate from the controller's own filter)", async () => {
    await seedScenario();
    const { loadWindowTerms } = require("../../services/searchAnalytics/adminQueries");
    const { parseWindow } = require("../../services/searchAnalytics/adminParams");
    const window = parseWindow({ from: "2026-10-01", to: "2026-10-09" }, { maxDays: 90, now: NOW });

    const { rows, truncated } = await loadWindowTerms({ window });
    assert.equal(truncated, false);
    assert.equal(rows.length, 9);
    assert.ok(rows.every((row) => row.counts.n >= 3));
    for (const secret of SUPPRESSED_TEXT) assert.ok(!JSON.stringify(rows).includes(secret), secret);

    // The floor applies to the FILTERED count: heartburn has only 2 dedicated-page searches.
    const filtered = await loadWindowTerms({ window, outcome: "dedicated_page_found" });
    assert.ok(filtered.rows.every((row) => row.counts.n >= 3));
    assert.ok(!filtered.rows.some((row) => row.termKey === "heartburn"));
    const unavailableOnly = await loadWindowTerms({ window, aiStatus: "unavailable" });
    assert.deepEqual(unavailableOnly.rows.map((row) => row.termKey).sort(), ["ai down", "half down", "mostly down"]);
    assert.ok(unavailableOnly.rows.every((row) => row.coverage === null && row.gap === null)); // no coverage while filtering
  });

  test("terms with 3 or more are shown, rarer ones are only counted", async () => {
    await seedScenario();
    const terms = await get("/terms?limit=100");
    assert.deepEqual(terms.json.data.items.map((i) => i.term).sort(), [
      "acne", "ai down", "ankle sprain", "half down", "heartburn", "knee pain", "mostly down", "oncology care", "pimple help",
    ]);
    assert.ok(terms.json.data.items.every((i) => i.interactions >= 3));
    const summary = (await get("/summary")).json.data;
    assert.deepEqual(summary.terms, { distinct: 12, shown: 9, suppressed: 3, interactionsInShownTerms: 59, interactionsInSuppressedTerms: 5 });
    assert.equal(summary.interactions, 64);
  });

  test("minCount raises the floor, and filters apply the floor to the filtered count (no differencing of rare terms)", async () => {
    await seedScenario();
    const raised = await get("/terms?minCount=7&limit=100");
    assert.deepEqual(raised.json.data.items.map((i) => i.term).sort(), ["ai down".replace("ai down", "half down"), "mostly down"].sort());
    assert.ok(raised.json.data.items.every((i) => i.interactions >= 7));
    // heartburn has 4 fallback_only and 2 found: filtering to `dedicated_page_found` leaves 2 -> hidden.
    const found = await get("/terms?outcome=dedicated_page_found&limit=100");
    const keys = found.json.data.items.map((i) => i.termKey);
    assert.ok(keys.includes("acne") && keys.includes("knee pain"));
    assert.ok(!keys.includes("heartburn"));
    assert.ok(found.json.data.items.every((i) => i.interactions >= 3 && i.coverage === null));
    assert.equal(found.json.data.filters.outcome, "dedicated_page_found");
  });

  // ── Content gaps ──────────────────────────────────────────────────────────
  test("gaps follow the approved rules: catalog gap, page gap, alias opportunity; AI-unavailable never confirmed", async () => {
    await seedScenario();
    const res = await get("/gaps");
    assert.equal(res.status, 200);
    const items = res.json.data.items;
    assert.deepEqual(items.map((i) => [i.termKey, i.gapType, i.interactions]), [
      ["half down", "no_catalog_match", 10],
      ["ankle sprain", "no_catalog_match", 6],
      ["heartburn", "alias_opportunity", 6],
      ["oncology care", "page_missing", 6],
    ]);
    const half = items[0];
    assert.equal(half.confirmedInteractions, 5);
    assert.equal(half.unconfirmedInteractions, 5);
    assert.equal(half.confirmedDedicatedRate, 0);
    const alias = items[2];
    assert.equal(alias.aiAssistedFound, 2);
    assert.equal(alias.instantNotFound, 4);
    // Never flagged: covered, AI-down-only, mostly-down, too little data, equivalent-page, rare.
    const flagged = new Set(items.map((i) => i.termKey));
    for (const never of ["acne", "ai down", "mostly down", "knee pain", "pimple help", "secretrare"]) assert.ok(!flagged.has(never), never);
    assert.deepEqual(res.json.data.pagination, { limit: 25, offset: 0, total: 4, hasMore: false });
  });

  test("terms report coverage per row, including 'unconfirmed' evidence and equivalent pages", async () => {
    await seedScenario();
    const items = Object.fromEntries((await get("/terms?limit=100")).json.data.items.map((i) => [i.termKey, i]));
    assert.equal(items.acne.coverage, "covered");
    assert.equal(items["pimple help"].coverage, "covered_by_equivalent"); // same dedicated page as acne
    assert.equal(items["ai down"].coverage, "insufficient_data"); // every search had the AI layer down
    assert.equal(items["mostly down"].coverage, "insufficient_data");
    assert.equal(items["knee pain"].coverage, "insufficient_data"); // only 3 confirmed
    assert.equal(items["half down"].coverage, "no_catalog_match");
    assert.equal(items["oncology care"].coverage, "page_missing");
    assert.equal(items.heartburn.coverage, "alias_opportunity");
    assert.deepEqual(items.acne.topResultPath, { path: ACNE, count: 6, dedicated: true });
  });

  test("summary counts gaps by type and reports unconfirmed (AI-unavailable) interactions separately", async () => {
    await seedScenario();
    const { data } = (await get("/summary")).json;
    assert.deepEqual(data.gaps, { pageMissing: 1, noCatalogMatch: 2, aliasOpportunity: 1, unconfirmedInteractions: 18 });
    assert.deepEqual(data.bySettledBy, { idle: 41, select: 3, submit: 20 });
    assert.deepEqual(data.outcomes, { dedicatedPageFound: 16, fallbackOnly: 16, noResults: 32 });
    assert.deepEqual(data.aiStatuses, { notRequested: 44, notNeeded: 0, used: 2, noMatch: 0, unavailable: 18 });
    assert.equal(data.dedicatedPageAvailable, 22);
  });

  test("gap eligibility threshold can be raised, never lowered below 3", async () => {
    await seedScenario();
    assert.deepEqual((await get("/gaps?minCount=8")).json.data.items.map((i) => i.termKey), []); // half down: 10 interactions but only 5 confirmed
    assert.ok((await get("/gaps?minCount=3")).json.data.items.some((i) => i.termKey === "ankle sprain"));
    assert.equal((await get("/gaps?minCount=2")).status, 400);
  });

  // ── Pagination and sorting ────────────────────────────────────────────────
  async function seedManyTerms() {
    const docs = [];
    const plan = [];
    for (let i = 1; i <= 30; i += 1) {
      const n = 3 + (i % 5);
      const key = `term ${String(i).padStart(2, "0")}`;
      const day = 1 + (i % 8);
      plan.push({ key, n, day });
      docs.push(...many(n, { term: key, createdAt: when(`2026-10-0${day}`, `${String(8 + (i % 10)).padStart(2, "0")}:00:00.000`) }));
    }
    await seed(docs);
    return plan;
  }

  test("sort=count orders by interactions then term; limit/offset page through every term exactly once", async () => {
    const plan = await seedManyTerms();
    const expected = [...plan].sort((a, b) => b.n - a.n || (a.key < b.key ? -1 : 1)).map((p) => p.key);
    const first = await get("/terms?limit=7&offset=0");
    assert.deepEqual(first.json.data.pagination, { limit: 7, offset: 0, total: 30, hasMore: true });
    const seen = [];
    for (let offset = 0; offset < 30; offset += 7) {
      const page = await get(`/terms?limit=7&offset=${offset}`);
      seen.push(...page.json.data.items.map((i) => i.term));
    }
    assert.deepEqual(seen, expected);
    assert.equal(new Set(seen).size, 30);
    const last = await get("/terms?limit=7&offset=28");
    assert.equal(last.json.data.items.length, 2);
    assert.equal(last.json.data.pagination.hasMore, false);
    const beyond = await get("/terms?limit=7&offset=500");
    assert.deepEqual(beyond.json.data.items, []);
    assert.equal(beyond.json.data.pagination.total, 30);
    assert.equal((await get("/terms")).json.data.items.length, 25); // default limit
    assert.equal((await get("/terms?limit=100")).json.data.items.length, 30);
  });

  test("sort=recent orders by last seen (newest first), then interactions, then term", async () => {
    await seedManyTerms();
    const items = (await get("/terms?sort=recent&limit=100")).json.data.items;
    assert.equal((await get("/terms?sort=recent")).json.data.sort, "recent");
    for (let i = 1; i < items.length; i += 1) {
      const a = items[i - 1];
      const b = items[i];
      assert.ok(a.lastSeen >= b.lastSeen, `${a.term} (${a.lastSeen}) before ${b.term} (${b.lastSeen})`);
      if (a.lastSeen === b.lastSeen) {
        assert.ok(a.interactions >= b.interactions, `${a.term} before ${b.term}`);
        if (a.interactions === b.interactions) assert.ok(a.termKey < b.termKey);
      }
    }
    assert.ok(items.every((i) => /^\d{4}-\d{2}-\d{2}$/.test(i.lastSeen))); // a date, not a timestamp
  });

  test("pagination and sort validation: strict allowlists with fixed errors", async () => {
    await seedManyTerms();
    for (const query of ["limit=0", "limit=101", "limit=-1", "limit=1.5", "limit=abc", "limit=", "offset=1001", "offset=-1", "offset=x",
      "sort=term", "sort=createdAt", "sort=count&sort=recent", "sort=", "outcome=nope", "aiStatus=nope", "minCount=2", "extra=1", "from[x]=1"]) {
      const res = await get(`/terms?${query}`);
      assert.equal(res.status, 400, query);
      assert.equal(res.headers.get("cache-control"), "no-store");
      assert.equal(res.json.success, false);
      assert.equal(res.json.error.code, "INVALID_REQUEST");
      assert.equal(res.json.error.message, "Invalid request parameter.");
      assert.deepEqual(Object.keys(res.json.error).sort(), ["code", "field", "message"]);
      assert.deepEqual(Object.keys(res.json), ["success", "error"]);
    }
    assert.equal((await get("/terms?limit=100&offset=1000")).status, 200);
    assert.equal((await get("/gaps?sort=count")).status, 400); // gaps has no sort parameter
  });

  // ── Safe errors ───────────────────────────────────────────────────────────
  test("errors never echo what the caller sent", async () => {
    const attacks = ["<script>alert(1)</script>", "'; DROP TABLE x;--", "{\"$gt\":\"\"}", "%00", "../../etc/passwd", "secret-health-text"];
    for (const attack of attacks) {
      const encoded = encodeURIComponent(attack);
      for (const path of [`/terms?from=${encoded}`, `/terms?outcome=${encoded}`, `/terms?${encoded}=1`, `/trend?termKey=${encoded}`, `/gaps?minCount=${encoded}`, `/summary?to=${encoded}`, `/terms?sort=${encoded}`]) {
        const res = await get(path);
        assert.equal(res.status, 400, path);
        assert.ok(!res.text.includes(attack) && !res.text.includes(encoded) && !res.text.includes("secret"), path);
      }
    }
  });

  test("a database failure is a fixed 500 with no detail, logged by endpoint and error name only", async () => {
    const secret = "secret-term-203.0.113.9-patient-10234";
    queryOverrides = {
      loadSummary: async () => { throw Object.assign(new Error(`failed for ${secret}`), { name: "MongoNetworkError" }); },
      loadWindowTerms: async () => { throw Object.assign(new Error(`failed for ${secret}`), { name: "MongoServerError", code: 13 }); },
      loadTrend: async () => { throw new TypeError(secret); },
    };
    for (const path of ["/summary", "/terms", "/gaps", "/trend"]) {
      const res = await get(`${path}`);
      assert.equal(res.status, 500, path);
      assert.equal(res.headers.get("cache-control"), "no-store");
      assert.deepEqual(res.json, { success: false, error: { code: "ANALYTICS_UNAVAILABLE", message: "Search analytics is temporarily unavailable." } });
      assert.ok(!res.text.includes(secret) && !res.text.includes("Mongo"));
    }
    assert.deepEqual(logs, [
      "[search-analytics] admin read failed: summary MongoNetworkError",
      "[search-analytics] admin read failed: terms MongoServerError",
      "[search-analytics] admin read failed: gaps MongoServerError",
      "[search-analytics] admin read failed: trend TypeError",
    ]);
    assert.ok(!logs.join(" ").includes(secret));
  });

  test("a throwing logger does not turn a failure into a crash", async () => {
    const noisy = createSearchAnalyticsAdminController({
      now: () => NOW, logger: () => { throw new Error("logger down"); },
      queries: { loadSummary: async () => { throw new Error("x"); } },
    });
    let status;
    const res = { set() {}, status(code) { status = code; return this; }, json() { return this; } };
    await noisy.summary({ query: {} }, res);
    assert.equal(status, 500);
  });

  test("a failing analytics read does not affect other parts of the application", async () => {
    queryOverrides = { loadSummary: async () => { throw new Error("boom"); } };
    assert.equal((await get("/summary")).status, 500);
    assert.equal((await get("/terms")).status, 200); // the next request is served normally
  });

  // ── Headers, shape, raw data ──────────────────────────────────────────────
  test("every response has Cache-Control: no-store", async () => {
    await seedScenario();
    const paths = [...everyEndpoint, "/summary?from=bad", "/nothing", "/trend?termKey=x%20y"];
    for (const path of paths) assert.equal((await get(path)).headers.get("cache-control"), "no-store", path);
    assert.equal((await get("/summary", { token: null })).headers.get("cache-control"), "no-store");
    assert.equal((await get("/summary", { method: "HEAD" })).headers.get("cache-control"), "no-store");
  });

  test("raw interactions and internal fields are never returned", async () => {
    await seedScenario();
    const raw = await SearchInteraction.collection.find({}).toArray();
    const forbiddenKeys = new Set(["_id", "id", "interactionId", "createdAt", "updatedAt", "expiresAt", "schemaVersion", "__v", "topScore", "resultCount",
      "resultTypes", "topResultType", "topResultDedicated", "settledBy", "userId", "accountId", "patientId", "doctorId", "appointmentId", "consultationId",
      "ip", "ipAddress", "userAgent", "headers", "cookies", "session", "email", "phone", "counts", "gap", "computedAt", "kind"]);
    const walk = (value, path = "") => {
      if (Array.isArray(value)) return value.forEach((v, i) => walk(v, `${path}[${i}]`));
      if (value && typeof value === "object") {
        for (const [key, inner] of Object.entries(value)) {
          assert.ok(!forbiddenKeys.has(key), `forbidden key "${key}" at ${path}`);
          walk(inner, `${path}.${key}`);
        }
      }
    };
    for (const path of everyEndpoint) {
      const res = await get(path);
      walk(res.json);
      assert.ok(!ID_PATTERN.test(res.text), `${path} contains an interaction id`);
      for (const doc of raw.slice(0, 20)) assert.ok(!res.text.includes(doc.interactionId));
      assert.ok(!/"createdAt"|"expiresAt"|"_id"/.test(res.text));
    }
  });

  test("response shapes are exact allowlists", async () => {
    await seedScenario();
    const summary = await get("/summary");
    assert.deepEqual(Object.keys(summary.json), ["success", "window", "data", "meta"]);
    assert.deepEqual(Object.keys(summary.json.window), ["from", "to", "days"]);
    assert.deepEqual(Object.keys(summary.json.meta), ["kThreshold", "generatedAt", "collectionEnabled", "truncated"]);
    assert.equal(summary.json.meta.kThreshold, 3);
    assert.equal(summary.json.meta.generatedAt, NOW.toISOString());
    assert.deepEqual(Object.keys(summary.json.data), ["interactions", "bySettledBy", "outcomes", "aiStatuses", "dedicatedPageAvailable", "terms", "gaps"]);
    assert.deepEqual(Object.keys(summary.json.data.terms), ["distinct", "shown", "suppressed", "interactionsInShownTerms", "interactionsInSuppressedTerms"]);

    const terms = await get("/terms");
    assert.deepEqual(Object.keys(terms.json.data), ["items", "pagination", "sort", "filters"]);
    assert.deepEqual(Object.keys(terms.json.data.items[0]), ["term", "termKey", "interactions", "lastSeen", "bySettledBy", "outcomes", "aiStatuses", "dedicatedPageAvailable", "topResultPath", "coverage"]);
    assert.deepEqual(Object.keys(terms.json.data.items[0].outcomes), ["dedicatedPageFound", "fallbackOnly", "noResults"]);
    assert.deepEqual(Object.keys(terms.json.data.filters), ["outcome", "aiStatus", "minCount"]);

    const gaps = await get("/gaps");
    assert.deepEqual(Object.keys(gaps.json.data), ["items", "pagination", "filters"]);
    assert.deepEqual(Object.keys(gaps.json.data.items[0]), ["term", "termKey", "gapType", "interactions", "confirmedInteractions", "unconfirmedInteractions", "confirmedDedicatedRate", "confirmedOutcomes", "aiAssistedFound", "instantNotFound", "lastSeen", "topResultPath"]);

    const trend = await get("/trend");
    assert.deepEqual(Object.keys(trend.json.data), ["scope", "points"]);
    assert.equal(trend.json.data.scope, "all");
    assert.equal((await get("/trend?termKey=acne")).json.data.scope, "term");
    assert.deepEqual(Object.keys(trend.json.data.points[0]), ["day", "interactions", "dedicatedPageFound", "fallbackOnly", "noResults", "aiUnavailable", "final"]);
  });

  test("text values are safe: control characters and line separators are stripped, paths are plain site paths", async () => {
    await seed(many(3, { term: "weird\u0007term", termKey: "weird term", topResultPath: "/ok/path", createdAt: when("2026-10-08") }));
    await seed(many(3, { term: "bad path", termKey: "bad path", topResultPath: "javascript:alert(1)", createdAt: when("2026-10-08") }));
    const items = (await get("/terms")).json.data.items;
    const weird = items.find((i) => i.termKey === "weird term");
    assert.equal(weird.term, "weirdterm");
    assert.deepEqual(weird.topResultPath, { path: "/ok/path", count: 3, dedicated: true });
    assert.equal(items.find((i) => i.termKey === "bad path").topResultPath, null);
  });

  test("read-only: calling every endpoint changes nothing in either collection", async () => {
    await seedScenario();
    await runRollup({ now: NOW, logger: () => {} });
    const snapshot = async () => JSON.stringify([
      await SearchInteraction.collection.find({}).sort({ interactionId: 1 }).toArray(),
      await SearchTermDailyStat.collection.find({}).sort({ _id: 1 }).toArray(),
    ]);
    const before = await snapshot();
    for (const path of [...everyEndpoint, "/trend?from=2025-09-09", "/summary?from=bad"]) await get(path);
    for (const method of ["POST", "PUT", "DELETE"]) await get("/summary", { method });
    assert.equal(await snapshot(), before);
  });

  // ── Feature flag ──────────────────────────────────────────────────────────
  test("the APIs work with collection switched off and report the flag; they never change it", async () => {
    await seedScenario();
    const savedFlag = process.env.SEARCH_ANALYTICS_ENABLED;
    flagOn = false;
    const off = await get("/summary");
    assert.equal(off.status, 200);
    assert.equal(off.json.meta.collectionEnabled, false);
    assert.equal(off.json.data.interactions, 64); // earlier data is still readable
    flagOn = true;
    assert.equal((await get("/summary")).json.meta.collectionEnabled, true);
    assert.equal(process.env.SEARCH_ANALYTICS_ENABLED, savedFlag);
  });

  test("an empty database gives empty aggregates, not errors", async () => {
    const summary = (await get("/summary")).json.data;
    assert.equal(summary.interactions, 0);
    assert.deepEqual(summary.terms, { distinct: 0, shown: 0, suppressed: 0, interactionsInShownTerms: 0, interactionsInSuppressedTerms: 0 });
    assert.deepEqual((await get("/terms")).json.data.items, []);
    assert.deepEqual((await get("/gaps")).json.data.items, []);
    assert.equal((await get("/trend")).json.data.points.length, 30);
  });

  // ── Trend ─────────────────────────────────────────────────────────────────
  test("trend: one point per UTC day; finalized days come from the rollup, other days are computed live", async () => {
    await seed([
      ...many(4, { term: "acne", createdAt: when("2026-10-04") }),
      ...many(2, { term: "acne", outcome: "no_results", createdAt: when("2026-10-04", "13:00:00.000") }),
      ...many(3, { term: "acne", createdAt: when("2026-10-05") }),
      ...many(1, { term: "rare one", createdAt: when("2026-10-05", "15:00:00.000") }),
    ]);
    await runRollup({ now: new Date("2026-10-06T12:00:00.000Z"), logger: () => {} }); // rolls up 10-04 and 10-05 (final)
    await seed(many(5, { term: "late", createdAt: when("2026-10-07") })); // never rolled up: live
    await seed(many(2, { term: "today", createdAt: when("2026-10-09", "08:00:00.000") })); // today: live, partial
    const res = await get("/trend?from=2026-10-03&to=2026-10-09");
    const points = res.json.data.points;
    assert.deepEqual(points.map((p) => p.day), ["2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"]);
    const by = Object.fromEntries(points.map((p) => [p.day, p]));
    assert.deepEqual([by["2026-10-04"].interactions, by["2026-10-04"].dedicatedPageFound, by["2026-10-04"].noResults, by["2026-10-04"].final], [6, 4, 2, true]);
    assert.deepEqual([by["2026-10-05"].interactions, by["2026-10-05"].final], [4, true]); // 3 acne + 1 folded "rare one", all counted
    assert.deepEqual([by["2026-10-07"].interactions, by["2026-10-07"].final], [5, false]);
    assert.deepEqual([by["2026-10-09"].interactions, by["2026-10-09"].final], [2, false]);
    assert.deepEqual([by["2026-10-03"].interactions, by["2026-10-06"].interactions, by["2026-10-08"].interactions], [0, 0, 0]);
    assert.ok(res.json.data.points.every((p) => p.aiUnavailable === 0));
  });

  test("trend for a term shows only days it reached 3 interactions; other days are null", async () => {
    await seed([
      ...many(3, { term: "acne", createdAt: when("2026-10-05") }),
      ...many(2, { term: "acne", createdAt: when("2026-10-06") }), // below 3 that day: folded
      ...many(4, { term: "acne", settledBy: "submit", createdAt: when("2026-10-07") }),
    ]);
    await runRollup({ now: new Date("2026-10-06T12:00:00.000Z"), logger: () => {} });
    const res = await get("/trend?from=2026-10-05&to=2026-10-08&termKey=acne");
    assert.equal(res.json.data.scope, "term");
    assert.ok(!("termKey" in res.json.data) && !res.text.includes("acne")); // the requested term is not echoed
    assert.deepEqual(res.json.data.points.map((p) => p.interactions), [3, null, 4, null]);
    assert.deepEqual(res.json.data.points[1], { day: "2026-10-06", interactions: null, dedicatedPageFound: null, fallbackOnly: null, noResults: null, aiUnavailable: null, final: false });
  });

  test("a suppressed term and a never-searched term get identical trend answers", async () => {
    await seed([...many(2, { term: "secretrare", createdAt: when("2026-10-07") }), ...many(1, { term: "secretrare", createdAt: when("2026-10-08") })]);
    await runRollup({ now: NOW, logger: () => {} });
    const suppressed = await get("/trend?from=2026-10-05&to=2026-10-09&termKey=secretrare");
    const neverSearched = await get("/trend?from=2026-10-05&to=2026-10-09&termKey=neversearched");
    assert.deepEqual(suppressed.json.data.points, neverSearched.json.data.points);
    assert.ok(suppressed.json.data.points.every((p) => p.interactions === null));
    assert.deepEqual(suppressed.json.window, neverSearched.json.window);
  });

  test("trend over a 396-day window reads the rollup for old days and returns every day", async () => {
    await SearchTermDailyStat.collection.insertOne({
      _id: "2025-12-01|other|", day: new Date("2025-12-01T00:00:00.000Z"), kind: "other", termKey: null, term: null, interactions: 9,
      bySettledBy: { idle: 9, select: 0, submit: 0 }, outcomes: { dedicated_page_found: 5, fallback_only: 3, no_results: 1 },
      aiStatuses: { not_requested: 9, not_needed: 0, used: 0, no_match: 0, unavailable: 0 }, dedicatedPageAvailableCount: 5,
      topResultPath: null, topResultPathCount: null, topResultDedicated: null, distinctTerms: 4, finalized: true,
      computedAt: new Date("2025-12-02T09:00:00.000Z"), schemaVersion: 1, expiresAt: new Date("2027-01-01T00:00:00.000Z"),
    });
    const res = await get("/trend?from=2025-09-09&to=2026-10-09");
    assert.equal(res.json.data.points.length, 396);
    const point = res.json.data.points.find((p) => p.day === "2025-12-01");
    assert.deepEqual([point.interactions, point.dedicatedPageFound, point.fallbackOnly, point.noResults, point.final], [9, 5, 3, 1, true]);
  });

  // ── Statistical differencing (k = 3, one suppression unit: the term-day cell) ──
  // Every term-level number is released only as a sum of VISIBLE cells (a term with
  // >= 3 interactions on a UTC day). These tests drive the real endpoints with
  // overlapping windows, filters and endpoints and show that no combination exposes
  // a hidden cell. They do not claim protection against every inference attack:
  // see differencing 8 for what is deliberately still released.
  const itemsOf = async (path) => Object.fromEntries((await get(path)).json.data.items.map((i) => [i.termKey, i]));
  const win = (from, to) => `from=${from}&to=${to}`;
  const D = (n) => `2026-10-0${n}`;

  test("differencing 1: overlapping windows cannot expose a 2-interaction day of a term that is visible on other days", async () => {
    // knee pain: 5 on the 5th (visible), 2 on the 6th (hidden), 4 on the 7th (visible).
    await seed([
      ...many(5, { term: "knee pain", createdAt: when(D(5)) }),
      ...many(2, { term: "knee pain", createdAt: when(D(6)) }),
      ...many(4, { term: "knee pain", createdAt: when(D(7)) }),
    ]);
    const n = async (from, to) => (await itemsOf(`/terms?${win(from, to)}&limit=100`))["knee pain"]?.interactions ?? 0;
    // Under a per-window rule the 5th..6th window would say 7, and 7 - 5 = 2 would recover the hidden day.
    assert.equal(await n(D(5), D(6)), 5);
    assert.equal(await n(D(5), D(5)), 5);
    assert.equal(await n(D(6), D(6)), 0);
    assert.equal(await n(D(6), D(7)), 4);
    assert.equal(await n(D(5), D(7)), 9);
    // Every window pair: the released values are 0, 4, 5 or 9 - sums of visible days. 2 and 7 never occur.
    const seen = new Set();
    for (const [a, b] of [[5, 5], [5, 6], [5, 7], [6, 6], [6, 7], [7, 7]]) seen.add(await n(D(a), D(b)));
    assert.deepEqual([...seen].sort((x, y) => x - y), [0, 4, 5, 9]);
  });

  test("differencing 2: /terms, /trend and /summary reconcile exactly, so subtracting them yields nothing hidden", async () => {
    await seed([
      ...many(5, { term: "knee pain", createdAt: when(D(5)) }),
      ...many(2, { term: "knee pain", createdAt: when(D(6)) }),
      ...many(4, { term: "knee pain", createdAt: when(D(7)) }),
      ...many(1, { term: "lonely", createdAt: when(D(6)) }),
    ]);
    await runRollup({ now: new Date("2026-10-08T12:00:00.000Z"), logger: () => {} }); // rolls the 5th..7th up (final)
    for (const [a, b] of [[5, 7], [5, 6], [6, 7], [6, 6]]) {
      const query = win(D(a), D(b));
      const items = await itemsOf(`/terms?${query}&limit=100`);
      const trend = (await get(`/trend?${query}&termKey=knee%20pain`)).json.data.points;
      assert.equal(items["knee pain"]?.interactions ?? 0, trend.reduce((sum, p) => sum + (p.interactions ?? 0), 0), `terms vs trend ${query}`);
      const summary = (await get(`/summary?${query}`)).json.data;
      const listed = Object.values(items).reduce((sum, i) => sum + i.interactions, 0);
      assert.equal(summary.terms.interactionsInShownTerms, listed, `summary vs terms ${query}`);
      assert.equal(summary.interactions - listed, summary.terms.interactionsInSuppressedTerms);
    }
  });

  test("differencing 3: lastSeen never reveals the day of an interaction in a hidden cell", async () => {
    await seed([...many(4, { term: "knee pain", createdAt: when(D(2)) }), ...many(2, { term: "knee pain", createdAt: when(D(8)) })]);
    const item = (await itemsOf("/terms?limit=100"))["knee pain"];
    assert.equal(item.lastSeen, "2026-10-02"); // not the 8th
    assert.equal(item.interactions, 4);
    const recent = (await get("/terms?sort=recent&limit=100")).json.data.items.find((i) => i.termKey === "knee pain");
    assert.equal(recent.lastSeen, "2026-10-02");
  });

  test("differencing 4: the spelling and the top result path come from visible cells only", async () => {
    // The 4th: 3 interactions (visible) - 2 reach /a-page, 1 reaches /b-page. The 5th: 2 more reach /b-page (hidden).
    await seed([
      ...many(2, { term: "Back Pain", termKey: "back pain", topResultPath: "/a-page", createdAt: when(D(4)) }),
      ...many(1, { term: "Back Pain", termKey: "back pain", topResultPath: "/b-page", createdAt: when(D(4), "13:00:00.000") }),
      ...many(2, { term: "BACK PAIN!!", termKey: "back pain", topResultPath: "/b-page", createdAt: when(D(5)) }),
    ]);
    const res = await get("/terms?limit=100");
    const item = res.json.data.items.find((i) => i.termKey === "back pain");
    assert.equal(item.interactions, 3);
    assert.deepEqual(item.topResultPath, { path: "/a-page", count: 2, dedicated: true }); // counting the hidden cell would make /b-page win with 3
    assert.equal(item.term, "Back Pain");
    assert.ok(!res.text.includes("BACK PAIN!!"));
  });

  test("differencing 5: gaps are judged and counted on visible cells only", async () => {
    await seed([
      ...many(6, { term: "ear ringing", outcome: "no_results", createdAt: when(D(4)) }),
      ...many(2, { term: "ear ringing", outcome: "dedicated_page_found", createdAt: when(D(5)) }), // hidden: must not soften the gap
    ]);
    const item = (await get("/gaps?minCount=3")).json.data.items.find((i) => i.termKey === "ear ringing");
    assert.equal(item.interactions, 6);
    assert.equal(item.confirmedOutcomes.dedicatedPageFound, 0);
    assert.equal(item.gapType, "no_catalog_match");
  });

  test("differencing 6: filters cannot be combined with windows to pull out a hidden cell", async () => {
    // day 4: 4 interactions (3 not-found + 1 found) - visible; day 5: 2 found - hidden.
    await seed([
      ...many(3, { term: "tinnitus", outcome: "no_results", createdAt: when(D(4)) }),
      ...many(1, { term: "tinnitus", outcome: "dedicated_page_found", createdAt: when(D(4), "13:00:00.000") }),
      ...many(2, { term: "tinnitus", outcome: "dedicated_page_found", createdAt: when(D(5)) }),
    ]);
    const found = async (from, to) => (await itemsOf(`/terms?${win(from, to)}&outcome=dedicated_page_found&limit=100`)).tinnitus?.interactions ?? 0;
    // Filtered to "found": day 4 contributes 1, the hidden day contributes nothing; 1 < 3 so the term is absent in every window.
    assert.equal(await found(D(4), D(5)), 0);
    assert.equal(await found(D(5), D(5)), 0);
    assert.equal(await found(D(4), D(4)), 0);
    // Unfiltered, the term shows 4 over both windows (the hidden 2 never enter).
    assert.equal((await itemsOf(`/terms?${win(D(4), D(5))}&limit=100`)).tinnitus.interactions, 4);
    for (const extra of ["minCount=5", "aiStatus=not_requested&minCount=3", "aiStatus=used"]) {
      const items = await itemsOf(`/terms?${win(D(4), D(5))}&${extra}&limit=100`);
      assert.ok(!items.tinnitus || items.tinnitus.interactions === 4, extra);
    }
  });

  test("differencing 7 (model check): across windows and filters, every released term count equals the sum of its visible cells", async () => {
    // Deterministic pseudo-random data: 6 terms over days 1..8 with 0..5 interactions per cell, random
    // outcomes and AI statuses. Expected values come from a plain JS model of the cell rule.
    let state = 20260509;
    const rand = (max) => { state = (state * 1664525 + 1013904223) % 4294967296; return Math.floor(state / 65536) % max; };
    const outcomes = ["dedicated_page_found", "fallback_only", "no_results"];
    const aiStatuses = ["not_requested", "not_needed", "used", "no_match", "unavailable"];
    const termsList = ["alpha one", "beta two", "gamma three", "delta four", "epsilon five", "zeta six"];
    const model = new Map(); // term -> day -> [{outcome, aiStatus}]
    const docs = [];
    for (const term of termsList) {
      model.set(term, new Map());
      for (let day = 1; day <= 8; day += 1) {
        const cell = [];
        const size = rand(6);
        for (let i = 0; i < size; i += 1) {
          const entry = { outcome: outcomes[rand(3)], aiStatus: aiStatuses[rand(5)] };
          cell.push(entry);
          docs.push(interaction({ term, outcome: entry.outcome, settledBy: "idle", aiStatus: entry.aiStatus, createdAt: when(D(day), `${String(8 + i).padStart(2, "0")}:00:00.000`) }));
        }
        model.get(term).set(day, cell);
      }
    }
    await seed(docs);
    const visibleCells = [...model.values()].flatMap((days) => [...days.values()]).filter((cell) => cell.length >= 3).length;
    const hiddenCells = [...model.values()].flatMap((days) => [...days.values()]).filter((cell) => cell.length > 0 && cell.length < 3).length;
    assert.ok(visibleCells > 5 && hiddenCells > 5, `the data must exercise both (${visibleCells} visible, ${hiddenCells} hidden)`);

    const expected = (term, from, to, filter) => {
      let total = 0;
      for (let day = from; day <= to; day += 1) {
        const cell = model.get(term).get(day);
        if (cell.length < 3) continue; // hidden cell: contributes to nothing
        total += cell.filter((x) => (!filter.outcome || x.outcome === filter.outcome) && (!filter.aiStatus || x.aiStatus === filter.aiStatus)).length;
      }
      return total >= 3 ? total : 0;
    };
    const filters = [{}, { outcome: "no_results" }, { aiStatus: "not_requested" }, { outcome: "fallback_only", aiStatus: "used" }];
    let checked = 0;
    for (const filter of filters) {
      const qs = Object.entries(filter).map(([k, v]) => `&${k}=${v}`).join("");
      for (const [from, to] of [[1, 8], [1, 4], [3, 8], [2, 2], [4, 6], [5, 7], [1, 1], [7, 8]]) {
        const items = await itemsOf(`/terms?${win(D(from), D(to))}${qs}&limit=100`);
        for (const term of termsList) {
          assert.equal(items[term]?.interactions ?? 0, expected(term, from, to, filter), `${term} ${from}-${to} ${JSON.stringify(filter)}`);
          checked += 1;
        }
      }
    }
    assert.equal(checked, 4 * 8 * 6);
  });

  test("differencing 8 (documented residual): the day-level pool is released as counts, and composition inside a visible cell is not hidden", async () => {
    await seed([
      ...many(4, { term: "knee pain", outcome: "no_results", createdAt: when(D(5)) }),
      ...many(1, { term: "knee pain", outcome: "dedicated_page_found", createdAt: when(D(5), "14:00:00.000") }),
      ...many(2, { term: "someone", createdAt: when(D(5)) }),
    ]);
    // A single-day window shows how many interactions sit outside visible cells (2), never whose they are.
    const day = await get(`/summary?${win(D(5), D(5))}`);
    assert.equal(day.json.data.terms.interactionsInSuppressedTerms, 2);
    assert.ok(!day.text.includes("someone"));
    // Inside a visible cell the breakdown is shown (approved response shape): 1 found out of 5.
    assert.equal((await itemsOf(`/terms?${win(D(5), D(5))}`))["knee pain"].outcomes.dedicatedPageFound, 1);
  });

  // ── Trend budget over HTTP ────────────────────────────────────────────────
  test("trend budget: a rollup that is far behind gets one fixed 503 with no detail; other endpoints are unaffected", async () => {
    // Five different days with data and no rollup at all: more live days than the budget allows.
    await seed([5, 6, 7, 8].flatMap((day) => many(3, { term: `behind ${day}`, createdAt: when(D(day)) })).concat(many(3, { term: "behind 9", createdAt: when("2026-10-09", "08:00:00.000") })));
    const res = await get("/trend?from=2026-10-01&to=2026-10-09");
    assert.equal(res.status, 503);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.equal(res.headers.get("retry-after"), "30");
    assert.deepEqual(res.json, { success: false, error: { code: "TREND_UNAVAILABLE", message: "The trend could not be computed right now. Please try again shortly." } });
    assert.ok(!/behind|interactions|mongo/i.test(res.text.replace("interactions", "")));
    assert.deepEqual(logs, ["[search-analytics] admin read failed: trend TrendBudgetError"]);
    assert.equal((await get("/summary")).status, 200);
    // Once the rollup catches up, the same request is served.
    await runRollup({ now: NOW, logger: () => {} });
    assert.equal((await get("/trend?from=2026-10-01&to=2026-10-09")).status, 200);
  });

  test("trend budget: a busy or timed-out trend is the same fixed 503, whatever the cause", async () => {
    const { TrendBudgetError } = require("../../services/searchAnalytics/trendBudget");
    for (const reason of ["busy", "time", "queries", "live_days"]) {
      queryOverrides = { loadTrend: async () => { throw new TrendBudgetError(reason); } };
      const res = await get("/trend");
      assert.equal(res.status, 503, reason);
      assert.equal(res.json.error.code, "TREND_UNAVAILABLE");
      assert.ok(!res.text.includes(reason));
    }
  });
});
