// The LISTENER's choice alone decides: the speaker does not have to pick a language.
//   speaker picked nothing + listener picked a language  -> real voice muted for sentences in another language, translated voice + subtitle
//   speaker speaks the listener's language               -> real voice plays, nothing is translated or muted
//   language switch in the middle of the call            -> the very next sentence follows the new language
// Run: node --test tests/transcriptionListenerOnly.test.mjs (from frontend/)
import test from "node:test";
import assert from "node:assert/strict";
import { createTranscriptionEngine } from "../src/features/translation/engine.js";
import { evaluateGuard } from "../src/features/translation/realVoiceGuard.js";
import { createCaptionReceiver } from "../src/features/translation/captionProtocol.js";
import { createClock, settle, httpError } from "./helpers/fakeClock.mjs";
import { createFakeSdk } from "./helpers/fakeSdk.mjs";

const APPT = "64b7f0c2a1b2c3d4e5f60718";

function fakeSocket() {
  const handlers = new Map();
  return {
    emitted: [],
    emit(e, p) { this.emitted.push([e, p]); },
    on(e, fn) { (handlers.get(e) || handlers.set(e, new Set()).get(e)).add(fn); },
    off(e, fn) { handlers.get(e)?.delete(fn); },
    receive(e, p) { [...(handlers.get(e) || [])].forEach((fn) => fn(p)); },
  };
}
function fakeAudio() {
  const ctx = {
    sampleRate: 48000, state: "running", destination: {}, bufferSources: [],
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; },
    createScriptProcessor() { ctx.proc = { onaudioprocess: null, connect() {}, disconnect() {} }; return ctx.proc; },
    resume() { return Promise.resolve(); }, addEventListener() {}, removeEventListener() {},
    decodeAudioData: async () => ({ duration: 1 }),
    createBufferSource() { const s = { onended: null, connect() {}, start() {}, stop() { if (s.onended) s.onended(); }, finish() { if (s.onended) s.onended(); } }; ctx.bufferSources.push(s); return s; },
  };
  return ctx;
}
// Like an iPhone: `volume` is ignored, `muted` is respected.
const iosElement = (muted = false) => { let m = muted; return { get volume() { return 1; }, set volume(_) {}, get muted() { return m; }, set muted(v) { m = v; } }; };

// `role` is THIS device's person. The other person's captions arrive through the fake socket.
async function running(over = {}) {
  const clock = createClock(Date.parse("2026-11-12T10:00:00Z"));
  const sdk = createFakeSdk();
  const socket = fakeSocket();
  const audio = fakeAudio();
  const els = [iosElement()];
  const peer = { level: 0 };
  const other = over.role === "patient" ? "doctor" : "patient";
  const http = {
    async post(url, body) {
      if (url.endsWith("/transcript-notice")) return { data: { recorded: true } };
      return { data: { accepted: body.items.length, duplicates: 0, rejected: [] } };
    },
    async get() { return { data: { token: "tok", region: "eastus", expiresInSeconds: 600 } }; },
  };
  const engine = createTranscriptionEngine({
    role: over.role || "doctor", appointmentId: APPT, config: { mode: "notice", noticeVersion: "v1", thresholds: { unclearBelow: 0.4, lowBelow: 0.7 } },
    http, socket, loadSdk: async () => sdk, createAudioContext: () => audio, getLocalStream: () => ({ getAudioTracks: () => [{ addEventListener() {}, removeEventListener() {} }] }),
    getRemoteElements: () => els, browserLanguages: over.browserLanguages || ["en-IN"], profileCountry: "IN",
    getPeerLevel: () => peer.level,
    now: clock.now, nowPerf: clock.perf, setTimer: clock.setTimer, clearTimer: clock.clearTimer, random: () => 0.5, doc: null,
  });
  engine.unlockAudio();
  await engine.start();
  await settle();
  return {
    engine, clock, sdk, socket, audio, els, peer, st: () => engine.getState(), rec: () => sdk.log.recognizers.at(-1),
    peerLang: (lang) => socket.receive("lang-changed", { appointmentId: APPT, lang, from: other }),
    caption: (extra = {}) => socket.receive("caption", { appointmentId: APPT, from: other, id: "c" + Math.random(), final: true, text: "x", srcLang: "en-US", conf: 0.9, tr: {}, at: 1, ...extra }),
    tick: async (ms = 500) => { await clock.advance(ms); },
    speaking: async (ms = 1000) => { peer.level = 0.2; await clock.advance(ms); },
    quiet: async (ms = 2000) => { peer.level = 0; await clock.advance(ms); },
  };
}

const spokenTexts = (t) => t.sdk.log.synths.flatMap((s) => s.requests);
const sentCaptions = (t) => t.socket.emitted.filter(([e]) => e === "caption").map(([, p]) => p);

// ---------------------------------------------------------------------------------------------------------------- the rule
const guard = { readLang: "en", peerSpeechLang: "", peerReadLang: "none", voiceEnabled: true, breakerTripped: false, phase: "running", recognizerStatus: "running", reconnecting: false, tokenFailed: false, audioState: "running", levelAvailable: true, stalled: false, voiceFailed: false, unclearHold: false };

test("evaluateGuard: my pick alone decides; the language the speaker was heard in says mute or not", () => {
  assert.equal(evaluateGuard(guard).mute, false, "nothing heard yet: the real voice is never cut off blindly");
  assert.deepEqual(evaluateGuard({ ...guard, peerSpeechLang: "hi-IN" }), { expected: true, mute: true, reason: null, showMessage: false }, "Hindi heard, I hear English: muted");
  assert.equal(evaluateGuard({ ...guard, peerSpeechLang: "en-IN" }).mute, false, "English heard, I hear English: real voice");
  assert.equal(evaluateGuard({ ...guard, peerSpeechLang: "en-US" }).expected, false);
  assert.equal(evaluateGuard({ ...guard, readLang: "none", peerSpeechLang: "hi-IN" }).mute, false, "I picked Real voice");
  assert.equal(evaluateGuard({ ...guard, peerSpeechLang: "hi-IN", peerReadLang: "en" }).mute, true, "what was heard beats what they picked");
  assert.equal(evaluateGuard({ ...guard, peerSpeechLang: "en-US", peerReadLang: "hi" }).mute, false, "what was heard beats what they picked");
  // the safety fallbacks still apply to a heard language
  const failing = evaluateGuard({ ...guard, peerSpeechLang: "hi-IN", stalled: true });
  assert.deepEqual([failing.mute, failing.reason, failing.showMessage], [false, "no_translation_arriving", true]);
  assert.equal(evaluateGuard({ ...guard, peerSpeechLang: "hi-IN", unclearHold: true }).reason, "sentence_not_spoken");
  assert.equal(evaluateGuard({ ...guard, peerSpeechLang: "hi-IN", peerStatus: "down" }).reason, "peer_down");
});

test("receiver: the speaker spoke MY language: their own words are the subtitle (not marked unclear), nothing is spoken, no fallback", () => {
  const out = { subtitle: [], voice: [], unspoken: 0 };
  const r = createCaptionReceiver({ role: "doctor", getMyLang: () => "en", onSubtitle: (s) => out.subtitle.push(s), onVoice: (v) => out.voice.push(v), onUnspoken: () => { out.unspoken += 1; } });
  r.handle({ id: "a", from: "patient", final: true, text: "I have a headache", srcLang: "en-US", conf: 0.9, tr: {} });
  assert.deepEqual(out.subtitle.map((s) => [s.text, Boolean(s.unclear)]), [["I have a headache", false]]);
  assert.equal(out.voice.length, 0);
  assert.equal(out.unspoken, 0);
  r.handle({ id: "b", from: "patient", final: true, text: "मुझे सिरदर्द है", srcLang: "hi-IN", conf: 0.9, tr: { en: "I have a headache" } });
  assert.deepEqual(out.voice.map((v) => [v.text, v.lang]), [["I have a headache", "en"]]);
});

// ---------------------------------------------------------------------------------------------------------------- listener side
test("patient picked NOTHING, doctor picked English: Hindi is muted and heard only as the English voice, in any language, with a subtitle", async () => {
  const t = await running({ role: "doctor" });
  t.engine.setReadLanguage("en"); // the doctor opened LANGUAGE and picked English; the patient never opened it
  await t.tick();
  assert.equal(t.st().peerReadLang, "none");
  assert.equal(t.els[0].muted, false, "before anything is heard the real voice is left on");
  await t.speaking();
  t.caption({ id: "p1", final: false, text: "मुझे सिर", srcLang: "hi-IN", conf: null, tr: { en: "I have a head" } });
  await t.tick();
  assert.equal(t.els[0].muted, true, "Hindi detected: the real voice is muted");
  t.caption({ id: "p1", text: "मुझे सिरदर्द है", srcLang: "hi-IN", conf: 0.9, tr: { en: "I have a headache" } });
  await settle(); await settle();
  assert.deepEqual(spokenTexts(t).map((s) => /I have a headache/.test(s)), [true], "the English voice speaks the translation");
  assert.equal(t.st().subtitle.text, "I have a headache");
  assert.equal(t.els[0].muted, true);
  // a second language from the same patient: still only the English voice
  t.audio.bufferSources[0].finish(); await settle();
  t.caption({ id: "p2", text: "j'ai mal à la tête", srcLang: "fr-FR", conf: 0.9, tr: { en: "my head hurts" } });
  await settle(); await settle();
  assert.equal(spokenTexts(t).length, 2);
  assert.equal(t.els[0].muted, true);
});

test("patient speaks ENGLISH, doctor picked English: the real voice plays, nothing is translated, nothing is muted", async () => {
  const t = await running({ role: "doctor" });
  t.engine.setReadLanguage("en");
  await t.speaking();
  t.caption({ id: "e1", final: false, text: "I have a", srcLang: "en-IN", conf: null, tr: { en: "I have a" } });
  t.caption({ id: "e1", text: "I have a headache", srcLang: "en-IN", conf: 0.9, tr: { en: "I have a headache" } });
  await settle(); await settle(); await t.tick();
  assert.equal(t.els[0].muted, false);
  assert.equal(t.st().realVoiceMuted, false);
  assert.equal(spokenTexts(t).length, 0, "no AI voice for a sentence already in my language");
  assert.equal(t.st().fallbackReason, null);
  assert.equal(t.st().translationStatus, "off");
  assert.equal(t.st().subtitle.text, "I have a headache", "the subtitle is still there");
});

test("language switch mid-call: Hindi (muted + English voice), then English (real voice), then Hindi again, per sentence", async () => {
  const t = await running({ role: "doctor" });
  t.engine.setReadLanguage("en");
  await t.speaking();
  t.caption({ id: "a", text: "मुझे बुखार है", srcLang: "hi-IN", conf: 0.9, tr: { en: "I have a fever" } });
  await settle(); await settle();
  assert.equal(t.els[0].muted, true);
  assert.equal(spokenTexts(t).length, 1);
  t.audio.bufferSources[0].finish(); await settle();
  t.caption({ id: "b", text: "and it started yesterday", srcLang: "en-IN", conf: 0.9, tr: { en: "and it started yesterday" } });
  await settle(); await settle();
  assert.equal(t.els[0].muted, false, "the patient switched to English: the real voice is back");
  assert.equal(spokenTexts(t).length, 1, "and nothing more is spoken");
  t.caption({ id: "c", text: "बहुत दर्द है", srcLang: "hi-IN", conf: 0.9, tr: { en: "it hurts a lot" } });
  await settle(); await settle();
  assert.equal(t.els[0].muted, true);
  assert.equal(spokenTexts(t).length, 2);
});

test("the listener changes language mid-call: the new language is announced and the very next sentence is spoken in it", async () => {
  const t = await running({ role: "doctor" });
  t.engine.setReadLanguage("en");
  t.engine.setReadLanguage("de");
  assert.deepEqual(t.socket.emitted.filter(([e]) => e === "lang-changed").map(([, p]) => p.lang), ["none", "en", "de"]);
  await t.speaking();
  t.caption({ id: "d", text: "मुझे बुखार है", srcLang: "hi-IN", conf: 0.9, tr: { en: "I have a fever", de: "Ich habe Fieber" } });
  await settle(); await settle();
  assert.match(spokenTexts(t)[0], /Ich habe Fieber/);
  assert.match(spokenTexts(t)[0], /xml:lang='de-DE'/);
});

test("safety fallbacks still hold with the speaker picking nothing: an unclear sentence and a stalled translation give the real voice back", async () => {
  const t = await running({ role: "doctor" });
  t.engine.setReadLanguage("en");
  await t.speaking();
  t.caption({ id: "s1", text: "मुझे बुखार है", srcLang: "hi-IN", conf: 0.9, tr: { en: "I have a fever" } });
  await settle(); await settle();
  t.audio.bufferSources[0].finish(); await settle();
  assert.equal(t.els[0].muted, true);
  // an unclear sentence is not spoken: the real voice comes back for a moment, with the "didn't catch" note
  t.caption({ id: "s2", text: "mm", srcLang: "hi-IN", conf: 0.1, tr: { en: "mm" } });
  await settle(); await settle();
  assert.equal(t.els[0].muted, false);
  assert.equal(t.st().listenNote, "didnt_catch");
  // the patient's device says its recognizer is down: the real voice stays on, with the message
  await t.tick(7000);
  t.socket.receive("tr-status", { appointmentId: APPT, status: "down", from: "patient" });
  await t.tick();
  assert.equal(t.els[0].muted, false);
  assert.equal(t.st().fallbackReason, "peer_down");
  assert.equal(t.st().translationStatus, "unavailable");
});

test("the 8-second rule still holds: the patient keeps speaking and nothing arrives -> real voice back, with the message", async () => {
  const t = await running({ role: "doctor" });
  t.engine.setReadLanguage("en");
  await t.speaking();
  t.caption({ id: "s1", text: "मुझे बुखार है", srcLang: "hi-IN", conf: 0.9, tr: { en: "I have a fever" } });
  await settle(); await settle();
  t.audio.bufferSources[0].finish(); await settle();
  assert.equal(t.els[0].muted, true);
  await t.speaking(9000);
  assert.equal(t.els[0].muted, false);
  assert.equal(t.st().fallbackReason, "no_translation_arriving");
});

// ---------------------------------------------------------------------------------------------------------------- speaker side
test("SPEAKER picked nothing: the device translates into the listener's language as soon as they pick it, detects the spoken language, and follows a switch", async () => {
  const t = await running({ role: "patient", browserLanguages: ["hi-IN", "en-IN"] });
  const rec = t.rec();
  assert.equal(t.st().readLang, "none");
  assert.notEqual(rec.auto, null, "automatic language detection (nobody picked a language)");
  assert.equal(rec.auto.languages.length, 10, "the 10-slot candidate list");
  assert.ok(rec.auto.languages.includes("hi-IN") && rec.auto.languages.includes("en-IN"));
  assert.deepEqual(rec.targetLanguages, ["en"], "the English record only until someone listens in another language");

  t.peerLang("de"); // the doctor picks German; the patient has picked nothing
  assert.deepEqual([...rec.targetLanguages].sort(), ["de", "en"]);
  assert.equal(rec.removed.length, 0);
  rec.finish("मुझे बुखार है", { en: "I have a fever", de: "Ich habe Fieber" }, { lang: "hi-IN", conf: 0.9, durationMs: 1500 });
  await settle();
  const sent = sentCaptions(t).filter((c) => c.final);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].srcLang, "hi-IN");
  assert.deepEqual(sent[0].tr, { en: "I have a fever", de: "Ich habe Fieber" });

  t.peerLang("fr"); // switch mid-call: no restart, German out, French in
  assert.deepEqual([...rec.targetLanguages].sort(), ["en", "fr"]);
  assert.equal(t.sdk.log.recognizers.length, 1, "the same recognizer: no restart");
  t.peerLang("en");
  assert.deepEqual(rec.targetLanguages, ["en"]);
  t.peerLang("none");
  assert.deepEqual(rec.targetLanguages, ["en"], "Real voice on their side: only the English record");
});
