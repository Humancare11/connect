// Lightweight per-socket, fixed-window rate limiter for Socket.IO event
// handlers. Express-layer rate limiting (middleware/rateLimiters.js) never
// covers this: WebSocket events bypass Express middleware entirely, so
// video-offer/answer/ice-candidate, chat messages, and telemetry were
// previously unthrottled — a buggy or malicious client could flood them,
// and appointment-message additionally triggers a DB write per call.
//
// State is in-process, same as onlineUsers/socketRooms/directRoomSockets
// elsewhere in server.js — if this backend ever scales horizontally, this
// needs to move to a shared store (Redis) same as those.
function makeSocketLimiter({ windowMs, max }) {
  const hits = new Map(); // socketId -> { count, resetAt }

  function allow(socketId) {
    const now = Date.now();
    const entry = hits.get(socketId);
    if (!entry || now > entry.resetAt) {
      hits.set(socketId, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (entry.count >= max) return false;
    entry.count += 1;
    return true;
  }

  // Call on socket disconnect so `hits` doesn't grow forever across the
  // server's lifetime as sockets come and go.
  function dispose(socketId) {
    hits.delete(socketId);
  }

  return { allow, dispose };
}

module.exports = { makeSocketLimiter };
