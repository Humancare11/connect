import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BULK_ACTIONS, bulkRefundNote, describeBulkResult, eligibleCount, menuOptions, pruneSelection, selectionText, summarizeBulk, summaryText,
} from "./selectionLogic.js";

const labels = (state) => menuOptions(state).map((o) => o.label);

test("the header menu offers only what makes sense at that moment", () => {
  assert.deepEqual(labels({ selecting: false, selectedCount: 0, pageCount: 25 }), ["Select this page", "Select one by one"]);
  assert.deepEqual(labels({ selecting: true, selectedCount: 0, pageCount: 25 }), ["Select this page", "Exit selection"]);
  assert.deepEqual(labels({ selecting: true, selectedCount: 25, pageCount: 25 }), ["Clear selection", "Exit selection"]);
  assert.deepEqual(labels({ selecting: true, selectedCount: 3, pageCount: 25 }), ["Select this page", "Clear selection", "Exit selection"]);
  assert.deepEqual(menuOptions({ selecting: true, selectedCount: 1, pageCount: 1 }).map((o) => o.id), ["clear", "exit"], "one row, selected, is everything");
  assert.deepEqual(menuOptions({ selecting: true, selectedCount: 3, pageCount: 25 }).map((o) => o.id), ["selectPage", "clear", "exit"]);
});

test("the bar says the selection is of this page", () => {
  assert.equal(selectionText(0), "0 selected on this page");
  assert.equal(selectionText(25), "25 selected on this page");
});

test("rows that left the page drop out of the selection; an unchanged selection is the same object", () => {
  const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const selected = new Set(["a", "c"]);
  assert.equal(pruneSelection(selected, rows), selected);
  const pruned = pruneSelection(new Set(["a", "gone", "c"]), rows);
  assert.deepEqual([...pruned], ["a", "c"]);
  assert.deepEqual([...pruneSelection(new Set(["a"]), [])], []);
});

test("there are exactly four bulk actions, and no bulk confirm", () => {
  assert.deepEqual(Object.keys(BULK_ACTIONS), ["auto-complete", "cancel", "mark-testing", "unmark-testing"]);
  assert.equal("confirm" in BULK_ACTIONS, false);
});

test("the refund note counts the paid bookings and names where to refund them", () => {
  const rows = [
    { paid: true, paymentGateway: "stripe" },
    { paid: true, paymentGateway: "stripe" },
    { paid: true, paymentGateway: "paypal" },
    { paid: true, paymentGateway: "" },
    { paid: false, paymentGateway: "stripe" },
  ];
  assert.equal(bulkRefundNote([{ paid: false }, { paid: false }]), "");
  assert.equal(bulkRefundNote([]), "");
  assert.equal(bulkRefundNote([{ paid: true, paymentGateway: "stripe" }]), "1 of the selected bookings was paid and is not refunded automatically. Refund it in Stripe.");
  assert.equal(bulkRefundNote([{ paid: true, paymentGateway: "paypal" }]), "1 of the selected bookings was paid and is not refunded automatically. Refund it in PayPal.");
  assert.equal(bulkRefundNote([{ paid: true }]), "1 of the selected bookings was paid and is not refunded automatically. Refund it with the payment provider.");
  assert.equal(bulkRefundNote(rows), "4 of the selected bookings were paid and are not refunded automatically. Refund them: Stripe (2), PayPal (1), other (1).");
  assert.match(bulkRefundNote(rows.slice(0, 2), "cancelled"), /^2 of the cancelled bookings were paid .* Refund them: Stripe \(2\)\.$/);
});

test("how many selected rows an action can apply to", () => {
  const rows = [
    { status: "assigned", doctorName: "A" },
    { status: "confirmed", doctorName: "B" },
    { status: "pending", doctorName: "C" },
    { status: "upcoming", doctorName: null },
    { status: "complete", doctorName: "D" },
    { status: "cancelled", doctorName: "E" },
  ];
  assert.equal(eligibleCount("auto-complete", rows), 2);
  assert.equal(eligibleCount("cancel", rows), 4);
  assert.equal(eligibleCount("mark-testing", rows), 6);
  assert.equal(eligibleCount("unmark-testing", rows), 6);
});

test("each result becomes done, skipped (with its reason) or failed", () => {
  const rowsById = new Map([["1", { id: "1", shortId: "ABCD1234", patient: { name: "Ann" } }]]);
  assert.deepEqual(describeBulkResult({ id: "1", status: "ok", paid: true }, rowsById), { id: "1", name: "…ABCD1234 · Ann", outcome: "done", reason: "", paid: true });
  assert.equal(describeBulkResult({ id: "1", status: "conflict", message: "A complete booking can't be cancelled." }, rowsById).reason, "A complete booking can't be cancelled.");
  assert.equal(describeBulkResult({ id: "1", status: "conflict", message: "x" }, rowsById).outcome, "skipped");
  assert.equal(describeBulkResult({ id: "9".repeat(24), status: "not_found" }, rowsById).outcome, "skipped");
  assert.match(describeBulkResult({ id: "9".repeat(24), status: "not_found" }, rowsById).name, /^…[9]{8}$/);
  assert.equal(describeBulkResult({ id: "1", status: "error", message: "Something went wrong with this booking." }, rowsById).outcome, "failed");
  assert.equal(describeBulkResult({ id: "1", status: "conflict" }, rowsById).reason, "It can't be changed in its current state.");
});

test("the summary line", () => {
  const items = [{ outcome: "done" }, { outcome: "done" }, { outcome: "skipped" }, { outcome: "failed" }];
  assert.deepEqual(summarizeBulk(items), { done: 2, skipped: 1, failed: 1 });
  assert.equal(summaryText({ done: 2, skipped: 1, failed: 1 }), "2 done, 1 skipped, 1 failed");
  assert.equal(summaryText({ done: 5, skipped: 0, failed: 0 }), "5 done");
  assert.equal(summaryText({ done: 0, skipped: 3, failed: 0 }), "0 done, 3 skipped");
});
