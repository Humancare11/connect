const { test } = require("node:test");
const assert = require("node:assert/strict");
const { setEmailEmitter, emitEmailChanged, canWatchEmail, THROTTLE_MS, EMAIL_ROOM, EVENT } = require("../services/email/emailEvents");

test("no emitter set: nothing happens and nothing throws", () => {
  setEmailEmitter(null);
  assert.equal(emitEmailChanged("m1"), false);
});

test("the payload is only the mailbox id; changes of one mailbox within the throttle window are one event", () => {
  const sent = [];
  setEmailEmitter((p) => sent.push(p));
  assert.equal(emitEmailChanged("m1", { now: 10_000 }), true);
  assert.equal(emitEmailChanged("m1", { now: 10_000 + THROTTLE_MS - 1 }), false);
  assert.equal(emitEmailChanged("m2", { now: 10_100 }), true, "another mailbox is independent");
  assert.equal(emitEmailChanged("m1", { now: 10_000 + THROTTLE_MS }), true);
  assert.deepEqual(sent, [{ mailboxId: "m1" }, { mailboxId: "m2" }, { mailboxId: "m1" }]);
  assert.deepEqual(Object.keys(sent[0]), ["mailboxId"]);
  setEmailEmitter(null);
});

test("an emitter that throws never breaks the caller", () => {
  setEmailEmitter(() => {
    throw new Error("socket down");
  });
  assert.equal(emitEmailChanged("m9"), false);
  setEmailEmitter(null);
});

test("only a verified admin or Super Admin may watch", () => {
  assert.equal(canWatchEmail({ id: "1", role: "admin" }), true);
  assert.equal(canWatchEmail({ id: "1", role: "superadmin" }), true);
  for (const bad of [null, undefined, {}, { id: "1", role: "user" }, { id: "1", role: "doctor" }, { id: "1", role: "partner" }, { role: "admin" }]) {
    assert.equal(canWatchEmail(bad), false, JSON.stringify(bad));
  }
  assert.equal(EMAIL_ROOM, "email_room");
  assert.equal(EVENT, "email-changed");
});
