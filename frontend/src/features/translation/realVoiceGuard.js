// "Only one voice is ever heard": while translation is on and the other person speaks a different language, their REAL voice is muted
// on this device and only the translated voice plays. The patient-safety rule behind it: whenever translation cannot deliver, the real
// voice is UNMUTED again at once, so the doctor never misses what the patient says.
//
// Three small parts, all plain JavaScript (tested without a browser):
//   evaluateGuard   decides: mute or not, and why not.
//   createElementMuter   sets element.muted (NOT the WebRTC track, and not volume: an iPhone ignores volume but respects muted) and puts the
//                        element back exactly as it found it.
//   createLevelMeter   how loud the other person's stream is right now, to know they are speaking (null = cannot be measured).
import { NONE, canTranscribeLanguage, getLanguage, languageBase, voiceForLanguage } from "./languages.js";

export const TICK_MS = 500;
export const STALL_MS = 8000; // the other person is speaking and nothing at all has arrived for this long
export const SPEECH_LEVEL = 0.02; // RMS of the other person's stream that counts as "speaking"
export const QUIET_GAP_MS = 1500; // this much quiet ends "a stretch of speech"
export const WAITING_HOLD_MS = 4000; // "Translating…" stays this long after the last speech, until the translated voice starts
export const UNCLEAR_HOLD_MS = 6000; // real voice stays on this long after a sentence that could not be spoken
export const VOICE_FAIL_HOLD_MS = 15000; // after the translated voice failed to play

export const TRANSLATION_UNAVAILABLE = "Translation unavailable - you are hearing the original voice";
export const TRANSLATING_TEXT = "Translating…";
export const SPEAKING_TEXT = "Speaking the translation";

// i: { readLang, peerReadLang, voiceEnabled, breakerTripped, phase, recognizerStatus, reconnecting, tokenFailed, audioState, levelAvailable,
//      stalled, voiceFailed, unclearHold }
// -> { expected, mute, reason, showMessage }
//   expected   translation is supposed to be doing the talking (both picked a language, and they differ)
//   mute       the other person's real voice should be muted
//   reason     why it is NOT muted although it was expected (null when muted or not expected)
//   showMessage  show "Translation unavailable - you are hearing the original voice"
export function evaluateGuard(i) {
  const mine = i.readLang;
  const theirs = i.peerReadLang;
  const picked = (c) => c && c !== NONE && getLanguage(c);
  const expected = Boolean(picked(mine) && picked(theirs) && languageBase(mine) !== languageBase(theirs));
  if (!expected) return { expected: false, mute: false, reason: null, showMessage: false };
  // The person switched the translated voice off themselves: they chose the real voice. Not a fault, no message.
  if (!i.voiceEnabled && !i.breakerTripped) return { expected: false, mute: false, reason: null, showMessage: false };

  const fail = (reason, showMessage = true) => ({ expected: true, mute: false, reason, showMessage });
  if (i.breakerTripped) return fail("echo_breaker");
  if (!voiceForLanguage(mine)) return fail("no_voice_for_my_language");
  if (!canTranscribeLanguage(theirs)) return fail("peer_language_not_transcribable");
  if (i.phase !== "running") return fail("engine_unavailable");
  if (i.reconnecting || i.recognizerStatus === "unavailable" || i.recognizerStatus === "reconnecting") return fail("reconnecting");
  if (i.tokenFailed) return fail("token_failed");
  if (i.audioState !== "running") return fail("audio_blocked");
  if (i.voiceFailed) return fail("voice_failed");
  if (!i.levelAvailable) return fail("cannot_measure_peer");
  if (i.stalled) return fail("no_translation_arriving");
  if (i.unclearHold) return fail("sentence_not_spoken", false); // brief and expected: no alarming message
  return { expected: true, mute: true, reason: null, showMessage: false };
}

// ---- the audio elements --------------------------------------------------------------------------------------------------------
export function createElementMuter({ getElements }) {
  const saved = new Map(); // element -> its own `muted` before we touched it
  return {
    apply(mute) {
      if (mute) {
        for (const el of getElements() || []) {
          if (!el) continue;
          try {
            if (!saved.has(el)) saved.set(el, Boolean(el.muted));
            el.muted = true;
          } catch { /* an element that cannot be muted keeps playing: the safe side */ }
        }
      } else {
        for (const [el, was] of saved) { try { el.muted = was; } catch { /* ignore */ } }
        saved.clear();
      }
    },
    isMuting: () => saved.size > 0,
  };
}

// ---- how loud is the other person ---------------------------------------------------------------------------------------------
// Taps the playing remote stream with an analyser that goes nowhere (nothing is routed to the speakers through Web Audio, so playback
// is untouched). Returns an RMS 0..1, or null when it cannot be measured: the guard then never mutes.
export function createLevelMeter({ getContext, getElements }) {
  let node = null;
  let analyser = null;
  let stream = null;
  let buf = null;
  return {
    level() {
      try {
        const ctx = getContext();
        if (!ctx || !ctx.createAnalyser || !ctx.createMediaStreamSource) return null;
        const el = (getElements() || []).find((e) => e && e.srcObject);
        const s = el && el.srcObject;
        if (!s || !s.getAudioTracks || s.getAudioTracks().length === 0) return null;
        if (s !== stream) {
          try { if (node) node.disconnect(); } catch { /* ignore */ }
          node = ctx.createMediaStreamSource(s);
          analyser = ctx.createAnalyser();
          analyser.fftSize = 1024;
          node.connect(analyser);
          buf = new Float32Array(analyser.fftSize);
          stream = s;
        }
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let k = 0; k < buf.length; k++) sum += buf[k] * buf[k];
        return Math.sqrt(sum / buf.length);
      } catch { return null; }
    },
    release() { try { if (node) node.disconnect(); } catch { /* ignore */ } node = null; analyser = null; stream = null; },
  };
}
