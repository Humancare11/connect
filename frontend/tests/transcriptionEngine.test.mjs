// The whole engine for one call, with the SDK, socket, HTTP, audio and clock all faked. Run: node --test tests/transcriptionEngine.test.mjs (from frontend/)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTranscriptionEngine } from "../src/features/translation/engine.js";
import { createClock, settle, httpError, networkError } from "./helpers/fakeClock.mjs";
import { createFakeSdk } from "./helpers/fakeSdk.mjs";

const APPT = "64b7f0c2a1b2c3d4e5f60718";
const CHUNK = 4096;

function fakeSocket() {
  const handlers = new Map();
  return {
    emitted: [],
    emit(event, payload) { this.emitted.push([event, payload]); },
    on(event, fn) { (handlers.get(event) || handlers.set(event, new Set()).get(event)).add(fn); },
    off(event, fn) { handlers.get(event)?.delete(fn); },
    receive(event, payload) { [...(handlers.get(event) || [])].forEach((fn) => fn(payload)); },
    count: () => [...handlers.values()].reduce((n, s) => n + s.size, 0),
    sent: (event) => this.emitted.filter(([e]) => e === event).map(([, p]) => p),
  };
}
function fakeAudio() {
  const listeners = new Set();
  const ctx = {
    sampleRate: 48000, state: "running", destination: {}, sources: [], bufferSources: [], resumed: 0, proc: null,
    createMediaStreamSource() { const n = { connect() {}, disconnect() {} }; ctx.sources.push(n); return n; },
    createScriptProcessor() { ctx.proc = { onaudioprocess: null, connect() {}, disconnect() {} }; return ctx.proc; },
    resume() { ctx.resumed++; return Promise.resolve(); },
    addEventListener(t, f) { listeners.add(f); }, removeEventListener(t, f) { listeners.delete(f); },
    decodeAudioData: async () => ({ duration: 1 }),
    createBufferSource() {
      const s = { buffer: null, started: false, stopped: false, onended: null, connect() {}, start() { s.started = true; }, stop() { s.stopped = true; if (s.onended) s.onended(); }, finish() { if (s.onended) s.onended(); } };
      ctx.bufferSources.push(s);
      return s;
    },
  };
  return ctx;
}
const fakeStream = () => ({ getAudioTracks: () => [{ addEventListener() {}, removeEventListener() {} }] });
const element = (honours = true) => { let v = 1; return { get volume() { return v; }, set volume(x) { if (honours) v = x; } }; };
const feedAudio = (audio, n = 1) => { for (let i = 0; i < n; i++) audio.proc.onaudioprocess({ inputBuffer: { getChannelData: () => Float32Array.from({ length: CHUNK }, (_, k) => Math.sin(k / 10) * 0.2) } }); };

function build(over = {}) {
  const clock = createClock(Date.parse("2026-11-12T10:00:00Z"));
  const sdk = over.sdk || createFakeSdk();
  const socket = fakeSocket();
  const audio = fakeAudio();
  const stream = fakeStream();
  const elements = over.elements || [element(true)];
  const calls = { posts: [], gets: [], items: [], notices: [] };
  let transcriptScript = over.transcriptScript || [];
  let noticeScript = over.noticeScript || [];
  const http = {
    async post(url, body, options) {
      calls.posts.push({ url, body, options });
      if (url.endsWith("/transcript-notice")) {
        calls.notices.push(body);
        const r = noticeScript.length ? noticeScript.shift() : { recorded: true };
        if (r instanceof Error) throw r;
        return { data: r };
      }
      const step = transcriptScript.length ? transcriptScript.shift() : null;
      if (step instanceof Error) throw step;
      calls.items.push(...body.items);
      return { data: { accepted: body.items.length, duplicates: 0, rejected: [] } };
    },
    async get(url, options) {
      calls.gets.push({ url, options });
      if (over.tokenError) throw over.tokenError;
      return { data: { token: "tok-" + calls.gets.length, region: "eastus", expiresInSeconds: 600 } };
    },
  };
  const engine = createTranscriptionEngine({
    role: over.role || "patient", appointmentId: APPT, config: { mode: "notice", noticeVersion: "v1", thresholds: { unclearBelow: 0.4, lowBelow: 0.7 } },
    http, socket, loadSdk: over.loadSdk || (async () => sdk), createAudioContext: () => audio, getLocalStream: () => stream, getRemoteElements: () => elements,
    browserLanguages: over.browserLanguages || ["en-IN", "hi"], profileCountry: over.profileCountry ?? "IN",
    now: clock.now, nowPerf: clock.perf, setTimer: clock.setTimer, clearTimer: clock.clearTimer, random: () => 0.5, doc: null,
  });
  const rec = () => sdk.log.recognizers.at(-1);
  return { engine, clock, sdk, socket, audio, elements, calls, rec, sent: (e) => socket.emitted.filter(([n]) => n === e).map(([, p]) => p) };
}
async function running(over) {
  const t = build(over);
  t.engine.unlockAudio();
  await t.engine.start();
  await settle();
  return t;
}
const say = (t, text, tr, extra) => t.rec().finish(text, tr, extra);
const flushUploads = async (t) => { await t.clock.advance(2100); };

// ------------------------------------------------------------------------------------------------------------------ starting
test("start: the notice is recorded, a token is fetched once, the recognizer listens with detection among 10 candidates (Hindi included) and translates to English, the language is announced", async () => {
  const t = await running();
  assert.equal(t.engine.getState().phase, "running");
  assert.equal(t.calls.notices.length, 1);
  assert.equal(t.calls.notices[0].version, "v1");
  assert.equal(t.calls.notices[0].clientShownAt, "2026-11-12T10:00:00.000Z");
  assert.equal(t.engine.getState().notice, "done");
  assert.equal(t.calls.gets.filter((g) => g.url === "/api/speech-token").length, 1);
  assert.deepEqual(t.calls.gets[0].options, { params: { appointmentId: APPT } });
  const r = t.rec();
  assert.equal(r.cfg.props.LIDMODE, "Continuous");
  assert.equal(r.auto.languages.length, 10);
  assert.ok(r.auto.languages.includes("hi-IN") && r.auto.languages.includes("en-IN"));
  assert.deepEqual(r.cfg.targets, ["en"]);
  assert.deepEqual(t.sent("lang-changed"), [{ appointmentId: APPT, lang: "none" }], "the other person is told: Real voice");
  assert.equal(t.engine.getState().readLang, "none");
  assert.equal(t.engine.getState().recognizerStatus, "running");
});

test("microphone audio flows into the recognizer once it is running", async () => {
  const t = await running();
  feedAudio(t.audio, 3);
  assert.equal(t.sdk.log.pushes[0].written.length, 3);
});

test("the default is Real voice: nothing is shown, nothing is spoken, but everything the person says is still sent and saved", async () => {
  const t = await running();
  say(t, "Mujhe teen din se sar dard hai", { en: "I have had a headache for three days" }, { lang: "hi-IN", conf: 0.86, durationMs: 2500 });
  assert.equal(t.engine.getState().subtitle, null);
  assert.deepEqual(t.sent("caption").map((c) => [c.final, c.text, c.srcLang, c.conf, c.tr]), [[true, "Mujhe teen din se sar dard hai", "hi-IN", 0.86, { en: "I have had a headache for three days" }]]);
  await flushUploads(t);
  assert.equal(t.calls.items.length, 1);
  assert.deepEqual(
    { type: t.calls.items[0].type, original: t.calls.items[0].original, translations: t.calls.items[0].translations, sourceLang: t.calls.items[0].sourceLang, languageSource: t.calls.items[0].languageSource, confidence: t.calls.items[0].confidence, flags: t.calls.items[0].flags },
    { type: "line", original: "Mujhe teen din se sar dard hai", translations: { en: "I have had a headache for three days" }, sourceLang: "hi-IN", languageSource: "auto", confidence: 0.86, flags: { suspectedEcho: false, languageNotInList: false } }
  );
  assert.equal(t.engine.getState().transcript.length, 1);
});

test("partials are sent as they grow (limited), finals always", async () => {
  const t = await running();
  t.rec().say("Mujhe", { en: "I" }, { lang: "hi-IN" });
  t.rec().say("Mujhe teen", { en: "I three" }, { lang: "hi-IN" });
  say(t, "Mujhe teen din", { en: "I three days" }, { lang: "hi-IN", conf: 0.9 });
  const caps = t.sent("caption");
  assert.deepEqual(caps.map((c) => c.final), [false, true], "the second partial was held back and replaced by the final");
  assert.equal(caps[0].id, caps[1].id, "the sentence keeps one id");
});

// ------------------------------------------------------------------------------------------------------------------ the other person
test("the other person picks a language: the translation target is added to the RUNNING recognizer, no restart, and they hear nothing until they do", async () => {
  const t = await running();
  t.socket.receive("lang-changed", { appointmentId: APPT, lang: "de", from: "doctor" });
  assert.deepEqual(t.rec().added, ["de"]);
  assert.equal(t.sdk.log.recognizers.length, 1, "never restarted");
  assert.equal(t.engine.getState().peerReadLang, "de");
  say(t, "I have a headache", { en: "I have a headache", de: "Ich habe Kopfschmerzen" }, { lang: "en-IN", conf: 0.9 });
  assert.deepEqual(t.sent("caption").at(-1).tr, { en: "I have a headache", de: "Ich habe Kopfschmerzen" });
  t.socket.receive("lang-changed", { appointmentId: APPT, lang: "none", from: "doctor" });
  assert.deepEqual(t.rec().removed, ["de"]);
  t.socket.receive("lang-changed", { appointmentId: APPT, lang: "en", from: "doctor" });
  assert.deepEqual(t.rec().added, ["de"], "English is already the record: nothing to add");
});

test("messages for another appointment, or junk, are ignored", async () => {
  const t = await running();
  t.socket.receive("lang-changed", { appointmentId: "000000000000000000000000", lang: "de" });
  t.socket.receive("lang-changed", null);
  t.socket.receive("lang-changed", { appointmentId: APPT, lang: 5 });
  t.socket.receive("caption", null);
  t.socket.receive("caption", { appointmentId: "other", text: "x", final: true });
  assert.deepEqual(t.rec().added, []);
  assert.equal(t.engine.getState().peerReadLang, "none");
  assert.equal(t.engine.getState().transcript.length, 0);
});

test("the other person joins or the socket reconnects: my language is announced again", async () => {
  const t = await running();
  const before = t.sent("lang-changed").length;
  t.socket.receive("peer-joined", {});
  t.socket.receive("connect");
  t.engine.onPeerJoined();
  assert.equal(t.sent("lang-changed").length, before + 3);
  assert.ok(t.sent("lang-changed").every((m) => m.lang === "none" && m.appointmentId === APPT));
});

// ------------------------------------------------------------------------------------------------------------------ picking a language
test("picking a language: announced, my own recognizer switches to that language at the next pause, subtitles and the translated voice start", async () => {
  const t = await running();
  t.engine.setReadLanguage("de");
  assert.equal(t.engine.getState().readLang, "de");
  assert.deepEqual(t.sent("lang-changed").at(-1), { appointmentId: APPT, lang: "de" });
  assert.equal(t.sdk.log.recognizers.length, 1, "not restarted yet: it waits for a pause");
  say(t, "Guten Tag", { en: "Good day" }, { lang: "de-DE", conf: 0.9 }); // a finished sentence is a pause
  await settle();
  assert.equal(t.sdk.log.recognizers.length, 2);
  assert.equal(t.rec().cfg.speechRecognitionLanguage, "de-DE");

  // the other person speaks English, translated into German for me
  t.socket.receive("caption", { appointmentId: APPT, from: "doctor", id: "d1-0", final: false, text: "How are", srcLang: "en-US", conf: null, tr: { en: "How are", de: "Wie" }, at: 1 });
  assert.deepEqual(t.engine.getState().subtitle && [t.engine.getState().subtitle.text, t.engine.getState().subtitle.final], ["Wie", false]);
  t.socket.receive("caption", { appointmentId: APPT, from: "doctor", id: "d1-0", final: true, text: "How are you?", srcLang: "en-US", conf: 0.93, tr: { en: "How are you?", de: "Wie geht es Ihnen?" }, at: 2 });
  assert.equal(t.engine.getState().subtitle.text, "Wie geht es Ihnen?");
  await settle();
  const synth = t.sdk.log.synths[0];
  assert.ok(synth, "the voice was synthesised");
  assert.equal(synth.audioConfig, null, "audio is returned to us and played through our own unlocked audio context");
  assert.match(synth.requests[0], /xml:lang='de-DE'><voice name='de-DE-KatjaNeural'>Wie geht es Ihnen\?</);
  await settle();
  assert.equal(t.audio.bufferSources.length, 1);
  assert.equal(t.audio.bufferSources[0].started, true);
  t.audio.bufferSources[0].finish();
  await settle();
  assert.equal(t.engine.getState().transcript.filter((e) => e.who === "peer").length, 1, "only finished sentences are listed in the transcript panel");
});

test("the other person's real voice is lowered while the translation plays and restored after (desktop)", async () => {
  const t = await running();
  t.engine.setReadLanguage("de");
  t.socket.receive("caption", { appointmentId: APPT, from: "doctor", id: "d1-0", final: true, text: "Hello", srcLang: "en-US", conf: 0.9, tr: { de: "Hallo" }, at: 1 });
  await settle(); await settle();
  assert.equal(t.elements[0].volume, 0.2);
  t.audio.bufferSources[0].finish();
  await settle();
  assert.equal(t.elements[0].volume, 1);
});

test("unclear speech (confidence under 0.4) is saved and flagged but never shown, spoken, or sent on; low speech is shown lighter", async () => {
  const t = await running();
  t.engine.setReadLanguage("de");
  t.socket.receive("caption", { appointmentId: APPT, from: "doctor", id: "u1", final: true, text: "mumble", srcLang: "en-US", conf: 0.2, tr: { de: "Gemurmel" }, at: 1 });
  assert.equal(t.engine.getState().subtitle, null);
  await settle();
  assert.equal(t.sdk.log.synths.length, 0);
  t.socket.receive("caption", { appointmentId: APPT, from: "doctor", id: "l1", final: true, text: "so so", srcLang: "en-US", conf: 0.55, tr: { de: "naja" }, at: 2 });
  assert.equal(t.engine.getState().subtitle.lighter, true);

  const before = t.sent("caption").length;
  say(t, "mumble mumble", { en: "mumble" }, { lang: "en-IN", conf: 0.2 });
  assert.equal(t.sent("caption").length, before, "my own unclear sentence is not sent to the other person");
  await flushUploads(t);
  assert.equal(t.calls.items.length, 1, "but it IS saved to the server");
  assert.equal(t.calls.items[0].confidence, 0.2);
});

test("a language with no speech support: the pick works, the person's speech is flagged 'language not in list' in the saved transcript", async () => {
  const t = await running();
  t.engine.setReadLanguage("ht"); // Haitian Creole: Azure cannot transcribe it
  assert.equal(t.engine.getState().unsupportedSpeech, true);
  say(t, "bonjou", { en: "hello" }, { lang: "fr-FR", conf: 0.3 });
  await settle();
  assert.equal(t.rec().cfg.speechRecognitionLanguage, null, "no fixed locale exists, so detection stays on");
  await flushUploads(t);
  assert.equal(t.calls.items[0].flags.languageNotInList, true);
  t.engine.setReadLanguage("none");
  assert.equal(t.engine.getState().unsupportedSpeech, false);
});

test("going back to Real voice clears the subtitle and the queued voice, and tells the other person", async () => {
  const t = await running();
  t.engine.setReadLanguage("de");
  t.socket.receive("caption", { appointmentId: APPT, from: "doctor", id: "d1", final: false, text: "x", srcLang: "en-US", conf: null, tr: { de: "y" }, at: 1 });
  assert.ok(t.engine.getState().subtitle);
  t.engine.setReadLanguage("none");
  assert.equal(t.engine.getState().subtitle, null);
  assert.deepEqual(t.sent("lang-changed").at(-1), { appointmentId: APPT, lang: "none" });
  t.engine.setReadLanguage("not-a-language");
  assert.equal(t.engine.getState().readLang, "none", "an unknown code is treated as Real voice");
});

test("the wrong-language safety net: a picked language that keeps coming out as nonsense switches to detection at the next pause", async () => {
  const t = await running();
  t.engine.setReadLanguage("en");
  say(t, "fine", { en: "fine" }, { lang: "en-US", conf: 0.9 });
  await settle();
  assert.equal(t.rec().cfg.speechRecognitionLanguage, "en-US");
  assert.equal(t.rec().auto, null);
  say(t, "garbled one", { en: "garbled one" }, { lang: "en-US", conf: 0.05 });
  const before = t.sdk.log.recognizers.length;
  say(t, "garbled two", { en: "garbled two" }, { lang: "en-US", conf: 0.06 });
  await settle();
  assert.equal(t.sdk.log.recognizers.length, before + 1);
  assert.equal(t.rec().cfg.props.LIDMODE, "Continuous", "now listening with detection");
  assert.equal(t.engine.getState().fellBackToDetection, true);
  assert.equal(t.engine.getState().readLang, "en", "what the person READS is unchanged");
  say(t, "mujhe dard hai", { en: "I am in pain" }, { lang: "hi-IN", conf: 0.88 });
  await flushUploads(t);
  assert.equal(t.calls.items.at(-1).languageSource, "auto", "and the saved line says the language was detected, not declared");
});

// ------------------------------------------------------------------------------------------------------------------ echo
test("echo of my own translated voice is saved flagged, never sent to the other person, never shown; four in a minute switch the voice off", async () => {
  const t = await running();
  t.engine.setReadLanguage("de");
  t.socket.receive("caption", { appointmentId: APPT, from: "doctor", id: "d1", final: true, text: "Hello", srcLang: "en-US", conf: 0.93, tr: { de: "Ich habe seit drei Tagen starke Kopfschmerzen" }, at: 1 });
  await settle(); await settle();
  assert.equal(t.audio.bufferSources[0].started, true, "my voice is playing");
  const sentBefore = t.sent("caption").length;

  for (let i = 0; i < 3; i++) say(t, "ich habe seit drei tagen starke kopfschmerzen", { en: "I have had severe headaches for three days" }, { lang: "de-DE", conf: 0.8, durationMs: 2000 });
  assert.equal(t.sent("caption").length, sentBefore, "echo is never sent on");
  assert.equal(t.engine.getState().voiceBreakerTripped, false);
  say(t, "ich habe seit drei tagen starke kopfschmerzen", { en: "x" }, { lang: "de-DE", conf: 0.8, durationMs: 2000 });
  assert.equal(t.engine.getState().voiceBreakerTripped, true, "the 4th within a minute trips the breaker");

  await flushUploads(t);
  assert.equal(t.calls.items.length, 4, "every echo line is still SAVED");
  assert.ok(t.calls.items.every((i) => i.flags.suspectedEcho === true));
  assert.equal(t.engine.getState().transcript.filter((e) => e.who === "me" && e.flags.echo).length, 4);

  // with the breaker tripped, the voice no longer plays; the person can switch it back on
  t.socket.receive("caption", { appointmentId: APPT, from: "doctor", id: "d2", final: true, text: "Next", srcLang: "en-US", conf: 0.9, tr: { de: "Nächster" }, at: 3 });
  await settle();
  assert.equal(t.sdk.log.synths[0].requests.length, 1, "no new sentence is spoken");
  t.engine.setVoiceEnabled(true);
  assert.equal(t.engine.getState().voiceBreakerTripped, false);
});

test("a real reply spoken over the voice, with normal confidence, is NOT echo", async () => {
  const t = await running();
  t.engine.setReadLanguage("de");
  t.socket.receive("caption", { appointmentId: APPT, from: "doctor", id: "d1", final: true, text: "Hello", srcLang: "en-US", conf: 0.93, tr: { de: "Haben Sie Medikamente genommen" }, at: 1 });
  await settle(); await settle();
  say(t, "nein ich nehme nichts", { en: "no I am not taking anything" }, { lang: "de-DE", conf: 0.9, durationMs: 1500 });
  assert.equal(t.sent("caption").at(-1).text, "nein ich nehme nichts");
  await flushUploads(t);
  assert.equal(t.calls.items.at(-1).flags.suspectedEcho, false);
});

test("while my own voice plays, a partial that matches it is not sent as a caption", async () => {
  const t = await running();
  t.engine.setReadLanguage("de");
  t.socket.receive("caption", { appointmentId: APPT, from: "doctor", id: "d1", final: true, text: "Hello", srcLang: "en-US", conf: 0.93, tr: { de: "Ich habe seit drei Tagen starke Kopfschmerzen" }, at: 1 });
  await settle(); await settle();
  const before = t.sent("caption").length;
  t.rec().say("ich habe seit drei tagen", { en: "i have for three days" }, { lang: "de-DE" });
  assert.equal(t.sent("caption").length, before);
});

// ------------------------------------------------------------------------------------------------------------------ mute, gaps, outages
test("MUTE: the gate closes, the recognizer is untouched, and one 'muted' gap is saved when the person unmutes", async () => {
  const t = await running();
  feedAudio(t.audio, 2);
  t.engine.setMuted(true);
  const recognizers = t.sdk.log.recognizers.length;
  await t.clock.advance(4000);
  feedAudio(t.audio, 3);
  assert.equal(t.sdk.log.pushes[0].written.length, 2, "nothing is sent while muted");
  t.engine.setMuted(false);
  feedAudio(t.audio, 1);
  assert.equal(t.sdk.log.pushes[0].written.length, 3);
  assert.equal(t.sdk.log.recognizers.length, recognizers, "no restart");
  await flushUploads(t);
  const gap = t.calls.items.find((i) => i.type === "gap");
  assert.equal(gap.reason, "muted");
  assert.ok(gap.durationMs >= 3900 && gap.durationMs <= 4100, String(gap.durationMs));
  assert.equal(t.engine.getState().muted, false);
});

test("Azure drops: 'reconnecting' is shown, the call and the saving go on, a recognizer_down gap is saved, and it comes back by itself", async () => {
  const t = await running();
  t.rec().fail();
  assert.equal(t.engine.getState().reconnecting, true);
  assert.equal(t.engine.getState().recognizerStatus, "reconnecting");
  await t.clock.advance(1200);
  await settle();
  assert.equal(t.engine.getState().reconnecting, false);
  assert.equal(t.engine.getState().recognizerStatus, "running");
  say(t, "ich bin wieder da", { en: "I am back" }, { lang: "de-DE", conf: 0.9 });
  await flushUploads(t);
  assert.deepEqual(t.calls.items.map((i) => i.type === "gap" ? i.reason : "line"), ["recognizer_down", "line"]);
});

test("a stalled microphone is saved as a gap with its reason", async () => {
  const t = await running();
  feedAudio(t.audio, 1);
  await t.clock.advance(3500); // no audio for more than 2 s
  feedAudio(t.audio, 1);
  await flushUploads(t);
  const gap = t.calls.items.find((i) => i.type === "gap");
  assert.equal(gap.reason, "mic_stalled");
});

test("a swapped microphone track is read behind the same recognizer", async () => {
  const t = await running();
  const recognizers = t.sdk.log.recognizers.length;
  t.engine.swapMicStream(fakeStream());
  assert.equal(t.audio.sources.length, 2);
  assert.equal(t.sdk.log.recognizers.length, recognizers);
});

// ------------------------------------------------------------------------------------------------------------------ doctor hint
test("the doctor hint: the patient speaks another language and the doctor has translation off", async () => {
  const t = await running({ role: "doctor", browserLanguages: ["en-US"], profileCountry: "US" });
  t.socket.receive("caption", { appointmentId: APPT, from: "patient", id: "p1", final: true, text: "Guten Tag", srcLang: "de-DE", conf: 0.9, tr: { en: "Good day" }, at: 1 });
  assert.deepEqual(t.engine.getState().hint, { srcLang: "de-DE", code: "de", name: "German" });
  t.engine.dismissHint();
  assert.equal(t.engine.getState().hint, null);
  t.socket.receive("caption", { appointmentId: APPT, from: "patient", id: "p2", final: true, text: "Danke", srcLang: "de-DE", conf: 0.9, tr: { en: "Thanks" }, at: 2 });
  assert.equal(t.engine.getState().hint, null, "not asked again straight away");
});

// ------------------------------------------------------------------------------------------------------------------ trouble
test("the notice is retried until it works and stops quietly when the server says the feature is off", async () => {
  let t = build({ noticeScript: [networkError(), httpError(503), { recorded: true }] });
  t.engine.unlockAudio(); await t.engine.start(); await settle();
  assert.equal(t.engine.getState().notice, "sending");
  await t.clock.advance(1000); await t.clock.advance(2000);
  assert.equal(t.engine.getState().notice, "done");
  assert.equal(t.calls.notices.length, 3);

  t = build({ noticeScript: [httpError(404)] });
  t.engine.unlockAudio(); await t.engine.start(); await settle();
  assert.equal(t.engine.getState().notice, "stopped");
  assert.equal(t.engine.getState().phase, "running", "the engine itself carries on");
});

test("the Speech SDK failing to load never breaks the call: the engine reports 'unavailable', and the outage is saved as a gap", async () => {
  const t = build({ loadSdk: async () => { throw new Error("chunk failed to load"); } });
  t.engine.unlockAudio();
  await assert.doesNotReject(t.engine.start());
  assert.equal(t.engine.getState().phase, "unavailable");
  assert.equal(t.calls.notices.length, 1, "the notice is still recorded");
  await t.clock.advance(7000);
  await t.engine.stop();
  const gap = t.calls.items.find((i) => i.type === "gap");
  assert.equal(gap.reason, "recognizer_down");
  assert.ok(gap.durationMs >= 6900);
});

test("a permanently refused token (403) leaves the engine 'unavailable' without a retry storm", async () => {
  const t = build({ tokenError: httpError(403) });
  t.engine.unlockAudio(); await t.engine.start(); await settle();
  assert.equal(t.engine.getState().recognizerStatus, "unavailable");
  await t.clock.advance(10 * 60 * 1000);
  assert.equal(t.calls.gets.length, 1, "asked once, refused for good");
});

test("upload trouble never stops the call: lines wait and go out when the network returns", async () => {
  const t = await running({ transcriptScript: [networkError(), networkError()] });
  say(t, "Guten Tag", { en: "Good day" }, { lang: "de-DE", conf: 0.9 });
  await flushUploads(t);
  assert.equal(t.calls.items.length, 0);
  await t.clock.advance(1100); await t.clock.advance(2100); await t.clock.advance(4100);
  assert.equal(t.calls.items.length, 1);
});

// ------------------------------------------------------------------------------------------------------------------ stop
test("stop: gaps are reported, everything left is uploaded as the final flush, the socket handlers are removed, nothing keeps running", async () => {
  const t = await running();
  t.engine.setMuted(true);
  await t.clock.advance(3000);
  say(t, "last words", { en: "last words" }, { lang: "en-IN", conf: 0.9 });
  const result = await t.engine.stop();
  assert.deepEqual(result, { remaining: 0, stopped: null });
  assert.ok(t.calls.items.some((i) => i.type === "gap" && i.reason === "muted"));
  assert.ok(t.calls.items.some((i) => i.type === "line" && i.original === "last words"));
  assert.ok(t.calls.posts.filter((p) => p.url.endsWith("/transcript")).at(-1).options.keepalive, "the final flush is marked keepalive so it survives the page closing");
  assert.equal(t.socket.count(), 0);
  assert.equal(t.engine.getState().phase, "stopped");
  assert.equal(t.clock.pending(), 0, "no timers left");
  assert.equal(t.sdk.log.recognizers[0].stopped, true);
  await t.engine.stop(); // twice is fine
});

test("stop() before start() does nothing and the engine can still be started afterwards (React's development double-mount)", async () => {
  const t = build();
  await t.engine.stop();
  assert.equal(t.engine.getState().phase, "idle");
  t.engine.unlockAudio();
  await t.engine.start();
  await settle();
  assert.equal(t.engine.getState().phase, "running");
  assert.equal(t.rec().started, true);
});

test("after stop, late events from the socket or from Azure do nothing", async () => {
  const t = await running();
  const rec = t.rec();
  await t.engine.stop();
  const before = t.calls.items.length;
  t.socket.receive("caption", { appointmentId: APPT, from: "doctor", id: "x", final: true, text: "late", srcLang: "en-US", conf: 0.9, tr: { de: "spät" }, at: 1 });
  rec.finish("late words", { en: "late words" }, { conf: 0.9 });
  await t.clock.advance(10000);
  assert.equal(t.calls.items.length, before);
  assert.equal(t.engine.getState().subtitle, null);
});

test("subscribers hear about every change and a failing subscriber cannot break the call", async () => {
  const t = build();
  const seen = [];
  const off = t.engine.subscribe((s) => seen.push(s.phase));
  t.engine.subscribe(() => { throw new Error("bad subscriber"); });
  t.engine.unlockAudio();
  await assert.doesNotReject(t.engine.start());
  assert.ok(seen.includes("running"));
  off();
  const n = seen.length;
  t.engine.setReadLanguage("de");
  assert.equal(seen.length, n, "unsubscribed");
});

// ------------------------------------------------------------------------------------------------------------------ promises about the code
test("nothing in the feature logs or stores anything", () => {
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "features", "translation");
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".js") && f !== "languages.data.js")) {
    const code = fs.readFileSync(path.join(dir, file), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    assert.equal(/\bconsole\s*\./.test(code), false, file + " must not log");
    assert.equal(/localStorage|sessionStorage|indexedDB|document\.cookie/.test(code), false, file + " must not store anything in the browser");
  }
});

test("the Speech SDK is imported in exactly one place, lazily", () => {
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "features", "translation");
  const users = fs.readdirSync(dir).filter((f) => f.endsWith(".js")).filter((f) => /microsoft-cognitiveservices-speech-sdk/.test(fs.readFileSync(path.join(dir, f), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n")));
  assert.deepEqual(users, ["loadSpeechSdk.js"]);
  const src = fs.readFileSync(path.join(dir, "loadSpeechSdk.js"), "utf8");
  assert.match(src, /import\("microsoft-cognitiveservices-speech-sdk"\)/);
  assert.equal(/^import .* from ["']microsoft-cognitiveservices-speech-sdk["']/m.test(src), false, "no static import");
});
