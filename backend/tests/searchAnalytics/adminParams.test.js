const test = require("node:test");
const assert = require("node:assert/strict");
const {
  AdminParamError, parseSummaryQuery, parseTermsQuery, parseGapsQuery, parseTrendQuery,
  RAW_WINDOW_MAX_DAYS, TREND_WINDOW_MAX_DAYS, DEFAULT_LIMIT, MAX_LIMIT, MAX_OFFSET,
} = require("../../services/searchAnalytics/adminParams");

const NOW = new Date("2026-10-09T09:00:00.000Z"); // "today" is 2026-10-09 (UTC)
const opts = { now: NOW };
const day = (offset) => new Date(Date.UTC(2026, 9, 9 + offset)).toISOString().slice(0, 10); // offset days from today
const field = (fn) => {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof AdminParamError, `expected AdminParamError, got ${err && err.name}`);
    return err.field;
  }
  return "no error";
};

test("defaults: the last 30 days ending today (UTC), inclusive", () => {
  const { window } = parseSummaryQuery({}, opts);
  assert.equal(window.fromKey, "2026-09-10");
  assert.equal(window.toKey, "2026-10-09");
  assert.equal(window.days, 30);
  assert.equal(window.start.toISOString(), "2026-09-10T00:00:00.000Z");
  assert.equal(window.end.toISOString(), "2026-10-10T00:00:00.000Z"); // exclusive end: the whole of `to`
});

test("a single-day window is allowed; to defaults to today, from to 29 days before to", () => {
  assert.equal(parseSummaryQuery({ from: "2026-10-01", to: "2026-10-01" }, opts).window.days, 1);
  assert.equal(parseSummaryQuery({ from: "2026-10-01" }, opts).window.toKey, "2026-10-09");
  const onlyTo = parseSummaryQuery({ to: "2026-10-05" }, opts).window;
  assert.deepEqual([onlyTo.fromKey, onlyTo.toKey, onlyTo.days], ["2026-09-06", "2026-10-05", 30]);
});

test("raw-backed windows: exactly 90 days is the limit and nothing older than 89 days ago", () => {
  assert.equal(RAW_WINDOW_MAX_DAYS, 90);
  const ok = parseTermsQuery({ from: day(-89), to: day(0) }, opts).window;
  assert.equal(ok.days, 90);
  assert.equal(field(() => parseTermsQuery({ from: day(-90), to: day(0) }, opts)), "from"); // 91 days
  assert.equal(field(() => parseTermsQuery({ from: day(-90), to: day(-1) }, opts)), "from"); // 90 days but older than retention
  assert.equal(field(() => parseGapsQuery({ from: day(-100), to: day(-95) }, opts)), "from");
  assert.equal(parseGapsQuery({ from: day(-89), to: day(-89) }, opts).window.days, 1); // the oldest allowed day
  assert.equal(field(() => parseGapsQuery({ from: day(-90), to: day(-90) }, opts)), "from");
});

test("trend windows: up to 396 days", () => {
  assert.equal(TREND_WINDOW_MAX_DAYS, 396);
  assert.equal(parseTrendQuery({ from: day(-395), to: day(0) }, opts).window.days, 396);
  assert.equal(field(() => parseTrendQuery({ from: day(-396), to: day(0) }, opts)), "from");
  assert.equal(field(() => parseTrendQuery({ from: day(-396), to: day(-1) }, opts)), "from");
  // 100 days is fine for trend but not for the raw-backed endpoints.
  assert.equal(parseTrendQuery({ from: day(-99), to: day(0) }, opts).window.days, 100);
  assert.equal(field(() => parseSummaryQuery({ from: day(-99), to: day(0) }, opts)), "from");
});

test("to cannot be in the future; from cannot be after to", () => {
  assert.equal(field(() => parseSummaryQuery({ to: day(1) }, opts)), "to");
  assert.equal(parseSummaryQuery({ to: day(0) }, opts).window.toKey, "2026-10-09");
  assert.equal(field(() => parseSummaryQuery({ from: day(-1), to: day(-2) }, opts)), "from");
});

test("dates must be real calendar dates in YYYY-MM-DD", () => {
  for (const bad of ["2026-02-30", "2026-13-01", "2026-00-10", "2026-10-32", "26-10-01", "2026/10/01", "2026-1-1", "20261001",
    "2026-10-01T00:00:00Z", " 2026-10-01", "2026-10-01 ", "today", "-1", "NaN", "2026-10-0١", "٢٠٢٦-١٠-٠١", "<script>"]) {
    assert.equal(field(() => parseSummaryQuery({ from: bad }, opts)), "from", bad);
    assert.equal(field(() => parseSummaryQuery({ to: bad }, opts)), "to", bad);
  }
  assert.equal(parseSummaryQuery({ from: "2026-09-30", to: "2026-10-01" }, opts).window.days, 2); // month boundary
});

test("unknown, repeated, nested and empty parameters are rejected without naming them", () => {
  const e = (query, parse = parseTermsQuery) => field(() => parse(query, opts));
  assert.equal(e({ debug: "1" }), "query");
  assert.equal(e({ "from[x]": "1" }), "query");
  assert.equal(e({ __proto__x: "1" }), "query");
  assert.equal(e({ from: ["2026-10-01", "2026-10-02"] }), "from");
  assert.equal(e({ outcome: ["no_results", "fallback_only"] }), "outcome");
  assert.equal(e({ from: { $gt: "" } }), "from");
  assert.equal(e({ limit: "" }), "limit");
  assert.equal(e(null), "query");
  assert.equal(e([]), "query");
  assert.equal(e("x"), "query");
  // Each endpoint accepts only its own parameters.
  assert.equal(e({ sort: "count" }, parseSummaryQuery), "query");
  assert.equal(e({ sort: "count" }, parseGapsQuery), "query");
  assert.equal(e({ outcome: "no_results" }, parseGapsQuery), "query");
  assert.equal(e({ limit: "5" }, parseTrendQuery), "query");
  assert.equal(e({ termKey: "acne" }, parseTermsQuery), "query");
  assert.equal(e({ minCount: "5" }, parseSummaryQuery), "query");
});

test("an AdminParamError carries only a fixed message and an allowed field name", () => {
  for (const attack of [() => parseTermsQuery({ "x-<script>alert(1)</script>": "1" }, opts), () => parseTermsQuery({ from: "<script>alert(1)</script>" }, opts)]) {
    try {
      attack();
      assert.fail("should throw");
    } catch (err) {
      assert.equal(err.message, "Invalid request parameter.");
      assert.ok(!JSON.stringify({ message: err.message, field: err.field, name: err.name }).includes("script"));
      assert.ok(["query", "from"].includes(err.field));
    }
  }
});

test("pagination: limit 1-100 (default 25), offset 0-1000 (default 0), digits only", () => {
  const defaults = parseTermsQuery({}, opts);
  assert.deepEqual([defaults.limit, defaults.offset], [DEFAULT_LIMIT, 0]);
  assert.equal(DEFAULT_LIMIT, 25);
  assert.equal(MAX_LIMIT, 100);
  assert.equal(MAX_OFFSET, 1000);
  assert.equal(parseTermsQuery({ limit: "1" }, opts).limit, 1);
  assert.equal(parseTermsQuery({ limit: "100" }, opts).limit, 100);
  assert.equal(parseTermsQuery({ offset: "1000" }, opts).offset, 1000);
  for (const bad of ["0", "101", "-1", "1.5", "1e2", "abc", "０１", "00000001000000", "9999999", " 5", "5 ", "+5", "0x10"]) {
    assert.equal(field(() => parseTermsQuery({ limit: bad }, opts)), "limit", `limit=${bad}`);
  }
  for (const bad of ["1001", "-1", "1.5", "abc", "99999"]) {
    assert.equal(field(() => parseGapsQuery({ offset: bad }, opts)), "offset", `offset=${bad}`);
  }
});

test("minCount can raise the floor of 3 but never lower it", () => {
  assert.equal(parseTermsQuery({}, opts).minCount, 3);
  assert.equal(parseGapsQuery({}, opts).minCount, 5);
  assert.equal(parseTermsQuery({ minCount: "3" }, opts).minCount, 3);
  assert.equal(parseGapsQuery({ minCount: "50" }, opts).minCount, 50);
  for (const bad of ["0", "1", "2", "-3", "3.5", "1001", "abc", "three"]) {
    assert.equal(field(() => parseTermsQuery({ minCount: bad }, opts)), "minCount", bad);
    assert.equal(field(() => parseGapsQuery({ minCount: bad }, opts)), "minCount", bad);
  }
});

test("outcome, aiStatus and sort are strict allowlists", () => {
  const q = parseTermsQuery({ outcome: "no_results", aiStatus: "unavailable", sort: "recent" }, opts);
  assert.deepEqual([q.outcome, q.aiStatus, q.sort], ["no_results", "unavailable", "recent"]);
  const defaults = parseTermsQuery({}, opts);
  assert.deepEqual([defaults.outcome, defaults.aiStatus, defaults.sort], [null, null, "count"]);
  for (const bad of ["NO_RESULTS", "no results", "gap", "dedicatedPageFound", "constructor", "__proto__", "toString"]) {
    assert.equal(field(() => parseTermsQuery({ outcome: bad }, opts)), "outcome", bad);
  }
  for (const bad of ["maybe", "Used", "not-requested"]) assert.equal(field(() => parseTermsQuery({ aiStatus: bad }, opts)), "aiStatus", bad);
  for (const bad of ["term", "interactions", "createdAt", "-count", "count,recent", "lastSeen", "$natural", "constructor"]) {
    assert.equal(field(() => parseTermsQuery({ sort: bad }, opts)), "sort", bad);
  }
});

test("trend termKey: normalised form only, exact match, bounded", () => {
  assert.equal(parseTrendQuery({ termKey: "knee pain" }, opts).termKey, "knee pain");
  assert.equal(parseTrendQuery({}, opts).termKey, null);
  for (const bad of ["Knee Pain", "knee  pain", " knee", "knee ", "knee-pain", "knee.*", "^a", "a|b", "$ne", "{\"$gt\":\"\"}", "x".repeat(101), "knee\npain", "knée"]) {
    assert.equal(field(() => parseTrendQuery({ termKey: bad }, opts)), "termKey", JSON.stringify(bad));
  }
  assert.equal(parseTrendQuery({ termKey: "x".repeat(100) }, opts).termKey.length, 100);
});
