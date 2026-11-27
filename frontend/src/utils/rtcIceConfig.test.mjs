import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildStunOnlyConfig, hasTurnServer, STUN_ONLY_CONFIG } from "./rtcIceConfig.js";

test("the build-time config is STUN only", () => {
  assert.equal(hasTurnServer(STUN_ONLY_CONFIG.iceServers), false);
  assert.ok(STUN_ONLY_CONFIG.iceServers.length > 0);
});

test("TURN urls in the STUN variable are ignored", () => {
  const config = buildStunOnlyConfig(
    "turn:turn.example.com:3478,turns:turn.example.com:443,stun:stun.example.com:3478",
  );
  assert.deepEqual(config.iceServers, [{ urls: "stun:stun.example.com:3478" }]);
  assert.equal(hasTurnServer(buildStunOnlyConfig("turn:turn.example.com:3478").iceServers), false);
});

test("no source or tracked env file reads a static TURN setting", () => {
  const forbidden = /VITE_RTC_(TURN_[A-Z]+|ICE_SERVERS_JSON)/;
  for (const file of ["./rtcIceConfig.js", "../pages/DirectVideoCall.jsx", "../pages/VideoCall.jsx", "../../.env.production"]) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), "utf8"), forbidden, file);
  }
});
