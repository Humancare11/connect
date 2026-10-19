// Builds the compact quality sample sent in "call-stats" (admin call report)
// from an RTCPeerConnection.getStats() report. Pure: no timers, no socket.
// Technical numbers only - never audio/video content or levels.
//
//   const { sample, snapshot } = buildCallStatsSample(report, previousSnapshot, nowMs);
//
// `snapshot` carries the byte counters needed to turn the next report into a
// bitrate; keep it and pass it back in.

export const classifyQuality = ({ rtt, packetLoss }) => {
  if (rtt === null && packetLoss === null) return "unknown";
  if ((packetLoss !== null && packetLoss > 0.1) || (rtt !== null && rtt > 500)) return "poor";
  if ((packetLoss !== null && packetLoss > 0.03) || (rtt !== null && rtt > 250)) return "weak";
  return "good";
};

const finite = (v) => typeof v === "number" && Number.isFinite(v);

export function buildCallStatsSample(report, previous, nowMs, extra = {}) {
  let rtt = null;
  let jitterSec = null;
  let iceType = "";
  let packetsReceived = 0;
  let packetsLost = 0;
  let bytesIn = 0;
  let bytesOut = 0;
  let resolution = "";

  const byId = new Map();
  report.forEach((r) => byId.set(r.id, r));

  let selectedPair = null;
  report.forEach((r) => {
    if (r.type === "transport" && r.selectedCandidatePairId && byId.has(r.selectedCandidatePairId)) {
      selectedPair = byId.get(r.selectedCandidatePairId);
    }
  });
  if (!selectedPair) {
    report.forEach((r) => {
      if (r.type === "candidate-pair" && (r.selected || (r.nominated && r.state === "succeeded"))) selectedPair = r;
    });
  }
  if (selectedPair) {
    if (finite(selectedPair.currentRoundTripTime)) rtt = Math.round(selectedPair.currentRoundTripTime * 1000);
    const local = byId.get(selectedPair.localCandidateId);
    const remote = byId.get(selectedPair.remoteCandidateId);
    // Relayed if EITHER end of the chosen pair is a TURN relay.
    const types = [local?.candidateType, remote?.candidateType];
    iceType = types.includes("relay") ? "relay" : types.find((t) => ["host", "srflx", "prflx"].includes(t)) || "";
  }

  report.forEach((r) => {
    if (r.type === "inbound-rtp" && !r.isRemote) {
      if (finite(r.packetsReceived)) packetsReceived += r.packetsReceived;
      if (finite(r.packetsLost)) packetsLost += Math.max(0, r.packetsLost);
      if (finite(r.bytesReceived)) bytesIn += r.bytesReceived;
      if (r.kind === "video" && finite(r.frameWidth) && finite(r.frameHeight) && r.frameWidth > 0) {
        resolution = `${r.frameWidth}x${r.frameHeight}`;
      }
      if (finite(r.jitter)) jitterSec = Math.max(jitterSec ?? 0, r.jitter);
    } else if (r.type === "outbound-rtp" && !r.isRemote) {
      if (finite(r.bytesSent)) bytesOut += r.bytesSent;
    }
  });

  const total = packetsReceived + packetsLost;
  const lossSinceStart = total > 0 ? packetsLost / total : null;
  // Loss over this interval where we can, else since the start of the call.
  let packetLoss = lossSinceStart;
  if (previous && total - previous.packets > 0) {
    packetLoss = Math.max(0, packetsLost - previous.lost) / (total - previous.packets);
  }

  let bitrateKbps = null;
  let outKbps = null;
  if (previous && nowMs > previous.at) {
    const secs = (nowMs - previous.at) / 1000;
    if (bytesIn >= previous.bytesIn) bitrateKbps = Math.round(((bytesIn - previous.bytesIn) * 8) / 1000 / secs);
    if (bytesOut >= previous.bytesOut) outKbps = Math.round(((bytesOut - previous.bytesOut) * 8) / 1000 / secs);
  }

  const pl = packetLoss === null ? null : Math.min(1, Math.round(packetLoss * 1000) / 1000);
  const sample = {
    rtt,
    packetLoss: pl,
    jitter: jitterSec === null ? null : Math.round(jitterSec * 1000),
    bitrateKbps,
    outKbps,
    iceType,
    resolution,
    quality: classifyQuality({ rtt, packetLoss: pl }),
    ...extra,
  };
  // Drop null/empty fields: the server treats a missing field as "not measured".
  Object.keys(sample).forEach((k) => {
    if (sample[k] === null || sample[k] === "" || sample[k] === undefined) delete sample[k];
  });
  return { sample, snapshot: { at: nowMs, bytesIn, bytesOut, packets: total, lost: packetsLost } };
}
