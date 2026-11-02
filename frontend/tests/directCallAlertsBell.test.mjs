// Direct-call alert labels (Phase 0) and the bell's wiring. The bell is now backed by the combined feed
// (see adminNotificationFeed.test.mjs for behaviour); the checks on the component below are static source
// checks only, since the frontend has no DOM test runner.
// Run: node --test tests/directCallAlertsBell.test.mjs  (from frontend/)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { alertLabel } from "../src/pages/admin/directCallAlertLabels.js";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "pages", "admin");
const bell = fs.readFileSync(path.join(dir, "DirectCallAlertsBell.jsx"), "utf8");

test("all four known alert types have readable labels", () => {
  assert.equal(alertLabel("room_full"), "Meeting full");
  assert.equal(alertLabel("repeated_retries"), "Repeated reconnects");
  assert.equal(alertLabel("never_connected"), "Never connected");
  assert.equal(alertLabel("pin_brute_force"), "Repeated PIN verification failures");
});

test("unknown or missing types fall back to a safe readable label", () => {
  assert.equal(alertLabel("some_new_type"), "Some new type");
  assert.equal(alertLabel("constructor"), "Constructor");
  assert.equal(alertLabel(undefined), "Alert");
  assert.equal(alertLabel(null), "Alert");
  assert.equal(alertLabel(""), "Alert");
  assert.equal(alertLabel(42), "42");
});

test("(static) the bell renders from the feed, with retry, mark-all and cleanup wired", () => {
  assert.match(bell, /createAdminNotificationFeed\(\{ api \}\)/);
  assert.match(bell, /useSyncExternalStore\(feed\.subscribe, feed\.getState\)/);
  assert.match(bell, /feed\.start\(\);\s*return \(\) => feed\.stop\(\);/);
  assert.match(bell, /return \(\) => document\.removeEventListener\("mousedown", onPointerDown\)/);
  assert.match(bell, /Unable to load notifications\. Please try again\./);
  assert.match(bell, /onClick=\{feed\.markAllRead\}/);
  assert.match(bell, /No notifications yet\./);
  assert.match(bell, /<Link\s+to=\{item\.link\}/);
});

test("(static) only shared notifications are marked read by following their link", () => {
  assert.match(bell, /if \(item\.source === "general"\) feed\.markRead\(item\.key\)/);
});
