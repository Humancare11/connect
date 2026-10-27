// One pending timer per key. Used for the "did they really leave?" grace
// period after a socket drops: scheduling a key that already has a timer
// replaces it (the clock restarts from the newest disconnect), and a rejoin
// cancels it, so a stale timer from an earlier drop can never declare a
// participant gone while they are connected, or only moments after their
// latest drop.
function createGraceTimerRegistry() {
  const timers = new Map();

  function cancel(key) {
    const timer = timers.get(key);
    if (!timer) return false;
    clearTimeout(timer);
    timers.delete(key);
    return true;
  }

  function schedule(key, delayMs, callback) {
    cancel(key);
    const timer = setTimeout(() => {
      if (timers.get(key) === timer) timers.delete(key);
      callback();
    }, delayMs);
    if (typeof timer.unref === "function") timer.unref();
    timers.set(key, timer);
  }

  return {
    schedule,
    cancel,
    has: (key) => timers.has(key),
    get size() {
      return timers.size;
    },
  };
}

module.exports = { createGraceTimerRegistry };
