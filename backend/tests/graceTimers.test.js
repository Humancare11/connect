const test = require("node:test");
const assert = require("node:assert/strict");
const { createGraceTimerRegistry } = require("../utils/graceTimers");

test("fires once after the delay and clears itself", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const registry = createGraceTimerRegistry();
  let fired = 0;
  registry.schedule("a:1", 100, () => fired++);
  assert.equal(registry.has("a:1"), true);
  t.mock.timers.tick(99);
  assert.equal(fired, 0);
  t.mock.timers.tick(1);
  assert.equal(fired, 1);
  assert.equal(registry.size, 0);
});

test("cancel on rejoin prevents the callback", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const registry = createGraceTimerRegistry();
  let fired = 0;
  registry.schedule("a:1", 100, () => fired++);
  assert.equal(registry.cancel("a:1"), true);
  assert.equal(registry.cancel("a:1"), false);
  t.mock.timers.tick(1000);
  assert.equal(fired, 0);
});

test("a second disconnect restarts the clock instead of leaving the first timer", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const registry = createGraceTimerRegistry();
  const fired = [];
  registry.schedule("a:1", 30, () => fired.push("first"));
  t.mock.timers.tick(20); // user rejoined and dropped again 20ms later
  registry.schedule("a:1", 30, () => fired.push("second"));
  t.mock.timers.tick(10); // the first timer's original deadline
  assert.deepEqual(fired, []);
  t.mock.timers.tick(20);
  assert.deepEqual(fired, ["second"]);
  assert.equal(registry.size, 0);
});

test("keys are independent", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const registry = createGraceTimerRegistry();
  const fired = [];
  registry.schedule("a:1", 10, () => fired.push("a:1"));
  registry.schedule("a:2", 10, () => fired.push("a:2"));
  registry.cancel("a:1");
  t.mock.timers.tick(10);
  assert.deepEqual(fired, ["a:2"]);
});
