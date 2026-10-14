// Schedules the daily search-analytics rollup: once at startup, then hourly.
//
//  - Runs only while SEARCH_ANALYTICS_ENABLED=true (checked on every tick), so
//    with analytics off - the default - this job reads and writes nothing.
//  - Never throws, never blocks startup (the first run is deferred to a later
//    turn of the event loop) and never overlaps itself within a process.
//  - Timers are unref()'d: they never keep the process alive.
//  - Failures are contained and logged as a fixed message with an error NAME.
//    Several instances may run it at once; the rollup is idempotent, so that
//    only duplicates work.

const { runRollup } = require("../services/searchAnalytics/rollup");
const { isSearchAnalyticsEnabled } = require("../services/searchAnalytics/searchEvents");

const HOUR_MS = 60 * 60 * 1000;

function createSearchAnalyticsJob({
  isEnabled = isSearchAnalyticsEnabled,
  run = runRollup,
  logger = console.error,
  setTimer = setTimeout,
  setRepeating = setInterval,
  intervalMs = HOUR_MS,
} = {}) {
  let running = false;

  // Resolves to "disabled", "busy", "done" or "error"; never rejects.
  async function tick() {
    try {
      if (isEnabled() !== true) return "disabled";
    } catch {
      return "disabled";
    }
    if (running) return "busy";
    running = true;
    try {
      await run();
      return "done";
    } catch (err) {
      try {
        logger(`[search-analytics] rollup job failed: ${typeof err?.name === "string" ? err.name.slice(0, 60) : "Error"}`);
      } catch {
        // Logging must never throw either.
      }
      return "error";
    } finally {
      running = false;
    }
  }

  // Starts the startup run and the hourly timer. Never throws.
  function start() {
    try {
      const first = setTimer(() => { tick(); }, 0);
      const repeating = setRepeating(() => { tick(); }, intervalMs);
      for (const handle of [first, repeating]) if (handle && typeof handle.unref === "function") handle.unref();
      return { first, repeating };
    } catch {
      return null;
    }
  }

  return { tick, start };
}

const job = createSearchAnalyticsJob();

// Called once from server.js after the database connection is up.
function scheduleSearchAnalyticsRollup() {
  return job.start();
}

module.exports = { scheduleSearchAnalyticsRollup, createSearchAnalyticsJob };
