const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const M = require("../utils/manualEntry");
const E = require("../utils/bookingEntry");
const ManualEntry = require("../models/ManualEntry");

const TODAY = "2026-10-26";
const NOW = new Date("2026-10-26T09:00:00Z");
const ADMIN = { id: "64b000000000000000000003", name: "An Admin", email: "admin@humancare.com", role: "admin" };
const SUPER = { id: "64b000000000000000000001", name: "Super Admin", email: "superadmin@humancare.com", role: "superadmin" };
const PAYMENT = { id: "64b000000000000000000002", name: "Pay Admin", email: "pay@humancare.com", role: "paymentadmin" };
const DOC = { enrollmentId: "64b0000000000000000000e1", name: "Dr Rao" };

const form = (extra = {}) => ({ patientName: "Ravi Sharma", country: "india", date: "2026-10-30", time: "14:30", feeCharged: "49", ...extra });
const create = (extra) => M.validateManualCreate(form(extra), { today: TODAY });
const stored = (extra = {}, value) => {
  const r = create(value);
  assert.equal(r.ok, true, r.msg);
  return { _id: "64b0000000000000000000aa", createdAt: NOW, ...M.buildManualDocument(r.value, { actor: ADMIN, doctor: DOC, code: "1A2B", now: NOW }), ...extra };
};
const editCtx = (extra = {}) => ({ actor: ADMIN, today: TODAY, now: NOW, ...extra });

describe("manual entry: the add form", () => {
  test("a good form is cleaned: country to its code, 24h time to 12h, money to cents", () => {
    const r = create({ doctorFee: "36.75", comment: "  Booked by phone  ", doctorId: "abc" });
    assert.equal(r.ok, true);
    assert.deepEqual(r.value, {
      patientName: "Ravi Sharma", country: "IN", date: "2026-10-30", time: "2:30 PM", feeChargedCents: 4900, doctorFeeCents: 3675,
      comment: "Booked by phone", doctorId: "abc",
    });
  });

  test("only the patient name and the fee charged are required; 0 is a valid fee", () => {
    const r = M.validateManualCreate({ patientName: "A", date: "2026-10-30", feeCharged: "0" }, { today: TODAY });
    assert.equal(r.ok, true);
    assert.equal(r.value.feeChargedCents, 0);
    assert.equal(r.value.doctorFeeCents, null);
    assert.equal(r.value.time, "");
    assert.equal(M.validateManualCreate({ patientName: "A", date: "2026-10-30" }, { today: TODAY }).code, "invalid_fee_charged");
    assert.equal(create({ patientName: "  " }).code, "invalid_name");
    assert.equal(create({ patientName: "x".repeat(81) }).code, "invalid_name");
    assert.equal(create({ patientName: 5 }).code, "invalid_name");
  });

  test("bad money, dates, times and comments are refused with a 400", () => {
    for (const [extra, code] of [
      [{ feeCharged: "-1" }, "invalid_fee_charged"],
      [{ feeCharged: "1,000" }, "invalid_fee_charged"],
      [{ feeCharged: "abc" }, "invalid_fee_charged"],
      [{ doctorFee: "1.234" }, "invalid_fee"],
      [{ date: "2026-02-30" }, "invalid_date"],
      [{ date: "1999-12-31" }, "invalid_date"],
      [{ date: "2030-01-01" }, "invalid_date"],
      [{ date: "" }, "invalid_date"],
      [{ time: "25:00" }, "invalid_time"],
      [{ time: "noon" }, "invalid_time"],
      [{ comment: "x".repeat(501) }, "comment_too_long"],
      [{ country: "x".repeat(61) }, "invalid_country"],
    ]) {
      const r = create(extra);
      assert.deepEqual([r.ok, r.status, r.code], [false, 400, code], JSON.stringify(extra));
    }
    assert.equal(M.validateManualCreate(null, { today: TODAY }).ok, false);
  });

  test("times: a time input and a typed 12-hour time both work", () => {
    assert.equal(M.parseTime("00:05"), "12:05 AM");
    assert.equal(M.parseTime("12:00"), "12:00 PM");
    assert.equal(M.parseTime("9:05 pm"), "9:05 PM");
    assert.equal(M.parseTime(""), "");
    assert.equal(M.parseTime("13:00 PM"), undefined);
  });

  test("an unknown country is kept as typed; a name or a code becomes the code", () => {
    assert.equal(M.normalizeCountry("United Kingdom"), "GB");
    assert.equal(M.normalizeCountry("gb"), "GB");
    assert.equal(M.normalizeCountry("Atlantis"), "Atlantis");
    assert.equal(M.normalizeCountry(""), "");
  });

  test("the new document starts the audit trail: a created line, and the first fee and comment as history", () => {
    const doc = M.buildManualDocument(create({ doctorFee: "36.75", comment: "phone" }).value, { actor: ADMIN, doctor: DOC, code: "1A2B", now: NOW });
    assert.equal(doc.code, "1A2B");
    assert.equal(doc.doctorName, "Dr Rao");
    assert.equal(doc.entry.doctorFeeCents, 3675);
    assert.equal(doc.entry.paidStatus, "unpaid");
    assert.deepEqual(doc.entry.history.map((h) => [h.field, h.from, h.to]), [["doctorFee", "", "36.75"], ["comment", "", "phone"]]);
    assert.equal(doc.entry.edits.doctorFee.by.name, "An Admin");
    assert.deepEqual([doc.log[0].action, doc.log[0].by.role], ["created", "admin"]);
    assert.equal(doc.createdBy.email, "admin@humancare.com");
    const bare = M.buildManualDocument(create().value, { actor: ADMIN, code: "1A2B", now: NOW });
    assert.deepEqual([bare.doctorEnrollmentId, bare.doctorName, bare.entry.history.length], [null, "", 0]);
  });

  test("codes: 4 hex characters shown as M-XXXX, and a search for any form of it is understood", () => {
    assert.match(M.newCode(), /^[0-9A-F]{4}$/);
    assert.equal(M.displayCode("1A2B"), "M-1A2B");
    for (const q of ["M-1A2B", "m1a2b", "1a2b", " M-1a2b "]) assert.equal(M.codeSearchText(q), "1A2B", q);
  });
});

describe("manual entry: editing the details", () => {
  test("every detail can change while the row is not Paid, and each change is logged with who and when", () => {
    const r = M.applyManualDetailsEdit(stored(), { patientName: "Ravi S", country: "United Kingdom", doctorId: "x", date: "2026-11-02", time: "09:15", feeCharged: "60" }, editCtx({ doctor: { enrollmentId: "64b0000000000000000000e2", name: "Dr Iyer" } }));
    assert.equal(r.ok, true);
    assert.deepEqual(r.set, {
      patientName: "Ravi S", country: "GB", doctorEnrollmentId: "64b0000000000000000000e2", doctorName: "Dr Iyer", date: "2026-11-02", time: "9:15 AM", feeChargedCents: 6000,
    });
    assert.deepEqual(
      r.log.map((l) => [l.action, l.field, l.from, l.to]),
      [["edited", "patientName", "Ravi Sharma", "Ravi S"], ["edited", "country", "IN", "GB"], ["edited", "doctor", "Dr Rao", "Dr Iyer"], ["edited", "date", "2026-10-30", "2026-11-02"], ["edited", "time", "2:30 PM", "9:15 AM"], ["edited", "fee", "49.00", "60.00"]],
    );
    assert.ok(r.log.every((l) => l.by.name === "An Admin" && l.at === NOW));
  });

  test("the doctor can be cleared; an unknown doctor is refused", () => {
    const cleared = M.applyManualDetailsEdit(stored(), { doctorId: null }, editCtx());
    assert.deepEqual(cleared.set, { doctorEnrollmentId: null, doctorName: "" });
    const bad = M.applyManualDetailsEdit(stored(), { doctorId: "64b0000000000000000000ff" }, editCtx({ doctor: null }));
    assert.deepEqual([bad.ok, bad.status, bad.code], [false, 400, "invalid_doctor"]);
  });

  test("a Paid row is locked: 409, nothing to write", () => {
    const paid = stored({ entry: { ...stored().entry, paidStatus: "paid", paidOn: TODAY, doctorFeeCents: 100 } });
    const r = M.applyManualDetailsEdit(paid, { patientName: "Someone else" }, editCtx());
    assert.deepEqual([r.ok, r.status, r.code], [false, 409, "locked_paid"]);
  });

  test("changing nothing is a no-op; an empty request, bad values and the wrong role are refused", () => {
    const same = M.applyManualDetailsEdit(stored(), { patientName: "Ravi Sharma", feeCharged: "49.00", time: "2:30 PM" }, editCtx());
    assert.deepEqual([same.ok, same.noop, same.log.length], [true, true, 0]);
    assert.equal(M.applyManualDetailsEdit(stored(), {}, editCtx()).code, "nothing_to_change");
    assert.equal(M.applyManualDetailsEdit(stored(), { patientName: "" }, editCtx()).code, "invalid_name");
    assert.equal(M.applyManualDetailsEdit(stored(), { feeCharged: "" }, editCtx()).code, "invalid_fee_charged");
    assert.equal(M.applyManualDetailsEdit(stored(), { date: "nope" }, editCtx()).code, "invalid_date");
    assert.equal(M.applyManualDetailsEdit(stored(), { time: "99:99" }, editCtx()).code, "invalid_time");
    assert.equal(M.applyManualDetailsEdit(stored(), { patientName: "B" }, editCtx({ actor: PAYMENT })).status, 403);
    assert.equal(M.applyManualDetailsEdit(stored(), { patientName: "B" }, editCtx({ actor: null })).status, 403);
    assert.equal(M.applyManualDetailsEdit(stored(), { patientName: "B" }, editCtx({ actor: SUPER })).ok, true);
  });
});

describe("manual entry: deleting", () => {
  test("allowed for an unpaid, on-hold or not-payable row; refused when Paid, already deleted, or by the wrong role", () => {
    for (const paidStatus of ["unpaid", "on_hold", "not_payable"]) {
      assert.equal(M.checkManualDelete(stored({ entry: { paidStatus } }), ADMIN).ok, true, paidStatus);
    }
    assert.deepEqual(
      (({ status, code }) => [status, code])(M.checkManualDelete(stored({ entry: { paidStatus: "paid" } }), ADMIN)),
      [409, "delete_paid"],
    );
    assert.equal(M.checkManualDelete(stored({ deletedAt: NOW }), ADMIN).status, 404);
    assert.equal(M.checkManualDelete(null, ADMIN).status, 404);
    assert.equal(M.checkManualDelete(stored(), PAYMENT).status, 403);
  });

  test("the soft delete records who and when, and a deleted line in the log", () => {
    const w = M.manualDeleteWrite(SUPER, NOW);
    assert.deepEqual([w.set.deletedAt, w.set.deletedBy.name, w.log.action, w.log.by.role], [NOW, "Super Admin", "deleted", "superadmin"]);
  });
});

describe("manual entry: the row the page gets", () => {
  test("same shape as a booking row, Source is Manual, the placeholder is 75% of the fee charged", () => {
    const row = M.toManualRow(stored());
    assert.deepEqual([row.kind, row.shortId, row.sourceGroup, row.sourceCsv.Source, row.status], ["manual", "M-1A2B", "Manual", "Manual", "manual"]);
    assert.deepEqual(row.consultation, { date: "2026-10-30", time: "2:30 PM" });
    assert.deepEqual(row.patient, { name: "Ravi Sharma", country: "IN", countryName: "India" });
    assert.deepEqual([row.feeChargedCents, row.amountPaidCents], [4900, 4900]);
    assert.equal(row.placeholder.cents, 3675);
    assert.equal(row.placeholder.text, "75% · 36.75");
    assert.deepEqual([row.doctorChanged, row.cancelledAfterPaid, row.entry.paidStatus, row.entry.version], [false, false, "unpaid", 0]);
    assert.deepEqual([row.manual.locked, row.manual.canDelete, row.manual.doctorId, row.manual.addedBy], [false, true, "64b0000000000000000000e1", "An Admin"]);
  });

  test("a fee of 0 has no placeholder; a typed doctor fee replaces it; Paid locks Edit and Delete", () => {
    assert.equal(M.toManualRow(stored({ feeChargedCents: 0 })).placeholder, null);
    const typed = M.toManualRow(stored({ entry: { doctorFeeCents: 3000, paidStatus: "paid", paidOn: TODAY } }));
    assert.equal(typed.placeholder, null);
    assert.equal(typed.entry.doctorFeeCents, 3000);
    assert.deepEqual([typed.manual.locked, typed.manual.canDelete], [true, false]);
  });

  test("the same edit rules apply: Paid needs a doctor and a fee, and fills today's date", () => {
    const doc = stored();
    const noFee = E.applyEntryEdit(doc.entry, { field: "paidStatus", value: "paid" }, { hasDoctor: true, today: TODAY, actor: ADMIN });
    assert.equal(noFee.code, "fee_required");
    const noDoctor = E.applyEntryEdit({ ...doc.entry, doctorFeeCents: 3000 }, { field: "paidStatus", value: "paid" }, { hasDoctor: false, today: TODAY, actor: ADMIN });
    assert.equal(noDoctor.code, "doctor_required");
    const ok = E.applyEntryEdit({ ...doc.entry, doctorFeeCents: 3000 }, { field: "paidStatus", value: "paid" }, { hasDoctor: true, today: TODAY, actor: ADMIN });
    assert.equal(ok.ok, true);
    assert.equal(ok.set["entry.paidOn"], TODAY);
  });
});

describe("manual entry: the model", () => {
  let mongod;
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await ManualEntry.init();
  });
  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  test("a built document saves, reads back with its audit trail, and the code is unique", async () => {
    const built = M.buildManualDocument(create({ doctorFee: "30", comment: "phone" }).value, { actor: ADMIN, doctor: { enrollmentId: new mongoose.Types.ObjectId(), name: "Dr Rao" }, code: "AAAA", now: NOW });
    const saved = await ManualEntry.create(built);
    const read = await ManualEntry.findById(saved._id).lean();
    assert.equal(read.deletedAt, null);
    assert.equal(read.entry.doctorFeeCents, 3000);
    assert.equal(read.entry.history.length, 2);
    assert.equal(read.log[0].action, "created");
    assert.equal(read.createdBy.name, "An Admin");
    await assert.rejects(ManualEntry.create({ ...built, entry: undefined }), /duplicate key|E11000/);
  });

  test("the model refuses a missing name, a negative fee and an unknown log action", async () => {
    const ok = M.buildManualDocument(create().value, { actor: ADMIN, code: "BBBB", now: NOW });
    await assert.rejects(ManualEntry.create({ ...ok, patientName: "" }), /patientName/);
    await assert.rejects(ManualEntry.create({ ...ok, code: "CCCC", feeChargedCents: -1 }), /feeChargedCents/);
    await assert.rejects(ManualEntry.create({ ...ok, code: "DDDD", log: [{ action: "vanished" }] }), /action/);
  });
});
