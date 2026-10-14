// Fills (or rebuilds) the Archive search blind indexes on live-chat conversations: LcConversation.searchKeys.emailHash
// and phoneHash, keyed hashes of the patient's email and phone. Chats started before the Archive page existed have
// none, so an exact email or phone search would not find them.
//
// The hashes are derived from LIVECHAT_ENCRYPTION_KEY. If that key ever changes, run this again (after the data is
// re-encrypted) so the stored hashes match the new key.
//
// Safe to re-run: a chat whose stored hashes already match is left alone.
// DRY RUN by default (reads only). It prints COUNTS ONLY, never a name, email or phone.
//
// Usage (from backend/):
//   node scripts/backfillLiveChatSearchKeys.js                       # dry run
//   node scripts/backfillLiveChatSearchKeys.js --apply               # write the hashes
//   NODE_ENV=production node scripts/backfillLiveChatSearchKeys.js --confirm-production [--apply]
//     (refuses to run in production without --confirm-production, even for a dry run)
const BATCH = 500;

// Core: scans chats with a contact and (when apply) updates the ones whose hashes are missing or different.
async function backfillSearchKeys({ LcConversation, decryptLiveChatText, searchKeysOf, apply = false }) {
  const counts = { scanned: 0, withContact: 0, upToDate: 0, toUpdate: 0, updated: 0, unreadable: 0 };
  let ops = [];
  const flush = async () => {
    if (!ops.length) return;
    if (apply) {
      const result = await LcConversation.bulkWrite(ops, { ordered: false });
      counts.updated += result.modifiedCount || 0;
    }
    ops = [];
  };
  const cursor = LcConversation.find({ "contact.email.cipherText": { $ne: "" } })
    .select("contact searchKeys")
    .lean()
    .cursor();
  for await (const row of cursor) {
    counts.scanned += 1;
    counts.withContact += 1;
    let keys;
    try {
      keys = searchKeysOf(decryptLiveChatText(row.contact.email), decryptLiveChatText(row.contact.phone));
    } catch {
      counts.unreadable += 1; // cannot be decrypted with the current key: left as it is
      continue;
    }
    if (row.searchKeys?.emailHash === keys.emailHash && row.searchKeys?.phoneHash === keys.phoneHash) {
      counts.upToDate += 1;
      continue;
    }
    counts.toUpdate += 1;
    ops.push({ updateOne: { filter: { _id: row._id }, update: { $set: { searchKeys: keys } } } });
    if (ops.length >= BATCH) await flush();
  }
  await flush();
  return counts;
}

async function main(argv = process.argv.slice(2), env = process.env) {
  const production = env.NODE_ENV === "production";
  if (production && !argv.includes("--confirm-production")) {
    console.error("Refusing to run with NODE_ENV=production without --confirm-production.");
    return 2;
  }
  const path = require("path");
  require("dotenv").config({ path: path.resolve(__dirname, "..", production ? ".env.production" : ".env") });
  const mongoose = require("mongoose");
  const connectDB = require("../config/db");
  const LcConversation = require("../models/LcConversation");
  const { decryptLiveChatText, searchKeysOf } = require("../utils/liveChat/crypto");
  const apply = argv.includes("--apply");
  await connectDB();
  try {
    const counts = await backfillSearchKeys({ LcConversation, decryptLiveChatText, searchKeysOf, apply });
    console.log(`[live-chat search keys] ${apply ? "APPLY" : "DRY RUN"}`);
    for (const [key, value] of Object.entries(counts)) console.log(`  ${key}: ${value}`);
    if (!apply) console.log("  (nothing written; pass --apply to write)");
    return 0;
  } finally {
    await mongoose.disconnect();
  }
}

module.exports = { backfillSearchKeys, main };

if (require.main === module) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(`backfill failed: ${err?.name || "Error"}`);
      process.exit(1);
    }
  );
}
