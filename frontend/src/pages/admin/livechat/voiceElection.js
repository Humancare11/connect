// Which browser tab speaks a live chat voice alert. Pure logic (no browser APIs), unit-tested on its own.
//
// Every open admin tab hears every event. The tabs agree on ONE speaker with a short claim round: a Live Chat tab
// wins over a dashboard tab, then a tab the admin has clicked in, then a visible tab, then a random number. A single
// tab simply wins after the claim window.
export const ELECTION_WINDOW_MS = 600; // also lets the chime finish before the voice starts

const beats = (a, b) => {
  for (const key of ["lc", "activated", "visible", "random"]) if (a[key] !== b[key]) return a[key] > b[key];
  return String(a.tabId) > String(b.tabId);
};

export function createSpeakerElection({
  post = () => {},
  tabId = Math.random().toString(36).slice(2),
  random = Math.random,
  rank = () => ({ lc: 0, activated: 1, visible: 1 }), // this tab's standing, read when a round starts
  setTimer = (fn, ms) => setTimeout(fn, ms),
} = {}) {
  const claims = new Map(); // key -> claims from the other tabs
  return {
    // Starts a round for `key`; `win()` runs only in the tab that is elected.
    run(key, win) {
      const mine = { tabId, random: random(), ...rank() };
      post({ type: "lcv:claim", key, claim: mine });
      setTimer(() => {
        const others = claims.get(key) || [];
        claims.delete(key);
        if (others.every((other) => beats(mine, other))) win();
      }, ELECTION_WINDOW_MS);
    },
    handleTabMessage(message) {
      if (message?.type !== "lcv:claim" || typeof message.key !== "string" || !message.claim) return;
      if (message.claim.tabId === tabId) return;
      const list = claims.get(message.key) || [];
      list.push(message.claim);
      claims.set(message.key, list);
      if (claims.size > 300) for (const old of [...claims.keys()].slice(0, 100)) claims.delete(old);
    },
  };
}
