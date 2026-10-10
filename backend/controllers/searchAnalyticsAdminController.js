// Admin Search Analytics read APIs (GET /summary, /terms, /gaps, /trend).
// See routes/adminSearchAnalytics.js for the auth guard.
//
// Read-only and aggregate-only. Every response is built here, field by field,
// from the aggregates returned by services/searchAnalytics/adminQueries.js:
// no stored document, internal id, interaction id or timestamp-level record can
// reach a client, because nothing is copied by spreading or by default.
//
// Errors are fixed responses: 400 for a bad parameter (naming only which
// ALLOWED parameter was wrong, never echoing its value), 503 when /trend cannot
// finish inside its execution budget (or is busy), and 500 for anything else (no
// database detail). Failures are logged as an endpoint name and an
// error NAME only - never a query, parameter, document or message.

const { loadWindowTerms, loadSummary, loadTrend } = require("../services/searchAnalytics/adminQueries");
const {
  AdminParamError,
  parseSummaryQuery,
  parseTermsQuery,
  parseGapsQuery,
  parseTrendQuery,
  dayKey,
} = require("../services/searchAnalytics/adminParams");
const { GAP_VALUES } = require("../services/searchAnalytics/coverage");
const { MIN_TERM_INTERACTIONS, MAX_TERM_LENGTH, MAX_PATH_LENGTH, SAFE_PATH } = require("../services/searchAnalytics/constants");
const { TrendBudgetError } = require("../services/searchAnalytics/trendBudget");
const { isSearchAnalyticsEnabled } = require("../services/searchAnalytics/searchEvents");

// Parameter names an error may mention (everything else is reported as "query").
const REPORTABLE_FIELDS = new Set(["from", "to", "outcome", "aiStatus", "sort", "limit", "offset", "minCount", "termKey", "query"]);

// ── Safe values ─────────────────────────────────────────────────────────────
// Text is returned only as a JSON string, stripped of control characters and
// bounded. (Clients must still render it as text, never as HTML.)
function safeText(value, max = MAX_TERM_LENGTH) {
  if (typeof value !== "string") return "";
  let clean = "";
  for (const char of value) {
    const code = char.codePointAt(0);
    // Drop C0/C1 control characters and the Unicode line/paragraph separators.
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029) continue;
    clean += char;
  }
  return clean.trim().slice(0, max);
}
const safePath = (value) => (typeof value === "string" && value.length <= MAX_PATH_LENGTH && SAFE_PATH.test(value) ? value : null);
const int = (value) => (Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0);

// ── Serializers (explicit allowlists) ───────────────────────────────────────
const bySettledBy = (c) => ({ idle: int(c.idle), select: int(c.select), submit: int(c.submit) });
const outcomes = (c) => ({ dedicatedPageFound: int(c.found), fallbackOnly: int(c.fallback), noResults: int(c.none) });
const aiStatuses = (c) => ({
  notRequested: int(c.notRequested), notNeeded: int(c.notNeeded), used: int(c.used), noMatch: int(c.noMatch), unavailable: int(c.unavailable),
});
const topResultPath = (top) => {
  const path = top && safePath(top.path);
  return path ? { path, count: int(top.count), dedicated: top.dedicated === true } : null;
};
const lastSeen = (date) => (date instanceof Date && !Number.isNaN(date.getTime()) ? dayKey(date) : null);

const termItem = (row) => ({
  term: safeText(row.term),
  termKey: safeText(row.termKey),
  interactions: int(row.counts.n),
  lastSeen: lastSeen(row.lastSeen),
  bySettledBy: bySettledBy(row.counts),
  outcomes: outcomes(row.counts),
  aiStatuses: aiStatuses(row.counts),
  dedicatedPageAvailable: int(row.counts.available),
  topResultPath: topResultPath(row.topResultPath),
  coverage: row.coverage || null,
});

const gapItem = (row) => ({
  term: safeText(row.term),
  termKey: safeText(row.termKey),
  gapType: row.coverage,
  interactions: int(row.counts.n),
  confirmedInteractions: int(row.gap.confirmedInteractions),
  unconfirmedInteractions: int(row.gap.unconfirmedInteractions),
  confirmedDedicatedRate: row.gap.confirmedDedicatedRate,
  confirmedOutcomes: {
    dedicatedPageFound: int(row.gap.confirmedOutcomes.dedicatedPageFound),
    fallbackOnly: int(row.gap.confirmedOutcomes.fallbackOnly),
    noResults: int(row.gap.confirmedOutcomes.noResults),
  },
  aiAssistedFound: int(row.counts.submitFoundViaAi),
  instantNotFound: int(row.counts.instantNotFound),
  lastSeen: lastSeen(row.lastSeen),
  topResultPath: topResultPath(row.topResultPath),
});

const trendPoint = (point) => ({
  day: point.day,
  interactions: point.interactions,
  dedicatedPageFound: point.dedicatedPageFound,
  fallbackOnly: point.fallbackOnly,
  noResults: point.noResults,
  aiUnavailable: point.aiUnavailable,
  final: point.final === true,
});

const windowOf = (w) => ({ from: w.fromKey, to: w.toKey, days: w.days });
const paginate = (rows, { limit, offset }) => ({
  items: rows.slice(offset, offset + limit),
  pagination: { limit, offset, total: rows.length, hasMore: offset + limit < rows.length },
});

// ── Controller ──────────────────────────────────────────────────────────────
function createSearchAnalyticsAdminController({
  queries = { loadWindowTerms, loadSummary, loadTrend },
  now = () => new Date(),
  logger = console.error,
  isEnabled = isSearchAnalyticsEnabled,
} = {}) {
  const meta = (extra = {}) => ({
    kThreshold: MIN_TERM_INTERACTIONS,
    generatedAt: now().toISOString(),
    collectionEnabled: (() => { try { return isEnabled() === true; } catch { return false; } })(),
    ...extra,
  });

  function fail(res, endpoint, err) {
    if (err instanceof AdminParamError) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_REQUEST", field: REPORTABLE_FIELDS.has(err.field) ? err.field : "query", message: "Invalid request parameter." },
      });
    }
    if (err instanceof TrendBudgetError) {
      try {
        logger(`[search-analytics] admin read failed: ${endpoint} TrendBudgetError`);
      } catch {
        // Logging must never throw either.
      }
      res.set("Cache-Control", "no-store");
      res.set("Retry-After", "30");
      return res.status(503).json({
        success: false,
        error: { code: "TREND_UNAVAILABLE", message: "The trend could not be computed right now. Please try again shortly." },
      });
    }
    try {
      logger(`[search-analytics] admin read failed: ${endpoint} ${typeof err?.name === "string" ? err.name.slice(0, 60) : "Error"}`);
    } catch {
      // Logging must never throw either.
    }
    return res.status(500).json({
      success: false,
      error: { code: "ANALYTICS_UNAVAILABLE", message: "Search analytics is temporarily unavailable." },
    });
  }

  // Runs one endpoint. `work(query)` resolves to the response body.
  const endpoint = (name, work) => async function handle(req, res) {
    try {
      const body = await work(req.query);
      res.set("Cache-Control", "no-store");
      return res.json(body);
    } catch (err) {
      return fail(res, name, err);
    }
  };

  const summary = endpoint("summary", async (query) => {
    const { window } = parseSummaryQuery(query, { now: now() });
    const result = await queries.loadSummary({ window });
    const t = result.totals;
    return {
      success: true,
      window: windowOf(window),
      data: {
        interactions: int(t.n),
        bySettledBy: bySettledBy(t),
        outcomes: outcomes(t),
        aiStatuses: aiStatuses(t),
        dedicatedPageAvailable: int(t.available),
        terms: {
          distinct: int(result.terms.distinct),
          shown: int(result.terms.shown),
          suppressed: int(result.terms.suppressed),
          interactionsInShownTerms: int(result.terms.interactionsInShownTerms),
          interactionsInSuppressedTerms: int(result.terms.interactionsInSuppressedTerms),
        },
        gaps: {
          pageMissing: int(result.gaps.pageMissing),
          noCatalogMatch: int(result.gaps.noCatalogMatch),
          aliasOpportunity: int(result.gaps.aliasOpportunity),
          unconfirmedInteractions: int(result.gaps.unconfirmedInteractions),
        },
      },
      meta: meta({ truncated: result.truncated === true }),
    };
  });

  const terms = endpoint("terms", async (query) => {
    const params = parseTermsQuery(query, { now: now() });
    const loaded = await queries.loadWindowTerms({ window: params.window, outcome: params.outcome, aiStatus: params.aiStatus });
    // The caller may raise the 3-interaction minimum, never lower it.
    const rows = loaded.rows.filter((row) => row.counts.n >= params.minCount);
    if (params.sort === "recent") {
      // Ordered by exactly what is exposed (the day), never by the hidden time of day.
      const day = (row) => lastSeen(row.lastSeen) || "";
      rows.sort((a, b) => (day(a) < day(b) ? 1 : day(a) > day(b) ? -1 : 0) || b.counts.n - a.counts.n || (a.termKey < b.termKey ? -1 : 1));
    } // "count" is already ordered by interactions, then term key
    const page = paginate(rows, params);
    return {
      success: true,
      window: windowOf(params.window),
      data: {
        items: page.items.map(termItem),
        pagination: page.pagination,
        sort: params.sort,
        filters: { outcome: params.outcome, aiStatus: params.aiStatus, minCount: params.minCount },
      },
      meta: meta({ truncated: loaded.truncated === true }),
    };
  });

  const gaps = endpoint("gaps", async (query) => {
    const params = parseGapsQuery(query, { now: now() });
    const loaded = await queries.loadWindowTerms({ window: params.window, minConfirmed: params.minCount });
    const rows = loaded.rows.filter((row) => row.counts.n >= params.minCount && GAP_VALUES.includes(row.coverage));
    const page = paginate(rows, params);
    return {
      success: true,
      window: windowOf(params.window),
      data: { items: page.items.map(gapItem), pagination: page.pagination, filters: { minCount: params.minCount } },
      meta: meta({ truncated: loaded.truncated === true }),
    };
  });

  const trend = endpoint("trend", async (query) => {
    const params = parseTrendQuery(query, { now: now() });
    const points = await queries.loadTrend({ window: params.window, termKey: params.termKey, now: now() });
    return {
      success: true,
      window: windowOf(params.window),
      // The requested term is deliberately not echoed back: a response never contains a term
      // the caller could not already see in /terms.
      data: { scope: params.termKey === null ? "all" : "term", points: points.map(trendPoint) },
      meta: meta(),
    };
  });

  return { summary, terms, gaps, trend };
}

module.exports = { createSearchAnalyticsAdminController, safeText, safePath };
