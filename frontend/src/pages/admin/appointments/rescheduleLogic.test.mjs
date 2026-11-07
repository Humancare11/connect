import test from "node:test";
import assert from "node:assert/strict";
import { nextDays, dayLabel, groupSlots, timePart, missingFields, zoneNote, isoDay, isIstZone, monthCells, shiftMonth, monthTitle, longDay, zoneChip, zoneInfo, needList } from "./rescheduleLogic.js";

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

test("calendar: a month starts on the right weekday and has every day", () => {
  const cells = monthCells("2026-11"); // 1 Nov 2026 is a Sunday
  assert.equal(cells[0], "2026-11-01");
  assert.equal(cells.length, 30);
  const feb = monthCells("2026-08"); // 1 Aug 2026 is a Saturday: six blanks first
  assert.equal(feb.filter((c) => c === null).length, 6);
  assert.equal(feb.length, 6 + 31);
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(monthTitle("2026-11"), "November 2026");
  assert.match(longDay("2026-11-07"), /Sat, 07 Nov 2026/);
});

test("time zone: IST patients get the plain note, others get the orange one with IST under each slot", () => {
  assert.equal(isIstZone("Asia/Kolkata"), true);
  assert.equal(isIstZone("America/New_York"), false);
  assert.deepEqual(zoneInfo({ patient: "Asia/Kolkata", assumed: false }), { text: "Times are in IST, same for patient and admin.", diff: false });
  const ny = zoneInfo({ patient: "America/New_York", assumed: false });
  assert.equal(ny.diff, true);
  assert.match(ny.text, /India time is shown under each slot/);
  assert.match(zoneInfo({ patient: "Asia/Kolkata", assumed: true }).text, /Asia\/Kolkata is assumed/);
  assert.equal(zoneChip("Asia/Kolkata"), "India (IST)");
  assert.match(zoneChip("America/New_York", new Date("2026-11-07T12:00:00Z")), /^America\/New_York \(.+\)$/);
});

test("needList says what the footer is waiting for", () => {
  assert.deepEqual(needList({}), ["date", "reason"]);
  assert.deepEqual(needList({ date: "d" }), ["time", "reason"]);
  assert.deepEqual(needList({ date: "d", time: "t", reason: "Other", note: " " }), ["a note"]);
  assert.deepEqual(needList({ date: "d", time: "t", reason: "Other", note: "x" }), []);
  assert.deepEqual(needList({ date: "d", time: "t", reason: "Technical issue" }), []);
});
