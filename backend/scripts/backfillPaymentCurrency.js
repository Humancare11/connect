// One-off backfill for multi-currency: gives every payment record that has no currency yet the value "usd".
//
// Before EUR / GBP existed every booking and payment was taken in USD, but the documents carry no currency, so this makes that
// explicit. It only fills a MISSING value (field absent, null or empty) - a document that already has a currency (usd, eur or
// gbp) is never touched, and nothing else on a document is changed. Running it twice changes nothing the second time.
//
//   Appointment           paymentCurrency
//   CategoryConsultation  paymentCurrency
//   Payment               currency
//   Invoice               currency
//
// Usage (from backend/):
//   node scripts/backfillPaymentCurrency.js --dry-run     only counts what WOULD change; writes nothing
//   node scripts/backfillPaymentCurrency.js               fills the missing values
// It uses the database in the environment's .env file (.env.production when NODE_ENV=production) and prints which database that
// is before doing anything. Run the dry run first and check the counts.
const path = require("path");
const mongoose = require("mongoose");

const TARGETS = [
  { name: "Appointment", model: "../models/Appointment", field: "paymentCurrency" },
  { name: "CategoryConsultation", model: "../models/CategoryConsultation", field: "paymentCurrency" },
  { name: "Payment", model: "../models/Payment", field: "currency" },
  { name: "Invoice", model: "../models/Invoice", field: "currency" },
];

const missing = (field) => ({ $or: [{ [field]: { $exists: false } }, { [field]: null }, { [field]: "" }] });

// Works on an already open mongoose connection. Returns [{ name, field, total, missing, updated }].
// The native collection is used on purpose: the models default these fields to "usd" when a document is READ, which must not
// hide that the stored document has no value.
async function backfillPaymentCurrency({ dryRun = false, log = console.log } = {}) {
  const report = [];
  for (const target of TARGETS) {
    const Model = require(target.model);
    const collection = Model.collection;
    const filter = missing(target.field);
    const [total, toFill] = await Promise.all([collection.countDocuments({}), collection.countDocuments(filter)]);

    let updated = 0;
    if (!dryRun && toFill > 0) {
      const result = await collection.updateMany(filter, { $set: { [target.field]: "usd" } });
      updated = result.modifiedCount;
    }
    report.push({ name: target.name, field: target.field, total, missing: toFill, updated });
    log(
      `${target.name.padEnd(22)} ${target.field.padEnd(16)} total=${String(total).padStart(7)}  missing=${String(toFill).padStart(7)}  ` +
        (dryRun ? "(dry run - not changed)" : `set to "usd": ${updated}`),
    );
  }
  return report;
}

async function main() {
  // The environment file is read only when this is run as a script (never when the functions are imported by a test).
  require("dotenv").config({
    path: path.resolve(__dirname, "..", process.env.NODE_ENV === "production" ? ".env.production" : ".env"),
  });
  const dryRun = process.argv.includes("--dry-run");
  const connectDB = require("../config/db");
  await connectDB();

  const { host, name } = mongoose.connection;
  console.log(`\nBackfill payment currency - ${new Date().toISOString()}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}   Database: ${name} on ${host}`);
  console.log(dryRun ? "DRY RUN: nothing will be written.\n" : "Filling missing currencies with \"usd\".\n");

  const report = await backfillPaymentCurrency({ dryRun });
  const pending = report.reduce((sum, r) => sum + r.missing, 0);
  console.log(
    dryRun
      ? `\nDry run done: ${pending} document(s) would be set to "usd".`
      : `\nDone: ${report.reduce((sum, r) => sum + r.updated, 0)} document(s) set to "usd".`,
  );
}

if (require.main === module) {
  main()
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("backfillPaymentCurrency failed:", err);
      process.exit(1);
    });
}

module.exports = { backfillPaymentCurrency, TARGETS };
