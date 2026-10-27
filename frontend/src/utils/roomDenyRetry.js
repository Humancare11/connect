// Shared policy for reacting to a refused room join ("room-access-denied" on
// the appointment call, "direct-room-error" on the guest call).
//
// Only a refusal that cannot change by waiting ends the call. Everything else
// (expired token, server/DB error, a full room while the user's own stale
// socket is still being evicted, or a reason this client doesn't know) is
// retried with exponential backoff while the local camera/mic stay live.

export const TERMINAL_DENY_REASONS = new Set([
  "appointment_ended",
  "not_participant",
  "appointment_not_found",
]);

// Direct (guest) rooms use `code` instead of `reason`. Only "full" and
// "server_error" can resolve on their own there; invalid/not_found/expired/
// closed are final.
export const RETRYABLE_DIRECT_CODES = new Set(["full", "server_error"]);

// 1s + 2s + 4s + 8s + 15s = 30s total before the Retry button is shown.
export const JOIN_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 15000];

export const isTerminalDenyReason = (reason) => TERMINAL_DENY_REASONS.has(reason);

export const isRetryableDirectCode = (code) => RETRYABLE_DIRECT_CODES.has(code);

// Delay before retry number `attempt` (0-based), or null once exhausted.
export const nextJoinRetryDelay = (attempt) =>
  attempt >= 0 && attempt < JOIN_RETRY_DELAYS_MS.length
    ? JOIN_RETRY_DELAYS_MS[attempt]
    : null;
