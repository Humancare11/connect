// Read-only go-live check for multi-currency pricing: lists every category that still has no EUR, GBP or INR price.
//
// A category with no EUR / GBP / INR price is charged in USD to EUR / GBP / Indian customers (with a [CURRENCY_FALLBACK_USED] log),
// so before MULTI_CURRENCY_ENABLED is switched on every category should be priced in all four currencies. Exits 1 when any category is
// missing a price, 0 when every category is fully priced. It never writes anything.
//
// Usage (from backend/): node scripts/checkCategoryCurrencyCoverage.js
// It reads the database in the environment's .env file (.env.production when NODE_ENV=production).
const path = require("path");
const mongoose = require("mongoose");
const HealthcareCategory = require("../models/HealthcareCategory");
const { CategoryPricing } = require("../models/CategoryPricing");
const ServicePrice = require("../models/ServicePrice");

const isPrice = (value) => Number.isFinite(Number(value)) && Number(value) > 0 && value !== null;

// Reads only. Returns { total, complete, missing: [{ name, id, isActive, pricingSlug, missingEur, missingGbp, missingInr, noPricingRow }] }.
async function findCategoriesMissingCurrencyPrices() {
  const categories = await HealthcareCategory.find().select("name isActive pricingSlug").sort({ name: 1 }).lean();
  const records = await CategoryPricing.find({}, "categoryId priceEur priceGbp priceInr").lean();
  const bySlug = new Map(records.map((r) => [r.categoryId, r]));

  const missing = [];
  for (const category of categories) {
    const record = category.pricingSlug ? bySlug.get(category.pricingSlug) : undefined;
    const missingEur = !isPrice(record?.priceEur);
    const missingGbp = !isPrice(record?.priceGbp);
    const missingInr = !isPrice(record?.priceInr);
    if (missingEur || missingGbp || missingInr) {
      missing.push({
        name: category.name,
        id: String(category._id),
        isActive: Boolean(category.isActive),
        pricingSlug: category.pricingSlug || "",
        missingEur,
        missingGbp,
        missingInr,
        noPricingRow: !record,
      });
    }
  }
  return { total: categories.length, complete: categories.length - missing.length, missing };
}

// The same check for the services (Admin > Services Price). Reads only.
// Returns { total, complete, missing: [{ name, id, slug, missingEur, missingGbp, missingInr }] }.
async function findServicesMissingCurrencyPrices() {
  const services = await ServicePrice.find().select("name slug priceEur priceGbp priceInr").sort({ name: 1 }).lean();
  const missing = [];
  for (const service of services) {
    const missingEur = !isPrice(service.priceEur);
    const missingGbp = !isPrice(service.priceGbp);
    const missingInr = !isPrice(service.priceInr);
    if (missingEur || missingGbp || missingInr) {
      missing.push({ name: service.name, id: String(service._id), slug: service.slug, missingEur, missingGbp, missingInr });
    }
  }
  return { total: services.length, complete: services.length - missing.length, missing };
}

async function main() {
  // The environment file is read only when this is run as a script (never when the functions are imported by a test).
  require("dotenv").config({
    path: path.resolve(__dirname, "..", process.env.NODE_ENV === "production" ? ".env.production" : ".env"),
  });
  const connectDB = require("../config/db");
  await connectDB();

  const { total, complete, missing } = await findCategoriesMissingCurrencyPrices();
  console.log(`\nCategory currency coverage - ${new Date().toISOString()}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}   Database: ${mongoose.connection.name} on ${mongoose.connection.host}`);
  console.log(`Categories: ${total}   fully priced (USD + EUR + GBP + INR): ${complete}   missing a price: ${missing.length}`);

  const services = await findServicesMissingCurrencyPrices();
  console.log(`Services:   ${services.total}   fully priced (USD + EUR + GBP + INR): ${services.complete}   missing a price: ${services.missing.length}`);

  if (services.missing.length > 0) {
    console.log("\nServices missing a price (fill them in Super Admin > Services Price > Edit):");
    for (const s of services.missing) {
      const what = [s.missingEur && "EUR", s.missingGbp && "GBP", s.missingInr && "INR"].filter(Boolean).join(" + ");
      console.log(`  - "${s.name}" (${s.slug}, ${s.id})  missing: ${what}`);
    }
  }

  if (missing.length === 0 && services.missing.length === 0) {
    console.log("\nOK: every category and every service has a EUR, a GBP and an INR price.");
    return 0;
  }
  if (missing.length === 0) {
    console.log(`\nFAILED: ${services.missing.length} service${services.missing.length === 1 ? " is" : "s are"} not fully priced.`);
    return 1;
  }

  console.log("\nCategories missing a price (fill them in Super Admin > Healthcare Management > Categories > Edit):");
  for (const c of missing) {
    const what = [c.missingEur && "EUR", c.missingGbp && "GBP", c.missingInr && "INR"].filter(Boolean).join(" + ");
    console.log(
      `  - "${c.name}" (${c.id}) ${c.isActive ? "active" : "inactive"}  missing: ${what}` +
        (c.noPricingRow ? "  [no CategoryPricing row at all]" : ""),
    );
  }
  console.log(`\nFAILED: ${missing.length} categor${missing.length === 1 ? "y is" : "ies are"} not fully priced.`);
  if (services.missing.length > 0) console.log(`        ${services.missing.length} service${services.missing.length === 1 ? " is" : "s are"} not fully priced.`);
  return 1;
}

if (require.main === module) {
  main()
    .then(async (code) => {
      await mongoose.disconnect();
      process.exit(code);
    })
    .catch((err) => {
      console.error("checkCategoryCurrencyCoverage failed:", err);
      process.exit(1);
    });
}

module.exports = { findCategoriesMissingCurrencyPrices, findServicesMissingCurrencyPrices };
