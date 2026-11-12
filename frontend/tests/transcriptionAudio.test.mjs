// Mic pipeline, echo filter + breaker, voice queue, ducker, caption protocol. Run: node --test tests/transcriptionAudio.test.mjs (from frontend/)
import test from "node:test";
import assert from "node:assert/strict";
import { downsampleToInt16, createMicPipeline, STALL_MS, CHUNK_SAMPLES } from "../src/features/translation/micPipeline.js";
import { textTrigrams, containment, createEchoFilter, createEchoBreaker } from "../src/features/translation/echoFilter.js";
import { createVoiceQueue, MAX_WAITING } from "../src/features/translation/voiceQueue.js";
import { createDucker, createGainRouter, DUCKED_VOLUME } from "../src/features/translation/ducker.js";
import { createCaptionSender, createLangAnnouncer, createCaptionReceiver } from "../src/features/translation/captionProtocol.js";
import { createClock, settle } from "./helpers/fakeClock.mjs";

// ------------------------------------------------------------------------------------------------------ fakes for the browser audio
function fakeAudio({ sampleRate = 48000, state = "running" } = {}) {
  const listeners = {};
  const ctx = {
    sampleRate, state, destination: { id: "dest" }, resumed: 0, sources: [], proc: null,
    createMediaStreamSource(stream) { const node = { stream, to: null, connect(p) { node.to = p; }, disconnect() { node.to = null; } }; ctx.sources.push(node); return node; },
    createScriptProcessor() { ctx.proc = { onaudioprocess: null, connected: null, connect(d) { this.connected = d; }, disconnect() { this.connected = null; } }; return ctx.proc; },
    resume() { ctx.resumed += 1; ctx.state = "running"; return Promise.resolve(); },
    addEventListener(type, fn) { (listeners[type] ||= new Set()).add(fn); },
    removeEventListener(type, fn) { listeners[type]?.delete(fn); },
    setState(next) { ctx.state = next; [...(listeners.statechange || [])].forEach((fn) => fn()); },
    listenerCount: () => Object.values(listeners).reduce((n, s) => n + s.size, 0),
  };
  return ctx;
}
function fakeStream() {
  const listeners = {};
  const track = {
    readyState: "live",
    addEventListener(type, fn) { (listeners[type] ||= new Set()).add(fn); },
    removeEventListener(type, fn) { listeners[type]?.delete(fn); },
    fire(type) { [...(listeners[type] || [])].forEach((fn) => fn()); },
    listenerCount: () => Object.values(listeners).reduce((n, s) => n + s.size, 0),
  };
  return { track, getAudioTracks: () => [track] };
}
const fakeDoc = () => { const l = new Set(); return { hidden: false, addEventListener: (t, f) => l.add(f), removeEventListener: (t, f) => l.delete(f), fire() { [...l].forEach((f) => f()); }, count: () => l.size }; };
const chunk = (level = 0.1, n = CHUNK_SAMPLES) => ({ inputBuffer: { getChannelData: () => Float32Array.from({ length: n }, (_, i) => Math.sin(i / 10) * level) } });
const loud = (n = CHUNK_SAMPLES) => ({ inputBuffer: { getChannelData: () => Float32Array.from({ length: n }, (_, i) => (i % 2 ? 1 : -1)) } });

function micSetup(over = {}) {
  const clock = createClock();
  const audio = fakeAudio(over.audio);
  const stream = over.stream || fakeStream();
  const doc = over.doc ?? fakeDoc();
  const written = [];
  const gaps = [];
  const stalls = [];
  const pipe = createMicPipeline({ ctx: audio, stream, sink: (ab) => written.push(ab), nowPerf: clock.perf, setTimer: clock.setTimer, clearTimer: clock.clearTimer, doc, onGap: (g) => gaps.push(g), onStall: (s) => stalls.push(s.reason) });
  return { clock, audio, stream, doc, written, gaps, stalls, pipe, feed: (e = chunk()) => audio.proc.onaudioprocess(e) };
}

// ------------------------------------------------------------------------------------------------------ downsampling
test("48 kHz audio is averaged down to 16 kHz as 16-bit integers", () => {
  const out = downsampleToInt16(Float32Array.from({ length: 4800 }, () => 0.5), 3);
  assert.equal(out.length, 1600);
  assert.ok(out.every((v) => v === Math.round(0.5 * 32767) || v === Math.floor(0.5 * 32767)));
  const peak = downsampleToInt16(Float32Array.from([2, -2, 2, -2, 2, -2]), 1);
  assert.deepEqual([...peak], [32767, -32768, 32767, -32768, 32767, -32768], "clipped to the 16-bit range");
  assert.equal(downsampleToInt16(new Float32Array(0), 3).length, 0);
  assert.equal(downsampleToInt16(new Float32Array(441), 441 / 160).length, 160, "44.1 kHz works with a fractional ratio");
});

// ------------------------------------------------------------------------------------------------------ pipeline: flow, mute, swap
test("audio chunks reach the recognizer's sink as 16 kHz audio, and the output stays silent (processor writes nothing)", () => {
  const { audio, written, pipe, feed } = micSetup();
  pipe.start();
  assert.equal(audio.proc.connected, audio.destination, "the processor must be connected for the browser to run it");
  feed(); feed();
  assert.equal(written.length, 2);
  assert.equal(written[0].byteLength, Math.floor(CHUNK_SAMPLES / 3) * 2);
  assert.equal(pipe.stats().chunks, 2);
  pipe.stop();
});

test("MUTE is a gate: nothing is sent while muted, the sink and recognizer are untouched, and a 'muted' gap is reported when it ends", async () => {
  const { clock, written, gaps, pipe, feed } = micSetup();
  pipe.start();
  feed();
  pipe.setMuted(true);
  pipe.setMuted(true); // repeating changes nothing
  await clock.advance(3000);
  feed(); feed();
  assert.equal(written.length, 1, "muted chunks are not sent");
  assert.equal(pipe.stats().gated, 2);
  assert.equal(gaps.length, 0, "the gap is reported when it ENDS");
  pipe.setMuted(false);
  assert.deepEqual(gaps.map((g) => [g.reason, g.durationMs]), [["muted", 3000]]);
  feed();
  assert.equal(written.length, 2, "audio flows again through the same sink");
  assert.equal(pipe.isMuted(), false);
  pipe.stop();
});

test("a person who is muted is never reported as a stalled microphone", async () => {
  const { clock, gaps, stalls, pipe } = micSetup();
  pipe.start();
  pipe.setMuted(true);
  await clock.advance(30000);
  assert.deepEqual(stalls, []);
  pipe.setMuted(false);
  assert.deepEqual(gaps.map((g) => g.reason), ["muted"]);
  pipe.stop();
});

test("stopping while muted still reports the gap", async () => {
  const { clock, gaps, pipe } = micSetup();
  pipe.start();
  pipe.setMuted(true);
  await clock.advance(4000);
  pipe.stop();
  assert.deepEqual(gaps.map((g) => [g.reason, g.durationMs]), [["muted", 4000]]);
});

test("a swapped mic track is read behind the same sink: no restart, no gap", () => {
  const { audio, written, gaps, pipe, feed } = micSetup();
  pipe.start();
  feed();
  const newStream = fakeStream();
  pipe.swapStream(newStream);
  assert.equal(audio.sources.length, 2);
  assert.equal(audio.sources[0].to, null, "the old source is disconnected");
  assert.equal(audio.sources[1].to, audio.proc);
  assert.equal(audio.sources[1].stream, newStream);
  feed();
  assert.equal(written.length, 2);
  assert.equal(gaps.length, 0);
  pipe.stop();
});

// ------------------------------------------------------------------------------------------------------ pipeline: stalls
test("no audio for 2 seconds while not muted is a stall: it is reported, recovery is tried, and the gap is recorded when audio returns", async () => {
  const { clock, audio, gaps, stalls, pipe, feed } = micSetup({ audio: { state: "suspended" } });
  pipe.start();
  feed();
  await clock.advance(STALL_MS + 1500);
  assert.deepEqual(stalls, ["mic_stalled"]);
  assert.ok(audio.resumed >= 1, "the audio context was asked to resume");
  assert.equal(pipe.isStalled(), true);
  assert.equal(gaps.length, 0, "not reported until it ends");
  await clock.advance(4000);
  feed();
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].reason, "mic_stalled");
  assert.ok(gaps[0].durationMs >= 5000 && gaps[0].durationMs <= 9000, String(gaps[0].durationMs));
  assert.equal(pipe.isStalled(), false);
  assert.equal(pipe.stats().stalls, 1);
  pipe.stop();
});

test("the reason is read from what the browser tells us: hidden page, interrupted audio, otherwise stalled mic", async () => {
  let s = micSetup();
  s.pipe.start(); s.feed(); s.doc.hidden = true;
  await s.clock.advance(STALL_MS + 1200);
  assert.deepEqual(s.stalls, ["backgrounded"]); s.pipe.stop();

  s = micSetup();
  s.pipe.start(); s.feed(); s.audio.state = "interrupted";
  s.audio.resume = () => { s.audio.resumed += 1; return Promise.resolve(); }; // iOS may refuse to resume while interrupted
  await s.clock.advance(STALL_MS + 1200);
  assert.deepEqual(s.stalls, ["interrupted"]); s.pipe.stop();

  s = micSetup();
  s.pipe.start(); s.feed();
  await s.clock.advance(STALL_MS + 1200);
  assert.deepEqual(s.stalls, ["mic_stalled"]); s.pipe.stop();
});

test("the audio context going 'interrupted' or the mic track ending starts a gap at once, and the first audio afterwards ends it", async () => {
  let s = micSetup();
  s.pipe.start(); s.feed();
  s.audio.resume = () => { s.audio.resumed += 1; return Promise.resolve(); };
  s.audio.setState("interrupted");
  assert.equal(s.pipe.isStalled(), true);
  await s.clock.advance(1000);
  s.audio.state = "running";
  s.feed();
  assert.deepEqual(s.gaps.map((g) => g.reason), ["interrupted"]);
  s.pipe.stop();

  s = micSetup();
  s.pipe.start(); s.feed();
  s.stream.track.fire("ended");
  assert.equal(s.pipe.isStalled(), true);
  s.feed();
  assert.deepEqual(s.gaps.map((g) => g.reason), ["mic_stalled"]);
  s.pipe.stop();
});

test("coming back to a hidden tab tries to resume the audio", () => {
  const { audio, doc, pipe } = micSetup({ audio: { state: "suspended" } });
  pipe.start();
  doc.hidden = false; doc.fire();
  assert.ok(audio.resumed >= 1);
  pipe.stop();
});

test("clipping is counted: full-scale chunks and the clip rate", () => {
  const { pipe, feed } = micSetup();
  pipe.start();
  feed(chunk(0.2)); feed(loud()); feed(chunk(0.2)); feed(loud());
  const s = pipe.stats();
  assert.equal(s.chunks, 4);
  assert.equal(s.clippedChunks, 2);
  assert.equal(s.clipRate, 0.5);
  assert.ok(s.peak >= 0.99);
  pipe.stop();
});

test("stop() leaves nothing behind: no timers, no listeners, processor disconnected", () => {
  const { clock, audio, stream, doc, pipe } = micSetup();
  pipe.start();
  assert.ok(clock.pending() > 0 && audio.listenerCount() > 0 && stream.track.listenerCount() > 0 && doc.count() > 0);
  pipe.stop();
  assert.equal(clock.pending(), 0);
  assert.equal(audio.listenerCount(), 0);
  assert.equal(stream.track.listenerCount(), 0);
  assert.equal(doc.count(), 0);
  assert.equal(audio.proc.connected, null);
  pipe.stop(); // twice is fine
});

// ------------------------------------------------------------------------------------------------------ echo filter
test("character trigrams keep combining marks and work without spaces (Hindi, Chinese)", () => {
  assert.ok(textTrigrams("मुझे तेज़ सिरदर्द").size > 6, "Devanagari is not shredded into single letters");
  assert.equal(textTrigrams("मुझे").size, 2, "म ु झ े is four characters (two trigrams): the vowel signs are KEPT");
  assert.ok([...textTrigrams("मुझे")].every((g) => /\p{M}/u.test(g)), "every trigram of this word contains a combining mark");
  assert.equal(containment("दिन", "दान"), 0, "words that differ only by a vowel sign are different words");
  assert.ok(containment("मुझे तीन दिन से तेज सिर दर्द है और चक्कर आ रहे हैं", "मुझे 3 दिन से तेज सिरदर्द है और चक्कर आ रहे हैं।") >= 0.8);
  assert.ok(containment("我有三天严重头痛", "我已经有三天严重的头痛了") >= 0.5);
  assert.equal(containment("hello how are you", "guten tag ich habe kopfschmerzen"), 0);
  assert.equal(containment("", "anything"), 0);
  assert.equal(containment("ab", "ab"), 1, "very short texts compare as a whole");
  assert.equal(containment("HELLO, World!", "hello world"), 1, "case and punctuation do not matter");
});

function echoSetup() {
  const clock = createClock();
  return { clock, filter: createEchoFilter({ now: clock.now }) };
}
const SPOKEN = "Ich habe seit drei Tagen starke Kopfschmerzen und mir ist schwindelig";

test("nothing is echo when our own voice is not playing", async () => {
  const { filter } = echoSetup();
  assert.deepEqual(filter.check({ text: SPOKEN, confidence: 0.2, durationMs: 3000 }), { echo: false, reason: null, similarity: 0 });
});

test("while our voice plays: a matching sentence is echo ('match'), an unsure unrelated one is echo ('low_confidence'), a confident unrelated one is a genuine reply", async () => {
  const { clock, filter } = echoSetup();
  filter.voiceStarted(SPOKEN);
  await clock.advance(2500);
  assert.deepEqual(filter.check({ text: "ich habe seit drei tagen starke kopfschmerzen", confidence: 0.9, durationMs: 2500 }).reason, "match");
  assert.equal(filter.check({ text: "mmm hallo ja", confidence: 0.3, durationMs: 1500 }).reason, "low_confidence");
  assert.equal(filter.check({ text: "Nein ich nehme nichts dagegen", confidence: 0.9, durationMs: 1500 }).echo, false, "a real person talking over the voice is NOT echo");
  assert.equal(filter.check({ text: "Nein ich nehme nichts dagegen", confidence: null, durationMs: 1500 }).echo, false, "unknown confidence is not treated as low");
});

test("the same words said LONG after the voice finished are a genuine repeat, not echo; just after it finished they still count", async () => {
  const { clock, filter } = echoSetup();
  const v = filter.voiceStarted(SPOKEN);
  await clock.advance(4000);
  filter.voiceEnded(v);
  await clock.advance(1000);
  assert.equal(filter.check({ text: SPOKEN, confidence: 0.9, durationMs: 1000 }).echo, true, "within the slack after the voice");
  await clock.advance(20000);
  assert.equal(filter.check({ text: SPOKEN, confidence: 0.9, durationMs: 1000 }).echo, false, "20 s later: the person is repeating it themselves");
});

test("overlap is required: a matching sentence while NO voice has played is never echo, even with terrible confidence", async () => {
  const { clock, filter } = echoSetup();
  const v = filter.voiceStarted(SPOKEN);
  filter.voiceEnded(v);
  await clock.advance(30000);
  assert.equal(filter.check({ text: SPOKEN, confidence: 0.05, durationMs: 1000 }).echo, false);
});

test("old voices are forgotten after a minute", async () => {
  const { clock, filter } = echoSetup();
  const v = filter.voiceStarted(SPOKEN);
  filter.voiceEnded(v);
  await clock.advance(90000);
  filter.voiceStarted("something else entirely");
  assert.equal(filter.activeVoices(), 1);
  assert.equal(filter.check({ text: SPOKEN, confidence: 0.9, durationMs: 500 }).echo, false);
  filter.reset();
  assert.equal(filter.activeVoices(), 0);
});

test("the breaker trips on the 4th echo within a minute, once, and old echoes do not count", async () => {
  const clock = createClock();
  const tripped = [];
  const breaker = createEchoBreaker({ now: clock.now, onTrip: () => tripped.push(clock.now()) });
  assert.deepEqual([breaker.record(), breaker.record(), breaker.record()], [false, false, false]);
  assert.equal(breaker.record(), true);
  assert.equal(breaker.isTripped(), true);
  assert.equal(breaker.record(), false, "already tripped: reported once");
  assert.equal(tripped.length, 1);
  breaker.reset();
  assert.equal(breaker.isTripped(), false);
  breaker.record(); await clock.advance(61000); breaker.record(); breaker.record();
  assert.equal(breaker.record(), false, "the first one is more than a minute old: only 3 in the window");
  assert.equal(breaker.record(), true);
});

// ------------------------------------------------------------------------------------------------------ voice queue
function voiceSetup(over = {}) {
  const log = [];
  const gates = [];
  const q = createVoiceQueue({
    speak: (item) => new Promise((resolve, reject) => { log.push("start " + item.text); gates.push({ item, resolve, reject }); }),
    stop: (item) => log.push("stop " + item.text),
    onStart: (i) => log.push("onStart " + i.text), onEnd: (i) => log.push("onEnd " + i.text), onDrop: (i) => log.push("drop " + i.text), onError: (e, i) => log.push("error " + i.text),
    ...over,
  });
  return { log, gates, q };
}

test("sentences are spoken strictly one after the other, in order, never overlapping", async () => {
  const { log, gates, q } = voiceSetup();
  q.enqueue({ text: "A" }); q.enqueue({ text: "B" }); q.enqueue({ text: "C" });
  await settle();
  assert.deepEqual(log.filter((l) => l.startsWith("start")), ["start A"], "only one at a time");
  assert.equal(q.isSpeaking(), true);
  gates[0].resolve(); await settle();
  assert.deepEqual(log.filter((l) => l.startsWith("start")), ["start A", "start B"]);
  gates[1].resolve(); await settle(); gates[2].resolve(); await settle();
  assert.deepEqual(log.filter((l) => l.startsWith("start")), ["start A", "start B", "start C"]);
  assert.equal(q.isSpeaking(), false);
});

test("it never falls far behind: at most 3 wait, the OLDEST waiting one is dropped", async () => {
  const { log, gates, q } = voiceSetup();
  assert.equal(MAX_WAITING, 3);
  for (const t of ["A", "B", "C", "D", "E", "F"]) q.enqueue({ text: t });
  await settle();
  assert.deepEqual(log.filter((l) => l.startsWith("drop")), ["drop B", "drop C"], "A is already playing; B and C were the oldest waiting");
  assert.equal(q.waitingCount(), 3);
  gates[0].resolve(); await settle();
  assert.equal(log.filter((l) => l.startsWith("start"))[1], "start D");
});

test("a sentence that fails to play does not block the ones behind it", async () => {
  const { log, gates, q } = voiceSetup();
  q.enqueue({ text: "A" }); q.enqueue({ text: "B" });
  await settle();
  gates[0].reject(new Error("synthesis failed")); await settle();
  assert.ok(log.includes("error A"));
  assert.ok(log.includes("start B"));
});

test("switching the voice off stops what is playing at once, empties the queue, and later sentences are refused", async () => {
  const { log, gates, q } = voiceSetup();
  q.enqueue({ text: "A" }); q.enqueue({ text: "B" }); q.enqueue({ text: "C" });
  await settle();
  q.setEnabled(false);
  assert.ok(log.includes("stop A"));
  assert.equal(q.waitingCount(), 0);
  assert.equal(q.enqueue({ text: "D" }), false);
  gates[0].resolve(); await settle();
  assert.equal(log.filter((l) => l.startsWith("start")).length, 1, "nothing starts after the voice was turned off");
  q.setEnabled(true);
  assert.equal(q.enqueue({ text: "E" }), true);
  await settle();
  assert.ok(log.includes("start E"));
});

// ------------------------------------------------------------------------------------------------------ ducker
const mediaEl = (honoursVolume = true, volume = 1) => { let v = volume; return { get volume() { return v; }, set volume(x) { if (honoursVolume) v = x; }, srcObject: { id: "remote" }, muted: false }; };

test("desktop: the other person's voice is lowered while the translation plays and restored after", () => {
  const a = mediaEl(true, 1), b = mediaEl(true, 0.6);
  const d = createDucker({ getElements: () => [a, b] });
  d.duck(); d.duck(); // twice is the same as once
  assert.deepEqual([a.volume, b.volume], [DUCKED_VOLUME, DUCKED_VOLUME]);
  assert.equal(d.status().active, true);
  assert.equal(d.status().volumeIgnored, false);
  d.restore();
  assert.deepEqual([a.volume, b.volume], [1, 0.6], "each goes back to ITS OWN volume");
  d.restore();
  assert.equal(d.status().active, false);
});

test("iPhone (volume ignored): by default nothing else is touched, so the call audio can never be cut off", () => {
  const a = mediaEl(false, 1);
  const d = createDucker({ getElements: () => [a] });
  d.duck();
  assert.equal(a.volume, 1);
  assert.equal(a.muted, false, "the element keeps playing normally");
  assert.deepEqual([d.status().volumeIgnored, d.status().usedGain, d.status().gainAllowed], [true, false, false]);
  d.restore();
  assert.equal(a.muted, false);
});

test("iPhone with the gain route explicitly allowed: the element goes through a gain node, and back to full gain afterwards", () => {
  const a = mediaEl(false, 1);
  const gains = [];
  const ctx = { destination: {}, createMediaStreamSource: () => ({ connect() {}, disconnect() {} }), createGain: () => { const g = { gain: { value: 1 }, connect() {}, disconnect() {} }; gains.push(g); return g; } };
  const router = createGainRouter(ctx);
  const d = createDucker({ getElements: () => [a], gainRouter: router, allowGain: true });
  d.duck();
  assert.equal(a.muted, true, "the element is muted so its audio is not played twice");
  assert.equal(gains[0].gain.value, DUCKED_VOLUME);
  assert.equal(d.status().usedGain, true);
  d.restore();
  assert.equal(gains[0].gain.value, 1);
  router.release(a);
  assert.equal(a.muted, false);
});

test("an element that throws, or no elements at all, are harmless", () => {
  const bad = { get volume() { throw new Error("boom"); }, set volume(x) { throw new Error("boom"); } };
  const d = createDucker({ getElements: () => [bad, null, undefined] });
  assert.doesNotThrow(() => { d.duck(); d.restore(); });
  assert.doesNotThrow(() => { createDucker({ getElements: () => null }).duck(); });
});

// ------------------------------------------------------------------------------------------------------ caption sender / announcer
function senderSetup() {
  const clock = createClock();
  const sent = [];
  const sender = createCaptionSender({ send: (m) => sent.push(m), nowPerf: clock.perf, setTimer: clock.setTimer, clearTimer: clock.clearTimer, prefix: "p1" });
  return { clock, sent, sender };
}

test("partials: the first goes at once, the rest are limited to about 4 a second and only the newest waiting one is sent", async () => {
  const { clock, sent, sender } = senderSetup();
  sender.partial({ text: "Gu", tr: { en: "Go" } });
  assert.equal(sent.length, 1);
  sender.partial({ text: "Gut", tr: { en: "Good" } });
  sender.partial({ text: "Guten", tr: { en: "Good da" } });
  sender.partial({ text: "Guten Tag", tr: { en: "Good day" } });
  assert.equal(sent.length, 1, "held back");
  await clock.advance(300);
  assert.equal(sent.length, 2);
  assert.equal(sent[1].text, "Guten Tag", "the newest, not the ones in between");
  assert.ok(sent.every((m) => m.final === false && m.id === "p1-0"));
});

test("an unchanged partial is not sent twice", async () => {
  const { clock, sent, sender } = senderSetup();
  sender.partial({ text: "Hallo", tr: { en: "Hello" } });
  await clock.advance(1000);
  sender.partial({ text: "Hallo", tr: { en: "Hello" } });
  assert.equal(sent.length, 1);
  sender.partial({ text: "Hallo", tr: { en: "Hello there" } });
  assert.equal(sent.length, 2, "same words but a new translation is a change");
});

test("a final is always sent at once, cancels a waiting partial, shares the sentence id, and the next sentence gets a new id", async () => {
  const { clock, sent, sender } = senderSetup();
  sender.partial({ text: "Gu", tr: {} });
  sender.partial({ text: "Gut", tr: {} });
  const id = sender.final({ text: "Guten Tag", srcLang: "de-DE", confidence: 0.91, tr: { en: "Good day" } });
  assert.equal(id, "p1-0");
  await clock.advance(1000);
  assert.deepEqual(sent.map((m) => [m.id, m.final, m.text]), [["p1-0", false, "Gu"], ["p1-0", true, "Guten Tag"]], "the waiting partial never goes out after the final");
  assert.deepEqual([sent[1].srcLang, sent[1].conf, sent[1].tr], ["de-DE", 0.91, { en: "Good day" }]);
  sender.partial({ text: "Wie", tr: {} });
  assert.equal(sent[2].id, "p1-1");
  assert.equal(sender.final({ text: "" }), null, "an empty final is ignored");
  assert.equal(clock.pending(), 0);
});

test("the language announcer says my language, and says it AGAIN when the other person joins or the socket reconnects", () => {
  const sent = [];
  const a = createLangAnnouncer({ send: (m) => sent.push(m) });
  a.resend();
  assert.deepEqual(sent, [], "nothing to say before I have chosen");
  a.announce("none");
  a.announce("hi");
  a.resend();
  a.resend();
  assert.deepEqual(sent, [{ lang: "none" }, { lang: "hi" }, { lang: "hi" }, { lang: "hi" }]);
  assert.equal(a.current(), "hi");
});

// ------------------------------------------------------------------------------------------------------ caption receiver
function receiverSetup({ role = "patient", myLang = "de", voiceOn = true, baseLang = "en", thresholds } = {}) {
  const clock = createClock();
  const out = { transcript: [], subtitles: [], voices: [], hints: [] };
  const state = { myLang, voiceOn, baseLang };
  const rx = createCaptionReceiver({
    role, getMyLang: () => state.myLang, getMyBaseLanguage: () => state.baseLang, isVoiceOn: () => state.voiceOn, ...(thresholds ? { getThresholds: () => thresholds } : {}),
    onTranscript: (e) => out.transcript.push(e), onSubtitle: (s) => out.subtitles.push(s), onVoice: (v) => out.voices.push(v), onHint: (h) => out.hints.push(h), now: clock.now,
  });
  return { clock, out, state, rx };
}
const caption = (extra = {}) => ({ id: "c-1", from: "doctor", final: true, text: "Hello, how are you?", srcLang: "en-US", conf: 0.92, tr: { en: "Hello, how are you?", de: "Hallo, wie geht es Ihnen?" }, at: 1, ...extra });

test("Real voice (the default): nothing is shown or spoken, but the caption still reaches the transcript panel", () => {
  const { out, rx } = receiverSetup({ myLang: "none" });
  rx.handle(caption());
  assert.equal(out.transcript.length, 1);
  assert.deepEqual([out.subtitles.length, out.voices.length], [0, 0]);
});

test("a language is picked: the subtitle is in MY language, and the final is spoken", () => {
  const { out, rx } = receiverSetup({ myLang: "de" });
  rx.handle(caption({ final: false, text: "Hello", tr: { de: "Hall" } }));
  rx.handle(caption());
  assert.deepEqual(out.subtitles.map((s) => [s.text, s.final, s.lighter]), [["Hall", false, false], ["Hallo, wie geht es Ihnen?", true, false]]);
  assert.deepEqual(out.voices, [{ id: "c-1", text: "Hallo, wie geht es Ihnen?", lang: "de" }], "only the final is spoken, once");
});

test("translation keys match my language without regard to case (zh-hans / zh-Hans)", () => {
  const { out, rx } = receiverSetup({ myLang: "zh-Hans" });
  rx.handle(caption({ tr: { en: "x", "zh-hans": "你好" } }));
  assert.equal(out.subtitles[0].text, "你好");
  assert.equal(out.voices[0].lang, "zh-Hans");
});

test("no translation for my language yet: nothing is shown (never the wrong language)", () => {
  const { out, rx } = receiverSetup({ myLang: "fr" });
  rx.handle(caption());
  assert.deepEqual([out.subtitles.length, out.voices.length], [0, 0]);
});

test("confidence: low is shown lighter and spoken; unclear is neither shown nor spoken but is still in the transcript", () => {
  const { out, rx } = receiverSetup({ myLang: "de" });
  rx.handle(caption({ id: "a", conf: 0.55 }));
  rx.handle(caption({ id: "b", conf: 0.2 }));
  rx.handle(caption({ id: "c", conf: null }));
  assert.deepEqual(out.subtitles.map((s) => [s.id, s.lighter]), [["a", true], ["c", false]]);
  assert.deepEqual(out.voices.map((v) => v.id), ["a", "c"]);
  assert.deepEqual(out.transcript.map((t) => [t.id, t.tier]), [["a", "low"], ["b", "unclear"], ["c", "unknown"]]);
});

test("the thresholds come from the server", () => {
  const { out, rx } = receiverSetup({ myLang: "de", thresholds: { unclearBelow: 0.8, lowBelow: 0.95 } });
  rx.handle(caption({ conf: 0.75 }));
  assert.equal(out.subtitles.length, 0, "0.75 is unclear under these thresholds");
});

test("the voice is not spoken when it is switched off, or when the speaker already speaks my language", () => {
  const off = receiverSetup({ myLang: "de", voiceOn: false });
  off.rx.handle(caption());
  assert.deepEqual([off.out.subtitles.length, off.out.voices.length], [1, 0]);
  const same = receiverSetup({ myLang: "en" });
  same.rx.handle(caption());
  assert.deepEqual([same.out.subtitles.length, same.out.voices.length], [1, 0], "subtitle yes, but no voice repeating what I heard in my own language");
});

test("junk captions are ignored", () => {
  const { out, rx } = receiverSetup({ myLang: "de" });
  for (const bad of [null, undefined, {}, { text: 5 }, "x"]) rx.handle(bad);
  assert.deepEqual([out.transcript.length, out.subtitles.length], [0, 0]);
});

test("the doctor hint: the patient speaks another language and translation is off", () => {
  const { out, rx } = receiverSetup({ role: "doctor", myLang: "none", baseLang: "en" });
  rx.handle(caption({ from: "patient", srcLang: "de-DE", text: "Guten Tag", tr: { en: "Good day" }, final: false }));
  assert.equal(out.hints.length, 0, "only on a finished sentence");
  rx.handle(caption({ from: "patient", srcLang: "de-DE", text: "Guten Tag", tr: { en: "Good day" } }));
  assert.deepEqual(out.hints, [{ srcLang: "de-DE", code: "de", name: "German" }]);
  rx.handle(caption({ id: "c-2", from: "patient", srcLang: "de-DE" }));
  rx.handle(caption({ id: "c-3", from: "patient", srcLang: "de-DE" }));
  assert.equal(out.hints.length, 1, "asked once, not every sentence");
});

test("the hint comes back after the cooldown, and names Hindi correctly", async () => {
  const { clock, out, rx } = receiverSetup({ role: "doctor", myLang: "none", baseLang: "en" });
  rx.handle(caption({ from: "patient", srcLang: "hi-IN" }));
  await clock.advance(11 * 60 * 1000);
  rx.handle(caption({ id: "c-9", from: "patient", srcLang: "hi-IN" }));
  assert.deepEqual(out.hints.map((h) => h.name), ["Hindi", "Hindi"]);
});

test("no hint when it would be wrong or pointless: the patient speaks my language, translation is already on, it is unclear, it is the other way round", () => {
  let s = receiverSetup({ role: "doctor", myLang: "none", baseLang: "en" });
  s.rx.handle(caption({ from: "patient", srcLang: "en-IN" }));
  assert.equal(s.out.hints.length, 0, "same language");
  s = receiverSetup({ role: "doctor", myLang: "en", baseLang: "en" });
  s.rx.handle(caption({ from: "patient", srcLang: "de-DE" }));
  assert.equal(s.out.hints.length, 0, "translation is already on");
  s = receiverSetup({ role: "doctor", myLang: "none", baseLang: "en" });
  s.rx.handle(caption({ from: "patient", srcLang: "de-DE", conf: 0.1 }));
  assert.equal(s.out.hints.length, 0, "an unclear guess is not worth interrupting for");
  s = receiverSetup({ role: "patient", myLang: "none", baseLang: "en" });
  s.rx.handle(caption({ from: "doctor", srcLang: "de-DE" }));
  s.rx.handle(caption({ id: "c-5", from: "patient", srcLang: "de-DE" }));
  assert.equal(s.out.hints.length, 0, "patients never get the hint, whoever the caption is from");
  s = receiverSetup({ role: "doctor", myLang: "none", baseLang: "" });
  s.rx.handle(caption({ from: "patient", srcLang: "de-DE" }));
  assert.equal(s.out.hints.length, 0, "unknown own language: no guess");
});
