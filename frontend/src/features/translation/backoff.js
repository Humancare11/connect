// Exponential backoff with a little randomness, used by every retry in the live transcript feature (token, notice, upload, reconnect).
//   attempt 0 -> about 1 s, 1 -> 2 s, 2 -> 4 s ... never more than maxMs. `jitter` 0.2 = plus or minus 20 %.
export function backoffDelay(attempt, { baseMs = 1000, maxMs = 60000, jitter = 0.2, random = Math.random } = {}) {
  const n = Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 0;
  const exp = Math.min(maxMs, baseMs * 2 ** Math.min(n, 30));
  const spread = exp * jitter;
  return Math.max(0, Math.round(exp - spread + random() * 2 * spread));
}

// The HTTP status of an axios-style error (0 when there was no answer at all: offline, DNS, timeout).
export function statusOf(error) {
  const status = error && error.response && error.response.status;
  return typeof status === "number" ? status : 0;
}

// Seconds the server asked us to wait (Retry-After), or null.
export function retryAfterMs(error) {
  const header = error && error.response && error.response.headers && (error.response.headers["retry-after"] ?? error.response.headers["Retry-After"]);
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 600) * 1000 : null;
}
