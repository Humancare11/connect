const path = require("path");
require("dotenv").config({
  path: path.resolve(
    __dirname,
    "..",
    process.env.NODE_ENV === "production" ? ".env.production" : ".env"
  ),
});

const connectDB = require("../config/db");
const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");

// One-time, idempotent migration for the unified admin Appointments list.
// Sets `isTesting: false` explicitly on every booking that has no value yet, so
// the flag can be filtered and counted with a plain equality match. Documents
// that already have the field (true or false) are never touched. Nothing else is
// changed: the other new fields are optional and read as empty when missing.
//
// Usage: node scripts/backfillBookingAdminFields.js [--dry-run]
async function backfillBookingAdminFields() {
  const dryRun = process.argv.includes("--dry-run");
  await connectDB();

  for (const [label, Model] of [
    ["Appointment", Appointment],
    ["CategoryConsultation", CategoryConsultation],
  ]) {
    const filter = { isTesting: { $exists: false } };
    if (dryRun) {
      const count = await Model.collection.countDocuments(filter);
      console.log(`[dry run] ${label}: ${count} document(s) would get isTesting=false.`);
      continue;
    }
    const result = await Model.collection.updateMany(filter, { $set: { isTesting: false } });
    console.log(`${label}: set isTesting=false on ${result.modifiedCount} document(s).`);
  }

  process.exit(0);
}

backfillBookingAdminFields().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
