// Top terms, Daily terms and Summary list every privacy-eligible search term from its
// FIRST interaction; Gaps and Trend keep the 3-interactions-per-UTC-day minimum. No endpoint
// returns a stored spelling the CURRENT privacy rules refuse, and when that check cannot be
// completed no term-level row is returned at all.
//
// Newly written for the current code (not a recovered test). It runs the real
// aggregations and the real admin controller against an ephemeral in-memory MongoDB;
// no configured database is touched.
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const SearchInteraction = require("../../models/SearchInteraction");
const { createSearchAnalyticsAdminController } = require("../../controllers/searchAnalyticsAdminController");
const adminQueries = require("../../services/searchAnalytics/adminQueries");
const { createSearchInteractionRecorder } = require("../../services/searchAnalytics/recorder");
const { analyzeForAnalytics } = require("../../services/search/queryRedaction");
const { normalizeForMatch, singularForm } = require("../../services/search/queryNormalizer");

const NOW = new Date("2026-10-09T09:00:00.000Z");
const QUERY = "from=2026-10-01&to=2026-10-08";
const PATH = "/general-and-everyday-care/general-physician";

// The grouping key exactly as the recorder builds it.
const keyOf = (term) => singularForm(normalizeForMatch(term));

let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${(++seq).toString(16).padStart(12, "0")}`;

// A raw SearchInteraction, inserted through the driver so createdAt is exact and so that a
// "legacy" document (recorded under an older privacy rule) can be simulated.
function raw({ term, termKey = keyOf(term), day = "2026-10-05", outcome = "dedicated_page_found", settledBy = "idle", hour = 12 }) {
  const found = outcome !== "no_results";
  const createdAt = new Date(`${day}T${String(hour).padStart(2, "0")}:00:00.000Z`);
  return {
    interactionId: uuid(),
    term,
    termKey,
    settledBy,
    aiStatus: settledBy === "submit" ? "not_needed" : "not_requested",
    outcome,
    resultCount: found ? 1 : 0,
    resultTypes: found ? ["condition"] : [],
    dedicatedPageAvailable: outcome === "dedicated_page_found",
    topResultType: found ? "condition" : null,
    topResultPath: found ? PATH : null,
    topResultDedicated: found ? outcome === "dedicated_page_found" : null,
    topScore: found ? 90 : null,
    schemaVersion: 1,
    expiresAt: new Date("2027-01-01T00:00:00.000Z"),
    createdAt,
    updatedAt: createdAt,
  };
}
const times = (n, fields) => Array.from({ length: n }, (_, i) => raw({ ...fields, hour: 6 + (i % 14) }));

// Text the CURRENT privacy rules refuse (a legacy document could still carry it).
const REFUSED = "reach me at jane.doe@example.com";

describe("Search terms are listed from their first search", { timeout: 300000 }, () => {
  let mongod;
  let server;
  let baseUrl;
  let logs;
  const fallbackLogs = [];
  const insert = (docs) => SearchInteraction.collection.insertMany(docs);

  const controller = createSearchAnalyticsAdminController({
    now: () => NOW,
    logger: (message) => logs.push(message),
    isEnabled: () => true,
  });

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri(), { dbName: "topterms_test" });
    const app = express();
    for (const name of ["terms", "dailyTerms", "summary", "gaps", "trend"]) {
      app.get(`/${name === "dailyTerms" ? "daily-terms" : name}`, controller[name]);
    }
    // A second controller whose privacy check always reports "incomplete" (a group limit of 1), to test the fallback.
    const fallback = createSearchAnalyticsAdminController({
      now: () => NOW,
      logger: (message) => fallbackLogs.push(message),
      isEnabled: () => true,
      queries: { ...adminQueries, findRefusedTerms: (args, deps) => adminQueries.findRefusedTerms(args, { ...deps, maxGroups: 1 }) },
    });
    for (const name of ["terms", "dailyTerms", "summary", "gaps"]) {
      app.get(`/fb/${name === "dailyTerms" ? "daily-terms" : name}`, fallback[name]);
    }
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    await new Promise((resolve) => server?.close(resolve));
    await mongoose.disconnect();
    await mongod?.stop();
  });
  beforeEach(async () => {
    await SearchInteraction.collection.deleteMany({});
    logs = [];
    fallbackLogs.length = 0;
  });

  const get = async (path) => {
    const res = await fetch(`${baseUrl}${path}`);
    return { status: res.status, body: await res.json() };
  };
  const terms = (extra = "") => get(`/terms?${QUERY}${extra}`);
  const daily = (extra = "") => get(`/daily-terms?${QUERY}${extra}`);
  const summary = async () => (await get(`/summary?${QUERY}`)).body;
  const itemOf = (body, key) => body.data.items.find((item) => item.termKey === key);
  const keysOf = (body) => body.data.items.map((item) => item.termKey).sort();

  // ── Top terms ───────────────────────────────────────────────────────────────
  test("a privacy-eligible non-catalog query is listed after ONE interaction", async () => {
    assert.equal(analyzeForAnalytics("knee hurts badly").store, true, "precondition");
    await insert([raw({ term: "knee hurts badly" })]);
    const { status, body } = await terms();
    assert.equal(status, 200);
    assert.deepEqual(keysOf(body), [keyOf("knee hurts badly")]);
    assert.equal(body.data.items[0].interactions, 1);
    assert.equal(body.data.items[0].term, "knee hurts badly");
    assert.equal(body.data.filters.minCount, 1);
  });

  test("its count goes up each time it is searched again, within a day and across days", async () => {
    await insert([raw({ term: "knee hurts badly" })]);
    assert.equal(itemOf((await terms()).body, keyOf("knee hurts badly")).interactions, 1);
    await insert([raw({ term: "knee hurts badly", hour: 15 })]);
    assert.equal(itemOf((await terms()).body, keyOf("knee hurts badly")).interactions, 2);
    await insert([raw({ term: "knee hurts badly", day: "2026-10-03" }), raw({ term: "knee hurts badly", day: "2026-10-04" })]);
    const row = itemOf((await terms()).body, keyOf("knee hurts badly"));
    assert.equal(row.interactions, 4);
    assert.equal(row.lastSeen, "2026-10-05");
  });

  test("equivalent spellings are one term; different queries stay separate", async () => {
    await insert([
      raw({ term: "Back Pains" }),
      raw({ term: "back pain", hour: 13 }),
      raw({ term: "back pain at night" }),
      raw({ term: "knee pain" }),
    ]);
    const { body } = await terms();
    assert.equal(keyOf("Back Pains"), keyOf("back pain"), "precondition: same grouping key");
    assert.equal(body.data.items.length, 3);
    assert.equal(itemOf(body, keyOf("back pain")).interactions, 2);
    assert.equal(itemOf(body, keyOf("back pain at night")).interactions, 1);
    assert.equal(itemOf(body, keyOf("knee pain")).interactions, 1);
    assert.equal(body.data.items.reduce((sum, item) => sum + item.interactions, 0), 4, "no interaction counted twice or lost");
  });

  test("ingestion-time privacy: rejected searches are never recorded, so they cannot be listed", async () => {
    const recorder = createSearchInteractionRecorder({ logger: () => {} });
    const dto = (q, matches = {}) => ({ interactionId: uuid(), q, settledBy: "idle", aiStatus: "not_requested", matches, index: { categoryById: {}, specialtyById: {} } });
    const results = [
      await recorder(dto("call me on 555-123-4567")),
      await recorder(dto("jane.doe@example.com")),
      await recorder(dto("headache", { doctor: [{ type: "doctor", record: { doctorId: 7, displayName: "Dr Someone" }, score: 90 }] })),
      await recorder(dto("sore elbow")),
    ];
    assert.deepEqual(results.map((r) => r.status), ["dropped", "dropped", "dropped", "recorded"]);
    assert.equal(await SearchInteraction.countDocuments({}), 1);
    await SearchInteraction.collection.updateOne({}, { $set: { createdAt: new Date("2026-10-05T10:00:00.000Z") } }); // into the report window
    const json = JSON.stringify((await terms()).body).toLowerCase();
    assert.ok(json.includes("sore elbow"));
    for (const word of ["555", "jane", "example.com", "headache", "someone"]) assert.ok(!json.includes(word), word);
  });

  test("read-time privacy: a legacy stored term the CURRENT rules refuse is never shown", async () => {
    assert.equal(analyzeForAnalytics(REFUSED).store, false, "precondition: the current rules refuse this text");
    await insert([raw({ term: REFUSED, termKey: "reach me at jane doe example com" }), raw({ term: "sore elbow" })]);
    const { body } = await terms();
    assert.deepEqual(keysOf(body), [keyOf("sore elbow")]);
    const json = JSON.stringify(body).toLowerCase();
    for (const word of ["jane", "example", "reach me"]) assert.ok(!json.includes(word), word);
  });

  test("read-time privacy: one refused spelling hides the whole term, and none of its text is returned", async () => {
    await insert([
      raw({ term: "knee pain", termKey: "knee pain" }),
      raw({ term: "knee pain 555 123 4567", termKey: "knee pain" }), // legacy spelling with a phone number
      raw({ term: "elbow pain" }),
    ]);
    assert.equal(analyzeForAnalytics("knee pain 555 123 4567").store, false, "precondition");
    const { body } = await terms();
    assert.deepEqual(keysOf(body), [keyOf("elbow pain")]);
    assert.ok(!JSON.stringify(body).includes("555"));
  });

  test("an explicit minCount can raise the minimum; the old floor of 3 is gone; bad values are 400", async () => {
    await insert([raw({ term: "knee pain" }), ...times(3, { term: "elbow pain" })]);
    assert.deepEqual(keysOf((await terms()).body), [keyOf("elbow pain"), keyOf("knee pain")].sort());
    assert.deepEqual(keysOf((await terms("&minCount=2")).body), [keyOf("elbow pain")]);
    assert.deepEqual(keysOf((await terms("&minCount=4")).body), []);
    for (const bad of ["&minCount=0", "&minCount=abc", "&minCount=-1", "&outcome=bogus", "&unknown=1"]) {
      const { status, body } = await terms(bad);
      assert.equal(status, 400, bad);
      assert.equal(body.error.code, "INVALID_REQUEST");
      assert.ok(!JSON.stringify(body).includes("knee"));
    }
  });

  test("an outcome filter counts only matching interactions and omits a term with none", async () => {
    await insert([raw({ term: "knee pain", outcome: "no_results" }), raw({ term: "elbow pain", outcome: "dedicated_page_found" })]);
    const { body } = await terms("&outcome=no_results");
    assert.deepEqual(keysOf(body), [keyOf("knee pain")]);
    assert.equal(body.data.items[0].interactions, 1);
  });

  // ── Daily terms ─────────────────────────────────────────────────────────────
  test("Daily terms lists a one-off term on its day and does not fold it into 'Other'", async () => {
    await insert([raw({ term: "knee pain", day: "2026-10-05" }), raw({ term: "knee pain", day: "2026-10-06" }), raw({ term: "elbow pain", day: "2026-10-06" })]);
    const { status, body } = await daily();
    assert.equal(status, 200);
    const rows = body.data.items.map((i) => `${i.day} ${i.term} ${i.interactions}`).sort();
    assert.deepEqual(rows, ["2026-10-05 knee pain 1", "2026-10-06 elbow pain 1", "2026-10-06 knee pain 1"]);
    assert.deepEqual(body.data.other, []);
    assert.equal(body.data.pagination.total, 3);
    assert.equal(body.meta.kThreshold, 3, "meta keeps describing Gaps / Trend");
  });

  test("Daily terms: a refused legacy term is counted under 'Other' for its day, never shown", async () => {
    await insert([raw({ term: REFUSED, termKey: "reach me at jane doe example com", day: "2026-10-05" }), raw({ term: "knee pain", day: "2026-10-05" })]);
    const { body } = await daily();
    assert.deepEqual(body.data.items.map((i) => i.term), ["knee pain"]);
    assert.deepEqual(body.data.other, [{ day: "2026-10-05", interactions: 1 }]);
    assert.ok(!JSON.stringify(body).toLowerCase().includes("jane"));
  });

  // ── Summary ─────────────────────────────────────────────────────────────────
  test("Summary agrees with Top terms: every eligible term is shown, nothing is suppressed", async () => {
    await insert([raw({ term: "knee pain" }), raw({ term: "elbow pain" }), ...times(3, { term: "back pain" })]);
    const { data, meta } = await summary();
    const listed = (await terms()).body.data.items;
    assert.deepEqual(data.terms, { distinct: 3, shown: 3, suppressed: 0, interactionsInShownTerms: 5, interactionsInSuppressedTerms: 0 });
    assert.equal(data.terms.shown, listed.length);
    assert.equal(data.terms.interactionsInShownTerms, listed.reduce((sum, item) => sum + item.interactions, 0));
    assert.equal(data.terms.interactionsInShownTerms + data.terms.interactionsInSuppressedTerms, data.interactions);
    assert.equal(meta.termsCheckComplete, true);
  });

  test("Summary reconciles with Top terms when a legacy term is refused: it moves from shown to suppressed", async () => {
    await insert([raw({ term: REFUSED, termKey: "reach me at jane doe example com" }), raw({ term: "knee pain" }), raw({ term: "knee pain", hour: 14 })]);
    const { data, meta } = await summary();
    const listed = (await terms()).body.data.items;
    assert.deepEqual(data.terms, { distinct: 2, shown: 1, suppressed: 1, interactionsInShownTerms: 2, interactionsInSuppressedTerms: 1 });
    assert.equal(data.terms.shown, listed.length);
    assert.equal(data.interactions, 3);
    assert.equal(meta.termsCheckComplete, true);
  });

  test("Summary keeps its response fields", async () => {
    await insert([raw({ term: "knee pain" })]);
    const { data, meta } = await summary();
    assert.deepEqual(Object.keys(data).sort(), ["aiStatuses", "bySettledBy", "dedicatedPageAvailable", "gaps", "interactions", "outcomes", "terms"]);
    assert.deepEqual(Object.keys(data.terms).sort(), ["distinct", "interactionsInShownTerms", "interactionsInSuppressedTerms", "shown", "suppressed"]);
    assert.equal(meta.kThreshold, 3);
  });

  // ── Gaps and Trend are unchanged ────────────────────────────────────────────
  test("Gaps keep the minimum: a term spread thinly over days is listed in Top terms but not in Gaps", async () => {
    await insert([
      ...times(5, { term: "unmatched topic", settledBy: "submit", outcome: "no_results", day: "2026-10-05" }), // 5 in one day: a gap
      ...["2026-10-02", "2026-10-03", "2026-10-04", "2026-10-06", "2026-10-07"].map((day) => raw({ term: "scattered topic", settledBy: "submit", outcome: "no_results", day })), // 5, one per day
    ]);
    assert.deepEqual(keysOf((await terms()).body), [keyOf("scattered topic"), keyOf("unmatched topic")].sort());
    const gaps = (await get(`/gaps?${QUERY}`)).body;
    assert.deepEqual(gaps.data.items.map((item) => item.termKey), [keyOf("unmatched topic")]);
    assert.equal((await get(`/gaps?${QUERY}&minCount=2`)).status, 400, "Gaps still cannot go below 3");
  });

  test("Trend is unchanged: a one-off term has no trend (trendAvailable=false); a term with a 3-search day has one", async () => {
    await insert([raw({ term: "knee pain" }), ...times(3, { term: "elbow pain", day: "2026-10-02" })]);
    const { body } = await terms();
    assert.equal(itemOf(body, keyOf("knee pain")).trendAvailable, false);
    assert.equal(itemOf(body, keyOf("elbow pain")).trendAvailable, true);
    const sum = async (term) => ((await get(`/trend?${QUERY}&termKey=${encodeURIComponent(keyOf(term))}`)).body.data.points || []).reduce((s, p) => s + p.interactions, 0);
    assert.equal(await sum("knee pain"), 0);
    assert.equal(await sum("elbow pain"), 3);
  });

  test("response compatibility: Top terms keeps its fields", async () => {
    await insert([raw({ term: "knee pain" })]);
    const { body } = await terms();
    assert.deepEqual(Object.keys(body.data).sort(), ["filters", "items", "pagination", "sort"]);
    assert.deepEqual(Object.keys(body.data.filters).sort(), ["aiStatus", "minCount", "outcome"]);
    assert.deepEqual(
      Object.keys(body.data.items[0]).sort(),
      ["aiStatuses", "bySettledBy", "coverage", "dedicatedPageAvailable", "interactions", "lastSeen", "outcomes", "term", "termKey", "topResultPath", "trendAvailable"],
    );
    assert.equal(body.meta.kThreshold, 3);
  });

  // ── Complete privacy check, beyond the former 5,000-term scan ──────────────
  const letters = (n) => {
    let out = "";
    let v = n;
    for (let i = 0; i < 4; i += 1) {
      out = String.fromCharCode(97 + (v % 26)) + out;
      v = Math.floor(v / 26);
    }
    return out;
  };
  const insertChunks = async (docs) => {
    for (let i = 0; i < docs.length; i += 1000) await insert(docs.slice(i, i + 1000));
  };
  const LEGACY = { term: REFUSED, termKey: "reach me at jane doe example com" };

  test("more than 5,000 distinct terms: a refused legacy term outside the former scan limit is still excluded everywhere", async () => {
    const ok = Array.from({ length: 5300 }, (_, i) => raw({ term: `alpha ${letters(i)}` }));
    assert.equal(analyzeForAnalytics(`alpha ${letters(5299)}`).store, true, "precondition");
    // The legacy term has the same count (1) and sorts AFTER every "alpha …" key, so the old top-5,000 scan never reached it.
    await insertChunks([...ok, raw(LEGACY)]);

    const { data, meta } = await summary();
    assert.deepEqual(data.terms, { distinct: 5301, shown: 5300, suppressed: 1, interactionsInShownTerms: 5300, interactionsInSuppressedTerms: 1 });
    assert.equal(data.interactions, 5301);
    assert.equal(meta.termsCheckComplete, true);

    const topTerms = await terms();
    assert.equal(topTerms.body.meta.truncated, true, "Top terms still lists at most the 5,000 most-searched terms");
    assert.equal(topTerms.body.meta.termsCheckComplete, true);
    assert.ok(!JSON.stringify(topTerms.body).toLowerCase().includes("jane"));

    const dailyBody = (await daily()).body;
    assert.equal(dailyBody.data.pagination.total, 5300, "the refused term is not one of the listed rows");
    assert.deepEqual(dailyBody.data.other, [{ day: "2026-10-05", interactions: 1 }]);
    assert.ok(!JSON.stringify(dailyBody).toLowerCase().includes("jane"));
  });

  test("findRefusedTerms: returns only keys, sorted; reports incomplete on the group limit or on an error", async () => {
    await insert([raw(LEGACY), raw({ term: "call me on 555 123 4567", termKey: "call me on 555 123 4567" }), raw({ term: "knee pain" }), raw({ term: "knee pain", hour: 14 })]);
    const window = { start: new Date("2026-10-01T00:00:00.000Z"), end: new Date("2026-10-09T00:00:00.000Z") };
    assert.deepEqual(await adminQueries.findRefusedTerms({ window }), { keys: ["call me on 555 123 4567", "reach me at jane doe example com"], complete: true });
    assert.deepEqual(await adminQueries.findRefusedTerms({ window }, { maxGroups: 2 }), { keys: [], complete: false, reason: "limit" }, "3 distinct spellings > 2");
    const failing = { aggregate: () => ({ cursor: () => ({ async *[Symbol.asyncIterator]() { throw new Error("boom"); } }) }) };
    assert.deepEqual(await adminQueries.findRefusedTerms({ window }, { Interaction: failing }), { keys: [], complete: false, reason: "error", errorName: "Error" });
  });

  test("fallback: if the privacy check cannot complete, no term-level row is returned - even for a refused term with 3+ searches", async () => {
    await insert([...times(3, { term: "elbow pain" }), raw({ term: "knee pain" }), ...times(3, LEGACY)]);
    assert.equal(analyzeForAnalytics(REFUSED).store, false, "precondition");
    const fb = (path) => get(`/fb${path}?${QUERY}`);
    const everything = [];

    const topTerms = await fb("/terms");
    assert.deepEqual(topTerms.body.data.items, []);
    assert.equal(topTerms.body.data.pagination.total, 0);
    assert.equal(topTerms.body.meta.termsCheckComplete, false);

    const stats = (await fb("/summary")).body;
    assert.deepEqual(stats.data.terms, { distinct: 3, shown: 0, suppressed: 3, interactionsInShownTerms: 0, interactionsInSuppressedTerms: 7 });
    assert.equal(stats.data.interactions, 7, "totals still count every interaction");
    assert.deepEqual(stats.data.gaps, { pageMissing: 0, noCatalogMatch: 0, aliasOpportunity: 0, unconfirmedInteractions: 0 });
    assert.equal(stats.meta.termsCheckComplete, false);

    const dailyBody = (await fb("/daily-terms")).body;
    assert.deepEqual(dailyBody.data.items, []);
    assert.equal(dailyBody.data.pagination.total, 0);
    assert.deepEqual(dailyBody.data.other, [{ day: "2026-10-05", interactions: 7 }], "only a count per day");
    assert.equal(dailyBody.meta.termsCheckComplete, false);

    const gapsBody = (await fb("/gaps")).body;
    assert.deepEqual(gapsBody.data.items, []);
    assert.equal(gapsBody.meta.termsCheckComplete, false);

    everything.push(topTerms.body, stats, dailyBody, gapsBody);
    for (const body of everything) {
      const json = JSON.stringify(body).toLowerCase();
      for (const word of ["jane", "example.com", "reach me", "elbow", "knee"]) assert.ok(!json.includes(word), word);
    }
  });

  test("an incomplete check is logged with a fixed message (endpoint, reason) and never any search text", async () => {
    await insert([raw(LEGACY), raw({ term: "knee pain" })]);
    for (const path of ["/terms", "/summary", "/daily-terms", "/gaps"]) await get(`/fb${path}?${QUERY}`);
    assert.equal(fallbackLogs.length, 4);
    assert.deepEqual(
      fallbackLogs.map((m) => m.replace(/^.*\): /, "")).sort(),
      ["daily-terms", "gaps", "summary", "terms"],
    );
    for (const message of fallbackLogs) {
      assert.match(message, /^\[search-analytics\] term privacy check incomplete \(limit\): [a-z-]+$/);
      assert.ok(!/jane|knee|example/i.test(message));
    }
    assert.deepEqual(logs, [], "a complete check logs nothing");
  });

  // ── Gaps ────────────────────────────────────────────────────────────────────
  test("Gaps: a refused legacy term is excluded even with 5+ confirmed searches; Summary's gaps count agrees", async () => {
    await insert([
      ...times(5, { term: "unmatched topic", settledBy: "submit", outcome: "no_results" }),
      ...times(5, { ...LEGACY, settledBy: "submit", outcome: "no_results" }), // same shape, but its text is refused today
    ]);
    const gaps = (await get(`/gaps?${QUERY}`)).body;
    assert.deepEqual(gaps.data.items.map((i) => i.termKey), [keyOf("unmatched topic")]);
    assert.equal(gaps.meta.termsCheckComplete, true);
    assert.deepEqual(Object.keys(gaps.data).sort(), ["filters", "items", "pagination"]);
    assert.ok(!JSON.stringify(gaps).toLowerCase().includes("jane"));
    const g = (await summary()).data.gaps;
    assert.equal(g.pageMissing + g.noCatalogMatch + g.aliasOpportunity, gaps.data.items.length, "Summary and Gaps count the same terms");
  });

  test("Gaps keeps its thresholds when the check completes: 4 searches in a day is not a gap, 5 is", async () => {
    await insert([
      ...times(4, { term: "four topic", settledBy: "submit", outcome: "no_results" }),
      ...times(5, { term: "five topic", settledBy: "submit", outcome: "no_results" }),
    ]);
    const gaps = (await get(`/gaps?${QUERY}`)).body;
    assert.deepEqual(gaps.data.items.map((i) => i.termKey), [keyOf("five topic")]);
  });

  // ── First occurrence is stored and listed ──────────────────────────────────
  test("the first search event is stored and listed; a repeat of the same event is not double counted; a new event adds one", async () => {
    const recorder = createSearchInteractionRecorder({ logger: () => {} });
    const empty = { categoryById: {}, specialtyById: {} };
    const first = uuid();
    const event = (id, q) => ({ interactionId: id, q, settledBy: "idle", aiStatus: "not_requested", matches: {}, index: empty });
    assert.equal((await recorder(event(first, "sore elbow"))).status, "recorded");
    assert.equal(await SearchInteraction.countDocuments({}), 1, "stored on the very first occurrence");
    assert.equal((await recorder(event(first, "sore elbow"))).status, "updated", "same episode: updated, not a second row");
    assert.equal(await SearchInteraction.countDocuments({}), 1);
    await SearchInteraction.collection.updateMany({}, { $set: { createdAt: new Date("2026-10-05T10:00:00.000Z") } });
    assert.equal(itemOf((await terms()).body, keyOf("sore elbow")).interactions, 1);
    assert.equal((await recorder(event(uuid(), "Sore Elbows"))).status, "recorded");
    await SearchInteraction.collection.updateMany({}, { $set: { createdAt: new Date("2026-10-05T10:00:00.000Z") } });
    assert.equal(itemOf((await terms()).body, keyOf("sore elbow")).interactions, 2);
  });

  // ── Daily terms pagination after privacy filtering ─────────────────────────
  test("Daily terms pagination is computed after privacy filtering: pages, total and hasMore ignore refused terms", async () => {
    await insert([
      raw({ term: "aa topic", day: "2026-10-05" }),
      raw({ term: "bb topic", day: "2026-10-05" }),
      raw({ term: "cc topic", day: "2026-10-05" }),
      raw({ ...LEGACY, day: "2026-10-05" }),
      raw({ term: "call me on 555 123 4567", termKey: "call me on 555 123 4567", day: "2026-10-05" }),
      raw({ term: "dd topic", day: "2026-10-06" }),
      raw({ term: "ee topic", day: "2026-10-06" }),
    ]);
    // Order: newest day first, then count, then key.
    const pages = [];
    for (const offset of [0, 2, 4]) pages.push((await daily(`&limit=2&offset=${offset}`)).body);
    assert.deepEqual(pages.map((p) => p.data.items.map((i) => i.term)), [["dd topic", "ee topic"], ["aa topic", "bb topic"], ["cc topic"]]);
    assert.deepEqual(pages.map((p) => p.data.pagination.total), [5, 5, 5]);
    assert.deepEqual(pages.map((p) => p.data.pagination.hasMore), [true, true, false]);
    for (const page of pages) {
      assert.deepEqual(page.data.other, [{ day: "2026-10-05", interactions: 2 }], "the 2 refused terms are only counted, per day");
      const json = JSON.stringify(page).toLowerCase();
      for (const word of ["jane", "555", "reach me", "call me"]) assert.ok(!json.includes(word), word);
    }
    // listed + other = everything recorded
    const listed = pages.reduce((sum, p) => sum + p.data.items.reduce((s, i) => s + i.interactions, 0), 0);
    assert.equal(listed + pages[0].data.other.reduce((s, o) => s + o.interactions, 0), 7);
  });

  test("Top terms pagination also ignores refused terms", async () => {
    await insert([raw({ term: "aa topic" }), raw({ term: "bb topic" }), raw({ term: "cc topic" }), raw(LEGACY)]);
    const first = (await terms("&limit=2&offset=0")).body;
    const second = (await terms("&limit=2&offset=2")).body;
    assert.equal(first.data.pagination.total, 3);
    assert.equal(first.data.pagination.hasMore, true);
    assert.equal(second.data.items.length, 1);
    assert.equal(second.data.pagination.hasMore, false);
  });
});
