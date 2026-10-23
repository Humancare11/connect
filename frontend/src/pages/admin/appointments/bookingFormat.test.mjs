import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TAB, PAGE_SIZE, STATUS_META, TAB_LABELS, TAB_ORDER,
  formatBookedOn, formatConsultation, formatFee, isClosed, originalDoctorHint, pageFromParam, pageWindow,
  rangeText, rowNumber, shortBookingId, showAssignedByColumn, tabFromParam,
  AUTO_COMPLETE_HINT, CANCEL_REASONS, refundWarning, canAlternate, canAssign, canAutoComplete, canCancel, canConfirm,
  explainActionError, filterDoctors, needsAppointmentTime, toTime12, toTime24,
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

const row = (status, doctorName = "Dr X", extra = {}) => ({ id: "1", kind: "appointment", status, doctorName, consultation: { date: "2026-11-01" }, ...extra });

test("the five cancel reasons and the paid warning are as agreed", () => {
  assert.deepEqual(CANCEL_REASONS, ["Patient requested", "Doctor unavailable", "Payment failed", "Duplicate booking", "Testing booking"]);
  assert.equal(refundWarning({ paymentGateway: "stripe" }), "This booking was paid. Refund it in Stripe.");
  assert.match(AUTO_COMPLETE_HINT, /assigned or confirmed/);
});

test("buttons follow the server rules for every status, with and without a doctor", () => {
  for (const status of ["upcoming", "pending"]) {
    const r = row(status, null);
    assert.equal(canAssign(r), true, `assign ${status}`);
    assert.equal(canAlternate(r), false, `alternate ${status}`);
    assert.equal(canConfirm(r), false);
    assert.equal(canAutoComplete(r), false);
    assert.equal(canCancel(r), true);
  }
  const withDoctor = {
    pending: { alternate: true, confirm: false, complete: false, cancel: true },
    assigned: { alternate: true, confirm: true, complete: true, cancel: true },
    confirmed: { alternate: true, confirm: false, complete: true, cancel: true },
    complete: { alternate: false, confirm: false, complete: false, cancel: false },
    cancelled: { alternate: false, confirm: false, complete: false, cancel: false },
  };
  for (const [status, want] of Object.entries(withDoctor)) {
    const r = row(status);
    assert.equal(canAssign(r), false, `assign ${status}`);
    assert.equal(canAlternate(r), want.alternate, `alternate ${status}`);
    assert.equal(canConfirm(r), want.confirm, `confirm ${status}`);
    assert.equal(canAutoComplete(r), want.complete, `complete ${status}`);
    assert.equal(canCancel(r), want.cancel, `cancel ${status}`);
  }
  // Complete / Cancelled rows with no doctor can't be assigned or cancelled either.
  for (const status of ["complete", "cancelled"]) {
    assert.equal(canAssign(row(status, null)), false);
    assert.equal(canCancel(row(status, null)), false);
  }
});

test("only a category booking with no time yet needs one", () => {
  assert.equal(needsAppointmentTime({ kind: "category", consultation: null }), true);
  assert.equal(needsAppointmentTime({ kind: "category", consultation: { date: "2026-11-02", time: "05:30 PM" } }), false);
  assert.equal(needsAppointmentTime({ kind: "appointment", consultation: null }), false);
});

test("time conversion between the picker and the stored form", () => {
  assert.equal(toTime12("17:30"), "05:30 PM");
  assert.equal(toTime12("00:05"), "12:05 AM");
  assert.equal(toTime12("12:00"), "12:00 PM");
  assert.equal(toTime12("09:15"), "09:15 AM");
  for (const bad of ["", "5pm", "24:00", "12:60", null]) assert.equal(toTime12(bad), "", String(bad));
  assert.equal(toTime24("05:30 PM"), "17:30");
  assert.equal(toTime24("12:05 AM"), "00:05");
  assert.equal(toTime24("12:00 PM"), "12:00");
  assert.equal(toTime24("9:15 am"), "09:15");
  assert.equal(toTime24("Next Available"), "");
  for (const t of ["00:00", "06:45", "12:30", "23:59"]) assert.equal(toTime24(toTime12(t)), t, t);
});

test("error wording: a 409 refreshes, a busy doctor keeps the dialog open", () => {
  const err = (status, data) => ({ response: { status, data } });
  const stale = { message: "This booking was already updated, refreshing", refresh: true };
  assert.deepEqual(explainActionError(err(409, { msg: "just changed", code: "changed" })), stale);
  assert.deepEqual(explainActionError(err(409, { msg: "A complete booking can't be cancelled." })), stale);
  assert.deepEqual(
    explainActionError(err(409, { msg: "The selected doctor is already booked for this slot.", code: "slot_taken" })),
    { message: "The selected doctor is already booked for this slot.", refresh: false }
  );
  assert.deepEqual(explainActionError(err(400, { msg: "A cancel reason is required." })), { message: "A cancel reason is required.", refresh: false });
  assert.equal(explainActionError(err(500, {})).message, "Something went wrong. Please try again.");
  assert.match(explainActionError(new Error("Network Error")).message, /Could not reach the server/);
});

test("the doctor picker searches, sorts, and leaves out the current doctor", () => {
  const doctors = [
    { id: "3", name: "Dr. Farah Siddiqui", specialty: "Dermatology", city: "Dubai", country: "United Arab Emirates" },
    { id: "1", name: "Dr. Martin Perlin", specialty: "Cardiology", city: "Boston", country: "United States" },
    { id: "2", name: "Dr. Nobita Mestry", specialty: "General", city: "Pune", country: "India" },
    { id: "", name: "Dr. No Id" },
  ];
  assert.deepEqual(filterDoctors(doctors, "").map((d) => d.id), ["3", "1", "2"]);
  assert.deepEqual(filterDoctors(doctors, "india").map((d) => d.id), ["2"]);
  assert.deepEqual(filterDoctors(doctors, "CARDIO").map((d) => d.id), ["1"]);
  assert.deepEqual(filterDoctors(doctors, "", "Martin Perlin").map((d) => d.id), ["3", "2"]);
  assert.deepEqual(filterDoctors(doctors, "", "Dr. Martin Perlin").map((d) => d.id), ["3", "2"]);
  assert.equal(filterDoctors(doctors, "", "", 1).length, 1);
  assert.deepEqual(filterDoctors(null, "x"), []);
});

test("booking id and the original-doctor hint", () => {
  assert.equal(shortBookingId({ id: "64b000000000000000000001", shortId: "00000001" }), "…00000001");
  assert.equal(shortBookingId({ id: "64b0000000000000abcdef12" }), "…ABCDEF12");
  assert.equal(originalDoctorHint({ originalDoctorName: "Martin Perlin" }), "Originally with Martin Perlin");
  assert.equal(originalDoctorHint({ originalDoctorName: "" }), "");
});

test("the refund reminder names the gateway the booking was paid through", () => {
  assert.equal(refundWarning({ paymentGateway: "stripe" }), "This booking was paid. Refund it in Stripe.");
  assert.equal(refundWarning({ paymentGateway: "paypal" }), "This booking was paid. Refund it in PayPal.");
  assert.equal(refundWarning({ paymentGateway: "PayPal" }), "This booking was paid. Refund it in PayPal.");
  for (const other of ["", "razorpay", undefined, null]) {
    assert.equal(refundWarning({ paymentGateway: other }), "This booking was paid. Refund it with the payment provider.", String(other));
  }
  assert.equal(refundWarning(null), "This booking was paid. Refund it with the payment provider.");
});
