// Lost-sentence safety: "didn't catch that" / "not understood" messages, saved "speech not recognised" gaps, the no-match wrong-language
// safety net, and the peer-health relay (tr-status). Run: node --test tests/transcriptionSafetyNet.test.mjs (from frontend/)
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
  const http = {
    async post(url, body) { if (url.endsWith("/transcript-notice")) return { data: { recorded: true } }; items.push(...body.items); return { data: { accepted: body.items.length, duplicates: 0, rejected: [] } }; },
    async get() { return { data: { token: "tok", region: "eastus", expiresInSeconds: 600 } }; },
  };
  const engine = createTranscriptionEngine({
    role: over.role || "patient", appointmentId: APPT, config: { mode: "notice", noticeVersion: "v1", thresholds: { unclearBelow: 0.4, lowBelow: 0.7 } },
    http, socket, loadSdk: async () => sdk, createAudioContext: () => audio, getLocalStream: () => ({ getAudioTracks: () => [{ addEventListener() {}, removeEventListener() {} }] }),
    getRemoteElements: () => [el], browserLanguages: ["en-IN"], profileCountry: "IN", getPeerLevel: () => 0,
    now: clock.now, nowPerf: clock.perf, setTimer: clock.setTimer, clearTimer: clock.clearTimer, random: () => 0.5, doc: null,
  });
  engine.unlockAudio();
  await engine.start();
  await settle();
  const t = {
    engine, clock, sdk, socket, audio, el, items, st: () => engine.getState(), rec: () => sdk.log.recognizers.at(-1),
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
async function listening() { // German patient listening to the English doctor, translation active
  const t = await running();
  t.engine.setReadLanguage("de"); t.peerLang("en");
  await t.clock.advance(500);
  return t;
}

// ------------------------------------------------------------------------------------------------------------------ 1. lost sentence
test("LISTENER: a sentence too unclear to speak shows 'Didn't catch that - please ask them to repeat', an 'unclear' subtitle with the text, and the real voice for 6 s", async () => {
  const t = await listening();
  assert.equal(t.el.muted, true);
  t.caption({ id: "u1", conf: 0.2, text: "mumble", tr: { de: "Gemurmel" } });
  assert.equal(t.st().listenNote, "didnt_catch");
  assert.equal(t.el.muted, false, "the 6 s unmute is kept");
  assert.deepEqual([t.st().subtitle.text, t.st().subtitle.unclear, t.st().subtitle.lighter], ["Gemurmel", true, true]);
  assert.equal(t.audio.bufferSources.length, 0, "never spoken");
  await t.clock.advance(UNCLEAR_HOLD_MS + 600);
  assert.equal(t.st().listenNote, null);
  assert.equal(t.el.muted, true);
});

test("LISTENER: an unclear sentence with no translation still shows its original text as the unclear subtitle", async () => {
  const t = await listening();
  t.caption({ id: "u2", conf: 0.1, text: "mumble", tr: {} });
  assert.equal(t.st().subtitle.text, "mumble");
  assert.equal(t.st().subtitle.unclear, true);
});

test("LISTENER: the other side reports no-match while clearly speaking (tr-status): same message and the real voice for 6 s, then muted again", async () => {
  const t = await listening();
  t.peerStatus("no_match");
  assert.equal(t.st().listenNote, "didnt_catch");
  assert.equal(t.el.muted, false);
  assert.notEqual(t.st().translationStatus, "unavailable");
  await t.clock.advance(UNCLEAR_HOLD_MS + 600);
  assert.equal(t.st().listenNote, null);
  assert.equal(t.el.muted, true);
});

test("the message is not shown to someone on Real voice (no translation): they hear the person anyway", async () => {
  const t = await running();
  t.peerStatus("no_match");
  assert.equal(t.st().listenNote, null);
});

test("SPEAKER: my own unclear sentence shows 'Not understood - please repeat' for a few seconds", async () => {
  const t = await running();
  t.rec().finish("mumble", { en: "mumble" }, { lang: "en-IN", conf: 0.2 });
  assert.equal(t.st().speakNote, "not_understood");
  await t.clock.advance(5600);
  assert.equal(t.st().speakNote, null);
});

test("SPEAKER: no-match while my microphone is clearly loud shows 'Not understood'; in a quiet room it does not", async () => {
  const quiet = await running();
  quiet.noMatch(false);
  assert.equal(quiet.st().speakNote, null);
  assert.deepEqual(quiet.sentStatuses(), []);
  const t = await running();
  t.noMatch(true);
  assert.equal(t.st().speakNote, "not_understood");
});

test("the texts are exactly as specified", () => {
  assert.equal(DIDNT_CATCH_TEXT, "Didn't catch that - please ask them to repeat");
  assert.equal(NOT_UNDERSTOOD_TEXT, "Not understood - please repeat");
  assert.equal(WRONG_LANGUAGE_HINT, "You may be speaking a different language than selected");
});

// ------------------------------------------------------------------------------------------------------------------ 2. saved gaps
test("a run of no-match results while speaking is saved as ONE 'speech not recognised' gap with its times", async () => {
  const t = await running();
  t.noMatch(); await t.clock.advance(1000); t.noMatch(); await t.clock.advance(1000); t.noMatch();
  await t.clock.advance(6000); // the run ends
  await t.clock.advance(2100); // uploaded
  const gaps = t.gaps();
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].reason, "not_recognised");
  assert.ok(gaps[0].durationMs >= 2000, "covers the whole run: " + gaps[0].durationMs);
  assert.equal(typeof gaps[0].ageMs, "number");
});

test("the gap is closed when words are recognised again, and when the call ends", async () => {
  const t = await running();
  t.noMatch(); await t.clock.advance(500);
  t.rec().finish("hello", { en: "hello" }, { lang: "en-IN", conf: 0.9 });
  await t.clock.advance(2100);
  assert.equal(t.gaps().filter((g) => g.reason === "not_recognised").length, 1);
  t.noMatch();
  await t.engine.stop();
  assert.equal(t.gaps().filter((g) => g.reason === "not_recognised").length, 2);
});

test("no-match in a quiet room, or while muted, saves nothing", async () => {
  const t = await running();
  t.noMatch(false);
  t.engine.setMuted(true); t.noMatch(true);
  await t.clock.advance(9000); await t.clock.advance(2100);
  assert.equal(t.gaps().filter((g) => g.reason === "not_recognised").length, 0);
});

test("the transcript view names the gap", () => {
  assert.equal(gapLabel("not_recognised"), "Speech not recognised");
});

// ------------------------------------------------------------------------------------------------------------------ 3. wrong language
test("SAFETY NET: three no-match results while clearly speaking, with a language picked, switch to automatic detection and show the hint", async () => {
  const t = await running();
  t.engine.setReadLanguage("de");
  await settle();
  const before = t.sdk.log.recognizers.length;
  t.noMatch(); await t.clock.advance(2000); t.noMatch();
  assert.equal(t.st().fellBackToDetection, false, "two are not enough");
  await t.clock.advance(2000); t.noMatch();
  assert.equal(t.st().fellBackToDetection, true);
  await t.clock.advance(2000); await settle();
  assert.ok(t.sdk.log.recognizers.length > before);
  assert.equal(t.rec().cfg.props.LIDMODE, "Continuous", "now listening with detection");
  assert.equal(t.st().readLang, "de", "what the person reads is unchanged");
});

test("SAFETY NET: not triggered by quiet no-match, by spread-out ones, or when already detecting", async () => {
  const quiet = await running();
  quiet.engine.setReadLanguage("de");
  for (let i = 0; i < 5; i++) { quiet.noMatch(false); await quiet.clock.advance(1000); }
  assert.equal(quiet.st().fellBackToDetection, false);

  const slow = await running();
  slow.engine.setReadLanguage("de");
  for (let i = 0; i < 4; i++) { slow.noMatch(); await slow.clock.advance(20000); }
  assert.equal(slow.st().fellBackToDetection, false, "30-second window");

  const auto = await running(); // never picked a language: already detecting
  const n = auto.sdk.log.recognizers.length;
  for (let i = 0; i < 4; i++) { auto.noMatch(); await auto.clock.advance(1000); }
  assert.equal(auto.st().fellBackToDetection, false);
  assert.equal(auto.sdk.log.recognizers.length, n);
});

test("SAFETY NET: the low-confidence route still works", async () => {
  const t = await running();
  t.engine.setReadLanguage("de");
  t.rec().finish("fine", { en: "fine" }, { lang: "de-DE", conf: 0.9 }); // the language change is applied at the first pause
  await settle();
  t.rec().finish("a", { en: "a" }, { lang: "de-DE", conf: 0.1 });
  t.rec().finish("b", { en: "b" }, { lang: "de-DE", conf: 0.1 });
  assert.equal(t.st().fellBackToDetection, true);
});

// ------------------------------------------------------------------------------------------------------------------ 4. peer health relay
test("PEER GAP: the listener unmutes the real voice at once when the other side reports stalled / backgrounded / interrupted / down; 'ok' mutes again", async () => {
  for (const status of ["stalled", "backgrounded", "interrupted", "down"]) {
    const t = await listening();
    assert.equal(t.el.muted, true);
    t.peerStatus(status);
    assert.equal(t.el.muted, false, status);
    assert.equal(t.st().fallbackReason, "peer_" + status);
    assert.equal(t.st().translationStatus, "unavailable");
    t.peerStatus("ok");
    assert.equal(t.el.muted, true, status + " recovered");
  }
});

test("PEER GAP: evaluateGuard reasons, and statuses do nothing when translation is not on", async () => {
  assert.equal(evaluateGuard({ readLang: "de", peerReadLang: "en", voiceEnabled: true, breakerTripped: false, phase: "running", recognizerStatus: "running", reconnecting: false, tokenFailed: false, audioState: "running", levelAvailable: true, peerStatus: "stalled", stalled: false, voiceFailed: false, unclearHold: false }).reason, "peer_stalled");
  const t = await running();
  t.peerStatus("stalled");
  assert.equal(t.el.muted, false);
  assert.equal(t.st().translationStatus, "off");
});

test("a status for another appointment is ignored", async () => {
  const t = await listening();
  t.socket.receive("tr-status", { appointmentId: "other", status: "stalled" });
  assert.equal(t.el.muted, true);
});

test("SENDING: my microphone stalling / the app going to the background / Azure going down is announced at once, and 'ok' when it ends", async () => {
  const t = await running();
  t.mic(0.3);
  await t.clock.advance(3500); // no audio for more than 2 s: a stall
  assert.deepEqual(t.sentStatuses(), ["stalled"]);
  t.mic(0.3);
  assert.deepEqual(t.sentStatuses(), ["stalled", "ok"]);
  t.rec().fail(); await settle();
  assert.equal(t.sentStatuses().at(-1), "down");
  await t.clock.advance(60000); await settle();
  t.mic(0.3);
  assert.equal(t.sentStatuses().at(-1), "ok");
});

test("SENDING: no-match is announced every time (each is an event); the status returns to ok after a while; muting myself announces nothing", async () => {
  const t = await running();
  t.noMatch(); t.noMatch();
  assert.deepEqual(t.sentStatuses(), ["no_match", "no_match"]);
  for (let i = 0; i < 14; i++) { t.mic(0.001); await t.clock.advance(500); } // a quiet but live microphone
  assert.equal(t.sentStatuses().at(-1), "ok");
  const n = t.sentStatuses().length;
  t.engine.setMuted(true); await t.clock.advance(3000);
  assert.equal(t.sentStatuses().length, n);
});

test("SENDING: the last problem is repeated when the other person joins or the socket reconnects, and an ok state sends nothing extra", async () => {
  const t = await running();
  t.engine.onPeerJoined();
  assert.deepEqual(t.sentStatuses(), [], "ok is the default: nothing to repeat");
  t.mic(0.3); await t.clock.advance(3500);
  t.engine.onSocketReconnected();
  assert.deepEqual(t.sentStatuses(), ["stalled", "stalled"]);
});

test("status announcer: only changes are sent", () => {
  const sent = [];
  const a = createStatusAnnouncer({ send: (m) => sent.push(m.status) });
  a.set("ok"); a.set("down"); a.set("down"); a.set("ok");
  assert.deepEqual(sent, ["down", "ok"], "ok is the starting state: nothing is sent for it");
  a.set("no_match", { force: true }); a.set("no_match", { force: true });
  assert.deepEqual(sent.slice(2), ["no_match", "no_match"]);
});
