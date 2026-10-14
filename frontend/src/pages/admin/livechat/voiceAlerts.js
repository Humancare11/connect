// Spoken alerts for live chat admins, in addition to the chime. Pure gating (no browser APIs) so it is unit-tested on
// its own; `speakPhrase` is the only part that touches speechSynthesis.
//
//   "New visitor"                     a new website visitor arrived (also needs the Visitor sound toggle)
//   "Patient wants a live agent"      a chat entered the Queue ("Talk to live agent", an AI handoff, or a return)
//
// Rules: only in the Live Chat tab, only when the main Sound is on and Voice alerts are on (default ON), only after
// the admin has clicked the page (autoplay rule, same unlock as the chime). One utterance at a time: while one is
// speaking a new request is dropped, except that a Queue alert replaces a "New visitor" one. At most one
// "New visitor" every 10 seconds.
export const VOICE_VISITOR_MIN_GAP_MS = 10_000;
export const VOICE_MAX_SPEAK_MS = 6_000; // a safety net when the browser never reports the end of an utterance
export const VOICE_PHRASES = { visitor: "New visitor", queue: "Patient wants a live agent" };

export function createVoiceGate({ now = () => Date.now() } = {}) {
  let speakingKind = "";
  let speakingSince = -Infinity;
  let lastVisitorAt = -Infinity;

  const busy = (t) => speakingKind !== "" && t - speakingSince < VOICE_MAX_SPEAK_MS;

  return {
    // -> { speak, interrupt, text }
    decide({ kind, inLiveChatTab, voiceOn, mainSoundOn, visitorSoundOn, unlocked }) {
      const no = { speak: false, interrupt: false, text: "" };
      const text = VOICE_PHRASES[kind];
      if (!text) return no;
      if (!inLiveChatTab || !voiceOn || !mainSoundOn || !unlocked) return no;
      if (kind === "visitor" && !visitorSoundOn) return no;
      const t = now();
      const isBusy = busy(t);
      if (kind === "visitor") {
        if (isBusy) return no;
        if (t - lastVisitorAt < VOICE_VISITOR_MIN_GAP_MS) return no;
        lastVisitorAt = t;
        speakingKind = "visitor";
        speakingSince = t;
        return { speak: true, interrupt: false, text };
      }
      // queue
      if (isBusy && speakingKind === "queue") return no; // the same alert is already being spoken
      const interrupt = isBusy; // replaces a "New visitor" that is still speaking
      speakingKind = "queue";
      speakingSince = t;
      return { speak: true, interrupt, text };
    },
    // The utterance ended (or failed).
    finished() {
      speakingKind = "";
    },
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
