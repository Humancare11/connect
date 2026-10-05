// Runs one sync pass over every active mailbox and prints only counts
// (never subjects, bodies or keys). Reads Gmail and writes encrypted copies to
// the database named by MONGO_URI. It never sends or modifies anything in Gmail.
// Usage: node scripts/syncMailboxesOnce.js
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
const EmailMessage = require("../models/EmailMessage");
const { syncMailbox } = require("../services/gmail/syncMailbox");
const { assertNotProductionDb } = require("../utils/dbGuard");

(async () => {
  assertNotProductionDb({ uri: process.env.MONGO_URI });
  mongoose.set("debug", false);
  await mongoose.connect(process.env.MONGO_URI);
  const mailboxes = await Mailbox.find({ isActive: true }).select("_id address").lean();
  if (!mailboxes.length) console.log("No active mailboxes. Run: node scripts/seedMailboxes.js");
  let failed = 0;
  for (const m of mailboxes) {
    try {
      const res = await syncMailbox(m._id);
      const [inbound, outbound, spam] = await Promise.all([
        EmailMessage.countDocuments({ mailbox: m._id, direction: "in", isSpam: false }),
        EmailMessage.countDocuments({ mailbox: m._id, direction: "out" }),
        EmailMessage.countDocuments({ mailbox: m._id, direction: "in", isSpam: true }),
      ]);
      console.log(`✔ ${m.address}: ${res.skipped ? "skipped (lease held elsewhere)" : `${res.mode}, +${res.created} new, ${res.updated} updated`}`);
      console.log(`    stored now: ${inbound} received, ${outbound} sent, ${spam} spam`);
    } catch (err) {
      failed += 1;
      console.log(`✖ ${m.address}: ${String(err?.message || err).slice(0, 200)}`);
    }
  }
  await mongoose.disconnect();
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
