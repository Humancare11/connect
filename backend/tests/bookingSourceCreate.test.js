// Step 2 of "booking source": the two create endpoints store the source once, and nothing later changes it.
// Payment verification, the invoice ledger and the notification mails are stubbed; the models, the transaction and the
// controllers are the real ones (a one-node replica set, because createAppointment uses a transaction).
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

// Stubs go onto the real modules' exports BEFORE the controllers are loaded (they destructure at require time).
const pv = require("../utils/paymentVerification");
let claims = 0;
pv.verifyCategoryPayment = async ({ paymentIntentId, paypalOrderId }) => ({ ref: paymentIntentId || paypalOrderId, gateway: paymentIntentId ? "stripe" : "paypal", amountCents: 5000, currency: "USD" });
pv.resolveServiceFeeCents = async () => 5000;
pv.verifyStripePaymentIntent = async ({ paymentIntentId }) => ({ ref: paymentIntentId, gateway: "stripe", amountCents: 5000 });
pv.verifyPaypalOrder = async ({ paypalOrderId }) => ({ ref: paypalOrderId, gateway: "paypal", amountCents: 5000 });
pv.claimPaymentOnce = async () => { claims += 1; };
require("../utils/billing").recordPaymentAndInvoice = async () => {};
const notify = require("../utils/bookingNotifications");
notify.notifyAppointmentBooked = () => {};
notify.notifyCategoryConsultationBooked = () => {};

const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");
const S = require("../utils/bookingSource");
const { createAppointment } = require("../controllers/appointmentController");
const { createCategoryConsultation } = require("../controllers/CategoryConsultationController");

const BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const PATIENT = "64b000000000000000000001";
const SOURCE_KEYS = [
  "appVersion", "capturedAt", "clickedOnName", "clickedOnType", "pagePath", "platform", "referrer", "sourceName", "sourceType", "utm",
];

let seq = 0;
const tomorrow = () => new Date(Date.now() + 36 * 3600 * 1000).toISOString().slice(0, 10);

const makeRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
};

const reqFor = (headers, body) => ({ headers, body, user: { id: PATIENT }, app: { get: () => null } });

const appointmentBody = (extra = {}) => ({
  date: tomorrow(),
  time: "10:00",
  problem: "Cough",
  category: "General Care",
  specialty: "GP",
  condition: "Cough",
  consultationPrice: 50,
  paymentIntentId: `pi_${++seq}`,
  patientDetails: { firstName: "Test" },
  ...extra,
});

const consultationBody = (extra = {}) => ({
  concern: "Cough",
  duration: "1 week",
  severity: "mild",
  supportType: "advice",
  urgency: "asap",
  date: tomorrow(),
  categoryName: "General Care",
  specialtyName: "GP",
  conditionName: "Cough",
  paymentIntentId: `pi_${++seq}`,
  ...extra,
});

let replSet;
before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  await Appointment.init();
  await CategoryConsultation.init();
});
after(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

const book = async (kind, headers, body) => {
  const res = makeRes();
  const fn = kind === "appointment" ? createAppointment : createCategoryConsultation;
  await fn(reqFor(headers, body), res);
  assert.equal(res.statusCode, 201, JSON.stringify(res.body));
  const id = kind === "appointment" ? res.body.appointment._id : res.body.data._id;
  const Model = kind === "appointment" ? Appointment : CategoryConsultation;
  return { res, id, Model, stored: await Model.findById(id).lean() };
};

for (const kind of ["appointment", "consultation"]) {
  const bodyOf = kind === "appointment" ? appointmentBody : consultationBody;

  describe(`${kind}: the source is stored when the patient's own request creates the booking`, () => {
    test("a website booking keeps the page, the clicked-on page, the referrer and the campaign; the platform comes from the headers", async () => {
      const { stored } = await book(kind, { "user-agent": BROWSER }, bodyOf({
        source: {
          sourceType: "header", sourceName: "Book Appointment", clickedOnType: "service", clickedOnName: "Fit to fly",
          pagePath: "/fit-to-fly?x=1", referrer: "https://www.google.com/search?q=a", utm: { source: "g", medium: "cpc", campaign: "spring" },
          platform: "ios", appVersion: "9.9.9",
        },
      }));
      assert.equal(stored.source.platform, "web");
      assert.equal(stored.source.appVersion, "");
      assert.equal(stored.source.sourceType, "header");
      assert.equal(stored.source.sourceName, "Book Appointment");
      assert.equal(stored.source.clickedOnType, "service");
      assert.equal(stored.source.clickedOnName, "Fit to fly");
      assert.equal(stored.source.pagePath, "/fit-to-fly");
      assert.equal(stored.source.referrer, "www.google.com/search");
      assert.deepEqual(stored.source.utm, { source: "g", medium: "cpc", campaign: "spring" });
      assert.ok(stored.source.capturedAt instanceof Date);
    });

    test("an app booking keeps the platform and version from the headers and the page the app sent", async () => {
      const { stored } = await book(kind, { "x-client-platform": "android", "x-app-version": "2.4.1+30", "user-agent": "okhttp/4.12.0" }, bodyOf({
        source: { sourceType: "service", sourceName: "Fit to fly" },
      }));
      assert.equal(stored.source.platform, "android");
      assert.equal(stored.source.appVersion, "2.4.1+30");
      assert.deepEqual([stored.source.sourceType, stored.source.sourceName], ["service", "Fit to fly"]);
    });

    test("without a source in the body the booking is still created: platform only, page not recorded", async () => {
      const { stored } = await book(kind, { "x-client-platform": "ios", "x-app-version": "1.0.0+16" }, bodyOf());
      assert.equal(stored.source.platform, "ios");
      assert.equal(stored.source.sourceType, "");
      assert.equal(S.platformGroup(stored.source), "App");
      assert.equal(S.sourcePageLabel(stored.source), null);
    });

    test("a request with no recognisable client still books, with an empty platform", async () => {
      const { stored } = await book(kind, {}, bodyOf());
      assert.equal(stored.source.platform, "");
    });

    test("a hostile source is cleaned or dropped and the booking still goes through", async () => {
      const hostile = {
        sourceType: "<script>alert(1)</script>",
        sourceName: "A\u0000B\u202E" + "x".repeat(1000),
        clickedOnType: { $gt: "" },
        clickedOnName: ["a"],
        pagePath: "javascript:alert(1)",
        referrer: "javascript:alert(1)",
        utm: { source: "<img onerror=1>", medium: { $ne: 1 }, campaign: "c".repeat(999) },
        platform: "android",
        $set: { status: "complete" },
        __proto__: { admin: true },
        extra: "x",
      };
      const { stored } = await book(kind, { "user-agent": BROWSER }, bodyOf({ source: hostile }));
      assert.equal(stored.source.platform, "web");
      assert.equal(stored.source.sourceType, "unknown");
      assert.ok(stored.source.sourceName.length <= S.MAX_NAME_LENGTH);
      assert.ok(!/[\u0000\u202E]/.test(stored.source.sourceName));
      assert.equal(stored.source.clickedOnType, "");
      assert.equal(stored.source.pagePath, "");
      assert.equal(stored.source.referrer, "");
      assert.equal(stored.source.utm.source, "img onerror1");
      assert.equal(stored.source.utm.medium, "");
      assert.equal(stored.source.utm.campaign.length, 100);
      assert.deepEqual(Object.keys(stored.source).sort(), [...SOURCE_KEYS, "_id"].filter((k) => k !== "_id").sort());
      assert.notEqual(stored.status, "complete");
    });

    for (const raw of ["condition", 5, [], null, true]) {
      test(`a source that is not an object (${JSON.stringify(raw)}) is ignored`, async () => {
        const { stored } = await book(kind, { "user-agent": BROWSER }, bodyOf({ source: raw }));
        assert.equal(stored.source.platform, "web");
        assert.equal(stored.source.sourceType, "");
      });
    }
  });
}

describe("building the source can never stop a booking", () => {
  test("if building throws, the booking is saved with an empty source", async () => {
    // A request whose headers blow up: the builder falls back to its empty value, the booking is created.
    const req = reqFor({}, appointmentBody());
    Object.defineProperty(req, "headers", { get() { throw new Error("boom"); } });
    const res = makeRes();
    await createAppointment(req, res);
    assert.equal(res.statusCode, 201, JSON.stringify(res.body));
    const stored = await Appointment.findById(res.body.appointment._id).lean();
    assert.equal(stored.source.platform, "");
    assert.equal(stored.source.sourceType, "");
  });

  test("bookingSourceFor falls back to the empty value even if the builder itself fails", () => {
    const req = { get body() { throw new Error("boom"); }, headers: {} };
    const value = S.bookingSourceFor(req);
    assert.equal(value.platform, "");
    assert.equal(value.sourceType, "");
  });

  test("the source is built once per request, outside the transaction callback (which mongoose may run twice)", () => {
    const text = fs.readFileSync(path.join(__dirname, "../controllers/appointmentController.js"), "utf8");
    const built = text.indexOf("bookingSourceFor(req)");
    assert.ok(built > 0);
    assert.ok(built < text.indexOf("session.withTransaction"), "built before the transaction");
    assert.equal(text.split("bookingSourceFor(req)").length - 1, 1);
  });
});

describe("bookings are only ever created by the patient's own request (no webhook, job or retry path)", () => {
  test("only the two create endpoints create bookings, so the platform is never read from a webhook", () => {
    const root = path.join(__dirname, "..");
    const skip = new Set(["node_modules", "tests", "docs", "assets", "data"]);
    const files = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (skip.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".js")) files.push(full);
      }
    };
    walk(root);
    const creates = /\b(Appointment|CategoryConsultation)\.(create|insertMany)\(|new (Appointment|CategoryConsultation)\(/;
    const hits = files
      .filter((f) => creates.test(fs.readFileSync(f, "utf8")))
      .map((f) => path.relative(root, f).replace(/\\/g, "/"))
      .sort();
    assert.deepEqual(
      hits,
      ["controllers/CategoryConsultationController.js", "controllers/appointmentController.js"].sort(),
      "a new place creates bookings: it must carry the source captured at checkout, never read the platform from a webhook request"
    );
    const webhooks = files.filter((f) => /constructEvent|payment_intent\.succeeded|stripe-signature/i.test(fs.readFileSync(f, "utf8")));
    assert.deepEqual(webhooks.map((f) => path.relative(root, f).replace(/\\/g, "/")), [], "no webhook handler exists today");
  });
});

describe("the source is written once", () => {
  let id;
  let original;
  before(async () => {
    const made = await book("appointment", { "x-client-platform": "android", "x-app-version": "2.4.1+30" }, appointmentBody({
      source: { sourceType: "condition", sourceName: "Fever" },
    }));
    id = made.id;
    original = JSON.stringify(made.stored.source);
  });
  const current = async () => JSON.stringify((await Appointment.findById(id).lean()).source);

  test("saving the booking after other edits does not change the source", async () => {
    const doc = await Appointment.findById(id);
    doc.status = "confirmed";
    doc.paymentStatus = "paid";
    doc.entry.comment = "edited";
    await doc.save();
    assert.equal(await current(), original);
  });

  test("setting the source fields on a loaded booking is ignored", async () => {
    const doc = await Appointment.findById(id);
    doc.source.platform = "web";
    doc.source.sourceType = "blog";
    doc.source.sourceName = "Changed";
    doc.source = { platform: "ios" };
    await doc.save();
    assert.equal(await current(), original);
  });

  test("update queries cannot overwrite, clear or unset it", async () => {
    await Appointment.updateOne({ _id: id }, { $set: { "source.platform": "ios", "source.sourceName": "Changed", source: { platform: "web" } } });
    await Appointment.findByIdAndUpdate(id, { $set: { source: {} } });
    await Appointment.findByIdAndUpdate(id, { $unset: { source: 1 } });
    await Appointment.updateOne({ _id: id }, { source: { sourceType: "blog" } });
    assert.equal(await current(), original);
  });

  test("ordinary admin-style updates (status, assign doctor, reschedule, payment) leave it alone", async () => {
    await Appointment.updateOne({ _id: id }, { $set: { status: "complete", date: "2027-01-01", time: "11:00", paymentStatus: "paid", "entry.paidStatus": "paid" } });
    await Appointment.findOneAndUpdate({ _id: id }, { $set: { doctorId: new mongoose.Types.ObjectId() } });
    assert.equal(await current(), original);
  });

  test("an old booking never gains a source value and reads as Unknown", async () => {
    const _id = new mongoose.Types.ObjectId();
    await Appointment.collection.insertOne({
      _id, patientId: new mongoose.Types.ObjectId(PATIENT), date: "2026-01-01", time: "10:00", problem: "Old", category: "General Care",
      specialty: "GP", condition: "Cough", status: "upcoming", bookedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    });
    const doc = await Appointment.findById(_id);
    assert.equal(doc.source.platform, "", "an old booking reads as the empty defaults");
    doc.status = "confirmed";
    doc.source.platform = "web";
    await doc.save();
    await Appointment.updateOne({ _id }, { $set: { "source.platform": "android" } });
    const raw = await Appointment.collection.findOne({ _id });
    // Saving an old booking may store mongoose's empty defaults (as it already does for other defaulted fields), never a value.
    const stored = raw.source || {};
    for (const [key, value] of Object.entries(stored)) {
      if (key === "utm") assert.deepEqual(value, { source: "", medium: "", campaign: "" });
      else assert.ok(value === "" || value === null, `${key} stays empty`);
    }
    assert.equal(stored.platform, undefined, "the attempted platform was not written");
    const lean = await Appointment.findById(_id).lean();
    assert.equal(S.platformGroup(lean.source), "Unknown");
    assert.equal(S.sourcePageLabel(lean.source), null);
  });
});
