// Admin chat lists: Active (last 10 minutes) -> Recent (still today, India time) -> Archive page. Run: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bucketOf, istDayStart, ACTIVE_WINDOW_MS, LIVECHAT_DAY_ZONE } from "../src/pages/admin/livechat/chatBuckets.js";

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const NOW = Date.parse("2026-10-16T09:00:00Z"); // 14:30 IST
const MIN = 60_000;
const row = (msAgo, extra = {}) => ({ mode: "ai", lastMessageAt: new Date(NOW - msAgo).toISOString(), ...extra });

test("9m59s active, 10m01s recent, next IST day archive; one zone constant", () => {
  assert.equal(LIVECHAT_DAY_ZONE, "Asia/Kolkata");
  assert.equal(ACTIVE_WINDOW_MS, 10 * MIN);
  assert.equal(bucketOf(row(9 * MIN + 59_000), NOW), "active");
  assert.equal(bucketOf(row(10 * MIN + 1000), NOW), "recent");
  const start = istDayStart(NOW);
  assert.equal(bucketOf({ mode: "ai", lastMessageAt: new Date(start - 1000).toISOString() }, NOW), "archive");
  assert.equal(bucketOf({ mode: "ai", lastMessageAt: new Date(start + 1000).toISOString() }, NOW), "recent");
});

test("a chat moves on its own with the clock, and a new message brings it back", () => {
  const quiet = row(9 * MIN);
  assert.equal(bucketOf(quiet, NOW), "active");
  assert.equal(bucketOf(quiet, NOW + 2 * MIN), "recent");
  assert.equal(bucketOf({ ...quiet, lastMessageAt: new Date(NOW + 2 * MIN).toISOString() }, NOW + 2 * MIN + 5000), "active");
  assert.equal(bucketOf(row(30 * MIN, { mode: "queue" }), NOW), "active", "a waiting Queue chat stays");
});

test("AI and agent lists show Active groups plus 'Recent (temp archive)' from the bucket, not from mode or online", () => {
  const list = fs.readFileSync(path.join(src, "pages/admin/livechat/ChatList.jsx"), "utf8");
  assert.ok(list.includes('const RECENT = "Recent (temp archive)"'));
  assert.ok(list.includes('c.bucket === "recent"'));
  assert.ok(list.includes('filter((r) => r.bucket !== "archive")'));
  assert.ok(!/\.online\b/.test(list.slice(list.indexOf("const groupsFor"), list.indexOf("function Item"))), "online is not a filter");
});

test("a bad date never hides a chat, and the list uses the server's clock", () => {
  assert.equal(bucketOf({ mode: "ai", lastMessageAt: "not a date" }, NOW), "active");
  assert.equal(bucketOf(row(MIN), Number.NaN), "active");
  const list = fs.readFileSync(path.join(src, "pages/admin/livechat/ChatList.jsx"), "utf8");
  assert.ok(list.includes("tick + clockOffset"));
  const ws = fs.readFileSync(path.join(src, "pages/admin/livechat/ChatWorkspace.jsx"), "utf8");
  assert.ok(ws.includes("clockOffset={clockOffset}"));
});
