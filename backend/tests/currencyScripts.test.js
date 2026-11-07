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
const { findCategoriesMissingCurrencyPrices, findServicesMissingCurrencyPrices } = require("../scripts/checkCategoryCurrencyCoverage");
const ServicePrice = require("../models/ServicePrice");
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
      await Promise.all([HealthcareCategory.deleteMany({}), CategoryPricing.deleteMany({}), ServicePrice.deleteMany({})]);
    });

    test("every category fully priced: nothing missing", async () => {
      await category("A", "a"); await pricing("a", { priceEur: 9, priceGbp: 8, priceInr: 799 });
      await category("B", "b", false); await pricing("b", { priceEur: 9, priceGbp: 8, priceInr: 799 });
      assert.deepEqual(await findCategoriesMissingCurrencyPrices(), { total: 2, complete: 2, missing: [] });
    });

    test("lists what is missing: EUR only, GBP only, INR only, all, no pricing row, no slug", async () => {
      await category("Full", "full"); await pricing("full", { priceEur: 9, priceGbp: 8, priceInr: 799 });
      await category("No EUR", "no-eur"); await pricing("no-eur", { priceGbp: 8, priceInr: 799 });
      await category("No GBP", "no-gbp", false); await pricing("no-gbp", { priceEur: 9, priceInr: 799 });
      await category("No INR", "no-inr"); await pricing("no-inr", { priceEur: 9, priceGbp: 8 });
      await category("Neither", "neither"); await pricing("neither");
      await category("No row", "no-row");
      await HealthcareCategory.collection.insertOne({ name: "No slug", price: 5, isActive: true });

      const result = await findCategoriesMissingCurrencyPrices();
      assert.equal(result.total, 7);
      assert.equal(result.complete, 1);
      const by = Object.fromEntries(result.missing.map((m) => [m.name, [m.missingEur, m.missingGbp, m.missingInr, m.noPricingRow, m.isActive]]));
      assert.deepEqual(by, {
        "No EUR": [true, false, false, false, true],
        "No GBP": [false, true, false, false, false],
        "No INR": [false, false, true, false, true],
        Neither: [true, true, true, false, true],
        "No row": [true, true, true, true, true],
        "No slug": [true, true, true, true, true],
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

      assert.match(r.stdout, /"Neither".*missing: EUR \+ GBP \+ INR/);

      await CategoryPricing.updateOne({ categoryId: "neither" }, { priceEur: 9, priceGbp: 8, priceInr: 799 });
      r = run();
      assert.equal(r.status, 0, r.stderr + r.stdout);
      assert.match(r.stdout, /OK: every category and every service has a EUR, a GBP and an INR price/);
    });

    describe("services", () => {
      const service = (slug, extra = {}) => ServicePrice.collection.insertOne({ name: slug, slug, price: 10, icon: "i", description: "d", ...extra });

      test("lists the services missing EUR, GBP or INR; a fully priced one is complete; it never writes", async () => {
        await service("full", { priceEur: 9, priceGbp: 8, priceInr: 799 });
        await service("no-eur", { priceGbp: 8, priceInr: 799 });
        await service("no-gbp", { priceEur: 9, priceInr: 799 });
        await service("no-inr", { priceEur: 9, priceGbp: 8 });
        await service("old");
        await service("zero", { priceEur: 0, priceGbp: 8, priceInr: 799 }); // 0 is not a price
        const before = JSON.stringify(await ServicePrice.find({}).sort({ slug: 1 }).lean());
        const result = await findServicesMissingCurrencyPrices();
        assert.equal(result.total, 6);
        assert.equal(result.complete, 1);
        const by = Object.fromEntries(result.missing.map((m) => [m.slug, [m.missingEur, m.missingGbp, m.missingInr]]));
        assert.deepEqual(by, {
          "no-eur": [true, false, false],
          "no-gbp": [false, true, false],
          "no-inr": [false, false, true],
          old: [true, true, true],
          zero: [true, false, false],
        });
        assert.equal(JSON.stringify(await ServicePrice.find({}).sort({ slug: 1 }).lean()), before);
      });

      test("no services: nothing missing", async () => {
        assert.deepEqual(await findServicesMissingCurrencyPrices(), { total: 0, complete: 0, missing: [] });
      });

      test("run as a script: fully priced categories but a service missing a price still exits 1 and names the service", async () => {
        const run = () =>
          spawnSync(process.execPath, [path.join(__dirname, "..", "scripts", "checkCategoryCurrencyCoverage.js")], {
            env: { ...process.env, MONGO_URI: mongod.getUri(), NODE_ENV: "test" },
            encoding: "utf8",
            timeout: 60000,
          });
        await category("A", "a"); await pricing("a", { priceEur: 9, priceGbp: 8, priceInr: 799 });
        await service("fit-to-fly", { priceEur: 9 });
        let r = run();
        assert.equal(r.status, 1, r.stderr + r.stdout);
        assert.match(r.stdout, /Services missing a price/);
        assert.match(r.stdout, /"fit-to-fly".*missing: GBP \+ INR/);
        assert.match(r.stdout, /FAILED: 1 service is not fully priced/);
        await ServicePrice.collection.updateOne({ slug: "fit-to-fly" }, { $set: { priceGbp: 8, priceInr: 799 } });
        r = run();
        assert.equal(r.status, 0, r.stderr + r.stdout);
        assert.match(r.stdout, /Services:   1   fully priced/);
      });
    });
  });
});
