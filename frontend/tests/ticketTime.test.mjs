// Support-ticket time helpers. Run from frontend/:  node --test tests/ticketTime.test.mjs
import test from "node:test";
import assert from "node:assert/strict";

import {
  ADMIN_TIMEZONE, isValidTimeZone, formatTicketDate, formatTicketClock, formatTicketDateTime, utcOffsetLabel, zoneLabel,
} from "../src/utils/ticketTime.js";

const AT = "2026-11-07T10:00:00Z";

test("the admin zone is Asia/Kolkata and formats as IST with a +5:30 offset", () => {
  assert.equal(ADMIN_TIMEZONE, "Asia/Kolkata");
  assert.equal(formatTicketDate(AT, ADMIN_TIMEZONE), "7 Nov 2026");
  assert.equal(formatTicketClock(AT, ADMIN_TIMEZONE), "03:30 pm");
  assert.equal(formatTicketDateTime(AT, ADMIN_TIMEZONE), "7 Nov 2026, 03:30 pm");
  assert.equal(utcOffsetLabel(AT, ADMIN_TIMEZONE), "GMT+5:30");
  assert.equal(zoneLabel(AT, ADMIN_TIMEZONE), "Asia/Kolkata (GMT+5:30)");
});

test("the same instant shows differently in the user's own zone (and follows daylight saving)", () => {
  assert.equal(formatTicketClock(AT, "America/New_York"), "05:00 am");
  assert.equal(zoneLabel(AT, "America/New_York"), "America/New_York (GMT-5)");
  assert.equal(zoneLabel("2026-07-07T10:00:00Z", "America/New_York"), "America/New_York (GMT-4)");
  // A different calendar day on the other side of the world.
  assert.equal(formatTicketDate("2026-11-07T22:00:00Z", "Australia/Sydney"), "8 Nov 2026");
  assert.equal(formatTicketDate("2026-11-07T22:00:00Z", ADMIN_TIMEZONE), "8 Nov 2026");
});

test("a missing or bad zone falls back to the viewer's browser zone and never throws", () => {
  assert.ok(!isValidTimeZone("") && !isValidTimeZone(null) && !isValidTimeZone("Mars/Base"));
  assert.ok(isValidTimeZone("UTC"));
  assert.doesNotThrow(() => formatTicketDateTime(AT, "Mars/Base"));
  assert.ok(formatTicketDateTime(AT, "").length > 0);
});

test("an invalid date renders as an empty string", () => {
  assert.equal(formatTicketDate("garbage", ADMIN_TIMEZONE), "");
  assert.equal(formatTicketDateTime(undefined, ADMIN_TIMEZONE), "");
  assert.equal(zoneLabel("garbage", ADMIN_TIMEZONE), "");
});
