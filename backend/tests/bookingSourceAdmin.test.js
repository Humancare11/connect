// Step 5 of "booking source": the admin Appointments list carries each booking's source, filters by it, counts by it and
// searches it; the Appointment entries rows carry the same fields and the CSV columns.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");
const User = require("../models/User");
const adminBookings = require("../routes/adminBookings");
const { adminOnly } = require("../middleware/verifyToken");
const { listBookingEntries } = require("../utils/bookingEntryList");
const S = require("../utils/bookingSource");

describe("booking source in the admin lists", () => {
  let mongod, server, base, patient;
  const ids = {};

  const fakeAuth = (req, res, next) => {
    req.user = { id: "admin1", role: "admin" };
    next();
  };
  const get = async (query = "") => {
    const res = await fetch(`${base}${query ? `?${query}` : ""}`);
    return { status: res.status, body: await res.json() };
  };
  const day = (n) => new Date(Date.UTC(2026, 9, n, 10));

  const appt = (name, n, source, extra = {}) =>
    Appointment.create({
      patientId: patient._id, date: "2026-11-01", time: "10:00 AM", bookedAt: day(n), status: "upcoming", category: "General Care",
      paymentStatus: "paid", paymentAmount: 5000, consultationPrice: 50, ...(source ? { source } : {}), ...extra,
    }).then((d) => { ids[name] = String(d._id); return d; });
  const cat = async (name, n, source, extra = {}) => {
    const doc = await CategoryConsultation.create({
      concern: "x", severity: "mild", supportType: "chat", urgency: "flexible", date: "2026-11-02", slot: "05:30 PM",
      patientId: patient._id, categoryName: "Women's Health", paymentStatus: "paid", paymentAmount: 5000, ...(source ? { source } : {}), ...extra,
    });
    await CategoryConsultation.collection.updateOne({ _id: doc._id }, { $set: { createdAt: day(n) } });
    ids[name] = String(doc._id);
    return doc;
  };
  const idsOf = (body) => body.items.map((i) => i.id);

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    const app = express();
    app.use("/api/admin/bookings", adminBookings.create({ guard: [fakeAuth, adminOnly] }));
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${server.address().port}/api/admin/bookings`;
    patient = await User.create({ name: "Test Patient", email: "p@test.dev", password: "Placeholder1!", role: "user", country: "IN" });

    await appt("web", 1, { platform: "web", sourceType: "header", sourceName: "Book Appointment", clickedOnType: "service", clickedOnName: "Fit to fly", pagePath: "/fit-to-fly-certificate" });
    await appt("webCondition", 2, { platform: "web", sourceType: "condition", sourceName: "Fever" });
    await appt("android", 3, { platform: "android", appVersion: "1.0.0+16", sourceType: "service", sourceName: "Online Prescription Refills" });
    await appt("ios", 4, { platform: "ios", appVersion: "1.0.0+16" });
    await appt("flutter", 5, { platform: "app", sourceType: "home", sourceName: "Book appointment card" });
    await appt("old", 6, null, { status: "complete" });
    await appt("emptySource", 7, { platform: "", sourceType: "" });
    await appt("doctor", 8, { platform: "web", sourceType: "doctor_profile", sourceName: "Martin Perlin" });
    await appt("hostile", 9, { platform: "web", sourceType: "page", sourceName: "=HYPERLINK(\"http://evil\")" });
    await cat("catWeb", 10, { platform: "web", sourceType: "footer", sourceName: "Book Appointment", clickedOnType: "blog", clickedOnName: "Travelling with asthma" });
    await cat("catOld", 11, null);
    await cat("catAndroid", 12, { platform: "android", appVersion: "2.4.1+30", sourceType: "category", sourceName: "Mental Health" });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongod.stop();
  });

  describe("row fields", () => {
    test("a website booking from a header button", async () => {
      const row = (await get()).body.items.find((i) => i.id === ids.web);
      assert.equal(row.sourceGroup, "Web");
      assert.equal(row.sourceDetail, "Website");
      assert.deepEqual(row.sourcePage, { type: "Header", name: "Book Appointment", clickedOn: "Service: Fit to fly" });
    });

    test("android, ios and app all read as App, with the exact platform and version as the tooltip", async () => {
      const items = (await get()).body.items;
      const by = (name) => items.find((i) => i.id === ids[name]);
      assert.equal(by("android").sourceGroup, "App");
      assert.equal(by("android").sourceDetail, "Android · v1.0.0+16");
      assert.equal(by("ios").sourceGroup, "App");
      assert.equal(by("ios").sourceDetail, "iOS · v1.0.0+16");
      assert.equal(by("flutter").sourceGroup, "App");
      assert.equal(by("flutter").sourceDetail, "App");
      assert.deepEqual(by("android").sourcePage, { type: "Service", name: "Online Prescription Refills", clickedOn: "" });
    });

    test("an app booking before the app sends a page is App with the page not recorded", async () => {
      const row = (await get()).body.items.find((i) => i.id === ids.ios);
      assert.equal(row.sourcePage, null);
    });

    test("old bookings (appointment and category) are Unknown with the page not recorded", async () => {
      const items = (await get()).body.items;
      for (const name of ["old", "catOld", "emptySource"]) {
        const row = items.find((i) => i.id === ids[name]);
        assert.equal(row.sourceGroup, "Unknown", name);
        assert.equal(row.sourceDetail, "Booked before source tracking started", name);
        assert.equal(row.sourcePage, null, name);
      }
    });

    test("category bookings carry the fields too", async () => {
      const items = (await get()).body.items;
      const row = items.find((i) => i.id === ids.catWeb);
      assert.deepEqual(row.sourcePage, { type: "Footer", name: "Book Appointment", clickedOn: "Blog: Travelling with asthma" });
      assert.equal(items.find((i) => i.id === ids.catAndroid).sourceDetail, "Android · v2.4.1+30");
    });

    test("category stays on the row (the View page and the CSV still use it)", async () => {
      const row = (await get()).body.items.find((i) => i.id === ids.web);
      assert.equal(row.category, "General Care");
    });

    test("the single-booking endpoint (View page) has them too", async () => {
      const one = await fetch(`${base}/${ids.android}`);
      const body = await one.json();
      assert.equal(body.booking.sourceGroup, "App");
    });
  });

  describe("the Source filter", () => {
    test("web", async () => {
      const { body } = await get("source=web&limit=100");
      assert.deepEqual(new Set(idsOf(body)), new Set([ids.web, ids.webCondition, ids.doctor, ids.hostile, ids.catWeb]));
      assert.equal(body.source, "web");
      assert.equal(body.total, 5);
    });

    test("app takes android, ios and app", async () => {
      const { body } = await get("source=app&limit=100");
      assert.deepEqual(new Set(idsOf(body)), new Set([ids.android, ids.ios, ids.flutter, ids.catAndroid]));
    });

    test("unknown takes bookings with no source, an empty platform, or none stored", async () => {
      const { body } = await get("source=unknown&limit=100");
      assert.deepEqual(new Set(idsOf(body)), new Set([ids.old, ids.emptySource, ids.catOld]));
    });

    test("all, or no filter, is every booking", async () => {
      assert.equal((await get("source=all&limit=100")).body.total, 12);
      assert.equal((await get("limit=100")).body.total, 12);
      assert.equal((await get("limit=100")).body.source, "");
    });

    test("an unknown value is a 400", async () => {
      const res = await get("source=android");
      assert.equal(res.status, 400);
      assert.match(res.body.msg, /Invalid source/);
    });

    test("the tab counts follow it", async () => {
      const web = (await get("source=web")).body.counts;
      assert.equal(web.all, 5);
      assert.equal(web.upcoming, 5);
      const unknown = (await get("source=unknown")).body.counts;
      assert.equal(unknown.all, 3);
      assert.equal(unknown.complete, 1);
      const app = (await get("source=app")).body.counts;
      assert.equal(app.all, 4);
      assert.equal((await get()).body.counts.all, 12);
    });

    test("it combines with the status tab and the search", async () => {
      assert.deepEqual(idsOf((await get("source=unknown&status=complete")).body), [ids.old]);
      assert.deepEqual(idsOf((await get("source=web&q=Fever")).body), [ids.webCondition]);
      assert.equal((await get("source=app&q=Fever")).body.total, 0);
    });
  });

  describe("search", () => {
    test("matches the source name", async () => {
      assert.deepEqual(idsOf((await get("q=Fit to fly")).body), [ids.web], "the clicked-on name");
      assert.deepEqual(idsOf((await get("q=Online Prescription")).body), [ids.android]);
      assert.deepEqual(idsOf((await get("q=Martin Perlin")).body), [ids.doctor]);
    });

    test("matches the source type by its label", async () => {
      assert.deepEqual(idsOf((await get("q=Doctor profile")).body), [ids.doctor]);
      assert.deepEqual(new Set(idsOf((await get("q=header")).body)), new Set([ids.web]));
      assert.ok(idsOf((await get("q=footer")).body).includes(ids.catWeb));
      assert.ok(idsOf((await get("q=speciality&limit=100")).body).length === 0);
    });

    test("matches the page a button was clicked on, by type or by name", async () => {
      assert.ok(idsOf((await get("q=Travelling with asthma")).body).includes(ids.catWeb));
      assert.ok(idsOf((await get("q=blog")).body).includes(ids.catWeb));
    });

    test("search text is not a regular expression", async () => {
      assert.equal((await get("q=.*")).body.total, 0);
      assert.equal((await get("q=(")).status, 200);
    });
  });

  describe("Appointment entries rows", () => {
    test("carry the same fields and the CSV columns", async () => {
      const result = await listBookingEntries({ limit: "100" });
      const row = result.items.find((i) => i.id === ids.web);
      assert.equal(row.sourceGroup, "Web");
      assert.deepEqual(row.sourcePage, { type: "Header", name: "Book Appointment", clickedOn: "Service: Fit to fly" });
      assert.deepEqual(row.sourceCsv, {
        Source: "Web", Platform: "Web", "Source page type": "Header", "Source page name": "Book Appointment", "Clicked on": "Service: Fit to fly",
      });
      const android = result.items.find((i) => i.id === ids.android);
      assert.equal(android.sourceCsv.Platform, "Android (v1.0.0+16)");
      assert.equal(android.sourceCsv.Source, "App");
      const old = result.items.find((i) => i.id === ids.old);
      assert.deepEqual(old.sourceCsv, { Source: "Unknown", Platform: "", "Source page type": "", "Source page name": "", "Clicked on": "" });
    });
  });

  describe("CSV columns", () => {
    test("a visitor-supplied name can't become a spreadsheet formula", async () => {
      const result = await listBookingEntries({ limit: "100" });
      const row = result.items.find((i) => i.id === ids.hostile);
      assert.equal(row.sourceCsv["Source page name"], "'=HYPERLINK(\"http://evil\")");
      for (const lead of ["=", "+", "-", "@", "\t", "\r"]) {
        assert.equal(S.csvSafe(`${lead}1+1`), `'${lead}1+1`, JSON.stringify(lead));
      }
      assert.equal(S.csvSafe("Fit to fly"), "Fit to fly");
      assert.equal(S.csvSafe(undefined), "");
      assert.equal(S.csvSafe("a=b"), "a=b");
    });

    test("an empty or missing source gives empty columns", () => {
      for (const s of [undefined, null, {}]) {
        assert.deepEqual(S.sourceCsvColumns(s), { Source: "Unknown", Platform: "", "Source page type": "", "Source page name": "", "Clicked on": "" });
      }
    });
  });
});
