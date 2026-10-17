import test from "node:test";
import assert from "node:assert/strict";
import { iceRecoveryBudgetRefilled } from "./iceRecoveryBudget.js";

const COOLDOWN = 30000;
const MAX = 4;

// Mirrors the scheduleIceRestart loop: a tick every 2.5s while unhealthy.
const simulate = (updateOnEveryTick, totalMs) => {
  let attempts = 0;
  let last = 0;
  let realAttempts = 0;
  for (let now = 1000; now <= totalMs; now += 2500) {
    if (iceRecoveryBudgetRefilled(now, last, COOLDOWN)) attempts = 0;
    if (updateOnEveryTick) last = now;
    if (attempts >= MAX) continue;
    attempts += 1;
    realAttempts += 1;
    if (!updateOnEveryTick) last = now;
  }
  return realAttempts;
};

test("old behaviour: budget never refills while the loop keeps ticking", () => {
  assert.equal(simulate(true, 120000), MAX);
});

test("budget refills 30s after the last real attempt", () => {
  assert.ok(simulate(false, 120000) > MAX);
});

test("cooldown boundary is exclusive", () => {
  assert.equal(iceRecoveryBudgetRefilled(30000, 0, COOLDOWN), false);
  assert.equal(iceRecoveryBudgetRefilled(30001, 0, COOLDOWN), true);
});
