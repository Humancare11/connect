// "New patient registered" voice alert for admins. Pure logic (no browser APIs, no React), so it is unit-tested on its
// own; useAdminRegistrationVoice.js wires it to the socket, the other tabs and speechSynthesis.
//
// Rules:
//   - It does NOT look at the live chat Sound / Voice switches: the alert always speaks (the browser's own rule that
//     speech needs one click on the page still applies).
//   - Once per patient per admin: every open tab hears the event, the tabs agree on ONE speaker through a short
//     claim round (a tab the admin has clicked in and is looking at wins; a random number settles a tie).
//   - One voice at a time with a small gap; a burst of signups is queued (at most MAX_QUEUE waiting), never overlapped.
export const REGISTRATION_PHRASE = "New patient registered";
export const CLAIM_WINDOW_MS = 300;
export const VOICE_GAP_MS = 1500;
export const MAX_QUEUE = 5;
export const MAX_SPEAK_MS = 6000; // a safety net when the browser never reports the end of an utterance
const SEEN_CAP = 300;

// Higher wins: a tab that has had a click, then a visible tab, then the random number, then the tab id.
const beats = (a, b) => {
  for (const key of ["activated", "visible", "random"]) if (a[key] !== b[key]) return a[key] > b[key];
  return String(a.tabId) > String(b.tabId);
};

export function createRegistrationVoice({
  speak, // (text, { onEnd }) => boolean; false when speech is not available
  post = () => {}, // share a message with the other tabs
  tabId = Math.random().toString(36).slice(2),
  random = Math.random,
  isVisible = () => true,
  isActivated = () => true,
  now = () => Date.now(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
} = {}) {
  const seen = new Set(); // patient ids this tab already handled
  const claims = new Map(); // patient id -> claims from the other tabs
  const queue = [];
  let speaking = false;
  let lastEnd = -Infinity;
  let pumpTimer = null;
  let safetyTimer = null;

  const remember = (id) => {
    seen.add(id);
    if (seen.size > SEEN_CAP) for (const old of [...seen].slice(0, SEEN_CAP / 3)) seen.delete(old);
    if (claims.size > SEEN_CAP) for (const old of [...claims.keys()].slice(0, SEEN_CAP / 3)) claims.delete(old);
  };

  function pump() {
    clearTimer(pumpTimer);
    pumpTimer = null;
    if (speaking || !queue.length) return;
    const wait = lastEnd + VOICE_GAP_MS - now();
    if (wait > 0) {
      pumpTimer = setTimer(pump, wait);
      return;
    }
    queue.shift();
    speaking = true;
    let ended = false;
    const finish = () => {
      if (ended) return;
      ended = true;
      clearTimer(safetyTimer);
      speaking = false;
      lastEnd = now();
      pump();
    };
    safetyTimer = setTimer(finish, MAX_SPEAK_MS);
    let started = false;
    try {
      started = speak(REGISTRATION_PHRASE, { onEnd: finish }) !== false;
    } catch {
      started = false;
    }
    if (!started) finish();
  }

  function speakFor(id) {
    if (queue.length >= MAX_QUEUE) return;
    queue.push(id);
    pump();
  }

  return {
    // The server said a patient registered. Returns false when this tab already handled that patient.
    handleEvent(payload) {
      const id = typeof payload?.id === "string" ? payload.id : "";
      if (!id || seen.has(id)) return false;
      remember(id);
      const mine = { tabId, activated: isActivated() ? 1 : 0, visible: isVisible() ? 1 : 0, random: random() };
      post({ type: "reg:claim", id, claim: mine });
      // Wait for the other tabs' claims, then speak only if this tab is the best one.
      setTimer(() => {
        const others = claims.get(id) || [];
        claims.delete(id);
        if (others.every((other) => beats(mine, other))) speakFor(id);
      }, CLAIM_WINDOW_MS);
      return true;
    },
    // A message from another tab (claims may arrive before this tab's own copy of the event).
    handleTabMessage(message) {
      if (message?.type !== "reg:claim" || typeof message.id !== "string" || !message.claim) return;
      if (message.claim.tabId === tabId) return;
      const list = claims.get(message.id) || [];
      list.push(message.claim);
      claims.set(message.id, list);
    },
    _state: () => ({ queued: queue.length, speaking }),
  };
}
