const test = require("node:test");
const assert = require("node:assert/strict");
const { createPresenceDownTracker } = require("../utils/presenceDown");

test("both participants can be down at once and each rejoin is reported", () => {
  const t = createPresenceDownTracker();
  t.markDown("appt1", "doctor");
  t.markDown("appt1", "patient");
  assert.equal(t.isDown("appt1", "doctor"), true);
  assert.equal(t.clearDown("appt1", "doctor"), true, "first rejoin must still be reported");
  assert.equal(t.isDown("appt1", "patient"), true);
  assert.equal(t.clearDown("appt1", "patient"), true);
  assert.equal(t.size, 0);
});

test("clearing someone who is not down reports false", () => {
  const t = createPresenceDownTracker();
  assert.equal(t.clearDown("a", "u"), false);
  t.markDown("a", "u");
  assert.equal(t.clearDown("a", "other"), false);
});

test("ids are compared as strings", () => {
  const t = createPresenceDownTracker();
  t.markDown(123, 456);
  assert.equal(t.isDown("123", "456"), true);
});
