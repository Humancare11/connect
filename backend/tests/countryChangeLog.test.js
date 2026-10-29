const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

// Header-driven fake login, installed before the routes load.
const verifyToken = require("../middleware/verifyToken");
verifyToken.verifyAdminToken = (req, res, next) => {
  const role = req.headers["x-test-role"];
  if (!role) return res.status(401).json({ msg: "No token provided." });
  req.user = { id: req.headers["x-test-user"] || String(new mongoose.Types.ObjectId()), role };
  next();
};

const User = require("../models/User");
const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");
const CountryChangeLog = require("../models/CountryChangeLog");
const { recordCountryChange, usersNeedingCountryReview } = require("../utils/countryChangeLog");
const { updateProfile } = require("../controllers/authController");
const { getAllUsers } = require("../controllers/adminController");
const adminCountryChanges = require("../routes/adminCountryChanges");

describe("country change log", () => {
  let mongod, server, base;
  let n = 0;

  const mkUser = (country = "India") =>
    User.create({ name: "Pat", email: `pat${(n += 1)}@x.co`, role: "user", country, state: "", city: "" });

  const paidAppointment = (user) =>
    Appointment.create({ patientId: user._id, date: "2026-11-01", time: "10:00 AM", paymentStatus: "paid", paymentAmount: 1000 });
  const paidConsultation = (user) =>
    CategoryConsultation.create({
      concern: "x", severity: "mild", supportType: "chat", urgency: "flexible", appointmentType: "FLEXIBLE_TIME",
      date: "2026-11-01", slot: "10:00 AM", patientId: user._id, categoryName: "Women's Health", paymentStatus: "paid",
    });

  // Calls the real updateProfile controller.
  const saveProfile = async (user, body) => {
    const out = {};
    const res = {
      status(code) { out.status = code; return this; },
      json(payload) { out.body = payload; return this; },
    };
    await updateProfile({ user: { id: String(user._id), role: "user" }, body: { name: "Pat", email: user.email, ...body }, headers: {}, ip: "8.8.8.8", socket: {} }, res);
    return { status: out.status || 200, body: out.body };
  };

  const call = async (method, path, { role = "admin", userId } = {}) => {
    const res = await fetch(`${base}/api/admin/country-changes${path}`, {
      method,
      headers: { "content-type": "application/json", ...(role ? { "x-test-role": role } : {}), ...(userId ? { "x-test-user": userId } : {}) },
    });
    return { status: res.status, body: await res.json() };
  };

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    const app = express();
    app.use(express.json());
    app.use("/api/admin/country-changes", adminCountryChanges);
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Appointment.deleteMany({}), CategoryConsultation.deleteMany({}), CountryChangeLog.deleteMany({})]);
  });

  describe("updateProfile", () => {
    test("changing the country writes a log row (old, new, user, time, ip) and does not flag a user with no paid booking", async () => {
      const user = await mkUser("India");
      const r = await saveProfile(user, { country: "Germany" });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal((await User.findById(user._id)).country, "Germany");

      const rows = await CountryChangeLog.find({}).lean();
      assert.equal(rows.length, 1);
      assert.equal(String(rows[0].user), String(user._id));
      assert.equal(rows[0].oldCountry, "India");
      assert.equal(rows[0].newCountry, "Germany");
      assert.equal(rows[0].changedBy, "self");
      assert.equal(rows[0].ip, "8.8.8.8");
      assert.equal(rows[0].hadPaidBooking, false);
      assert.equal(rows[0].needsReview, false);
      assert.ok(rows[0].changedAt instanceof Date);
    });

    test("a user with a paid appointment is flagged for review", async () => {
      const user = await mkUser("India");
      await paidAppointment(user);
      await saveProfile(user, { country: "France" });
      const row = await CountryChangeLog.findOne({}).lean();
      assert.equal(row.hadPaidBooking, true);
      assert.equal(row.needsReview, true);
    });

    test("a user with a paid category consultation is flagged too", async () => {
      const user = await mkUser("India");
      await paidConsultation(user);
      await saveProfile(user, { country: "United Kingdom" });
      assert.equal((await CountryChangeLog.findOne({}).lean()).needsReview, true);
    });

    test("an unpaid booking does not flag", async () => {
      const user = await mkUser("India");
      await Appointment.create({ patientId: user._id, date: "2026-11-01", time: "10:00 AM", paymentStatus: "unpaid" });
      await saveProfile(user, { country: "France" });
      assert.equal((await CountryChangeLog.findOne({}).lean()).needsReview, false);
    });

    test("another user's paid booking does not flag this user", async () => {
      const user = await mkUser("India");
      const other = await mkUser("India");
      await paidAppointment(other);
      await saveProfile(user, { country: "France" });
      assert.equal((await CountryChangeLog.findOne({}).lean()).needsReview, false);
    });

    test("saving the profile without changing the country logs nothing", async () => {
      const user = await mkUser("India");
      await saveProfile(user, { country: "India" });
      await saveProfile(user, {});
      assert.equal(await CountryChangeLog.countDocuments({}), 0);
    });

    test("an invalid country is rejected and logs nothing", async () => {
      const user = await mkUser("India");
      const r = await saveProfile(user, { country: "Atlantis" });
      assert.equal(r.status, 400);
      assert.equal((await User.findById(user._id)).country, "India");
      assert.equal(await CountryChangeLog.countDocuments({}), 0);
    });

    test("every change is logged, in order", async () => {
      const user = await mkUser("India");
      await saveProfile(user, { country: "Germany" });
      await saveProfile(user, { country: "United Kingdom" });
      const rows = await CountryChangeLog.find({}).sort({ changedAt: 1, _id: 1 }).lean();
      assert.deepEqual(rows.map((x) => [x.oldCountry, x.newCountry]), [["India", "Germany"], ["Germany", "United Kingdom"]]);
    });

    test("a logging failure never blocks the profile save", async () => {
      const user = await mkUser("India");
      const realCreate = CountryChangeLog.create;
      const realError = console.error;
      const errors = [];
      CountryChangeLog.create = async () => { throw new Error("db down"); };
      console.error = (...a) => errors.push(a.join(" "));
      try {
        const r = await saveProfile(user, { country: "Germany" });
        assert.equal(r.status, 200);
        assert.equal((await User.findById(user._id)).country, "Germany");
      } finally {
        CountryChangeLog.create = realCreate;
        console.error = realError;
      }
      assert.ok(errors.some((e) => e.includes("COUNTRY_CHANGE_LOG_FAILED")));
    });
  });

  describe("recordCountryChange / usersNeedingCountryReview", () => {
    test("no row when old and new are the same", async () => {
      const user = await mkUser("India");
      assert.equal(await recordCountryChange({ userId: user._id, oldCountry: "India", newCountry: " India " }), null);
      assert.equal(await CountryChangeLog.countDocuments({}), 0);
    });

    test("the flagged set contains only users with an unreviewed flagged change", async () => {
      const a = await mkUser(); const b = await mkUser(); const c = await mkUser();
      await paidAppointment(a); await paidAppointment(b);
      await recordCountryChange({ userId: a._id, oldCountry: "India", newCountry: "France" });
      const reviewed = await recordCountryChange({ userId: b._id, oldCountry: "India", newCountry: "France" });
      await CountryChangeLog.updateOne({ _id: reviewed._id }, { needsReview: false });
      await recordCountryChange({ userId: c._id, oldCountry: "India", newCountry: "France" });

      const flagged = await usersNeedingCountryReview([a._id, b._id, c._id, "not-an-id"]);
      assert.deepEqual([...flagged], [String(a._id)]);
      assert.equal((await usersNeedingCountryReview([])).size, 0);
    });
  });

  describe("Manage Users list", () => {
    test("each user carries countryChangeNeedsReview, true only for an unreviewed change after a paid booking", async () => {
      const flagged = await mkUser(); const plain = await mkUser();
      await paidAppointment(flagged);
      await recordCountryChange({ userId: flagged._id, oldCountry: "India", newCountry: "France" });
      await recordCountryChange({ userId: plain._id, oldCountry: "India", newCountry: "France" });

      let body;
      await getAllUsers({ originalUrl: "/api/admin/users", headers: {} }, { status() { return this; }, json(p) { body = p; return this; } });
      const byId = Object.fromEntries(body.map((u) => [String(u._id), u.countryChangeNeedsReview]));
      assert.equal(byId[String(flagged._id)], true);
      assert.equal(byId[String(plain._id)], false);

      await CountryChangeLog.updateMany({}, { needsReview: false });
      await getAllUsers({ originalUrl: "/api/admin/users", headers: {} }, { status() { return this; }, json(p) { body = p; return this; } });
      assert.ok(body.every((u) => u.countryChangeNeedsReview === false));
    });
  });

  describe("admin endpoints", () => {
    const seed = async () => {
      const flagged = await mkUser(); const plain = await mkUser();
      await paidAppointment(flagged);
      const f = await recordCountryChange({ userId: flagged._id, oldCountry: "India", newCountry: "France" });
      const p = await recordCountryChange({ userId: plain._id, oldCountry: "India", newCountry: "Spain" });
      return { flagged, plain, f, p };
    };

    test("lists all changes newest first, with the user populated", async () => {
      await seed();
      const r = await call("GET", "");
      assert.equal(r.status, 200);
      assert.equal(r.body.total, 2);
      assert.equal(r.body.rows[0].newCountry, "Spain");
      assert.ok(r.body.rows[0].user.email);
    });

    test("needsReview=true shows only the flagged ones; user= filters by user", async () => {
      const { flagged } = await seed();
      const only = await call("GET", "?needsReview=true");
      assert.equal(only.body.total, 1);
      assert.equal(only.body.rows[0].newCountry, "France");
      const byUser = await call("GET", `?user=${flagged._id}`);
      assert.equal(byUser.body.total, 1);
      assert.equal((await call("GET", "?user=nope")).status, 400);
    });

    test("pagination is capped and page-aware", async () => {
      await seed();
      const r = await call("GET", "?limit=1&page=2");
      assert.equal(r.body.rows.length, 1);
      assert.equal(r.body.totalPages, 2);
      assert.equal((await call("GET", "?limit=9999")).body.limit, 100);
    });

    test("summary counts the unreviewed flagged changes", async () => {
      await seed();
      assert.deepEqual((await call("GET", "/summary")).body, { needsReviewCount: 1 });
    });

    test("review marks a change reviewed (who and when) and is idempotent", async () => {
      const { f } = await seed();
      const reviewer = String(new mongoose.Types.ObjectId());
      const first = await call("PATCH", `/${f._id}/review`, { userId: reviewer });
      assert.equal(first.status, 200);
      assert.equal(first.body.row.needsReview, false);
      assert.equal(String(first.body.row.reviewedBy), reviewer);
      assert.ok(first.body.row.reviewedAt);

      const again = await call("PATCH", `/${f._id}/review`, { userId: String(new mongoose.Types.ObjectId()) });
      assert.equal(again.status, 200);
      assert.equal(String(again.body.row.reviewedBy), reviewer); // unchanged
      assert.deepEqual((await call("GET", "/summary")).body, { needsReviewCount: 0 });
    });

    test("review: unknown id is 404, malformed id is 400", async () => {
      assert.equal((await call("PATCH", `/${new mongoose.Types.ObjectId()}/review`)).status, 404);
      assert.equal((await call("PATCH", "/zzz/review")).status, 400);
    });

    test("admins and super admins only", async () => {
      assert.equal((await call("GET", "", { role: "superadmin" })).status, 200);
      assert.equal((await call("GET", "", { role: "user" })).status, 403);
      assert.equal((await call("GET", "", { role: "doctor" })).status, 403);
      assert.equal((await call("GET", "", { role: null })).status, 401);
      assert.equal((await call("PATCH", `/${new mongoose.Types.ObjectId()}/review`, { role: "user" })).status, 403);
    });
  });
});
