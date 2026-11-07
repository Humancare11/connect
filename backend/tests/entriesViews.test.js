const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");
const ManualEntry = require("../models/ManualEntry");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const adminEntries = require("../routes/adminEntries");
const { entriesViewAccess } = require("../middleware/verifyToken");
const M = require("../utils/manualEntry");
const { buildHistory, displayValue } = require("../utils/manualHistory");
const { MANUAL_COLUMNS, AUTO_COLUMNS } = require("../utils/bookingEntryCsv");

// Money totals are kept per currency (never added across them); these tests only use USD bookings.
const usdTotals = (t) => ({ rows: t.rows, ...t.byCurrency.usd });
const usdSummary = (s) => ({ feeNotEnteredCount: s.feeNotEnteredCount, ...s.byCurrency.usd });

const NOW = Date.UTC(2026, 9, 26, 22, 0); // already 2026-10-27 in India
const TODAY = "2026-10-27";

describe("appointment entries: Auto and Manual views, money boxes by role, History, manual CSV", () => {
  let mongod, server, base, patient, admins, doctor, enrollment;
  const who = { admin: null, superadmin: null };
  let clock = NOW;

  // The signed-in person comes from a header, like the other entries tests; each role is a different user so History can tell them apart.
  const fakeAuth = (req, res, next) => {
    const role = req.headers["x-test-role"];
    if (!role) return res.status(401).json({ msg: "No token provided." });
    req.user = { id: String(who[role]?._id || who.admin._id), role };
    next();
  };
  const call = async (method, path, body, role = "admin") => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { "content-type": "application/json", ...(role ? { "x-test-role": role } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, body: json, text, headers: res.headers };
  };
  const list = async (query = "", role = "admin") => (await call("GET", query ? `?${query}` : "", undefined, role)).body;
  const names = (body) => body.items.map((r) => r.patient.name);

  const appt = (extra = {}) =>
    Appointment.create({
      patientId: patient._id, doctorId: doctor._id, date: "2026-11-01", time: "10:00 AM", bookedAt: new Date(Date.UTC(2026, 9, 10)), status: "confirmed",
      paymentStatus: "paid", paymentAmount: 9900, consultationPrice: 99, ...extra,
    });
  const form = (extra = {}) => ({
    date: "2026-11-03", company: "Acme Assist", caseNumber: "AC-1", serviceType: "house_call", caseStatus: "open", serviceProvider: "Dr Rao Clinic",
    patientName: "Manual Patient", country: "India", consultationFee: "100", doctorFee: "", paymentToProvider: "unpaid", paymentReceived: "not_received", ...extra,
  });
  const manual = (formExtra = {}, entry = {}, docExtra = {}) => {
    const v = M.validateManualCreate(form(formExtra), { today: TODAY });
    assert.equal(v.ok, true, v.msg);
    const b = M.buildManualDocument(v.value, { actor: { id: who.admin._id, name: "Narayan Admin", role: "admin" }, code: M.newCode(), today: TODAY, now: new Date(NOW) });
    assert.equal(b.ok, true, b.msg);
    return ManualEntry.create({ ...b.doc, ...docExtra, entry: { ...b.doc.entry, ...entry } });
  };

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await ManualEntry.init();
    const app = express();
    app.use(express.json());
    app.use("/api/admin/entries", adminEntries.create({ guard: [fakeAuth, entriesViewAccess], now: () => clock }));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}/api/admin/entries`;
  });
  after(async () => {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    clock = NOW;
    await Promise.all([Appointment.deleteMany({}), CategoryConsultation.deleteMany({}), ManualEntry.deleteMany({}), User.deleteMany({}), Doctor.deleteMany({}), Enrollment.deleteMany({})]);
    patient = await User.create({ name: "Rachel Secemski", email: "rachel@x.co", password: "SecretPw1!", country: "US" });
    who.admin = await User.create({ name: "Narayan Admin", email: "admin@x.co", password: "SecretPw1!" });
    who.superadmin = await User.create({ name: "Super Person", email: "super@x.co", password: "SecretPw1!" });
    doctor = await Doctor.create({ name: "Martin Perlin", email: "martin@x.co", password: "SecretPw1!" });
    enrollment = await Enrollment.create({ firstName: "Martin", surname: "Perlin", doctorId: doctor._id, email: "n@x.co", approvalStatus: "approved" });
    admins = who;
  });

  describe("the two views", () => {
    test("Auto has only bookings, Manual only manual entries; All (the API default) has both", async () => {
      await appt();
      await appt({ date: "2026-11-02" });
      await manual();
      const auto = await list("view=auto");
      const man = await list("view=manual");
      const all = await list("");
      assert.deepEqual([auto.total, auto.items.every((r) => r.kind !== "manual"), auto.view], [2, true, "auto"]);
      assert.deepEqual([man.total, man.items.every((r) => r.kind === "manual"), man.view], [1, true, "manual"]);
      assert.equal(all.total, 3);
      assert.equal((await call("GET", "?view=bogus")).status, 400);
    });

    test("the switch counts follow the month and the include flags, not the tab or the search", async () => {
      await appt();
      await appt({ date: "2026-10-05" });
      await manual({ date: "2026-11-09" });
      await manual({ date: "2026-10-09", patientName: "October" }, { paidStatus: "on_hold" });
      assert.deepEqual((await list("view=manual")).views, { auto: 2, manual: 2 });
      assert.deepEqual((await list("view=auto&month=2026-10")).views, { auto: 1, manual: 1 });
      assert.deepEqual((await list("view=manual&tab=on_hold&q=October")).views, { auto: 2, manual: 2 });
    });

    test("the tabs, counts, totals and months follow the view, and the tabs use the payout status (Payment to Provider for manual rows)", async () => {
      await appt({ entry: { paidStatus: "paid", paidOn: "2026-10-20", doctorFeeCents: 100 } });
      await manual({ date: "2026-12-05" }, { paidStatus: "unpaid" });
      await manual({ patientName: "Held" }, { paidStatus: "on_hold" });
      await manual({ patientName: "Done", consultationFee: "10" }, { paidStatus: "paid", paidOn: "2026-10-20", doctorFeeCents: 400 });
      const man = await list("view=manual");
      assert.deepEqual([man.counts.all, man.counts.unpaid, man.counts.on_hold, man.counts.paid], [3, 1, 1, 1]);
      assert.deepEqual(man.months, ["2026-12", "2026-11"], "the months of the manual rows only");
      assert.deepEqual(names(await list("view=manual&tab=on_hold")), ["Held"]);
      assert.deepEqual(usdTotals((await list("view=manual&tab=paid")).totals), { rows: 1, feeChargedCents: 1000, doctorFeeCents: 400 });
      const auto = await list("view=auto");
      assert.deepEqual([auto.counts.all, auto.counts.paid, auto.months], [1, 1, ["2026-11"]]);
    });
  });

  describe("the money boxes are for a super admin only", () => {
    test("an admin's answer has no `summary` at all, and no money totals of the boxes; a super admin's has it", async () => {
      await appt();
      await manual({}, { doctorFeeCents: 1500 });
      for (const view of ["auto", "manual", "all"]) {
        const asAdmin = await list(`view=${view}`, "admin");
        assert.equal("summary" in asAdmin, false, view);
        assert.equal(JSON.stringify(asAdmin).includes("receivedCents") || JSON.stringify(asAdmin).includes("marginCents") || JSON.stringify(asAdmin).includes("toPayCents"), false, `${view}: no box money anywhere in the admin's answer`);
        const asSuper = await list(`view=${view}`, "superadmin");
        assert.deepEqual(Object.keys(asSuper.summary).sort(), ["byCurrency", "feeNotEnteredCount", "marginCents", "paidCents", "receivedCents", "toPayCents"]);
      }
    });

    test("Auto: received = what patients paid, to pay = saved doctor fees on Unpaid rows, margin = received - saved doctor fees", async () => {
      await appt({ paymentAmount: 10000, entry: { doctorFeeCents: 6000, paidStatus: "unpaid" } });
      await appt({ paymentAmount: 5000, entry: { doctorFeeCents: 3000, paidStatus: "paid", paidOn: "2026-10-20", doctorAtEntry: String(doctor._id) } });
      await appt({ paymentAmount: 2000 }); // no fee saved yet
      await manual({ consultationFee: "999" }, { doctorFeeCents: 1 }); // a manual row is not part of Auto
      const s = usdSummary((await list("view=auto", "superadmin")).summary);
      assert.deepEqual([s.receivedCents, s.toPayCents, s.paidCents, s.marginCents], [17000, 6000, 3000, 17000 - 9000]);
    });

    test("Manual: received = consultation fee where the payment received is not 'Not received', to pay = doctor's fee where Unpaid, margin = fees - doctor's fees", async () => {
      await appt({ paymentAmount: 99999 }); // a booking is not part of Manual
      await manual({ consultationFee: "100", paymentReceived: "received" }, { doctorFeeCents: 6000, paidStatus: "unpaid" });
      await manual({ consultationFee: "50", paymentReceived: "partly_received" }, { doctorFeeCents: 2000, paidStatus: "paid", paidOn: "2026-10-20" });
      await manual({ consultationFee: "70", paymentReceived: "not_received" }, { doctorFeeCents: 4000, paidStatus: "unpaid" });
      await manual({ consultationFee: "30" }, {});
      const s = usdSummary((await list("view=manual", "superadmin")).summary);
      assert.equal(s.receivedCents, 15000, "100 + 50 (partly received counts, not received does not)");
      assert.equal(s.toPayCents, 10000, "60 + 40 on Unpaid rows");
      assert.equal(s.marginCents, (100 + 50 + 70 + 30) * 100 - (6000 + 2000 + 4000), "all fees minus all doctor's fees");
    });

    test("they follow the month, not the tab or the search", async () => {
      await manual({ date: "2026-11-02", consultationFee: "100", paymentReceived: "received" }, { doctorFeeCents: 6000 });
      await manual({ date: "2026-10-02", consultationFee: "40", paymentReceived: "received", patientName: "October" }, { doctorFeeCents: 1000 });
      const all = usdSummary((await list("view=manual", "superadmin")).summary);
      assert.equal(all.receivedCents, 14000);
      assert.equal((await list("view=manual&month=2026-10", "superadmin")).summary.byCurrency.usd.receivedCents, 4000);
      assert.deepEqual(usdSummary((await list("view=manual&tab=paid&q=zzz", "superadmin")).summary), all);
    });
  });

  describe("the multi-field versioned update and History", () => {
    const edit = (id, body, role = "admin") => call("PATCH", `/manual/${id}/details`, body, role);

    test("one save changes many fields with ONE version bump; a second save with the old version is a 409 that returns the latest row", async () => {
      const m = await manual({}, { doctorFeeCents: 7000 });
      const first = await edit(m._id, { version: 0, patientName: "New Name", consultationFee: "120", mrStatus: "received", paymentReceived: "received", comment: "hello" });
      assert.deepEqual([first.status, first.body.item.entry.version, first.body.item.patient.name, first.body.item.manual.form.mrStatus], [200, 1, "New Name", "received"]);
      const stale = await edit(m._id, { version: 0, company: "Late Co" });
      assert.deepEqual([stale.status, stale.body.code, stale.body.item.patient.name, stale.body.item.entry.version], [409, "stale", "New Name", 1]);
      assert.equal((await ManualEntry.findById(m._id).lean()).company, "Acme Assist");
    });

    test("every save writes history lines with who, when, old and new, under the column headers; a stale or locked save writes none", async () => {
      const m = await manual({}, { doctorFeeCents: 7000 });
      clock = NOW + 3600_000;
      await edit(m._id, { version: 0, patientName: "Renamed", consultationFee: "120", paymentReceived: "received" }, "admin");
      clock = NOW + 7200_000;
      await edit(m._id, { version: 1, paymentToProvider: "paid" }, "superadmin");
      await edit(m._id, { version: 1, company: "Stale" }, "admin");
      await edit(m._id, { version: 2, patientName: "Locked" }, "admin");
      const h = (await call("GET", `/manual/${m._id}/history`, undefined, "superadmin")).body;
      assert.equal(h.groups.length, 3, "two saves and the creation");
      const [newest, middle, created] = h.groups;
      assert.deepEqual([newest.by.name, newest.by.roleLabel, newest.at], ["Super Person", "Super Admin", new Date(NOW + 7200_000).toISOString()]);
      assert.ok(newest.items.some((i) => i.field === "Payment to Provider" && i.from === "Need to pay" && i.to === "Paid"));
      assert.ok(newest.items.some((i) => i.field === "Paid date to the provider" && i.from === "—" && i.to === "27 Oct 2026"));
      assert.deepEqual([middle.by.name, middle.by.roleLabel], ["Narayan Admin", "Admin"]);
      assert.deepEqual(middle.items.map((i) => i.field), ["Patient Name", "Consultation Fee", "Payment received", "Payment received date"]);
      assert.deepEqual(middle.items.find((i) => i.field === "Consultation Fee"), { field: "Consultation Fee", from: "100.00", to: "120.00" });
      assert.deepEqual(middle.items.find((i) => i.field === "Payment received"), { field: "Payment received", from: "Not received", to: "Paid" });
      assert.deepEqual([created.created, created.by.name, created.items.length], [true, "Narayan Admin", 0]);
      assert.equal(h.count, newest.items.length + middle.items.length, "the count on the button is the field changes, not the creation");
      assert.equal((await list("view=manual")).items[0].manual.historyCount, h.count);
    });

    test("table-cell edits are in the History too, and older rows (cell edits only in entry.history) still show them once", async () => {
      const m = await manual({}, {});
      clock = NOW + 1000;
      await call("PATCH", `/manual/${m._id}`, { field: "doctorFee", value: "50", version: 0 }, "admin");
      const h = (await call("GET", `/manual/${m._id}/history`, undefined, "admin")).body;
      assert.deepEqual(h.groups[0].items, [{ field: "Doctor's Fee", from: "—", to: "50.00" }]);
      // An older row: only entry.history has the change.
      const old = await manual({ patientName: "Older" }, {});
      await ManualEntry.updateOne({ _id: old._id }, { $push: { "entry.history": { field: "paidStatus", from: "unpaid", to: "on_hold", by: { name: "Old Admin", role: "superadmin" }, at: new Date(NOW + 5000) } } });
      const oh = (await call("GET", `/manual/${old._id}/history`, undefined, "admin")).body;
      assert.deepEqual(oh.groups[0].items, [{ field: "Payment to Provider", from: "Need to pay", to: "On hold" }]);
      assert.equal(oh.groups[0].by.roleLabel, "Super Admin");
    });

    test("the history route: 404 for a missing or deleted entry, 403 for the payment admin", async () => {
      const m = await manual();
      assert.equal((await call("GET", `/manual/${new mongoose.Types.ObjectId()}/history`)).status, 404);
      assert.equal((await call("GET", `/manual/${m._id}/history`, undefined, "paymentadmin")).status, 403);
      await ManualEntry.updateOne({ _id: m._id }, { $set: { deletedAt: new Date() } });
      assert.equal((await call("GET", `/manual/${m._id}/history`)).status, 404);
    });

    test("the history builder shows values like the sheet and handles empty data", () => {
      assert.equal(displayValue("Payment to Provider", "unpaid"), "Need to pay");
      assert.equal(displayValue("MR status from provider", "received"), "MR received");
      assert.equal(displayValue("Payment received", "received"), "Paid");
      assert.equal(displayValue("Date", "2026-08-15"), "15 Aug 2026");
      assert.equal(displayValue("Comment", ""), "—");
      assert.deepEqual(buildHistory({}), { groups: [], count: 0 });
    });
  });

  describe("the CSV follows the view", () => {
    const parse = (text) => text.replace(/^﻿/, "").trim().split("\r\n");

    test("view=manual has the manual table's columns in the same order and the same words as the sheet", async () => {
      await manual(
        { date: "2026-08-15", company: "Nova Assistance", caseNumber: "229987", patientName: "Bodyliev Alexandr", country: "Spain", serviceProvider: "Doctor Balear", consultationFee: "290", mrStatus: "received", mrSentToCompany: "sent", invoiceSent: "sent", paymentReceived: "received", paymentReceivedDate: "2026-09-29", contactNumber: "37379777262", feedbackSent: "Yes", feedbackReceived: "All 3 Reminder Sent", comment: "ok, fine" },
        { doctorFeeCents: 20000, paidStatus: "unpaid" },
      );
      await appt();
      const res = await call("GET", "/export.csv?view=manual", undefined, "admin");
      const lines = parse(res.text);
      assert.equal(lines.length, 2, "header + the one manual row (the booking is not in it)");
      assert.deepEqual(lines[0].split(","), MANUAL_COLUMNS);
      assert.deepEqual(MANUAL_COLUMNS.slice(0, 9), ["Date", "Company", "Case Number", "Patient Name", "Type of service", "Patient Country", "Service provider", "Status", "Consultation Fee"]);
      assert.equal(MANUAL_COLUMNS.at(-2), "Calculation");
      assert.equal(MANUAL_COLUMNS.at(-1), "Comment");
      assert.equal(
        lines[1],
        '2026-08-15,Nova Assistance,229987,Bodyliev Alexandr,House call,Spain,Doctor Balear,Open,290.00,200.00,MR received,MR sent,Invoice sent,Paid,Need to pay,2026-09-29,,37379777262,,Yes,All 3 Reminder Sent,90.00,"ok, fine"',
      );
    });

    test("manual CSV: a negative calculation, Others shows its text, formulas are made plain, filters apply", async () => {
      await manual({ consultationFee: "50", serviceType: "others", otherService: "=cmd()", patientName: "+Plus" }, { doctorFeeCents: 6500 });
      await manual({ patientName: "Hidden" }, { paidStatus: "on_hold" });
      const lines = parse((await call("GET", "/export.csv?view=manual&tab=unpaid", undefined, "admin")).text);
      assert.equal(lines.length, 2);
      const cells = lines[1].split(",");
      assert.deepEqual([cells[3], cells[4], cells[MANUAL_COLUMNS.indexOf("Calculation")]], ["'+Plus", "'=cmd()", "-15.00"]);
    });

    test("view=auto has bookings only and no manual-only columns; with no view it is the old everything file", async () => {
      await appt();
      await manual();
      const auto = parse((await call("GET", "/export.csv?view=auto", undefined, "admin")).text);
      assert.deepEqual(auto[0].split(","), AUTO_COLUMNS);
      assert.equal(auto.length, 2);
      assert.equal(AUTO_COLUMNS.includes("Company"), false);
      assert.equal(parse((await call("GET", "/export.csv", undefined, "admin")).text).length, 3);
      assert.equal((await call("GET", "/export.csv?view=nope", undefined, "admin")).status, 400);
    });
  });
});
