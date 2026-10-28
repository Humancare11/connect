import test from "node:test";
import assert from "node:assert/strict";
import { splitDateTime, personOf } from "./recentPayments.js";

test("the date and the time go on two lines", () => {
  assert.deepEqual(splitDateTime("28 Oct 2026, 12:33 pm"), { date: "28 Oct 2026", time: "12:33 pm" });
});

test("a value with no time, an empty value or a dash does not break", () => {
  assert.deepEqual(splitDateTime("28 Oct 2026"), { date: "28 Oct 2026", time: "" });
  assert.deepEqual(splitDateTime("-"), { date: "-", time: "" });
  assert.deepEqual(splitDateTime(""), { date: "", time: "" });
  assert.deepEqual(splitDateTime(undefined), { date: "", time: "" });
});

test("only the first comma splits, so a time never loses text", () => {
  assert.deepEqual(splitDateTime("1 Jan 2027, 09:05 am, IST"), { date: "1 Jan 2027", time: "09:05 am, IST" });
});

test("the name and email come from the link, then from its invoice", () => {
  assert.deepEqual(personOf({ customerName: "Rahul Mehta", customerEmail: "r@x.com", invoice: { clientName: "Other", clientEmail: "o@x.com" } }), { name: "Rahul Mehta", email: "r@x.com" });
  assert.deepEqual(personOf({ customerName: "", customerEmail: "", invoice: { clientName: "From Invoice", clientEmail: "i@x.com" } }), { name: "From Invoice", email: "i@x.com" });
});

test("an old link with no customer and no invoice shows a dash and does not throw", () => {
  assert.deepEqual(personOf({}), { name: "-", email: "" });
  assert.deepEqual(personOf({ invoice: null }), { name: "-", email: "" });
  assert.deepEqual(personOf(undefined), { name: "-", email: "" });
  assert.deepEqual(personOf(null), { name: "-", email: "" });
});
