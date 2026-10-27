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

// 2026-10-26 22:00 UTC is already 2026-10-27 in India: the "today" a Paid edit fills in must be the Indian date.
const NOW = Date.UTC(2026, 9, 26, 22, 0);
const TODAY = "2026-10-27";

describe("appointment entries: editing a row (PATCH /:kind/:id)", () => {
  let mongod, server, base, patient, doctor, doctor2, enrollment, adminUser;

  const fakeAuth = (req, res, next) => {
    const role = req.headers["x-test-role"];
    if (!role) return res.status(401).json({ msg: "No token provided." });
    req.user = { id: String(adminUser._id), role };
    next();
  };
  const patch = async (kind, id, body, role = "admin") => {
    const res = await fetch(`${base}/${kind}/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", ...(role ? { "x-test-role": role } : {}) },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
  const appt = (extra = {}) =>
    Appointment.create({
      patientId: patient._id, doctorId: doctor._id, date: "2026-11-01", time: "10:00 AM", status: "confirmed",
      paymentStatus: "paid", paymentAmount: 9900, consultationPrice: 99, ...extra,
    });
  const cat = (extra = {}) =>
    CategoryConsultation.create({
      concern: "x", severity: "mild", supportType: "chat", urgency: "flexible", date: "2026-11-02", slot: "05:30 PM",
      patientId: patient._id, categoryName: "Women's Health", status: "Confirmed", paymentStatus: "paid", paymentAmount: 4900, consultationPrice: 49,
      assignedDoctorId: enrollment._id, ...extra,
    });
  const manual = async (entry = {}, extra = {}) => {
    const v = M.validateManualCreate({ patientName: "Ravi Sharma", country: "IN", date: "2026-10-30", serviceProvider: "Martin Perlin", consultationFee: "49" }, { today: TODAY });
    const built = M.buildManualDocument(v.value, { actor: { id: adminUser._id, name: "An Admin", role: "admin" }, code: M.newCode(), today: TODAY });
    return ManualEntry.create({ ...built.doc, ...extra, entry: { ...built.doc.entry, ...entry } });
  };
  const fee = (id, value, version = 0, kind = "appointment") => patch(kind, id, { field: "doctorFee", value, version });

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
    enrollment = await Enrollment.create({ firstName: "Martin", surname: "Perlin", doctorId: doctor._id, email: "n@x.co" });
  });

  describe("access", () => {
    test("no token is 401; the payment admin and other roles are 403; admin and super admin may edit", async () => {
      const a = await appt();
      assert.equal((await patch("appointment", a._id, { field: "doctorFee", value: "10", version: 0 }, "")).status, 401);
      for (const role of ["paymentadmin", "user", "doctor", "employeeadmin", "partner"]) {
        assert.equal((await patch("appointment", a._id, { field: "doctorFee", value: "10", version: 0 }, role)).status, 403, role);
      }
      assert.equal((await Appointment.findById(a._id).lean()).entry?.doctorFeeCents ?? null, null);
      assert.equal((await patch("appointment", a._id, { field: "doctorFee", value: "10", version: 0 }, "admin")).status, 200);
      assert.equal((await patch("appointment", a._id, { field: "doctorFee", value: "11", version: 1 }, "superadmin")).status, 200);
    });
  });

  describe("a booking row", () => {
    test("typing a doctor fee saves it, bumps the version, records who and when, and returns the row", async () => {
      const a = await appt();
      const { status, body } = await fee(a._id, "74.25");
      assert.equal(status, 200);
      assert.equal(body.noop, false);
      assert.equal(body.item.id, String(a._id));
      assert.deepEqual([body.item.entry.doctorFeeCents, body.item.entry.version, body.item.placeholder], [7425, 1, null]);
      assert.equal(body.item.entry.edits.doctorFee.by, "An Admin");
      const stored = (await Appointment.findById(a._id).lean()).entry;
      assert.deepEqual(stored.history.map((h) => [h.field, h.from, h.to, h.by.role]), [["doctorFee", "", "74.25", "admin"]]);
      assert.equal(stored.doctorAtEntry, String(doctor._id));
    });

    test("a payout edit does not change the booking's updatedAt or any other field", async () => {
      const a = await appt({ source: { platform: "web", sourceType: "home" } });
      const before = await Appointment.findById(a._id).lean();
      await new Promise((r) => setTimeout(r, 15));
      await fee(a._id, "10");
      const after = await Appointment.findById(a._id).lean();
      assert.equal(String(after.updatedAt), String(before.updatedAt));
      assert.deepEqual([after.status, after.paymentAmount, after.source.platform, String(after.doctorId)], [before.status, before.paymentAmount, "web", String(doctor._id)]);
    });

    test("Paid needs a fee and a doctor, then fills today's date (the Indian date, even late in the UTC day)", async () => {
      const a = await appt();
      const noFee = await patch("appointment", a._id, { field: "paidStatus", value: "paid", version: 0 });
      assert.deepEqual([noFee.status, noFee.body.code], [409, "fee_required"]);
      await fee(a._id, "50");
      const paid = await patch("appointment", a._id, { field: "paidStatus", value: "paid", version: 1 });
      assert.equal(paid.status, 200);
      assert.deepEqual([paid.body.item.entry.paidStatus, paid.body.item.entry.paidOn, paid.body.item.entry.version], ["paid", TODAY, 2]);
      const none = await appt({ doctorId: null });
      await fee(none._id, "50");
      const noDoctor = await patch("appointment", none._id, { field: "paidStatus", value: "paid", version: 1 });
      assert.deepEqual([noDoctor.status, noDoctor.body.code], [409, "doctor_required"]);
    });

    test("the comment and the paid-on date save; empty clears the fee; bad input is a 400 and changes nothing", async () => {
      const a = await appt();
      assert.equal((await patch("appointment", a._id, { field: "comment", value: "  sent by bank  ", version: 0 })).body.item.entry.comment, "sent by bank");
      assert.equal((await patch("appointment", a._id, { field: "paidOn", value: "2026-10-20", version: 1 })).body.item.entry.paidOn, "2026-10-20");
      assert.equal((await fee(a._id, "5", 2)).status, 200);
      assert.equal((await fee(a._id, "", 3)).body.item.entry.doctorFeeCents, null);
      for (const [body, code] of [
        [{ field: "doctorFee", value: "-1", version: 4 }, "invalid_fee"],
        [{ field: "doctorFee", value: "1.234", version: 4 }, "invalid_fee"],
        [{ field: "paidOn", value: "2026-02-30", version: 4 }, "invalid_date"],
        [{ field: "paidStatus", value: "maybe", version: 4 }, "invalid_status"],
        [{ field: "nope", value: "x", version: 4 }, "bad_field"],
        [{ field: "comment", value: "x".repeat(501), version: 4 }, "comment_too_long"],
      ]) {
        const r = await patch("appointment", a._id, body);
        assert.deepEqual([r.status, r.body.code], [400, code], JSON.stringify(body));
      }
      assert.equal((await Appointment.findById(a._id).lean()).entry.v, 4);
    });

    test("a missing or bad version is a 400", async () => {
      const a = await appt();
      for (const version of [undefined, -1, 1.5, "0", null]) {
        const r = await patch("appointment", a._id, { field: "comment", value: "x", version });
        assert.deepEqual([r.status, r.body.code], [400, "bad_version"], String(version));
      }
    });

    test("saving a value that is already saved is a no-op: 200, the version does not move", async () => {
      const a = await appt();
      await fee(a._id, "10");
      const again = await fee(a._id, "10.00", 1);
      assert.deepEqual([again.status, again.body.noop, again.body.item.entry.version], [200, true, 1]);
      assert.equal((await Appointment.findById(a._id).lean()).entry.history.length, 1);
    });

    test("a stale version is a 409 that returns the current row, and nothing is overwritten", async () => {
      const a = await appt();
      await fee(a._id, "10");
      const stale = await fee(a._id, "99", 0);
      assert.deepEqual([stale.status, stale.body.code, stale.body.item.entry.doctorFeeCents, stale.body.item.entry.version], [409, "stale", 1000, 1]);
      assert.equal((await Appointment.findById(a._id).lean()).entry.doctorFeeCents, 1000);
    });

    test("two saves with the same version at the same time: exactly one wins", async () => {
      const a = await appt();
      const results = await Promise.all([fee(a._id, "10"), fee(a._id, "20"), fee(a._id, "30")]);
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 409, 409]);
      const stored = (await Appointment.findById(a._id).lean()).entry;
      assert.equal(stored.v, 1);
      assert.equal(stored.history.length, 1);
    });

    test("only the last 50 history lines are kept", async () => {
      const a = await appt();
      for (let i = 0; i < 53; i += 1) await patch("appointment", a._id, { field: "comment", value: `note ${i}`, version: i });
      const stored = (await Appointment.findById(a._id).lean()).entry;
      assert.equal(stored.history.length, 50);
      assert.equal(stored.history.at(-1).to, "note 52");
      assert.equal(stored.v, 53);
    });

    test("after the doctor changes, the row is flagged ⚠ Doctor changed", async () => {
      const a = await appt();
      await fee(a._id, "10");
      await Appointment.updateOne({ _id: a._id }, { $set: { doctorId: doctor2._id } });
      const r = await patch("appointment", a._id, { field: "comment", value: "x", version: 1 });
      assert.equal(r.body.item.doctorChanged, true);
    });

    test("an unknown row, a bad id and an unknown kind are 404", async () => {
      assert.equal((await fee(new mongoose.Types.ObjectId(), "1")).status, 404);
      assert.equal((await fee("not-an-id", "1")).status, 404);
      assert.equal((await patch("invoice", new mongoose.Types.ObjectId(), { field: "comment", value: "x", version: 0 })).status, 404);
    });
  });

  describe("a category consultation row", () => {
    test("a paid one saves like an appointment, against the Enrollment id", async () => {
      const c = await cat();
      const r = await fee(c._id, "30", 0, "category");
      assert.equal(r.status, 200);
      assert.deepEqual([r.body.item.kind, r.body.item.entry.doctorFeeCents], ["category", 3000]);
      assert.equal((await CategoryConsultation.findById(c._id).lean()).entry.doctorAtEntry, String(enrollment._id));
    });

    test("an unpaid one is not a row of the page, so it cannot be edited (404)", async () => {
      const c = await cat({ paymentStatus: "unpaid", paymentAmount: 0 });
      assert.equal((await fee(c._id, "30", 0, "category")).status, 404);
      assert.equal((await CategoryConsultation.findById(c._id).lean()).entry?.doctorFeeCents ?? null, null);
    });

    test("the kind must match the collection: an appointment id under category is 404", async () => {
      const a = await appt();
      assert.equal((await fee(a._id, "30", 0, "category")).status, 404);
    });
  });

  describe("a manual row", () => {
    test("the same four fields save, with the same rules (Paid needs a doctor and a fee)", async () => {
      const m = await manual();
      const noFee = await patch("manual", m._id, { field: "paidStatus", value: "paid", version: 0 });
      assert.deepEqual([noFee.status, noFee.body.code], [409, "fee_required"]);
      const saved = await fee(m._id, "36.75", 0, "manual");
      assert.deepEqual([saved.status, saved.body.item.kind, saved.body.item.shortId.startsWith("M-"), saved.body.item.entry.doctorFeeCents], [200, "manual", true, 3675]);
      const paid = await patch("manual", m._id, { field: "paidStatus", value: "paid", version: 1 });
      assert.deepEqual([paid.status, paid.body.item.entry.paidOn, paid.body.item.manual.locked], [200, TODAY, true]);
      const doc = await ManualEntry.findById(m._id).lean();
      assert.deepEqual(doc.entry.history.map((h) => h.field), ["doctorFee", "paidOn", "paidStatus"]);
    });

    test("a manual row with no doctor cannot be marked Paid", async () => {
      const m = await manual({}, { doctorEnrollmentId: null, doctorName: "" });
      await fee(m._id, "10", 0, "manual");
      const r = await patch("manual", m._id, { field: "paidStatus", value: "paid", version: 1 });
      assert.deepEqual([r.status, r.body.code], [409, "doctor_required"]);
    });

    test("a deleted manual row is gone: 404", async () => {
      const m = await manual();
      await ManualEntry.updateOne({ _id: m._id }, { $set: { deletedAt: new Date() } });
      assert.equal((await fee(m._id, "10", 0, "manual")).status, 404);
    });

    test("a stale version is a 409 with the current row", async () => {
      const m = await manual();
      await fee(m._id, "10", 0, "manual");
      const stale = await fee(m._id, "20", 0, "manual");
      assert.deepEqual([stale.status, stale.body.code, stale.body.item.entry.doctorFeeCents], [409, "stale", 1000]);
    });
  });
});
