import test from "node:test";
import assert from "node:assert/strict";
import {
  canRequestPeerRestart,
  doctorNeedsPatientRebuild,
  offerBlocker,
  restartRequestAction,
} from "./negotiationRules.js";

const ready = {
  isDoctor: false,
  iceRestart: true,
  hasRemoteDescription: true,
  mediaSettled: true,
  rebuildInProgress: false,
  socketConnected: true,
  now: 10_000,
  holdUntil: 0,
};

test("an offer waits for media, signaling and any rebuild", () => {
  assert.equal(offerBlocker(ready), "send");
  assert.equal(offerBlocker({ ...ready, mediaSettled: false }), "media_not_ready");
  assert.equal(offerBlocker({ ...ready, rebuildInProgress: true }), "rebuild_in_progress");
  assert.equal(offerBlocker({ ...ready, socketConnected: false }), "signaling_down");
});

test("the doctor never offers on a connection with no session", () => {
  assert.equal(offerBlocker({ ...ready, isDoctor: true, hasRemoteDescription: false }), "doctor_has_no_session");
  assert.equal(offerBlocker({ ...ready, isDoctor: true }), "send");
});

test("the patient holds back a restart just after a rejoin, but not a new session's offer", () => {
  assert.equal(offerBlocker({ ...ready, holdUntil: 12_000 }), "waiting_for_rejoin");
  assert.equal(offerBlocker({ ...ready, holdUntil: 12_000, hasRemoteDescription: false }), "send");
  assert.equal(offerBlocker({ ...ready, holdUntil: 9_000 }), "send");
});

test("restart requests are neither sent nor acted on by a new or busy connection", () => {
  const fresh = { hasRemoteDescription: false, signalingState: "stable", rebuildInProgress: false };
  const idle = { ...fresh, hasRemoteDescription: true };
  assert.equal(canRequestPeerRestart(fresh), false);
  assert.equal(canRequestPeerRestart(idle), true);
  assert.equal(canRequestPeerRestart({ ...idle, signalingState: "have-local-offer" }), false);
  assert.equal(canRequestPeerRestart({ ...idle, rebuildInProgress: true }), false);
  assert.equal(restartRequestAction(fresh), "drop");
  assert.equal(restartRequestAction(idle), "process");
  assert.equal(restartRequestAction({ ...idle, signalingState: "have-remote-offer" }), "park");
  assert.equal(restartRequestAction({ ...idle, rebuildInProgress: true }), "drop");
});

test("only a doctor with a never-negotiated connection in a running call asks for a patient rebuild", () => {
  const base = { isDoctor: true, resumedCall: true, hasRemoteDescription: false, signalingState: "stable" };
  assert.equal(doctorNeedsPatientRebuild(base), true);
  assert.equal(doctorNeedsPatientRebuild({ ...base, resumedCall: false }), false);
  assert.equal(doctorNeedsPatientRebuild({ ...base, isDoctor: false }), false);
  assert.equal(doctorNeedsPatientRebuild({ ...base, hasRemoteDescription: true }), false);
  // Built to answer the patient's own offer: asking again would loop.
  assert.equal(doctorNeedsPatientRebuild({ ...base, offerReceived: true }), false);
});
