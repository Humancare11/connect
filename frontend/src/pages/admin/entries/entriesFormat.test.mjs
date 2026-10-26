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

const filled = (extra = {}) => ({
  ...F.newForm("2026-10-27"), serviceProvider: "Dr Rao Clinic", patientName: "Ravi", consultationFee: "100", doctorFee: "70", ...extra,
});

test("a new form starts with today, Open, Pending, Not sent, Not received and Unpaid", () => {
  const f = F.newForm("2026-10-27");
  assert.deepEqual(
    [f.date, f.caseStatus, f.mrStatus, f.mrSentToCompany, f.invoiceSent, f.paymentReceived, f.paymentToProvider, f.serviceType, f.paymentReceivedDate, f.paidDateToProvider],
    ["2026-10-27", "open", "pending", "not_sent", "not_sent", "not_received", "unpaid", "", "", ""],
  );
});

test("the drop-downs offer exactly the agreed choices, in order", () => {
  assert.deepEqual(F.SERVICE_TYPES.map(([, l]) => l), ["Select type", "House call", "Teleconsultation", "Others"]);
  assert.deepEqual(F.CASE_STATUSES.map(([, l]) => l), ["Open", "In progress", "Completed", "Cancelled"]);
  assert.deepEqual(F.MR_STATUSES.map(([, l]) => l), ["Pending", "Received"]);
  assert.deepEqual(F.SENT_STATUSES.map(([, l]) => l), ["Not sent", "Sent"]);
  assert.deepEqual(F.PAYMENT_RECEIVED.map(([, l]) => l), ["Not received", "Partly received", "Received"]);
  assert.deepEqual(F.PAYMENT_TO_PROVIDER.map(([, l]) => l), ["Unpaid", "On hold", "Paid", "Not payable"]);
});

test("Calculation (our margin): consultation fee minus the doctor's fee, with the percentage; red (negative) below 0; empty until both fees are numbers", () => {
  assert.deepEqual(F.calculation(filled()), { empty: false, text: "$30.00", percent: "30.0%", negative: false });
  assert.deepEqual(F.calculation(filled({ consultationFee: "99", doctorFee: "74.25" })), { empty: false, text: "$24.75", percent: "25.0%", negative: false });
  assert.deepEqual(F.calculation(filled({ consultationFee: "50", doctorFee: "65" })), { empty: false, text: "-$15.00", percent: "-30.0%", negative: true });
  assert.deepEqual(F.calculation(filled({ consultationFee: "0", doctorFee: "20" })), { empty: false, text: "-$20.00", percent: "", negative: true });
  assert.deepEqual(F.calculation(filled({ consultationFee: "100", doctorFee: "100" })), { empty: false, text: "$0.00", percent: "0.0%", negative: false });
  for (const extra of [{ doctorFee: "" }, { consultationFee: "" }, { doctorFee: "abc" }, { consultationFee: "1.234" }]) {
    assert.equal(F.calculation(filled(extra)).empty, true, JSON.stringify(extra));
  }
  assert.equal(F.calculation(filled({ doctorFee: "" })).text, "—");
});

test("the payment dates: received or partly received defaults the date to today, not received clears it; Paid defaults its date to today", () => {
  const f = F.newForm("2026-10-27");
  assert.equal(F.changeField(f, "paymentReceived", "received", "2026-10-27").paymentReceivedDate, "2026-10-27");
  assert.equal(F.changeField(f, "paymentReceived", "partly_received", "2026-10-27").paymentReceivedDate, "2026-10-27");
  const kept = F.changeField({ ...f, paymentReceived: "received", paymentReceivedDate: "2026-10-01" }, "paymentReceived", "partly_received", "2026-10-27");
  assert.equal(kept.paymentReceivedDate, "2026-10-01", "an existing date is kept");
  assert.equal(F.changeField(kept, "paymentReceived", "not_received", "2026-10-27").paymentReceivedDate, "");
  assert.equal(F.changeField(f, "paymentToProvider", "paid", "2026-10-27").paidDateToProvider, "2026-10-27");
  assert.equal(F.changeField({ ...f, paidDateToProvider: "2026-10-05" }, "paymentToProvider", "paid", "2026-10-27").paidDateToProvider, "2026-10-05");
  assert.equal(F.changeField(f, "paymentToProvider", "on_hold", "2026-10-27").paidDateToProvider, "");
  assert.equal(F.changeField(f, "company", "Acme", "2026-10-27").company, "Acme");
});

test("the form checks: the required fields, Others, phone numbers, fees, and the Paid rules", () => {
  assert.equal(F.formProblem(filled()), "");
  assert.match(F.formProblem(filled({ date: "" })), /date/i);
  assert.match(F.formProblem(filled({ serviceProvider: " " })), /service provider/i);
  assert.match(F.formProblem(filled({ patientName: " " })), /patient/i);
  assert.match(F.formProblem(filled({ consultationFee: "" })), /consultation fee/i);
  assert.equal(F.formProblem(filled({ consultationFee: "0", doctorFee: "" })), "");
  assert.match(F.formProblem(filled({ doctorFee: "1.234" })), /doctor's fee/i);
  assert.match(F.formProblem(filled({ serviceType: "others" })), /other service/i);
  assert.equal(F.formProblem(filled({ serviceType: "others", otherService: "Physio" })), "");
  for (const good of ["", "0551234567", "+971 50 123 4567", "(022) 555-0123"]) assert.equal(F.formProblem(filled({ contactNumber: good, providerNumber: good })), "", good);
  for (const bad of ["call me", "555.0100", "1".repeat(21)]) {
    assert.match(F.formProblem(filled({ contactNumber: bad })), /contact number/i, bad);
    assert.match(F.formProblem(filled({ providerNumber: bad })), /service provider number/i, bad);
  }
  assert.match(F.formProblem(filled({ paymentToProvider: "paid", doctorFee: "", paidDateToProvider: "2026-10-27" })), /doctor's fee above 0/i);
  assert.match(F.formProblem(filled({ paymentToProvider: "paid", doctorFee: "0", paidDateToProvider: "2026-10-27" })), /doctor's fee above 0/i);
  assert.match(F.formProblem(filled({ paymentToProvider: "paid", paidDateToProvider: "" })), /date/i);
  assert.equal(F.formProblem(filled({ paymentToProvider: "paid", paidDateToProvider: "2026-10-27" })), "");
  assert.match(F.formProblem(filled({ paymentReceived: "received", paymentReceivedDate: "" })), /received/i);
});

test("the request body: trimmed, fees as text, the margin never sent, the Other service only with Others, dates only when they apply", () => {
  const body = F.formBody(filled({ patientName: " Ravi ", company: " Acme ", consultationFee: "$100", serviceType: "house_call", otherService: "left over", feedbackSent: " hi " }));
  assert.deepEqual(
    [body.patientName, body.company, body.consultationFee, body.doctorFee, body.serviceType, body.otherService, body.feedbackSent, "version" in body],
    ["Ravi", "Acme", "100", "70", "house_call", "", "hi", false],
  );
  assert.equal(Object.keys(body).some((k) => /calc|margin/i.test(k)), false);
  assert.equal(F.formBody(filled({ serviceType: "others", otherService: " Physio " })).otherService, "Physio");
  assert.equal("paidDateToProvider" in F.formBody(filled({ paymentToProvider: "on_hold", paidDateToProvider: "2026-10-01" })), false);
  assert.equal(F.formBody(filled({ paymentToProvider: "paid", paidDateToProvider: "2026-10-01" })).paidDateToProvider, "2026-10-01");
  assert.equal(F.formBody(filled({ paymentReceived: "not_received", paymentReceivedDate: "2026-10-01" })).paymentReceivedDate, "");
  assert.equal(F.formBody(filled({ paymentReceived: "received", paymentReceivedDate: "2026-10-01" })).paymentReceivedDate, "2026-10-01");
  assert.equal(F.formBody(filled({ doctorFee: "" })).doctorFee, "");
  assert.equal(F.formBody(filled(), 3).version, 3);
  assert.deepEqual(Object.keys(F.formBody(filled())).sort(), [
    "caseNumber", "caseStatus", "comment", "company", "consultationFee", "contactNumber", "country", "date", "doctorFee", "feedbackReceived", "feedbackSent",
    "invoiceSent", "mrSentToCompany", "mrStatus", "otherService", "patientName", "paymentReceived", "paymentReceivedDate", "paymentToProvider", "providerNumber",
    "serviceProvider", "serviceType",
  ]);
});

test("editing starts from the row's saved values, and the locked fields are the agreed ones", () => {
  const row = { kind: "manual", manual: { form: { ...F.newForm("2026-11-03"), patientName: "Ravi", country: "India", consultationFee: "100.00", doctorFee: "70.00", serviceProvider: "Dr Rao" } } };
  const f = F.formFromRow(row);
  assert.deepEqual([f.patientName, f.country, f.consultationFee, f.doctorFee, f.serviceProvider, f.date], ["Ravi", "India", "100.00", "70.00", "Dr Rao", "2026-11-03"]);
  assert.deepEqual(F.formFromRow({ manual: {} }), F.newForm(""));
  assert.deepEqual(
    [...F.LOCKED_WHEN_PAID].sort(),
    ["caseNumber", "caseStatus", "company", "consultationFee", "contactNumber", "country", "date", "doctorFee", "otherService", "patientName", "providerNumber", "serviceProvider", "serviceType"],
  );
  for (const open of ["mrStatus", "mrSentToCompany", "invoiceSent", "paymentReceived", "paymentReceivedDate", "feedbackSent", "feedbackReceived", "comment", "paymentToProvider", "paidDateToProvider"]) {
    assert.equal(F.LOCKED_WHEN_PAID.includes(open), false, open);
  }
});

test("the grey line under a manual row's patient", () => {
  assert.equal(F.caseLine({ manual: { caseLine: "Acme · AC-1" } }), "Acme · AC-1");
  assert.equal(F.caseLine({}), "");
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
