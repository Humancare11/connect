const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const adminEntries = require("../routes/adminEntries");
const { entriesViewAccess } = require("../middleware/verifyToken");
const { parseEntriesQuery, EntryListQueryError } = require("../utils/bookingEntryList");
const { feeOf } = require("../utils/adminBookingList");

// Money totals are kept per currency (never added across them); these tests only use USD bookings.
const usdTotals = (t) => ({ rows: t.rows, ...t.byCurrency.usd });
const usdSummary = (s) => ({ feeNotEnteredCount: s.feeNotEnteredCount, ...s.byCurrency.usd });

describe("appointment entries list", () => {
  let mongod, server, base, patient, other, doctor, doctor2, enrollment, enrollment2;

  // Stands in for verifyAdminToken: no header = unauthenticated. The REAL entriesViewAccess runs after it.
  const fakeAuth = (req, res, next) => {
    const role = req.headers["x-test-role"];
    if (!role) return res.status(401).json({ msg: "No token provided." });
    req.user = { id: "admin1", role };
    next();
  };
  const get = async (query = "", role = "admin") => {
    const res = await fetch(`${base}${query ? `?${query}` : ""}`, { headers: role ? { "x-test-role": role } : {} });
    return { status: res.status, body: await res.json() };
  };
  const list = async (query = "") => (await get(query)).body;
  const names = (body) => body.items.map((r) => r.patient.name);
  const ids = (body) => body.items.map((r) => r.id);

  const day = (n) => new Date(Date.UTC(2026, 9, n, 10));
  // Paid appointment with a doctor. date = consultation date, n = booked day.
  const appt = (n, extra = {}) =>
    Appointment.create({
      patientId: patient._id, doctorId: doctor._id, date: "2026-11-01", time: "10:00 AM", bookedAt: day(n), status: "confirmed",
      paymentStatus: "paid", paymentAmount: 9900, consultationPrice: 99, ...extra,
    });
  // A booking with no consultation date (the model requires one, so it is removed straight from the database).
  const undated = async (n, extra = {}) => {
    const doc = await appt(n, extra);
    await Appointment.collection.updateOne({ _id: doc._id }, { $unset: { date: "", time: "" } });
    return doc;
  };
  const cat = async (n, extra = {}) => {
    const doc = await CategoryConsultation.create({
      concern: "x", severity: "mild", supportType: "chat", urgency: "flexible", date: "2026-11-02", slot: "05:30 PM",
      patientId: patient._id, categoryName: "Women's Health", status: "Confirmed", paymentStatus: "paid", paymentAmount: 4900, consultationPrice: 49,
      assignedDoctorId: enrollment._id, ...extra,
    });
    await CategoryConsultation.collection.updateOne({ _id: doc._id }, { $set: { createdAt: day(n) } });
    return doc;
  };

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    const app = express();
    app.use("/api/admin/entries", adminEntries.create({ guard: [fakeAuth, entriesViewAccess] }));
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
    await Promise.all([Appointment.deleteMany({}), CategoryConsultation.deleteMany({}), User.deleteMany({}), Doctor.deleteMany({}), Enrollment.deleteMany({})]);
    patient = await User.create({ name: "Rachel Secemski", email: "rachel@x.co", password: "SecretPw1!", country: "US" });
    other = await User.create({ name: "Anil Kapoor", email: "anil@x.co", password: "SecretPw1!", country: "IN" });
    doctor = await Doctor.create({ name: "Martin Perlin", email: "martin@x.co", password: "SecretPw1!" });
    doctor2 = await Doctor.create({ name: "Hidayat Khan", email: "hk@x.co", password: "SecretPw1!" });
    enrollment = await Enrollment.create({ firstName: "Martin", surname: "Perlin", doctorId: doctor._id, email: "n@x.co" });
    enrollment2 = await Enrollment.create({ firstName: "Hidayat", surname: "Khan", doctorId: doctor2._id, email: "h@x.co" });
  });

  describe("access", () => {
    test("no token is 401; admin and super admin may look; the payment admin and anyone else is 403", async () => {
      assert.equal((await get("", "")).status, 401);
      for (const role of ["admin", "superadmin"]) assert.equal((await get("", role)).status, 200, role);
      for (const role of ["paymentadmin", "user", "doctor", "employeeadmin", "partner", "somethingelse"]) assert.equal((await get("", role)).status, 403, role);
    });

    test("the real route is mounted with the real token check and the viewer guard", () => {
      const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
      assert.match(server, /app\.use\("\/api\/admin\/entries", require\("\.\/routes\/adminEntries"\)\);/);
      const route = fs.readFileSync(path.join(__dirname, "..", "routes", "adminEntries.js"), "utf8");
      assert.match(route, /guard = \[verifyAdminToken, entriesViewAccess\]/);
    });
  });

  describe("which bookings are rows", () => {
    test("every appointment is a row, with or without a doctor and whatever its payment says", async () => {
      await appt(1, { doctorId: null });
      await appt(2, { paymentStatus: "unpaid", paymentAmount: 0 });
      await appt(3);
      const body = await list();
      assert.equal(body.total, 3);
      assert.equal(body.items.length, 3);
    });

    test("only PAID category consultations are rows: unpaid and refunded ones are left out", async () => {
      await cat(1);
      await cat(2, { paymentStatus: "unpaid", paymentAmount: 0 });
      await cat(3, { paymentStatus: "refunded" });
      const body = await list();
      assert.equal(body.total, 1);
      assert.equal(body.items[0].kind, "category");
      assert.equal(body.counts.all, 1);
      assert.equal(body.totals.rows, 1);
    });

    test("cancelled and testing bookings are left out by default and come back with the flags", async () => {
      await appt(1, { patientDetails: { name: "plain" } });
      await appt(2, { status: "cancelled" });
      await appt(3, { isTesting: true });
      await cat(4, { status: "Cancelled" });
      await cat(5, { isTesting: true });
      await cat(6);
      assert.equal((await list()).total, 2);
      assert.equal((await list("includeCancelled=true")).total, 4);
      assert.equal((await list("includeTesting=true")).total, 4);
      assert.equal((await list("includeCancelled=1&includeTesting=1")).total, 6);
      const all = await list("includeCancelled=true&includeTesting=true");
      assert.equal(all.items.filter((r) => r.status === "cancelled").length, 2);
      assert.equal(all.items.filter((r) => r.isTesting).length, 2);
    });

    test("a booking cancelled after its doctor was marked Paid is flagged, and only appears with includeCancelled", async () => {
      await appt(1, { status: "cancelled", entry: { paidStatus: "paid", doctorFeeCents: 7425, paidOn: "2026-10-05" } });
      assert.equal((await list()).total, 0);
      const body = await list("includeCancelled=true");
      assert.equal(body.items[0].cancelledAfterPaid, true);
      assert.equal(body.counts.paid, 1);
    });
  });

  describe("old documents with no entry field", () => {
    test("they are Unpaid with nothing typed, in the rows, the counts and the Unpaid tab", async () => {
      const a = await appt(1);
      const c = await cat(2);
      // Exactly what a document saved before this feature looks like: no `entry` key at all.
      await Appointment.collection.updateOne({ _id: a._id }, { $unset: { entry: "" } });
      await CategoryConsultation.collection.updateOne({ _id: c._id }, { $unset: { entry: "" } });
      const raw = await Appointment.collection.findOne({ _id: a._id });
      assert.equal("entry" in raw, false);

      const body = await list();
      assert.equal(body.total, 2);
      for (const row of body.items) {
        assert.equal(row.entry.paidStatus, "unpaid");
        assert.equal(row.entry.doctorFeeCents, null);
        assert.equal(row.entry.paidOn, "");
        assert.equal(row.entry.comment, "");
        assert.equal(row.entry.version, 0);
        assert.equal(row.doctorChanged, false);
        assert.ok(row.placeholder, "there is a placeholder while no fee is typed");
      }
      assert.deepEqual(body.counts, { all: 2, unpaid: 2, paid: 0, on_hold: 0, not_payable: 0 });
      assert.equal((await list("tab=unpaid")).total, 2);
      assert.equal((await list("tab=paid")).total, 0);
    });
  });

  describe("tabs and counts", () => {
    beforeEach(async () => {
      await appt(1, { entry: { paidStatus: "paid", doctorFeeCents: 7425, paidOn: "2026-10-02" } });
      await appt(2, { entry: { paidStatus: "on_hold" } });
      await appt(3, { entry: { paidStatus: "not_payable" } });
      await appt(4);
      await cat(5, { entry: { paidStatus: "paid", doctorFeeCents: 3675, paidOn: "2026-10-03" } });
      await cat(6);
    });

    test("one count per tab, across both kinds", async () => {
      const body = await list();
      assert.deepEqual(body.counts, { all: 6, unpaid: 2, paid: 2, on_hold: 1, not_payable: 1 });
    });

    test("each tab lists exactly its rows", async () => {
      for (const [tab, n] of [["all", 6], ["unpaid", 2], ["paid", 2], ["on_hold", 1], ["not_payable", 1]]) {
        const body = await list(`tab=${tab}`);
        assert.equal(body.total, n, tab);
        assert.equal(body.items.length, n, tab);
        if (tab !== "all") for (const row of body.items) assert.equal(row.entry.paidStatus, tab);
      }
    });

    test("counts ignore the tab and the search text, but follow the include flags and the doctor and month filters", async () => {
      assert.deepEqual((await list("tab=paid&q=nobody-has-this-name")).counts, { all: 6, unpaid: 2, paid: 2, on_hold: 1, not_payable: 1 });
      await appt(7, { status: "cancelled", entry: { paidStatus: "on_hold" } });
      assert.equal((await list()).counts.on_hold, 1);
      assert.equal((await list("includeCancelled=true")).counts.on_hold, 2);
      assert.equal((await list(`doctor=${enrollment2._id}`)).counts.all, 0);
      assert.equal((await list(`doctor=${enrollment._id}`)).counts.all, 6);
      assert.equal((await list("month=2026-12")).counts.all, 0);
      assert.equal((await list("month=2026-11")).counts.all, 6, "all six have a November consultation date");
    });
  });

  describe("the row", () => {
    test("an appointment row has everything the page needs", async () => {
      const a = await appt(5, {
        patientDetails: { country: "US" }, date: "2026-10-16", time: "5:00 PM",
        entry: { doctorFeeCents: 7425, paidStatus: "paid", paidOn: "2026-10-18", comment: "Waiting for invoice", v: 4, doctorAtEntry: String(doctor._id), edits: { comment: { by: { name: "Pay Admin" }, at: day(7) } } },
      });
      const [row] = (await list()).items;
      assert.equal(row.kind, "appointment");
      assert.equal(row.id, String(a._id));
      assert.equal(row.shortId, String(a._id).slice(-8).toUpperCase());
      assert.equal(new Date(row.bookedAt).getTime(), day(5).getTime());
      assert.deepEqual(row.consultation, { date: "2026-10-16", time: "5:00 PM" });
      assert.deepEqual(row.patient, { name: "Rachel Secemski", country: "US", countryName: "United States" });
      assert.equal(row.doctorName, "Martin Perlin");
      assert.equal(row.feeChargedCents, 9900);
      assert.equal(row.amountPaidCents, 9900);
      assert.deepEqual(
        { ...row.entry, edits: undefined },
        { doctorFeeCents: 7425, paidStatus: "paid", paidOn: "2026-10-18", comment: "Waiting for invoice", version: 4, edits: undefined },
      );
      assert.equal(row.entry.edits.comment.by, "Pay Admin");
      assert.equal(row.placeholder, null, "a typed fee replaces the placeholder");
      assert.equal(row.doctorChanged, false);
      assert.equal(row.cancelledAfterPaid, false);
      assert.equal(row.isTesting, false);
      assert.ok(!("history" in row.entry), "the history is not sent with every row");
    });

    test("a category consultation row carries the same fields", async () => {
      const c = await cat(6, { date: "2026-10-20", slot: "09:00 AM" });
      const [row] = (await list()).items;
      assert.equal(row.kind, "category");
      assert.equal(row.id, String(c._id));
      assert.deepEqual(row.consultation, { date: "2026-10-20", time: "09:00 AM" });
      assert.equal(row.patient.name, "Rachel Secemski");
      assert.equal(row.doctorName, "Martin Perlin");
      assert.equal(row.feeChargedCents, 4900);
      assert.equal(row.amountPaidCents, 4900);
    });

    test("no doctor reads as null; no consultation date reads as null", async () => {
      await undated(1, { doctorId: null });
      const [row] = (await list()).items;
      assert.equal(row.doctorName, null);
      assert.equal(row.consultation, null);
    });

    test("the grey placeholder is 75% of what was PAID, with its tooltip; nothing paid means none", async () => {
      await appt(1, { paymentAmount: 9900, consultationPrice: 120 });
      await appt(2, { paymentAmount: 0, consultationPrice: 50, patientDetails: { name: "unpaid-one" } });
      const body = await list("sort=-bookedAt");
      const paid = body.items.find((r) => r.amountPaidCents === 9900);
      const free = body.items.find((r) => r.amountPaidCents === 0);
      assert.deepEqual(paid.placeholder, { cents: 7425, text: "75% · 74.25", title: "75% of $99.00 paid" }, "based on paymentAmount, not the listed price (120)");
      assert.equal(paid.feeChargedCents, 12000, "the fee charged column still shows the listed price");
      assert.equal(free.placeholder, null);
      assert.equal(free.feeChargedCents, 5000);
    });

    test("the placeholder is never saved", async () => {
      await appt(1);
      await list();
      const raw = await Appointment.findOne({}).lean();
      assert.equal(raw.entry.doctorFeeCents, null);
    });

    test("the doctor-changed flag: a different doctor now than when the fee was entered", async () => {
      await appt(1, { doctorId: doctor2._id, entry: { doctorFeeCents: 500, doctorAtEntry: String(doctor._id) } });
      await appt(2, { entry: { doctorFeeCents: 500, doctorAtEntry: String(doctor._id) }, patientDetails: { name: "same" } });
      await cat(3, { assignedDoctorId: enrollment2._id, entry: { doctorFeeCents: 500, doctorAtEntry: String(enrollment._id) } });
      const body = await list("sort=-bookedAt");
      // newest booking first: the category one (moved to doctor 2), the appointment with the same doctor, the one moved to doctor 2
      assert.deepEqual(body.items.map((r) => r.doctorChanged), [true, false, true]);
    });
  });

  describe("sort and pages", () => {
    test("the default is consultation date, newest first; a booking with no date is always last", async () => {
      await appt(1, { date: "2026-10-05", patientId: patient._id });
      await appt(2, { date: "2026-12-01", patientId: other._id });
      await cat(3, { date: "2026-11-15" });
      await undated(4);
      await appt(5, { date: "2026-10-05", bookedAt: day(20) });
      const body = await list();
      assert.deepEqual(body.items.map((r) => r.consultation?.date ?? null), ["2026-12-01", "2026-11-15", "2026-10-05", "2026-10-05", null]);
      assert.equal(body.sort, "-consultation");
      // same consultation day: the later booking first
      const sameDay = body.items.filter((r) => r.consultation?.date === "2026-10-05");
      assert.ok(new Date(sameDay[0].bookedAt) > new Date(sameDay[1].bookedAt));
    });

    test("oldest first puts the undated booking last as well", async () => {
      await appt(1, { date: "2026-10-05" });
      await appt(2, { date: "2026-12-01" });
      await undated(3);
      const body = await list("sort=consultation");
      assert.deepEqual(body.items.map((r) => r.consultation?.date ?? null), ["2026-10-05", "2026-12-01", null]);
    });

    test("sort=bookedAt works across both kinds, newest first with a leading minus", async () => {
      const a = await appt(10);
      const c = await cat(12);
      const b = await appt(14);
      assert.deepEqual(ids(await list("sort=-bookedAt")), [String(b._id), String(c._id), String(a._id)]);
      assert.deepEqual(ids(await list("sort=bookedAt")), [String(a._id), String(c._id), String(b._id)]);
    });

    test("25 per page, any page, the limit is capped at 100, and the pages tile the list with no repeats", async () => {
      for (let i = 1; i <= 30; i += 1) await appt(1, { date: `2026-11-${String(i).padStart(2, "0")}` });
      for (let i = 1; i <= 25; i += 1) await cat(2, { date: `2026-12-${String(i).padStart(2, "0")}` });
      const first = await list();
      assert.equal(first.items.length, 25);
      assert.equal(first.limit, 25);
      assert.equal(first.total, 55);
      assert.equal(first.totalPages, 3);
      const second = await list("page=2");
      const third = await list("page=3");
      assert.equal(second.items.length, 25);
      assert.equal(third.items.length, 5);
      const every = [...ids(first), ...ids(second), ...ids(third)];
      assert.equal(new Set(every).size, 55);
      const dates = [...first.items, ...second.items, ...third.items].map((r) => r.consultation.date);
      assert.deepEqual(dates, [...dates].sort().reverse(), "newest first across pages and kinds");
      assert.equal((await list("limit=5")).items.length, 5);
      const big = await list("limit=500");
      assert.equal(big.limit, 100);
      assert.equal(big.items.length, 55);
      assert.equal((await list("page=9")).items.length, 0);
    });
  });

  describe("search", () => {
    beforeEach(async () => {
      await appt(1, { patientId: patient._id, doctorId: doctor._id, date: "2026-10-01", patientDetails: { country: "US" } });
      await appt(2, { patientId: other._id, doctorId: doctor2._id, date: "2026-10-02", patientDetails: { country: "IN" } });
      await cat(3, { patientId: other._id, assignedDoctorId: enrollment._id, date: "2026-10-03" });
    });

    test("by patient name or email", async () => {
      assert.deepEqual(names(await list("q=rachel")), ["Rachel Secemski"]);
      assert.equal((await list("q=anil@x.co")).total, 2);
    });

    test("by doctor, for both kinds", async () => {
      const martin = await list("q=perlin");
      assert.equal(martin.total, 2, "one appointment and one category consultation");
      assert.deepEqual([...new Set(martin.items.map((r) => r.doctorName))], ["Martin Perlin"]);
      assert.equal((await list("q=hidayat")).total, 1);
    });

    test("by booking id, full or part of it (the short form too)", async () => {
      const a = await Appointment.findOne({ date: "2026-10-01" }).lean();
      assert.deepEqual(ids(await list(`q=${a._id}`)), [String(a._id)]);
      assert.deepEqual(ids(await list(`q=${String(a._id).slice(-8)}`)), [String(a._id)]);
    });

    test("by country, by name or by code", async () => {
      assert.equal((await list("q=india")).total, 2);
      assert.equal((await list("q=united states")).total, 1);
      assert.equal((await list("q=IN")).total >= 2, true);
    });

    test("it narrows the rows and the totals but not the counts, and special characters are harmless", async () => {
      const body = await list("q=rachel");
      assert.equal(body.total, 1);
      assert.equal(body.totals.rows, 1);
      assert.equal(body.counts.all, 3);
      for (const q of [".*", "(", "[a-", "\\", "$where", "{}"]) assert.equal((await get(`q=${encodeURIComponent(q)}`)).status, 200, q);
      assert.equal((await list(`q=${encodeURIComponent(".*")}`)).total, 0);
      assert.equal((await list(`q=${"x".repeat(300)}`)).total, 0);
    });
  });

  describe("the doctor and month filters, and what they offer", () => {
    beforeEach(async () => {
      await appt(1, { doctorId: doctor._id, date: "2026-09-10" });
      await appt(2, { doctorId: doctor2._id, date: "2026-10-05" });
      await cat(3, { assignedDoctorId: enrollment2._id, date: "2026-10-21" });
      await cat(4, { assignedDoctorId: enrollment._id, date: "2026-10-22" });
      await appt(5, { doctorId: null, date: "2026-10-30" });
    });

    test("a doctor (by enrollment id) matches that doctor's appointments and category consultations", async () => {
      const hk = await list(`doctor=${enrollment2._id}`);
      assert.equal(hk.total, 2);
      assert.deepEqual([...new Set(hk.items.map((r) => r.doctorName))], ["Hidayat Khan"]);
      assert.deepEqual(hk.items.map((r) => r.kind).sort(), ["appointment", "category"]);
      assert.equal((await list(`doctor=${enrollment._id}`)).total, 2);
    });

    test("a Doctor id works too, and an unknown id is just an empty list", async () => {
      assert.equal((await list(`doctor=${doctor._id}`)).total, 2);
      assert.equal((await list(`doctor=${new mongoose.Types.ObjectId()}`)).total, 0);
    });

    test("a consultation month matches by the consultation date", async () => {
      assert.equal((await list("month=2026-10")).total, 4);
      assert.equal((await list("month=2026-09")).total, 1);
      assert.equal((await list("month=2026-08")).total, 0);
      assert.equal((await list(`month=2026-10&doctor=${enrollment2._id}`)).total, 2);
    });

    test("year-end months work", async () => {
      await appt(6, { date: "2026-12-31" });
      await appt(7, { date: "2027-01-01" });
      assert.equal((await list("month=2026-12")).total, 1);
      assert.equal((await list("month=2027-01")).total, 1);
    });

    test("the dropdowns: the doctors that have rows (each once) and the months, newest first", async () => {
      const body = await list();
      assert.deepEqual(body.doctors.map((d) => d.name), ["Hidayat Khan", "Martin Perlin"]);
      assert.deepEqual(body.doctors.map((d) => d.id).sort(), [String(enrollment._id), String(enrollment2._id)].sort());
      assert.deepEqual(body.months, ["2026-10", "2026-09"]);
      // a doctor with no rows is not offered
      const quiet = await Doctor.create({ name: "Nobody Yet", email: "q@x.co", password: "SecretPw1!" });
      assert.ok(!(await list()).doctors.some((d) => d.name === quiet.name));
      // the choices follow the include flags, not the current filters
      assert.equal((await list(`doctor=${enrollment._id}&month=2026-09`)).doctors.length, 2);
    });
  });

  describe("totals", () => {
    beforeEach(async () => {
      await appt(1, { consultationPrice: 99, paymentAmount: 9900, entry: { doctorFeeCents: 7425, paidStatus: "paid", paidOn: "2026-10-02" } });
      await appt(2, { consultationPrice: 0, paymentAmount: 500, entry: { doctorFeeCents: 300, paidStatus: "on_hold" } });
      await appt(3, { consultationPrice: 10.5, paymentAmount: 1050 });
      await cat(4, { consultationPrice: 49, paymentAmount: 4900, entry: { doctorFeeCents: 3675, paidStatus: "paid", paidOn: "2026-10-03" } });
    });

    test("fee charged, the SAVED doctor fee only (placeholders never count), and the number of rows", async () => {
      const body = await list();
      assert.deepEqual(usdTotals(body.totals), { rows: 4, feeChargedCents: 9900 + 500 + 1050 + 4900, doctorFeeCents: 7425 + 300 + 3675 });
      assert.equal(body.total, 4);
    });

    test("they cover every row matching the tab and search, not just the page", async () => {
      for (let i = 0; i < 30; i += 1) await appt(5, { consultationPrice: 10, paymentAmount: 1000, entry: { doctorFeeCents: 100 } });
      const body = await list("limit=5");
      assert.equal(body.items.length, 5);
      assert.equal(body.totals.rows, 34);
      assert.equal(body.totals.byCurrency.usd.feeChargedCents, 9900 + 500 + 1050 + 4900 + 30 * 1000);
      assert.equal(body.totals.byCurrency.usd.doctorFeeCents, 7425 + 300 + 3675 + 30 * 100);
      const paid = await list("tab=paid");
      assert.deepEqual(usdTotals(paid.totals), { rows: 2, feeChargedCents: 9900 + 4900, doctorFeeCents: 7425 + 3675 });
    });

    test("they equal the sum of the rows over every page", async () => {
      const everything = await list("limit=100");
      assert.equal(everything.totals.byCurrency.usd.feeChargedCents, everything.items.reduce((sum, r) => sum + r.feeChargedCents, 0));
      assert.equal(everything.totals.byCurrency.usd.doctorFeeCents, everything.items.reduce((sum, r) => sum + (r.entry.doctorFeeCents ?? 0), 0));
    });

    test("they follow the filters", async () => {
      assert.equal((await list("q=zzz")).totals.rows, 0);
      assert.deepEqual(usdTotals((await list("q=zzz")).totals), { rows: 0, feeChargedCents: 0, doctorFeeCents: 0 });
      assert.equal((await list("tab=on_hold")).totals.byCurrency.usd.doctorFeeCents, 300);
      assert.equal((await list("tab=unpaid")).totals.rows, 1);
    });

    test("the fee charged in a total matches the fee in each row, and the Appointments list's rule", async () => {
      const a = await Appointment.findOne({ consultationPrice: 10.5 }).lean();
      const row = (await list("limit=100")).items.find((r) => r.id === String(a._id));
      assert.equal(row.feeChargedCents, 1050);
      assert.equal(row.feeChargedCents, Math.round(feeOf(a) * 100));
    });
  });

  describe("bad requests are 400", () => {
    test("every bad parameter says what is wrong", async () => {
      for (const query of [
        "tab=refunded", "tab=", "sort=newest", "page=0", "page=abc", "page=1001", "page=-1", "page=1.5", "limit=0", "limit=abc", "limit=-5",
        "month=2026-13", "month=2026-1", "month=26-10", "month=1999-12", "month=October", "doctor=abc", "doctor=123", "doctor=zzzzzzzzzzzzzzzzzzzzzzzz",
        "includeCancelled=maybe", "includeTesting=2", "tab=paid&tab=unpaid", "q=a&q=b",
      ]) {
        // "tab=" alone is an empty value: it falls back to All, so it is not an error
        const res = await get(query);
        if (query === "tab=") assert.equal(res.status, 200, query);
        else {
          assert.equal(res.status, 400, query);
          assert.ok(res.body.msg, query);
        }
      }
    });

    test("the parser itself", () => {
      assert.throws(() => parseEntriesQuery({ tab: "x" }), EntryListQueryError);
      const ok = parseEntriesQuery({ tab: "PAID", limit: "1000", includeTesting: "1", month: "2026-10", doctor: String(new mongoose.Types.ObjectId()), q: "  hi  " });
      assert.equal(ok.tab, "paid");
      assert.equal(ok.limit, 100);
      assert.equal(ok.includeTesting, true);
      assert.equal(ok.includeCancelled, false);
      assert.equal(ok.q, "hi");
      assert.equal(ok.sort, "-consultation");
      assert.equal(ok.page, 1);
      assert.equal(parseEntriesQuery({ q: "x".repeat(500) }).q.length, 100);
    });
  });
});
