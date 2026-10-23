import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TAB, PAGE_SIZE, STATUS_META, TAB_LABELS, TAB_ORDER,
  formatBookedOn, formatConsultation, formatFee, isClosed, originalDoctorHint, pageFromParam, pageWindow,
  rangeText, rowNumber, shortBookingId, showAssignedByColumn, tabFromParam,
} from "./bookingFormat.js";

test("tabs are in the agreed order and every one has a label", () => {
  assert.deepEqual(TAB_ORDER, ["all", "upcoming", "assigned", "pending", "confirmed", "complete", "cancelled", "testing"]);
  assert.deepEqual(TAB_ORDER.map((t) => TAB_LABELS[t]), ["All", "Upcoming", "Assigned", "Pending", "Confirmed", "Complete", "Cancelled", "Testing"]);
});

test("every status has a pill, and Complete is the light green one", () => {
  for (const status of ["upcoming", "assigned", "pending", "confirmed", "complete", "cancelled"]) {
    assert.ok(STATUS_META[status].label && STATUS_META[status].bg && STATUS_META[status].color, status);
  }
  assert.equal(STATUS_META.complete.label, "Complete");
  assert.equal(STATUS_META.complete.bg, "#dcfce7");
});

test("tab and page come from the URL safely", () => {
  assert.equal(tabFromParam("cancelled"), "cancelled");
  assert.equal(tabFromParam("testing"), "testing");
  assert.equal(tabFromParam("nope"), DEFAULT_TAB);
  assert.equal(tabFromParam(null), DEFAULT_TAB);
  assert.equal(pageFromParam("3"), 3);
  for (const bad of ["0", "-2", "1.5", "abc", "", null, undefined]) assert.equal(pageFromParam(bad), 1, String(bad));
});

test("the Assigned by column is hidden on the Upcoming tab only", () => {
  for (const tab of TAB_ORDER) assert.equal(showAssignedByColumn(tab), tab !== "upcoming", tab);
});

test("Complete and Cancelled are closed", () => {
  assert.equal(isClosed("complete"), true);
  assert.equal(isClosed("cancelled"), true);
  for (const s of ["upcoming", "assigned", "pending", "confirmed"]) assert.equal(isClosed(s), false, s);
});

test("row numbers continue across pages", () => {
  assert.equal(rowNumber(1, 0), 1);
  assert.equal(rowNumber(1, PAGE_SIZE - 1), 25);
  assert.equal(rowNumber(2, 0), 26);
  assert.equal(rowNumber(3, 4), 55);
  assert.equal(rangeText(2, 25, 132), "Showing 26–50 of 132");
  assert.equal(rangeText(6, 7, 132), "Showing 126–132 of 132");
  assert.equal(rangeText(1, 0, 0), "");
});

test("page window keeps first, last and the current page with its neighbours", () => {
  assert.deepEqual(pageWindow(1, 1), [1]);
  assert.deepEqual(pageWindow(1, 3), [1, 2, 3]);
  assert.deepEqual(pageWindow(5, 20), [1, "gap", 4, 5, 6, "gap", 20]);
  assert.deepEqual(pageWindow(2, 20), [1, 2, 3, "gap", 20]);
  assert.deepEqual(pageWindow(20, 20), [1, "gap", 19, 20]);
});

test("no consultation date is 'Not scheduled' (null), a date is shown as a calendar day", () => {
  assert.equal(formatConsultation(null), null);
  assert.equal(formatConsultation({ date: "", time: "10:00 AM" }), null);
  assert.deepEqual(formatConsultation({ date: "2026-10-16", time: "05:30 PM" }), { day: "16 Oct 2026", time: "05:30 PM" });
  assert.deepEqual(formatConsultation({ date: "2026-01-05" }), { day: "5 Jan 2026", time: "" });
  assert.deepEqual(formatConsultation({ date: "tomorrow", time: "" }), { day: "tomorrow", time: "" });
});

test("booking date and fee", () => {
  assert.equal(formatBookedOn(null), "—");
  assert.equal(formatBookedOn("not a date"), "—");
  assert.match(formatBookedOn("2026-10-16T10:00:00.000Z"), /^\d{1,2} Oct 2026$/);
  assert.equal(formatFee(99), "$99");
  assert.equal(formatFee(49.5), "$49.50");
  assert.equal(formatFee(12.25), "$12.25");
  assert.equal(formatFee(0), "—");
  assert.equal(formatFee(undefined), "—");
});

test("booking id and the original-doctor hint", () => {
  assert.equal(shortBookingId({ id: "64b000000000000000000001", shortId: "00000001" }), "…00000001");
  assert.equal(shortBookingId({ id: "64b0000000000000abcdef12" }), "…ABCDEF12");
  assert.equal(originalDoctorHint({ originalDoctorName: "Martin Perlin" }), "Originally with Martin Perlin");
  assert.equal(originalDoctorHint({ originalDoctorName: "" }), "");
});
