// When to play the "new website visitor" sound. Pure logic (no browser APIs), so it is unit-tested on its own.
//
// A visitor is "new" only when ALL of these hold:
//   - the first visitor snapshot of this connection has arrived (visitors already on the site are not announced,
//     also after a reconnect),
//   - the visitor is not in the visitor list right now (page changes and heartbeats are updates, not arrivals),
//   - the visitor was not seen in the last 30 minutes (someone who briefly leaves and comes back does not chime
//     twice; kept in memory for this tab only).
// The sound then plays only in the Live Chat tab, only when the admin turned it on and the main Sound is on, and at
// most once every 10 seconds (a burst of visitors gives one note; the rest are dropped, not queued).
export const VISITOR_SOUND_MIN_GAP_MS = 10_000;
export const VISITOR_SEEN_MS = 30 * 60_000;

export function createVisitorSoundGate({ now = () => Date.now() } = {}) {
  let primed = false;
  let lastPlayedAt = -Infinity;
  const seen = new Map(); // visitorId -> last time we saw them

  const prune = (t) => {
    for (const [id, at] of seen) if (t - at > VISITOR_SEEN_MS) seen.delete(id);
  };

  return {
    // The first (or a repeated, after a reconnect) snapshot: everyone in it counts as seen, nobody is announced.
    prime(visitorIds) {
      const t = now();
      prune(t);
      visitorIds.forEach((id) => seen.set(id, t));
      primed = true;
    },
    // The connection dropped: arrivals while it was down are not announced when it comes back.
    unprime() {
      primed = false;
    },
    // A visitor delta (an "upsert"). `known` = already in the visitor list. Returns true when the sound should play.
    shouldPlay({ visitorId, known, inLiveChatTab, enabled, mainSoundOn }) {
      const t = now();
      prune(t);
      const wasSeen = seen.has(visitorId);
      seen.set(visitorId, t); // every sighting refreshes the 30 minutes
      if (!primed || known || wasSeen) return false;
      if (!inLiveChatTab || !enabled || !mainSoundOn) return false;
      if (t - lastPlayedAt < VISITOR_SOUND_MIN_GAP_MS) return false;
      lastPlayedAt = t;
      return true;
    },
  };
}
