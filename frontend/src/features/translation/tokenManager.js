// Keeps a valid Azure Speech token for the call.
//
//   • One token at a time, shared by the recognizer and the voice. It is NEVER fetched per sentence.
//   • Refreshed about 60 seconds before it runs out (the server says how long it has: expiresInSeconds), not on a fixed timer.
//   • Fetches are single-flight: many callers asking at once cause one request.
//   • A failed refresh is retried with backoff while the old token is still good; the call is never interrupted by it.
//   • Permanent refusals (403 not a participant, 404 feature off, 429 the per-appointment cap) stop the retrying.
import { backoffDelay, statusOf, retryAfterMs } from "./backoff.js";

export const REFRESH_BEFORE_MS = 60 * 1000;
const MIN_REFRESH_DELAY_MS = 5000;
const USABLE_MARGIN_MS = 5000; // a token with less than this left is treated as expired

const PERMANENT = new Set([400, 403, 404]);

export function createTokenManager({
  fetchToken, // async () => { token, region, expiresInSeconds }   (throws an axios-style error on failure)
  onToken = () => {},
  onPermanentFailure = () => {},
  now = () => Date.now(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
  random = Math.random,
} = {}) {
  let current = null; // { token, region, expiresAt }
  let timer = null;
  let inflight = null;
  let attempts = 0;
  let stopped = false;
  let permanentlyFailed = false;

  // `floor` keeps a normal refresh from being scheduled absurdly soon; a RETRY after a failure follows the backoff exactly.
  function schedule(delayMs, { floor = MIN_REFRESH_DELAY_MS } = {}) {
    clearTimer(timer);
    timer = null;
    if (stopped || permanentlyFailed) return;
    timer = setTimer(() => { timer = null; refresh().catch(() => {}); }, Math.max(floor, delayMs));
  }

  function refresh() {
    if (stopped) return Promise.reject(new Error("token manager stopped"));
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        const res = await fetchToken();
        const token = res && typeof res.token === "string" ? res.token : "";
        const seconds = Number(res && res.expiresInSeconds);
        if (!token || !Number.isFinite(seconds) || seconds <= 0) throw Object.assign(new Error("bad token answer"), { response: { status: 502 } });
        current = { token, region: String(res.region || ""), expiresAt: now() + seconds * 1000 };
        attempts = 0;
        schedule(seconds * 1000 - REFRESH_BEFORE_MS);
        onToken({ token: current.token, region: current.region });
        return current;
      } catch (error) {
        const status = statusOf(error);
        if (PERMANENT.has(status) || (status === 429 && error.response && error.response.data && error.response.data.code === "appointment_cap")) {
          permanentlyFailed = true;
          onPermanentFailure({ status });
        } else {
          const wait = retryAfterMs(error) ?? backoffDelay(attempts, { random });
          attempts += 1;
          schedule(wait, { floor: 0 });
        }
        throw error;
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  }

  // A token that is good for at least a few more seconds, fetching one if needed.
  async function getToken() {
    if (current && current.expiresAt - now() > USABLE_MARGIN_MS) return { token: current.token, region: current.region };
    const fresh = await refresh();
    return { token: fresh.token, region: fresh.region };
  }

  return {
    getToken,
    refresh,
    peek: () => (current ? { token: current.token, region: current.region, expiresAt: current.expiresAt } : null),
    isPermanentlyFailed: () => permanentlyFailed,
    stop() { stopped = true; clearTimer(timer); timer = null; },
  };
}
