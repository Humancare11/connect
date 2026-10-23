// The read-time privacy check of the admin Search Analytics APIs (findRefusedTerms + the controller wiring).
// It works IN ADDITION to the minimum of 3 interactions and FAILS CLOSED: when the check cannot be completed, no
// term-level row is returned by any endpoint. Pure tests: fake model and fake queries, no database.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const SearchInteraction = require("../../models/SearchInteraction");
const { interaction, many } = require("./rawInteractions");
const { findRefusedTerms, loadWindowTerms, loadDailyTerms } = require("../../services/searchAnalytics/adminQueries");
const { createSearchAnalyticsAdminController } = require("../../controllers/searchAnalyticsAdminController");

const WINDOW = { start: new Date("2026-10-01T00:00:00Z"), end: new Date("2026-10-08T00:00:00Z"), days: 7 };

// A fake SearchInteraction whose grouped read streams the given (termKey, term) pairs.
const fakeInteraction = (groups, { throwWith = null } = {}) => ({
  aggregate: () => ({
    cursor: () => ({
      async *[Symbol.asyncIterator]() {
        if (throwWith) throw throwWith;
        for (const [termKey, term] of groups) yield { _id: { termKey, term } };
      },
    }),
  }),
});

describe("findRefusedTerms (the current rules re-check every stored spelling)", () => {
  test("a term whose stored spelling the current rules refuse is reported; clean terms are not", async () => {
    const Interaction = fakeInteraction([
      ["knee pain", "knee pain"],
      ["mail me at jane@example.com", "mail me at jane@example.com"], // contact details
      ["dr rahul sharma", "dr rahul sharma"], // a named doctor
      ["acne", "acne"],
    ]);
    const result = await findRefusedTerms({ window: WINDOW }, { Interaction });
    assert.equal(result.complete, true);
    assert.deepEqual(result.keys, ["dr rahul sharma", "mail me at jane@example.com"]);
  });

  test("one refused spelling is enough to refuse the whole term key", async () => {
    const Interaction = fakeInteraction([
      ["rash", "rash"],
      ["rash", "rash on 555-123-4567"], // a legacy spelling with a phone number
    ]);
    const result = await findRefusedTerms({ window: WINDOW }, { Interaction });
    assert.deepEqual(result.keys, ["rash"]);
  });

  test("too many distinct spellings: incomplete, no keys trusted (fails closed)", async () => {
    const groups = Array.from({ length: 6 }, (_, i) => [`term ${i}`, `term ${i}`]);
    const result = await findRefusedTerms({ window: WINDOW }, { Interaction: fakeInteraction(groups), maxGroups: 5 });
    assert.deepEqual(result, { keys: [], complete: false, reason: "limit" });
  });

  test("a database error: incomplete, with the error NAME only (never its message)", async () => {
    const boom = Object.assign(new Error("secret search text in the message"), { name: "MongoServerError" });
    const result = await findRefusedTerms({ window: WINDOW }, { Interaction: fakeInteraction([], { throwWith: boom }) });
    assert.equal(result.complete, false);
    assert.equal(result.reason, "error");
    assert.equal(result.errorName, "MongoServerError");
    assert.ok(!JSON.stringify(result).includes("secret"));
    assert.deepEqual(result.keys, []);
  });
});

describe("the controller applies BOTH protections and fails closed", () => {
  const emptyList = { rows: [], truncated: false };
  const calls = [];
  let check;
  const logs = [];
  const queries = {
    findRefusedTerms: async () => check,
    loadWindowTerms: async (options) => (calls.push(["loadWindowTerms", options]), emptyList),
    loadDailyTerms: async (options) => (calls.push(["loadDailyTerms", options]), { rows: [], other: [], total: 0 }),
    loadSummary: async (options) => (
      calls.push(["loadSummary", options]),
      {
        totals: { n: 0, available: 0 },
        terms: { distinct: 0, shown: 0, suppressed: 0, interactionsInShownTerms: 0, interactionsInSuppressedTerms: 0 },
        gaps: { pageMissing: 0, noCatalogMatch: 0, aliasOpportunity: 0, unconfirmedInteractions: 0 },
        truncated: false,
      }
    ),
    loadTrend: async () => [],
  };
  const controller = createSearchAnalyticsAdminController({
    queries,
    now: () => new Date("2026-10-09T09:00:00Z"),
    logger: (message) => logs.push(message),
    isEnabled: () => true,
  });
  const run = async (handler, query = {}) => {
    let status = 200;
    let body;
    const res = { set() {}, status(code) { status = code; return this; }, json(value) { body = value; return this; } };
    await handler({ query }, res);
    return { status, body };
  };

  const ENDPOINTS = [
    ["terms", () => controller.terms, "loadWindowTerms"],
    ["daily-terms", () => controller.dailyTerms, "loadDailyTerms"],
    ["summary", () => controller.summary, "loadSummary"],
  ];

  for (const [name, handler, loader] of ENDPOINTS) {
    test(`/${name}: check complete -> refused keys excluded, and terms are listed from their first search (visibleFrom 1)`, async () => {
      calls.length = 0;
      check = { keys: ["refused term"], complete: true };
      const { status, body } = await run(handler());
      assert.equal(status, 200);
      assert.equal(body.meta.kThreshold, 3);
      assert.equal(body.meta.termsCheckComplete, true);
      const options = calls.find(([fn]) => fn === loader)[1];
      assert.deepEqual(options.excludeTermKeys, ["refused term"]);
      assert.equal(options.visibleFrom, 1, "a term is listed from its first search");
      assert.notEqual(options.hideTerms, true);
    });

    test(`/${name}: check incomplete -> hideTerms, termsCheckComplete false, and the log line carries no search text`, async () => {
      calls.length = 0;
      logs.length = 0;
      check = { keys: [], complete: false, reason: "error", errorName: "MongoServerError" };
      const { status, body } = await run(handler());
      assert.equal(status, 200);
      assert.equal(body.meta.termsCheckComplete, false);
      assert.equal(calls.find(([fn]) => fn === loader)[1].hideTerms, true);
      assert.ok(logs.some((line) => line.includes("privacy check incomplete") && line.includes(name)));
      assert.ok(logs.every((line) => !/refused term|secret/.test(line)));
    });
  }

  test("/terms: a caller can raise minCount above 1 but never below 1", async () => {
    check = { keys: [], complete: true };
    assert.equal((await run(controller.terms, { minCount: "0" })).status, 400);
    assert.equal((await run(controller.terms, { minCount: "1" })).status, 200);
    assert.equal((await run(controller.terms, { minCount: "5" })).status, 200);
  });

  test("/gaps keeps its own minimum: no visibleFrom is passed and minCount below 3 is refused", async () => {
    check = { keys: ["refused term"], complete: true };
    calls.length = 0;
    assert.equal((await run(controller.gaps, {})).status, 200);
    const options = calls.find(([fn]) => fn === "loadWindowTerms")[1];
    assert.deepEqual(options.excludeTermKeys, ["refused term"]);
    assert.equal(options.visibleFrom, undefined, "the data layer's default minimum of 3 applies");
    assert.equal((await run(controller.gaps, { minCount: "2" })).status, 400);
  });

  test("/daily-terms has no minCount parameter at all", async () => {
    check = { keys: [], complete: true };
    assert.equal((await run(controller.dailyTerms, { minCount: "1" })).status, 400);
  });
});

describe("end to end against an in-memory database: listing from the first search AND the read-time exclusion", () => {
  let mongod;
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await SearchInteraction.collection.insertMany([
      ...many(4, { term: "knee pain" }), // clean and frequent: listed
      ...many(2, { term: "rare clean term" }), // clean and rare: listed from its first search (but not by /gaps, which keeps 3)
      ...many(5, { term: "call me on 555 123 4567" }), // frequent but refused by the current rules: never listed
    ]);
  });
  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });
  const window = { start: new Date("2026-10-01T00:00:00Z"), end: new Date("2026-10-09T00:00:00Z"), days: 8 };

  test("findRefusedTerms finds the refused spelling in the stored data", async () => {
    const check = await findRefusedTerms({ window });
    assert.equal(check.complete, true);
    assert.deepEqual(check.keys, ["call me on 555 123 4567"]);
  });

  test("/terms rows (visibleFrom 1): every clean term is listed, the refused one is absent", async () => {
    const check = await findRefusedTerms({ window });
    const { rows } = await loadWindowTerms({ window, visibleFrom: 1, excludeTermKeys: check.keys });
    assert.deepEqual(rows.map((row) => row.termKey).sort(), ["knee pain", "rare clean term"]);
    assert.ok(!JSON.stringify(rows).includes("555"));
  });

  test("/gaps rows (the data layer's default): the ordinary minimum of 3 still applies", async () => {
    const check = await findRefusedTerms({ window });
    const { rows } = await loadWindowTerms({ window, excludeTermKeys: check.keys });
    assert.deepEqual(rows.map((row) => row.termKey), ["knee pain"]);
  });

  test("the data layer: visibleFrom defaults to 3, accepts 1, and can never go below 1", async () => {
    const refused = ["call me on 555 123 4567"];
    for (const visibleFrom of [undefined, NaN]) {
      const { rows } = await loadWindowTerms({ window, visibleFrom, excludeTermKeys: refused });
      assert.deepEqual(rows.map((row) => row.termKey), ["knee pain"], "visibleFrom=" + String(visibleFrom));
      const daily = await loadDailyTerms({ window, visibleFrom, excludeTermKeys: [], limit: 50, offset: 0 });
      assert.ok(!daily.rows.some((row) => row.termKey === "rare clean term"), "daily visibleFrom=" + String(visibleFrom));
    }
    for (const visibleFrom of [1, 0, -5, "1"]) {
      const { rows } = await loadWindowTerms({ window, visibleFrom, excludeTermKeys: refused });
      assert.deepEqual(rows.map((row) => row.termKey).sort(), ["knee pain", "rare clean term"], "visibleFrom=" + String(visibleFrom));
    }
  });

  test("hideTerms returns no rows at all", async () => {
    assert.deepEqual((await loadWindowTerms({ window, hideTerms: true })).rows, []);
    const daily = await loadDailyTerms({ window, hideTerms: true, limit: 50, offset: 0 });
    assert.deepEqual(daily.rows, []);
  });

  test("/daily-terms rows (visibleFrom 1): clean terms are listed from their first search; the refused term is folded into 'other', never named", async () => {
    const check = await findRefusedTerms({ window });
    const daily = await loadDailyTerms({ window, visibleFrom: 1, excludeTermKeys: check.keys, limit: 50, offset: 0 });
    assert.deepEqual(daily.rows.map((row) => row.termKey).sort(), ["knee pain", "rare clean term"]);
    assert.ok(!JSON.stringify(daily).includes("555"));
    assert.equal(daily.other.reduce((n, r) => n + r.interactions, 0), 5, "only the refused term's 5 interactions are counted as 'other'");
    assert.equal(daily.rows.reduce((n, r) => n + r.interactions, 0) + daily.other.reduce((n, r) => n + r.interactions, 0), 11);
  });
});
