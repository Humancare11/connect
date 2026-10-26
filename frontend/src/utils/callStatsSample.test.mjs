import test from "node:test";
import assert from "node:assert/strict";
import { buildCallStatsSample, classifyQuality } from "./callStatsSample.js";

const mkReport = (items) => new Map(items.map((i) => [i.id, i]));

const relayReport = (bytes = 0, lost = 0, received = 1000) =>
  mkReport([
    { id: "T", type: "transport", selectedCandidatePairId: "P" },
    { id: "P", type: "candidate-pair", localCandidateId: "L", remoteCandidateId: "R", currentRoundTripTime: 0.12 },
    { id: "L", type: "local-candidate", candidateType: "relay" },
    { id: "R", type: "remote-candidate", candidateType: "srflx" },
    { id: "IV", type: "inbound-rtp", kind: "video", packetsReceived: received, packetsLost: lost, bytesReceived: bytes, jitter: 0.012, frameWidth: 640, frameHeight: 480 },
    { id: "OV", type: "outbound-rtp", kind: "video", bytesSent: bytes / 2 },
  ]);

test("relay on either end of the selected pair is reported as relay; numbers are scaled", () => {
  const { sample, snapshot } = buildCallStatsSample(relayReport(0, 20, 980), null, 1000);
  assert.equal(sample.iceType, "relay");
  assert.equal(sample.rtt, 120);
  assert.equal(sample.jitter, 12);
  assert.equal(sample.resolution, "640x480");
  assert.equal(sample.packetLoss, 0.02);
  assert.equal(sample.bitrateKbps, undefined, "no bitrate without a previous snapshot");
  assert.equal(snapshot.packets, 1000);
});

test("bitrate and interval loss come from the difference to the previous snapshot", () => {
  const first = buildCallStatsSample(relayReport(0, 0, 1000), null, 0);
  const second = buildCallStatsSample(relayReport(500_000, 10, 1990), first.snapshot, 10_000);
  assert.equal(second.sample.bitrateKbps, 400); // 500 kB in 10 s
  assert.equal(second.sample.outKbps, 200);
  assert.equal(second.sample.packetLoss, 0.01); // 10 lost of 1000 new packets
});

test("direct pairs are never reported as relay; an empty report yields an empty sample", () => {
  const direct = mkReport([
    { id: "P", type: "candidate-pair", selected: true, localCandidateId: "L", remoteCandidateId: "R", currentRoundTripTime: 0.02 },
    { id: "L", type: "local-candidate", candidateType: "host" },
    { id: "R", type: "remote-candidate", candidateType: "srflx" },
  ]);
  assert.equal(buildCallStatsSample(direct, null, 0).sample.iceType, "host");
  assert.deepEqual(buildCallStatsSample(new Map(), null, 0).sample, { quality: "unknown" });
});

test("quality buckets", () => {
  assert.equal(classifyQuality({ rtt: 50, packetLoss: 0 }), "good");
  assert.equal(classifyQuality({ rtt: 300, packetLoss: 0 }), "weak");
  assert.equal(classifyQuality({ rtt: 50, packetLoss: 0.2 }), "poor");
  assert.equal(classifyQuality({ rtt: null, packetLoss: null }), "unknown");
});
