// Read-only diagnostic for the CategoryPricing migration (Phase D).
//
// Reports, for every HealthcareCategory, whether it would still resolve a
// correct price if the legacy HealthcareCategory.price/currency fallback
// in resolveEffectiveCategoryPrice() were removed (Phase E). Exits 1 if any
// category would NOT resolve cleanly - this script passing with zero
// issues, in every environment, is one of the required conditions before
// Phase E's schema removal is safe to run.
//
// Usage: node scripts/checkCategoryPricingCoverage.js
const path = require("path");
require("dotenv").config({
  path: path.resolve(
    __dirname,
    "..",
    process.env.NODE_ENV === "production" ? ".env.production" : ".env",
  ),
});

const connectDB = require("../config/db");
const HealthcareCategory = require("../models/HealthcareCategory");
const { CategoryPricing } = require("../models/CategoryPricing");

async function checkCategoryPricingCoverage() {
  await connectDB();

  const categories = await HealthcareCategory.find()
    .select("name isActive price currency pricingSlug")
    .sort({ name: 1 })
    .lean();
  const pricingRecords = await CategoryPricing.find({}, "categoryId price").lean();
  const pricingBySlug = new Map(pricingRecords.map((r) => [r.categoryId, r]));

  const issues = {
    missingPricingSlug: [],
    missingCategoryPricingRow: [],
    nonPositivePrice: [],
  };

  for (const category of categories) {
    if (!category.pricingSlug) {
      issues.missingPricingSlug.push(category);
      continue; // eslint-disable-line no-continue
    }
    const record = pricingBySlug.get(category.pricingSlug);
    if (!record) {
      issues.missingCategoryPricingRow.push(category);
      continue; // eslint-disable-line no-continue
    }
    const price = Number(record.price);
    if (!Number.isFinite(price) || price <= 0) {
      issues.nonPositivePrice.push(category);
    }
  }

  const totalIssues =
    issues.missingPricingSlug.length +
    issues.missingCategoryPricingRow.length +
    issues.nonPositivePrice.length;

  console.log(`\nCategoryPricing coverage check - ${new Date().toISOString()}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`Total categories checked: ${categories.length}`);
  console.log(`  - active: ${categories.filter((c) => c.isActive).length}`);
  console.log(`  - inactive: ${categories.filter((c) => !c.isActive).length}`);

  const describe = (c) =>
    `  - "${c.name}" (${c._id}) active=${c.isActive} pricingSlug=${c.pricingSlug || "(none)"} legacyPrice=${c.price}`;

  console.log(`\nMissing pricingSlug: ${issues.missingPricingSlug.length}`);
  issues.missingPricingSlug.forEach((c) => console.log(describe(c)));

  console.log(`\nHas pricingSlug but no CategoryPricing row: ${issues.missingCategoryPricingRow.length}`);
  issues.missingCategoryPricingRow.forEach((c) => console.log(describe(c)));

  console.log(`\nCategoryPricing row exists but price <= 0: ${issues.nonPositivePrice.length}`);
  issues.nonPositivePrice.forEach((c) => console.log(describe(c)));

  if (totalIssues === 0) {
    console.log(
      "\nRESULT: CLEAN - every category resolves via CategoryPricing with no fallback needed.",
    );
  } else {
    console.log(
      `\nRESULT: ${totalIssues} categor${totalIssues === 1 ? "y" : "ies"} would rely on the ` +
        "legacy fallback today - Phase E is NOT safe to run until these are resolved.",
    );
  }

  process.exit(totalIssues === 0 ? 0 : 1);
}

checkCategoryPricingCoverage().catch((error) => {
  console.error("CategoryPricing coverage check failed:", error);
  process.exit(1);
});
