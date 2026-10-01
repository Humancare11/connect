// PIN brute-force limiting for direct-call joins — two independent windows:
// per IP+room (stops one attacker guessing) and per room across ALL IPs
// (stops a distributed guess spread over many source IPs). Only WRONG PIN
// attempts count against either window — a correct PIN never does, even
// while other wrong guesses are accumulating alongside it. In-memory only,
// same trust model as the rest of server.js's per-process state —
// acceptable here since a restart also drops every live call.
const WINDOW_MS = 10 * 60 * 1000;
const PER_IP_MAX = 5;
const PER_ROOM_MAX = 20;
const buckets = new Map(); // key -> { count, firstAttemptAt }

function peek(key) {
  const entry = buckets.get(key);
  if (!entry) return 0;
  if (Date.now() - entry.firstAttemptAt >= WINDOW_MS) return 0;
  return entry.count;
}

function bump(key) {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now - entry.firstAttemptAt >= WINDOW_MS) {
    buckets.set(key, { count: 1, firstAttemptAt: now });
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

function prune() {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, entry] of buckets) {
    if (entry.firstAttemptAt < cutoff) buckets.delete(key);
  }
}
const pruneTimer = setInterval(prune, 5 * 60 * 1000);
pruneTimer.unref?.();

// Call BEFORE checking the submitted PIN — if either window is already at
// its max, reject outright without even looking at the PIN.
function isBlocked({ ip, roomId }) {
  return peek(`ip:${ip}:${roomId}`) >= PER_IP_MAX || peek(`room:${roomId}`) >= PER_ROOM_MAX;
}

// Call only when the submitted PIN was WRONG. Returns whether the per-room
// window just crossed its threshold on THIS call, so the caller can raise
// an admin alert exactly once rather than on every attempt after.
function recordWrongAttempt({ ip, roomId }) {
  bump(`ip:${ip}:${roomId}`);
  const roomCount = bump(`room:${roomId}`);
  return { roomBlockJustTripped: roomCount === PER_ROOM_MAX };
}

module.exports = { isBlocked, recordWrongAttempt, PER_IP_MAX, PER_ROOM_MAX };
