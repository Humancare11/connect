import { useEffect, useRef, useState } from "react";

// "Still trying" notice: the user has joined, the other person is in the call,
// but our peer connection has not reached "connected" for SLOW_CONNECT_MS.
// Purely observational - it reads status and never touches retry / recovery.

export const SLOW_CONNECT_MS = 30000;

export function createSlowConnectTracker({ delayMs = SLOW_CONNECT_MS, now = Date.now } = {}) {
  let since = null;
  return {
    // status: { joined, peerPresent, connected, suppressed } -> should the notice show
    update({ joined, peerPresent, connected, suppressed }) {
      if (!joined || !peerPresent || connected) {
        since = null;
        return false;
      }
      if (since === null) since = now();
      return !suppressed && now() - since >= delayMs;
    },
    reset() {
      since = null;
    },
  };
}

// One 1s interval per mounted call screen, cleared on unmount (leaving navigates away).
export function useSlowConnectNotice(getStatus) {
  const [visible, setVisible] = useState(false);
  const getStatusRef = useRef(getStatus);
  useEffect(() => {
    getStatusRef.current = getStatus;
  });
  useEffect(() => {
    const tracker = createSlowConnectTracker();
    const id = setInterval(() => setVisible(tracker.update(getStatusRef.current())), 1000);
    return () => {
      clearInterval(id);
      tracker.reset();
    };
  }, []);
  return visible;
}
