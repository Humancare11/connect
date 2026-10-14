// Strict query-parameter validation for the superadmin Search Analytics read
// APIs. Pure: no I/O, no logging.
//
// Every parameter is checked against an allowlist. Anything unexpected - an
// unknown name, a repeated or nested value, a bad format or range - throws an
// AdminParamError that carries only the name of an ALLOWED parameter (or
// "query" for structural problems), never the offending name or value, so an
// error response can never echo what the caller sent.

const { OUTCOMES, AI_STATUSES, RAW_RETENTION_DAYS } = require("./constants");

const DAY_MS = 24 * 60 * 60 * 1000;

// Windows are inclusive of both ends, in whole UTC days.
const RAW_WINDOW_MAX_DAYS = RAW_RETENTION_DAYS; // summary / terms / gaps read raw interactions: 90 days
const TREND_WINDOW_MAX_DAYS = 396; // trend reads daily rollups (13 months)
const DEFAULT_WINDOW_DAYS = 30;

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const MAX_OFFSET = 1000;
const MIN_COUNT_FLOOR = 3; // k: a term is never shown with fewer interactions
const MAX_MIN_COUNT = 1000;
const DEFAULT_TERMS_MIN_COUNT = MIN_COUNT_FLOOR;
const DEFAULT_GAPS_MIN_COUNT = 5;
const SORTS = Object.freeze(["count", "recent"]);
const MAX_TERM_KEY_LENGTH = 100;

class AdminParamError extends Error {
  constructor(field) {
    super("Invalid request parameter.");
    this.name = "AdminParamError";
    this.field = field;
  }
}

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const TERM_KEY_FORMAT = /^[a-z0-9]+(?: [a-z0-9]+)*$/;
const INTEGER_FORMAT = /^\d{1,6}$/;

const startOfUtcDay = (date) => new Date(Math.floor(date.getTime() / DAY_MS) * DAY_MS);
const addDays = (day, count) => new Date(day.getTime() + count * DAY_MS);
const dayKey = (day) => day.toISOString().slice(0, 10);

// Rejects unknown names, repeated values (arrays), nested values and empty values.
function checkShape(query, allowed) {
  if (query === null || typeof query !== "object" || Array.isArray(query)) throw new AdminParamError("query");
  for (const name of Object.keys(query)) {
    if (!allowed.includes(name)) throw new AdminParamError("query");
    if (typeof query[name] !== "string" || query[name] === "") throw new AdminParamError(name);
  }
}

function parseDate(value, field) {
  if (typeof value !== "string" || !DATE_FORMAT.test(value)) throw new AdminParamError(field);
  const date = new Date(`${value}T00:00:00.000Z`);
  // Rejects impossible calendar dates such as 2026-02-30 (which Date would roll over).
  if (Number.isNaN(date.getTime()) || dayKey(date) !== value) throw new AdminParamError(field);
  return date;
}

function parseInteger(value, field, { min, max, fallback }) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !INTEGER_FORMAT.test(value)) throw new AdminParamError(field);
  const number = Number(value);
  if (number < min || number > max) throw new AdminParamError(field);
  return number;
}

function parseEnum(value, field, allowed) {
  if (value === undefined) return null;
  if (typeof value !== "string" || !allowed.includes(value)) throw new AdminParamError(field);
  return value;
}

// Resolves the requested inclusive window of UTC days.
//   defaults: the last 30 days ending today (UTC)
//   rules:    to <= today, from <= to, at most maxDays days, nothing older than
//             maxDays - 1 days before today (older data may no longer exist)
function parseWindow(query, { maxDays, now = new Date() }) {
  const today = startOfUtcDay(now);
  const to = query.to === undefined ? today : parseDate(query.to, "to");
  const from = query.from === undefined ? addDays(to, -(DEFAULT_WINDOW_DAYS - 1)) : parseDate(query.from, "from");
  if (to.getTime() > today.getTime()) throw new AdminParamError("to");
  if (from.getTime() > to.getTime()) throw new AdminParamError("from");
  const days = Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1;
  if (days > maxDays) throw new AdminParamError("from");
  if (from.getTime() < addDays(today, -(maxDays - 1)).getTime()) throw new AdminParamError("from");
  return { from, to, days, start: from, end: addDays(to, 1), fromKey: dayKey(from), toKey: dayKey(to) };
}

function parsePagination(query) {
  return {
    limit: parseInteger(query.limit, "limit", { min: 1, max: MAX_LIMIT, fallback: DEFAULT_LIMIT }),
    offset: parseInteger(query.offset, "offset", { min: 0, max: MAX_OFFSET, fallback: 0 }),
  };
}

const parseMinCount = (query, fallback) =>
  parseInteger(query.minCount, "minCount", { min: MIN_COUNT_FLOOR, max: MAX_MIN_COUNT, fallback });

function parseSummaryQuery(query, options = {}) {
  checkShape(query, ["from", "to"]);
  return { window: parseWindow(query, { maxDays: RAW_WINDOW_MAX_DAYS, ...options }) };
}

function parseTermsQuery(query, options = {}) {
  checkShape(query, ["from", "to", "outcome", "aiStatus", "sort", "limit", "offset", "minCount"]);
  return {
    window: parseWindow(query, { maxDays: RAW_WINDOW_MAX_DAYS, ...options }),
    outcome: parseEnum(query.outcome, "outcome", OUTCOMES),
    aiStatus: parseEnum(query.aiStatus, "aiStatus", AI_STATUSES),
    sort: parseEnum(query.sort, "sort", SORTS) || "count",
    minCount: parseMinCount(query, DEFAULT_TERMS_MIN_COUNT),
    ...parsePagination(query),
  };
}

function parseGapsQuery(query, options = {}) {
  checkShape(query, ["from", "to", "minCount", "limit", "offset"]);
  return {
    window: parseWindow(query, { maxDays: RAW_WINDOW_MAX_DAYS, ...options }),
    minCount: parseMinCount(query, DEFAULT_GAPS_MIN_COUNT),
    ...parsePagination(query),
  };
}

function parseTrendQuery(query, options = {}) {
  checkShape(query, ["from", "to", "termKey"]);
  let termKey = null;
  if (query.termKey !== undefined) {
    if (query.termKey.length > MAX_TERM_KEY_LENGTH || !TERM_KEY_FORMAT.test(query.termKey)) throw new AdminParamError("termKey");
    termKey = query.termKey;
  }
  return { window: parseWindow(query, { maxDays: TREND_WINDOW_MAX_DAYS, ...options }), termKey };
}

module.exports = {
  AdminParamError,
  parseSummaryQuery,
  parseTermsQuery,
  parseGapsQuery,
  parseTrendQuery,
  parseWindow,
  startOfUtcDay,
  addDays,
  dayKey,
  SORTS,
  RAW_WINDOW_MAX_DAYS,
  TREND_WINDOW_MAX_DAYS,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MAX_OFFSET,
  MIN_COUNT_FLOOR,
  DEFAULT_GAPS_MIN_COUNT,
};
