// Echo filter v2: stops this device's own translated voice, picked up by its own microphone, from being treated as the person's speech.
//
// A recognized sentence is flagged as suspected echo when BOTH are true:
//   1. it was heard while our own voice was playing (or within 1.5 s either side of it), and
//   2. it matches what the voice said (character trigram overlap >= 50 %), OR the recognizer was unsure of it (confidence < 0.5).
// Why trigrams: they compare the actual characters, so they work for every script. Words fail for Chinese and Japanese (no spaces) and
// for Hindi, Tamil and Arabic, where combining marks (matras, diacritics) must be KEPT; stripping them shreds the words into letters.
//
// A flagged line is never deleted: it is saved with suspectedEcho = true, hidden from the live subtitles, never sent to the other person
// as a caption and never spoken. A real reply that merely repeats the voice's sentence at another time is not flagged (rule 1).
//
// The breaker: if echo keeps happening (4 flagged lines within a minute) the translated voice for this listener is switched off, so a
// feedback loop can never run away. It does not touch the microphone or the call.
export const MATCH_AT = 0.5;
export const LOW_CONFIDENCE = 0.5;
export const OVERLAP_SLACK_MS = 1500;
export const RETAIN_MS = 60 * 1000;
const RECOGNITION_LATENCY_MS = 800; // a result arrives a little after the audio it covers
const RESULT_TAIL_MS = 300;

// The set of 3-character windows of a text, ignoring case, spaces and punctuation, keeping letters, digits and combining marks.
export function textTrigrams(text) {
  const chars = Array.from(String(text || "").normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, ""));
  const grams = new Set();
  if (chars.length < 3) { if (chars.length > 0) grams.add(chars.join("")); return grams; }
  for (let i = 0; i + 3 <= chars.length; i++) grams.add(chars.slice(i, i + 3).join(""));
  return grams;
}

// Fraction of the heard text's trigrams that also occur in the spoken text (0 to 1).
export function containment(heard, spoken) {
  const a = textTrigrams(heard);
  if (a.size === 0) return 0;
  const b = textTrigrams(spoken);
  let hit = 0;
  for (const g of a) if (b.has(g)) hit += 1;
  return hit / a.size;
}

export function createEchoFilter({ now = () => Date.now(), matchAt = MATCH_AT, lowConfidence = LOW_CONFIDENCE, slackMs = OVERLAP_SLACK_MS } = {}) {
  let voices = []; // { text, start, end|null }

  const prune = () => { const t = now(); voices = voices.filter((v) => (v.end === null ? true : t - v.end < RETAIN_MS)); };

  return {
    // Call when the translated voice starts playing / stops playing.
    voiceStarted(text) { prune(); const v = { text: String(text || ""), start: now(), end: null }; voices.push(v); return v; },
    voiceEnded(handle) { if (handle && handle.end === null) handle.end = now(); },
    // A recognized sentence: { text, confidence (0..1 or null), durationMs } -> { echo, reason, similarity }
    check({ text, confidence = null, durationMs = 0 } = {}) {
      prune();
      const t = now();
      const heardFrom = t - Math.max(0, durationMs) - RECOGNITION_LATENCY_MS;
      const heardTo = t - RESULT_TAIL_MS;
      const overlapping = voices.filter((v) => v.start - slackMs < heardTo && (v.end === null ? true : v.end + slackMs > heardFrom));
      if (overlapping.length === 0) return { echo: false, reason: null, similarity: 0 };
      const similarity = Math.max(...overlapping.map((v) => containment(text, v.text)));
      if (similarity >= matchAt) return { echo: true, reason: "match", similarity };
      if (typeof confidence === "number" && confidence < lowConfidence) return { echo: true, reason: "low_confidence", similarity };
      return { echo: false, reason: null, similarity };
    },
    reset() { voices = []; },
    activeVoices: () => voices.filter((v) => v.end === null).length,
  };
}

// Turns the translated voice off when echo keeps happening. record() returns true on the call that trips it.
export function createEchoBreaker({ threshold = 4, windowMs = 60 * 1000, now = () => Date.now(), onTrip = () => {} } = {}) {
  let stamps = [];
  let tripped = false;
  return {
    record() {
      if (tripped) return false;
      const t = now();
      stamps = stamps.filter((s) => t - s < windowMs);
      stamps.push(t);
      if (stamps.length >= threshold) { tripped = true; onTrip(); return true; }
      return false;
    },
    isTripped: () => tripped,
    reset() { tripped = false; stamps = []; },
  };
}
