import test from "node:test";
import assert from "node:assert/strict";
import { pollMs, setLivePush, POLL_MS, POLL_MS_LIVE } from "./emailUtils.js";

test("polling is the safety net: normal pace without live updates, slower while they work", () => {
  setLivePush(false);
  assert.equal(pollMs(), POLL_MS);
  setLivePush(true);
  assert.equal(pollMs(), POLL_MS_LIVE);
  assert.ok(POLL_MS_LIVE > POLL_MS);
  setLivePush(false);
  assert.equal(pollMs(), POLL_MS);
});
