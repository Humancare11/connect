// Peer-to-peer (or relayed) media does not depend on signaling. When the server
// gives up on a peer's SIGNALING ("participant-left", grace_expired) but our
// connection to them still works, the call is held instead of closed, and only
// ended once nothing has arrived for a while.

// A resumed call that is merely "disconnected" gets this long to recover by ICE
// restart before the connection is rebuilt.
export const RESTART_BEFORE_REBUILD_MS = 12000;
export const HELD_CALL_CHECK_MS = 2000;
export const HELD_CALL_SILENCE_MS = 10000;

// Has the restart really worked? Prefer connectionState: ICE alone can read
// "connected" while the secure transport has failed (a peer that reloaded),
// and then only a rebuild helps.
export const restartRecovered = (pc) =>
  pc.connectionState
    ? pc.connectionState === "connected"
    : pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed";

export const shouldHoldCall = ({ enabled, reason, connected }) =>
  Boolean(enabled && reason === "grace_expired" && connected);

// update() -> "keep" | "end". Errs towards keeping: if the browser cannot say
// how many bytes arrived, a connected state is enough.
export function createHeldCallWatch(startedAt, silenceMs = HELD_CALL_SILENCE_MS) {
  let lastBytes = null;
  let lastFlowAt = startedAt;
  return {
    update(now, { connected, bytes }) {
      const known = typeof bytes === "number";
      if (connected && (!known || lastBytes === null || bytes > lastBytes)) lastFlowAt = now;
      if (known) lastBytes = bytes;
      return now - lastFlowAt >= silenceMs ? "end" : "keep";
    },
  };
}
