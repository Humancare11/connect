import test from "node:test";
import assert from "node:assert/strict";
import {
  PAYMENT_TERMS_OPTIONS,
  DEFAULT_PAYMENT_TERMS,
  computeItemAmountCents,
  dueDateForTerms,
  termsLine,
} from "./invoiceForm.js";

test("item amounts use the same cent rounding as the server", () => {
  assert.equal(computeItemAmountCents({ quantity: "2", rate: "150" }), 30000);
  assert.equal(computeItemAmountCents({ quantity: "1", rate: "49.5" }), 4950);
  assert.equal(computeItemAmountCents({ quantity: "3", rate: "0.1" }), 30);
  assert.equal(computeItemAmountCents({ quantity: "1.5", rate: "10.01" }), 1502);
});

test("incomplete or invalid items count as zero", () => {
  assert.equal(computeItemAmountCents({ quantity: "", rate: "10" }), 0);
  assert.equal(computeItemAmountCents({ quantity: "1", rate: "" }), 0);
  assert.equal(computeItemAmountCents({ quantity: "0", rate: "10" }), 0);
  assert.equal(computeItemAmountCents({ quantity: "1", rate: "-5" }), 0);
});

test("the form starts on Net 30", () => {
  assert.equal(DEFAULT_PAYMENT_TERMS.value, "Net 30 Days");
  assert.equal(PAYMENT_TERMS_OPTIONS.length, 4);
});

test("due date is today plus the terms' days, as a YYYY-MM-DD string", () => {
  const from = new Date(2026, 8, 1, 12).getTime(); // local Sep 1 2026, noon
  assert.equal(dueDateForTerms("Due on Receipt", from), "2026-09-01");
  assert.equal(dueDateForTerms("Net 15 Days", from), "2026-09-16");
  assert.equal(dueDateForTerms("Net 30 Days", from), "2026-10-01");
  assert.equal(dueDateForTerms("Net 60 Days", from), "2026-10-31");
  assert.equal(dueDateForTerms("something else", from), null);
});

test("the terms line follows the payment terms", () => {
  assert.match(termsLine("Due on Receipt"), /due immediately on receipt/);
  assert.match(termsLine("Net 30 Days"), /within 30 days from the invoice date \(Net 30\)/);
});
