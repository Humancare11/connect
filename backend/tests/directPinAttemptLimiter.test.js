const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

// Fresh module instance per test — this module keeps its buckets in a
// module-level Map, so tests need isolated state.
function fresh() {
  delete require.cache[require.resolve("../utils/directPinAttemptLimiter")];
  return require("../utils/directPinAttemptLimiter");
}

describe("directPinAttemptLimiter", () => {
  test("allows up to PER_IP_MAX wrong attempts from one IP, then blocks that IP", () => {
    const { isBlocked, recordWrongAttempt, PER_IP_MAX } = fresh();
    const ctx = { ip: "1.1.1.1", roomId: "roomA" };
    for (let i = 0; i < PER_IP_MAX; i++) {
      assert.equal(isBlocked(ctx), false, `attempt ${i + 1} should not be blocked yet`);
      recordWrongAttempt(ctx);
    }
    assert.equal(isBlocked(ctx), true);
  });

  test("a correct PIN (no recordWrongAttempt call) never counts against the limit", () => {
    const { isBlocked, recordWrongAttempt, PER_IP_MAX } = fresh();
    const ctx = { ip: "2.2.2.2", roomId: "roomB" };
    for (let i = 0; i < PER_IP_MAX - 1; i++) recordWrongAttempt(ctx);
    // One more "check" without recording (simulating a correct guess) must not block.
    assert.equal(isBlocked(ctx), false);
  });

  test("per-IP block does not affect a different IP on the same room", () => {
    const { isBlocked, recordWrongAttempt, PER_IP_MAX } = fresh();
    const roomId = "roomC";
    for (let i = 0; i < PER_IP_MAX; i++) recordWrongAttempt({ ip: "3.3.3.3", roomId });
    assert.equal(isBlocked({ ip: "3.3.3.3", roomId }), true);
    assert.equal(isBlocked({ ip: "4.4.4.4", roomId }), false);
  });

  test("per-room block trips across many different IPs, even under the per-IP max each", () => {
    const { isBlocked, recordWrongAttempt, PER_ROOM_MAX, PER_IP_MAX } = fresh();
    const roomId = "roomD";
    assert.ok(PER_ROOM_MAX > PER_IP_MAX, "test assumes the room cap is higher than the per-IP cap");
    let tripped = false;
    for (let i = 0; i < PER_ROOM_MAX; i++) {
      const result = recordWrongAttempt({ ip: `10.0.0.${i}`, roomId });
      if (result.roomBlockJustTripped) tripped = true;
    }
    assert.equal(tripped, true);
    assert.equal(isBlocked({ ip: "10.0.0.999", roomId }), true);
  });

  test("roomBlockJustTripped is true exactly once, on the threshold attempt", () => {
    const { recordWrongAttempt, PER_ROOM_MAX } = fresh();
    const roomId = "roomE";
    let trippedCount = 0;
    for (let i = 0; i < PER_ROOM_MAX + 3; i++) {
      const result = recordWrongAttempt({ ip: `20.0.0.${i}`, roomId });
      if (result.roomBlockJustTripped) trippedCount += 1;
    }
    assert.equal(trippedCount, 1);
  });

  test("blocks are independent per room", () => {
    const { isBlocked, recordWrongAttempt, PER_IP_MAX } = fresh();
    for (let i = 0; i < PER_IP_MAX; i++) recordWrongAttempt({ ip: "5.5.5.5", roomId: "roomF" });
    assert.equal(isBlocked({ ip: "5.5.5.5", roomId: "roomF" }), true);
    assert.equal(isBlocked({ ip: "5.5.5.5", roomId: "roomG" }), false);
  });
});
