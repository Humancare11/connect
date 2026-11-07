import test from "node:test";
import assert from "node:assert/strict";
import { nextDays, dayLabel, groupSlots, timePart, missingFields, zoneNote, isoDay } from "./rescheduleLogic.js";

test("nextDays starts today and gives 14 consecutive ISO dates, across a month end", () => {
  const days = nextDays(14, new Date(2026, 9, 28));
  assert.equal(days.length, 14);
  assert.equal(days[0], "2026-10-28");
  assert.equal(days[4], "2026-11-01");
  assert.equal(days[13], "2026-11-10");
  assert.equal(isoDay(new Date(2026, 0, 5)), "2026-01-05");
});

test("dayLabel and timePart", () => {
  assert.equal(dayLabel("2026-11-06"), "Fri 06 Nov");
  assert.equal(dayLabel("nope"), "nope");
  assert.equal(timePart("06 Nov 2026, 11:30 AM"), "11:30 AM");
  assert.equal(timePart(""), "");
});

test("groupSlots splits the day and drops empty groups", () => {
  const slots = ["08:00", "11:30", "12:00", "16:30", "17:00", "19:30"].map((time) => ({ time }));
  const g = groupSlots(slots);
  assert.deepEqual(g.map((x) => [x.name, x.slots.length]), [["Morning", 2], ["Afternoon", 2], ["Evening", 2]]);
  assert.deepEqual(groupSlots([{ time: "09:00" }]).map((x) => x.name), ["Morning"]);
});

test("missingFields names everything still needed; Other needs a note", () => {
  assert.equal(missingFields({}), "a new date, a time slot, a reason");
  assert.equal(missingFields({ date: "d", time: "t", reason: "Other", note: "  " }), 'a note for "Other"');
  assert.equal(missingFields({ date: "d", time: "t", reason: "Other", note: "x" }), "");
  assert.equal(missingFields({ date: "d", time: "t", reason: "Patient requested" }), "");
});

test("zoneNote says whose clock the times are and when the zone is assumed", () => {
  assert.match(zoneNote({ patient: "America/New_York", assumed: false }), /patient's local time \(America\/New_York\)/);
  assert.match(zoneNote({ patient: "Asia/Kolkata", assumed: true }), /No time zone is recorded.*Asia\/Kolkata is assumed/);
  assert.equal(zoneNote(null), "");
});
