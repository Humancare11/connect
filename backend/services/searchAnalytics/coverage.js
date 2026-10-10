// Content-gap classification for one term over a window, computed at read time
// from per-term counts (the approved contract: gap status is never stored, so
// adding a page clears a gap by itself for new traffic).
//
// Pure: no I/O.
//
//   confirmed interactions   all interactions EXCEPT those whose AI step was
//                            unavailable ("unavailable"): with the AI layer
//                            down, the page may well exist, so those searches
//                            are never evidence of a gap. They are reported
//                            separately as "unconfirmed".
//   confirmed dedicated rate confirmed interactions that found a dedicated
//                            page / confirmed interactions.
//
// Coverage values:
//   insufficient_data    fewer than `minConfirmed` confirmed interactions
//   alias_opportunity    the page exists (an AI-assisted submission reached a
//                        dedicated page) but plain instant searches for this
//                        wording still miss it: add an ALIAS, not a page
//   page_missing         rate < GAP_RATE and mostly "fallback_only" (a catalog
//                        record exists, its own page does not)
//   no_catalog_match     rate < GAP_RATE and mostly "no_results"
//   covered_by_equivalent a gap-looking term whose top result is a dedicated
//                        page that another COVERED term already resolves to:
//                        the same topic, not a gap (see applyEquivalence)
//   covered              everything else

const GAP_RATE = 0.2;
const GAP_MIN_CONFIRMED = 5;
const COVERAGE_VALUES = Object.freeze([
  "insufficient_data", "alias_opportunity", "page_missing", "no_catalog_match", "covered_by_equivalent", "covered",
]);
const GAP_VALUES = Object.freeze(["page_missing", "no_catalog_match", "alias_opportunity"]);

// c: { n, found, fallback, none, unavailable, unavailableFound, unavailableFallback,
//      unavailableNone, instantNotFound, submitFoundViaAi }  (all non-negative integers)
function classifyCoverage(c, { minConfirmed = GAP_MIN_CONFIRMED } = {}) {
  const confirmed = c.n - c.unavailable;
  const confirmedFound = c.found - c.unavailableFound;
  const confirmedFallback = c.fallback - c.unavailableFallback;
  const confirmedNone = c.none - c.unavailableNone;
  const rate = confirmed > 0 ? confirmedFound / confirmed : null;

  let coverage = "covered";
  if (confirmed < minConfirmed) coverage = "insufficient_data";
  else if (c.submitFoundViaAi >= 1 && c.instantNotFound >= 1) coverage = "alias_opportunity";
  else if (rate < GAP_RATE) coverage = confirmedNone > confirmedFallback ? "no_catalog_match" : "page_missing";

  return {
    coverage,
    confirmedInteractions: confirmed,
    unconfirmedInteractions: c.unavailable,
    confirmedOutcomes: { dedicatedPageFound: confirmedFound, fallbackOnly: confirmedFallback, noResults: confirmedNone },
    confirmedDedicatedRate: rate === null ? null : Math.round(rate * 1000) / 1000,
  };
}

// Terms that look like gaps but whose best result is a dedicated page that a
// covered term already uses are the same topic under different wording.
// rows: [{ coverage, topResultPath: { path, dedicated } | null }] (mutated in place)
function applyEquivalence(rows) {
  const coveredPaths = new Set(
    rows.filter((row) => row.coverage === "covered" && row.topResultPath && row.topResultPath.dedicated).map((row) => row.topResultPath.path),
  );
  for (const row of rows) {
    if ((row.coverage === "page_missing" || row.coverage === "no_catalog_match")
      && row.topResultPath && row.topResultPath.dedicated && coveredPaths.has(row.topResultPath.path)) {
      row.coverage = "covered_by_equivalent";
    }
  }
  return rows;
}

module.exports = { classifyCoverage, applyEquivalence, GAP_RATE, GAP_MIN_CONFIRMED, COVERAGE_VALUES, GAP_VALUES };
