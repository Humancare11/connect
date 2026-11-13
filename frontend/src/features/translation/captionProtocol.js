// The live caption conversation between the two browsers of a call, over the call's Socket.IO connection.
//
//   SPEAKER side  (createCaptionSender):   my recognizer's partials and finals -> `caption` events to the other person, already translated
//                                          into the languages the other person needs (tr: { en: "...", de: "..." }).
//   LISTENER side (createLangAnnouncer):   "I now read <lang>" -> `lang-changed`, re-sent whenever the other person (re)joins or the socket
//                                          reconnects, because the server remembers nothing.
//   LISTENER side (createCaptionReceiver): an incoming caption -> subtitle / voice / doctor hint, according to MY language and the
//                                          confidence rules.
//
// Nothing here logs and nothing is stored: captions only pass through.
import { confidenceTier, showLive, speakAloud, showLighter, DEFAULT_THRESHOLDS } from "./confidence.js";
import { languageBase, languageForLocale } from "./languages.js";

export const PARTIAL_INTERVAL_MS = 250;
const HINT_COOLDOWN_MS = 10 * 60 * 1000;

// ------------------------------------------------------------------------------------------------------------------ sending captions
export function createCaptionSender({ send, nowPerf = () => (typeof performance !== "undefined" ? performance.now() : Date.now()), setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (id) => clearTimeout(id), minPartialIntervalMs = PARTIAL_INTERVAL_MS, prefix = "c" } = {}) {
  let seq = 0;
  let lastPartialAt = -Infinity;
  let lastPartialKey = "";
  let pending = null; // the newest partial that arrived too soon
  let timer = null;

  const idFor = () => `${prefix}-${seq}`;
  const keyOf = (p) => `${p.text}\u0001${JSON.stringify(p.tr || {})}`;

  function emitPartial(p) {
    const key = keyOf(p);
    if (key === lastPartialKey) return;
    lastPartialKey = key;
    lastPartialAt = nowPerf();
    send({ id: idFor(), final: false, text: p.text, srcLang: p.srcLang || "", conf: null, tr: p.tr || {} });
  }

  return {
    // Growing text of the sentence being spoken. Sent at most ~4 times a second; only the newest waiting one is kept.
    partial(p) {
      if (!p || !p.text) return;
      const wait = lastPartialAt + minPartialIntervalMs - nowPerf();
      if (wait <= 0 && timer === null) { emitPartial(p); return; }
      pending = p;
      if (timer === null) timer = setTimer(() => { timer = null; const next = pending; pending = null; if (next) emitPartial(next); }, Math.max(1, wait));
    },
    // The finished sentence: always sent, and it ends the sentence id.
    final(f) {
      clearTimer(timer); timer = null; pending = null;
      if (!f || !f.text) return null;
      const id = idFor();
      send({ id, final: true, text: f.text, srcLang: f.srcLang || "", conf: typeof f.confidence === "number" ? f.confidence : null, tr: f.tr || {} });
      seq += 1;
      lastPartialKey = "";
      lastPartialAt = -Infinity;
      return id;
    },
    // A new sentence started without a final (the recognizer was restarted): move on to a fresh id.
    abandon() { clearTimer(timer); timer = null; pending = null; seq += 1; lastPartialKey = ""; },
    stop() { clearTimer(timer); timer = null; pending = null; },
  };
}

// ------------------------------------------------------------------------------------------------------------------ announcing my language
export function createLangAnnouncer({ send } = {}) {
  let last = null;
  return {
    announce(lang) { last = lang; send({ lang }); },
    // The other person just joined, or my socket reconnected: they cannot know my language unless I say it again.
    resend() { if (last !== null) send({ lang: last }); },
    current: () => last,
  };
}

// ------------------------------------------------------------------------------------------------------------------ receiving captions
// Matches a translation key from the speaker ("de", "zh-hans", "fr-ca") with my language code ("de", "zh-Hans", "fr-ca").
const sameCode = (a, b) => String(a || "").toLowerCase() === String(b || "").toLowerCase();
const translationFor = (tr, lang) => {
  if (!tr || typeof tr !== "object") return "";
  const key = Object.keys(tr).find((k) => sameCode(k, lang));
  return key ? String(tr[key] || "") : "";
};

export function createCaptionReceiver({
  role, // "doctor" | "patient": only a doctor gets the language hint
  getMyLang, // () => "none" | language code (what I read / hear)
  getMyBaseLanguage = () => "", // my own language for the hint when I read "none" (e.g. from my browser): "en"
  getThresholds = () => DEFAULT_THRESHOLDS,
  isVoiceOn = () => true,
  onTranscript = () => {}, // every caption, for the live transcript panel
  onSubtitle = () => {},
  onVoice = () => {},
  onHint = () => {},
  onUnspoken = () => {}, // a finished sentence of the other person that will NOT be spoken here (unclear, or no translation for me)
  now = () => Date.now(),
} = {}) {
  const hintShownAt = new Map(); // language base -> time

  return {
    handle(caption) {
      if (!caption || typeof caption.text !== "string") return;
      const tier = confidenceTier(typeof caption.conf === "number" ? caption.conf : null, getThresholds());
      const entry = { id: caption.id, from: caption.from, final: Boolean(caption.final), text: caption.text, tr: caption.tr || {}, srcLang: caption.srcLang || "", conf: typeof caption.conf === "number" ? caption.conf : null, tier, at: caption.at };
      onTranscript(entry);

      const myLang = getMyLang();

      // The doctor's hint: the patient speaks a language other than the doctor's, and the doctor has translation off ("Real voice").
      if (role === "doctor" && caption.from === "patient" && entry.final && tier !== "unclear" && (myLang === "none" || !myLang)) {
        const spoken = languageBase(entry.srcLang);
        const mine = languageBase(getMyBaseLanguage());
        const last = hintShownAt.get(spoken);
        if (spoken && mine && spoken !== mine && (last === undefined || now() - last > HINT_COOLDOWN_MS)) {
          hintShownAt.set(spoken, now());
          const language = languageForLocale(entry.srcLang);
          onHint({ srcLang: entry.srcLang, code: language ? language.code : spoken, name: language ? language.name : entry.srcLang });
        }
      }

      if (!myLang || myLang === "none") return; // Real voice: no subtitles, no translated voice
      const text = translationFor(entry.tr, myLang);
      if (!text || !showLive(tier)) { // unclear: saved by the speaker, but not shown and not spoken
        if (entry.final) onUnspoken(entry);
        return;
      }
      onSubtitle({ id: entry.id, text, final: entry.final, lighter: showLighter(tier), from: entry.from });
      if (entry.final && speakAloud(tier) && isVoiceOn() && languageBase(entry.srcLang) !== languageBase(myLang)) {
        onVoice({ id: entry.id, text, lang: myLang });
      }
    },
  };
}
