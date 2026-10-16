const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyCoverage, applyEquivalence, GAP_RATE, GAP_MIN_CONFIRMED } = require("../../services/searchAnalytics/coverage");

// Counts for one term. Defaults describe "nothing happened"; override what matters.
const counts = (o = {}) => ({
  n: 0, found: 0, fallback: 0, none: 0, unavailable: 0,
  unavailableFound: 0, unavailableFallback: 0, unavailableNone: 0, instantNotFound: 0, submitFoundViaAi: 0, ...o,
});

test("thresholds are the approved ones", () => {
  assert.equal(GAP_RATE, 0.2);
  assert.equal(GAP_MIN_CONFIRMED, 5);
});

test("a well-covered term is covered", () => {
  const r = classifyCoverage(counts({ n: 10, found: 9, fallback: 1 }));
  assert.equal(r.coverage, "covered");
  assert.equal(r.confirmedDedicatedRate, 0.9);
});

test("mostly no_results is no_catalog_match; mostly fallback_only is page_missing", () => {
  assert.equal(classifyCoverage(counts({ n: 10, none: 8, fallback: 2 })).coverage, "no_catalog_match");
  assert.equal(classifyCoverage(counts({ n: 10, fallback: 8, none: 2 })).coverage, "page_missing");
  assert.equal(classifyCoverage(counts({ n: 10, fallback: 5, none: 5 })).coverage, "page_missing"); // tie: the weaker claim
  assert.equal(classifyCoverage(counts({ n: 10, none: 10 })).confirmedDedicatedRate, 0);
});

test("the rate threshold is strict: exactly 20% is covered", () => {
  assert.equal(classifyCoverage(counts({ n: 10, found: 2, fallback: 8 })).coverage, "covered");
  assert.equal(classifyCoverage(counts({ n: 10, found: 1, fallback: 9 })).coverage, "page_missing");
  assert.equal(classifyCoverage(counts({ n: 100, found: 19, fallback: 81 })).coverage, "page_missing");
  assert.equal(classifyCoverage(counts({ n: 100, found: 20, fallback: 80 })).coverage, "covered");
});

test("fewer than 5 confirmed interactions is insufficient_data, never a gap", () => {
  assert.equal(classifyCoverage(counts({ n: 4, none: 4 })).coverage, "insufficient_data");
  assert.equal(classifyCoverage(counts({ n: 5, none: 5 })).coverage, "no_catalog_match");
  assert.equal(classifyCoverage(counts({ n: 4, none: 4 }), { minConfirmed: 3 }).coverage, "no_catalog_match");
  assert.equal(classifyCoverage(counts({ n: 9, none: 9 }), { minConfirmed: 10 }).coverage, "insufficient_data");
});

test("AI-unavailable searches are never confirmed content gaps", () => {
  // Every search happened while the AI layer was down: unconfirmed, not a gap.
  const allDown = classifyCoverage(counts({ n: 20, none: 20, unavailable: 20, unavailableNone: 20 }));
  assert.equal(allDown.coverage, "insufficient_data");
  assert.equal(allDown.confirmedInteractions, 0);
  assert.equal(allDown.unconfirmedInteractions, 20);
  assert.equal(allDown.confirmedDedicatedRate, null);
  // They are excluded from the evidence, not counted against the term.
  const mixed = classifyCoverage(counts({ n: 15, none: 15, unavailable: 10, unavailableNone: 10 }));
  assert.equal(mixed.confirmedInteractions, 5);
  assert.equal(mixed.unconfirmedInteractions, 10);
  assert.equal(mixed.coverage, "no_catalog_match");
  // Found-while-down searches do not make the confirmed rate look worse or better.
  const foundDown = classifyCoverage(counts({ n: 12, found: 6, none: 6, unavailable: 6, unavailableFound: 6 }));
  assert.equal(foundDown.confirmedOutcomes.dedicatedPageFound, 0);
  assert.equal(foundDown.confirmedInteractions, 6);
  assert.equal(foundDown.coverage, "no_catalog_match");
  // A term that looks like a gap only because of AI downtime is not flagged.
  assert.equal(classifyCoverage(counts({ n: 30, none: 28, found: 2, unavailable: 26, unavailableNone: 26 })).coverage, "insufficient_data");
});

test("an AI-assisted success next to plain misses is an alias opportunity, not a page gap", () => {
  const r = classifyCoverage(counts({ n: 10, found: 3, fallback: 7, submitFoundViaAi: 3, instantNotFound: 7 }));
  assert.equal(r.coverage, "alias_opportunity");
  // Without the AI-assisted success it would be a plain page gap.
  assert.equal(classifyCoverage(counts({ n: 10, found: 0, fallback: 10, instantNotFound: 10 })).coverage, "page_missing");
  // And with no plain misses there is nothing to alias.
  assert.equal(classifyCoverage(counts({ n: 10, found: 10, submitFoundViaAi: 4 })).coverage, "covered");
  // Not enough data: not flagged at all.
  assert.equal(classifyCoverage(counts({ n: 4, found: 1, fallback: 3, submitFoundViaAi: 1, instantNotFound: 3 })).coverage, "insufficient_data");
});

test("equivalent pages: a gap-looking term that resolves to a page a covered term uses is not a gap", () => {
  const rows = [
    { termKey: "acne", coverage: "covered", topResultPath: { path: "/skin/acne", dedicated: true } },
    { termKey: "pimple help", coverage: "page_missing", topResultPath: { path: "/skin/acne", dedicated: true } },
    { termKey: "zits", coverage: "no_catalog_match", topResultPath: { path: "/skin/acne", dedicated: true } },
    { termKey: "oncology", coverage: "page_missing", topResultPath: { path: "/chronic-care", dedicated: false } },
    { termKey: "rare", coverage: "page_missing", topResultPath: null },
    { termKey: "other topic", coverage: "page_missing", topResultPath: { path: "/skin/eczema", dedicated: true } },
    { termKey: "heartburn", coverage: "alias_opportunity", topResultPath: { path: "/skin/acne", dedicated: true } },
  ];
  applyEquivalence(rows);
  const byKey = Object.fromEntries(rows.map((row) => [row.termKey, row.coverage]));
  assert.deepEqual(byKey, {
    acne: "covered",
    "pimple help": "covered_by_equivalent",
    zits: "covered_by_equivalent",
    oncology: "page_missing", // a parent fallback page is not an equivalent
    rare: "page_missing",
    "other topic": "page_missing", // no covered term uses eczema
    heartburn: "alias_opportunity", // alias opportunities stay visible
  });
});

test("a path used only by non-covered terms does not excuse anything", () => {
  const rows = [
    { termKey: "a", coverage: "page_missing", topResultPath: { path: "/x", dedicated: true } },
    { termKey: "b", coverage: "page_missing", topResultPath: { path: "/x", dedicated: true } },
    { termKey: "c", coverage: "insufficient_data", topResultPath: { path: "/x", dedicated: true } },
  ];
  applyEquivalence(rows);
  assert.deepEqual(rows.map((r) => r.coverage), ["page_missing", "page_missing", "insufficient_data"]);
});
