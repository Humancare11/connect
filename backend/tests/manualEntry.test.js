const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const M = require("../utils/manualEntry");
const E = require("../utils/bookingEntry");
const { csvCells, COLUMNS } = require("../utils/bookingEntryCsv");
const ManualEntry = require("../models/ManualEntry");

const TODAY = "2026-10-27";
const NOW = new Date("2026-10-26T22:00:00Z");
const ADMIN = { id: "64b000000000000000000003", name: "An Admin", email: "admin@humancare.com", role: "admin" };
const SUPER = { id: "64b000000000000000000001", name: "Super Admin", email: "superadmin@humancare.com", role: "superadmin" };
const PAYMENT = { id: "64b000000000000000000002", name: "Pay Admin", email: "pay@humancare.com", role: "paymentadmin" };

// A complete, valid form.
const form = (extra = {}) => ({
  date: "2026-11-03", company: "Acme Assist", caseNumber: "AC-1042", serviceType: "house_call", caseStatus: "open",
  serviceProvider: "Dr Rao Clinic", providerNumber: "+91 98765-43210",
  patientName: "Ravi Sharma", country: "india", contactNumber: "(022) 5550 1234",
  consultationFee: "100", doctorFee: "70",
  mrStatus: "pending", mrSentToCompany: "not_sent", invoiceSent: "not_sent",
  paymentReceived: "not_received", paymentToProvider: "unpaid",
  feedbackSent: "", feedbackReceived: "", comment: "",
  ...extra,
});
const check = (extra) => M.validateManualCreate(form(extra), { today: TODAY });
const built = (extra = {}, value) => {
  const r = check(value);
  assert.equal(r.ok, true, r.msg);
  const b = M.buildManualDocument(r.value, { actor: ADMIN, code: "1A2B", now: NOW, today: TODAY, ...extra });
  assert.equal(b.ok, true, b.msg);
  return { _id: "64b0000000000000000000aa", createdAt: NOW, ...b.doc };
};
const edit = (doc, body, extra = {}) => M.applyManualFormEdit(doc, body, { actor: ADMIN, today: TODAY, now: NOW, ...extra });
const paidDoc = (extra) => built({}, { paymentToProvider: "paid", ...extra });

describe("manual entry: the add form", () => {
  test("a complete form is cleaned: country to its code, money to cents, defaults for what was left out", () => {
    const r = check();
    assert.equal(r.ok, true);
    assert.deepEqual(
      [r.value.country, r.value.consultationFee, r.value.doctorFee, r.value.serviceType, r.value.providerNumber, r.value.contactNumber],
      ["IN", 10000, 7000, "house_call", "+91 98765-43210", "(022) 5550 1234"],
    );
    const bare = M.validateManualCreate({ date: "2026-11-03", serviceProvider: "Dr X", patientName: "A", consultationFee: "0" }, { today: TODAY });
    assert.equal(bare.ok, true);
    assert.deepEqual(
      [bare.value.caseStatus, bare.value.mrStatus, bare.value.mrSentToCompany, bare.value.invoiceSent, bare.value.paymentReceived, bare.value.paymentToProvider, bare.value.doctorFee, bare.value.serviceType],
      ["open", "pending", "not_sent", "not_sent", "not_received", "unpaid", null, ""],
    );
  });

  test("the date, service provider, patient name and consultation fee are required; 0 is a valid fee", () => {
    for (const [extra, code] of [
      [{ date: "" }, "invalid_date"],
      [{ serviceProvider: "  " }, "invalid_provider"],
      [{ patientName: "" }, "invalid_name"],
      [{ consultationFee: "" }, "invalid_fee_charged"],
    ]) {
      const r = check(extra);
      assert.deepEqual([r.ok, r.status, r.code], [false, 400, code], JSON.stringify(extra));
    }
    assert.equal(M.validateManualCreate({ serviceProvider: "Dr X", patientName: "A", consultationFee: "5" }, { today: TODAY }).code, "invalid_date");
    assert.equal(check({ consultationFee: "0", doctorFee: "0" }).ok, true);
  });

  test("Type of service 'Others' needs the Other service text; for any other type the text is dropped", () => {
    assert.equal(check({ serviceType: "others" }).code, "other_service_required");
    assert.equal(check({ serviceType: "others", otherService: "   " }).code, "other_service_required");
    const others = check({ serviceType: "others", otherService: " Physio at home " });
    assert.deepEqual([others.ok, others.value.otherService], [true, "Physio at home"]);
    assert.equal(check({ serviceType: "teleconsultation", otherService: "left over" }).value.otherService, "");
    assert.equal(check({ serviceType: "" }).ok, true);
    assert.equal(check({ serviceType: "visit" }).code, "invalid_service_type");
  });

  test("phone numbers are checked loosely: digits, spaces and + - ( ), up to 20 characters", () => {
    for (const good of ["", "0551234567", "+971 50 123 4567", "(022) 555-0123", "+1-202-555-0100"]) {
      assert.equal(check({ contactNumber: good, providerNumber: good }).ok, true, good);
    }
    for (const bad of ["call me", "555-0100 ext 5", "12345678901234567890123", "++a", "555.0100"]) {
      assert.equal(check({ contactNumber: bad }).code, "invalid_phone", bad);
      assert.equal(check({ providerNumber: bad }).code, "invalid_phone", bad);
    }
    assert.equal(check({ contactNumber: "1".repeat(20) }).ok, true);
    assert.equal(check({ contactNumber: "1".repeat(21) }).code, "invalid_phone");
  });

  test("fees are 0 or more with up to 2 decimals; the doctor's fee may be left empty", () => {
    for (const [extra, code] of [
      [{ consultationFee: "-1" }, "invalid_fee_charged"],
      [{ consultationFee: "1.234" }, "invalid_fee_charged"],
      [{ consultationFee: "abc" }, "invalid_fee_charged"],
      [{ doctorFee: "-5" }, "invalid_fee"],
      [{ doctorFee: "1.234" }, "invalid_fee"],
    ]) assert.equal(check(extra).code, code, JSON.stringify(extra));
    assert.equal(check({ doctorFee: "" }).value.doctorFee, null);
    assert.equal(check({ doctorFee: null }).value.doctorFee, null);
    assert.equal(check({ doctorFee: "12.5" }).value.doctorFee, 1250);
  });

  test("every choice is checked; free text and feedback have their limits", () => {
    for (const [extra, code] of [
      [{ caseStatus: "closed" }, "invalid_case_status"],
      [{ mrStatus: "lost" }, "invalid_mrStatus"],
      [{ mrSentToCompany: "maybe" }, "invalid_mrSentToCompany"],
      [{ invoiceSent: "yes" }, "invalid_invoiceSent"],
      [{ paymentReceived: "half" }, "invalid_paymentReceived"],
      [{ paymentToProvider: "later" }, "invalid_paymentToProvider"],
      [{ date: "2026-02-30" }, "invalid_date"],
      [{ date: "2030-01-01" }, "invalid_date"],
      [{ company: "x".repeat(121) }, "invalid_company"],
      [{ caseNumber: "x".repeat(61) }, "invalid_case_number"],
      [{ serviceProvider: "x".repeat(121) }, "invalid_provider"],
      [{ patientName: "x".repeat(81) }, "invalid_name"],
      [{ feedbackSent: "x".repeat(1001) }, "invalid_feedbackSent"],
      [{ feedbackReceived: "x".repeat(1001) }, "invalid_feedbackReceived"],
      [{ comment: "x".repeat(501) }, "comment_too_long"],
      [{ paymentReceivedDate: "2026-13-01" }, "invalid_payment_date"],
    ]) assert.equal(check(extra).code, code, JSON.stringify(extra));
    assert.equal(check({ feedbackSent: "x".repeat(1000), feedbackReceived: "y".repeat(1000) }).ok, true);
    assert.equal(check({ feedbackSent: "line one\r\nline two" }).value.feedbackSent, "line one\nline two");
    assert.equal(M.validateManualCreate(null, { today: TODAY }).ok, false);
  });

  test("Payment received: the date follows the status (today when received or partly received, none when not received)", () => {
    assert.equal(check({ paymentReceived: "not_received", paymentReceivedDate: "2026-10-01" }).value.paymentReceivedDate, "");
    assert.equal(check({ paymentReceived: "received" }).value.paymentReceivedDate, TODAY);
    assert.equal(check({ paymentReceived: "partly_received" }).value.paymentReceivedDate, TODAY);
    assert.equal(check({ paymentReceived: "received", paymentReceivedDate: "2026-10-20" }).value.paymentReceivedDate, "2026-10-20");
  });

  test("the new document starts the audit trail and the entry: Doctor's fee, status and comment are written like edits", () => {
    const doc = built({}, { comment: "phone", doctorFee: "70" });
    assert.deepEqual([doc.code, doc.doctorName, doc.company, doc.caseNumber, doc.feeChargedCents, doc.entry.doctorFeeCents, doc.entry.paidStatus], ["1A2B", "Dr Rao Clinic", "Acme Assist", "AC-1042", 10000, 7000, "unpaid"]);
    assert.deepEqual(doc.entry.history.map((h) => [h.field, h.from, h.to]), [["doctorFee", "", "70.00"], ["comment", "", "phone"]]);
    assert.equal(doc.entry.edits.doctorFee.by.name, "An Admin");
    assert.deepEqual([doc.log[0].action, doc.log[0].by.role, doc.createdBy.email], ["created", "admin", "admin@humancare.com"]);
    const noFee = built({}, { doctorFee: "", comment: "" });
    assert.deepEqual([noFee.entry.doctorFeeCents ?? null, noFee.entry.history.length], [null, 0]);
  });

  test("a form that is Paid from the start follows the Paid rules: a service provider and a doctor's fee above 0, then today's date", () => {
    const r = check({ paymentToProvider: "paid", doctorFee: "" });
    assert.equal(r.ok, true);
    const refused = M.buildManualDocument(r.value, { actor: ADMIN, code: "AAAA", now: NOW, today: TODAY });
    assert.deepEqual([refused.ok, refused.status, refused.code], [false, 409, "fee_required"]);
    assert.equal(M.buildManualDocument(check({ paymentToProvider: "paid", doctorFee: "0" }).value, { actor: ADMIN, code: "AAAA", now: NOW, today: TODAY }).code, "fee_required");
    const ok = built({}, { paymentToProvider: "paid" });
    assert.deepEqual([ok.entry.paidStatus, ok.entry.paidOn], ["paid", TODAY]);
    const dated = built({}, { paymentToProvider: "paid", paidDateToProvider: "2026-10-20" });
    assert.equal(dated.entry.paidOn, "2026-10-20");
    // A date typed while the status is not Paid is ignored.
    assert.equal(built({}, { paymentToProvider: "on_hold", paidDateToProvider: "2026-10-20" }).entry.paidOn, "");
  });

  test("codes: 4 hex characters shown as M-XXXX, and a search for any form of it is understood", () => {
    assert.match(M.newCode(), /^[0-9A-F]{4}$/);
    assert.equal(M.displayCode("1A2B"), "M-1A2B");
    for (const q of ["M-1A2B", "m1a2b", "1a2b", " M-1a2b "]) assert.equal(M.codeSearchText(q), "1A2B", q);
  });

  test("an unknown country is kept as typed; a name or a code becomes the code", () => {
    assert.equal(M.normalizeCountry("United Kingdom"), "GB");
    assert.equal(M.normalizeCountry("gb"), "GB");
    assert.equal(M.normalizeCountry("Atlantis"), "Atlantis");
    assert.equal(M.normalizeCountry(""), "");
  });
});

describe("manual entry: Calculation (our margin)", () => {
  test("consultation fee minus the doctor's fee, and that as a percentage of the consultation fee", () => {
    assert.deepEqual(M.margin(10000, 7000), { cents: 3000, percent: 30 });
    assert.deepEqual(M.margin(9900, 7425), { cents: 2475, percent: 25 });
    assert.deepEqual(M.margin(3333, 1000), { cents: 2333, percent: 70 });
  });

  test("negative when the doctor is paid more; empty until a doctor's fee exists; no percentage on a 0 fee", () => {
    assert.deepEqual(M.margin(5000, 6500), { cents: -1500, percent: -30 });
    assert.deepEqual(M.margin(5000, null), { cents: null, percent: null });
    assert.deepEqual(M.margin(0, 2000), { cents: -2000, percent: null });
    assert.deepEqual(M.margin(0, 0), { cents: 0, percent: null });
  });

  test("it is not stored, only computed into the row", () => {
    const doc = built();
    assert.equal("calculation" in doc, false);
    assert.equal(Object.keys(doc).some((k) => /margin|calc/i.test(k)), false);
    assert.deepEqual(M.toManualRow(doc).manual.calculation, { cents: 3000, percent: 30 });
  });
});

describe("manual entry: editing", () => {
  test("every field of the form can change while not Paid; each change is in the log with who and when, in form order", () => {
    const doc = built();
    const r = edit(doc, {
      date: "2026-11-09", company: "Beta Assist", caseNumber: "B-7", serviceType: "others", otherService: "Physio", caseStatus: "in_progress",
      serviceProvider: "Dr Iyer", providerNumber: "0551234", patientName: "Ravi S", country: "United Kingdom", contactNumber: "555",
      consultationFee: "120", doctorFee: "80", mrStatus: "received", mrSentToCompany: "sent", invoiceSent: "sent",
      paymentReceived: "partly_received", paymentReceivedDate: "2026-10-25", feedbackSent: "Please rate us", feedbackReceived: "Great", comment: "all good",
    });
    assert.equal(r.ok, true, r.msg);
    assert.deepEqual(
      [r.set.date, r.set.company, r.set.caseNumber, r.set.serviceType, r.set.otherService, r.set.caseStatus, r.set.doctorName, r.set.providerNumber, r.set.patientName, r.set.country, r.set.contactNumber, r.set.feeChargedCents],
      ["2026-11-09", "Beta Assist", "B-7", "others", "Physio", "in_progress", "Dr Iyer", "0551234", "Ravi S", "GB", "555", 12000],
    );
    assert.deepEqual(
      [r.set.mrStatus, r.set.mrSentToCompany, r.set.invoiceSent, r.set.paymentReceived, r.set.paymentReceivedDate, r.set.feedbackSent, r.set.feedbackReceived],
      ["received", "sent", "sent", "partly_received", "2026-10-25", "Please rate us", "Great"],
    );
    assert.deepEqual([r.set["entry.doctorFeeCents"], r.set["entry.comment"]], [8000, "all good"]);
    assert.deepEqual(r.log.map((l) => l.field), [
      "date", "company", "caseNumber", "serviceType", "otherService", "caseStatus", "serviceProvider", "providerNumber", "patientName", "country",
      "contactNumber", "consultationFee", "mrStatus", "mrSentToCompany", "invoiceSent", "paymentReceived", "paymentReceivedDate", "feedbackSent",
      "feedbackReceived", "doctorFee", "comment",
    ]);
    assert.ok(r.log.every((l) => l.action === "edited" && l.by.name === "An Admin" && l.by.role === "admin" && l.at === NOW));
    assert.deepEqual(r.log.find((l) => l.field === "consultationFee"), { action: "edited", field: "consultationFee", from: "100.00", to: "120.00", by: r.log[0].by, at: NOW });
    assert.deepEqual(r.history.map((h) => h.field), ["doctorFee", "comment"], "the entry fields are in entry.history as for a booking");
  });

  test("changing nothing is a no-op; an empty request, bad values and the wrong role are refused", () => {
    const doc = built();
    const same = edit(doc, { patientName: "Ravi Sharma", consultationFee: "100.00", country: "India", doctorFee: "70" });
    assert.deepEqual([same.ok, same.noop, same.log.length], [true, true, 0]);
    assert.equal(edit(doc, {}).code, "nothing_to_change");
    assert.equal(edit(doc, { patientName: "" }).code, "invalid_name");
    assert.equal(edit(doc, { serviceProvider: "" }).code, "invalid_provider");
    assert.equal(edit(doc, { consultationFee: "x" }).code, "invalid_fee_charged");
    assert.equal(edit(doc, { contactNumber: "abc" }).code, "invalid_phone");
    assert.equal(edit(doc, { serviceType: "others" }).code, "other_service_required");
    assert.equal(edit(doc, { patientName: "B" }, { actor: PAYMENT }).status, 403);
    assert.equal(edit(doc, { patientName: "B" }, { actor: null }).status, 403);
    assert.equal(edit(doc, { patientName: "B" }, { actor: SUPER }).ok, true);
  });

  test("switching away from Others clears the Other service text; switching to Others needs it", () => {
    const doc = built({}, { serviceType: "others", otherService: "Physio" });
    const away = edit(doc, { serviceType: "house_call" });
    assert.deepEqual([away.set.serviceType, away.set.otherService], ["house_call", ""]);
    const toOthers = edit(built(), { serviceType: "others", otherService: "Dental" });
    assert.deepEqual([toOthers.ok, toOthers.set.otherService], [true, "Dental"]);
  });

  test("Payment to provider: Paid needs a service provider and a doctor's fee above 0, and fills today's date; Paid date can be typed", () => {
    const noFee = built({}, { doctorFee: "" });
    assert.deepEqual((({ status, code }) => [status, code])(edit(noFee, { paymentToProvider: "paid" })), [409, "fee_required"]);
    assert.equal(edit(built({}, { doctorFee: "0" }), { paymentToProvider: "paid" }).code, "fee_required");
    // The fee typed in the same save counts.
    const together = edit(noFee, { doctorFee: "50", paymentToProvider: "paid" });
    assert.deepEqual([together.ok, together.set["entry.paidStatus"], together.set["entry.paidOn"], together.set["entry.doctorFeeCents"]], [true, "paid", TODAY, 5000]);
    assert.deepEqual(together.history.map((h) => h.field), ["doctorFee", "paidOn", "paidStatus"]);
    const dated = edit(built(), { paymentToProvider: "paid", paidDateToProvider: "2026-10-20" });
    assert.equal(dated.set["entry.paidOn"], "2026-10-20");
    // A legacy row with no service provider cannot be marked Paid.
    const legacy = { ...built(), doctorName: "" };
    assert.deepEqual((({ status, code }) => [status, code])(edit(legacy, { paymentToProvider: "paid" })), [409, "doctor_required"]);
    assert.match(edit(legacy, { paymentToProvider: "paid" }).msg, /service provider/);
  });

  test("once Paid, the case, provider, patient and both fees are locked (409), field by field", () => {
    const doc = paidDoc();
    const locked = {
      date: "2026-11-10", company: "Other Co", caseNumber: "ZZ", serviceType: "teleconsultation", caseStatus: "completed",
      serviceProvider: "Someone Else", providerNumber: "123", patientName: "New Name", country: "Brazil", contactNumber: "999",
      consultationFee: "150", doctorFee: "90",
    };
    for (const [key, value] of Object.entries(locked)) {
      const r = edit(doc, { [key]: value });
      assert.deepEqual([r.ok, r.status, r.code], [false, 409, "locked_paid"], key);
    }
    assert.equal(edit(doc, { serviceType: "others", otherService: "x" }).code, "locked_paid");
    // The whole form sent back unchanged is fine.
    assert.equal(edit(doc, { ...form({ paymentToProvider: "paid" }), paidDateToProvider: TODAY, paymentReceived: "not_received" }).noop, true);
  });

  test("once Paid, the medical report, invoice, payment received, feedback, comment and Paid date stay editable", () => {
    const doc = paidDoc();
    const r = edit(doc, {
      mrStatus: "received", mrSentToCompany: "sent", invoiceSent: "sent", paymentReceived: "received", paymentReceivedDate: "2026-10-26",
      feedbackSent: "sent text", feedbackReceived: "got text", comment: "note", paidDateToProvider: "2026-10-20",
    });
    assert.equal(r.ok, true, r.msg);
    assert.deepEqual(r.log.map((l) => l.field), ["mrStatus", "mrSentToCompany", "invoiceSent", "paymentReceived", "paymentReceivedDate", "feedbackSent", "feedbackReceived", "paidDateToProvider", "comment"]);
    assert.equal(r.set["entry.paidOn"], "2026-10-20");
  });

  test("moving a Paid row back unlocks it for the next save, but not in the same save as a locked change", () => {
    const doc = paidDoc();
    const same = edit(doc, { paymentToProvider: "on_hold", patientName: "Sneaky" });
    assert.equal(same.code, "locked_paid");
    const back = edit(doc, { paymentToProvider: "on_hold" });
    assert.deepEqual([back.ok, back.set["entry.paidStatus"]], [true, "on_hold"]);
    const after = { ...doc, entry: { ...doc.entry, paidStatus: "on_hold" } };
    assert.equal(edit(after, { patientName: "Now allowed" }).ok, true);
  });

  test("a payment-received date follows its status in an edit too", () => {
    const doc = built({}, { paymentReceived: "received", paymentReceivedDate: "2026-10-20" });
    assert.equal(edit(doc, { paymentReceived: "not_received" }).set.paymentReceivedDate, "");
    const fresh = built();
    assert.equal(edit(fresh, { paymentReceived: "received" }).set.paymentReceivedDate, TODAY);
  });
});

describe("manual entry: deleting", () => {
  test("allowed for an unpaid, on-hold or not-payable row; refused when Paid, already deleted, or by the wrong role", () => {
    for (const paidStatus of ["unpaid", "on_hold", "not_payable"]) {
      assert.equal(M.checkManualDelete({ entry: { paidStatus } }, ADMIN).ok, true, paidStatus);
    }
    assert.deepEqual((({ status, code }) => [status, code])(M.checkManualDelete({ entry: { paidStatus: "paid" } }, ADMIN)), [409, "delete_paid"]);
    assert.equal(M.checkManualDelete({ deletedAt: NOW, entry: {} }, ADMIN).status, 404);
    assert.equal(M.checkManualDelete(null, ADMIN).status, 404);
    assert.equal(M.checkManualDelete({ entry: {} }, PAYMENT).status, 403);
  });

  test("the soft delete records who and when, and a deleted line in the log", () => {
    const w = M.manualDeleteWrite(SUPER, NOW);
    assert.deepEqual([w.set.deletedAt, w.set.deletedBy.name, w.log.action, w.log.by.role], [NOW, "Super Admin", "deleted", "superadmin"]);
  });
});

describe("manual entry: the row the page gets", () => {
  test("same shape as a booking row; Source is Manual; the service provider is the Doctor; Company + Case number is the grey line", () => {
    const row = M.toManualRow(built());
    assert.deepEqual([row.kind, row.shortId, row.sourceGroup, row.sourceCsv.Source, row.status, row.doctorName], ["manual", "M-1A2B", "Manual", "Manual", "manual", "Dr Rao Clinic"]);
    assert.deepEqual(row.consultation, { date: "2026-11-03", time: "" });
    assert.deepEqual(row.patient, { name: "Ravi Sharma", country: "IN", countryName: "India" });
    assert.deepEqual([row.feeChargedCents, row.amountPaidCents, row.entry.doctorFeeCents], [10000, 10000, 7000]);
    assert.equal(row.manual.caseLine, "Acme Assist · AC-1042");
    assert.deepEqual([row.doctorChanged, row.cancelledAfterPaid, row.entry.paidStatus, row.entry.version], [false, false, "unpaid", 0]);
    assert.deepEqual([row.manual.locked, row.manual.canDelete, row.manual.addedBy], [false, true, "An Admin"]);
  });

  test("the grey line has what exists: either one, or nothing", () => {
    assert.equal(M.toManualRow(built({}, { caseNumber: "" })).manual.caseLine, "Acme Assist");
    assert.equal(M.toManualRow(built({}, { company: "" })).manual.caseLine, "AC-1042");
    assert.equal(M.toManualRow(built({}, { company: "", caseNumber: "" })).manual.caseLine, "");
  });

  test("the popup gets every field of the form, as text, ready to show", () => {
    const f = M.toManualRow(built({}, { serviceType: "others", otherService: "Physio", feedbackSent: "hello", paymentReceived: "received", paymentReceivedDate: "2026-10-20" })).manual.form;
    assert.deepEqual(f, {
      date: "2026-11-03", company: "Acme Assist", caseNumber: "AC-1042", serviceType: "others", otherService: "Physio", caseStatus: "open",
      serviceProvider: "Dr Rao Clinic", providerNumber: "+91 98765-43210",
      patientName: "Ravi Sharma", country: "India", contactNumber: "(022) 5550 1234",
      consultationFee: "100.00", doctorFee: "70.00",
      mrStatus: "pending", mrSentToCompany: "not_sent", invoiceSent: "not_sent",
      paymentReceived: "received", paymentReceivedDate: "2026-10-20", paymentToProvider: "unpaid", paidDateToProvider: "",
      feedbackSent: "hello", feedbackReceived: "", comment: "",
    });
  });

  test("a fee of 0 has no placeholder; a typed doctor's fee replaces it; Paid locks Edit and Delete", () => {
    assert.equal(M.toManualRow(built({}, { consultationFee: "0", doctorFee: "" })).placeholder, null);
    const unfilled = M.toManualRow(built({}, { doctorFee: "" }));
    assert.equal(unfilled.placeholder.text, "75% · 75.00");
    const paid = M.toManualRow(paidDoc());
    assert.deepEqual([paid.placeholder, paid.manual.locked, paid.manual.canDelete], [null, true, false]);
  });

  test("an older row (made before the new sections) still reads fine, with the new fields at their defaults", () => {
    const old = { _id: "64b0000000000000000000bb", code: "OLD1", patientName: "Old Patient", country: "IN", doctorName: "Martin Perlin", date: "2026-10-30", time: "2:30 PM", feeChargedCents: 4900, entry: { doctorFeeCents: 3000, paidStatus: "unpaid" } };
    const row = M.toManualRow(old);
    assert.deepEqual(row.consultation, { date: "2026-10-30", time: "2:30 PM" });
    assert.deepEqual([row.manual.form.caseStatus, row.manual.form.mrStatus, row.manual.form.paymentReceived, row.manual.form.serviceType, row.manual.caseLine], ["open", "pending", "not_received", "", ""]);
    assert.equal(edit(old, { company: "Now with a company" }).ok, true);
  });

  test("the same one-edit rules apply to the table's cells: Paid needs a doctor's fee, and no service provider is refused", () => {
    const doc = built({}, { doctorFee: "" });
    const noFee = E.applyEntryEdit(doc.entry, { field: "paidStatus", value: "paid" }, { hasDoctor: true, today: TODAY, actor: ADMIN });
    assert.equal(noFee.code, "fee_required");
    const ok = E.applyEntryEdit({ ...doc.entry, doctorFeeCents: 3000 }, { field: "paidStatus", value: "paid" }, { hasDoctor: true, today: TODAY, actor: ADMIN });
    assert.equal(ok.ok, true);
    assert.equal(ok.set["entry.paidOn"], TODAY);
  });
});

describe("manual entry: the CSV cells", () => {
  const manualRow = (extra = {}, value) => M.toManualRow(built({}, { company: "Acme", caseNumber: "AC-1", serviceType: "others", otherService: "Physio", caseStatus: "in_progress", mrStatus: "received", mrSentToCompany: "sent", invoiceSent: "sent", paymentReceived: "partly_received", paymentReceivedDate: "2026-10-20", feedbackSent: "Hello", feedbackReceived: "Thanks", ...extra, ...value }));
  const cells = (row) => Object.fromEntries(COLUMNS.map((c, i) => [c, csvCells(row)[i]]));

  test("all the new fields are columns, with the calculation as numbers and the labels as words", () => {
    const c = cells(manualRow());
    assert.deepEqual(
      [c["Company"], c["Case number"], c["Type of service"], c["Other service"], c["Case status"], c["Service provider number"], c["Contact number"]],
      ["Acme", "AC-1", "Others", "Physio", "In progress", "'+91 98765-43210", "(022) 5550 1234"],
    );
    assert.deepEqual([c["Calculation (our margin)"], c["Calculation (% of consultation fee)"], c["Fee charged"], c["Doctor fee"]], ["30.00", "30.0", "100.00", "70.00"]);
    assert.deepEqual(
      [c["MR status"], c["MR sent to company"], c["Invoice sent"], c["Payment received"], c["Payment received date"], c["Feedback message sent"], c["Feedback received"]],
      ["Received", "Sent", "Sent", "Partly received", "2026-10-20", "Hello", "Thanks"],
    );
    assert.deepEqual([c["Doctor"], c["Paid status"], c["Source"], c["Booking status"]], ["Dr Rao Clinic", "Unpaid", "Manual", "Manual"]);
  });

  test("the calculation is negative when the doctor is paid more and empty without a doctor's fee", () => {
    assert.equal(cells(manualRow({}, { consultationFee: "50", doctorFee: "65" }))["Calculation (our margin)"], "-15.00");
    const none = cells(manualRow({}, { doctorFee: "" }));
    assert.deepEqual([none["Calculation (our margin)"], none["Calculation (% of consultation fee)"], none["Doctor fee"]], ["", "", ""]);
  });

  test("text is made formula-safe, and a booking row has empty manual columns", () => {
    const c = cells(manualRow({}, { company: "=HYPERLINK(\"x\")", feedbackSent: "+cmd", feedbackReceived: "@home", caseNumber: "-1" }));
    assert.deepEqual([c["Company"], c["Feedback message sent"], c["Feedback received"], c["Case number"]], ["'=HYPERLINK(\"x\")", "'+cmd", "'@home", "'-1"]);
    const booking = { kind: "appointment", id: "abc", entry: { paidStatus: "unpaid" }, patient: {}, sourceCsv: {} };
    const tail = csvCells(booking).slice(COLUMNS.indexOf("Company"));
    assert.deepEqual(tail, Array(16).fill(""));
    assert.equal(csvCells(booking).length, COLUMNS.length);
    assert.equal(csvCells(manualRow()).length, COLUMNS.length);
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

  test("a built document saves, reads back with every field and its audit trail, and the code is unique", async () => {
    const doc = built({ code: "AAAA" }, { comment: "phone", feedbackSent: "x".repeat(1000), paymentReceived: "received", paymentReceivedDate: "2026-10-20" });
    delete doc._id;
    const saved = await ManualEntry.create(doc);
    const read = await ManualEntry.findById(saved._id).lean();
    assert.deepEqual([read.company, read.caseNumber, read.serviceType, read.caseStatus, read.doctorName, read.providerNumber, read.contactNumber], ["Acme Assist", "AC-1042", "house_call", "open", "Dr Rao Clinic", "+91 98765-43210", "(022) 5550 1234"]);
    assert.deepEqual([read.mrStatus, read.paymentReceived, read.paymentReceivedDate, read.feedbackSent.length, read.deletedAt], ["pending", "received", "2026-10-20", 1000, null]);
    assert.equal(read.entry.doctorFeeCents, 7000);
    assert.equal(read.entry.history.length, 2);
    assert.equal(read.log[0].action, "created");
    await assert.rejects(ManualEntry.create({ ...doc, entry: undefined }), /duplicate key|E11000/);
  });

  test("the model refuses a missing name, a negative fee, a bad choice and an over-long feedback", async () => {
    const ok = built({ code: "BBBB" });
    delete ok._id;
    await assert.rejects(ManualEntry.create({ ...ok, patientName: "" }), /patientName/);
    await assert.rejects(ManualEntry.create({ ...ok, code: "CCCC", feeChargedCents: -1 }), /feeChargedCents/);
    await assert.rejects(ManualEntry.create({ ...ok, code: "DDDD", caseStatus: "closed" }), /caseStatus/);
    await assert.rejects(ManualEntry.create({ ...ok, code: "EEEE", feedbackReceived: "x".repeat(1001) }), /feedbackReceived/);
    await assert.rejects(ManualEntry.create({ ...ok, code: "FFFF", log: [{ action: "vanished" }] }), /action/);
  });
});
