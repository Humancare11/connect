// STRICT "one voice, always": the LISTENER's pick alone decides. From the moment a language is picked the other person's real voice is
// muted and only the AI voice is heard (translated, or the speaker's own words when they already speak the listener's language).
// The real voice comes back ONLY on a hard failure (Azure / token / reconnecting / the other side down, stalled or in the background / echo
// breaker / no voice for the language), with "Translation unavailable - you are hearing the original voice".
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
  const logs = [];
  let tokenFails = false;
  const other = over.role === "patient" ? "doctor" : "patient";
  const http = {
    async post(url, body) {
      if (url.endsWith("/transcript-notice")) return { data: { recorded: true } };
      return { data: { accepted: body.items.length, duplicates: 0, rejected: [] } };
    },
    async get() { if (tokenFails) throw httpError(403); return { data: { token: "tok", region: "eastus", expiresInSeconds: 600 } }; },
  };
  const engine = createTranscriptionEngine({
    role: over.role || "doctor", appointmentId: APPT, config: { mode: "notice", noticeVersion: "v1", thresholds: { unclearBelow: 0.4, lowBelow: 0.7 } },
    http, socket, loadSdk: async () => sdk, createAudioContext: () => audio, getLocalStream: () => ({ getAudioTracks: () => [{ addEventListener() {}, removeEventListener() {} }] }),
    getRemoteElements: () => els, browserLanguages: over.browserLanguages || ["en-IN"], profileCountry: "IN",
    getPeerLevel: () => peer.level, log: (...a) => logs.push(a),
    now: clock.now, nowPerf: clock.perf, setTimer: clock.setTimer, clearTimer: clock.clearTimer, random: () => 0.5, doc: null,
  });
  engine.unlockAudio();
  await engine.start();
  await settle();
  return {
    engine, clock, sdk, socket, audio, els, peer, logs, failTokens: () => { tokenFails = true; }, st: () => engine.getState(), rec: () => sdk.log.recognizers.at(-1),
    peerLang: (lang) => socket.receive("lang-changed", { appointmentId: APPT, lang, from: other }),
    caption: (extra = {}) => socket.receive("caption", { appointmentId: APPT, from: other, id: "c" + Math.random(), final: true, text: "x", srcLang: "en-US", conf: 0.9, tr: {}, at: 1, ...extra }),
    tick: async (ms = 500) => { await clock.advance(ms); },
    speaking: async (ms = 1000) => { peer.level = 0.2; await clock.advance(ms); },
    quiet: async (ms = 2000) => { peer.level = 0; await clock.advance(ms); },
  };
}

const spokenTexts = (t) => t.sdk.log.synths.flatMap((s) => s.requests);
const diagLines = (t, re) => t.logs.filter((l) => re.test(l[0]));

// ---------------------------------------------------------------------------------------------------------------- rule 1: muted from the moment a language is picked
test("STRICT 1: the real voice is muted from the moment the listener picks a language - before the speaker said anything or picked anything", async () => {
  const t = await running({ role: "doctor" });
  assert.equal(t.els[0].muted, false, "Real voice (no translation) is the default");
  t.engine.setReadLanguage("en");
  assert.equal(t.els[0].muted, true, "muted at once");
  assert.equal(t.st().realVoiceMuted, true);
  assert.equal(t.st().peerReadLang, "none", "the patient never opened the LANGUAGE panel");
  await t.tick(); await t.speaking(5000);
  assert.equal(t.els[0].muted, true, "and it stays muted while the patient speaks");
  assert.ok(diagLines(t, /real voice muted/).length >= 1, "[tr-diag] says it was muted");
});

// ---------------------------------------------------------------------------------------------------------------- rule 2: same language = AI voice, never the real voice
test("STRICT 2: the patient speaks ENGLISH, the doctor picked English: still muted - the AI voice speaks the original text and it is the subtitle", async () => {
  const t = await running({ role: "doctor" });
  t.engine.setReadLanguage("en");
  await t.speaking();
  t.caption({ id: "e1", text: "I have a headache since monday", srcLang: "en-IN", conf: 0.94, tr: {} });
  await settle(); await settle(); await t.tick();
  assert.equal(t.els[0].muted, true, "the real voice is NOT unmuted for a same-language sentence");
  assert.equal(spokenTexts(t).length, 1, "the AI voice speaks it");
  assert.match(spokenTexts(t)[0], /I have a headache since monday/);
  assert.match(spokenTexts(t)[0], /xml:lang='en-/);
  assert.equal(t.st().subtitle.text, "I have a headache since monday");
  assert.equal(Boolean(t.st().subtitle.unclear), false);
  // the same with a translation that Azure gave for the same language: the translation is spoken, once
  t.audio.bufferSources[0].finish(); await settle();
  t.caption({ id: "e2", text: "it started yesterday", srcLang: "en-GB", conf: 0.9, tr: { en: "it started yesterday" } });
  await settle(); await settle();
  assert.equal(spokenTexts(t).length, 2);
  assert.equal(t.els[0].muted, true);
});

test("STRICT 2b: Hindi, English, Hindi in a row: always muted, always exactly one AI voice per sentence", async () => {
  const t = await running({ role: "doctor" });
  t.engine.setReadLanguage("en");
  await t.speaking();
  const seq = [["a", "hi-IN", "मुझे बुखार है", "I have a fever"], ["b", "en-IN", "and since yesterday", "and since yesterday"], ["c", "hi-IN", "बहुत दर्द है", "it hurts a lot"]];
  for (const [id, lang, text, en] of seq) {
    t.caption({ id, text, srcLang: lang, conf: 0.9, tr: { en } });
    await settle(); await settle();
    assert.equal(t.els[0].muted, true, id);
    t.audio.bufferSources.at(-1).finish(); await settle();
  }
  assert.equal(spokenTexts(t).length, 3);
});

// ---------------------------------------------------------------------------------------------------------------- rule 3: no short unmutes
test("STRICT 3: an unclear sentence shows only 'Didn't catch that - please ask them to repeat'; the real voice is NOT unmuted", async () => {
  const t = await running({ role: "doctor" });
  t.engine.setReadLanguage("en");
  await t.speaking();
  t.caption({ id: "u1", text: "mm", srcLang: "hi-IN", conf: 0.1, tr: { en: "mm" } });
  await settle(); await settle();
  assert.equal(t.st().listenNote, "didnt_catch");
  assert.equal(t.els[0].muted, true);
  assert.equal(t.st().translationStatus === "unavailable", false, "no 'Translation unavailable' either");
  assert.equal(spokenTexts(t).length, 0, "not spoken");
  await t.tick(7000);
  assert.equal(t.st().listenNote, null, "the message fades by itself");
  assert.equal(t.els[0].muted, true);
});

test("STRICT 3b: the other side reports 'no match' (it could not understand a sentence): the same message, the real voice stays muted", async () => {
  const t = await running({ role: "doctor" });
  t.engine.setReadLanguage("en");
  await t.tick();
  t.socket.receive("tr-status", { appointmentId: APPT, status: "no_match", from: "patient" });
  assert.equal(t.st().listenNote, "didnt_catch");
  assert.equal(t.els[0].muted, true);
});

test("STRICT 3c: the speaker side: my own unclear sentence shows 'Not understood - please repeat' and nothing else changes", async () => {
  const t = await running({ role: "patient" });
  t.rec().finish("mm", { en: "mm" }, { lang: "hi-IN", conf: 0.1, durationMs: 800 });
  await settle();
  assert.equal(t.st().speakNote, "not_understood");
});

test("STRICT 3d: NO 8-second rule: the patient keeps speaking for 40 s and nothing arrives - the real voice stays muted", async () => {
  const t = await running({ role: "doctor" });
  t.engine.setReadLanguage("en");
  await t.speaking(40000);
  assert.equal(t.els[0].muted, true);
  assert.equal(t.st().fallbackReason, null);
  assert.notEqual(t.st().translationStatus, "unavailable");
});

// ---------------------------------------------------------------------------------------------------------------- rule 4: hard failures only
test("STRICT 4: hard failures give the real voice back with 'Translation unavailable - you are hearing the original voice', and mute again on recovery", async () => {
  const MESSAGE = "unavailable";
  for (const [name, fail, recover, reason] of [
    ["the other side's recognizer is down", (t) => t.socket.receive("tr-status", { appointmentId: APPT, status: "down", from: "patient" }), (t) => t.socket.receive("tr-status", { appointmentId: APPT, status: "ok", from: "patient" }), "peer_down"],
    ["the other side is stalled", (t) => t.socket.receive("tr-status", { appointmentId: APPT, status: "stalled", from: "patient" }), (t) => t.socket.receive("tr-status", { appointmentId: APPT, status: "ok", from: "patient" }), "peer_stalled"],
    ["the other side is in the background", (t) => t.socket.receive("tr-status", { appointmentId: APPT, status: "backgrounded", from: "patient" }), (t) => t.socket.receive("tr-status", { appointmentId: APPT, status: "ok", from: "patient" }), "peer_backgrounded"],
    ["my own recognizer is reconnecting (Azure down)", (t) => t.rec().fail(), null, "reconnecting"],
    ["audio is blocked", (t) => { t.audio.state = "suspended"; }, (t) => { t.audio.state = "running"; }, "audio_blocked"],
  ]) {
    const t = await running({ role: "doctor" });
    t.engine.setReadLanguage("en");
    await t.tick();
    assert.equal(t.els[0].muted, true, name + ": muted before");
    fail(t); await settle(); await t.tick();
    assert.equal(t.els[0].muted, false, name + ": real voice back");
    assert.equal(t.st().fallbackReason, reason, name);
    assert.equal(t.st().translationStatus, MESSAGE, name);
    assert.ok(diagLines(t, /real voice (unmuted|stays on)/).length >= 1, name + ": [tr-diag] says why");
    if (recover) { recover(t); await settle(); await t.tick(); assert.equal(t.els[0].muted, true, name + ": muted again"); assert.equal(t.st().translationStatus === MESSAGE, false); }
  }
});

test("STRICT 4b: the echo breaker and a language without a voice also give the real voice back", async () => {
  const t = await running({ role: "doctor" });
  t.engine.setReadLanguage("ht"); // Haitian Creole has no voice
  await t.tick();
  assert.equal(t.els[0].muted, false);
  assert.equal(t.st().fallbackReason, "no_voice_for_my_language");
  t.engine.setReadLanguage("en");
  await t.tick();
  assert.equal(t.els[0].muted, true);
});

test("STRICT 4c: the token is refused for good: the real voice comes back", async () => {
  const t = await running({ role: "doctor" });
  t.engine.setReadLanguage("en");
  await t.tick();
  assert.equal(t.els[0].muted, true);
  t.failTokens(); // the scheduled token refresh is refused (403) for good
  await t.quiet(700000); await settle();
  assert.equal(t.els[0].muted, false);
  assert.equal(t.st().fallbackReason, "token_failed");
  assert.equal(t.st().translationStatus, "unavailable");
});

// ---------------------------------------------------------------------------------------------------------------- rule 5
test("STRICT 5: 'Real voice (no translation)': the real voice plays normally and there is no AI voice", async () => {
  const t = await running({ role: "doctor" });
  t.engine.setReadLanguage("en");
  assert.equal(t.els[0].muted, true);
  t.engine.setReadLanguage("none");
  assert.equal(t.els[0].muted, false);
  await t.speaking();
  t.caption({ id: "r1", text: "मुझे बुखार है", srcLang: "hi-IN", conf: 0.9, tr: { en: "I have a fever" } });
  await settle(); await settle();
  assert.equal(spokenTexts(t).length, 0);
  assert.equal(t.st().subtitle, null);
  assert.equal(t.els[0].muted, false);
});

test("the listener switches 'Hear translated voice' off: that is a choice, the real voice plays, no alarm", async () => {
  const t = await running({ role: "doctor" });
  t.engine.setReadLanguage("en");
  t.engine.setVoiceEnabled(false);
  assert.equal(t.els[0].muted, false);
  assert.notEqual(t.st().translationStatus, "unavailable");
});

// ---------------------------------------------------------------------------------------------------------------- the listener's pick reaches the speaker
test("the listener changes language mid-call: it is announced and the next sentence is spoken in the new language", async () => {
  const t = await running({ role: "doctor" });
  t.engine.setReadLanguage("en");
  t.engine.setReadLanguage("de");
  assert.deepEqual(t.socket.emitted.filter(([e]) => e === "lang-changed").map(([, p]) => p.lang), ["none", "en", "de"]);
  await t.speaking();
  t.caption({ id: "d", text: "मुझे बुखार है", srcLang: "hi-IN", conf: 0.9, tr: { en: "I have a fever", de: "Ich habe Fieber" } });
  await settle(); await settle();
  assert.match(spokenTexts(t)[0], /Ich habe Fieber/);
  assert.match(spokenTexts(t)[0], /xml:lang='de-DE'/);
  assert.equal(t.els[0].muted, true);
});

test("SPEAKER picked nothing: the device translates into the listener's language as soon as they pick it, and follows a switch without a restart", async () => {
  const t = await running({ role: "patient", browserLanguages: ["hi-IN", "en-IN"] });
  const rec = t.rec();
  assert.equal(t.st().readLang, "none");
  assert.notEqual(rec.auto, null, "automatic language detection");
  assert.deepEqual(rec.targetLanguages, ["en"]);
  t.peerLang("de");
  assert.deepEqual([...rec.targetLanguages].sort(), ["de", "en"]);
  t.peerLang("fr");
  assert.deepEqual([...rec.targetLanguages].sort(), ["en", "fr"]);
  t.peerLang("none");
  assert.deepEqual(rec.targetLanguages, ["en"]);
  assert.equal(t.sdk.log.recognizers.length, 1, "no restart");
});

// ---------------------------------------------------------------------------------------------------------------- silent failure safety: the heartbeat
const statuses = (t) => t.socket.emitted.filter(([e]) => e === "tr-status").map(([, p]) => p);

test("HEARTBEAT (speaker side): while its recognizer runs and the call is connected, the device sends tr-status every ~3.5 s - the current status, nothing else", async () => {
  const t = await running({ role: "patient" });
  await t.tick(20000);
  const before = statuses(t).length; // (the fake microphone is silent, so one "stalled" change was announced; it is not a heartbeat)
  assert.ok(before <= 1, "no heartbeats before the call is connected");
  t.engine.setCallConnected(true);
  await t.tick(20000);
  const beats = statuses(t).slice(before);
  assert.ok(beats.length >= 5 && beats.length <= 7, "about one every 3.5 s: " + beats.length);
  for (const b of statuses(t)) assert.deepEqual(Object.keys(b).sort(), ["appointmentId", "status"], "no text, no names");
  assert.equal(t.logs.some((l) => /heartbeat|alive/i.test(String(l[0]))), false, "nothing is logged for a heartbeat");
  t.engine.setCallConnected(false);
  const n = statuses(t).length;
  await t.tick(20000);
  assert.equal(statuses(t).length, n, "stops when the call is not connected");
});

test("HEARTBEAT: a heartbeat carries the current status when it is not ok (stalled / no_match are still signs of life)", async () => {
  const t = await running({ role: "patient" });
  t.engine.setCallConnected(true);
  await t.tick(12000);
  const last = statuses(t).slice(-3);
  assert.equal(last.length, 3);
  assert.ok(last.every((s) => s.status === last[0].status && s.status !== "ok"), "not ok (the fake microphone is silent = stalled) and repeated: the listener is told again and again");
});

test("SILENT FAILURE (listener side): no heartbeat, caption or status for 6 s while the call is connected -> the real voice comes back with the message; heartbeats return -> muted again", async () => {
  const t = await running({ role: "doctor" });
  t.engine.setReadLanguage("en");
  t.engine.setCallConnected(true);
  await t.tick(5000);
  assert.equal(t.els[0].muted, true, "not yet: 5 s");
  await t.tick(2000);
  assert.equal(t.els[0].muted, false, "6 s without any sign of life");
  assert.equal(t.st().fallbackReason, "peer_silent");
  assert.equal(t.st().translationStatus, "unavailable");
  assert.ok(t.logs.some((l) => /no sign of life/.test(l[0])), "[tr-diag] says so");
  t.socket.receive("tr-status", { appointmentId: APPT, status: "ok", from: "patient" });
  await t.tick();
  assert.equal(t.els[0].muted, true, "the heartbeat is back: muted again");
  assert.equal(t.st().fallbackReason, null);
  assert.ok(t.logs.some((l) => /is heard again/.test(l[0])));
});

test("SILENT FAILURE: heartbeats every 3.5 s (even with one missed) keep the real voice muted for a long time; a caption counts too", async () => {
  const t = await running({ role: "doctor" });
  t.engine.setReadLanguage("en");
  t.engine.setCallConnected(true);
  for (let i = 0; i < 20; i++) {
    t.socket.receive("tr-status", { appointmentId: APPT, status: "ok", from: "patient" });
    await t.tick(i === 7 ? 5500 : 3500); // one late heartbeat: still under 6 s
    assert.equal(t.els[0].muted, true, "beat " + i);
  }
  t.socket.receive("tr-status", { appointmentId: APPT, status: "ok", from: "patient" });
  await t.tick(5000);
  t.caption({ id: "cap", text: "मुझे बुखार है", srcLang: "hi-IN", conf: 0.9, tr: { en: "I have a fever" } });
  await t.tick(5000);
  assert.equal(t.els[0].muted, true, "the caption counted as a sign of life");
});

test("SILENT FAILURE: only while the call is connected, only when a language is picked, and not when the person chose the real voice", async () => {
  const notConnected = await running({ role: "doctor" });
  notConnected.engine.setReadLanguage("en");
  await notConnected.tick(30000);
  assert.equal(notConnected.els[0].muted, true, "the call is not connected: this is not 'silence'");
  const real = await running({ role: "doctor" });
  real.engine.setCallConnected(true);
  await real.tick(30000);
  assert.equal(real.els[0].muted, false);
  assert.equal(real.st().fallbackReason, null);
  assert.notEqual(real.st().translationStatus, "unavailable", "Real voice: no alarm");
  const off = await running({ role: "doctor" });
  off.engine.setReadLanguage("en"); off.engine.setVoiceEnabled(false); off.engine.setCallConnected(true);
  await off.tick(30000);
  assert.notEqual(off.st().translationStatus, "unavailable", "voice switched off by the person: no alarm");
  // the call drops and returns: the waiting starts again from the new connection
  const t = await running({ role: "doctor" });
  t.engine.setReadLanguage("en"); t.engine.setCallConnected(true);
  await t.tick(7000);
  assert.equal(t.els[0].muted, false);
  t.engine.setCallConnected(false); await t.tick();
  assert.equal(t.els[0].muted, true, "not connected: the failure rule is off, translation as chosen");
  t.engine.setCallConnected(true); await t.tick(3000);
  assert.equal(t.els[0].muted, true, "a fresh 6 s of waiting");
});
