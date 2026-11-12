// The recognizer controller with the Azure SDK replaced by a fake. Run: node --test tests/transcriptionRecognizer.test.mjs (from frontend/)
import test from "node:test";
import assert from "node:assert/strict";
import { createRecognizerController, IDLE_BEFORE_RESTART_MS } from "../src/features/translation/recognizerController.js";
import { createClock, settle } from "./helpers/fakeClock.mjs";
import { createFakeSdk } from "./helpers/fakeSdk.mjs";

function setup(over = {}) {
  const clock = createClock();
  const sdk = createFakeSdk();
  const out = { partials: [], finals: [], statuses: [], gaps: [], sessions: 0, sinks: [], tokenCalls: [] };
  let sink = null;
  const ctl = createRecognizerController({
    sdk,
    getToken: async (force) => { out.tokenCalls.push(Boolean(force)); return { token: "tok-" + out.tokenCalls.length, region: "eastus" }; },
    attachSink: (fn) => { sink = fn; out.sinks.push(fn ? "attached" : "detached"); },
    onPartial: (p) => out.partials.push(p), onFinal: (f) => out.finals.push(f), onStatus: (s) => out.statuses.push(s),
    onGap: (g) => out.gaps.push(g), onSessionStarted: () => out.sessions++,
    nowPerf: clock.perf, setTimer: clock.setTimer, clearTimer: clock.clearTimer, random: () => 0.5, ...over,
  });
  return { clock, sdk, out, ctl, write: (n = 1) => { for (let i = 0; i < n; i++) sink && sink(new ArrayBuffer(4)); }, sinkIs: () => sink };
}
const CANDS = ["en-IN", "hi-IN", "de-DE"];
const detect = (extra = {}) => ({ mode: "detect", candidates: CANDS, targets: ["en"], ...extra });

test("default (nobody has picked a language): continuous detection among the candidates, translating to English, audio flowing", async () => {
  const { sdk, out, ctl, write } = setup();
  await ctl.start(detect());
  const rec = sdk.log.recognizers[0];
  assert.equal(rec.cfg.props.LIDMODE, "Continuous");
  assert.deepEqual(rec.auto.languages, CANDS);
  assert.deepEqual(rec.cfg.targets, ["en"]);
  assert.equal(rec.cfg.outputFormat, "Detailed", "needed to read the confidence");
  assert.equal(rec.cfg.speechRecognitionLanguage, null, "no fixed language in detect mode");
  assert.equal(rec.started, true);
  assert.deepEqual(out.statuses, ["starting", "running"]);
  write(3);
  assert.equal(sdk.log.pushes[0].written.length, 3, "the microphone audio reaches the recognizer's stream");
  assert.equal(ctl.mode(), "detect");
});

test("a picked language: listens for that one locale directly, no detection", async () => {
  const { sdk, ctl } = setup();
  await ctl.start({ mode: "fixed", locale: "de-DE", targets: ["en", "hi"] });
  const rec = sdk.log.recognizers[0];
  assert.equal(rec.cfg.speechRecognitionLanguage, "de-DE");
  assert.equal(rec.cfg.props.LIDMODE, undefined);
  assert.equal(rec.auto, null);
  assert.deepEqual(rec.cfg.targets, ["en", "hi"]);
});

test("partials and finals are passed on with translations (lower-case keys), the detected language, the confidence and the length", async () => {
  const { sdk, out, ctl } = setup();
  await ctl.start(detect());
  const rec = sdk.log.recognizers[0];
  rec.say("Guten", { EN: "Good" }, { lang: "de-DE" });
  rec.finish("Guten Tag", { EN: "Good day", "zh-Hans": "你好" }, { lang: "de-DE", conf: 0.93, durationMs: 1800 });
  assert.deepEqual(out.partials, [{ text: "Guten", tr: { en: "Good" }, srcLang: "de-DE" }]);
  assert.deepEqual(out.finals, [{ text: "Guten Tag", tr: { en: "Good day", "zh-hans": "你好" }, srcLang: "de-DE", confidence: 0.93, durationMs: 1800 }]);
  rec.finish("Hallo", { en: "Hello" }, { lang: "de-DE" });
  assert.equal(out.finals[1].confidence, null, "no confidence in the result: null, not a guess");
});

test("in fixed mode the source language is the locale; empty and no-match results are ignored", async () => {
  const { sdk, out, ctl } = setup();
  await ctl.start({ mode: "fixed", locale: "hi-IN", targets: ["en"] });
  const rec = sdk.log.recognizers[0];
  rec.finish("नमस्ते", { en: "Hello" }, { conf: 0.8 });
  rec.nothing();
  rec.finish("", { en: "" });
  assert.equal(out.finals.length, 1);
  assert.equal(out.finals[0].srcLang, "hi-IN");
});

test("the other person changes language: targets are added and removed on the RUNNING recognizer, with no restart", async () => {
  const { sdk, ctl } = setup();
  await ctl.start(detect());
  const rec = sdk.log.recognizers[0];
  assert.deepEqual(ctl.setTargets(["en", "es"]), ["en", "es"]);
  assert.deepEqual(rec.added, ["es"]);
  assert.deepEqual(ctl.setTargets(["en", "hi"]), ["en", "hi"]);
  assert.deepEqual([rec.added, rec.removed], [["es", "hi"], ["es"]]);
  assert.deepEqual(ctl.setTargets(["en"]), ["en"]);
  await settle(); await settle();
  assert.equal(sdk.log.recognizers.length, 1, "ONE recognizer for the whole time: nothing was restarted");
  assert.equal(rec.stopped, false);
  assert.deepEqual(rec.targetLanguages, ["en"]);
  assert.deepEqual(ctl.setTargets(["en"]), ["en"], "asking for the same thing changes nothing");
  assert.deepEqual([rec.added.length, rec.removed.length], [2, 2]);
});

test("a target the SDK refuses does not break the call", async () => {
  const { sdk, ctl } = setup();
  await ctl.start(detect());
  sdk.log.recognizers[0].addTargetLanguage = () => { throw new Error("nope"); };
  assert.doesNotThrow(() => ctl.setTargets(["en", "xx"]));
});

test("targets added before a restart carry over into the new session", async () => {
  const { sdk, out, ctl } = setup();
  await ctl.start(detect());
  ctl.setTargets(["en", "es"]);
  ctl.requestRestart({ mode: "fixed", locale: "de-DE", candidates: [] });
  sdk.log.recognizers[0].finish("Guten Tag", { en: "Good day", es: "Buen día" }, { lang: "de-DE", conf: 0.9 });
  await settle();
  assert.equal(sdk.log.recognizers.length, 2);
  assert.deepEqual(sdk.log.recognizers[1].cfg.targets.sort(), ["en", "es"]);
  assert.equal(out.finals.length, 1);
});

// -------------------------------------------------------------------------------------------------------- restarts only at a pause
test("a change of this person's own language is NEVER applied mid-sentence: it waits for the next finished sentence", async () => {
  const { sdk, ctl } = setup();
  await ctl.start(detect());
  const first = sdk.log.recognizers[0];
  ctl.requestRestart({ mode: "fixed", locale: "hi-IN", candidates: [] });
  assert.equal(ctl.hasPendingRestart(), true);
  first.say("Mujhe", { en: "I" }, { lang: "hi-IN" });
  await settle(); await settle();
  assert.equal(sdk.log.recognizers.length, 1, "someone is mid-sentence: nothing happens (not even later)");
  first.finish("Mujhe dard hai", { en: "I am in pain" }, { lang: "hi-IN", conf: 0.8 });
  await settle();
  assert.equal(sdk.log.recognizers.length, 2, "applied right after the sentence finished");
  assert.equal(sdk.log.recognizers[1].cfg.speechRecognitionLanguage, "hi-IN");
  assert.equal(ctl.hasPendingRestart(), false);
  assert.equal(ctl.mode(), "fixed");
});

test("the new session gets the audio BEFORE the old one is stopped, so no audio is lost in the switch", async () => {
  const { sdk, ctl, write, out } = setup();
  await ctl.start(detect());
  const [oldPush] = sdk.log.pushes;
  const events = [];
  const oldRec = sdk.log.recognizers[0];
  const origStop = oldRec.stopContinuousRecognitionAsync.bind(oldRec);
  oldRec.stopContinuousRecognitionAsync = (ok) => { events.push("old stopped"); origStop(ok); };
  ctl.requestRestart({ mode: "fixed", locale: "de-DE", candidates: [] });
  oldRec.finish("x", { en: "x" }, { conf: 0.9 });
  await settle();
  const newPush = sdk.log.pushes[1];
  write(2);
  assert.equal(newPush.written.length, 2, "audio now goes to the new session");
  assert.equal(oldPush.written.length, 0);
  assert.equal(oldPush.closed, true);
  assert.deepEqual(events, ["old stopped"]);
  assert.equal(out.sinks.at(-1), "attached", "the sink was never left detached");
  assert.ok(!out.sinks.slice(1).includes("detached"), "no moment without a sink during the switch");
});

test("with no more speech, the pending change is applied after 1.5 s of quiet; speech keeps pushing it back", async () => {
  const { clock, sdk, ctl } = setup();
  await ctl.start(detect());
  const rec = sdk.log.recognizers[0];
  ctl.requestRestart({ mode: "fixed", locale: "es-ES", candidates: [] });
  await clock.advance(IDLE_BEFORE_RESTART_MS - 200);
  rec.say("Hola", { en: "Hi" }); // still talking: the quiet timer restarts
  await clock.advance(IDLE_BEFORE_RESTART_MS - 200);
  assert.equal(sdk.log.recognizers.length, 1);
  await clock.advance(400);
  await settle();
  assert.equal(sdk.log.recognizers.length, 2);
});

test("events from a session that has been replaced are ignored", async () => {
  const { sdk, out, ctl } = setup();
  await ctl.start(detect());
  const old = sdk.log.recognizers[0];
  ctl.requestRestart({ mode: "fixed", locale: "de-DE", candidates: [] });
  old.finish("a", { en: "a" }, { conf: 0.9 });
  await settle();
  const before = out.finals.length;
  old.finish("late echo of the old session", { en: "late" }, { conf: 0.9 });
  old.fail();
  assert.equal(out.finals.length, before);
  assert.equal(ctl.status(), "running", "a dying old session cannot knock the new one over");
});

// -------------------------------------------------------------------------------------------------------- failures and reconnecting
test("Azure drops the connection: the call goes on, status says reconnecting, a new session is built after a backoff, and the gap is reported", async () => {
  const { clock, sdk, out, ctl } = setup();
  await ctl.start(detect());
  const rec = sdk.log.recognizers[0];
  await clock.advance(5000);
  rec.fail();
  assert.equal(ctl.status(), "reconnecting");
  assert.equal(out.sinks.at(-1), "detached", "no audio is pushed into a dead stream");
  assert.equal(rec.closed || rec.stopped, true);
  await clock.advance(1000);
  await settle();
  assert.equal(sdk.log.recognizers.length, 2);
  assert.equal(ctl.status(), "running");
  assert.equal(out.sinks.at(-1), "attached");
  assert.equal(out.gaps.length, 1);
  assert.equal(out.gaps[0].reason, "recognizer_down");
  assert.ok(out.gaps[0].durationMs >= 900 && out.gaps[0].durationMs <= 1200, String(out.gaps[0].durationMs));
  assert.equal(out.statuses.join(), "starting,running,reconnecting,running");
});

test("repeated failures back off (1 s, 2 s, 4 s...) and the stretch is ONE gap; the second try fetches a fresh token", async () => {
  const { clock, sdk, out, ctl } = setup();
  await ctl.start(detect());
  sdk.failNextStarts = 2;
  sdk.log.recognizers[0].fail();
  await clock.advance(1000); await settle();
  assert.equal(sdk.log.recognizers.length, 2, "first retry after ~1 s (it failed to start)");
  await clock.advance(1900); assert.equal(sdk.log.recognizers.length, 2);
  await clock.advance(200); await settle();
  assert.equal(sdk.log.recognizers.length, 3, "second retry after ~2 s");
  await clock.advance(4000); await settle();
  assert.equal(sdk.log.recognizers.length, 4);
  await settle();
  assert.equal(ctl.status(), "running");
  assert.equal(out.gaps.length, 1, "one stretch, one gap");
  assert.ok(out.tokenCalls.slice(1).some(Boolean), "a fresh token was asked for on a retry");
});

test("end of stream is not an error", async () => {
  const { sdk, ctl } = setup();
  await ctl.start(detect());
  sdk.log.recognizers[0].endOfStream();
  assert.equal(ctl.status(), "running");
});

test("the very first start failing also ends up retrying, and counts as a gap once it works", async () => {
  const { clock, sdk, out, ctl } = setup();
  sdk.failNextStarts = 1;
  await ctl.start(detect());
  assert.equal(ctl.status(), "reconnecting");
  await clock.advance(1000); await settle();
  assert.equal(ctl.status(), "running");
  assert.equal(out.gaps.length, 1);
});

test("if the token manager has been refused for good, the status is 'unavailable' and retrying stops", async () => {
  let unavailable = false;
  const { clock, out, ctl } = setup({ getToken: async () => { unavailable = true; throw new Error("403"); }, isUnavailable: () => unavailable });
  await ctl.start(detect());
  assert.equal(ctl.status(), "unavailable");
  await clock.advance(10 * 60 * 1000);
  assert.equal(clock.pending(), 0, "no retry loop");
  assert.ok(out.statuses.includes("unavailable"));
});

test("a refreshed token is handed to the running recognizer", async () => {
  const { sdk, ctl } = setup();
  await ctl.start(detect());
  ctl.updateToken("fresh-token");
  assert.equal(sdk.log.recognizers[0].authorizationToken, "fresh-token");
  assert.doesNotThrow(() => createRecognizerController({ sdk, getToken: async () => ({}), attachSink() {} }).updateToken("x"), "before any session exists");
});

test("stop(): audio detached, session and stream closed, an open outage is reported, nothing is left running", async () => {
  const { clock, sdk, out, ctl } = setup();
  await ctl.start(detect());
  sdk.log.recognizers[0].fail();
  await clock.advance(300);
  ctl.stop();
  assert.equal(ctl.status(), "stopped");
  assert.equal(out.sinks.at(-1), "detached");
  assert.equal(out.gaps.length, 1, "the unfinished outage is still recorded");
  await clock.advance(5 * 60 * 1000);
  assert.equal(sdk.log.recognizers.length, 1, "no reconnect after stop");
  assert.equal(clock.pending(), 0);

  const second = setup();
  await second.ctl.start(detect());
  second.ctl.stop();
  assert.equal(second.sdk.log.recognizers[0].stopped, true);
  assert.equal(second.sdk.log.pushes[0].closed, true);
});

test("static: the controller never logs", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../src/features/translation/recognizerController.js", import.meta.url), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.equal(/\bconsole\s*\./.test(src), false);
});
