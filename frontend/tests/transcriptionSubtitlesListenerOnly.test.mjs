// Subtitles for the listener, even when the speaker picked nothing: two real engines (doctor + patient) wired together through the
// backend's real caption parser, with a fake Azure that returns ONLY the translations that were asked for.
// The case from staging: doctor picked English, "Show subtitles" ticked, patient picked nothing and spoke Hindi.
// Run: node --test tests/transcriptionSubtitlesListenerOnly.test.mjs (from frontend/)
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createTranscriptionEngine } from "../src/features/translation/engine.js";
import { createClock, settle } from "./helpers/fakeClock.mjs";
import { createFakeSdk } from "./helpers/fakeSdk.mjs";

const require = createRequire(import.meta.url);
const { parseCaption, parseLangChanged } = require("../../backend/utils/speech/captionRelay.js");
const APPT = "64b7f0c2a1b2c3d4e5f60718";

function person(role, clock, browserLanguages, profileCountry = "IN") {
  const sdk = createFakeSdk();
  const handlers = new Map();
  const logs = [];
  const audio = {
    sampleRate: 48000, state: "running", destination: {}, bufferSources: [],
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }, createScriptProcessor() { return { connect() {}, disconnect() {} }; },
    resume: async () => {}, addEventListener() {}, removeEventListener() {}, decodeAudioData: async () => ({}),
    createBufferSource() { const s = { onended: null, connect() {}, start() {}, stop() { s.onended?.(); }, finish() { s.onended?.(); } }; audio.bufferSources.push(s); return s; },
  };
  const socket = { emit() {}, on: (e, f) => handlers.set(e, f), off() {}, receive: (e, p) => handlers.get(e)?.(p) };
  const engine = createTranscriptionEngine({
    role, appointmentId: APPT, config: { mode: "notice", noticeVersion: "v1" },
    http: { post: async () => ({ data: { recorded: true, accepted: 0, duplicates: 0, rejected: [] } }), get: async () => ({ data: { token: "t", region: "eastus", expiresInSeconds: 600 } }) },
    socket, loadSdk: async () => sdk, createAudioContext: () => audio, getLocalStream: () => ({ getAudioTracks: () => [{ addEventListener() {}, removeEventListener() {} }] }),
    getRemoteElements: () => [{ muted: false, volume: 1 }], browserLanguages, profileCountry, getPeerLevel: () => 0.2,
    now: clock.now, nowPerf: clock.perf, setTimer: clock.setTimer, clearTimer: clock.clearTimer, random: () => 0.5, doc: null,
    log: (...a) => logs.push(a),
  });
  return { role, engine, sdk, socket, audio, logs, sent: [], rec: () => sdk.log.recognizers.at(-1), st: () => engine.getState() };
}

// Joins the two through the server's own parsers. `dropLang` simulates a lost lang-changed from one side.
async function call({ dropLangFrom = null, patientBrowser = ["en-US"], patientCountry = "IN" } = {}) {
  const clock = createClock(Date.parse("2026-11-12T10:00:00Z"));
  const doctor = person("doctor", clock, ["en-US"]);
  const patient = person("patient", clock, patientBrowser, patientCountry);
  const wire = (from, to) => {
    from.socket.emit = (event, payload) => {
      from.sent.push([event, payload]);
      if (event === "caption") {
        const r = parseCaption(payload);
        if (r.ok) to.socket.receive("caption", { appointmentId: APPT, from: from.role, ...r.caption, at: 1 });
      } else if (event === "lang-changed") {
        const r = parseLangChanged(payload);
        if (r.ok && dropLangFrom !== from.role) to.socket.receive("lang-changed", { appointmentId: APPT, lang: r.lang, from: from.role });
      } else if (event === "tr-status") to.socket.receive("tr-status", { ...payload, from: from.role });
    };
  };
  wire(doctor, patient); wire(patient, doctor);
  for (const p of [doctor, patient]) { p.engine.unlockAudio(); await p.engine.start(); await settle(); }
  // what Azure returns on the patient's device: only the targets it was asked for
  const say = (text, all, extra = {}) => { const rec = patient.rec(); rec.say(text, Object.fromEntries(Object.entries(all).filter(([k]) => rec.targetLanguages.includes(k))), extra); };
  const finish = (text, all, extra = {}) => { const rec = patient.rec(); rec.finish(text, Object.fromEntries(Object.entries(all).filter(([k]) => rec.targetLanguages.includes(k))), { conf: 0.9, durationMs: 1500, ...extra }); };
  return { clock, doctor, patient, say, finish };
}

const noText = (logs, ...texts) => { const all = JSON.stringify(logs); for (const t of texts) assert.ok(!all.includes(t), "diagnostics never contain sentence text: " + t); };

test("EXACT staging case: doctor picked English, subtitles ticked, patient picked nothing and speaks Hindi -> every sentence is a subtitle in English", async () => {
  const c = await call();
  assert.equal(c.doctor.st().subtitlesEnabled, true);
  c.doctor.engine.setReadLanguage("en");
  await settle();
  assert.equal(c.patient.st().readLang, "none", "the patient picked nothing");

  c.say("मुझे सिर", { en: "I have a head" }, { lang: "hi-IN" });
  await c.clock.advance(300);
  assert.equal(c.doctor.st().subtitle.text, "I have a head", "the partial is already a subtitle, in English");
  c.finish("मुझे सिरदर्द है", { en: "I have a headache" }, { lang: "hi-IN" });
  await settle(); await settle();
  assert.equal(c.doctor.st().subtitle.text, "I have a headache");
  assert.equal(c.doctor.st().subtitle.final, true);

  c.finish("और बुखार भी है", { en: "and I also have a fever" }, { lang: "hi-IN" });
  await settle(); await settle();
  assert.equal(c.doctor.st().subtitle.text, "and I also have a fever", "the second sentence too");
  assert.equal(c.doctor.st().transcript.filter((e) => e.who === "peer").length, 2);
});

test("the speaker already speaks the listener's language: the speaker's own words are the subtitle AND the AI voice speaks them (one voice)", async () => {
  const c = await call();
  c.doctor.engine.setReadLanguage("en");
  await settle();
  c.finish("I have a headache since monday", {}, { lang: "en-US" }); // Azure gives no translation for English into English
  await settle(); await settle();
  assert.equal(c.doctor.st().subtitle.text, "I have a headache since monday");
  assert.equal(Boolean(c.doctor.st().subtitle.unclear), false);
  await c.clock.advance(600);
  assert.equal(c.doctor.st().realVoiceMuted, true, "the real voice stays muted");
  assert.equal(c.doctor.audio.bufferSources.length, 1, "the AI voice speaks the original text");
  assert.match(c.doctor.sdk.log.synths[0].requests[0], /I have a headache since monday/);
});

test("subtitles switched OFF by the listener: nothing is shown, and the diagnostics say why", async () => {
  const c = await call();
  c.doctor.engine.setReadLanguage("en");
  c.doctor.engine.setSubtitlesEnabled(false);
  c.finish("मुझे सिरदर्द है", { en: "I have a headache" }, { lang: "hi-IN" });
  await settle(); await settle();
  assert.equal(c.doctor.st().subtitle, null);
  assert.ok(c.doctor.logs.some((l) => l[1] && l[1].why === "subtitles_switched_off"));
});

test("a lost lang-changed heals itself: the speaker had no translation for German, the listener says it again, the next sentence has a German subtitle", async () => {
  const c = await call({ dropLangFrom: "doctor" });
  c.doctor.engine.setReadLanguage("de"); // the announcement never reaches the patient's device
  await settle();
  assert.deepEqual(c.patient.rec().targetLanguages, ["en"]);
  c.finish("मुझे सिरदर्द है", { en: "I have a headache", de: "Ich habe Kopfschmerzen" }, { lang: "hi-IN" });
  await settle(); await settle();
  assert.ok(c.doctor.logs.some((l) => l[1] && l[1].outcome === "no_translation_for_my_language"), "the cause is in the diagnostics");
  assert.ok(c.doctor.logs.some((l) => /announced again/.test(String(l[0]))));
  // (the first announcement was dropped by the test wire; the second is let through)
  c.patient.socket.receive("lang-changed", { appointmentId: APPT, lang: "de", from: "doctor" });
  assert.deepEqual([...c.patient.rec().targetLanguages].sort(), ["de", "en"]);
  c.finish("und es tut weh", { en: "and it hurts", de: "und es tut weh" }, { lang: "hi-IN" });
  await settle(); await settle();
  assert.equal(c.doctor.st().subtitle.text, "und es tut weh");
});

test("a finished subtitle stays while its translated voice is still being spoken", async () => {
  const c = await call();
  c.doctor.engine.setReadLanguage("en");
  await settle();
  c.finish("मुझे सिरदर्द है", { en: "I have a headache" }, { lang: "hi-IN" });
  await settle(); await settle();
  assert.equal(c.doctor.audio.bufferSources.length, 1, "the English voice is speaking");
  await c.clock.advance(9000);
  assert.equal(c.doctor.st().subtitle?.text, "I have a headache", "still on screen after the normal 6 s hold");
  c.doctor.audio.bufferSources[0].finish();
  await settle();
  await c.clock.advance(2000);
  assert.equal(c.doctor.st().subtitle, null, "gone once the voice is done");
});

test("diagnostics: caption received (with the languages in it), the listener's language arriving, what was sent, and the subtitle outcome; never any text", async () => {
  const c = await call();
  c.doctor.engine.setReadLanguage("en");
  await settle();
  c.finish("मुझे सिरदर्द है", { en: "I have a headache" }, { lang: "hi-IN" });
  await settle(); await settle();
  const sent = c.patient.logs.find((l) => /caption sent/.test(l[0]));
  assert.deepEqual([sent[1].srcLang, sent[1].translationsSent, sent[1].recognizerTargets], ["hi-IN", ["en"], ["en"]]);
  assert.ok(c.patient.logs.some((l) => /listener language received/.test(l[0]) && l[1].listenerHears === "en"));
  const got = c.doctor.logs.find((l) => /caption received/.test(l[0]) && l[1].final);
  assert.deepEqual([got[1].iHear, got[1].translationsInCaption, got[1].subtitlesOn, got[1].outcome], ["en", ["en"], true, "subtitle"]);
  noText([...c.doctor.logs, ...c.patient.logs], "सिरदर्द", "headache");
});

test("EXACT staging case 2: patient picked nothing, browser en-GB, speaks Hindi; Azure first hears it as English with low confidence. The doctor (English) still gets the English translation, and Hindi is detected next", async () => {
  const c = await call({ patientBrowser: ["en-GB"] });
  c.doctor.engine.setReadLanguage("en");
  await settle(); await c.clock.advance(600); // the first half-second check of the other side's level
  assert.ok(c.patient.rec().auto.languages.includes("hi-IN"), "Hindi is a candidate although the browser says English");

  // 1st and 2nd sentence: Hindi heard as English, low confidence (what Azure did on staging)
  c.finish("Hello. Hello.", { en: "Hello. Hello." }, { lang: "en-GB", conf: 0.55 });
  await settle(); await settle();
  assert.equal(c.doctor.st().realVoiceMuted, true, "translated and muted anyway");
  assert.equal(c.doctor.audio.bufferSources.length, 1, "the English voice speaks it");
  assert.equal(c.doctor.st().subtitle.text, "Hello. Hello.");
  c.doctor.audio.bufferSources[0].finish(); await settle();
  c.finish("Hello.", { en: "Hello." }, { lang: "en-GB", conf: 0.5 });
  await settle(); await c.clock.advance(2000); await settle();

  // the patient's device asked detection again, without English
  assert.equal(c.patient.sdk.log.recognizers.length, 2);
  assert.ok(!c.patient.rec().auto.languages.some((l) => l.startsWith("en")));
  assert.ok(c.patient.logs.some((l) => /detection asked again/.test(l[0])));
  assert.deepEqual([...c.patient.rec().targetLanguages], ["en"], "the English target survived the restart");

  // Hindi is detected now: the doctor gets the translation as subtitle AND voice, with the real voice muted
  c.patient.rec().finish("मुझे तीन दिन से सिरदर्द है", { en: "I have had a headache for three days" }, { lang: "hi-IN", conf: 0.9, durationMs: 2500 });
  await settle(); await settle();
  assert.equal(c.doctor.st().peerSpeechLang, "hi-IN");
  assert.equal(c.doctor.st().subtitle.text, "I have had a headache for three days");
  assert.equal(c.doctor.audio.bufferSources.length, 2);
  assert.equal(c.doctor.st().realVoiceMuted, true);
  assert.equal(c.doctor.st().transcript.filter((e) => e.who === "peer" && e.srcLang === "hi-IN").length, 1, "and it is in the transcript");
});

test("English from a patient, confident or not: the real voice stays muted, the AI voice speaks (one voice, always)", async () => {
  const c = await call({ patientBrowser: ["en-GB"] });
  c.doctor.engine.setReadLanguage("en");
  await settle(); await c.clock.advance(600);
  c.finish("I have a head ache", { en: "I have a headache" }, { lang: "en-GB", conf: 0.6 });
  await settle(); await settle();
  assert.equal(c.doctor.st().realVoiceMuted, true);
  assert.equal(c.doctor.audio.bufferSources.length, 1);
  c.doctor.audio.bufferSources[0].finish(); await settle();
  c.finish("It started on monday", { en: "It started on Monday" }, { lang: "en-GB", conf: 0.93 });
  await settle(); await settle();
  assert.equal(c.doctor.st().realVoiceMuted, true, "a confident English sentence: still muted");
  assert.equal(c.doctor.audio.bufferSources.length, 2, "and spoken by the AI voice");
});

test("INDIAN patient speaking ENGLISH (browser hi-IN + en-GB): the English candidate is en-IN only, it is detected at 0.94, and the English doctor hears the AI voice only", async () => {
  const c = await call({ patientBrowser: ["hi-IN", "en-GB"], patientCountry: "" }); // no profile country: the Indian browser locale decides
  c.doctor.engine.setReadLanguage("en");
  await settle(); await c.clock.advance(600);
  const list = c.patient.rec().auto.languages;
  assert.deepEqual(list.filter((l) => l.startsWith("en")), ["en-IN"], "one English, Indian English: " + list.join(","));
  assert.ok(list.includes("hi-IN"));
  const listening = c.patient.logs.find((l) => /recognizer listening/.test(l[0]));
  assert.deepEqual([listening[1].english, listening[1].englishWhy], ["en-IN", "Indian locale in the browser"], "the diagnostics line says which English and why");
  assert.ok(listening[1].candidates.includes("en-IN"));

  c.finish("I have a headache since monday", {}, { lang: "en-IN", conf: 0.94 });
  await settle(); await settle(); await c.clock.advance(600);
  assert.equal(c.doctor.st().peerSpeechLang, "en-IN");
  assert.equal(c.doctor.st().realVoiceMuted, true, "the real voice stays muted");
  assert.equal(c.doctor.audio.bufferSources.length, 1, "the AI voice speaks the original English text: one voice");
  assert.equal(c.doctor.st().subtitle.text, "I have a headache since monday");
  assert.equal(c.patient.logs.some((l) => /detection asked again/.test(l[0])), false, "no second opinion: nothing was suspect");
  assert.equal(c.patient.st().lockedLang, "en-IN", "a confident sentence locks the speaker on Indian English");
  // and the same patient in Hindi is still found, in the same list
  c.finish("मुझे सिरदर्द है", { en: "I have a headache" }, { lang: "hi-IN", conf: 0.9 });
  await settle(); await settle(); await c.clock.advance(600);
  assert.equal(c.doctor.st().realVoiceMuted, true);
  assert.equal(c.doctor.audio.bufferSources.length, 1);
});

test("PROFILE COUNTRY: an Indian patient with an English-only browser (en-GB) listens for en-IN + hi-IN; the country never leaves the device and only its code is logged", async () => {
  const c = await call({ patientBrowser: ["en-GB"], patientCountry: "IN" });
  const list = c.patient.rec().auto.languages;
  assert.deepEqual(list.filter((l) => l.startsWith("en")), ["en-IN"], "Indian English, not en-GB: " + list.join(","));
  assert.ok(list.includes("hi-IN"));
  const line = c.patient.logs.find((l) => /recognizer listening/.test(l[0]));
  assert.deepEqual([line[1].english, line[1].englishWhy, line[1].profileCountry], ["en-IN", "profile country IN", "IN"]);
  // nothing about the country is sent to the other person
  c.doctor.engine.setReadLanguage("en");
  c.finish("मुझे सिरदर्द है", { en: "I have a headache" }, { lang: "hi-IN" });
  await settle(); await settle();
  const sentPayloads = JSON.stringify(c.patient.sent);
  assert.equal(/country/i.test(sentPayloads), false);
  for (const l of c.doctor.logs) assert.equal(JSON.stringify(l).includes("profileCountry"), l[0] === "[tr-diag] recognizer listening", "only the candidate line carries the code");
  // and a patient with NO country keeps today's behaviour (the browser's English)
  const none = await call({ patientBrowser: ["en-GB"], patientCountry: "" });
  assert.deepEqual(none.patient.rec().auto.languages.filter((l) => l.startsWith("en")), ["en-GB"]);
});

test("SILENT FAILURE, two real engines: the patient's side keeps sending heartbeats and the doctor stays muted for a minute with nobody speaking; when the patient's side goes silent (page frozen, network gone) the doctor gets the real voice back within ~6 s, and muted again when it returns", async () => {
  const c = await call();
  c.doctor.engine.setReadLanguage("en");
  // (the fake microphone is silent, which a real device would report as "stalled": report "ok" here, this test is about the heartbeat)
  const wired = c.patient.socket.emit;
  const okOnly = (e, p) => wired(e, e === "tr-status" ? { ...p, status: "ok" } : p);
  c.patient.socket.emit = okOnly;
  c.doctor.engine.setCallConnected(true);
  c.patient.engine.setCallConnected(true);
  await settle();
  await c.clock.advance(60000);
  assert.equal(c.doctor.st().realVoiceMuted, true, "a minute of silence in the room, heartbeats arriving");
  assert.equal(c.doctor.st().fallbackReason, null);
  // the patient's device stops talking to the server (frozen tab / lost connection) while the call media still looks connected
  const sentBefore = c.patient.sent.length;
  c.patient.socket.emit = () => {};
  await c.clock.advance(5000);
  assert.equal(c.doctor.st().realVoiceMuted, true, "5 s: not yet");
  await c.clock.advance(3000);
  assert.equal(c.doctor.st().realVoiceMuted, false, "about 6 s: the real voice is back");
  assert.equal(c.doctor.st().fallbackReason, "peer_silent");
  assert.equal(c.doctor.st().translationStatus, "unavailable");
  // it returns
  c.patient.socket.emit = okOnly;
  await c.clock.advance(4000);
  assert.equal(c.doctor.st().realVoiceMuted, true, "heartbeats are back: muted again");
  assert.ok(c.patient.sent.length > sentBefore);
});
