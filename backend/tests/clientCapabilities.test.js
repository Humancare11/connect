const test = require("node:test");
const assert = require("node:assert/strict");
const { sanitizeCapabilities } = require("../utils/clientCapabilities");

test("capabilities are true only when declared exactly true", () => {
  assert.deepEqual(sanitizeCapabilities({ peerRebuild: true, iceRestart: true }), { peerRebuild: true, iceRestart: true });
  // The installed app declares peerRebuild only.
  assert.deepEqual(sanitizeCapabilities({ peerRebuild: true }), { peerRebuild: true, iceRestart: false });
  for (const raw of [undefined, null, {}, "x", { iceRestart: "true" }, { iceRestart: 1 }]) {
    assert.deepEqual(sanitizeCapabilities(raw), { peerRebuild: false, iceRestart: false });
  }
});
