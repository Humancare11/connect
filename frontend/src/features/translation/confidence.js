// What to do with a recognized sentence, depending on how sure the recognizer was.
//
//   normal   (confidence >= lowBelow, default 0.7)           shown live, spoken, saved
//   low      (unclearBelow <= confidence < lowBelow)         shown live in a lighter "unclear" style, spoken, saved
//   unclear  (confidence < unclearBelow, default 0.4)        saved and flagged only: NOT shown live, NOT spoken
//   unknown  (no confidence given)                           treated like normal (better to show than to hide)
//
// The same numbers are used by the server when it saves a line (TRANSCRIPT_UNCLEAR_BELOW / TRANSCRIPT_LOW_BELOW); the app gets them from
// GET /api/transcription/config so what is shown live and what is stored always agree.
export const DEFAULT_THRESHOLDS = Object.freeze({ unclearBelow: 0.4, lowBelow: 0.7 });

export function normalizeThresholds(value) {
  const u = Number(value && value.unclearBelow);
  const l = Number(value && value.lowBelow);
  return Number.isFinite(u) && Number.isFinite(l) && u > 0 && u < l && l <= 1 ? { unclearBelow: u, lowBelow: l } : { ...DEFAULT_THRESHOLDS };
}

export function confidenceTier(confidence, thresholds = DEFAULT_THRESHOLDS) {
  if (typeof confidence !== "number" || !Number.isFinite(confidence)) return "unknown";
  if (confidence < thresholds.unclearBelow) return "unclear";
  if (confidence < thresholds.lowBelow) return "low";
  return "normal";
}

export const showLive = (tier) => tier !== "unclear";
export const speakAloud = (tier) => tier !== "unclear";
export const showLighter = (tier) => tier === "low";

// The wrong-language safety net: someone listened for English (their browser said English only) but speaks something else, so the
// recognizer produces nonsense with low confidence. Looks at the last three finals; two of them below `below` means "switch to
// detection". Uses the raw confidences (not tiers) so it works the same whatever the thresholds are.
export const SAFETY_NET_WINDOW = 3;
export const SAFETY_NET_BELOW = 0.4;
export function safetyNetTriggered(recentConfidences, below = SAFETY_NET_BELOW) {
  const last = (Array.isArray(recentConfidences) ? recentConfidences : []).slice(-SAFETY_NET_WINDOW);
  if (last.length < 2) return false;
  return last.filter((c) => typeof c === "number" && c < below).length >= 2;
}
