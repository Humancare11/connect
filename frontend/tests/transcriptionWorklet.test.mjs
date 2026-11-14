// Mic pipeline: AudioWorklet path, with a ScriptProcessor fallback. Run: node --test tests/transcriptionWorklet.test.mjs (from frontend/)
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import { createMicPipeline, CHUNK_SAMPLES, WORKLET_URL, WORKLET_NAME } from "../src/features/translation/micPipeline.js";
import { createClock, settle } from "./helpers/fakeClock.mjs";

function setup({ addModule = async () => {}, withWorklet = true } = {}) {
  const clock = createClock();
  const nodes = [];
  let spCreated = 0;
  const ctx = {
    sampleRate: 48000, state: "running", destination: { id: "dest" }, sources: [],
    createMediaStreamSource(stream) { const n = { stream, to: null, connect(p) { n.to = p; }, disconnect() { n.to = null; } }; ctx.sources.push(n); return n; },
    createScriptProcessor() { spCreated += 1; ctx.sp = { onaudioprocess: null, connect() {}, disconnect() {} }; return ctx.sp; },
    resume: () => Promise.resolve(),
    ...(withWorklet ? { audioWorklet: { addModule } } : {}),
  };
  globalThis.AudioWorkletNode = class { constructor(c, name, opts) { this.name = name; this.opts = opts; this.port = { onmessage: null }; this.connected = null; nodes.push(this); } connect(d) { this.connected = d; } disconnect() { this.connected = null; } };
  const written = [];
  const pipe = createMicPipeline({ ctx, stream: { getAudioTracks: () => [] }, sink: (ab) => written.push(ab), nowPerf: clock.perf, setTimer: clock.setTimer, clearTimer: clock.clearTimer, doc: null });
  return { ctx, nodes, written, pipe, clock, spCreated: () => spCreated };
}
const block = (level = 0.1, n = CHUNK_SAMPLES) => Float32Array.from({ length: n }, (_, i) => Math.sin(i / 10) * level);

test("AudioWorklet is used when available: chunks from the worklet reach the sink, the node is connected and fed by the mic", async () => {
  const t = setup();
  t.pipe.start();
  await settle();
  assert.equal(t.nodes.length, 1);
  assert.equal(t.nodes[0].name, WORKLET_NAME);
  assert.equal(t.spCreated(), 0, "no ScriptProcessor when the worklet works");
  assert.equal(t.nodes[0].connected, t.ctx.destination);
  assert.equal(t.ctx.sources.at(-1).to, t.nodes[0], "the mic stream feeds the worklet node");
  t.nodes[0].port.onmessage({ data: block() });
  assert.equal(t.written.length, 1);
  assert.equal(t.written[0].byteLength, Math.floor(CHUNK_SAMPLES / 3) * 2, "16 kHz 16-bit, same as before");
  assert.equal(t.pipe.stats().chunks, 1);
  assert.ok(t.pipe.recentPeak() > 0.05);
  t.pipe.stop();
  assert.equal(t.nodes[0].connected, null);
  assert.equal(t.nodes[0].port.onmessage, null);
});

test("mute is a gate on the worklet path too, and a swapped mic is connected to the same node", async () => {
  const t = setup();
  t.pipe.start(); await settle();
  t.pipe.setMuted(true);
  t.nodes[0].port.onmessage({ data: block() });
  assert.equal(t.written.length, 0);
  t.pipe.setMuted(false);
  const next = { getAudioTracks: () => [] };
  t.pipe.swapStream(next);
  assert.equal(t.ctx.sources.at(-1).stream, next);
  assert.equal(t.ctx.sources.at(-1).to, t.nodes[0]);
  t.nodes[0].port.onmessage({ data: block() });
  assert.equal(t.written.length, 1);
  t.pipe.stop();
});

test("FALLBACK: no AudioWorklet in the browser -> ScriptProcessor, exactly as before", () => {
  const t = setup({ withWorklet: false });
  t.pipe.start();
  assert.equal(t.spCreated(), 1);
  assert.equal(t.nodes.length, 0);
  t.ctx.sp.onaudioprocess({ inputBuffer: { getChannelData: () => block() } });
  assert.equal(t.written.length, 1);
  t.pipe.stop();
});

test("FALLBACK: the worklet module is refused (strict CSP / old browser) -> ScriptProcessor, audio still flows", async () => {
  const t = setup({ addModule: async () => { throw new Error("refused"); } });
  t.pipe.start(); await settle();
  assert.equal(t.spCreated(), 1);
  assert.equal(t.nodes.length, 0);
  t.ctx.sp.onaudioprocess({ inputBuffer: { getChannelData: () => block() } });
  assert.equal(t.written.length, 1);
  assert.equal(t.pipe.stats().worklet, false);
  t.pipe.stop();
});

test("FALLBACK: the worklet fails while running (onprocessorerror) -> switches to ScriptProcessor", async () => {
  const t = setup();
  t.pipe.start(); await settle();
  t.nodes[0].onprocessorerror();
  assert.equal(t.spCreated(), 1);
  assert.equal(t.nodes[0].connected, null);
  t.ctx.sp.onaudioprocess({ inputBuffer: { getChannelData: () => block() } });
  assert.equal(t.written.length, 1);
  t.pipe.stop();
});

test("stopping while the worklet is still loading creates nothing and leaves nothing behind", async () => {
  let release;
  const t = setup({ addModule: () => new Promise((r) => { release = r; }) });
  t.pipe.start();
  t.pipe.stop();
  release(); await settle();
  assert.equal(t.nodes.length, 0);
  assert.equal(t.spCreated(), 0);
  assert.equal(t.ctx.sources.length, 0);
});

test("the page loads the worklet from its own origin (the Content-Security-Policy refuses blob: scripts)", async () => {
  let loaded;
  const t = setup({ addModule: async (u) => { loaded = u; } });
  t.pipe.start(); await settle();
  assert.equal(loaded, "/mic-capture-worklet.js");
  const csp = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.doesNotMatch(csp.match(/script-src[^;]*/)[0], /blob:/, "if blob: is ever allowed this could move back, but the file is simpler and safe");
  t.pipe.stop();
});

test("the worklet code itself: 128-frame blocks are collected into whole chunks, nothing is lost or repeated", () => {
  let Registered; const posts = [];
  const sandbox = {
    AudioWorkletProcessor: class { constructor() { this.port = { postMessage: (m) => posts.push(m) }; } },
    registerProcessor: (name, cls) => { assert.equal(name, WORKLET_NAME); assert.equal(Registered, undefined, "registered once (a second registration makes the browser refuse the module)"); Registered = cls; },
    Float32Array,
  };
  const file = new URL("../public" + WORKLET_URL, import.meta.url);
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox);
  const proc = new Registered({ processorOptions: { chunk: 256 } });
  let counter = 0;
  for (let b = 0; b < 5; b++) { const frame = Float32Array.from({ length: 128 }, () => ++counter); assert.equal(proc.process([[frame]]), true); }
  assert.equal(posts.length, 2, "640 frames = 2 chunks of 256 and 128 left over");
  assert.equal(posts[0].length, 256);
  assert.equal(posts[0][0], 1); assert.equal(posts[0][255], 256); assert.equal(posts[1][0], 257); assert.equal(posts[1][255], 512);
  assert.equal(proc.process([[]]), true, "an empty input keeps the processor alive");
  assert.equal(proc.process([]), true);
});
