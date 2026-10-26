// Tracks which participants of a room currently have a dropped socket, as a
// SET per room. A single "who is down" slot per room (the previous design)
// was overwritten when the second participant dropped too, so the first one's
// rejoin never produced a "peer is back" signal.
function createPresenceDownTracker() {
  const downByRoom = new Map(); // roomId -> Set<userId>

  const key = (v) => String(v);

  return {
    markDown(roomId, userId) {
      const r = key(roomId);
      let set = downByRoom.get(r);
      if (!set) {
        set = new Set();
        downByRoom.set(r, set);
      }
      set.add(key(userId));
    },
    // Returns true if this user was marked down (and clears them).
    clearDown(roomId, userId) {
      const r = key(roomId);
      const set = downByRoom.get(r);
      if (!set || !set.delete(key(userId))) return false;
      if (set.size === 0) downByRoom.delete(r);
      return true;
    },
    isDown(roomId, userId) {
      return downByRoom.get(key(roomId))?.has(key(userId)) || false;
    },
    get size() {
      return downByRoom.size;
    },
  };
}

module.exports = { createPresenceDownTracker };
