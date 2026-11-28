// Pacing for "please restart ICE" requests to the other participant: the first
// goes at once, repeats wait 5s, then 10s, then 15s at most. Reset whenever
// something changes (connected, network back, peer rejoined) so the next
// problem is again answered immediately.
export const RESTART_REQUEST_DELAYS_MS = [5000, 10000, 15000];

export function createRestartRequestBackoff(delays = RESTART_REQUEST_DELAYS_MS) {
  let sent = 0;
  let lastSentAt = 0;
  return {
    // true if a request may be sent now (and counts it as sent).
    tryAcquire(now = Date.now()) {
      if (sent > 0 && now - lastSentAt < delays[Math.min(sent, delays.length) - 1]) return false;
      sent += 1;
      lastSentAt = now;
      return true;
    },
    reset() {
      sent = 0;
      lastSentAt = 0;
    },
  };
}
