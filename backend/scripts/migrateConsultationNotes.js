const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "..", process.env.NODE_ENV === "production" ? ".env.production" : ".env"),
});

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const { migrateConsultationNotes } = require("../utils/migrateConsultationNotes");

// One-off, safe to re-run: node scripts/migrateConsultationNotes.js
(async () => {
  await connectDB();
  const { migrated } = await migrateConsultationNotes();
  console.log(`[migrate-notes] encrypted ${migrated} legacy note(s) into the structured Note field.`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error("[migrate-notes] failed:", err);
  process.exit(1);
});
