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

function person(role, clock, browserLanguages) {
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
    getRemoteElements: () => [{ muted: false, volume: 1 }], browserLanguages, profileCountry: "IN", getPeerLevel: () => 0.2,
    now: clock.now, nowPerf: clock.perf, setTimer: clock.setTimer, clearTimer: clock.clearTimer, random: () => 0.5, doc: null,
    log: (...a) => logs.push(a),
  });
  return { role, engine, sdk, socket, audio, logs, rec: () => sdk.log.recognizers.at(-1), st: () => engine.getState() };
}

// Joins the two through the server's own parsers. `dropLang` simulates a lost lang-changed from one side.
async function call({ dropLangFrom = null } = {}) {
  const clock = createClock(Date.parse("2026-11-12T10:00:00Z"));
  const doctor = person("doctor", clock, ["en-US"]);
  const patient = person("patient", clock, ["en-US"]);
  const wire = (from, to) => {
    from.socket.emit = (event, payload) => {
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

test("the speaker already speaks the listener's language: the speaker's own words are the subtitle", async () => {
  const c = await call();
  c.doctor.engine.setReadLanguage("en");
  await settle();
  c.finish("I have a headache since monday", {}, { lang: "en-US" }); // Azure gives no translation for English into English
  await settle(); await settle();
  assert.equal(c.doctor.st().subtitle.text, "I have a headache since monday");
  assert.equal(Boolean(c.doctor.st().subtitle.unclear), false);
  assert.equal(c.doctor.st().realVoiceMuted, false);
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
