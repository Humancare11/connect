// Shared constants for search analytics. Pure data: no models, no I/O.

const { RESULT_TYPES, MAX_RESULTS_TOTAL } = require("../search/searchConstants");

const SCHEMA_VERSION = 1;

// Raw interaction documents expire 90 days after they are first recorded.
const RAW_RETENTION_DAYS = 90;

// A match this relevant (matcher score 0-100) counts as "the topic is
// covered". Deliberately low: a falsely reported content gap is worse than a
// missed one. Named-in-query matches score 65, word-prefix 70, prefix 85,
// exact alias 95, AI-intent matches 90.
const RELEVANT_SCORE = 65;

const SETTLED_BY = Object.freeze(["idle", "select", "submit"]);
const AI_STATUSES = Object.freeze(["not_requested", "not_needed", "used", "no_match", "unavailable"]);
const OUTCOMES = Object.freeze(["dedicated_page_found", "fallback_only", "no_results"]);

// Result types that can have a dedicated page of their own.
const PAGE_TYPES = Object.freeze(["category", "specialty", "condition", "service"]);

const MAX_TERM_LENGTH = 100;
const MAX_PATH_LENGTH = 200;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
// Same character set as resultBuilder.safeLegacyRoute: a plain same-site path.
const SAFE_PATH = /^\/(?!\/)[A-Za-z0-9\-/&_]*$/;

// ── Daily rollup (services/searchAnalytics/rollup.js) ───────────────────────
// A term gets its own row for a UTC day only with at least this many
// interactions that day; everything below is folded into the day's "other" row.
const MIN_TERM_INTERACTIONS = 3;
// Rollup rows are kept 13 calendar months after their day.
const ROLLUP_RETENTION_MONTHS = 13;
// A day is final once it ended at least this long ago (late idle -> submit
// upgrades of its interactions have long since happened).
const ROLLUP_FINALIZE_GRACE_MS = 2 * 60 * 60 * 1000;
// The most recent closed days are always recomputed (late updates).
const ROLLUP_RECOMPUTE_RECENT_DAYS = 2;
// Raw interactions expire after 90 days; a day older than this may already be
// partly gone, so it is never (re)computed. Alarm well before that.
const ROLLUP_MAX_DAY_AGE_DAYS = 89;
const ROLLUP_BACKLOG_ALARM_DAYS = 80;
const ROLLUP_MAX_DAYS_PER_RUN = 100;

// Mongoose schema options for the analytics collections. Mongoose would
// otherwise create each collection and build its indexes (including TTL
// indexes) as soon as the model is compiled and a connection is up, which is
// a database write even when analytics is switched off. So both are on only
// when SEARCH_ANALYTICS_ENABLED is exactly "true" at model-load time (the same
// rule as isSearchAnalyticsEnabled; read here because this file must stay free
// of model imports). Enabling therefore takes effect at the next start. Other
// models are unaffected: these are per-schema options.
function analyticsSchemaOptions(env = process.env) {
  const enabled = env.SEARCH_ANALYTICS_ENABLED === "true";
  return { autoIndex: enabled, autoCreate: enabled };
}

module.exports = {
  analyticsSchemaOptions,
  MIN_TERM_INTERACTIONS,
  ROLLUP_RETENTION_MONTHS,
  ROLLUP_FINALIZE_GRACE_MS,
  ROLLUP_RECOMPUTE_RECENT_DAYS,
  ROLLUP_MAX_DAY_AGE_DAYS,
  ROLLUP_BACKLOG_ALARM_DAYS,
  ROLLUP_MAX_DAYS_PER_RUN,
  SCHEMA_VERSION,
  RAW_RETENTION_DAYS,
  RELEVANT_SCORE,
  SETTLED_BY,
  AI_STATUSES,
  OUTCOMES,
  PAGE_TYPES,
  RESULT_TYPES,
  MAX_RESULTS_TOTAL,
  MAX_TERM_LENGTH,
  MAX_PATH_LENGTH,
  UUID_V4,
  SAFE_PATH,
};
