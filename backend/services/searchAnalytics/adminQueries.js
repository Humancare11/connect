// Read-only queries behind the superadmin Search Analytics APIs.
//
// Reads SearchInteraction (summary / terms / gaps: windows of up to 90 days)
// and SearchTermDailyStat (trend: up to 396 days). It never writes either
// collection and never returns a raw document: every result is an aggregate
// built field by field.
//
// Privacy rules enforced HERE, in the data layer, so no endpoint can bypass them:
//  - ONE suppression unit everywhere: the term-day cell. A (term, UTC day) cell
//    exists only if the term had at least MIN_TERM_INTERACTIONS (3) interactions
//    that day, counted BEFORE any outcome / aiStatus filter. Cells below 3 are
//    dropped inside MongoDB: their term text is never read, and their counts and
//    timestamps feed no term-level number in ANY response. /terms, /gaps and
//    /summary add up visible cells; /trend reads the rollup, which keeps exactly
//    the same cells. So every window is a sum of visible cells, and subtracting
//    windows, filters or endpoints can only yield sums of visible cells - never a
//    hidden cell on its own.
//  - A term is listed only if its visible cells add up to at least 3 (after any
//    filter). Callers may raise that minimum (minCount) but never lower it.
//  - NOT hidden, by design: day-level totals (the rollup's "other" pool) and the
//    composition (outcome / AI status / settle mode) inside a visible cell.
//  - /trend is budgeted (see trendBudget.js): bounded time, bounded operations,
//    bounded live days, bounded concurrency.
//
// Errors are not caught here; the controller turns them into a fixed 500.

const SearchInteraction = require("../../models/SearchInteraction");
const SearchTermDailyStat = require("../../models/SearchTermDailyStat");
const { MIN_TERM_INTERACTIONS, RAW_RETENTION_DAYS } = require("./constants");
const { classifyCoverage, applyEquivalence, GAP_MIN_CONFIRMED, GAP_VALUES } = require("./coverage");
const { readDay, buildRows } = require("./rollup");
const { addDays, dayKey, startOfUtcDay } = require("./adminParams");
const { TREND_LIMITS, TrendBudgetError, createBudget, createGate } = require("./trendBudget");

// Upper bound on distinct terms examined per request (largest first).
const MAX_TERMS_SCANNED = 5000;
const AGGREGATE_OPTIONS = Object.freeze({ allowDiskUse: true, maxTimeMS: 15 * 1000 });

// ── $group helpers ──────────────────────────────────────────────────────────
const is = (field, value) => ({ $eq: [`$${field}`, value] });
const all = (...conditions) => ({ $and: conditions });
const FOUND = is("outcome", "dedicated_page_found");
const DAY_OF = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } };

// What each counter tallies. A filter ("scope": outcome / aiStatus) narrows every
// counter; whether a cell is visible never depends on it.
const COUNT_CONDITIONS = {
  idle: is("settledBy", "idle"),
  select: is("settledBy", "select"),
  submit: is("settledBy", "submit"),
  found: FOUND,
  fallback: is("outcome", "fallback_only"),
  none: is("outcome", "no_results"),
  notRequested: is("aiStatus", "not_requested"),
  notNeeded: is("aiStatus", "not_needed"),
  used: is("aiStatus", "used"),
  noMatch: is("aiStatus", "no_match"),
  unavailable: is("aiStatus", "unavailable"),
  available: { $eq: ["$dedicatedPageAvailable", true] },
  unavailableFound: all(is("aiStatus", "unavailable"), FOUND),
  unavailableFallback: all(is("aiStatus", "unavailable"), is("outcome", "fallback_only")),
  unavailableNone: all(is("aiStatus", "unavailable"), is("outcome", "no_results")),
  // Plain searches (idle / select, no AI involved) that did not reach a dedicated page ...
  instantNotFound: all({ $in: ["$settledBy", ["idle", "select"]] }, { $ne: ["$outcome", "dedicated_page_found"] }),
  // ... while an AI-assisted submission did.
  submitFoundViaAi: all(is("settledBy", "submit"), is("aiStatus", "used"), FOUND),
};
const NUMERIC_KEYS = ["n", ...Object.keys(COUNT_CONDITIONS)];

const scopeCondition = ({ outcome, aiStatus }) => {
  const parts = [...(outcome ? [is("outcome", outcome)] : []), ...(aiStatus ? [is("aiStatus", aiStatus)] : [])];
  return parts.length ? all(...parts) : null;
};
// Counts the documents matching `condition` (any, if null) inside the scope (everything, if null).
const tally = (scope, condition) => {
  const parts = [scope, condition].filter(Boolean);
  return { $sum: { $cond: [parts.length === 0 ? true : parts.length === 1 ? parts[0] : all(...parts), 1, 0] } };
};

const cellCounters = (scope) => Object.fromEntries(NUMERIC_KEYS.map((key) => [key, tally(scope, COUNT_CONDITIONS[key] || null)]));
const sumCounters = () => Object.fromEntries(NUMERIC_KEYS.map((key) => [key, { $sum: `$${key}` }]));
const numbersOf = (group) => Object.fromEntries(NUMERIC_KEYS.map((key) => [key, Number(group[key]) || 0]));

// Most frequent entry; ties go to the smallest key, so results are deterministic.
function mostCommon(map) {
  let best = null;
  for (const [key, entry] of [...map.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (!best || entry.n > best.n) best = { key, ...entry };
  }
  return best;
}

// ── Terms (raw-backed) ──────────────────────────────────────────────────────
// Every term whose visible term-day cells add up to at least MIN_TERM_INTERACTIONS
// matching interactions in the window, largest first, with its counts, coverage
// and top result path.
//   outcome / aiStatus   optional filters applied to the interactions inside
//                        visible cells (a cell is visible on its UNFILTERED size);
//                        the 3-interaction minimum applies to the filtered total.
//                        Coverage is null while filtering, because it needs the
//                        unfiltered picture
//   minConfirmed         confirmed interactions needed to judge coverage
// Resolves to { rows, truncated }.
async function loadWindowTerms({ window, outcome = null, aiStatus = null, minConfirmed = GAP_MIN_CONFIRMED }, { Interaction = SearchInteraction } = {}) {
  const range = { createdAt: { $gte: window.start, $lt: window.end } };
  const scope = scopeCondition({ outcome, aiStatus });

  const groups = await Interaction.aggregate(
    [
      { $match: range },
      {
        $group: {
          _id: { termKey: "$termKey", day: DAY_OF },
          cell: { $sum: 1 },
          lastSeen: { $max: scope ? { $cond: [scope, "$createdAt", null] } : "$createdAt" },
          ...cellCounters(scope),
        },
      },
      { $match: { cell: { $gte: MIN_TERM_INTERACTIONS } } }, // the privacy floor on the cell, enforced inside MongoDB
      { $group: { _id: "$_id.termKey", lastSeen: { $max: "$lastSeen" }, ...sumCounters() } },
      { $match: { n: { $gte: MIN_TERM_INTERACTIONS } } }, // and on the term's (filtered) total
      { $sort: { n: -1, _id: 1 } },
      { $limit: MAX_TERMS_SCANNED + 1 },
    ],
    AGGREGATE_OPTIONS,
  );
  const truncated = groups.length > MAX_TERMS_SCANNED;
  const kept = groups.slice(0, MAX_TERMS_SCANNED);
  if (kept.length === 0) return { rows: [], truncated: false };

  // Spellings and top paths, again from visible cells only: a hidden cell must not
  // influence which spelling or path is reported.
  const details = await Interaction.aggregate(
    [
      { $match: { ...range, termKey: { $in: kept.map((group) => group._id) } } },
      {
        $group: {
          _id: { termKey: "$termKey", day: DAY_OF, term: "$term", path: "$topResultPath", dedicated: "$topResultDedicated" },
          total: { $sum: 1 },
          f: tally(scope, null),
        },
      },
      {
        $group: {
          _id: { termKey: "$_id.termKey", day: "$_id.day" },
          cell: { $sum: "$total" },
          parts: { $push: { term: "$_id.term", path: "$_id.path", dedicated: "$_id.dedicated", f: "$f" } },
        },
      },
      { $match: { cell: { $gte: MIN_TERM_INTERACTIONS } } },
      { $unwind: "$parts" },
      {
        $group: {
          _id: { termKey: "$_id.termKey", term: "$parts.term", path: "$parts.path", dedicated: "$parts.dedicated" },
          n: { $sum: "$parts.f" },
        },
      },
      { $match: { n: { $gt: 0 } } },
    ],
    AGGREGATE_OPTIONS,
  );

  const spellingsByKey = new Map();
  const pathsByKey = new Map();
  for (const entry of details) {
    const { termKey, term, path, dedicated } = entry._id;
    const spellings = spellingsByKey.get(termKey) || new Map();
    spellings.set(term, { n: (spellings.get(term)?.n || 0) + entry.n });
    spellingsByKey.set(termKey, spellings);
    if (typeof path !== "string") continue;
    const paths = pathsByKey.get(termKey) || new Map();
    const id = `${path}\u0000${dedicated === true}`;
    paths.set(id, { n: (paths.get(id)?.n || 0) + entry.n, path, dedicated: dedicated === true });
    pathsByKey.set(termKey, paths);
  }

  const filtering = Boolean(outcome || aiStatus);
  const rows = kept.map((group) => {
    const c = numbersOf(group);
    const top = pathsByKey.has(group._id) ? mostCommon(pathsByKey.get(group._id)) : null;
    const spelling = spellingsByKey.has(group._id) ? mostCommon(spellingsByKey.get(group._id)) : null;
    return {
      termKey: group._id,
      term: spelling ? spelling.key : group._id,
      counts: c,
      lastSeen: group.lastSeen,
      topResultPath: top ? { path: top.path, count: top.n, dedicated: top.dedicated } : null,
      ...(filtering ? { coverage: null, gap: null } : { gap: classifyCoverage(c, { minConfirmed }) }),
    };
  });
  if (!filtering) {
    for (const row of rows) row.coverage = row.gap.coverage;
    applyEquivalence(rows);
  }
  return { rows, truncated };
}

// ── Summary (raw-backed) ────────────────────────────────────────────────────
// Totals and term statistics for the window: numbers only, never term text.
// interactionsInSuppressedTerms is every interaction outside a visible term-day
// cell (the pool the rollup calls "other"), not only those of fully hidden terms.
async function loadSummary({ window }, { Interaction = SearchInteraction } = {}) {
  const range = { createdAt: { $gte: window.start, $lt: window.end } };
  const [totalsRows, termStats, terms] = await Promise.all([
    Interaction.aggregate([{ $match: range }, { $group: { _id: null, ...cellCounters(null) } }], AGGREGATE_OPTIONS),
    // A term is "shown" if it has a visible term-day cell; interactionsInShown adds up
    // the visible cells only - the same cells /terms adds up.
    Interaction.aggregate(
      [
        { $match: range },
        { $group: { _id: { termKey: "$termKey", day: DAY_OF }, n: { $sum: 1 } } },
        { $group: { _id: "$_id.termKey", visible: { $sum: { $cond: [{ $gte: ["$n", MIN_TERM_INTERACTIONS] }, "$n", 0] } } } },
        {
          $group: {
            _id: null,
            distinct: { $sum: 1 },
            shown: { $sum: { $cond: [{ $gt: ["$visible", 0] }, 1, 0] } },
            interactionsInShown: { $sum: "$visible" },
          },
        },
      ],
      AGGREGATE_OPTIONS,
    ),
    loadWindowTerms({ window }, { Interaction }),
  ]);

  const totals = totalsRows[0] ? numbersOf(totalsRows[0]) : numbersOf({});
  const stats = termStats[0] || { distinct: 0, shown: 0, interactionsInShown: 0 };
  const byCoverage = (value) => terms.rows.filter((row) => row.coverage === value).length;
  return {
    totals,
    terms: {
      distinct: stats.distinct,
      shown: stats.shown,
      suppressed: stats.distinct - stats.shown,
      interactionsInShownTerms: stats.interactionsInShown,
      interactionsInSuppressedTerms: totals.n - stats.interactionsInShown,
    },
    gaps: {
      pageMissing: byCoverage("page_missing"),
      noCatalogMatch: byCoverage("no_catalog_match"),
      aliasOpportunity: byCoverage("alias_opportunity"),
      unconfirmedInteractions: totals.unavailable,
    },
    truncated: terms.truncated,
  };
}

// ── Trend (rollup-backed) ───────────────────────────────────────────────────
const DAY_MS = 24 * 60 * 60 * 1000;
const EMPTY_POINT = { interactions: 0, dedicatedPageFound: 0, fallbackOnly: 0, noResults: 0, aiUnavailable: 0 };
const NULL_POINT = { interactions: null, dedicatedPageFound: null, fallbackOnly: null, noResults: null, aiUnavailable: null };

const pointFromRow = (row) => ({
  interactions: row.interactions,
  dedicatedPageFound: row.outcomes.dedicated_page_found,
  fallbackOnly: row.outcomes.fallback_only,
  noResults: row.outcomes.no_results,
  aiUnavailable: row.aiStatuses.unavailable,
});

// One point per UTC day of the window.
//   no termKey  everything that day (term rows + the folded "other" row)
//   termKey     that term only; on days it had fewer than 3 interactions the
//               rollup holds no row for it, so the point is all-null - the same
//               answer whether it was searched twice or never
// Finalized days come from the rollup; every other day up to today is computed
// live from raw interactions, with the rollup's own folding. Days older than the
// raw retention that were never rolled up have no data (zeros / null).
//
// Bounded (trendBudget.js): at most TREND_LIMITS.maxLiveDays live days (a rollup that is
// further behind is a TrendBudgetError, not a long loop of aggregations), live days run
// one after another, every operation counts against the request's budget, and at most
// TREND_LIMITS.maxConcurrent trend requests run at once.
const trendGate = createGate();

async function loadTrend(
  { window, termKey = null, now = new Date() },
  { Interaction = SearchInteraction, Stat = SearchTermDailyStat, limits = TREND_LIMITS, gate = trendGate } = {},
) {
  return gate.run(async () => {
    const budget = createBudget(limits);
    const today = startOfUtcDay(now);
    const rawFloor = addDays(today, -(RAW_RETENTION_DAYS - 1));
    const range = { $gte: window.start, $lt: window.end };

    const days = [];
    for (let day = window.from; day.getTime() <= window.to.getTime(); day = addDays(day, 1)) days.push(day);

    const markers = await budget.run((maxTimeMS) => Stat.find({ kind: "other", day: range }).select("day finalized").maxTimeMS(maxTimeMS).lean().exec());
    const finalizedDays = new Set(markers.filter((row) => row.finalized === true).map((row) => dayKey(row.day)));

    // Days that could need a live computation: not finalized and still inside raw retention.
    // One cheap grouped count tells which of them hold any raw interaction at all; an empty
    // day is a zero point and costs nothing more. Decided before any live work starts: too
    // many days with data and no final rollup means the rollup job is behind.
    const candidates = days.filter((day) => !finalizedDays.has(dayKey(day)) && day.getTime() >= rawFloor.getTime());
    const daysWithData = new Set();
    if (candidates.length > 0) {
      const counts = await budget.run((maxTimeMS) => Interaction.aggregate(
        [
          { $match: { createdAt: { $gte: candidates[0], $lt: addDays(candidates[candidates.length - 1], 1) } } },
          { $group: { _id: DAY_OF, n: { $sum: 1 } } },
        ],
        { allowDiskUse: true, maxTimeMS },
      ));
      for (const row of counts) daysWithData.add(row._id);
    }
    const liveDays = new Set(candidates.filter((day) => daysWithData.has(dayKey(day))).map(dayKey));
    if (liveDays.size > limits.maxLiveDays) throw new TrendBudgetError("live_days");

    const fromRollup = new Map();
    if (termKey === null) {
      const sums = await budget.run((maxTimeMS) => Stat.aggregate(
        [
          { $match: { day: range } },
          {
            $group: {
              _id: "$day",
              interactions: { $sum: "$interactions" },
              found: { $sum: "$outcomes.dedicated_page_found" },
              fallback: { $sum: "$outcomes.fallback_only" },
              none: { $sum: "$outcomes.no_results" },
              unavailable: { $sum: "$aiStatuses.unavailable" },
            },
          },
        ],
        { allowDiskUse: true, maxTimeMS },
      ));
      for (const row of sums) {
        fromRollup.set(dayKey(row._id), {
          interactions: row.interactions, dedicatedPageFound: row.found, fallbackOnly: row.fallback, noResults: row.none, aiUnavailable: row.unavailable,
        });
      }
    } else {
      const rows = await budget.run((maxTimeMS) => Stat.find({ kind: "term", termKey, day: range }).select("day interactions outcomes aiStatuses").maxTimeMS(maxTimeMS).lean().exec());
      for (const row of rows) fromRollup.set(dayKey(row.day), pointFromRow(row));
    }

    // Every live read goes through the budget; readDay's own (longer) options are ignored.
    const budgeted = { aggregate: (pipeline) => budget.run((maxTimeMS) => Interaction.aggregate(pipeline, { allowDiskUse: true, maxTimeMS })) };

    const points = [];
    for (const day of days) {
      const key = dayKey(day);
      let point = null;
      let final = false;
      if (finalizedDays.has(key)) {
        point = fromRollup.get(key) || null;
        final = true;
      } else if (liveDays.has(key)) {
        const rows = buildRows(day, await readDay(day, { Interaction: budgeted }), now);
        if (termKey === null) {
          point = rows.reduce((sum, row) => {
            const next = pointFromRow(row);
            return Object.fromEntries(Object.keys(sum).map((field) => [field, sum[field] + next[field]]));
          }, { ...EMPTY_POINT });
        } else {
          const row = rows.find((candidate) => candidate.kind === "term" && candidate.termKey === termKey);
          point = row ? pointFromRow(row) : null;
        }
      }
      points.push({ day: key, ...(point || (termKey === null ? EMPTY_POINT : NULL_POINT)), final });
    }
    return points;
  });
}

module.exports = {
  loadWindowTerms,
  loadSummary,
  loadTrend,
  MAX_TERMS_SCANNED,
  trendGate,
  GAP_VALUES,
  DAY_MS,
};
