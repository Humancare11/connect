// Sticky speaker language + short candidate list + the one-tap "Which language will you speak?" (Hindi was detected as te, en, gu... on staging).
// Run: node --test tests/transcriptionStickyLanguage.test.mjs (from frontend/)
import test from "node:test";
import assert from "node:assert/strict";
import { createTranscriptionEngine } from "../src/features/translation/engine.js";
import { createStatusAnnouncer } from "../src/features/translation/captionProtocol.js";
import { evaluateGuard, UNCLEAR_HOLD_MS } from "../src/features/translation/realVoiceGuard.js";
import { gapLabel } from "../src/features/translation/transcriptViewModel.js";
import { DIDNT_CATCH_TEXT, NOT_UNDERSTOOD_TEXT, WRONG_LANGUAGE_HINT } from "../src/features/translation/uiModel.js";
import { createClock, settle } from "./helpers/fakeClock.mjs";
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
const element = () => { let m = false; return { volume: 1, get muted() { return m; }, set muted(v) { m = v; } }; };

async function running(over = {}) {
  const clock = createClock(Date.parse("2026-11-12T10:00:00Z"));
  const sdk = createFakeSdk();
  const socket = fakeSocket();
  const audio = fakeAudio();
  const el = element();
  const items = [];
  const logs = [];
  const http = {
    async post(url, body) { if (url.endsWith("/transcript-notice")) return { data: { recorded: true } }; items.push(...body.items); return { data: { accepted: body.items.length, duplicates: 0, rejected: [] } }; },
    async get() { return { data: { token: "tok", region: "eastus", expiresInSeconds: 600 } }; },
  };
  const engine = createTranscriptionEngine({
    role: over.role || "patient", appointmentId: APPT, config: { mode: "notice", noticeVersion: "v1", thresholds: { unclearBelow: 0.4, lowBelow: 0.7 } },
    http, socket, loadSdk: async () => sdk, createAudioContext: () => audio, getLocalStream: () => ({ getAudioTracks: () => [{ addEventListener() {}, removeEventListener() {} }] }),
    getRemoteElements: () => [el], browserLanguages: over.browserLanguages || ["en-IN"], profileCountry: over.profileCountry === undefined ? "IN" : over.profileCountry, getPeerLevel: () => 0, log: (...a) => logs.push(a),
    now: clock.now, nowPerf: clock.perf, setTimer: clock.setTimer, clearTimer: clock.clearTimer, random: () => 0.5, doc: null,
  });
  engine.unlockAudio();
  await engine.start();
  await settle();
  const t = {
    engine, clock, sdk, socket, audio, el, items, logs, st: () => engine.getState(), rec: () => sdk.log.recognizers.at(-1),
    sentStatuses: () => socket.emitted.filter(([e]) => e === "tr-status").map(([, p]) => p.status),
    peerLang: (lang) => socket.receive("lang-changed", { appointmentId: APPT, lang, from: "doctor" }),
    peerStatus: (status) => socket.receive("tr-status", { appointmentId: APPT, status, from: "doctor" }),
    caption: (extra = {}) => socket.receive("caption", { appointmentId: APPT, from: "doctor", id: "c" + Math.random(), final: true, text: "I have a headache", srcLang: "en-US", conf: 0.9, tr: { de: "Ich habe Kopfschmerzen" }, at: 1, ...extra }),
    // my own microphone: loud (speaking) or silent
    mic: (peak) => audio.proc.onaudioprocess({ inputBuffer: { getChannelData: () => Float32Array.from({ length: 4096 }, (_, k) => Math.sin(k / 10) * peak) } }),
    noMatch: (loud = true) => { t.mic(loud ? 0.3 : 0.001); t.rec().nothing(); },
    gaps: () => items.filter((i) => i.type === "gap"),
  };
  return t;
}
const candidatesOf = (rec) => rec.auto.languages;
const lines = (t, re) => t.logs.filter((l) => re.test(l[0]));
// a sentence of mine, as Azure's detection reports it
const say = (t, lang, conf, tr = { en: "x" }, text = "I have had a bad headache since yesterday morning") => t.rec().finish(text, tr, { lang, conf, durationMs: 1500 });
const pause = async (t) => { await t.clock.advance(2000); await settle(); };

// ---------------------------------------------------------------------------------------------------------------- short list
test("the candidate list is SHORT (max 5, no Telugu / Gujarati...), and the [tr-diag] line shows it", async () => {
  const t = await running({ browserLanguages: ["en-GB"], profileCountry: "IN" });
  const list = candidatesOf(t.rec());
  assert.deepEqual(list, ["en-IN", "hi-IN", "bn-IN", "ta-IN"]);
  assert.ok(list.length <= 5);
  for (const l of ["te-IN", "gu-IN", "mr-IN", "kn-IN", "ml-IN", "pa-IN"]) assert.ok(!list.includes(l), l);
  const line = lines(t, /recognizer listening/)[0][1];
  assert.deepEqual([line.mode, line.candidates, line.english, line.profileCountry], ["detect", list, "en-IN", "IN"]);
});

// ---------------------------------------------------------------------------------------------------------------- the exact sequence from staging
test("STAGING SEQUENCE: Hindi heard as hi, te, en, en, te, gu, gu, gu at low confidence: te / gu are never even candidates, and nothing locks on a wrong language", async () => {
  const t = await running({ browserLanguages: ["en-GB"], profileCountry: "IN" });
  t.peerLang("en"); // the doctor listens in English
  const detected = [["hi-IN", 0.62], ["te-IN", 0.55], ["en-IN", 0.48], ["en-IN", 0.5], ["te-IN", 0.52], ["gu-IN", 0.45], ["gu-IN", 0.47], ["gu-IN", 0.44]];
  for (const [lang, conf] of detected) {
    say(t, lang, conf);
    await pause(t);
    for (const rec of t.sdk.log.recognizers) {
      if (rec.auto) for (const bad of ["te-IN", "gu-IN", "mr-IN"]) assert.ok(!rec.auto.languages.includes(bad), bad + " is never a candidate");
    }
    assert.equal(t.st().lockedLang, "", "no sentence was sure enough to lock on (" + lang + " at " + conf + ")");
  }
  assert.ok(t.sdk.log.recognizers.every((r) => !r.auto || r.auto.languages.length <= 5));
});

test("STAGING SEQUENCE, with the Hindi sentence recognised confidently: the speaker locks on hi-IN at the next pause and stays there", async () => {
  const t = await running({ browserLanguages: ["en-GB"], profileCountry: "IN" });
  say(t, "hi-IN", 0.86, { en: "I have a headache" });
  assert.equal(t.st().lockedLang, "hi-IN");
  assert.deepEqual(lines(t, /language locked/).map((l) => [l[1].locale, l[1].why]), [["hi-IN", "one confident long sentence"]]);
  await pause(t);
  const fixed = t.rec();
  assert.equal(fixed.auto, null, "no more detection");
  assert.equal(fixed.cfg.speechRecognitionLanguage, "hi-IN");
  assert.deepEqual([...fixed.targetLanguages], ["en"], "the translation target survived");
  for (let i = 0; i < 5; i++) { fixed.finish("sentence", { en: "sentence" }, { lang: "hi-IN", conf: 0.84 }); await pause(t); }
  assert.equal(t.st().lockedLang, "hi-IN");
  assert.equal(t.sdk.log.recognizers.length, 2, "one switch, no more restarts");
});

// ---------------------------------------------------------------------------------------------------------------- lock rules
test("LOCK: 2 of the first 3 sentences in the same language with normal confidence (>= 0.7)", async () => {
  const t = await running({ browserLanguages: ["en-IN"], profileCountry: "IN" });
  say(t, "hi-IN", 0.72);
  assert.equal(t.st().lockedLang, "", "one is not enough");
  say(t, "ta-IN", 0.75);
  assert.equal(t.st().lockedLang, "");
  say(t, "hi-IN", 0.71);
  assert.equal(t.st().lockedLang, "hi-IN");
  assert.equal(lines(t, /language locked/)[0][1].why, "2 of the first 3 sentences");
});

test("LOCK: not for low confidence, not when the 3 first sentences disagree, and not later than the first 3 (unless one is >= 0.8)", async () => {
  const low = await running({ browserLanguages: ["en-IN"], profileCountry: "IN" });
  say(low, "hi-IN", 0.6); say(low, "hi-IN", 0.65); say(low, "hi-IN", 0.69);
  assert.equal(low.st().lockedLang, "", "low confidence never locks");
  const mixed = await running({ browserLanguages: ["en-IN"], profileCountry: "IN" });
  say(mixed, "hi-IN", 0.75); say(mixed, "ta-IN", 0.75); say(mixed, "bn-IN", 0.75);
  say(mixed, "hi-IN", 0.75);
  assert.equal(mixed.st().lockedLang, "", "the first 3 decide; a 4th normal sentence does not lock");
  say(mixed, "hi-IN", 0.8);
  assert.equal(mixed.st().lockedLang, "hi-IN", "but one sentence of 0.8 or more does, any time");
});

test("LOCK: one sentence of 0.8 or more is enough", async () => {
  const t = await running({ browserLanguages: ["en-IN"], profileCountry: "IN" });
  say(t, "hi-IN", 0.79);
  assert.equal(t.st().lockedLang, "");
  say(t, "hi-IN", 0.8);
  assert.equal(t.st().lockedLang, "hi-IN");
});

test("LOCK: only to a language Azure can transcribe, and the switch happens at the next pause, never mid-sentence", async () => {
  const t = await running({ browserLanguages: ["en-IN"], profileCountry: "IN" });
  say(t, "ht-HT", 0.95);
  assert.equal(t.st().lockedLang, "", "not a transcribable locale");
  const n = t.sdk.log.recognizers.length;
  say(t, "hi-IN", 0.9);
  assert.equal(t.sdk.log.recognizers.length, n, "not yet: the restart waits for the pause");
  await pause(t);
  assert.equal(t.sdk.log.recognizers.length, n + 1);
});

// ---------------------------------------------------------------------------------------------------------------- unlock
test("UNLOCK: 2 of my last 3 sentences low or unclear -> back to detection, logged", async () => {
  const t = await running({ browserLanguages: ["en-IN"], profileCountry: "IN" });
  say(t, "hi-IN", 0.9); await pause(t);
  assert.equal(t.st().lockedLang, "hi-IN");
  say(t, "hi-IN", 0.9);
  t.rec().finish("a", { en: "a" }, { lang: "hi-IN", conf: 0.5 });
  assert.equal(t.st().lockedLang, "hi-IN", "one low sentence is fine");
  t.rec().finish("b", { en: "b" }, { lang: "hi-IN", conf: 0.2 });
  assert.equal(t.st().lockedLang, "");
  assert.deepEqual(lines(t, /language unlocked/).map((l) => [l[1].was, l[1].why]), [["hi-IN", "low confidence in 2 of 3 sentences"]]);
  await pause(t);
  assert.notEqual(t.rec().auto, null, "listening with detection again");
});

test("UNLOCK: 2 loud no-match results in a row unlock at once", async () => {
  const t = await running({ browserLanguages: ["en-IN"], profileCountry: "IN" });
  say(t, "hi-IN", 0.9); await pause(t);
  assert.equal(t.st().lockedLang, "hi-IN");
  t.noMatch(); await t.clock.advance(1000); t.noMatch();
  assert.equal(t.st().lockedLang, "");
  assert.equal(lines(t, /language unlocked/)[0][1].why, "2 results in a row not understood");
  assert.equal(t.st().fellBackToDetection, false, "no 'wrong language picked' hint: nobody picked it, it was a lock");
  await pause(t);
  assert.notEqual(t.rec().auto, null);
});

// ---------------------------------------------------------------------------------------------------------------- the one-tap question
test("SPEAK QUESTION: not answered yet by default; the browser's language is the suggestion; separate from the language I HEAR", async () => {
  const hi = await running({ browserLanguages: ["hi-IN", "en-GB"], profileCountry: "IN" });
  assert.deepEqual([hi.st().speakAsked, hi.st().speakLang, hi.st().speakSuggestion, hi.st().readLang], [false, "none", "hi", "none"]);
  const en = await running({ browserLanguages: ["en-GB"], profileCountry: "IN" });
  assert.equal(en.st().speakSuggestion, "en");
  const de = await running({ browserLanguages: ["de-DE"], profileCountry: "" });
  assert.equal(de.st().speakSuggestion, "");
});

test("SPEAK QUESTION: [Hindi] -> fixed hi-IN recognition (no detection), at the next pause; what I HEAR is untouched", async () => {
  const t = await running({ browserLanguages: ["en-GB"], profileCountry: "IN" });
  t.engine.setReadLanguage("en"); // I want to hear English
  t.engine.setSpeakLanguage("hi");
  assert.deepEqual([t.st().speakAsked, t.st().speakLang, t.st().readLang], [true, "hi", "en"]);
  await pause(t);
  assert.equal(t.rec().auto, null);
  assert.equal(t.rec().cfg.speechRecognitionLanguage, "hi-IN");
  assert.ok(lines(t, /language locked/).some((l) => l[1].locale === "hi-IN" && l[1].why === "the person said so"));
  // and the language I hear does not decide anything about my recognizer
  t.engine.setReadLanguage("de");
  await pause(t);
  assert.equal(t.rec().cfg.speechRecognitionLanguage, "hi-IN");
  assert.equal(t.sdk.log.recognizers.length, 2);
});

test("SPEAK QUESTION: [English] is the person's English (en-IN for an Indian profile); [Other] any transcribable language", async () => {
  const t = await running({ browserLanguages: ["en-GB"], profileCountry: "IN" });
  t.engine.setSpeakLanguage("en"); await pause(t);
  assert.equal(t.rec().cfg.speechRecognitionLanguage, "en-IN");
  t.engine.setSpeakLanguage("ta"); await pause(t);
  assert.equal(t.rec().cfg.speechRecognitionLanguage, "ta-IN");
  const us = await running({ browserLanguages: ["en-US"], profileCountry: "US" });
  us.engine.setSpeakLanguage("en"); await pause(us);
  assert.equal(us.rec().cfg.speechRecognitionLanguage, "en-US");
});

test("SPEAK QUESTION: skipping keeps automatic detection (and the sticky lock); a chosen language is not second-guessed by the lock", async () => {
  const t = await running({ browserLanguages: ["en-IN"], profileCountry: "IN" });
  t.engine.setSpeakLanguage("none");
  assert.deepEqual([t.st().speakAsked, t.st().speakLang], [true, "none"]);
  await pause(t);
  assert.notEqual(t.rec().auto, null, "still detecting");
  say(t, "hi-IN", 0.9);
  assert.equal(t.st().lockedLang, "hi-IN", "the sticky lock still works after a skip");
  const picked = await running({ browserLanguages: ["en-IN"], profileCountry: "IN" });
  picked.engine.setSpeakLanguage("hi"); await pause(picked);
  say(picked, "hi-IN", 0.95);
  assert.equal(picked.st().lockedLang, "", "the person said so: nothing to lock");
});

test("SPEAK QUESTION: a language with no speech support is kept as a note, detection stays on", async () => {
  const t = await running({ browserLanguages: ["en-IN"], profileCountry: "IN" });
  t.engine.setSpeakLanguage("ht");
  assert.equal(t.st().unsupportedSpeech, true);
  await pause(t);
  assert.notEqual(t.rec().auto, null);
});

test("[tr-diag]: language lock / unlock lines carry codes only", async () => {
  const t = await running({ browserLanguages: ["en-IN"], profileCountry: "IN" });
  say(t, "hi-IN", 0.9); await pause(t);
  t.rec().finish("a", { en: "a" }, { lang: "hi-IN", conf: 0.3 }); t.rec().finish("b", { en: "b" }, { lang: "hi-IN", conf: 0.3 });
  const all = JSON.stringify([...lines(t, /language (locked|unlocked)/)]);
  assert.match(all, /language locked/);
  assert.match(all, /language unlocked/);
  for (const l of lines(t, /language (locked|unlocked)/)) assert.ok(Object.keys(l[1]).every((k) => ["locale", "why", "was"].includes(k)), "only codes and reasons: " + Object.keys(l[1]));
});

// ---------------------------------------------------------------------------------------------------------------- staging: "Hello" x3
const hello = (t, conf = 0.9) => t.rec().finish("Hello", { en: "Hello" }, { lang: "hi-IN", conf, durationMs: 800 });

test("STAGING 'Hello' x3 heard as Hindi: never locks, and later English and Hindi sentences are all captioned", async () => {
  const t = await running({ browserLanguages: ["en-IN"], profileCountry: "IN" });
  hello(t); hello(t); hello(t);
  assert.equal(t.st().lockedLang, "", "short greetings never lock");
  await pause(t);
  assert.notEqual(t.rec().auto, null, "still detecting");
  const before = t.st().transcript.filter((r) => r.who === "me").length;
  say(t, "en-IN", 0.9, { hi: "x" }, "My head has been hurting for two days");
  say(t, "hi-IN", 0.85, { en: "x" }, "मुझे दो दिन से सिर में दर्द है");
  const mine = t.st().transcript.filter((r) => r.who === "me");
  assert.equal(mine.length - before, 2, "both sentences produced captions");
});

test("LOCK: greetings and fillers never count, even when spoken slowly; 4 words or 1.5 s are needed; the 0.8 shortcut is for long sentences only", async () => {
  const t = await running({ browserLanguages: ["en-IN"], profileCountry: "IN" });
  for (const w of ["hello", "hi", "okay", "haan", "हैलो", "नमस्ते", "thank you", "good morning"]) {
    t.rec().finish(w, { en: w }, { lang: "hi-IN", conf: 0.95, durationMs: 3000 });
  }
  assert.equal(t.st().lockedLang, "");
  t.rec().finish("my head hurts", { en: "x" }, { lang: "hi-IN", conf: 0.95, durationMs: 900 });
  assert.equal(t.st().lockedLang, "", "3 words and under 1.5 s do not count");
  t.rec().finish("my head hurts a lot", { en: "x" }, { lang: "hi-IN", conf: 0.95, durationMs: 1800 });
  assert.equal(t.st().lockedLang, "", "a qualifying sentence of 0.95 that is not long does not lock alone");
  t.rec().finish("my head hurts a lot", { en: "x" }, { lang: "hi-IN", conf: 0.72, durationMs: 1800 });
  assert.equal(t.st().lockedLang, "hi-IN", "2 qualifying sentences at >= 0.7 lock");
});

test("UNLOCK: locked on Hindi but the person speaks English -> 2 no-match results unlock at once and detection resumes", async () => {
  const t = await running({ browserLanguages: ["en-IN"], profileCountry: "IN" });
  say(t, "hi-IN", 0.9); await pause(t);
  assert.equal(t.st().lockedLang, "hi-IN");
  t.noMatch(); assert.equal(t.st().lockedLang, "hi-IN", "one is not enough");
  t.noMatch(); assert.equal(t.st().lockedLang, "");
  assert.match(lines(t, /language unlocked/)[0][1].why, /not understood/);
  await pause(t);
  assert.notEqual(t.rec().auto, null);
});

test("UNLOCK: 2 unclear or empty sentences in a row unlock; a good one in between resets the count", async () => {
  const t = await running({ browserLanguages: ["en-IN"], profileCountry: "IN" });
  say(t, "hi-IN", 0.9); await pause(t);
  t.rec().finish("a b", { en: "x" }, { lang: "hi-IN", conf: 0.3 });
  say(t, "hi-IN", 0.9); say(t, "hi-IN", 0.9);
  t.rec().finish("c d", { en: "x" }, { lang: "hi-IN", conf: 0.3 });
  assert.equal(t.st().lockedLang, "hi-IN", "not in a row");
  t.rec().finish("e f", { en: "x" }, { lang: "hi-IN", conf: 0.2 });
  assert.equal(t.st().lockedLang, "", "two unclear in a row");
});

test("UNLOCK: a loud microphone with no result at all for ~5 s unlocks immediately", async () => {
  const t = await running({ browserLanguages: ["en-IN"], profileCountry: "IN" });
  say(t, "hi-IN", 0.9); await pause(t);
  assert.equal(t.st().lockedLang, "hi-IN");
  for (let i = 0; i < 12; i++) { t.mic(0.3); await t.clock.advance(500); }
  assert.equal(t.st().lockedLang, "");
  assert.match(lines(t, /language unlocked/)[0][1].why, /no result/);
});
