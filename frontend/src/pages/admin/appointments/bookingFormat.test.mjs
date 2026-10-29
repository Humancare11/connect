import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TAB, PAGE_SIZE, STATUS_META, TAB_LABELS, TAB_ORDER,
  formatBookedOn, formatConsultation, formatFee, isClosed, originalDoctorHint, pageFromParam, pageWindow,
  rangeText, rowNumber, shortBookingId, tabFromParam, CARD_BELOW, rowActions,
  CANCEL_REASONS, refundWarning, canAlternate, assignedByHint, canAssign, canAutoComplete, canCancel, canReactivate,
  explainActionError, toTime12, toTime24,
} from "./bookingFormat.js";
import * as formatModule from "./bookingFormat.js";

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

test("there is no separate Assigned by column helper any more; the card layout starts at 1000px of table width", () => {
  assert.equal(formatModule.showAssignedByColumn, undefined);
  assert.equal(CARD_BELOW, 1000);
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
  assert.equal(formatFee(99), "$99.00");
  assert.equal(formatFee(5), "$5.00");
  assert.equal(formatFee(49.5), "$49.50");
  assert.equal(formatFee(12.25), "$12.25");
  assert.equal(formatFee(0), "—");
  assert.equal(formatFee(undefined), "—");
});

const row = (status, doctorName = "Dr X", extra = {}) => ({ id: "1", kind: "appointment", status, doctorName, consultation: { date: "2026-11-01" }, ...extra });

test("the five cancel reasons and the paid warning are as agreed", () => {
  assert.deepEqual(CANCEL_REASONS, ["Patient requested", "Doctor unavailable", "Payment failed", "Duplicate booking", "Testing booking"]);
  assert.equal(refundWarning({ paymentGateway: "stripe" }), "This booking was paid. Refund it in Stripe.");
});

test("buttons follow the server rules for every status, with and without a doctor", () => {
  // No doctor: any open booking can be assigned one (older data has Assigned and Confirmed bookings with no doctor).
  for (const status of ["upcoming", "pending", "assigned", "confirmed"]) {
    const r = row(status, null);
    assert.equal(canAssign(r), true, `assign ${status}`);
    assert.equal(canAlternate(r), false, `alternate ${status}`);
    assert.equal(canAutoComplete(r), false, `complete ${status}`);
    assert.equal(canReactivate(r), false);
    assert.equal(canCancel(r), true, `cancel ${status}`);
  }
  const withDoctor = {
    pending: { alternate: true, complete: false, reactivate: false, cancel: true },
    assigned: { alternate: true, complete: true, reactivate: false, cancel: true },
    confirmed: { alternate: true, complete: true, reactivate: false, cancel: true },
    complete: { alternate: false, complete: false, reactivate: true, cancel: false },
    cancelled: { alternate: false, complete: false, reactivate: false, cancel: false },
  };
  for (const [status, want] of Object.entries(withDoctor)) {
    const r = row(status);
    assert.equal(canAssign(r), false, `assign ${status}`);
    assert.equal(canAlternate(r), want.alternate, `alternate ${status}`);
    assert.equal(canAutoComplete(r), want.complete, `complete ${status}`);
    assert.equal(canReactivate(r), want.reactivate, `reactivate ${status}`);
    assert.equal(canCancel(r), want.cancel, `cancel ${status}`);
  }
  // Complete / Cancelled rows with no doctor can't be assigned or cancelled, and a Complete one can't be reactivated.
  for (const status of ["complete", "cancelled"]) {
    assert.equal(canAssign(row(status, null)), false);
    assert.equal(canCancel(row(status, null)), false);
    assert.equal(canReactivate(row(status, null)), false);
  }
});

test("each row shows only the buttons that work for it (Cancel for super admins only)", () => {
  const admin = { isSuperAdmin: false };
  const sup = { isSuperAdmin: true };
  // No doctor, any open status: View, Cancel (no Auto complete).
  for (const status of ["upcoming", "pending", "assigned", "confirmed"]) {
    assert.deepEqual(rowActions(row(status, null), sup), ["view", "cancel"], status);
    assert.deepEqual(rowActions(row(status, null), admin), ["view"], status);
  }
  // A doctor and Assigned or Confirmed: View, Auto complete, Cancel.
  for (const status of ["assigned", "confirmed"]) {
    assert.deepEqual(rowActions(row(status), sup), ["view", "autoComplete", "cancel"], status);
    assert.deepEqual(rowActions(row(status), admin), ["view", "autoComplete"], status);
  }
  // A doctor and Pending: Auto complete does not work yet, so it is not shown.
  assert.deepEqual(rowActions(row("pending"), sup), ["view", "cancel"]);
  // Complete: View, Reactivate. Cancelled: View only. Cancel is never offered on a closed booking.
  assert.deepEqual(rowActions(row("complete"), sup), ["view", "reactivate"]);
  assert.deepEqual(rowActions(row("complete"), admin), ["view", "reactivate"]);
  assert.deepEqual(rowActions(row("complete", null), sup), ["view"]);
  assert.deepEqual(rowActions(row("cancelled"), sup), ["view"]);
});

test("there is no admin Confirm helper any more", () => {
  assert.equal(formatModule.canConfirm, undefined);
});

test("an empty 'Assigned by' next to a doctor explains itself on hover", () => {
  assert.equal(assignedByHint({ doctorName: "Dr X", assignedBy: null, status: "assigned" }), "Assigned before tracking started");
  assert.match(assignedByHint({ doctorName: "Dr X", assignedBy: null, status: "confirmed" }), /booked directly with the doctor, or assigned before tracking started/);
  assert.equal(assignedByHint({ doctorName: "Dr X", assignedBy: null, status: "complete", kind: "category" }), "Assigned before tracking started", "a category booking was never booked directly with a doctor");
  assert.equal(assignedByHint({ doctorName: "Dr X", assignedBy: "Super Admin", status: "assigned" }), "");
  assert.equal(assignedByHint({ doctorName: null, assignedBy: null, status: "upcoming" }), "");
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
  assert.equal(refundWarning({ paymentGateway: "razorpay" }), "This booking was paid. Refund it in Razorpay.");
  for (const other of ["", "bankwire", undefined, null]) {
    assert.equal(refundWarning({ paymentGateway: other }), "This booking was paid. Refund it with the payment provider.", String(other));
  }
  assert.equal(refundWarning(null), "This booking was paid. Refund it with the payment provider.");
});

test("the Source filter: All, Web, App, Unknown; anything else is All", async () => {
  const { SOURCE_FILTERS, sourceFromParam } = await import("./bookingFormat.js");
  assert.deepEqual(SOURCE_FILTERS, [["all", "All"], ["web", "Web"], ["app", "App"], ["unknown", "Unknown"]]);
  for (const key of ["web", "app", "unknown", "all"]) assert.equal(sourceFromParam(key), key);
  for (const bad of [null, undefined, "", "android", "WEB", "<script>"]) assert.equal(sourceFromParam(bad), "all");
});

test("the Source page hover text", async () => {
  const { sourcePageText } = await import("./bookingFormat.js");
  assert.equal(sourcePageText(null), "Not recorded");
  assert.equal(sourcePageText({ type: "Condition", name: "Fever", clickedOn: "" }), "Condition: Fever");
  assert.equal(sourcePageText({ type: "Header", name: "Book Appointment", clickedOn: "Home page" }), "Header: Book Appointment (clicked on Home page)");
  assert.equal(sourcePageText({ type: "Direct", name: "", clickedOn: "" }), "Direct");
});

test("the fee is shown in the booking's own currency; USD when none is given", async () => {
  const B = await import("./bookingFormat.js");
  assert.equal(B.formatFee(30, "eur"), "€30.00");
  assert.equal(B.formatFee(30, "gbp"), "£30.00");
  assert.equal(B.formatFee(30, "usd"), "$30.00");
  assert.equal(B.formatFee(30), "$30.00");
  assert.equal(B.formatFee(30, "inr"), "₹30.00");
  assert.equal(B.formatFee(100000, "inr"), "₹1,00,000.00", "rupees use Indian digit grouping");
  assert.equal(B.formatFee(30, "jpy"), "$30.00");
  assert.equal(B.formatFee(0, "eur"), "—");
});

test("the refund reminder names the amount and currency of a EUR / GBP booking; a USD booking reads as before", async () => {
  const B = await import("./bookingFormat.js");
  assert.equal(B.refundWarning({ paymentGateway: "stripe", currency: "eur", fee: 30 }), "This booking was paid (€30.00). Refund it in Stripe.");
  assert.equal(B.refundWarning({ paymentGateway: "paypal", currency: "gbp", fee: 25 }), "This booking was paid (£25.00). Refund it in PayPal.");
  assert.equal(B.refundWarning({ paymentGateway: "stripe", currency: "eur" }), "This booking was paid (EUR). Refund it in Stripe.");
  assert.equal(B.refundWarning({ currency: "gbp", fee: 25 }), "This booking was paid (£25.00). Refund it with the payment provider.");
  // An INR booking is refunded in Razorpay, with the rupee amount.
  assert.equal(B.refundWarning({ paymentGateway: "razorpay", currency: "inr", fee: 4999 }), "This booking was paid (₹4,999.00). Refund it in Razorpay.");
  assert.equal(B.refundWarning({ paymentGateway: "razorpay", currency: "inr" }), "This booking was paid (INR). Refund it in Razorpay.");
  assert.equal(B.refundWarning({ paymentGateway: "stripe", currency: "usd", fee: 99 }), "This booking was paid. Refund it in Stripe.");
  assert.equal(B.refundWarning({ paymentGateway: "stripe", fee: 99 }), "This booking was paid. Refund it in Stripe.");
});
