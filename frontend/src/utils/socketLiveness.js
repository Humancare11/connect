// Liveness probe for the shared Socket.IO connection.
//
// After a tab is restored, a laptop wakes, or the network changes, `socket.connected`
// can still read true for a long time (until the next missed ping) even though the
// server dropped this socket and forgot its room. Round-trip an ack to find out.

export const SOCKET_PROBE_TIMEOUT_MS = 3000;

export function probeSocketAlive(socket, timeoutMs = SOCKET_PROBE_TIMEOUT_MS) {
  return new Promise((resolve) => {
    if (!socket || !socket.connected) {
      resolve(false);
      return;
    }
    try {
      socket.timeout(timeoutMs).emit("hc-ping", {}, (err) => resolve(!err));
    } catch {
      resolve(false);
    }
  });
}

// Returns true if the socket is healthy. Otherwise forces a fresh connection
// (the "connect" handlers re-join the room) and returns false.
export async function ensureSocketAlive(socket, { onDead } = {}) {
  if (!socket.connected) {
    socket.connect();
    return false;
  }
  if (await probeSocketAlive(socket)) return true;
  try {
    onDead?.();
  } finally {
    socket.disconnect();
    socket.connect();
  }
  return false;
}
