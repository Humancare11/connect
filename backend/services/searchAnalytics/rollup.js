// Daily rollup of SearchInteraction into SearchTermDailyStat.
//
// For every closed UTC day [00:00, 24:00):
//   - terms with at least MIN_TERM_INTERACTIONS (3) interactions that day get
//     their own "term" row (counts by settledBy / outcome / aiStatus, the
//     most common top-result path, how often a dedicated page was available);
//   - everything else is folded into that day's single "other" row as COUNTS
//     ONLY: no term text and no term keys are copied.
//
// Idempotent: each row has a deterministic _id ("<day>|term|<termKey>" /
// "<day>|other|") and is written with replaceOne + upsert from a fresh read of
// the raw interactions, so running a day again rewrites the same documents;
// counts are never added to what is already stored. Rows of that day that no
// longer qualify are removed after the new ones are written.
//
// Reads SearchInteraction only (aggregate / find); it writes SearchTermDailyStat
// only. It never throws: failures are returned in the summary and logged as a
// fixed message with a day (YYYY-MM-DD) and an error NAME - never a query,
// a document, an address or a database error message.

const SearchInteraction = require("../../models/SearchInteraction");
const SearchTermDailyStat = require("../../models/SearchTermDailyStat");
const {
  MIN_TERM_INTERACTIONS,
  ROLLUP_RETENTION_MONTHS,
  ROLLUP_FINALIZE_GRACE_MS,
  ROLLUP_RECOMPUTE_RECENT_DAYS,
  ROLLUP_MAX_DAY_AGE_DAYS,
  ROLLUP_BACKLOG_ALARM_DAYS,
  ROLLUP_MAX_DAYS_PER_RUN,
  SCHEMA_VERSION,
  SETTLED_BY,
  OUTCOMES,
  AI_STATUSES,
} = require("./constants");

const DAY_MS = 24 * 60 * 60 * 1000;
const AGGREGATE_OPTIONS = Object.freeze({ allowDiskUse: true, maxTimeMS: 60 * 1000 });

// ── UTC day helpers ─────────────────────────────────────────────────────────
const startOfUtcDay = (date) => new Date(Math.floor(date.getTime() / DAY_MS) * DAY_MS);
const addDays = (day, count) => new Date(day.getTime() + count * DAY_MS);
const dayKey = (day) => day.toISOString().slice(0, 10);
const expiryFor = (day) => {
  const expires = new Date(day.getTime());
  expires.setUTCMonth(expires.getUTCMonth() + ROLLUP_RETENTION_MONTHS);
  return expires;
};

// Only a bounded error name is ever logged.
function safeName(err) {
  return typeof err?.name === "string" ? err.name.slice(0, 60) : "Error";
}
function log(logger, message) {
  try {
    logger(message);
  } catch {
    // Logging must never throw either.
  }
}

class RollupDataError extends Error {
  constructor() {
    super("Unexpected interaction data.");
    this.name = "RollupDataError";
  }
}

// ── Accumulation ────────────────────────────────────────────────────────────
const zeroed = (keys) => Object.fromEntries(keys.map((key) => [key, 0]));
const newTotals = () => ({
  interactions: 0,
  bySettledBy: zeroed(SETTLED_BY),
  outcomes: zeroed(OUTCOMES),
  aiStatuses: zeroed(AI_STATUSES),
  dedicatedPageAvailableCount: 0,
});

function addTo(totals, group, count) {
  if (!(group.settledBy in totals.bySettledBy) || !(group.outcome in totals.outcomes) || !(group.aiStatus in totals.aiStatuses)) {
    throw new RollupDataError();
  }
  totals.interactions += count;
  totals.bySettledBy[group.settledBy] += count;
  totals.outcomes[group.outcome] += count;
  totals.aiStatuses[group.aiStatus] += count;
  if (group.available === true) totals.dedicatedPageAvailableCount += count;
}

function mergeInto(target, source) {
  target.interactions += source.interactions;
  for (const key of SETTLED_BY) target.bySettledBy[key] += source.bySettledBy[key];
  for (const key of OUTCOMES) target.outcomes[key] += source.outcomes[key];
  for (const key of AI_STATUSES) target.aiStatuses[key] += source.aiStatuses[key];
  target.dedicatedPageAvailableCount += source.dedicatedPageAvailableCount;
}

// Most frequent entry; ties go to the smallest key, so the result is deterministic.
function mostCommon(counts) {
  let best = null;
  for (const [key, entry] of [...counts.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (!best || entry.n > best.n) best = { key, ...entry };
  }
  return best;
}

// ── Reading one day ─────────────────────────────────────────────────────────
// Three bounded aggregations: (A) which terms reach the threshold, (B) detail
// for those terms only, (C) everything else, as counts. Anything that turns
// out below the threshold after (B) (data can move between reads while a day
// is still open) is folded into "other", so every document seen lands in
// exactly one row.
async function readDay(day, { Interaction }) {
  const range = { createdAt: { $gte: day, $lt: addDays(day, 1) } };

  const frequent = await Interaction.aggregate(
    [{ $match: range }, { $group: { _id: "$termKey", n: { $sum: 1 } } }, { $match: { n: { $gte: MIN_TERM_INTERACTIONS } } }],
    AGGREGATE_OPTIONS,
  );
  const frequentKeys = frequent.map((entry) => entry._id).sort();

  const detail = frequentKeys.length
    ? await Interaction.aggregate(
      [
        { $match: { ...range, termKey: { $in: frequentKeys } } },
        {
          $group: {
            _id: {
              termKey: "$termKey", term: "$term", settledBy: "$settledBy", outcome: "$outcome", aiStatus: "$aiStatus",
              path: "$topResultPath", pathDedicated: "$topResultDedicated", available: "$dedicatedPageAvailable",
            },
            n: { $sum: 1 },
          },
        },
      ],
      AGGREGATE_OPTIONS,
    )
    : [];

  const rest = await Interaction.aggregate(
    [
      { $match: { ...range, termKey: { $nin: frequentKeys } } },
      { $group: { _id: { settledBy: "$settledBy", outcome: "$outcome", aiStatus: "$aiStatus", available: "$dedicatedPageAvailable" }, n: { $sum: 1 } } },
    ],
    AGGREGATE_OPTIONS,
  );
  const restTerms = await Interaction.aggregate(
    [{ $match: { ...range, termKey: { $nin: frequentKeys } } }, { $group: { _id: "$termKey" } }, { $count: "n" }],
    AGGREGATE_OPTIONS,
  );

  return { detail, rest, restTermCount: restTerms[0]?.n || 0 };
}

// Turns the raw groups into the rows for one day (pure; no I/O).
function buildRows(day, { detail, rest, restTermCount }, now) {
  const key = dayKey(day);
  const finalized = now.getTime() >= addDays(day, 1).getTime() + ROLLUP_FINALIZE_GRACE_MS;
  const common = { day, finalized, computedAt: now, schemaVersion: SCHEMA_VERSION, expiresAt: expiryFor(day) };

  const terms = new Map();
  for (const entry of detail) {
    const g = entry._id;
    let acc = terms.get(g.termKey);
    if (!acc) {
      acc = { totals: newTotals(), spellings: new Map(), paths: new Map() };
      terms.set(g.termKey, acc);
    }
    addTo(acc.totals, g, entry.n);
    acc.spellings.set(g.term, { n: (acc.spellings.get(g.term)?.n || 0) + entry.n });
    if (typeof g.path === "string") {
      const pathKey = `${g.path}\u0000${g.pathDedicated === true}`;
      const current = acc.paths.get(pathKey);
      acc.paths.set(pathKey, { n: (current?.n || 0) + entry.n, path: g.path, dedicated: g.pathDedicated === true });
    }
  }

  const other = newTotals();
  for (const entry of rest) addTo(other, entry._id, entry.n);
  let distinctTerms = restTermCount;

  const rows = [];
  for (const [termKey, acc] of [...terms.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (acc.totals.interactions < MIN_TERM_INTERACTIONS) {
      mergeInto(other, acc.totals); // fell below the threshold since pass (A)
      distinctTerms += 1;
      continue;
    }
    const topPath = mostCommon(acc.paths);
    rows.push({
      _id: `${key}|term|${termKey}`,
      kind: "term",
      termKey,
      term: mostCommon(acc.spellings).key,
      ...acc.totals,
      topResultPath: topPath ? topPath.path : null,
      topResultPathCount: topPath ? topPath.n : null,
      topResultDedicated: topPath ? topPath.dedicated : null,
      distinctTerms: null,
      ...common,
    });
  }

  rows.push({
    _id: `${key}|other|`,
    kind: "other",
    termKey: null,
    term: null,
    ...other,
    topResultPath: null,
    topResultPathCount: null,
    topResultDedicated: null,
    distinctTerms,
    ...common,
  });
  return rows;
}

// Computes and stores one UTC day. Throws on failure (callers contain it).
async function rollupDay(day, { Interaction, Stat, now }) {
  const rows = buildRows(day, await readDay(day, { Interaction }), now);

  // Same rules as the model, before anything is written.
  await Promise.all(rows.map((row) => new Stat(row).validate()));

  await Stat.bulkWrite(
    rows.map((row) => ({ replaceOne: { filter: { _id: row._id }, replacement: row, upsert: true } })),
    { ordered: false },
  );
  // Rows written first; only now drop this day's term rows that no longer qualify.
  const keep = rows.filter((row) => row.kind === "term").map((row) => row.termKey);
  await Stat.deleteMany({ day, kind: "term", termKey: { $nin: keep } });
  return { terms: keep.length, interactions: rows.reduce((sum, row) => sum + row.interactions, 0) };
}

// ── Which days to process ───────────────────────────────────────────────────
// oldestRawAt: createdAt of the oldest raw interaction (or null)
// finalizedByDay: Map "YYYY-MM-DD" -> boolean, from the existing "other" rows
//
// A closed day is processed when it is one of the most recent
// ROLLUP_RECOMPUTE_RECENT_DAYS days (late updates), or has no finalized
// "other" row yet (never rolled up, or rolled up too early). Days older than
// ROLLUP_MAX_DAY_AGE_DAYS are never touched: their raw data may already be
// partly expired. Oldest first, at most ROLLUP_MAX_DAYS_PER_RUN per run.
function selectDays({ now, oldestRawAt, finalizedByDay }) {
  const today = startOfUtcDay(now);
  const yesterday = addDays(today, -1);
  const recentFirst = addDays(yesterday, -(ROLLUP_RECOMPUTE_RECENT_DAYS - 1));
  const floor = addDays(today, -ROLLUP_MAX_DAY_AGE_DAYS);
  const oldestRawDay = oldestRawAt ? startOfUtcDay(oldestRawAt) : recentFirst;
  const first = new Date(Math.max(floor.getTime(), Math.min(oldestRawDay.getTime(), recentFirst.getTime())));

  const days = [];
  let backlogAlarm = false;
  for (let day = first; day.getTime() <= yesterday.getTime(); day = addDays(day, 1)) {
    const recent = day.getTime() >= recentFirst.getTime();
    const pending = finalizedByDay.get(dayKey(day)) !== true;
    if (!recent && !pending) continue;
    if (pending && !recent && (today.getTime() - day.getTime()) / DAY_MS > ROLLUP_BACKLOG_ALARM_DAYS) backlogAlarm = true;
    days.push(day);
  }
  return { days: days.slice(0, ROLLUP_MAX_DAYS_PER_RUN), backlogAlarm };
}

// ── One full run ────────────────────────────────────────────────────────────
// Resolves to { processed: ["YYYY-MM-DD"...], failed: [...], backlogAlarm }.
async function runRollup({ now = new Date(), Interaction = SearchInteraction, Stat = SearchTermDailyStat, logger = console.error } = {}) {
  const summary = { processed: [], failed: [], backlogAlarm: false };
  try {
    const oldest = await Interaction.findOne({}).sort({ createdAt: 1 }).select("createdAt").lean();
    const floor = addDays(startOfUtcDay(now), -ROLLUP_MAX_DAY_AGE_DAYS);
    const markers = await Stat.find({ kind: "other", day: { $gte: floor, $lt: startOfUtcDay(now) } }).select("day finalized").lean();
    const finalizedByDay = new Map(markers.map((row) => [dayKey(row.day), row.finalized === true]));

    const { days, backlogAlarm } = selectDays({ now, oldestRawAt: oldest ? oldest.createdAt : null, finalizedByDay });
    summary.backlogAlarm = backlogAlarm;
    if (backlogAlarm) log(logger, "[search-analytics] rollup backlog: an unfinalized day is older than 80 days");

    for (const day of days) {
      try {
        await rollupDay(day, { Interaction, Stat, now });
        summary.processed.push(dayKey(day));
      } catch (err) {
        summary.failed.push(dayKey(day));
        log(logger, `[search-analytics] rollup failed for ${dayKey(day)}: ${safeName(err)}`);
      }
    }
  } catch (err) {
    summary.failed.push("plan");
    log(logger, `[search-analytics] rollup planning failed: ${safeName(err)}`);
  }
  return summary;
}

module.exports = { runRollup, rollupDay, selectDays, readDay, buildRows, startOfUtcDay, addDays, dayKey, expiryFor };
