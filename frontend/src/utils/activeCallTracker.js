// Global, module-level signal for whether the video call page is currently
// mounted, so session-timeout/expiry handling (see SessionTimeoutManager in
// App.jsx) can avoid force-navigating the user away from an in-progress
// consultation. Mirrors the mobile app's ActiveCallTracker
// (connect-mobile/lib/services/active_call_tracker.dart) — a counter, not a
// boolean, so an unexpected double mount/unmount (e.g. React StrictMode's
// dev-only double-invoke) can't leave this stuck reporting "active".
let activeCount = 0;
const listeners = new Set();

function notify() {
  for (const listener of listeners) listener(activeCount);
}

export function markCallActive() {
  activeCount += 1;
  notify();
}

export function markCallInactive() {
  if (activeCount > 0) activeCount -= 1;
  notify();
}

export function isCallActive() {
  return activeCount > 0;
}

/** Subscribes to active-call changes; returns an unsubscribe function. Shaped for React's useSyncExternalStore. */
export function subscribeCallActive(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
