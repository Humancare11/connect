// Runs analytics work AFTER the caller has moved on, so it can neither delay
// nor break the work that triggered it (a future search response).
//
//   const runner = createBackgroundRunner();
//   runner.run(() => recordSearchInteraction(dto));   // returns at once
//
// run() is synchronous and never throws. The task starts on a later turn of
// the event loop (setImmediate), a rejected promise or a synchronous throw is
// contained, and nothing is retried here.
//
// Limits - this is deliberately minimal, in-process fire-and-forget:
//  - Nothing is persisted: tasks still queued or running are lost if the
//    process exits, crashes or is redeployed.
//  - No retries. A failed or dropped task is gone (callers must treat
//    analytics as best-effort).
//  - The cap is per process, not global. Over `maxInFlight` pending tasks,
//    new ones are DROPPED (counted, not queued), so memory stays bounded when
//    the database is slow or down.
//  - A slot is held until the task settles. The runner does not cancel an
//    underlying database call; it relies on the driver's own timeouts, so a
//    stuck database fills the slots and later events are dropped, never
//    queued without limit.
//  - Tasks run concurrently and finish in no particular order. Correctness
//    between events of one interaction comes from the guarded upsert in the
//    recorder, not from ordering here.
//  - Synchronous CPU work inside a task still runs on the same event loop.

const DEFAULT_MAX_IN_FLIGHT = 50;

// Only the error name is logged: never a message, payload or task data.
function logFailure(err, logger) {
  const name = typeof err?.name === "string" ? err.name.slice(0, 60) : "Error";
  try {
    logger(`[search-analytics] background task failed: ${name}`);
  } catch {
    // Logging must never throw either.
  }
}

function createBackgroundRunner({ maxInFlight = DEFAULT_MAX_IN_FLIGHT, schedule = setImmediate, logger = console.error } = {}) {
  const limit = Number.isInteger(maxInFlight) && maxInFlight > 0 ? maxInFlight : DEFAULT_MAX_IN_FLIGHT;
  let inFlight = 0;
  let dropped = 0;

  // task: () => any | Promise<any>. Returns "scheduled" or "dropped".
  function run(task) {
    if (typeof task !== "function" || inFlight >= limit) {
      dropped += 1;
      return "dropped";
    }
    inFlight += 1;
    try {
      schedule(async () => {
        try {
          await task();
        } catch (err) {
          logFailure(err, logger);
        } finally {
          inFlight -= 1;
        }
      });
    } catch (err) {
      inFlight -= 1;
      dropped += 1;
      logFailure(err, logger);
      return "dropped";
    }
    return "scheduled";
  }

  return { run, stats: () => ({ inFlight, dropped, limit }) };
}

const defaultRunner = createBackgroundRunner();

module.exports = { createBackgroundRunner, runInBackground: defaultRunner.run, DEFAULT_MAX_IN_FLIGHT };
