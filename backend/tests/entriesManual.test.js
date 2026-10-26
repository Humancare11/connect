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
  let mongod, server, base, patient, adminUser, doctor, doctor2, enrollment, enrollment2, pendingEnrollment;

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
  const list = async (query = "") => (await call("GET", query ? `?${query}` : "")).body;
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
  const form = (extra = {}) => ({ patientName: "Ravi Sharma", country: "India", doctorId: String(enrollment._id), date: "2026-11-03", time: "14:30", feeCharged: "49", ...extra });
  const add = async (extra, role) => call("POST", "/manual", form(extra), role);
  // Straight into the database, to build many rows quickly.
  const manual = (extra = {}, entry = {}) => {
    const built = M.buildManualDocument(
      M.validateManualCreate({ patientName: "Manual Patient", date: "2026-11-03", time: "10:00", feeCharged: "49", ...extra.form }, { today: TODAY }).value,
      { actor: { id: adminUser._id, name: "An Admin", role: "admin" }, doctor: extra.noDoctor ? null : { enrollmentId: enrollment._id, name: "Martin Perlin" }, code: M.newCode() },
    );
    const { form: _f, noDoctor: _n, ...rest } = extra;
    return ManualEntry.create({ ...built, ...rest, entry: { ...built.entry, ...entry } });
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
    const pendingDoctor = await Doctor.create({ name: "Pending Person", email: "p@x.co", password: "SecretPw1!" });
    pendingEnrollment = await Enrollment.create({ firstName: "Pending", surname: "Person", doctorId: pendingDoctor._id, email: "p@x.co", approvalStatus: "pending" });
  });

  describe("adding a manual entry", () => {
    test("a good form makes a row: 201, labelled Manual, with an M- id, the approved doctor's name and the audit trail", async () => {
      const { status, body } = await add({ doctorFee: "36.75", comment: "phone" });
      assert.equal(status, 201);
      const row = body.item;
      assert.deepEqual([row.kind, row.sourceGroup, row.sourceCsv.Source, row.doctorName], ["manual", "Manual", "Manual", "Martin Perlin"]);
      assert.match(row.shortId, /^M-[0-9A-F]{4}$/);
      assert.deepEqual([row.patient.country, row.patient.countryName, row.consultation], ["IN", "India", { date: "2026-11-03", time: "2:30 PM" }]);
      assert.deepEqual([row.feeChargedCents, row.entry.doctorFeeCents, row.entry.paidStatus, row.entry.comment, row.placeholder], [4900, 3675, "unpaid", "phone", null]);
      const stored = await ManualEntry.findById(row.id).lean();
      assert.deepEqual([stored.createdBy.name, stored.createdBy.role, stored.log[0].action, stored.deletedAt], ["An Admin", "admin", "created", null]);
      assert.equal(String(stored.doctorEnrollmentId), String(enrollment._id));
    });

    test("only the name and the fee charged are needed; a fee of 0 is fine and shows no placeholder", async () => {
      const { status, body } = await call("POST", "/manual", { patientName: "Free Patient", date: "2026-11-03", feeCharged: "0" });
      assert.equal(status, 201);
      assert.deepEqual([body.item.doctorName, body.item.feeChargedCents, body.item.placeholder, body.item.consultation.time], [null, 0, null, ""]);
    });

    test("bad input is a 400 and nothing is saved; so is a doctor who is not approved or does not exist", async () => {
      for (const [extra, code] of [
        [{ patientName: "" }, "invalid_name"],
        [{ feeCharged: "" }, "invalid_fee_charged"],
        [{ feeCharged: "-5" }, "invalid_fee_charged"],
        [{ date: "2026-13-01" }, "invalid_date"],
        [{ time: "25:61" }, "invalid_time"],
        [{ doctorFee: "abc" }, "invalid_fee"],
        [{ doctorId: String(pendingEnrollment._id) }, "invalid_doctor"],
        [{ doctorId: String(new mongoose.Types.ObjectId()) }, "invalid_doctor"],
        [{ doctorId: "not-an-id" }, "invalid_doctor"],
      ]) {
        const r = await add(extra);
        assert.deepEqual([r.status, r.body.code], [400, code], JSON.stringify(extra));
      }
      assert.equal(await ManualEntry.countDocuments({}), 0);
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
      await manual({ form: { feeCharged: "10.50" } }, { paidStatus: "on_hold" });
      const all = await list();
      assert.deepEqual([all.total, all.counts.all, all.counts.unpaid, all.counts.on_hold], [3, 3, 2, 1]);
      assert.deepEqual([all.totals.rows, all.totals.feeChargedCents, all.totals.doctorFeeCents], [3, 9900 + 4900 + 1050, 2000]);
      assert.equal(all.items.filter((r) => r.kind === "manual").length, 2);
      assert.deepEqual((await list("tab=on_hold")).items.map((r) => r.kind), ["manual"]);
      assert.equal((await list("tab=unpaid")).items.length, 2);
      assert.deepEqual(all.items.filter((r) => r.kind === "manual").map((r) => r.sourceGroup), ["Manual", "Manual"]);
    });

    test("the include flags do not hide them, and a deleted one is not a row anywhere", async () => {
      await manual();
      const gone = await manual({ form: { patientName: "Deleted Person" } });
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
      for (let i = 1; i <= 3; i += 1) await manual({ form: { patientName: `Man ${i}`, date: `2026-11-${String(i * 4 + 2).padStart(2, "0")}` } });
      const seen = [];
      let dates = [];
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
      assert.equal(oldest.items.length, 12);
      assert.deepEqual(oldest.items.map((r) => r.consultation.date), [...dates].reverse(), "oldest first is the exact reverse");
    });

    test("the doctor filter finds a manual row by the doctor picked (the Enrollment id), and by the Doctor id", async () => {
      await manual();
      await manual({ form: { patientName: "Other Doctor Patient" }, doctorEnrollmentId: enrollment2._id, doctorName: "Hidayat Khan" });
      await manual({ form: { patientName: "No Doctor" }, noDoctor: true });
      assert.deepEqual(names(await list(`doctor=${enrollment._id}`)), ["Manual Patient"]);
      assert.deepEqual(names(await list(`doctor=${enrollment2._id}`)), ["Other Doctor Patient"]);
      assert.deepEqual(names(await list(`doctor=${doctor2._id}`)), ["Other Doctor Patient"]);
      assert.equal((await list(`doctor=${new mongoose.Types.ObjectId()}`)).total, 0);
    });

    test("the month filter uses the consultation date; the choices list the manual rows' doctors and months", async () => {
      await manual({ form: { patientName: "November", date: "2026-11-20" } });
      await manual({ form: { patientName: "October", date: "2026-10-05" }, doctorEnrollmentId: enrollment2._id, doctorName: "Hidayat Khan" });
      assert.deepEqual(names(await list("month=2026-11")), ["November"]);
      assert.deepEqual(names(await list("month=2026-10")), ["October"]);
      const all = await list();
      assert.deepEqual(all.months, ["2026-11", "2026-10"]);
      assert.deepEqual(all.doctors.map((d) => d.name).sort(), ["Hidayat Khan", "Martin Perlin"]);
    });

    test("search finds them by patient, doctor, country name, and the M- code (whole, partial, with or without the dash)", async () => {
      const a = await manual({ form: { patientName: "Priya Nair", country: "India" } });
      await manual({ form: { patientName: "Someone Else", country: "Brazil" }, doctorEnrollmentId: enrollment2._id, doctorName: "Hidayat Khan" });
      assert.deepEqual(names(await list("q=priya")), ["Priya Nair"]);
      assert.deepEqual(names(await list("q=hidayat")), ["Someone Else"]);
      assert.deepEqual(names(await list("q=india")), ["Priya Nair"]);
      assert.deepEqual(names(await list("q=brazil")), ["Someone Else"]);
      for (const q of [`M-${a.code}`, `m${a.code.toLowerCase()}`, a.code, a.code.slice(1)]) {
        assert.ok(names(await list(`q=${encodeURIComponent(q)}`)).includes("Priya Nair"), q);
      }
      assert.equal((await list("q=zzzzzz")).total, 0);
    });

    test("the three summary boxes: to pay (saved fees on Unpaid), paid, and rows with no fee (Not payable left out)", async () => {
      await appt(); // unpaid, no fee
      await appt({ entry: { doctorFeeCents: 3000, paidStatus: "unpaid" } });
      await appt({ entry: { doctorFeeCents: 4000, paidStatus: "paid", paidOn: "2026-10-20", doctorAtEntry: String(doctor._id) } });
      await manual({}, { doctorFeeCents: 1500 }); // unpaid
      await manual({}, {}); // unpaid, no fee
      await manual({}, { paidStatus: "not_payable" }); // no fee, but Not payable: not counted (so the 2 are the booking and the manual row above)
      await manual({}, { paidStatus: "on_hold", doctorFeeCents: 999 }); // on hold: neither box
      const body = await list();
      assert.deepEqual(body.summary, { toPayCents: 3000 + 1500, paidCents: 4000, feeNotEnteredCount: 2 });
      // They follow the filters, but not the tab or the search.
      assert.deepEqual((await list("tab=paid")).summary, body.summary);
      assert.deepEqual((await list("q=nobody-called-this")).summary, body.summary);
      const forDoctor2 = await list(`doctor=${enrollment2._id}`);
      assert.deepEqual(forDoctor2.summary, { toPayCents: 0, paidCents: 0, feeNotEnteredCount: 0 });
    });

    test("the totals row: fee charged and saved doctor fee follow the tab and the search", async () => {
      await manual({ form: { patientName: "Alpha", feeCharged: "20" } }, { doctorFeeCents: 1000 });
      await manual({ form: { patientName: "Beta", feeCharged: "30" } }, { paidStatus: "on_hold", doctorFeeCents: 500 });
      assert.deepEqual((await list()).totals, { rows: 2, feeChargedCents: 5000, doctorFeeCents: 1500 });
      assert.deepEqual((await list("tab=on_hold")).totals, { rows: 1, feeChargedCents: 3000, doctorFeeCents: 500 });
      assert.deepEqual((await list("q=alpha")).totals, { rows: 1, feeChargedCents: 2000, doctorFeeCents: 1000 });
    });
  });

  describe("editing the details of a manual row", () => {
    const edit = (id, body, role) => call("PATCH", `/manual/${id}/details`, body, role);

    test("each detail changes, the version moves on, and every change is in the row's log with who and when", async () => {
      const m = await manual();
      const r = await edit(m._id, { version: 0, patientName: "Ravi S", country: "Brazil", doctorId: String(enrollment2._id), date: "2026-11-09", time: "09:15", feeCharged: "60" });
      assert.equal(r.status, 200);
      const row = r.body.item;
      assert.deepEqual([row.patient.name, row.patient.countryName, row.doctorName, row.consultation, row.feeChargedCents, row.entry.version], ["Ravi S", "Brazil", "Hidayat Khan", { date: "2026-11-09", time: "9:15 AM" }, 6000, 1]);
      const stored = await ManualEntry.findById(m._id).lean();
      assert.deepEqual(stored.log.map((l) => `${l.action}:${l.field}`), ["created:", "edited:patientName", "edited:country", "edited:doctor", "edited:date", "edited:time", "edited:fee"]);
      assert.ok(stored.log.slice(1).every((l) => l.by.name === "An Admin" && l.by.role === "admin" && l.at instanceof Date));
      assert.deepEqual([stored.log.at(-1).from, stored.log.at(-1).to], ["49.00", "60.00"]);
    });

    test("a Paid row is locked (409), and nothing changes; changing the status back unlocks it", async () => {
      const m = await manual({}, { doctorFeeCents: 1000 });
      assert.equal((await call("PATCH", `/manual/${m._id}`, { field: "paidStatus", value: "paid", version: 0 })).status, 200);
      const locked = await edit(m._id, { version: 1, patientName: "New Name" });
      assert.deepEqual([locked.status, locked.body.code, locked.body.item.manual.locked], [409, "locked_paid", true]);
      assert.equal((await ManualEntry.findById(m._id).lean()).patientName, "Manual Patient");
      await call("PATCH", `/manual/${m._id}`, { field: "paidStatus", value: "unpaid", version: 1 });
      assert.equal((await edit(m._id, { version: 2, patientName: "New Name" })).status, 200);
    });

    test("a stale version is a 409 with the current row; a no-op saves nothing", async () => {
      const m = await manual();
      await edit(m._id, { version: 0, patientName: "First" });
      const stale = await edit(m._id, { version: 0, patientName: "Second" });
      assert.deepEqual([stale.status, stale.body.code, stale.body.item.patient.name], [409, "stale", "First"]);
      const same = await edit(m._id, { version: 1, patientName: "First" });
      assert.deepEqual([same.status, same.body.noop], [200, true]);
      assert.equal((await ManualEntry.findById(m._id).lean()).log.length, 2);
    });

    test("a doctor fee saved elsewhere on the page makes a stale Edit fail (they share one version)", async () => {
      const m = await manual();
      await call("PATCH", `/manual/${m._id}`, { field: "doctorFee", value: "10", version: 0 });
      assert.equal((await edit(m._id, { version: 0, patientName: "Late" })).status, 409);
    });

    test("bad values, a missing version, an unapproved doctor and an empty request are 400s", async () => {
      const m = await manual();
      for (const [body, code] of [
        [{ version: 0, patientName: "" }, "invalid_name"],
        [{ version: 0, feeCharged: "x" }, "invalid_fee_charged"],
        [{ version: 0, date: "nope" }, "invalid_date"],
        [{ version: 0, time: "99:99" }, "invalid_time"],
        [{ version: 0, doctorId: String(pendingEnrollment._id) }, "invalid_doctor"],
        [{ version: 0 }, "nothing_to_change"],
        [{ patientName: "x" }, "bad_version"],
      ]) {
        const r = await edit(m._id, body);
        assert.deepEqual([r.status, r.body.code], [400, code], JSON.stringify(body));
      }
      assert.equal((await ManualEntry.findById(m._id).lean()).log.length, 1);
    });

    test("the doctor can be cleared (then Paid is refused); the payment admin gets 403; a deleted or missing row is 404", async () => {
      const m = await manual({}, { doctorFeeCents: 1000 });
      const cleared = await edit(m._id, { version: 0, doctorId: null });
      assert.equal(cleared.body.item.doctorName, null);
      const paid = await call("PATCH", `/manual/${m._id}`, { field: "paidStatus", value: "paid", version: 1 });
      assert.deepEqual([paid.status, paid.body.code], [409, "doctor_required"]);
      assert.equal((await edit(m._id, { version: 1, patientName: "X" }, "paymentadmin")).status, 403);
      assert.equal((await edit(new mongoose.Types.ObjectId(), { version: 0, patientName: "X" })).status, 404);
      await ManualEntry.updateOne({ _id: m._id }, { $set: { deletedAt: new Date() } });
      assert.equal((await edit(m._id, { version: 1, patientName: "X" })).status, 404);
    });
  });

  describe("deleting a manual row", () => {
    test("it is a soft delete: gone from the list, counts, totals and search, but the document and its log stay", async () => {
      const m = await manual();
      await manual({ form: { patientName: "Keeper" } });
      const r = await call("DELETE", `/manual/${m._id}`);
      assert.deepEqual([r.status, r.body.ok], [200, true]);
      const stored = await ManualEntry.findById(m._id).lean();
      assert.deepEqual([Boolean(stored.deletedAt), stored.deletedBy.name, stored.deletedBy.role, stored.log.at(-1).action], [true, "An Admin", "admin", "deleted"]);
      assert.equal(stored.patientName, "Manual Patient");
      const body = await list();
      assert.deepEqual([body.total, body.counts.all, body.totals.rows, names(body)], [1, 1, 1, ["Keeper"]]);
      assert.equal((await call("DELETE", `/manual/${m._id}`)).status, 404);
      assert.equal((await call("PATCH", `/manual/${m._id}`, { field: "comment", value: "x", version: 0 })).status, 404);
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
