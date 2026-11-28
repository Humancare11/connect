import test from "node:test";
import assert from "node:assert/strict";
import { buildCallStatsSample } from "./callStatsSample.js";

const report = (local, remote = { id: "R", candidateType: "srflx" }) =>
  new Map(
    [
      { id: "T", type: "transport", selectedCandidatePairId: "P" },
      { id: "P", type: "candidate-pair", localCandidateId: "L", remoteCandidateId: "R", currentRoundTripTime: 0.05 },
      { id: "L", type: "local-candidate", ...local },
      { type: "remote-candidate", ...remote },
    ].map((r) => [r.id, r]),
  );

test("a relayed call reports how it reached TURN and which server", () => {
  const { sample } = buildCallStatsSample(
    report({ candidateType: "relay", relayProtocol: "tls", url: "turns:Turn.Example.com:443?transport=tcp" }),
    null,
    1,
  );
  assert.equal(sample.iceType, "relay");
  assert.equal(sample.relayProtocol, "tls");
  assert.equal(sample.turnHost, "turn.example.com");
  assert.ok(!JSON.stringify(sample).includes("443"), "no port or address is sent");
});

test("a direct call, or a browser that does not say, reports neither", () => {
  for (const local of [{ candidateType: "host" }, { candidateType: "relay" }]) {
    const { sample } = buildCallStatsSample(report(local), null, 1);
    assert.equal("relayProtocol" in sample, false);
    assert.equal("turnHost" in sample, false);
  }
});
