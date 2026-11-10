// The patient widget's notification sound.
//
//  - A short chime made with Web Audio (no audio file, so nothing to host or to allow in a CSP).
//  - Browsers only allow sound after the patient has interacted with the page, so the audio context is created on
//    the first click, tap or key press. Until then the chime is silently skipped.
//  - Plays for a reply from the AI, a message from an agent, and the "agent joined" / "Chat resolved" lines only.
//    Never for the patient's own messages, never for chat history, never while muted.
//  - A burst of replies gives one chime (CHIME_MIN_GAP_MS), and when several tabs of the site are open only one of
//    them plays (a best-effort claim in localStorage, keyed by the message).
//  The pure parts (what chimes, the gate, the claim) take their dependencies as arguments so they are unit-tested.
export const WIDGET_SOUND_KEY = "hcLiveChatWidgetSound"; // "off" = muted; anything else = on (NOT the admin's key)
export const CHIME_MIN_GAP_MS = 1500;
export const CLAIM_KEY = "hcLiveChatChimeClaim";
export const CLAIM_MS = 4000;

const JOINED_LINE = /\bjoined the chat$/i;
const RESOLVED_LINE = /^chat resolved$/i;

// Which messages deserve a sound.
export function isChimeMessage(message) {
  if (!message) return false;
  if (message.sender === "ai" || message.sender === "agent") return true;
  if (message.sender === "system") {
    const text = String(message.text || "").trim();
    return JOINED_LINE.test(text) || RESOLVED_LINE.test(text);
  }
  return false;
}

// At most one chime every `minGapMs`; a dropped chime is not queued.
export function createChimeGate({ now = () => Date.now(), minGapMs = CHIME_MIN_GAP_MS } = {}) {
  let last = -Infinity;
  return {
    allow() {
      const t = now();
      if (t - last < minGapMs) return false;
      last = t;
      return true;
    },
  };
}

// True when this tab may play the chime for `id`. Another tab that already claimed the same id a moment ago wins.
// Best effort: storage can be unavailable (then every tab plays) and two tabs can still race (rarely both play).
export function claimChime(id, { storage, now = () => Date.now() } = {}) {
  let area = storage;
  try {
    area ||= window.localStorage;
  } catch {
    return true;
  }
  try {
    const t = now();
    const raw = area.getItem(CLAIM_KEY) || "";
    const at = raw.lastIndexOf("|");
    if (at > 0 && raw.slice(0, at) === String(id) && t - Number(raw.slice(at + 1)) < CLAIM_MS) return false;
    const mine = `${id}|${t}`;
    area.setItem(CLAIM_KEY, mine);
    return area.getItem(CLAIM_KEY) === mine;
  } catch {
    return true;
  }
}

export function readSoundOn() {
  try {
    return localStorage.getItem(WIDGET_SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}
export function writeSoundOn(on) {
  try {
    localStorage.setItem(WIDGET_SOUND_KEY, on ? "on" : "off");
  } catch {
    /* optional */
  }
}

let audio = null;
let installed = false;

// Creates the audio context on the first real gesture (autoplay rules). Safe to call many times.
export function installChimeUnlock() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const events = ["pointerdown", "keydown", "touchend"];
  const unlock = () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx && !audio) audio = new Ctx();
      const resumed = audio?.resume?.();
      // Only stop listening once the context really runs, so a failed first attempt gets another chance.
      if (audio && audio.state === "running") events.forEach((name) => window.removeEventListener(name, unlock, true));
      else resumed?.then?.(() => audio.state === "running" && events.forEach((name) => window.removeEventListener(name, unlock, true))).catch?.(() => {});
    } catch {
      /* no sound on this browser */
    }
  };
  events.forEach((name) => window.addEventListener(name, unlock, true));
}

// Two soft notes. Silent when the page was never interacted with or audio is unavailable.
export function playWidgetChime() {
  if (!audio || audio.state !== "running") return false;
  try {
    const start = audio.currentTime;
    [784, 988].forEach((freq, i) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = start + i * 0.12;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.1, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      osc.connect(gain).connect(audio.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
    return true;
  } catch {
    return false;
  }
}
