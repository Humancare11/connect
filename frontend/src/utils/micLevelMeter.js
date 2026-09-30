// Local-only mic level metering via the Web Audio API — used by the pre-join
// preview's live level bar, and reusable as-is for the in-call "you're
// muted" reminder later. Reads a 0..1 loudness number off audio already
// present in the browser; nothing is ever sent, recorded, or stored.
export function createMicLevelMeter(stream) {
  const audioTracks = stream?.getAudioTracks?.() ?? [];
  if (audioTracks.length === 0) return null;

  const AudioContextImpl = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextImpl) return null;

  let ctx;
  let source;
  let analyser;
  try {
    ctx = new AudioContextImpl();
    // A dedicated single-track MediaStream — reading levels must never touch
    // (or risk quietly re-enabling) the caller's own enabled/disabled state
    // on the real track.
    source = ctx.createMediaStreamSource(new MediaStream([audioTracks[0]]));
    analyser = ctx.createAnalyser();
    // A bigger window means each RMS read averages over more of the
    // waveform (~43ms at 48kHz) instead of ~11ms — a short window can land
    // on very different points of a periodic signal's cycle from one read
    // to the next, reading anywhere from near-silent to near-max for
    // audio that's actually steady. NOTE: smoothingTimeConstant below only
    // affects getByteFrequencyData, NOT getByteTimeDomainData (time-domain
    // data is always the raw, unsmoothed current buffer per spec) — it's
    // set anyway in case a future caller reads frequency data too; the
    // smoothing that actually matters for getLevel() is the EMA below.
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);
  } catch {
    ctx?.close?.().catch(() => {});
    return null;
  }

  const data = new Uint8Array(analyser.frequencyBinCount);
  let stopped = false;
  let smoothedLevel = 0;

  return {
    // Rough RMS loudness, 0..1 — not a calibrated dB meter, just enough for
    // a visible level bar / a "you're talking" threshold. Exponentially
    // smoothed across calls so a caller polling every animation frame gets
    // a steadily-moving value instead of a jumpy one.
    getLevel() {
      if (stopped) return 0;
      analyser.getByteTimeDomainData(data);
      let sumSquares = 0;
      for (let i = 0; i < data.length; i++) {
        const normalized = (data[i] - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / data.length);
      const raw = Math.min(1, rms * 4); // typical speech RMS is small — scale up so the bar isn't always near-empty
      smoothedLevel = smoothedLevel * 0.7 + raw * 0.3;
      return smoothedLevel;
    },
    stop() {
      if (stopped) return;
      stopped = true;
      try {
        source.disconnect();
        analyser.disconnect();
      } catch {
        // Already disconnected/closed — fine.
      }
      ctx.close().catch(() => {});
    },
  };
}
