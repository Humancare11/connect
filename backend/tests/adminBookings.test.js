const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const adminBookings = require("../routes/adminBookings");
const { adminOnly } = require("../middleware/verifyToken");
const { computeCounts, unifiedStatus } = require("../utils/adminBookingList");

describe("admin bookings list", () => {
  let mongod, server, base, patient, doctor, enrollment;

  // Stands in for verifyAdminToken: no header = unauthenticated. The REAL adminOnly runs after it.
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

  const day = (n) => new Date(Date.UTC(2026, 9, n, 10));

  // `bookedAt` is the booking date; category bookings use createdAt.
  const appt = (n, extra = {}) =>
    Appointment.create({ patientId: patient._id, date: "2026-11-01", time: "10:00 AM", bookedAt: day(n), status: "upcoming", ...extra });
  const cat = async (n, extra = {}) => {
    const doc = await CategoryConsultation.create({
      concern: "x", severity: "mild", supportType: "chat", urgency: "flexible", date: "2026-11-02",
      slot: "05:30 PM", patientId: patient._id, categoryName: "Women's Health", ...extra,
    });
    await CategoryConsultation.collection.updateOne({ _id: doc._id }, { $set: { createdAt: day(n) } });
    return doc;
  };

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    const app = express();
    app.use("/api/admin/bookings", adminBookings.create({ guard: [fakeAuth, adminOnly] }));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}/api/admin/bookings`;
  });
  after(async () => {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await Promise.all([Appointment.deleteMany({}), CategoryConsultation.deleteMany({}), User.deleteMany({}), Doctor.deleteMany({}), Enrollment.deleteMany({})]);
    patient = await User.create({ name: "Rachel Secemski", email: "rachel@x.co", password: "SecretPw1!", country: "US" });
    doctor = await Doctor.create({ name: "Martin Perlin", email: "martin@x.co", password: "SecretPw1!" });
    enrollment = await Enrollment.create({ firstName: "Nobita", surname: "Mestry", doctorId: doctor._id, email: "n@x.co" });
  });

  describe("access", () => {
    test("rejects unauthenticated and non-admin callers", async () => {
      assert.equal((await get("", "")).status, 401);
      assert.equal((await get("", "user")).status, 403);
      assert.equal((await get("", "doctor")).status, 403);
      assert.equal((await get("", "superadmin")).status, 200);
    });
  });

  describe("the Upcoming rule for category bookings", () => {
    test("Pending with no doctor is Upcoming; Pending with a doctor stays Pending", () => {
      assert.equal(unifiedStatus("category", "Pending", false), "upcoming");
      assert.equal(unifiedStatus("category", "Pending", true), "pending");
      assert.equal(unifiedStatus("category", "Completed", true), "complete");
      assert.equal(unifiedStatus("appointment", "requested", false), "upcoming");
      assert.equal(unifiedStatus("appointment", "completed", true), "complete");
    });

    test("tabs and rows follow the rule", async () => {
      const noDoctor = await cat(1, { status: "Pending" });
      const withDoctor = await cat(2, { status: "Pending", assignedDoctorId: enrollment._id, assignedDoctorName: "Nobita Mestry" });

      const upcoming = (await get("status=upcoming")).body;
      assert.deepEqual(upcoming.items.map((r) => r.id), [String(noDoctor._id)]);
      assert.equal(upcoming.items[0].status, "upcoming");
      assert.equal(upcoming.items[0].doctorName, null);
      assert.equal(upcoming.items[0].assignedBy, null);

      const pending = (await get("status=pending")).body;
      assert.deepEqual(pending.items.map((r) => r.id), [String(withDoctor._id)]);
      assert.equal(pending.items[0].doctorName, "Nobita Mestry");
      assert.equal(upcoming.counts.upcoming, 1);
      assert.equal(upcoming.counts.pending, 1);
    });
  });

  describe("row shape", () => {
    test("appointment and category rows carry the requested fields", async () => {
      const a = await appt(5, {
        doctorId: doctor._id, status: "assigned", category: "Travel & Global Care", consultationPrice: 99,
        paymentStatus: "paid", originalDoctorName: "Old Doc",
        assignedBy: { id: patient._id, name: "Super Admin", email: "sa@x.co" },
      });
      const c = await cat(4, { status: "Assigned", assignedDoctorId: enrollment._id, consultationPrice: 25, appointmentType: "NEXT_AVAILABLE", urgency: "next", slot: null });

      const { items } = (await get()).body;
      const ar = items.find((r) => r.kind === "appointment");
      assert.deepEqual(ar, {
        kind: "appointment", id: String(a._id), shortId: String(a._id).slice(-8).toUpperCase(),
        patient: { name: "Rachel Secemski", country: "US" }, doctorName: "Martin Perlin", originalDoctorName: "Old Doc",
        category: "Travel & Global Care", bookedAt: day(5).toISOString(),
        consultation: { date: "2026-11-01", time: "10:00 AM", timezone: "" },
        fee: 99, status: "assigned", assignedBy: "Super Admin", isTesting: false, paid: true,
      });

      const cr = items.find((r) => r.kind === "category");
      assert.equal(cr.id, String(c._id));
      assert.equal(cr.doctorName, "Nobita Mestry");
      assert.equal(cr.category, "Women's Health");
      assert.equal(cr.fee, 25);
      assert.equal(cr.paid, false);
      // Next available with no assigned time yet: "Not scheduled".
      assert.equal(cr.consultation, null);
    });

    test("a flexible category booking shows its chosen slot", async () => {
      await cat(1);
      assert.deepEqual((await get()).body.items[0].consultation, { date: "2026-11-02", time: "05:30 PM", timezone: "" });
    });

    test("assignedBy is null until a doctor is assigned", async () => {
      await appt(1, { assignedBy: { name: "Stale" } });
      assert.equal((await get()).body.items[0].assignedBy, null);
    });
  });

  describe("sorting", () => {
    test("newest booking first across both collections, oldest first with sort=bookedAt", async () => {
      const a1 = await appt(1);
      const c2 = await cat(2);
      const a3 = await appt(3);
      const ids = [a3, c2, a1].map((d) => String(d._id));
      assert.deepEqual((await get()).body.items.map((r) => r.id), ids);
      assert.deepEqual((await get("sort=bookedAt")).body.items.map((r) => r.id), [...ids].reverse());
    });

    test("rejects an unknown sort", async () => {
      assert.equal((await get("sort=fee")).status, 400);
    });
  });

  describe("testing: hideTesting on and off, and documents without the field", () => {
    let plain, testingAppt, testingCat, legacy;
    beforeEach(async () => {
      plain = await appt(1);
      testingAppt = await appt(2, { isTesting: true });
      testingCat = await cat(3, { isTesting: true, status: "Completed" });
      legacy = await cat(4);
      // A document from before the field existed has no isTesting key at all.
      await CategoryConsultation.collection.updateOne({ _id: legacy._id }, { $unset: { isTesting: 1 } });
      await Appointment.collection.updateOne({ _id: plain._id }, { $unset: { isTesting: 1 } });
    });

    test("hideTesting off lists everything", async () => {
      const { body } = await get();
      assert.equal(body.total, 4);
      assert.equal(body.counts.all, 4);
    });

    test("hideTesting on drops testing bookings and keeps ones with no isTesting field", async () => {
      const { body } = await get("hideTesting=true");
      assert.deepEqual(new Set(body.items.map((r) => r.id)), new Set([String(plain._id), String(legacy._id)]));
      assert.equal(body.counts.all, 2);
      assert.equal(body.items.every((r) => r.isTesting === false), true);
    });

    test("the Testing tab lists testing bookings of any status, even when hideTesting is on", async () => {
      for (const hide of ["false", "true"]) {
        const { body } = await get(`status=testing&hideTesting=${hide}`);
        assert.deepEqual(new Set(body.items.map((r) => r.id)), new Set([String(testingAppt._id), String(testingCat._id)]));
        assert.equal(body.items.every((r) => r.isTesting === true), true);
        assert.equal(body.counts.testing, 2);
      }
    });

    test("status tabs also honor hideTesting", async () => {
      assert.equal((await get("status=complete")).body.total, 1);
      assert.equal((await get("status=complete&hideTesting=true")).body.total, 0);
    });
  });

  describe("counts", () => {
    test("computeCounts: tabs skip testing when hidden, the Testing count never does", () => {
      const groups = [
        { kind: "appointment", status: "upcoming", hasDoctor: true, testing: false, n: 3 },
        { kind: "appointment", status: "requested", hasDoctor: true, testing: true, n: 1 },
        { kind: "category", status: "Pending", hasDoctor: false, testing: false, n: 2 },
        { kind: "category", status: "Pending", hasDoctor: true, testing: true, n: 4 },
        { kind: "category", status: "Completed", hasDoctor: true, testing: false, n: 5 },
      ];
      assert.deepEqual(computeCounts(groups, false), {
        all: 15, upcoming: 6, assigned: 0, pending: 4, confirmed: 0, complete: 5, cancelled: 0, testing: 5,
      });
      assert.deepEqual(computeCounts(groups, true), {
        all: 10, upcoming: 5, assigned: 0, pending: 0, confirmed: 0, complete: 5, cancelled: 0, testing: 5,
      });
    });

    test("counts come from the server across both collections and ignore the search text and page", async () => {
      await appt(1, { status: "confirmed" });
      await appt(2, { status: "requested" });
      await appt(3, { status: "completed" });
      await cat(4, { status: "Pending" });
      await cat(5, { status: "Cancelled" });
      await cat(6, { status: "Confirmed", assignedDoctorId: enrollment._id, isTesting: true });

      const expected = { all: 6, upcoming: 2, assigned: 0, pending: 0, confirmed: 2, complete: 1, cancelled: 1, testing: 1 };
      assert.deepEqual((await get()).body.counts, expected);
      assert.deepEqual((await get("status=confirmed&q=zzzz-no-match&page=3&limit=1")).body.counts, expected);
      assert.deepEqual((await get("hideTesting=true")).body.counts, { ...expected, all: 5, confirmed: 1 });
    });
  });

  describe("pagination", () => {
    beforeEach(async () => {
      for (let n = 1; n <= 30; n++) await (n % 2 ? appt(n) : cat(n));
    });

    test("defaults to 25 per page, newest first, and reports totals", async () => {
      const { body } = await get();
      assert.equal(body.limit, 25);
      assert.equal(body.items.length, 25);
      assert.equal(body.total, 30);
      assert.equal(body.totalPages, 2);
      assert.equal(body.items[0].bookedAt, day(30).toISOString());
    });

    test("pages do not overlap and cover every booking once", async () => {
      const p1 = (await get("page=1&limit=7")).body;
      const p5 = (await get("page=5&limit=7")).body;
      assert.equal(p1.items.length, 7);
      assert.equal(p5.items.length, 2);
      const seen = new Set();
      for (let page = 1; page <= 5; page++) (await get(`page=${page}&limit=7`)).body.items.forEach((r) => seen.add(r.id));
      assert.equal(seen.size, 30);
      assert.equal((await get("page=6&limit=7")).body.items.length, 0);
    });

    test("limit is capped at 100", async () => {
      assert.equal((await get("limit=500")).body.limit, 100);
    });

    test("rejects bad status, page and limit values", async () => {
      for (const q of ["status=nope", "page=0", "page=abc", "page=-1", "page=1001", "limit=0", "limit=x", "limit=1.5", "hideTesting=maybe"]) {
        assert.equal((await get(q)).status, 400, q);
      }
    });
  });

  describe("search", () => {
    test("matches patient, doctor, category and booking id, and narrows rows only", async () => {
      const other = await User.create({ name: "Someone Else", email: "else@x.co", password: "SecretPw1!" });
      const a = await appt(1, { doctorId: doctor._id, category: "Mental Wellbeing" });
      const c = await cat(2, { patientId: other._id, status: "Assigned", assignedDoctorId: enrollment._id });

      const ids = async (q) => (await get(`q=${encodeURIComponent(q)}`)).body.items.map((r) => r.id);
      assert.deepEqual(await ids("Rachel"), [String(a._id)]);
      assert.deepEqual(await ids("martin"), [String(a._id)]);
      assert.deepEqual(await ids("wellbeing"), [String(a._id)]);
      assert.deepEqual(await ids("else@x.co"), [String(c._id)]);
      assert.deepEqual(await ids("nobita"), [String(c._id)]);
      assert.deepEqual(await ids(String(c._id).slice(-8)), [String(c._id)]);
      assert.deepEqual(await ids("no such text"), []);
      // Regex characters in the search text are matched literally.
      assert.deepEqual(await ids(".*"), []);
      assert.equal((await get("q=Rachel")).body.counts.all, 2);
    });
  });
  describe("search input is escaped and capped", () => {
    test("regex-looking input is matched literally and cannot break or slow the query", async () => {
      const a = await appt(1, { category: "Plain category" });
      const tricky = await appt(2, { category: "weird [ category (a+)+$ .* text" });

      for (const q of [".*(a+)+$", "[", "(", "\\", "a{1,", "(?<x>", "+*?", "$^|"]) {
        const started = Date.now();
        const res = await get(`q=${encodeURIComponent(q)}`);
        assert.equal(res.status, 200, q);
        assert.ok(Date.now() - started < 2000, `${q} was slow`);
        // Never treated as a pattern: ".*" must not match everything.
        assert.equal(res.body.items.some((r) => r.id === String(a._id)), false, q);
      }
      assert.deepEqual((await get(`q=${encodeURIComponent("[ category")}`)).body.items.map((r) => r.id), [String(tricky._id)]);
      assert.deepEqual((await get(`q=${encodeURIComponent("(a+)+$ .*")}`)).body.items.map((r) => r.id), [String(tricky._id)]);
    });

    test("a catastrophic-backtracking pattern against a long value returns quickly", async () => {
      await appt(1, { category: "a".repeat(5000) + "!" });
      const started = Date.now();
      const res = await get(`q=${encodeURIComponent("(a+)+$")}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.items.length, 0);
      assert.ok(Date.now() - started < 2000);
    });

    test("search text is cut to 100 characters", async () => {
      const b = await appt(1, { category: "x".repeat(100) });
      assert.deepEqual((await get(`q=${"x".repeat(150)}`)).body.items.map((r) => r.id), [String(b._id)]);
      assert.equal((await get(`q=${"y".repeat(5000)}`)).status, 200);
    });
  });
});
