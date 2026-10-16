// One-off, safe cleanup for the move from text/multiple signatures to ONE image per admin.
//
//   node scripts/cleanupEmailSignatures.js            dry run: prints what it would do, changes nothing
//   node scripts/cleanupEmailSignatures.js --apply    does it
//
// Run it BEFORE (or right after) deploying the image-only release, on the database named by
// MONGO_URI in the env file for NODE_ENV (NODE_ENV=uat uses .env.uat). It is safe to run twice.
//
// Per admin:
//   - keeps ONE signature that has an image: the one marked default, else the most recently
//     updated, and strips it down to { owner, image, autoAdd: true, timestamps }
//   - deletes every other signature of that admin (text-only ones, extra image ones) and removes
//     the image files of the deleted ones from S3
//   - an admin with only text signatures simply ends up with none
// Then it drops the per-mailbox defaults collection and the old indexes, and builds the new one.
//
// Never touched: images that already-sent mail keeps its own copy of (email-sent-signatures/),
// mail rows, and the kept image file.
const path = require("path");
require("dotenv").config({
  path: path.resolve(
    __dirname,
    "..",
    process.env.NODE_ENV === "production" ? ".env.production" : process.env.NODE_ENV === "uat" ? ".env.uat" : ".env"
  ),
});

const OLD_FIELDS = ["name", "nameKey", "content", "layout", "imageAlt", "imageLink", "isDefault"];
const OLD_INDEXES = ["owner_1_nameKey_1", "one_default_per_owner"];

const hasImage = (d) => Boolean(d?.image?.key);

// Pure: decides, from every signature document, what to keep and what to delete.
// → { keep: [{ _id, needsStrip, needsAutoAdd }], remove: [{ _id, imageKey }] }
function planCleanup(docs) {
  const byOwner = new Map();
  for (const d of docs) {
    const k = String(d.owner);
    if (!byOwner.has(k)) byOwner.set(k, []);
    byOwner.get(k).push(d);
  }
  const keep = [];
  const remove = [];
  for (const group of byOwner.values()) {
    const withImage = group.filter(hasImage).sort((a, b) => {
      if (Boolean(b.isDefault) !== Boolean(a.isDefault)) return b.isDefault ? 1 : -1;
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0) || String(b._id).localeCompare(String(a._id));
    });
    const kept = withImage[0] || null;
    for (const d of group) {
      if (kept && d._id === kept._id) continue;
      remove.push({ _id: d._id, imageKey: hasImage(d) ? d.image.key : "" });
    }
    if (kept) {
      keep.push({
        _id: kept._id,
        needsStrip: OLD_FIELDS.some((f) => f in kept),
        needsAutoAdd: typeof kept.autoAdd !== "boolean",
      });
    }
  }
  // An admin with one already-clean document and nothing else is a no-op: keep it.
  return { keep, remove };
}

async function run({ apply }) {
  const mongoose = require("mongoose");
  const { assertNotProductionDb } = require("../utils/dbGuard");
  assertNotProductionDb({ uri: process.env.MONGO_URI });
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log(`${apply ? "APPLY" : "DRY RUN"} on database "${db.databaseName}"`);

  const sigs = db.collection("emailsignatures");
  const docs = await sigs.find({}).toArray();
  const plan = planCleanup(docs);
  const stripN = plan.keep.filter((k) => k.needsStrip || k.needsAutoAdd).length;
  const imagesToRemove = plan.remove.filter((r) => r.imageKey);
  console.log(`signatures found: ${docs.length}`);
  console.log(`  keep (one per admin that has an image): ${plan.keep.length}  (${stripN} need tidying)`);
  console.log(`  delete: ${plan.remove.length}  (image files to remove from S3: ${imagesToRemove.length})`);

  const hasDefaults = (await db.listCollections({ name: "emailsignaturedefaults" }).toArray()).length > 0;
  const indexes = (await sigs.indexes().catch(() => [])).map((i) => i.name);
  const oldIndexes = OLD_INDEXES.filter((n) => indexes.includes(n));
  console.log(`  per-mailbox defaults collection: ${hasDefaults ? "will be dropped" : "already gone"}`);
  console.log(`  old indexes to drop: ${oldIndexes.length ? oldIndexes.join(", ") : "none"}`);

  if (!apply) {
    console.log("\nNothing was changed. Run again with --apply to do it.");
    await mongoose.disconnect();
    return;
  }

  // 1. Delete the extras first, so the new one-per-admin index can be built.
  if (plan.remove.length) await sigs.deleteMany({ _id: { $in: plan.remove.map((r) => r._id) } });

  // 2. Strip the kept ones down to the new shape.
  for (const k of plan.keep) {
    const update = {};
    if (k.needsStrip) update.$unset = Object.fromEntries(OLD_FIELDS.map((f) => [f, ""]));
    if (k.needsAutoAdd) update.$set = { autoAdd: true };
    if (Object.keys(update).length) await sigs.updateOne({ _id: k._id }, update);
  }

  // 3. Old collection and indexes, then the new index.
  if (hasDefaults) await db.collection("emailsignaturedefaults").drop();
  for (const name of oldIndexes) await sigs.dropIndex(name);
  require("../models/EmailSignature");
  await mongoose.model("EmailSignature").createIndexes();

  // 4. Image files of the deleted signatures. A failure here only leaves an unused file behind.
  if (imagesToRemove.length) {
    const { createS3AttachmentStore } = require("../utils/emailAttachments");
    const store = createS3AttachmentStore();
    let removed = 0;
    for (const r of imagesToRemove) {
      try {
        await store.remove(r.imageKey);
        removed += 1;
      } catch (err) {
        console.warn(`  could not remove ${r.imageKey}: ${err.message}`);
      }
    }
    console.log(`  S3 files removed: ${removed}/${imagesToRemove.length}`);
  }

  console.log("\nDone.");
  await mongoose.disconnect();
}

module.exports = { planCleanup, run, OLD_FIELDS, OLD_INDEXES };

if (require.main === module) {
  run({ apply: process.argv.includes("--apply") }).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
