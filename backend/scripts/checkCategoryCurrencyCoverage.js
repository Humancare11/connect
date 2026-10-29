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

  if (missing.length === 0) {
    console.log("\nOK: every category has a EUR, a GBP and an INR price.");
    return 0;
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

module.exports = { findCategoriesMissingCurrencyPrices };
