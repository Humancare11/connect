// Execution budget and concurrency gate for GET /trend.
//
// /trend is normally three cheap reads (rollup markers, rollup rows, and a grouped
// count of raw interactions per not-yet-final day). Only days that are not
// finalized AND hold raw data are computed live, at 4 aggregations per day. Without a bound, a delayed rollup job could make one
// request run one live computation per missing day (up to 90). So each request:
//   - gets a total wall-clock budget, enforced even if the driver stalls;
//   - gets a hard cap on database operations (and on live days, checked up front);
//   - runs its operations strictly one after another;
//   - is admitted only while fewer than MAX_CONCURRENT trend requests are running.
// Exceeding any of these is a TrendBudgetError, which the controller turns into
// one fixed 503. The error carries no detail: the reason is for tests only.

const TREND_LIMITS = Object.freeze({
  totalMs: 8 * 1000, // whole request, all database work included
  queryMs: 4 * 1000, // any single operation (also sent to MongoDB as maxTimeMS)
  maxQueries: 20, // 3 reads (markers, rollup rows, per-day raw counts) + 4 aggregations x maxLiveDays = 19
  maxLiveDays: 4, // today + yesterday + a short lag; more means the rollup is behind
  maxConcurrent: 2, // trend requests doing database work at once, process-wide
});

class TrendBudgetError extends Error {
  constructor(reason = "budget") {
    super("Trend request exceeded its execution budget.");
    this.name = "TrendBudgetError";
    this.reason = reason;
  }
}

function createBudget({ totalMs, queryMs, maxQueries, clock = Date.now } = TREND_LIMITS) {
  const startedAt = clock();
  let used = 0;
  const remaining = () => totalMs - (clock() - startedAt);

  return {
    get queries() { return used; },
    remaining,
    // execute(maxTimeMS) starts one database operation and returns its promise.
    async run(execute) {
      if (remaining() <= 0) throw new TrendBudgetError("time");
      if (used >= maxQueries) throw new TrendBudgetError("queries");
      used += 1;
      const left = remaining();
      let timer;
      const expired = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new TrendBudgetError("time")), left);
      });
      try {
        // A late result or late failure of the abandoned operation is handled by the race itself.
        return await Promise.race([Promise.resolve().then(() => execute(Math.max(1, Math.min(queryMs, left)))), expired]);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

function createGate(max = TREND_LIMITS.maxConcurrent) {
  let active = 0;
  return {
    get active() { return active; },
    async run(work) {
      if (active >= max) throw new TrendBudgetError("busy");
      active += 1;
      try {
        return await work();
      } finally {
        active -= 1;
      }
    },
  };
}

module.exports = { TREND_LIMITS, TrendBudgetError, createBudget, createGate };
