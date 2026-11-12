// A fake clock for tests: timers only fire when the test moves time forward, so retry timing can be checked exactly.
export const settle = () => new Promise((resolve) => setImmediate(resolve));

export function createClock(start = 1_000_000) {
  let t = start;
  let nextId = 0;
  const timers = new Map();
  return {
    now: () => t,
    nowDate: () => new Date(t),
    perf: () => t,
    setTimer(fn, ms) { const id = ++nextId; timers.set(id, { at: t + ms, fn }); return id; },
    clearTimer(id) { timers.delete(id); },
    pending: () => timers.size,
    nextDelay: () => { const ats = [...timers.values()].map((x) => x.at - t); return ats.length ? Math.min(...ats) : null; },
    // Moves time forward, firing every timer that falls due on the way, in order.
    async advance(ms) {
      const end = t + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, v]) => v.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        t = Math.max(t, due[1].at);
        due[1].fn();
        await settle();
      }
      t = end;
      await settle();
    },
  };
}

// An axios-style error.
export const httpError = (status, data, headers) => Object.assign(new Error("HTTP " + status), { response: { status, data, headers } });
export const networkError = () => new Error("Network Error");
