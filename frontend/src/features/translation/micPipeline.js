// This person's own microphone -> the recognizer (as 16 kHz mono audio), with the safety and book-keeping a long call needs.
//
//   • We read the call's own mic stream ourselves (Web Audio) and hand the audio to a "sink" (the recognizer's push stream). Because we
//     own the audio, MUTE is just a gate: while muted nothing is sent and the recognizer stays connected (no restart), and a swapped mic
//     track (the person unplugged a headset, or retried the camera) is just a new source behind the same sink.
//   • A gap is recorded for every stretch where nothing was transcribed: the person muted ("muted"), the browser stopped delivering audio
//     ("mic_stalled", "backgrounded", "interrupted"). Each gap is reported once, when it ends (or when the pipeline stops).
//   • Stall detector: no audio arrived for 2 seconds while not muted. The reason is read from what we can see (page hidden, audio context
//     "interrupted", mic track muted or ended) and recovery is tried: resume the audio context.
//   • We never override the user's own MUTE: setMuted() is only ever called from the call's own mute state.
//   • Clipping telemetry: how many chunks touched full scale (the iPhone mic was seen peaking at 1.0).
export const TARGET_RATE = 16000;
export const CHUNK_SAMPLES = 4096;
export const STALL_MS = 2000;
export const CLIP_LEVEL = 0.99;
const WATCHDOG_MS = 1000;

// Averages groups of input samples down to the target rate and converts to 16-bit integers.
export function downsampleToInt16(input, ratio) {
  const n = Math.floor(input.length / ratio);
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * ratio);
    const b = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    let count = 0;
    for (let j = a; j < b; j++) { sum += input[j]; count += 1; }
    const v = Math.max(-1, Math.min(1, count ? sum / count : 0));
    out[i] = v < 0 ? v * 32768 : v * 32767;
  }
  return out;
}

export function createMicPipeline({
  ctx, // an AudioContext (created inside a tap, so it can run)
  stream, // the call's local MediaStream
  sink, // (ArrayBuffer) => void, the recognizer's push stream write
  nowPerf = () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
  doc = typeof document !== "undefined" ? document : null,
  onGap = () => {}, // ({ reason, startedPerf, durationMs }) when a gap ends
  onStall = () => {}, // ({ reason }) when a stall starts (so the UI / engine can react)
} = {}) {
  let src = null;
  let proc = null;
  let started = false;
  let muted = false;
  let lastChunkAt = 0;
  let gap = null; // { reason, startedPerf }
  let watchdog = null;
  let currentStream = stream;
  let offTrack = [];
  let offCtx = null;
  let offDoc = null;
  const peaks = []; // [time, peak] of the last few seconds: how loud this person has been just now
  const stats = { chunks: 0, gated: 0, peak: 0, clippedChunks: 0, stalls: 0, resumes: 0 };

  const ratio = () => (ctx.sampleRate || TARGET_RATE) / TARGET_RATE;

  // startedPerf: when the gap really began (a stall began when the audio last arrived, not when the watchdog noticed).
  function beginGap(reason, startedPerf = nowPerf()) {
    if (gap) return;
    gap = { reason, startedPerf };
    if (reason !== "muted") onStall({ reason }); // the engine tells the other person at once
  }
  function endGap() {
    if (!gap) return;
    const done = { reason: gap.reason, startedPerf: gap.startedPerf, durationMs: Math.max(0, Math.round(nowPerf() - gap.startedPerf)) };
    gap = null;
    onGap(done);
  }

  function stallReason() {
    if (doc && doc.hidden) return "backgrounded";
    if (ctx.state === "interrupted") return "interrupted";
    return "mic_stalled";
  }

  function recover() {
    if (ctx.state !== "running" && typeof ctx.resume === "function") {
      stats.resumes += 1;
      Promise.resolve(ctx.resume()).catch(() => {});
    }
  }

  function onChunk(event) {
    lastChunkAt = nowPerf();
    const input = event.inputBuffer.getChannelData(0);
    if (muted) { stats.gated += 1; return; }
    if (gap && gap.reason !== "muted") endGap(); // audio is flowing again: the stall is over
    let peak = 0;
    for (let k = 0; k < input.length; k += 64) { const a = Math.abs(input[k]); if (a > peak) peak = a; }
    stats.chunks += 1;
    peaks.push([nowPerf(), peak]);
    while (peaks.length && nowPerf() - peaks[0][0] > 5000) peaks.shift();
    if (peak > stats.peak) stats.peak = peak;
    if (peak >= CLIP_LEVEL) stats.clippedChunks += 1;
    const pcm = downsampleToInt16(input, ratio());
    sink(pcm.buffer);
  }

  function tick() {
    watchdog = null;
    if (!started) return;
    if (!muted && lastChunkAt && nowPerf() - lastChunkAt > STALL_MS) {
      if (!gap) { stats.stalls += 1; beginGap(stallReason(), lastChunkAt); }
      recover(); // keeps trying every second while stalled
    }
    watchdog = setTimer(tick, WATCHDOG_MS);
  }

  function watchTrack(mediaStream) {
    offTrack.forEach((off) => off());
    offTrack = [];
    const track = mediaStream && mediaStream.getAudioTracks && mediaStream.getAudioTracks()[0];
    if (!track || !track.addEventListener) return;
    const note = () => { if (!muted && started && !gap) beginGap(stallReason()); };
    track.addEventListener("mute", note);
    track.addEventListener("ended", note);
    offTrack.push(() => track.removeEventListener("mute", note), () => track.removeEventListener("ended", note));
  }

  function connectSource(mediaStream) {
    if (src) { try { src.disconnect(); } catch { /* already gone */ } }
    src = ctx.createMediaStreamSource(mediaStream);
    src.connect(proc);
  }

  return {
    start() {
      if (started) return;
      started = true;
      proc = ctx.createScriptProcessor(CHUNK_SAMPLES, 1, 1);
      proc.onaudioprocess = onChunk;
      connectSource(currentStream);
      proc.connect(ctx.destination); // it writes silence to the output; it must be connected for the browser to run it
      lastChunkAt = nowPerf();
      watchTrack(currentStream);
      if (ctx.addEventListener) {
        const onState = () => { if (!muted && ctx.state !== "running" && !gap) beginGap(stallReason()); if (ctx.state !== "running") recover(); };
        ctx.addEventListener("statechange", onState);
        offCtx = () => ctx.removeEventListener("statechange", onState);
      }
      if (doc && doc.addEventListener) {
        const onVisible = () => { if (!doc.hidden) recover(); };
        doc.addEventListener("visibilitychange", onVisible);
        offDoc = () => doc.removeEventListener("visibilitychange", onVisible);
      }
      watchdog = setTimer(tick, WATCHDOG_MS);
    },
    // The call's own MUTE state. Muted = gate closed, recognizer untouched, a "muted" gap recorded.
    setMuted(value) {
      const next = Boolean(value);
      if (next === muted) return;
      muted = next;
      if (muted) { endGap(); beginGap("muted"); }
      else { endGap(); lastChunkAt = nowPerf(); }
    },
    // The person's mic track was replaced: read the new one behind the same sink. No restart.
    swapStream(newStream) {
      currentStream = newStream;
      if (!started) return;
      connectSource(newStream);
      watchTrack(newStream);
      lastChunkAt = nowPerf();
    },
    stop() {
      if (!started) return;
      started = false;
      clearTimer(watchdog); watchdog = null;
      offTrack.forEach((off) => off()); offTrack = [];
      if (offCtx) offCtx(); if (offDoc) offDoc();
      endGap();
      try { if (proc) { proc.onaudioprocess = null; proc.disconnect(); } if (src) src.disconnect(); } catch { /* already gone */ }
    },
    // The loudest sample of the last `windowMs` (0 when nothing arrived): "is this person clearly speaking?"
    recentPeak(windowMs = 2000) { const from = nowPerf() - windowMs; let m = 0; for (const [t, p] of peaks) if (t >= from && p > m) m = p; return m; },
    isMuted: () => muted,
    isStalled: () => Boolean(gap && gap.reason !== "muted"),
    stats: () => ({ ...stats, clipRate: stats.chunks ? stats.clippedChunks / stats.chunks : 0 }),
  };
}
