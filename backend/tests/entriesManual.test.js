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

const NOW = Date.UTC(2026, 9, 26, 22, 0); // already 2026-10-27 in India
const TODAY = "2026-10-27";

describe("manual entries: the list, and the add / edit / delete routes", () => {
  let mongod, server, base, patient, adminUser, doctor, doctor2, enrollment, enrollment2;

  const fakeAuth = (req, res, next) => {
    const role = req.headers["x-test-role"];
    if (!role) return res.status(401).json({ msg: "No token provided." });
    req.user = { id: String(adminUser._id), role };
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
    return { status: res.status, body: json };
  };
  const list = async (query = "", role = "admin") => (await call("GET", query ? `?${query}` : "", undefined, role)).body;
  const listAsSuper = (query = "") => list(query, "superadmin");
  const names = (body) => body.items.map((r) => r.patient.name);

  const appt = (extra = {}) =>
    Appointment.create({
      patientId: patient._id, doctorId: doctor._id, date: "2026-11-01", time: "10:00 AM", bookedAt: new Date(Date.UTC(2026, 9, 10)), status: "confirmed",
      paymentStatus: "paid", paymentAmount: 9900, consultationPrice: 99, ...extra,
    });
  const cat = (extra = {}) =>
    CategoryConsultation.create({
      concern: "x", severity: "mild", supportType: "chat", urgency: "flexible", date: "2026-11-02", slot: "05:30 PM",
      patientId: patient._id, categoryName: "Women's Health", status: "Confirmed", paymentStatus: "paid", paymentAmount: 4900, consultationPrice: 49,
      assignedDoctorId: enrollment._id, ...extra,
    });
  // The whole add form.
  const form = (extra = {}) => ({
    date: "2026-11-03", company: "Acme Assist", caseNumber: "AC-1042", serviceType: "house_call", caseStatus: "open",
    serviceProvider: "Martin Perlin", providerNumber: "+91 98765 43210",
    patientName: "Ravi Sharma", country: "India", contactNumber: "(022) 5550 1234",
    consultationFee: "100", doctorFee: "70",
    mrStatus: "pending", mrSentToCompany: "not_sent", invoiceSent: "not_sent", paymentReceived: "not_received", paymentToProvider: "unpaid",
    ...extra,
  });
  const add = async (extra, role) => call("POST", "/manual", form(extra), role);
  // Straight into the database, to build many rows quickly. `formExtra` overrides form fields, `entry` the entry, `docExtra` the document.
  const manual = (formExtra = {}, entry = {}, docExtra = {}) => {
    const v = M.validateManualCreate({ ...form(), patientName: "Manual Patient", doctorFee: "", ...formExtra }, { today: TODAY });
    assert.equal(v.ok, true, v.msg);
    const b = M.buildManualDocument(v.value, { actor: { id: adminUser._id, name: "An Admin", role: "admin" }, code: M.newCode(), today: TODAY });
    assert.equal(b.ok, true, b.msg);
    return ManualEntry.create({ ...b.doc, ...docExtra, entry: { ...b.doc.entry, ...entry } });
  };

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await ManualEntry.init();
    const app = express();
    app.use(express.json());
    app.use("/api/admin/entries", adminEntries.create({ guard: [fakeAuth, entriesViewAccess], now: () => NOW }));
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
    await Promise.all([Appointment.deleteMany({}), CategoryConsultation.deleteMany({}), ManualEntry.deleteMany({}), User.deleteMany({}), Doctor.deleteMany({}), Enrollment.deleteMany({})]);
    patient = await User.create({ name: "Rachel Secemski", email: "rachel@x.co", password: "SecretPw1!", country: "US" });
    adminUser = await User.create({ name: "An Admin", email: "admin@x.co", password: "SecretPw1!" });
    doctor = await Doctor.create({ name: "Martin Perlin", email: "martin@x.co", password: "SecretPw1!" });
    doctor2 = await Doctor.create({ name: "Hidayat Khan", email: "hk@x.co", password: "SecretPw1!" });
    enrollment = await Enrollment.create({ firstName: "Martin", surname: "Perlin", doctorId: doctor._id, email: "n@x.co", approvalStatus: "approved" });
    enrollment2 = await Enrollment.create({ firstName: "Hidayat", surname: "Khan", doctorId: doctor2._id, email: "h@x.co", approvalStatus: "approved" });
  });

  describe("adding a manual entry", () => {
    test("a complete form makes a row: 201, labelled Manual, with an M- id, every field stored, the audit trail and no approved doctor needed", async () => {
      const { status, body } = await add({ comment: "phone", feedbackSent: "Please rate us", feedbackReceived: "Great", paymentReceived: "received", mrStatus: "received", mrSentToCompany: "sent", invoiceSent: "sent" });
      assert.equal(status, 201);
      const row = body.item;
      assert.deepEqual([row.kind, row.sourceGroup, row.sourceCsv.Source, row.doctorName], ["manual", "Manual", "Manual", "Martin Perlin"]);
      assert.match(row.shortId, /^M-[0-9A-F]{4}$/);
      assert.deepEqual([row.patient.country, row.patient.countryName, row.consultation], ["IN", "India", { date: "2026-11-03", time: "" }]);
      assert.deepEqual([row.feeChargedCents, row.entry.doctorFeeCents, row.entry.paidStatus, row.entry.comment, row.placeholder, row.manual.caseLine], [10000, 7000, "unpaid", "phone", null, "Acme Assist · AC-1042"]);
      assert.deepEqual(row.manual.calculation, { cents: 3000, percent: 30 });
      const stored = await ManualEntry.findById(row.id).lean();
      assert.deepEqual([stored.createdBy.name, stored.createdBy.role, stored.log[0].action, stored.deletedAt], ["An Admin", "admin", "created", null]);
      assert.deepEqual([stored.company, stored.caseNumber, stored.serviceType, stored.caseStatus, stored.doctorName, stored.providerNumber, stored.contactNumber], ["Acme Assist", "AC-1042", "house_call", "open", "Martin Perlin", "+91 98765 43210", "(022) 5550 1234"]);
      assert.deepEqual([stored.mrStatus, stored.mrSentToCompany, stored.invoiceSent, stored.paymentReceived, stored.paymentReceivedDate, stored.feedbackSent, stored.feedbackReceived], ["received", "sent", "sent", "received", TODAY, "Please rate us", "Great"]);
      assert.equal("calculation" in stored, false, "the margin is not stored");
    });

    test("a provider that is not an approved doctor works: it is free text", async () => {
      const { status, body } = await add({ serviceProvider: "Sunrise Home Care Ltd" });
      assert.equal(status, 201);
      assert.equal(body.item.doctorName, "Sunrise Home Care Ltd");
    });

    test("only the date, service provider, patient name and consultation fee are needed; a fee of 0 is fine and shows no placeholder", async () => {
      const { status, body } = await call("POST", "/manual", { date: "2026-11-03", serviceProvider: "Dr X", patientName: "Free Patient", consultationFee: "0" });
      assert.equal(status, 201);
      assert.deepEqual([body.item.feeChargedCents, body.item.placeholder, body.item.entry.doctorFeeCents, body.item.manual.form.caseStatus, body.item.manual.calculation], [0, null, null, "open", { cents: null, percent: null }]);
    });

    test("Type of service Others needs its text", async () => {
      assert.equal((await add({ serviceType: "others" })).body.code, "other_service_required");
      const ok = await add({ serviceType: "others", otherService: "Physio at home" });
      assert.deepEqual([ok.status, ok.body.item.manual.form.otherService], [201, "Physio at home"]);
    });

    test("bad input is a 400 and nothing is saved", async () => {
      for (const [extra, code] of [
        [{ patientName: "" }, "invalid_name"],
        [{ serviceProvider: "" }, "invalid_provider"],
        [{ consultationFee: "" }, "invalid_fee_charged"],
        [{ consultationFee: "-5" }, "invalid_fee_charged"],
        [{ doctorFee: "abc" }, "invalid_fee"],
        [{ date: "2026-13-01" }, "invalid_date"],
        [{ contactNumber: "call me" }, "invalid_phone"],
        [{ providerNumber: "1".repeat(21) }, "invalid_phone"],
        [{ caseStatus: "closed" }, "invalid_case_status"],
        [{ feedbackReceived: "x".repeat(1001) }, "invalid_feedbackReceived"],
      ]) {
        const r = await add(extra);
        assert.deepEqual([r.status, r.body.code], [400, code], JSON.stringify(extra));
      }
      assert.equal(await ManualEntry.countDocuments({}), 0);
    });

    test("Paid from the start needs a doctor's fee above 0 (409) and then fills today's date", async () => {
      const refused = await add({ paymentToProvider: "paid", doctorFee: "" });
      assert.deepEqual([refused.status, refused.body.code], [409, "fee_required"]);
      assert.equal(await ManualEntry.countDocuments({}), 0);
      const ok = await add({ paymentToProvider: "paid" });
      assert.deepEqual([ok.status, ok.body.item.entry.paidStatus, ok.body.item.entry.paidOn, ok.body.item.manual.locked], [201, "paid", TODAY, true]);
    });

    test("the payment received date follows its status: today when received, none when not", async () => {
      assert.equal((await add({ paymentReceived: "partly_received" })).body.item.manual.form.paymentReceivedDate, TODAY);
      assert.equal((await add({ paymentReceived: "not_received", paymentReceivedDate: "2026-10-01" })).body.item.manual.form.paymentReceivedDate, "");
    });

    test("the payment admin and other roles get 403, no token gets 401, and nothing is saved", async () => {
      for (const role of ["paymentadmin", "user", "doctor", "employeeadmin", "partner"]) assert.equal((await add({}, role)).status, 403, role);
      assert.equal((await add({}, "")).status, 401);
      assert.equal(await ManualEntry.countDocuments({}), 0);
    });
  });

  describe("manual rows in the list", () => {
    test("they are rows: in All and the paid-status tabs, the counts, the totals and the summary, with Source = Manual", async () => {
      await appt();
      await manual({}, { doctorFeeCents: 2000 });
      await manual({ consultationFee: "10.50" }, { paidStatus: "on_hold" });
      const all = await list();
      assert.deepEqual([all.total, all.counts.all, all.counts.unpaid, all.counts.on_hold], [3, 3, 2, 1]);
      assert.deepEqual([all.totals.rows, all.totals.feeChargedCents, all.totals.doctorFeeCents], [3, 9900 + 10000 + 1050, 2000]);
      assert.equal(all.items.filter((r) => r.kind === "manual").length, 2);
      assert.deepEqual((await list("tab=on_hold")).items.map((r) => r.kind), ["manual"]);
      assert.equal((await list("tab=unpaid")).items.length, 2);
      assert.deepEqual(all.items.filter((r) => r.kind === "manual").map((r) => r.sourceGroup), ["Manual", "Manual"]);
    });

    test("the include flags do not hide them, and a deleted one is not a row anywhere", async () => {
      await manual();
      const gone = await manual({ patientName: "Deleted Person" });
      await ManualEntry.updateOne({ _id: gone._id }, { $set: { deletedAt: new Date() } });
      for (const q of ["", "includeCancelled=true&includeTesting=true"]) {
        const body = await list(q);
        assert.deepEqual([body.total, body.counts.all, body.totals.rows], [1, 1, 1], q);
        assert.deepEqual(names(body), ["Manual Patient"]);
      }
      assert.equal((await list("q=Deleted")).total, 0);
    });

    test("pages walk through all three sources in order, with correct totals and no repeats", async () => {
      for (let i = 1; i <= 5; i += 1) await appt({ date: `2026-11-${String(i * 4).padStart(2, "0")}`, patientDetails: { firstName: `A${i}` } });
      for (let i = 1; i <= 4; i += 1) await cat({ date: `2026-11-${String(i * 4 + 1).padStart(2, "0")}` });
      for (let i = 1; i <= 3; i += 1) await manual({ patientName: `Man ${i}`, date: `2026-11-${String(i * 4 + 2).padStart(2, "0")}` });
      const seen = [];
      const dates = [];
      for (let page = 1; page <= 3; page += 1) {
        const body = await list(`limit=5&page=${page}`);
        assert.equal(body.total, 12);
        assert.equal(body.totalPages, 3);
        assert.equal(body.items.length, page === 3 ? 2 : 5);
        seen.push(...body.items.map((r) => `${r.kind}:${r.id}`));
        dates.push(...body.items.map((r) => r.consultation.date));
      }
      assert.equal(new Set(seen).size, 12);
      assert.deepEqual(dates, [...dates].sort().reverse(), "newest consultation first across the three sources");
      const oldest = await list("limit=12&sort=consultation");
      assert.deepEqual(oldest.items.map((r) => r.consultation.date), [...dates].reverse(), "oldest first is the exact reverse");
    });

    test("the Doctor filter matches a manual row's service provider by its exact name (the doctor picked, by Enrollment id or Doctor id)", async () => {
      await manual({ serviceProvider: "Martin Perlin" });
      await manual({ patientName: "Other Provider Patient", serviceProvider: "Hidayat Khan" });
      await manual({ patientName: "Near Miss", serviceProvider: "Martin Perlin Clinic" });
      await manual({ patientName: "Wrong Case", serviceProvider: "martin perlin" });
      await manual({ patientName: "Free Text Provider", serviceProvider: "Sunrise Home Care" });
      assert.deepEqual(names(await list(`doctor=${enrollment._id}`)), ["Manual Patient"]);
      assert.deepEqual(names(await list(`doctor=${doctor._id}`)), ["Manual Patient"]);
      assert.deepEqual(names(await list(`doctor=${enrollment2._id}`)), ["Other Provider Patient"]);
      assert.equal((await list(`doctor=${new mongoose.Types.ObjectId()}`)).total, 0);
    });

    test("the Doctor dropdown also lists service providers from manual rows, once each, sorted with the doctors; picking one filters by its exact name", async () => {
      await appt();
      await manual({ patientName: "A", serviceProvider: "Sunrise Home Care" });
      await manual({ patientName: "B", serviceProvider: "Sunrise Home Care" });
      await manual({ patientName: "C", serviceProvider: "martin perlin" });
      await manual({ patientName: "D", serviceProvider: "Alpha Clinic" });
      const body = await list();
      assert.deepEqual(body.doctors.map((d) => d.name), ["Alpha Clinic", "Martin Perlin", "Sunrise Home Care"]);
      const sunrise = body.doctors.find((d) => d.name === "Sunrise Home Care");
      assert.deepEqual(names(await list(`doctor=${encodeURIComponent(sunrise.id)}`)).sort(), ["A", "B"]);
      assert.equal((await call("GET", "?doctor=provider:")).status, 400);
    });

    test("the Doctor filter still shows bookings of that doctor together with the manual rows named like them", async () => {
      await appt();
      await manual({ serviceProvider: "Martin Perlin" });
      await manual({ patientName: "Elsewhere", serviceProvider: "Hidayat Khan" });
      const body = await list(`doctor=${enrollment._id}`);
      assert.deepEqual(body.items.map((r) => r.kind).sort(), ["appointment", "manual"]);
      assert.equal(body.totals.rows, 2);
    });

    test("the month filter uses the case date; the choices list the months of manual rows", async () => {
      await manual({ patientName: "November", date: "2026-11-20" });
      await manual({ patientName: "October", date: "2026-10-05", serviceProvider: "Sunrise Home Care" });
      assert.deepEqual(names(await list("month=2026-11")), ["November"]);
      assert.deepEqual(names(await list("month=2026-10")), ["October"]);
      const all = await list();
      assert.deepEqual(all.months, ["2026-11", "2026-10"]);
      assert.deepEqual(all.doctors.map((d) => d.name), ["Martin Perlin", "Sunrise Home Care"]);
    });

    test("search finds them by patient, service provider, company, case number, country, and the M- code", async () => {
      const a = await manual({ patientName: "Priya Nair", country: "India", company: "Zenith Corp", caseNumber: "ZC-77", serviceProvider: "Dr Anand" });
      await manual({ patientName: "Someone Else", country: "Brazil", company: "Other Co", caseNumber: "OC-1", serviceProvider: "Hidayat Khan" });
      assert.deepEqual(names(await list("q=priya")), ["Priya Nair"]);
      assert.deepEqual(names(await list("q=hidayat")), ["Someone Else"]);
      assert.deepEqual(names(await list("q=anand")), ["Priya Nair"]);
      assert.deepEqual(names(await list("q=zenith")), ["Priya Nair"]);
      assert.deepEqual(names(await list("q=ZC-77")), ["Priya Nair"]);
      assert.deepEqual(names(await list("q=india")), ["Priya Nair"]);
      assert.deepEqual(names(await list("q=brazil")), ["Someone Else"]);
      for (const q of [`M-${a.code}`, `m${a.code.toLowerCase()}`, a.code, a.code.slice(1)]) {
        assert.ok(names(await list(`q=${encodeURIComponent(q)}`)).includes("Priya Nair"), q);
      }
      assert.equal((await list("q=zzzzzz")).total, 0);
    });

    test("the money boxes (to pay, paid, rows with no fee) are only sent to a super admin, and follow the month but not the tab or the search", async () => {
      await appt();
      await appt({ entry: { doctorFeeCents: 3000, paidStatus: "unpaid" } });
      await appt({ entry: { doctorFeeCents: 4000, paidStatus: "paid", paidOn: "2026-10-20", doctorAtEntry: String(doctor._id) } });
      await manual({}, { doctorFeeCents: 1500 });
      await manual({}, {});
      await manual({}, { paidStatus: "not_payable" });
      await manual({}, { paidStatus: "on_hold", doctorFeeCents: 999 });
      const body = await listAsSuper();
      assert.deepEqual([body.summary.toPayCents, body.summary.paidCents, body.summary.feeNotEnteredCount], [3000 + 1500, 4000, 2]);
      assert.deepEqual((await listAsSuper("tab=paid")).summary, body.summary);
      assert.deepEqual((await listAsSuper("q=nobody-called-this")).summary, body.summary);
    });

    test("the totals row: fee charged and saved doctor fee follow the tab and the search", async () => {
      await manual({ patientName: "Alpha", consultationFee: "20" }, { doctorFeeCents: 1000 });
      await manual({ patientName: "Beta", consultationFee: "30" }, { paidStatus: "on_hold", doctorFeeCents: 500 });
      assert.deepEqual((await list()).totals, { rows: 2, feeChargedCents: 5000, doctorFeeCents: 1500 });
      assert.deepEqual((await list("tab=on_hold")).totals, { rows: 1, feeChargedCents: 3000, doctorFeeCents: 500 });
      assert.deepEqual((await list("q=alpha")).totals, { rows: 1, feeChargedCents: 2000, doctorFeeCents: 1000 });
    });
  });

  describe("table cells on a manual row", () => {
    const cell = (id, field, value, version = 0, role) => call("PATCH", `/manual/${id}`, { field, value, version }, role);

    test("Paid needs a service provider and a doctor's fee above 0, and fills today's date", async () => {
      const m = await manual({}, {});
      const noFee = await cell(m._id, "paidStatus", "paid");
      assert.deepEqual([noFee.status, noFee.body.code], [409, "fee_required"]);
      assert.equal((await cell(m._id, "doctorFee", "36.75")).body.item.entry.doctorFeeCents, 3675);
      const paid = await cell(m._id, "paidStatus", "paid", 1);
      assert.deepEqual([paid.status, paid.body.item.entry.paidOn, paid.body.item.manual.locked], [200, TODAY, true]);
    });

    test("a legacy row with no service provider is refused with the service provider wording", async () => {
      const m = await manual({}, { doctorFeeCents: 1000 }, { doctorName: "" });
      const r = await cell(m._id, "paidStatus", "paid");
      assert.deepEqual([r.status, r.body.code], [409, "doctor_required"]);
      assert.match(r.body.msg, /service provider/);
    });

    test("once Paid to the provider, the doctor's fee box is locked (409) but the comment, status and Paid date are not", async () => {
      const m = await manual({}, { doctorFeeCents: 1000 });
      await cell(m._id, "paidStatus", "paid");
      const locked = await cell(m._id, "doctorFee", "99", 1);
      assert.deepEqual([locked.status, locked.body.code, locked.body.item.entry.doctorFeeCents], [409, "locked_paid", 1000]);
      assert.equal((await cell(m._id, "comment", "note", 1)).status, 200);
      assert.equal((await cell(m._id, "paidOn", "2026-10-20", 2)).status, 200);
      assert.equal((await cell(m._id, "paidStatus", "on_hold", 3)).status, 200);
      assert.equal((await cell(m._id, "doctorFee", "99", 4)).status, 200);
    });
  });

  describe("editing a manual row (the big popup)", () => {
    const edit = (id, body, role) => call("PATCH", `/manual/${id}/details`, body, role);

    test("the whole form comes back unchanged as a no-op; changes are saved in one versioned write and logged with who and when", async () => {
      const m = await manual({}, { doctorFeeCents: 7000 });
      const current = (await call("GET", `?q=${m.code}`)).body.items[0];
      const noop = await edit(m._id, { version: 0, ...current.manual.form });
      assert.deepEqual([noop.status, noop.body.noop], [200, true]);

      const r = await edit(m._id, {
        version: 0, patientName: "Ravi S", company: "Beta Assist", serviceType: "others", otherService: "Physio", caseStatus: "in_progress",
        serviceProvider: "Sunrise Home Care", consultationFee: "120", doctorFee: "80", mrStatus: "received", invoiceSent: "sent",
        paymentReceived: "received", feedbackSent: "Hello", feedbackReceived: "Thanks", comment: "all good",
      });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const row = r.body.item;
      assert.deepEqual([row.patient.name, row.doctorName, row.feeChargedCents, row.entry.doctorFeeCents, row.entry.comment, row.entry.version], ["Ravi S", "Sunrise Home Care", 12000, 8000, "all good", 1]);
      assert.deepEqual(row.manual.calculation, { cents: 4000, percent: 33.3 });
      assert.equal(row.manual.caseLine, "Beta Assist · AC-1042");
      const stored = await ManualEntry.findById(m._id).lean();
      assert.ok(stored.log.slice(1).every((l) => l.action === "edited" && l.by.name === "An Admin" && l.by.role === "admin" && l.at instanceof Date));
      assert.ok(["Patient Name", "Company", "Type of service", "Other service", "Status", "Service provider", "Consultation Fee", "Doctor's Fee", "MR status from provider", "Invoice sent status", "Payment received", "Payment received date", "Feedback Message Sent", "Feedback Received", "Comment"].every((f) => stored.log.some((l) => l.field === f)));
      assert.deepEqual([stored.log.find((l) => l.field === "Consultation Fee").from, stored.log.find((l) => l.field === "Consultation Fee").to], ["100.00", "120.00"]);
      assert.deepEqual(stored.entry.history.map((h) => h.field), ["doctorFee", "comment"]);
      assert.equal(stored.paymentReceivedDate, TODAY);
    });

    test("saving the form can mark it Paid (with its date) and set the doctor's fee in the same save", async () => {
      const m = await manual({}, {});
      const r = await edit(m._id, { version: 0, doctorFee: "50", paymentToProvider: "paid", paidDateToProvider: "2026-10-20" });
      assert.deepEqual([r.status, r.body.item.entry.paidStatus, r.body.item.entry.paidOn, r.body.item.entry.doctorFeeCents, r.body.item.manual.locked], [200, "paid", "2026-10-20", 5000, true]);
      const refused = await edit((await manual({}, {}))._id, { version: 0, paymentToProvider: "paid" });
      assert.deepEqual([refused.status, refused.body.code], [409, "fee_required"]);
    });

    test("a Paid row is locked for the case, provider, patient and fee fields (409, nothing changes) but not for the rest", async () => {
      const m = await manual({}, { doctorFeeCents: 7000 });
      await call("PATCH", `/manual/${m._id}`, { field: "paidStatus", value: "paid", version: 0 });
      for (const body of [{ patientName: "New" }, { company: "New Co" }, { serviceProvider: "Someone Else" }, { consultationFee: "150" }, { doctorFee: "90" }, { date: "2026-11-10" }, { caseStatus: "completed" }, { contactNumber: "555" }]) {
        const locked = await edit(m._id, { version: 1, ...body });
        assert.deepEqual([locked.status, locked.body.code, locked.body.item.manual.locked], [409, "locked_paid", true], JSON.stringify(body));
      }
      const stored = await ManualEntry.findById(m._id).lean();
      assert.deepEqual([stored.patientName, stored.company, stored.doctorName, stored.feeChargedCents, stored.entry.doctorFeeCents, stored.entry.v], ["Manual Patient", "Acme Assist", "Martin Perlin", 10000, 7000, 1]);
      const ok = await edit(m._id, { version: 1, mrStatus: "received", mrSentToCompany: "sent", invoiceSent: "sent", paymentReceived: "received", feedbackSent: "hi", feedbackReceived: "thanks", comment: "done", paidDateToProvider: "2026-10-21" });
      assert.deepEqual([ok.status, ok.body.item.entry.paidOn, ok.body.item.manual.form.mrStatus, ok.body.item.manual.form.feedbackReceived], [200, "2026-10-21", "received", "thanks"]);
      const back = await edit(m._id, { version: 2, paymentToProvider: "on_hold" });
      assert.equal(back.status, 200);
      assert.equal((await edit(m._id, { version: 3, patientName: "Allowed Now" })).status, 200);
    });

    test("a stale version is a 409 with the current row; a doctor's fee saved in the table makes a stale popup fail", async () => {
      const m = await manual();
      await edit(m._id, { version: 0, patientName: "First" });
      const stale = await edit(m._id, { version: 0, patientName: "Second" });
      assert.deepEqual([stale.status, stale.body.code, stale.body.item.patient.name], [409, "stale", "First"]);
      await call("PATCH", `/manual/${m._id}`, { field: "doctorFee", value: "10", version: 1 });
      assert.equal((await edit(m._id, { version: 1, patientName: "Late" })).status, 409);
    });

    test("bad values, a missing version, Others without its text and an empty request are 400s", async () => {
      const m = await manual();
      for (const [body, code] of [
        [{ version: 0, patientName: "" }, "invalid_name"],
        [{ version: 0, serviceProvider: "" }, "invalid_provider"],
        [{ version: 0, consultationFee: "x" }, "invalid_fee_charged"],
        [{ version: 0, doctorFee: "1.234" }, "invalid_fee"],
        [{ version: 0, date: "nope" }, "invalid_date"],
        [{ version: 0, contactNumber: "abc" }, "invalid_phone"],
        [{ version: 0, serviceType: "others" }, "other_service_required"],
        [{ version: 0 }, "nothing_to_change"],
        [{ patientName: "x" }, "bad_version"],
      ]) {
        const r = await edit(m._id, body);
        assert.deepEqual([r.status, r.body.code], [400, code], JSON.stringify(body));
      }
      assert.equal((await ManualEntry.findById(m._id).lean()).log.length, 1);
    });

    test("the payment admin gets 403; a deleted or missing row is 404", async () => {
      const m = await manual();
      assert.equal((await edit(m._id, { version: 0, patientName: "X" }, "paymentadmin")).status, 403);
      assert.equal((await edit(new mongoose.Types.ObjectId(), { version: 0, patientName: "X" })).status, 404);
      await ManualEntry.updateOne({ _id: m._id }, { $set: { deletedAt: new Date() } });
      assert.equal((await edit(m._id, { version: 0, patientName: "X" })).status, 404);
    });
  });

  describe("deleting a manual row", () => {
    test("it is a soft delete: gone from the list, counts, totals and search, but the document and its log stay", async () => {
      const m = await manual();
      await manual({ patientName: "Keeper" });
      const r = await call("DELETE", `/manual/${m._id}`);
      assert.deepEqual([r.status, r.body.ok], [200, true]);
      const stored = await ManualEntry.findById(m._id).lean();
      assert.deepEqual([Boolean(stored.deletedAt), stored.deletedBy.name, stored.deletedBy.role, stored.log.at(-1).action], [true, "An Admin", "admin", "deleted"]);
      assert.equal(stored.patientName, "Manual Patient");
      const body = await list();
      assert.deepEqual([body.total, body.counts.all, body.totals.rows, names(body)], [1, 1, 1, ["Keeper"]]);
      assert.equal((await call("DELETE", `/manual/${m._id}`)).status, 404);
    });

    test("a Paid row cannot be deleted (409); after changing the status it can", async () => {
      const m = await manual({}, { doctorFeeCents: 1000 });
      await call("PATCH", `/manual/${m._id}`, { field: "paidStatus", value: "paid", version: 0 });
      const refused = await call("DELETE", `/manual/${m._id}`);
      assert.deepEqual([refused.status, refused.body.code], [409, "delete_paid"]);
      assert.equal((await ManualEntry.findById(m._id).lean()).deletedAt, null);
      await call("PATCH", `/manual/${m._id}`, { field: "paidStatus", value: "unpaid", version: 1 });
      assert.equal((await call("DELETE", `/manual/${m._id}`)).status, 200);
    });

    test("real booking rows can never be deleted from this page: there is no way in", async () => {
      const a = await appt();
      const c = await cat();
      for (const path of [`/manual/${a._id}`, `/manual/${c._id}`, `/appointment/${a._id}`, `/category/${c._id}`, `/${a._id}`]) {
        const r = await call("DELETE", path);
        assert.ok([404, 405].includes(r.status), `${path} -> ${r.status}`);
      }
      assert.ok(await Appointment.findById(a._id));
      assert.ok(await CategoryConsultation.findById(c._id));
      assert.equal((await list()).total, 2);
    });

    test("the payment admin and other roles get 403 and the row stays", async () => {
      const m = await manual();
      for (const role of ["paymentadmin", "user", "doctor"]) assert.equal((await call("DELETE", `/manual/${m._id}`, undefined, role)).status, 403, role);
      assert.equal((await call("DELETE", `/manual/${m._id}`, undefined, "")).status, 401);
      assert.equal((await ManualEntry.findById(m._id).lean()).deletedAt, null);
    });
  });
});
