// The two go-live scripts for multi-currency pricing, run against an in-memory database only:
//   scripts/backfillPaymentCurrency.js        fills a missing currency with "usd" (dry run counts only; idempotent)
//   scripts/checkCategoryCurrencyCoverage.js  read-only; lists categories without a EUR / GBP price; exit code 1 if any
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { backfillPaymentCurrency } = require("../scripts/backfillPaymentCurrency");
const { findCategoriesMissingCurrencyPrices } = require("../scripts/checkCategoryCurrencyCoverage");
const HealthcareCategory = require("../models/HealthcareCategory");
const { CategoryPricing } = require("../models/CategoryPricing");

const col = (name) => mongoose.connection.collection(name);
const quiet = () => {};

describe("multi-currency go-live scripts", () => {
  let mongod;
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });
  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  describe("backfillPaymentCurrency", () => {
    // Raw documents, written straight to the collections so a missing field stays missing (the models would add the default).
    const seed = async () => {
      const oid = () => new mongoose.Types.ObjectId();
      await col("appointments").insertMany([
        { _id: oid(), paymentAmount: 1000 }, // no currency at all
        { _id: oid(), paymentAmount: 2000, paymentCurrency: null },
        { _id: oid(), paymentAmount: 3000, paymentCurrency: "" },
        { _id: oid(), paymentAmount: 4000, paymentCurrency: "eur" }, // already set: must stay
        { _id: oid(), paymentAmount: 5000, paymentCurrency: "gbp" },
        { _id: oid(), paymentAmount: 6000, paymentCurrency: "usd" },
      ]);
      await col("categoryconsultations").insertMany([
        { _id: oid(), paymentAmount: 1000 },
        { _id: oid(), paymentAmount: 2000, paymentCurrency: "eur" },
      ]);
      await col("payments").insertMany([
        { _id: oid(), amountCents: 1000, gateway: "stripe", gatewayReference: "pi_1" },
        { _id: oid(), amountCents: 3000, gateway: "stripe", gatewayReference: "pi_2", currency: "eur" },
      ]);
      await col("invoices").insertMany([
        { _id: oid(), amountCents: 1000, invoiceNumber: "HC01-2610", payment: oid() },
        { _id: oid(), amountCents: 2500, invoiceNumber: "HC02-2610", payment: oid(), currency: "gbp" },
      ]);
    };
    const snapshot = async () => ({
      appointments: await col("appointments").find({}).sort({ paymentAmount: 1 }).toArray(),
      categoryconsultations: await col("categoryconsultations").find({}).sort({ paymentAmount: 1 }).toArray(),
      payments: await col("payments").find({}).sort({ amountCents: 1 }).toArray(),
      invoices: await col("invoices").find({}).sort({ amountCents: 1 }).toArray(),
    });

    beforeEach(async () => {
      await Promise.all(["appointments", "categoryconsultations", "payments", "invoices"].map((n) => col(n).deleteMany({})));
      await seed();
    });

    test("dry run: reports what would change and writes nothing", async () => {
      const before = await snapshot();
      const report = await backfillPaymentCurrency({ dryRun: true, log: quiet });
      assert.deepEqual(
        report.map((r) => [r.name, r.field, r.total, r.missing, r.updated]),
        [
          ["Appointment", "paymentCurrency", 6, 3, 0],
          ["CategoryConsultation", "paymentCurrency", 2, 1, 0],
          ["Payment", "currency", 2, 1, 0],
          ["Invoice", "currency", 2, 1, 0],
        ],
      );
      assert.deepEqual(await snapshot(), before, "a dry run changes nothing");
    });

    test("fills only the missing values with usd, and nothing else changes", async () => {
      const before = await snapshot();
      const report = await backfillPaymentCurrency({ log: quiet });
      assert.deepEqual(report.map((r) => r.updated), [3, 1, 1, 1]);

      const after = await snapshot();
      assert.deepEqual(after.appointments.map((d) => d.paymentCurrency), ["usd", "usd", "usd", "eur", "gbp", "usd"]);
      assert.deepEqual(after.categoryconsultations.map((d) => d.paymentCurrency), ["usd", "eur"]);
      assert.deepEqual(after.payments.map((d) => d.currency), ["usd", "eur"]);
      assert.deepEqual(after.invoices.map((d) => d.currency), ["usd", "gbp"]);

      // Every other field of every document is exactly as it was.
      const strip = (docs, field) => docs.map(({ [field]: _ignored, ...rest }) => rest);
      assert.deepEqual(strip(after.appointments, "paymentCurrency"), strip(before.appointments, "paymentCurrency"));
      assert.deepEqual(strip(after.payments, "currency"), strip(before.payments, "currency"));
      assert.deepEqual(strip(after.invoices, "currency"), strip(before.invoices, "currency"));
    });

    test("is idempotent: a second run changes nothing", async () => {
      await backfillPaymentCurrency({ log: quiet });
      const afterFirst = await snapshot();
      const second = await backfillPaymentCurrency({ log: quiet });
      assert.deepEqual(second.map((r) => [r.missing, r.updated]), [[0, 0], [0, 0], [0, 0], [0, 0]]);
      assert.deepEqual(await snapshot(), afterFirst);
      const dry = await backfillPaymentCurrency({ dryRun: true, log: quiet });
      assert.deepEqual(dry.map((r) => r.missing), [0, 0, 0, 0]);
    });

    test("never overwrites an existing eur or gbp", async () => {
      await backfillPaymentCurrency({ log: quiet });
      assert.equal(await col("appointments").countDocuments({ paymentCurrency: "eur" }), 1);
      assert.equal(await col("appointments").countDocuments({ paymentCurrency: "gbp" }), 1);
      assert.equal(await col("payments").countDocuments({ currency: "eur" }), 1);
      assert.equal(await col("invoices").countDocuments({ currency: "gbp" }), 1);
    });

    test("works on empty collections", async () => {
      await Promise.all(["appointments", "categoryconsultations", "payments", "invoices"].map((n) => col(n).deleteMany({})));
      const report = await backfillPaymentCurrency({ log: quiet });
      assert.deepEqual(report.map((r) => [r.total, r.missing, r.updated]), [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]);
    });
  });

  describe("checkCategoryCurrencyCoverage", () => {
    const category = (name, slug, active = true) => HealthcareCategory.create({ name, pricingSlug: slug, price: 10, isActive: active });
    const pricing = (slug, extra = {}) => CategoryPricing.create({ categoryId: slug, label: slug, price: 10, ...extra });

    beforeEach(async () => {
      await Promise.all([HealthcareCategory.deleteMany({}), CategoryPricing.deleteMany({})]);
    });

    test("every category fully priced: nothing missing", async () => {
      await category("A", "a"); await pricing("a", { priceEur: 9, priceGbp: 8 });
      await category("B", "b", false); await pricing("b", { priceEur: 9, priceGbp: 8 });
      assert.deepEqual(await findCategoriesMissingCurrencyPrices(), { total: 2, complete: 2, missing: [] });
    });

    test("lists what is missing: EUR only, GBP only, both, no pricing row, no slug", async () => {
      await category("Full", "full"); await pricing("full", { priceEur: 9, priceGbp: 8 });
      await category("No EUR", "no-eur"); await pricing("no-eur", { priceGbp: 8 });
      await category("No GBP", "no-gbp", false); await pricing("no-gbp", { priceEur: 9 });
      await category("Neither", "neither"); await pricing("neither");
      await category("No row", "no-row");
      await HealthcareCategory.collection.insertOne({ name: "No slug", price: 5, isActive: true });

      const result = await findCategoriesMissingCurrencyPrices();
      assert.equal(result.total, 6);
      assert.equal(result.complete, 1);
      const by = Object.fromEntries(result.missing.map((m) => [m.name, [m.missingEur, m.missingGbp, m.noPricingRow, m.isActive]]));
      assert.deepEqual(by, {
        "No EUR": [true, false, false, true],
        "No GBP": [false, true, false, false],
        Neither: [true, true, false, true],
        "No row": [true, true, true, true],
        "No slug": [true, true, true, true],
      });
    });

    test("it never writes", async () => {
      await category("Neither", "neither"); await pricing("neither");
      const before = JSON.stringify(await CategoryPricing.find({}).lean());
      await findCategoriesMissingCurrencyPrices();
      assert.equal(JSON.stringify(await CategoryPricing.find({}).lean()), before);
    });

    test("run as a script: exit code 1 when something is missing, 0 when everything is priced", async () => {
      const run = () =>
        spawnSync(process.execPath, [path.join(__dirname, "..", "scripts", "checkCategoryCurrencyCoverage.js")], {
          env: { ...process.env, MONGO_URI: mongod.getUri(), NODE_ENV: "test" },
          encoding: "utf8",
          timeout: 60000,
        });

      await category("Neither", "neither"); await pricing("neither");
      let r = run();
      assert.equal(r.status, 1, r.stderr);
      assert.match(r.stdout, /FAILED: 1 category is not fully priced/);
      assert.match(r.stdout, /"Neither".*missing: EUR \+ GBP/);

      await CategoryPricing.updateOne({ categoryId: "neither" }, { priceEur: 9, priceGbp: 8 });
      r = run();
      assert.equal(r.status, 0, r.stderr + r.stdout);
      assert.match(r.stdout, /OK: every category has a EUR and a GBP price/);
    });
  });
});
