import test from "node:test";
import assert from "node:assert/strict";
import {
  isTerminalDenyReason,
  isRetryableDirectCode,
  nextJoinRetryDelay,
  JOIN_RETRY_DELAYS_MS,
} from "./roomDenyRetry.js";

test("only final reasons end the call", () => {
  for (const r of ["appointment_ended", "not_participant", "appointment_not_found"]) {
    assert.equal(isTerminalDenyReason(r), true);
  }
  for (const r of ["unauthenticated", "invalid_appointment", "room_full", "server_error", "weird", undefined]) {
    assert.equal(isTerminalDenyReason(r), false);
  }
});

test("direct rooms retry only full/server_error", () => {
  assert.equal(isRetryableDirectCode("full"), true);
  assert.equal(isRetryableDirectCode("server_error"), true);
  for (const c of ["invalid", "not_found", "expired", "closed", "pin_required"]) {
    assert.equal(isRetryableDirectCode(c), false);
  }
});

test("backoff is 1,2,4,8s then capped at ~30s total", () => {
  assert.deepEqual(JOIN_RETRY_DELAYS_MS.slice(0, 4), [1000, 2000, 4000, 8000]);
  assert.equal(JOIN_RETRY_DELAYS_MS.reduce((a, b) => a + b, 0), 30000);
  assert.equal(nextJoinRetryDelay(0), 1000);
  assert.equal(nextJoinRetryDelay(JOIN_RETRY_DELAYS_MS.length), null);
  assert.equal(nextJoinRetryDelay(-1), null);
});
