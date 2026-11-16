const { test } = require("node:test");
const assert = require("node:assert/strict");
const { cachedMailboxes, clearMailboxCache, ttlMs } = require("../services/email/mailboxAccessCache");

test("off by default: every call loads", async () => {
  clearMailboxCache();
  let n = 0;
  const load = async () => ++n;
  await cachedMailboxes("a", load, { env: {} });
  await cachedMailboxes("a", load, { env: {} });
  assert.equal(n, 2);
  assert.equal(ttlMs({ EMAIL_MAILBOX_CACHE_MS: "abc" }), 0);
});

test("on: cached per admin for the TTL, then reloaded; clearing drops it at once", async () => {
  clearMailboxCache();
  const env = { EMAIL_MAILBOX_CACHE_MS: "30000" };
  let n = 0;
  const load = async () => ++n;
  assert.equal(await cachedMailboxes("a", load, { env, now: 1000 }), 1);
  assert.equal(await cachedMailboxes("a", load, { env, now: 5000 }), 1, "served from the cache");
  assert.equal(await cachedMailboxes("b", load, { env, now: 5000 }), 2, "another admin has its own entry");
  assert.equal(await cachedMailboxes("a", load, { env, now: 40000 }), 3, "expired");
  clearMailboxCache();
  assert.equal(await cachedMailboxes("a", load, { env, now: 40001 }), 4, "cleared");
});
