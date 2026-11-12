// Tells the server that this person was shown "This call is being transcribed" (POST /api/appointments/:id/transcript-notice).
//
// This record is part of our proof, so it must not be lost to a network blip:
//   • it retries with exponential backoff (and obeys Retry-After) until it works;
//   • it STOPS on a permanent answer: 403 (not part of this booking), 404 (the feature is off or the booking is unknown), 400, or a 401
//     that survived the app's own session refresh, because retrying cannot change those;
//   • a page reload starts it again (the server keeps the first time: repeating is harmless);
//   • clientShownAt is the browser's own claim of when the notice appeared, sent as information only (the server decides the real time).
import { backoffDelay, statusOf, retryAfterMs } from "./backoff.js";

const PERMANENT = new Set([400, 401, 403, 404]);

export function createNoticeSender({
  post, // async (body) => response with .data = { recorded, bothShown, ... }
  version = "v1",
  now = () => new Date(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
  random = Math.random,
  onRecorded = () => {},
  onStopped = () => {},
} = {}) {
  let state = "idle"; // idle | sending | done | stopped
  let timer = null;
  let attempts = 0;
  let shownAt = null;

  async function attempt() {
    timer = null;
    if (state !== "sending") return;
    try {
      const res = await post({ version, clientShownAt: shownAt.toISOString() });
      if (state !== "sending") return;
      state = "done";
      onRecorded((res && res.data) || {});
    } catch (error) {
      if (state !== "sending") return;
      const status = statusOf(error);
      if (PERMANENT.has(status)) {
        state = "stopped";
        onStopped({ status });
        return;
      }
      const wait = retryAfterMs(error) ?? backoffDelay(attempts, { random });
      attempts += 1;
      timer = setTimer(attempt, wait);
    }
  }

  return {
    // Call at the moment the notice appears on screen.
    start() {
      if (state !== "idle") return;
      shownAt = now();
      state = "sending";
      attempt();
    },
    stop() { if (state === "sending") state = "idle"; clearTimer(timer); timer = null; },
    state: () => state,
    attempts: () => attempts,
  };
}
