// "Only one voice is heard": the other person's real voice is muted while translation speaks, and comes back whenever translation cannot deliver.
// Run: node --test tests/transcriptionOneVoice.test.mjs (from frontend/)
import test from "node:test";
import assert from "node:assert/strict";
import { createTranscriptionEngine } from "../src/features/translation/engine.js";
import { evaluateGuard, createElementMuter, createLevelMeter, TRANSLATION_UNAVAILABLE, STALL_MS, UNCLEAR_HOLD_MS } from "../src/features/translation/realVoiceGuard.js";
import { LANGUAGE_HELP } from "../src/features/translation/uiModel.js";
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

async function running(over = {}) {
  const clock = createClock(Date.parse("2026-11-12T10:00:00Z"));
  const sdk = createFakeSdk();
  const socket = fakeSocket();
  const audio = fakeAudio();
  const els = over.elements || [iosElement()];
  const peer = { level: 0 };
  const items = [];
  let tokenFails = false;
  const http = {
    async post(url, body) {
      if (url.endsWith("/transcript-notice")) return { data: { recorded: true } };
      items.push(...body.items);
      return { data: { accepted: body.items.length, duplicates: 0, rejected: [] } };
    },
    async get() { if (tokenFails) throw httpError(403); return { data: { token: "tok", region: "eastus", expiresInSeconds: 600 } }; },
  };
  const engine = createTranscriptionEngine({
    role: over.role || "patient", appointmentId: APPT, config: { mode: "notice", noticeVersion: "v1", thresholds: { unclearBelow: 0.4, lowBelow: 0.7 } },
    http, socket, loadSdk: async () => sdk, createAudioContext: () => audio, getLocalStream: () => ({ getAudioTracks: () => [{ addEventListener() {}, removeEventListener() {} }] }),
    getRemoteElements: () => els, browserLanguages: ["en-IN"], profileCountry: "IN",
    getPeerLevel: over.noMeter ? () => null : () => peer.level,
    now: clock.now, nowPerf: clock.perf, setTimer: clock.setTimer, clearTimer: clock.clearTimer, random: () => 0.5, doc: null,
  });
  engine.unlockAudio();
  await engine.start();
  await settle();
  return {
    engine, clock, sdk, socket, audio, els, peer, items, st: () => engine.getState(), rec: () => sdk.log.recognizers.at(-1),
    failTokens: () => { tokenFails = true; },
    peerLang: (lang) => socket.receive("lang-changed", { appointmentId: APPT, lang, from: "doctor" }),
    caption: (extra = {}) => socket.receive("caption", { appointmentId: APPT, from: "doctor", id: "c" + Math.random(), final: true, text: "I have a headache", srcLang: "en-US", conf: 0.9, tr: { de: "Ich habe Kopfschmerzen" }, at: 1, ...extra }),
    tick: async (ms = 500) => { await clock.advance(ms); },
    speaking: async (ms = 1000) => { peer.level = 0.2; await clock.advance(ms); },
    quiet: async (ms = 2000) => { peer.level = 0; await clock.advance(ms); },
  };
}
// German patient, English doctor.
async function translating(over) {
  const t = await running(over);
  t.engine.setReadLanguage("de");
  t.peerLang("en");
  await t.tick();
  return t;
}

// ------------------------------------------------------------------------------------------------------------------ the rule itself
const base = { readLang: "de", peerReadLang: "en", voiceEnabled: true, breakerTripped: false, phase: "running", recognizerStatus: "running", reconnecting: false, tokenFailed: false, audioState: "running", levelAvailable: true, stalled: false, voiceFailed: false, unclearHold: false };

test("evaluateGuard: mutes only when both picked a language, the languages differ and everything works", () => {
  assert.deepEqual(evaluateGuard(base), { expected: true, mute: true, reason: null, showMessage: false });
  assert.equal(evaluateGuard({ ...base, readLang: "none" }).mute, false, "I picked Real voice");
  assert.equal(evaluateGuard({ ...base, peerReadLang: "none" }).mute, false, "they did not pick a language");
  assert.equal(evaluateGuard({ ...base, peerReadLang: "de" }).mute, false, "same language");
  assert.equal(evaluateGuard({ ...base, readLang: "en", peerReadLang: "en-GB" }).expected, false, "same base language");
  for (const r of [evaluateGuard({ ...base, readLang: "none" }), evaluateGuard({ ...base, peerReadLang: "de" })]) assert.equal(r.showMessage, false, "no alarm when real voice is by design");
});

test("evaluateGuard: every failure gives the real voice back, with the message", () => {
  const cases = {
    echo_breaker: { breakerTripped: true },
    no_voice_for_my_language: { readLang: "ht" },
    peer_language_not_transcribable: { peerReadLang: "ht" },
    engine_unavailable: { phase: "unavailable" },
    reconnecting: { reconnecting: true },
    token_failed: { tokenFailed: true },
    audio_blocked: { audioState: "suspended" },
    voice_failed: { voiceFailed: true },
    cannot_measure_peer: { levelAvailable: false },
    no_translation_arriving: { stalled: true },
  };
  for (const [reason, patch] of Object.entries(cases)) {
    const r = evaluateGuard({ ...base, ...patch });
    assert.equal(r.mute, false, reason);
    assert.equal(r.reason, reason);
    assert.equal(r.showMessage, true, reason);
  }
  const unclear = evaluateGuard({ ...base, unclearHold: true });
  assert.deepEqual([unclear.mute, unclear.reason, unclear.showMessage], [false, "sentence_not_spoken", false], "a brief unmute for one unspoken sentence is quiet");
  const off = evaluateGuard({ ...base, voiceEnabled: false });
  assert.deepEqual([off.mute, off.showMessage], [false, false], "the person switched the translated voice off themselves");
});

test("the message text is exactly as specified; the language panel text too", () => {
  assert.equal(TRANSLATION_UNAVAILABLE, "Translation unavailable - you are hearing the original voice");
  assert.equal(LANGUAGE_HELP, "Choose the language YOU speak. You will hear and read the other person in this language. The other person's original voice is muted while translation is on.");
});

// ------------------------------------------------------------------------------------------------------------------ the muting itself
test("muter: sets element.muted (an iPhone ignores volume), and gives the element back exactly as it was", () => {
  const a = iosElement(false), b = iosElement(true);
  const m = createElementMuter({ getElements: () => [a, b] });
  m.apply(true);
  assert.deepEqual([a.muted, b.muted, a.volume], [true, true, 1]);
  m.apply(false);
  assert.deepEqual([a.muted, b.muted], [false, true], "b was muted before we came: it stays muted");
  m.apply(false);
  assert.deepEqual([a.muted, b.muted], [false, true]);
});

test("level meter: null when it cannot be measured, an RMS when it can", () => {
  const el = { srcObject: { getAudioTracks: () => [{}] } };
  assert.equal(createLevelMeter({ getContext: () => null, getElements: () => [el] }).level(), null);
  assert.equal(createLevelMeter({ getContext: () => ({ createAnalyser() {}, createMediaStreamSource() {} }), getElements: () => [] }).level(), null, "no remote stream yet");
  assert.equal(createLevelMeter({ getContext: () => ({}), getElements: () => [el] }).level(), null, "no analyser support");
  const ctx = { createMediaStreamSource: () => ({ connect() {}, disconnect() {} }), createAnalyser: () => ({ fftSize: 0, connect() {}, getFloatTimeDomainData(b) { b.fill(0.5); } }) };
  assert.ok(Math.abs(createLevelMeter({ getContext: () => ctx, getElements: () => [el] }).level() - 0.5) < 1e-6);
});

// ------------------------------------------------------------------------------------------------------------------ in a call
test("doctor speaks English, patient picked German: the patient's device mutes the doctor's real voice (muted, not volume), and unmutes when German is dropped", async () => {
  const t = await translating();
  assert.equal(t.els[0].muted, true);
  assert.equal(t.els[0].volume, 1, "volume untouched: this works on an iPhone");
  assert.equal(t.st().realVoiceMuted, true);
  t.engine.setReadLanguage("none");
  assert.equal(t.els[0].muted, false, "Real voice (no translation): the real voice plays again at once");
  assert.equal(t.st().realVoiceMuted, false);
  assert.equal(t.st().translationStatus, "off");
});

test("nothing is muted by default, or when the other person has not picked a language, or when both speak the same language", async () => {
  const t = await running();
  t.peerLang("en"); await t.tick();
  assert.equal(t.els[0].muted, false, "I am on Real voice");
  t.engine.setReadLanguage("de"); t.peerLang("none"); await t.tick();
  assert.equal(t.els[0].muted, false, "they are on Real voice / no language");
  t.peerLang("de"); await t.tick();
  assert.equal(t.els[0].muted, false, "same language");
  t.peerLang("en"); await t.tick();
  assert.equal(t.els[0].muted, true);
});

test("an element that was already muted is left muted when translation stops", async () => {
  const t = await translating({ elements: [iosElement(true)] });
  t.engine.setReadLanguage("none");
  assert.equal(t.els[0].muted, true);
});

test("the indicator: 'waiting' while the other person speaks, 'speaking' while the translated voice plays, then quiet; one sentence at a time", async () => {
  const t = await translating();
  assert.equal(t.st().translationStatus, "ready");
  await t.speaking();
  assert.equal(t.st().translationStatus, "waiting");
  t.caption({ id: "s1" });
  t.caption({ id: "s2", text: "And a fever", tr: { de: "Und Fieber" } });
  await settle(); await settle();
  assert.equal(t.st().translationStatus, "speaking");
  assert.equal(t.audio.bufferSources.length, 1, "the second sentence waits for the first");
  t.audio.bufferSources[0].finish(); await settle(); await settle();
  assert.equal(t.audio.bufferSources.length, 2, "then the next one is spoken");
  assert.equal(t.els[0].muted, true, "the real voice stays muted between sentences");
  t.audio.bufferSources[1].finish(); await settle();
  await t.quiet(6000);
  assert.equal(t.st().translationStatus, "ready");
  assert.equal(t.els[0].muted, true);
});

// ---- fallbacks ----
test("FALLBACK Azure reconnecting: real voice back with the message, muted again when it recovers", async () => {
  const t = await translating();
  assert.equal(t.els[0].muted, true);
  t.rec().fail(); await settle();
  assert.equal(t.st().reconnecting, true);
  assert.equal(t.els[0].muted, false);
  assert.equal(t.st().translationStatus, "unavailable");
  await t.quiet(60000); await settle();
  assert.equal(t.st().reconnecting, false, "recovered");
  assert.equal(t.els[0].muted, true);
  assert.equal(t.st().translationStatus, "ready");
});

test("FALLBACK token refused for good: real voice back", async () => {
  const t = await translating();
  t.failTokens(); // the scheduled token refresh is refused (403) for good
  await t.quiet(700000); await settle();
  assert.equal(t.els[0].muted, false);
  assert.equal(t.st().fallbackReason, "token_failed");
  assert.equal(t.st().translationStatus, "unavailable");
});

test("FALLBACK the translated voice cannot be made (Azure speech fails): real voice back; translation is tried again after a while", async () => {
  const t = await translating();
  t.caption({ id: "x1" }); await settle(); await settle();
  t.audio.bufferSources[0].finish(); await settle();
  t.sdk.log.synths[0].fail = true;
  t.caption({ id: "x2" }); await settle(); await settle();
  assert.equal(t.els[0].muted, false);
  assert.equal(t.st().fallbackReason, "voice_failed");
  assert.equal(t.st().translationStatus, "unavailable");
  t.sdk.log.synths[0].fail = false;
  await t.quiet(16000);
  assert.equal(t.els[0].muted, true);
});

test("FALLBACK the other person's language is subtitles-only (no speech support): real voice stays on, with the message", async () => {
  const t = await running();
  t.engine.setReadLanguage("de"); t.peerLang("ht"); await t.tick();
  assert.equal(t.els[0].muted, false);
  assert.equal(t.st().fallbackReason, "peer_language_not_transcribable");
  assert.equal(t.st().translationStatus, "unavailable");
});

test("FALLBACK my language has no voice (subtitles only): real voice stays on", async () => {
  const t = await running();
  t.engine.setReadLanguage("ht"); t.peerLang("en"); await t.tick();
  assert.equal(t.els[0].muted, false);
  assert.equal(t.st().fallbackReason, "no_voice_for_my_language");
});

test("FALLBACK echo circuit breaker turned the translated voice off: real voice back, and muted again when the voice is switched back on", async () => {
  const t = await translating();
  t.caption({ id: "e0", text: "Hello", tr: { de: "Ich habe seit drei Tagen starke Kopfschmerzen" } }); await settle(); await settle();
  for (let i = 0; i < 4; i++) t.rec().finish("ich habe seit drei tagen starke kopfschmerzen", { en: "x" }, { lang: "de-DE", conf: 0.8, durationMs: 2000 });
  assert.equal(t.st().voiceBreakerTripped, true);
  assert.equal(t.els[0].muted, false);
  assert.equal(t.st().translationStatus, "unavailable");
  t.engine.setVoiceEnabled(true);
  await t.tick();
  assert.equal(t.els[0].muted, true);
});

test("the person switched 'Hear translated voice' off: real voice plays, no alarm message", async () => {
  const t = await translating();
  t.engine.setVoiceEnabled(false);
  assert.equal(t.els[0].muted, false);
  assert.equal(t.st().translationStatus, "off");
  t.engine.setVoiceEnabled(true); await t.tick();
  assert.equal(t.els[0].muted, true);
});

test("FALLBACK 8 seconds of the other person clearly speaking with nothing arriving: real voice back; muted again as soon as a caption arrives", async () => {
  const t = await translating();
  await t.speaking(STALL_MS - 1500);
  assert.equal(t.els[0].muted, true, "not yet");
  await t.speaking(2500);
  assert.equal(t.els[0].muted, false);
  assert.equal(t.st().fallbackReason, "no_translation_arriving");
  assert.equal(t.st().translationStatus, "unavailable");
  await t.quiet(5000);
  assert.equal(t.els[0].muted, false, "stays unmuted until translation is seen working again");
  t.caption({ id: "back" }); await settle();
  await t.tick();
  assert.equal(t.els[0].muted, true);
});

test("the 8-second rule does not fire while captions keep arriving, nor when the other person is quiet", async () => {
  const t = await translating();
  for (let i = 0; i < 6; i++) { await t.speaking(2000); t.caption({ id: "k" + i, final: false, text: "I have", tr: { de: "Ich habe" } }); }
  assert.equal(t.els[0].muted, true);
  await t.quiet(30000);
  assert.equal(t.els[0].muted, true, "silence is not a stall");
});

test("FALLBACK a sentence that is too unclear to be spoken: the real voice is unmuted for a moment so nothing is lost, then muted again", async () => {
  const t = await translating();
  t.caption({ id: "u1", conf: 0.2, text: "mumble", tr: { de: "Gemurmel" } });
  assert.equal(t.els[0].muted, false);
  assert.notEqual(t.st().translationStatus, "unavailable", "no alarming message for one unclear sentence");
  await t.quiet(UNCLEAR_HOLD_MS + 1000);
  assert.equal(t.els[0].muted, true);
  assert.equal(t.audio.bufferSources.length, 0, "the unclear sentence was not spoken");
});

test("a sentence with no translation for my language also gives the real voice back for a moment", async () => {
  const t = await translating();
  t.caption({ id: "n1", tr: { en: "I have a headache" } });
  assert.equal(t.els[0].muted, false);
});

test("FALLBACK the translated voice cannot play at all (audio suspended): real voice stays on, back to muted when audio runs", async () => {
  const t = await translating();
  t.audio.state = "suspended";
  await t.tick();
  assert.equal(t.els[0].muted, false);
  assert.equal(t.st().fallbackReason, "audio_blocked");
  t.audio.state = "running"; await t.tick();
  assert.equal(t.els[0].muted, true);
});

test("FAIL-SAFE the other person's stream cannot be measured: never muted", async () => {
  const t = await translating({ noMeter: true });
  assert.equal(t.els[0].muted, false);
  assert.equal(t.st().fallbackReason, "cannot_measure_peer");
});

test("FAIL-SAFE the speech engine could not load at all: never muted", async () => {
  const clock = createClock(); const el = iosElement();
  const engine = createTranscriptionEngine({
    role: "patient", appointmentId: APPT, http: { async post() { return { data: { recorded: true } }; }, async get() { throw httpError(403); } }, socket: fakeSocket(),
    loadSdk: async () => { throw new Error("no sdk"); }, createAudioContext: fakeAudio, getLocalStream: () => ({}), getRemoteElements: () => [el], getPeerLevel: () => 0.2,
    now: clock.now, nowPerf: clock.perf, setTimer: clock.setTimer, clearTimer: clock.clearTimer, random: () => 0.5, doc: null,
  });
  await engine.start(); engine.setReadLanguage("de"); engine.handleIncomingLang({ appointmentId: APPT, lang: "en" });
  await clock.advance(20000);
  assert.equal(el.muted, false);
});

test("hanging up, or the engine stopping, never leaves the real voice muted", async () => {
  const t = await translating();
  assert.equal(t.els[0].muted, true);
  await t.engine.stop();
  assert.equal(t.els[0].muted, false);
});

// ------------------------------------------------------------------------------------------------------------------ what is saved and sent
test("every final sentence from my side is saved, unclear ones and ones in a language other than the picked one included, and each is sent to the other side", async () => {
  const t = await running({ role: "doctor" });
  t.engine.setReadLanguage("de"); // the wrong language on purpose
  t.rec().finish("ich habe", { en: "i have" }, { lang: "de-DE", conf: 0.2 });
  t.rec().finish("Das ist gut", { en: "That is good" }, { lang: "de-DE", conf: 0.9 });
  t.rec().finish("mumble", { en: "mumble" }, { lang: "en-US", conf: 0.1 });
  await t.clock.advance(2100);
  assert.equal(t.items.filter((i) => i.type === "line").length, 3, "all three reached the server");
  assert.deepEqual(t.items.filter((i) => i.type === "line").map((i) => i.original), ["ich habe", "Das ist gut", "mumble"]);
  assert.equal(t.items.find((i) => i.original === "ich habe").confidence, 0.2);
  const sent = t.socket.emitted.filter(([e]) => e === "caption").map(([, p]) => p).filter((p) => p.final);
  assert.equal(sent.length, 3, "the other side is told about every sentence (it hides the unclear ones, and unmutes the real voice)");
});
