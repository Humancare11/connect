// Plain helpers for selecting rows and running bulk actions (no React), tested with `node --test`
// (see selectionLogic.test.mjs). Selection is always of the rows on the current page.
import { canAutoComplete, canCancel, currencyCode, formatFee, shortBookingId } from "./bookingFormat.js";

export const BULK_ACTIONS = {
  "auto-complete": { label: "Auto complete", title: "Auto complete" },
  cancel: { label: "Cancel", title: "Cancel" },
  "mark-testing": { label: "Mark testing", title: "Mark as testing" },
  "unmark-testing": { label: "Unmark testing", title: "Unmark testing" },
};

// ── The header checkbox's menu ───────────────────────────────────────────────

export const MENU_LABELS = {
  selectPage: "Select this page",
  oneByOne: "Select one by one",
  clear: "Clear selection",
  exit: "Exit selection",
};

// Only the choices that make sense right now:
//   nothing selected, selection off  -> Select this page, Select one by one
//   nothing selected, selection on   -> Select this page, Exit selection
//   everything on the page selected  -> Clear selection, Exit selection
//   some selected                    -> Select this page, Clear selection, Exit selection
export function menuOptions({ selecting, selectedCount, pageCount }) {
  const all = pageCount > 0 && selectedCount >= pageCount;
  let ids;
  if (selectedCount === 0) ids = selecting ? ["selectPage", "exit"] : ["selectPage", "oneByOne"];
  else if (all) ids = ["clear", "exit"];
  else ids = ["selectPage", "clear", "exit"];
  return ids.map((id) => ({ id, label: MENU_LABELS[id] }));
}

export const selectionText = (count) => `${count} selected on this page`;

// Drops ids that are no longer on the page. Returns the SAME set when nothing changed, so a
// state update with it is a no-op.
export function pruneSelection(selected, rows) {
  const present = new Set(rows.map((r) => r.id));
  let changed = false;
  const next = new Set();
  for (const id of selected) {
    if (present.has(id)) next.add(id);
    else changed = true;
  }
  return changed ? next : selected;
}

// ── Bulk actions ─────────────────────────────────────────────────────────────

const gatewayName = (row) => ({ stripe: "Stripe", paypal: "PayPal" })[String(row.paymentGateway || "").toLowerCase()] || "";

// The refund reminder for a group of bookings (""  when none was paid). Cancelling never refunds, so the
// admin is told how many were paid and where the money was taken.
//   1 paid:   "1 of the selected bookings was paid and is not refunded automatically. Refund it in Stripe."
//   several:  "3 of the selected bookings were paid and are not refunded automatically. Refund them: Stripe (2), PayPal (1)."
// `noun` fits the sentence: "selected", "cancelled".
export function bulkRefundNote(rows, noun = "selected") {
  const paid = rows.filter((r) => r.paid);
  if (paid.length === 0) return "";
  if (paid.length === 1) {
    const name = gatewayName(paid[0]);
    // A EUR / GBP booking also names the amount and currency to refund; a USD one reads as it always did.
    const code = currencyCode(paid[0].currency);
    const amount = code === "USD" ? "" : ` (${Number(paid[0].fee) > 0 ? formatFee(paid[0].fee, code) : code})`;
    return `1 of the ${noun} bookings was paid and is not refunded automatically. Refund it ${name ? `in ${name}` : "with the payment provider"}${amount}.`;
  }
  const counts = new Map();
  for (const r of paid) {
    const name = gatewayName(r) || "other";
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  const order = ["Stripe", "PayPal", "other"].filter((name) => counts.has(name));
  const list = order.map((name) => `${name} (${counts.get(name)})`).join(", ");
  // Different currencies are named, never added: "Currencies: EUR (2), USD (1)."
  const currencies = new Map();
  for (const r of paid) currencies.set(currencyCode(r.currency), (currencies.get(currencyCode(r.currency)) || 0) + 1);
  const currencyNote = currencies.size === 1 && currencies.has("USD")
    ? ""
    : ` Currencies: ${["USD", "EUR", "GBP"].filter((c) => currencies.has(c)).map((c) => `${c} (${currencies.get(c)})`).join(", ")}.`;
  return `${paid.length} of the ${noun} bookings were paid and are not refunded automatically. Refund them: ${list}.${currencyNote}`;
}

// How many of the selected rows the action can apply to, by the same rules the server uses
// (the server still decides). Marking testing applies to every row.
export function eligibleCount(action, rows) {
  if (action === "auto-complete") return rows.filter(canAutoComplete).length;
  if (action === "cancel") return rows.filter(canCancel).length;
  return rows.length;
}

// One line of the result list: what happened to which booking, and why if it was skipped.
export function describeBulkResult(result, rowsById) {
  const row = rowsById.get(result.id);
  const name = row ? `${shortBookingId(row)} · ${row.patient?.name || "Unknown patient"}` : `…${String(result.id).slice(-8).toUpperCase()}`;
  if (result.status === "ok") return { id: result.id, name, outcome: "done", reason: "", paid: result.paid === true };
  if (result.status === "not_found") return { id: result.id, name, outcome: "skipped", reason: "This booking no longer exists.", paid: false };
  if (result.status === "conflict") return { id: result.id, name, outcome: "skipped", reason: result.message || "It can't be changed in its current state.", paid: false };
  return { id: result.id, name, outcome: "failed", reason: result.message || "Something went wrong with this booking.", paid: false };
}

// Marking or unmarking testing needs no confirmation: it answers with a toast that has an Undo, which does the
// opposite to the same bookings.
export const TESTING_ACTIONS = { "mark-testing": "unmark-testing", "unmark-testing": "mark-testing" };
export const UNDO_TOAST_MS = 10000;

export function testingToastText(action, count) {
  const noun = count === 1 ? "booking" : "bookings";
  return action === "mark-testing" ? `${count} ${noun} marked as testing.` : `${count} ${noun} unmarked as testing.`;
}

export function summarizeBulk(items) {
  const summary = { done: 0, skipped: 0, failed: 0 };
  for (const item of items) summary[item.outcome] += 1;
  return summary;
}

export function summaryText(summary) {
  const parts = [`${summary.done} done`];
  if (summary.skipped) parts.push(`${summary.skipped} skipped`);
  if (summary.failed) parts.push(`${summary.failed} failed`);
  return parts.join(", ");
}
