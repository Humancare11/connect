// Top terms dashboard state and help text after "catalog terms from the first search".
// Newly written for the current code (not a recovered test). Pure module: no React,
// no network. Run from frontend/:
//   node --test tests/searchAnalyticsTopTermsHelp.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  AI_UNAVAILABLE_HELP,
  DAILY_TERMS_PRIVACY_HELP,
  EMPTY_RESULT,
  TOP_TERMS_PRIVACY_HELP,
  TREND_UNAVAILABLE_HELP,
  buildTermsParams,
  deriveAnalyticsState,
  failed,
  succeeded,
  trendActionFor,
} from "../src/pages/admin/analyticsState.js";

const range = { from: "2026-10-01", to: "2026-10-08" };

test("the Top terms help says a term can appear after a single search, after the privacy filters", () => {
  assert.match(TOP_TERMS_PRIVACY_HELP, /after a single search/);
  assert.match(TOP_TERMS_PRIVACY_HELP, /passed the privacy filters/);
  assert.match(TOP_TERMS_PRIVACY_HELP, /never recorded/);
  assert.match(TOP_TERMS_PRIVACY_HELP, /checked again before it is shown/);
  assert.match(TOP_TERMS_PRIVACY_HELP, /Trend needs at least 3 searches on a single UTC day/);
});

test("the help texts no longer state the old rule and do not imply every raw query is shown", () => {
  for (const text of [TOP_TERMS_PRIVACY_HELP, DAILY_TERMS_PRIVACY_HELP]) {
    assert.doesNotMatch(text, /only after at least 3 searches/);
    assert.doesNotMatch(text, /catalog name or alias/);
    assert.doesNotMatch(text, /every (raw )?(query|search) is (stored|shown|displayed)/i);
    assert.match(text, /privacy filters/);
  }
});

test("the Daily terms help explains first-search listing and the 'Other' count; the AI help is untouched", () => {
  assert.match(DAILY_TERMS_PRIVACY_HELP, /first search on a day/);
  assert.match(DAILY_TERMS_PRIVACY_HELP, /never recorded/);
  assert.match(DAILY_TERMS_PRIVACY_HELP, /\"Other\"/);
  assert.match(AI_UNAVAILABLE_HELP, /AI failures and skipped AI requests/);
});

test("the Terms request never sends minCount, so the server's default (every term from its first search) applies", () => {
  const params = buildTermsParams({ range, sort: "count", limit: 25, offset: 0 });
  assert.equal("minCount" in params, false);
  assert.deepEqual(params, { ...range, sort: "count", limit: 25, offset: 0 });
  const filtered = buildTermsParams({ range, sort: "recent", limit: 25, offset: 25, outcome: "no_results", aiStatus: "used" });
  assert.equal("minCount" in filtered, false);
  assert.equal(filtered.outcome, "no_results");
  assert.equal(filtered.aiStatus, "used");
});

test("a response with a one-search catalog term is shown as received (state only passes the body through)", () => {
  const body = { data: { items: [{ term: "migraine", termKey: "migraine", interactions: 1 }] } };
  const state = deriveAnalyticsState(succeeded("terms-1", body, 0), { id: "terms-1", refreshKey: 0, enabled: true });
  assert.equal(state.loading, false);
  assert.equal(state.error, "");
  assert.equal(state.body.data.items[0].interactions, 1);
});

test("loading, refreshing and error states are unchanged", () => {
  assert.equal(deriveAnalyticsState(EMPTY_RESULT, { id: "a", refreshKey: 0, enabled: true }).loading, true);
  const ok = succeeded("a", { data: { items: [] } }, 0);
  assert.equal(deriveAnalyticsState(ok, { id: "a", refreshKey: 1, enabled: true }).refreshing, true);
  const bad = failed(ok, "a", "Search analytics is temporarily unavailable.", 1);
  const state = deriveAnalyticsState(bad, { id: "a", refreshKey: 1, enabled: true });
  assert.equal(state.error, "Search analytics is temporarily unavailable.");
  assert.deepEqual(state.body, { data: { items: [] } });
});

test("the page shows the help text and an empty-state message that matches the rules", () => {
  const source = readFileSync(new URL("../src/pages/admin/SearchAnalytics.jsx", import.meta.url), "utf8");
  assert.match(source, /\{TOP_TERMS_PRIVACY_HELP\}/);
  assert.match(source, /No search terms for this period yet\. A term can appear after a single search\./);
  assert.doesNotMatch(source, /No terms meet the minimum count/);
});

test("the page header says a term can appear after a single search and that rejected searches are never recorded or shown", () => {
  const source = readFileSync(new URL("../src/pages/admin/SearchAnalytics.jsx", import.meta.url), "utf8");
  assert.match(source, /A search term can appear after a single search; searches the privacy filters reject are never recorded or shown\./);
  assert.doesNotMatch(source, /kThreshold/, "the header no longer quotes the old threshold");
  assert.doesNotMatch(source, /fewer than .* searches in a UTC day are never listed/);
});

test("the Long-tail demand panel and the catalog-unavailable hint are gone", () => {
  const source = readFileSync(new URL("../src/pages/admin/SearchAnalytics.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /TailDemand|tail-demand|Long-tail/i);
  assert.doesNotMatch(source, /catalogDown|catalogTermsAvailable/);
});

test("Trend action: a row with no trend data gets an explanation instead of a Trend button", () => {
  const none = trendActionFor({ termKey: "migraine", interactions: 1, trendAvailable: false });
  assert.equal(none.available, false);
  assert.equal(none.label, "Not enough data");
  assert.equal(none.title, TREND_UNAVAILABLE_HELP);
  assert.match(TREND_UNAVAILABLE_HELP, /3 times on any single UTC day/);
});

test("Trend action: rows with trend data, or from an older API without the flag, keep the Trend button", () => {
  for (const row of [{ trendAvailable: true }, {}, { termKey: "acne" }, null, undefined]) {
    assert.deepEqual(trendActionFor(row), { available: true, label: "Trend", title: "" });
  }
});

test("the page renders the Trend button only when trendActionFor allows it (no fabricated trend)", () => {
  const source = readFileSync(new URL("../src/pages/admin/SearchAnalytics.jsx", import.meta.url), "utf8");
  assert.ok(source.includes("trendActionFor(row)"), "the Terms table asks trendActionFor for every row");
  const available = source.indexOf("trend.available");
  const button = source.indexOf("onSelectTerm(row.termKey, row.term)", available);
  const muted = source.indexOf('className="sa-trend-none"', available);
  assert.ok(available > 0 && button > available && muted > button, "the button is the available branch, the muted label the other");
});
