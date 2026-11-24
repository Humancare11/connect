// Spoken alerts for live chat admins, in addition to the chime. Pure gating (no browser APIs) so it is unit-tested on
// its own; `speakPhrase` is the only part that touches speechSynthesis.
//
//   "New visitor"                     a new website visitor arrived
//   "New chat form submitted"         a visitor submitted the live chat contact form
//   "AI chat started"                 a visitor's chat with the AI started
//   "Patient wants a live agent"      a chat entered the Queue ("Talk to live agent", an AI handoff, or a return)
//
// The voice is ALWAYS on: there is no Sound / Voice switch. It plays on every admin page (the hub decides which one
// browser tab speaks). It only waits for the admin's first click on the page (autoplay rule, same unlock as the chime).
//
// One utterance at a time, with a small gap. The form, AI chat and live agent alerts are queued (at most MAX_QUEUE
// waiting) so none is lost; "New visitor" is dropped while anything is speaking or waiting, and at most one every
// 10 seconds. A live agent alert replaces a "New visitor" that is still speaking. The same alert for the same chat or
// visitor is not repeated within a minute.
export const VOICE_VISITOR_MIN_GAP_MS = 10_000;
export const VOICE_MAX_SPEAK_MS = 6_000; // a safety net when the browser never reports the end of an utterance
export const VOICE_GAP_MS = 1_200;
export const VOICE_REPEAT_MS = 60_000;
export const VOICE_MAX_QUEUE = 5;
export const VOICE_PHRASES = {
  visitor: "New visitor",
  form: "New chat form submitted",
  ai: "AI chat started",
  queue: "Patient wants a live agent",
};

export function createVoiceGate({
  now = () => Date.now(),
  speak = (text, options) => speakPhrase(text, options),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
} = {}) {
  let current = null; // { id, kind } while an utterance is speaking
  let seq = 0;
  let lastEnd = -Infinity;
  let lastVisitorAt = -Infinity;
  let pumpTimer = null;
  let safetyTimer = null;
  const queue = [];
  const recent = new Map(); // "kind:key" -> when it was accepted

  function finish(id) {
    if (!current || current.id !== id) return; // an utterance that was replaced reports its end late: ignore it
    clearTimer(safetyTimer);
    current = null;
    lastEnd = now();
    pump();
  }

  function start(kind, interrupt) {
    clearTimer(safetyTimer);
    const id = ++seq;
    current = { id, kind };
    safetyTimer = setTimer(() => finish(id), VOICE_MAX_SPEAK_MS);
    let started = false;
    try {
      started = speak(VOICE_PHRASES[kind], { interrupt, onEnd: () => finish(id) }) !== false;
    } catch {
      started = false;
    }
    if (!started) finish(id);
  }

  function pump() {
    clearTimer(pumpTimer);
    pumpTimer = null;
    if (current || !queue.length) return;
    const wait = lastEnd + VOICE_GAP_MS - now();
    if (wait > 0) {
      pumpTimer = setTimer(pump, wait);
      return;
    }
    start(queue.shift(), false);
  }

  return {
    // -> "spoken" | "queued" | "dropped"
    request({ kind, key = "", unlocked }) {
      if (!VOICE_PHRASES[kind] || !unlocked) return "dropped";
      const t = now();
      for (const [k, at] of recent) if (t - at > VOICE_REPEAT_MS) recent.delete(k);
      const repeatKey = `${kind}:${key}`;
      if (key && recent.has(repeatKey)) return "dropped";

      if (kind === "visitor") {
        if (current || queue.length) return "dropped"; // a visitor never waits and never interrupts
        if (t - lastVisitorAt < VOICE_VISITOR_MIN_GAP_MS) return "dropped";
        lastVisitorAt = t;
        if (key) recent.set(repeatKey, t);
        queue.push(kind);
        pump();
        return current ? "spoken" : "queued";
      }
      if (kind === "queue" && current?.kind === "visitor") {
        if (key) recent.set(repeatKey, t);
        start(kind, true); // replaces the "New visitor" that is still speaking
        return "spoken";
      }
      if (queue.length >= VOICE_MAX_QUEUE) return "dropped";
      if (key) recent.set(repeatKey, t);
      queue.push(kind);
      pump();
      return current ? "spoken" : "queued";
    },
    _state: () => ({ speaking: current?.kind || "", queued: queue.length }),
  };
}

// Speaks `text` with an English voice at volume 1.0 and rate 1.0. Returns false when speech is not available.
export function speakPhrase(text, { interrupt = false, onEnd = () => {}, synth, Utterance } = {}) {
  try {
    const engine = synth || (typeof window !== "undefined" ? window.speechSynthesis : null);
    const Make = Utterance || (typeof window !== "undefined" ? window.SpeechSynthesisUtterance : null);
    if (!engine || !Make) return false;
    if (interrupt) engine.cancel();
    const utterance = new Make(text);
    utterance.lang = "en-US";
    utterance.volume = 1;
    utterance.rate = 1;
    const voice = (engine.getVoices?.() || []).find((v) => /^en([-_]|$)/i.test(v.lang || ""));
    if (voice) utterance.voice = voice;
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
    engine.speak(utterance);
    return true;
  } catch {
    return false;
  }
}
