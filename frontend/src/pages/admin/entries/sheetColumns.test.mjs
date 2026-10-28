import { test } from "node:test";
import assert from "node:assert/strict";
import * as S from "./sheetColumns.js";
import * as F from "./entriesFormat.js";

const form = (extra = {}) => ({
  ...F.newForm("2026-10-27"), date: "2026-08-15", company: "Nova Assistance", caseNumber: "229987", patientName: "Bodyliev Alexandr", country: "Spain",
  serviceType: "house_call", serviceProvider: "Doctor Balear", consultationFee: "290.00", doctorFee: "200.00", mrStatus: "received", mrSentToCompany: "sent",
  invoiceSent: "sent", paymentReceived: "received", paymentToProvider: "unpaid", ...extra,
});

test("the sheet has the columns of the team's sheet in this exact order, then Actions", () => {
  assert.deepEqual(S.SHEET_HEADERS, [
    "Date", "Company", "Case Number", "Patient Name", "Type of service", "Patient Country", "Service provider", "Status", "Consultation Fee", "Doctor's Fee",
    "MR status from provider", "MR sent status to the companies", "Invoice sent status", "Payment received", "Payment to Provider", "Payment received date",
    "Paid date to the provider", "Contact Number", "Service provider number", "Feedback Message Sent", "Feedback Received", "Calculation", "Comment", "Actions",
  ]);
});

test("Date, Company, Case Number and Patient Name are the four pinned columns, in that order; Case Number and Patient Name are green", () => {
  assert.deepEqual(S.SHEET_COLUMNS.filter((c) => c.pin).map((c) => [c.header, c.pin]), [["Date", "s1"], ["Company", "s2"], ["Case Number", "s3"], ["Patient Name", "s4"]]);
  assert.deepEqual(S.SHEET_COLUMNS.filter((c) => c.green).map((c) => c.header), ["Case Number", "Patient Name"]);
  assert.deepEqual(S.SHEET_COLUMNS.slice(0, 4).map((c) => c.pin), ["s1", "s2", "s3", "s4"]);
});

test("values are shown like the sheet: MR received / pending, MR sent / Not sent, Invoice sent, Paid for a payment received, Need to pay", () => {
  const show = (key, f) => S.SHEET_COLUMNS.find((c) => c.key === key).show(f);
  assert.deepEqual(
    ["mrStatus", "mrSentToCompany", "invoiceSent", "paymentReceived", "paymentToProvider"].map((k) => show(k, form())),
    ["MR received", "MR sent", "Invoice sent", "Paid", "Need to pay"],
  );
  const open = form({ mrStatus: "pending", mrSentToCompany: "not_sent", invoiceSent: "not_sent", paymentReceived: "not_received", paymentToProvider: "paid" });
  assert.deepEqual(
    ["mrStatus", "mrSentToCompany", "invoiceSent", "paymentReceived", "paymentToProvider"].map((k) => show(k, open)),
    ["MR pending", "Not sent", "Not sent", "Not received", "Paid"],
  );
  assert.equal(show("paymentReceived", form({ paymentReceived: "partly_received" })), "Partly received");
  const col = S.SHEET_COLUMNS.find((c) => c.key === "paymentToProvider");
  assert.deepEqual([col.tone(form()), col.tone(open), col.tone(form({ paymentToProvider: "on_hold" }))], ["need", "paidc", ""]);
});

test("the Type of service cell shows the Other service text when Others; dates and money read like the sheet", () => {
  const show = (key, f) => S.SHEET_COLUMNS.find((c) => c.key === key).show(f);
  assert.equal(show("serviceType", form({ serviceType: "others", otherService: "Lab report review" })), "Lab report review");
  assert.equal(show("serviceType", form({ serviceType: "others", otherService: "" })), "Others");
  assert.equal(show("serviceType", form()), "House call");
  assert.equal(show("date", form()), "15 Aug 2026");
  assert.equal(show("consultationFee", form()), "290");
  assert.equal(show("consultationFee", form({ consultationFee: "290.50" })), "290.50");
  assert.equal(show("doctorFee", form({ doctorFee: "" })), "—");
  assert.equal(show("paymentReceivedDate", form()), "—");
});

test("Calculation: green, red when negative, empty until there is a doctor's fee; the total row sums every matching row", () => {
  assert.deepEqual(S.calcCell(9000), { text: "90", negative: false });
  assert.deepEqual(S.calcCell(-1500), { text: "−15", negative: true });
  assert.deepEqual(S.calcCell(null), { text: "—", negative: false });
  assert.deepEqual(S.draftCalc(form()), { text: "90", negative: false });
  assert.deepEqual(S.draftCalc(form({ consultationFee: "50", doctorFee: "65" })), { text: "−15", negative: true });
  assert.equal(S.draftCalc(form({ doctorFee: "" })).text, "—");
  const t = S.sheetTotals({ rows: 3, feeChargedCents: 92000, doctorFeeCents: 65000 });
  assert.deepEqual([t.entries, t.consult, t.doctor, t.calc.text], [3, "920", "650", "270"]);
  assert.equal(S.entriesText(1), "1 entry");
  assert.equal(S.entriesText(3), "3 entries");
  assert.equal(S.sheetTotals({ rows: 1, feeChargedCents: 100, doctorFeeCents: 300 }).calc.negative, true);
});

test("a draft is settled before it is checked: the payment dates fill with today and clear by the same rules, Others text only for Others", () => {
  const t = "2026-10-27";
  assert.equal(S.settleDraft(form({ paymentReceived: "received", paymentReceivedDate: "" }), t).paymentReceivedDate, t);
  assert.equal(S.settleDraft(form({ paymentReceived: "received", paymentReceivedDate: "2026-09-29" }), t).paymentReceivedDate, "2026-09-29");
  assert.equal(S.settleDraft(form({ paymentReceived: "not_received", paymentReceivedDate: "2026-09-29" }), t).paymentReceivedDate, "");
  assert.equal(S.settleDraft(form({ paymentToProvider: "paid", paidDateToProvider: "" }), t).paidDateToProvider, t);
  assert.equal(S.settleDraft(form({ paymentToProvider: "on_hold", paidDateToProvider: "2026-10-01" }), t).paidDateToProvider, "");
  assert.equal(S.settleDraft(form({ serviceType: "teleconsultation", otherService: "left over" }), t).otherService, "");
  assert.equal(S.settleDraft(form({ serviceType: "others", otherService: "Physio" }), t).otherService, "Physio");
});

test("validation names the cell to highlight: patient, provider, Others text, phones, fees, and Paid needs a doctor's fee above 0", () => {
  assert.equal(S.firstProblem(form()), null);
  const key = (extra) => S.firstProblem(form(extra))?.key;
  assert.equal(key({ patientName: " " }), "patientName");
  assert.equal(key({ serviceProvider: "" }), "serviceProvider");
  assert.equal(key({ date: "" }), "date");
  assert.equal(key({ serviceType: "others", otherService: " " }), "otherService");
  assert.equal(key({ contactNumber: "call me" }), "contactNumber");
  assert.equal(key({ providerNumber: "1".repeat(21) }), "providerNumber");
  assert.equal(key({ consultationFee: "" }), "consultationFee");
  assert.equal(key({ consultationFee: "1.234" }), "consultationFee");
  assert.equal(key({ doctorFee: "abc" }), "doctorFee");
  assert.equal(key({ paymentToProvider: "paid", doctorFee: "" }), "doctorFee");
  assert.equal(key({ paymentToProvider: "paid", doctorFee: "0" }), "doctorFee");
  assert.equal(S.firstProblem(form({ paymentToProvider: "paid", doctorFee: "10" })), null);
  assert.equal(S.firstProblem(form({ consultationFee: "0", doctorFee: "" })), null);
  assert.match(S.firstProblem(form({ patientName: "" })).msg, /patient/i);
});

test("only the changed fields are sent, with the version; fees compare as numbers; nothing changed means nothing to send", () => {
  const original = form();
  assert.deepEqual(S.changedFields(original, { ...original }, 3), { changed: [], body: { version: 3 } });
  const changed = S.changedFields(original, { ...original, patientName: " New ", consultationFee: "300", doctorFee: "200.0", mrStatus: "pending" }, 3);
  assert.deepEqual(changed.changed.sort(), ["consultationFee", "mrStatus", "patientName"]);
  assert.deepEqual(changed.body, { patientName: "New", consultationFee: "300", mrStatus: "pending", version: 3 });
  assert.deepEqual(S.changedFields(original, { ...original, doctorFee: "" }, 1).body, { doctorFee: "", version: 1 }, "clearing a fee is a change");
  assert.deepEqual(S.changedFields(form({ doctorFee: "" }), form({ doctorFee: "0" }), 1).changed, ["doctorFee"], "0 is not empty");
});

test("when Paid, the case, provider, patient and fee cells are locked and the rest are not", () => {
  for (const key of ["date", "company", "caseNumber", "patientName", "serviceType", "serviceProvider", "caseStatus", "consultationFee", "doctorFee", "country", "contactNumber", "providerNumber"]) {
    assert.equal(S.isLockedWhenPaid(key, true), true, key);
    assert.equal(S.isLockedWhenPaid(key, false), false, key);
  }
  for (const key of ["mrStatus", "mrSentToCompany", "invoiceSent", "paymentReceived", "paymentReceivedDate", "paymentToProvider", "paidDateToProvider", "feedbackSent", "feedbackReceived", "comment"]) {
    assert.equal(S.isLockedWhenPaid(key, true), false, key);
  }
});

test("the view in the address: Auto is the default and is left out; the money boxes need the server's summary", () => {
  assert.equal(F.viewFromParam("manual"), "manual");
  assert.equal(F.viewFromParam("nope"), "auto");
  assert.deepEqual(F.viewToParams({ view: "auto", tab: "all", month: "", page: 1 }), {});
  assert.deepEqual(F.viewToParams({ view: "manual", tab: "paid", month: "2026-10", page: 2 }), { view: "manual", tab: "paid", month: "2026-10", page: "2" });
  assert.deepEqual(F.summaryBoxes("auto", undefined), []);
  const summary = { receivedCents: 17000, toPayCents: 6000, marginCents: 8000 };
  assert.deepEqual(F.summaryBoxes("auto", summary).map((b) => [b.label, b.text]), [["Received from patients", "$170.00"], ["To pay providers", "$60.00"], ["Our margin", "$80.00"]]);
  assert.equal(F.summaryBoxes("manual", summary)[0].label, "Received from companies");
  assert.equal(F.summaryBoxes("manual", { ...summary, marginCents: -1500 })[2].text, "-$15.00");
});
