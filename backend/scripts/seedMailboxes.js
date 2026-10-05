// Creates the shared company mailboxes if they don't exist yet. Idempotent and
// non-destructive: existing rows (and any edits made to them) are left alone.
// Writes to the database named by MONGO_URI in the env file for NODE_ENV.
// Usage: node scripts/seedMailboxes.js
const path = require("path");
require("dotenv").config({
  path: path.resolve(
    __dirname,
    "..",
    process.env.NODE_ENV === "production" ? ".env.production" : process.env.NODE_ENV === "uat" ? ".env.uat" : ".env"
  ),
});
const mongoose = require("mongoose");
const Mailbox = require("../models/Mailbox");
const { assertNotProductionDb } = require("../utils/dbGuard");

const MAILBOXES = [
  { address: "support@humancareconnect.co", displayName: "Support", color: "#0d7a6f", sortOrder: 1 },
  { address: "tech@humancareconnect.co", displayName: "Tech", color: "#6a4fc0", sortOrder: 2 },
];

(async () => {
  assertNotProductionDb({ uri: process.env.MONGO_URI });
  await mongoose.connect(process.env.MONGO_URI);
  for (const m of MAILBOXES) {
    const exists = await Mailbox.exists({ address: m.address });
    if (exists) {
      console.log(`= ${m.address} already exists`);
      continue;
    }
    await Mailbox.create(m);
    console.log(`+ created ${m.address}`);
  }
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
