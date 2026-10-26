import { test } from "node:test";
import assert from "node:assert/strict";
import * as F from "./entriesFormat.js";
import { createSaveQueue } from "./entrySaver.js";

const row = (extra = {}) => ({
  kind: "appointment", id: "6a1f0c22e8a1b9d4a4c0d6aa", feeChargedCents: 9900, amountPaidCents: 9900, sourceGroup: "Web", sourceDetail: "Website",
  entry: { doctorFeeCents: null, paidStatus: "unpaid", paidOn: "", comment: "", version: 0 }, placeholder: { cents: 7425, text: "75% · 74.25" }, ...extra,
});

test("the tabs, filters and page in the URL: junk falls back to the default, defaults are left out", () => {
  assert.deepEqual(F.TAB_ORDER, ["all", "unpaid", "paid", "on_hold", "not_payable"]);
  assert.equal(F.tabFromParam("paid"), "paid");
  assert.equal(F.tabFromParam("nope"), "all");
  assert.equal(F.monthFromParam("2026-10"), "2026-10");
  assert.equal(F.monthFromParam("2026-13"), "");
  assert.equal(F.doctorFromParam("64b0000000000000000000e1"), "64b0000000000000000000e1");
  assert.equal(F.doctorFromParam("x"), "");
  assert.equal(F.pageFromParam("3"), 3);
  assert.equal(F.pageFromParam("0"), 1);
  assert.equal(F.pageFromParam("1.5"), 1);
  assert.deepEqual(F.viewToParams({ tab: "all", doctor: "", month: "", page: 1 }), {});
  assert.deepEqual(F.viewToParams({ tab: "paid", doctor: "d1", month: "2026-10", page: 2 }), { tab: "paid", doctor: "d1", month: "2026-10", page: "2" });
});

test("money: cents to dollars with a thousands comma, and to the text of an input", () => {
  assert.equal(F.formatMoney(9900), "$99.00");
  assert.equal(F.formatMoney(149900), "$1,499.00");
  assert.equal(F.formatMoney(0), "$0.00");
  assert.equal(F.formatMoney(null), "$0.00");
  assert.equal(F.centsToInput(7425), "74.25");
  assert.equal(F.centsToInput(null), "");
});

test("a typed fee: a leading $ is fine, empty means 'no fee', more than 2 decimals or letters are refused", () => {
  assert.deepEqual(F.cleanFeeInput(" $12.50 "), { ok: true, value: "12.50" });
  assert.deepEqual(F.cleanFeeInput("12"), { ok: true, value: "12" });
  assert.deepEqual(F.cleanFeeInput(""), { ok: true, value: "" });
  for (const bad of ["1.234", "-1", "1,000", "abc", "12345678", "1."]) assert.equal(F.cleanFeeInput(bad).ok, false, bad);
  assert.equal(F.sameFee("74.5", 7450), true);
  assert.equal(F.sameFee("", null), true);
  assert.equal(F.sameFee("", 0), false);
  assert.equal(F.sameFee("0", 0), true);
  assert.equal(F.sameFee("10", null), false);
});

test("dates: calendar days and months are plain text, times convert for the time input", () => {
  assert.equal(F.formatDay("2026-10-16"), "16 Oct 2026");
  assert.equal(F.formatDay(""), "—");
  assert.equal(F.formatMonth("2026-10"), "October 2026");
  assert.equal(F.timeToInput("2:30 PM"), "14:30");
  assert.equal(F.timeToInput("12:05 AM"), "00:05");
  assert.equal(F.timeToInput("12:00 PM"), "12:00");
  assert.equal(F.timeToInput(""), "");
  assert.equal(F.formatBooked("not a date"), "—");
});

test("ids and labels: a booking shows the last 8 characters, a manual entry its M- code, with the Web / App / Manual label", () => {
  assert.equal(F.idText(row()), `…${"6a1f0c22e8a1b9d4a4c0d6aa".slice(-8).toUpperCase()}`);
  assert.equal(F.idText(row({ kind: "manual", shortId: "M-1A2B" })), "M-1A2B");
  assert.deepEqual(F.sourceLabel(row()), { text: "Web", tone: "web", title: "Website" });
  assert.equal(F.sourceLabel(row({ sourceGroup: "Manual" })).tone, "manual");
  assert.equal(F.sourceLabel({}).tone, "unknown");
});

test("fee charged shows 'paid $X' only when the patient paid a different amount", () => {
  assert.deepEqual(F.feeCharged(row()), { main: "$99.00", paid: "" });
  assert.deepEqual(F.feeCharged(row({ feeChargedCents: 9900, amountPaidCents: 4500 })), { main: "$99.00", paid: "paid $45.00" });
});

test("the grey placeholder: 75% text while no fee is saved, none on Not payable rows or once a fee is saved", () => {
  assert.equal(F.feePlaceholder(row()), "75% · 74.25");
  assert.equal(F.feePlaceholder(row({ entry: { ...row().entry, paidStatus: "not_payable" } })), "0.00");
  assert.equal(F.feePlaceholder(row({ entry: { ...row().entry, doctorFeeCents: 3000 } })), "0.00");
  assert.equal(F.feePlaceholder(row({ placeholder: null })), "0.00");
});

test("totals and range text", () => {
  assert.equal(F.totalsText(1), "Totals for 1 row");
  assert.equal(F.totalsText(12), "Totals for 12 rows");
  assert.equal(F.rangeText(2, 25, 60), "Showing 26–50 of 60");
  assert.equal(F.rangeText(1, 0, 0), "");
  assert.equal(F.rowNumber(2, 0), 26);
});

test("replaceRow swaps only the row of that kind and id", () => {
  const a = row();
  const b = row({ kind: "category" });
  const fresh = { ...a, entry: { ...a.entry, version: 1 } };
  assert.deepEqual(F.replaceRow([a, b], fresh), [fresh, b]);
});

test("save errors: the server's words, or a plain fallback; a stale answer is recognised", () => {
  assert.equal(F.saveErrorText({ response: { data: { msg: "Assign a doctor before marking this Paid." } } }), "Assign a doctor before marking this Paid.");
  assert.match(F.saveErrorText({ response: { data: {} } }), /Couldn't save/);
  assert.match(F.saveErrorText(new Error("Network Error")), /connection/);
  assert.equal(F.isStale({ response: { status: 409, data: { code: "stale" } } }), true);
  assert.equal(F.isStale({ response: { status: 409, data: { code: "fee_required" } } }), false);
});

test("download name: from the header, else dated", () => {
  assert.equal(F.downloadName('attachment; filename="entries-2026-10-27.csv"'), "entries-2026-10-27.csv");
  assert.equal(F.downloadName("", "2026-10-27"), "entries-2026-10-27.csv");
});

test("the manual form: checks, and the bodies for add and edit", () => {
  const ok = { ...F.EMPTY_FORM, patientName: " Ravi ", date: "2026-11-03", feeCharged: "$49", doctorFee: "", doctorId: "d1", comment: " hi " };
  assert.equal(F.formProblem(ok), "");
  assert.match(F.formProblem({ ...ok, patientName: " " }), /name/);
  assert.match(F.formProblem({ ...ok, date: "" }), /date/);
  assert.match(F.formProblem({ ...ok, feeCharged: "" }), /fee charged/i);
  assert.match(F.formProblem({ ...ok, feeCharged: "x" }), /fee charged/i);
  assert.equal(F.formProblem({ ...ok, feeCharged: "0" }), "");
  assert.match(F.formProblem({ ...ok, doctorFee: "1.234" }), /Doctor fee/);
  assert.deepEqual(F.createBody(ok), { patientName: "Ravi", country: "", doctorId: "d1", date: "2026-11-03", time: "10:00", feeCharged: "49", doctorFee: "", comment: "hi" });
  assert.deepEqual(F.editBody(ok, 3), { version: 3, patientName: "Ravi", country: "", doctorId: "d1", date: "2026-11-03", time: "10:00", feeCharged: "49" });
  assert.equal(F.createBody({ ...ok, doctorId: "" }).doctorId, null);
});

test("editing a manual row starts from its own values", () => {
  const manual = {
    kind: "manual", patient: { name: "Ravi", country: "IN", countryName: "India" }, consultation: { date: "2026-11-03", time: "2:30 PM" },
    feeChargedCents: 4900, manual: { doctorId: "d1" },
  };
  assert.deepEqual(F.formFromRow(manual), { patientName: "Ravi", country: "India", doctorId: "d1", date: "2026-11-03", time: "14:30", feeCharged: "49.00", doctorFee: "", comment: "" });
});

test("doctor options come from approved enrollments, sorted by name", () => {
  const list = [{ _id: "b", firstName: "Zed", surname: "Z" }, { _id: "a", doctorId: { name: "Anna" } }];
  assert.deepEqual(F.doctorOptions(list), [{ id: "a", name: "Anna" }, { id: "b", name: "Zed Z" }]);
  assert.deepEqual(F.doctorOptions(null), []);
});

// ── the save queue ──────────────────────────────────────────────────────────

const stale = (item) => Object.assign(new Error("409"), { response: { status: 409, data: { code: "stale", msg: "Someone else changed this row.", item } } });

test("save queue: two saves of one row go one after the other, the second with the version the first produced", async () => {
  const rows = new Map();
  const first = row();
  rows.set(F.rowKey(first), first);
  const calls = [];
  let release;
  const gate = new Promise((r) => { release = r; });
  const queue = createSaveQueue({
    getRow: (key) => rows.get(key),
    onRow: (item) => rows.set(F.rowKey(item), item),
    send: async (kind, id, body) => {
      calls.push({ ...body, at: calls.length });
      if (calls.length === 1) await gate;
      return { data: { item: { ...first, entry: { ...first.entry, version: body.version + 1 } } } };
    },
  });
  const a = queue.save(first, "doctorFee", "10");
  const b = queue.save(first, "paidStatus", "paid");
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(calls.length, 1, "the second waits for the first");
  release();
  const [ra, rb] = await Promise.all([a, b]);
  assert.deepEqual([ra.ok, rb.ok], [true, true]);
  assert.deepEqual(calls.map((c) => [c.field, c.version]), [["doctorFee", 0], ["paidStatus", 1]]);
});

test("save queue: different rows are not held up by each other", async () => {
  const a = row();
  const b = row({ id: "other" });
  let inFlight = 0;
  let peak = 0;
  const queue = createSaveQueue({
    getRow: () => undefined,
    onRow: () => {},
    send: async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 15));
      inFlight -= 1;
      return { data: { item: a } };
    },
  });
  await Promise.all([queue.save(a, "comment", "x"), queue.save(b, "comment", "y")]);
  assert.equal(peak, 2);
});

test("save queue: an error comes back as a result, not a throw; a stale answer hands over the current row", async () => {
  const seen = [];
  const current = row({ entry: { ...row().entry, version: 5, doctorFeeCents: 1000 } });
  const queue = createSaveQueue({
    getRow: () => undefined,
    onRow: (item) => seen.push(item),
    send: async (kind, id, body) => {
      if (body.field === "comment") throw stale(current);
      throw Object.assign(new Error("409"), { response: { status: 409, data: { code: "fee_required", msg: "Enter a doctor fee above 0 before marking this Paid." } } });
    },
  });
  const rule = await queue.save(row(), "paidStatus", "paid");
  assert.deepEqual(rule, { ok: false, stale: false, msg: "Enter a doctor fee above 0 before marking this Paid." });
  const conflict = await queue.save(row(), "comment", "x");
  assert.deepEqual([conflict.ok, conflict.stale], [false, true]);
  assert.deepEqual(seen, [current]);
  const after = await queue.save(row(), "paidStatus", "paid");
  assert.equal(after.ok, false, "the queue keeps working after a failure");
});
