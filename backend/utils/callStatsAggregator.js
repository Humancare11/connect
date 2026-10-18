// utils/callStatsAggregator.js
//
// Quality stats for the admin call report. Clients send a compact sample every
// 30s (every ~3s while an admin is watching live); the server never stores
// samples. It keeps a small running aggregate per participant in memory and
// writes it as ONE update (see callReportRecorder) - so the database sees at
// most about one write per participant per minute however chatty the clients are.
//
// Everything a client sends is attacker-controlled: every field is range
// checked and anything implausible is dropped (never clamped into the data).

const ICE_TYPES = ["host", "srflx", "prflx", "relay"];
const QUALITIES = ["good", "weak", "poor", "unknown"];

const LIMITS = {
  rtt: { min: 0, max: 60_000 }, // ms
  packetLoss: { min: 0, max: 1 }, // ratio
  jitter: { min: 0, max: 60_000 }, // ms
  bitrateKbps: { min: 0, max: 100_000 },
};

const num = (value, { min, max }) =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null;

// -> a clean sample, or null if there is nothing usable in it.
function sanitizeStatsSample(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const sample = {
    rtt: num(raw.rtt, LIMITS.rtt),
    packetLoss: num(raw.packetLoss, LIMITS.packetLoss),
    jitter: num(raw.jitter, LIMITS.jitter),
    bitrateKbps: num(raw.bitrateKbps, LIMITS.bitrateKbps),
    iceType: ICE_TYPES.includes(raw.iceType) ? raw.iceType : "",
    quality: QUALITIES.includes(raw.quality) ? raw.quality : "unknown",
    connectionState: typeof raw.connectionState === "string" ? raw.connectionState.replace(/[^a-z-]/gi, "").slice(0, 20) : "",
    outKbps: num(raw.outKbps, LIMITS.bitrateKbps),
    resolution: typeof raw.resolution === "string" && /^\d{2,5}x\d{2,5}$/.test(raw.resolution) ? raw.resolution : "",
    reconnects: num(raw.reconnects, { min: 0, max: 1000 }),
    micOn: typeof raw.micOn === "boolean" ? raw.micOn : null,
    camOn: typeof raw.camOn === "boolean" ? raw.camOn : null,
  };
  const hasData = sample.rtt !== null || sample.packetLoss !== null || sample.jitter !== null || sample.bitrateKbps !== null || sample.iceType;
  return hasData ? sample : null;
}

// Running aggregate of folded samples since the last flush.
function createPendingStats() {
  const fresh = () => ({
    n: 0,
    rtt: { sum: 0, n: 0, min: Infinity, max: -Infinity },
    loss: { sum: 0, n: 0, min: Infinity, max: -Infinity },
    jitter: { sum: 0, n: 0, min: Infinity, max: -Infinity },
    bitrate: { sum: 0, n: 0, min: Infinity, max: -Infinity },
    ice: {},
    quality: {},
    lastIceType: "",
    lastQuality: "",
    lastSampleAt: 0,
  });
  let agg = fresh();

  const fold = (m, v) => {
    if (v === null) return;
    m.sum += v;
    m.n += 1;
    if (v < m.min) m.min = v;
    if (v > m.max) m.max = v;
  };

  return {
    add(sample, at) {
      agg.n += 1;
      fold(agg.rtt, sample.rtt);
      fold(agg.loss, sample.packetLoss);
      fold(agg.jitter, sample.jitter);
      fold(agg.bitrate, sample.bitrateKbps);
      if (sample.iceType) {
        agg.ice[sample.iceType] = (agg.ice[sample.iceType] || 0) + 1;
        agg.lastIceType = sample.iceType;
      }
      agg.quality[sample.quality] = (agg.quality[sample.quality] || 0) + 1;
      agg.lastQuality = sample.quality;
      agg.lastSampleAt = at;
    },
    get size() {
      return agg.n;
    },
    // Writes the aggregate into a Mongo update ($inc / $min / $max / $set) under
    // `prefix` (e.g. "participants.doctor.stats") and resets it.
    drainInto(update, prefix) {
      if (agg.n === 0) return false;
      const p = (k) => `${prefix}.${k}`;
      update.$inc = update.$inc || {};
      update.$min = update.$min || {};
      update.$max = update.$max || {};
      update.$set = update.$set || {};
      update.$inc[p("samples")] = agg.n;
      for (const [key, m] of [["rtt", agg.rtt], ["loss", agg.loss], ["jitter", agg.jitter], ["bitrate", agg.bitrate]]) {
        if (m.n === 0) continue;
        update.$inc[p(`${key}Sum`)] = m.sum;
        update.$inc[p(`${key}N`)] = m.n;
        update.$min[p(`${key}Min`)] = m.min;
        update.$max[p(`${key}Max`)] = m.max;
      }
      for (const [k, c] of Object.entries(agg.ice)) update.$inc[p(`ice.${k}`)] = c;
      for (const [k, c] of Object.entries(agg.quality)) update.$inc[p(`quality.${k}`)] = c;
      if (agg.lastIceType) update.$set[p("lastIceType")] = agg.lastIceType;
      update.$set[p("lastQuality")] = agg.lastQuality;
      update.$set[p("lastSampleAt")] = new Date(agg.lastSampleAt);
      agg = fresh();
      return true;
    },
  };
}

// Stored aggregate -> what the admin page shows (averages computed here).
function summarizeStats(stats) {
  if (!stats || !stats.samples) return null;
  const avg = (sum, n) => (n ? sum / n : null);
  const round = (v, d = 1) => (v === null ? null : Math.round(v * 10 ** d) / 10 ** d);
  const ice = stats.ice || {};
  const quality = stats.quality || {};
  const dominantIce = Object.entries(ice).sort((a, b) => b[1] - a[1])[0]?.[0] || stats.lastIceType || "";
  return {
    samples: stats.samples,
    rttMs: { avg: round(avg(stats.rttSum, stats.rttN), 0), min: stats.rttMin ?? null, max: stats.rttMax ?? null },
    packetLossPct: {
      avg: stats.lossN ? round((stats.lossSum / stats.lossN) * 100, 2) : null,
      max: stats.lossMax === undefined || stats.lossMax === null ? null : round(stats.lossMax * 100, 2),
    },
    jitterMs: { avg: round(avg(stats.jitterSum, stats.jitterN), 0), max: stats.jitterMax ?? null },
    bitrateKbps: { avg: round(avg(stats.bitrateSum, stats.bitrateN), 0), min: stats.bitrateMin ?? null, max: stats.bitrateMax ?? null },
    iceType: dominantIce,
    iceCounts: ice,
    qualityCounts: quality,
    lastQuality: stats.lastQuality || "",
    lastSampleAt: stats.lastSampleAt || null,
  };
}

const connectionTypeLabel = (iceType) =>
  iceType === "relay" ? "Relay (TURN)" : ["host", "srflx", "prflx"].includes(iceType) ? "Direct (peer-to-peer)" : "Unknown";

module.exports = { sanitizeStatsSample, createPendingStats, summarizeStats, connectionTypeLabel, ICE_TYPES, QUALITIES, LIMITS };
