import test from "node:test";
import assert from "node:assert/strict";
import { flagEnabled } from "./featureFlags.js";
import { doctorRestartDecision, doctorRestartsItself } from "./doctorIceRestart.js";

test("only a doctor facing a peer without iceRestart restarts by itself", () => {
  const app = { peerRebuild: true };
  assert.equal(doctorRestartsItself({ enabled: true, isDoctor: true, peerCapabilities: app }), true);
  assert.equal(doctorRestartsItself({ enabled: true, isDoctor: true, peerCapabilities: { iceRestart: true } }), false);
  assert.equal(doctorRestartsItself({ enabled: true, isDoctor: false, peerCapabilities: app }), false);
  assert.equal(doctorRestartsItself({ enabled: true, isDoctor: true, peerCapabilities: null }), false);
  assert.equal(doctorRestartsItself({ enabled: false, isDoctor: true, peerCapabilities: app }), false);
});

test("the doctor waits out the patient's offers, its own last restart and unstable signaling", () => {
  const base = { now: 100_000, lastPeerOfferAt: 0, lastOwnRestartAt: 0, signalingState: "stable", makingOffer: false };
  assert.equal(doctorRestartDecision(base), "send");
  assert.equal(doctorRestartDecision({ ...base, lastPeerOfferAt: 98_000 }), "wait");
  assert.equal(doctorRestartDecision({ ...base, lastPeerOfferAt: 97_000 }), "send");
  assert.equal(doctorRestartDecision({ ...base, lastOwnRestartAt: 95_000 }), "wait");
  assert.equal(doctorRestartDecision({ ...base, lastOwnRestartAt: 93_000 }), "send");
  assert.equal(doctorRestartDecision({ ...base, signalingState: "have-local-offer" }), "wait");
  assert.equal(doctorRestartDecision({ ...base, makingOffer: true }), "wait");
});

test("flags are on unless set to false", () => {
  for (const on of [undefined, "", "true", "1"]) assert.equal(flagEnabled(on), true);
  for (const off of ["false", " FALSE "]) assert.equal(flagEnabled(off), false);
});
