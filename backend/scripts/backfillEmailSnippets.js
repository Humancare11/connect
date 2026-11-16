// Backfill EmailMessage.snippetEnc for mail saved before that field existed.
//
// The mail list shows a snippet per row. New and sent mail get a small separately-encrypted
// snippet when saved; older rows only have it inside the encrypted body. Until this runs, the
// list still works (it falls back to the body for those rows) but loads and decrypts whole bodies.
//
//   node scripts/backfillEmailSnippets.js --dry-run            counts only, writes NOTHING
//   node scripts/backfillEmailSnippets.js                      does the backfill
//   options: --batch=200  --limit=5000 (stop after this many rows; useful for a trial)
//
// Safe to re-run: it only touches rows that have no snippetEnc, and only sets that one field
// (updatedAt is left alone). A row whose body cannot be decrypted is skipped and counted.
// It never prints mail content, ids, addresses or secrets: only counts.
//
// It refuses to run against the production database (assertNotProductionDb). Production needs
// the owner's separate approval AND both --allow-production and --confirm-production=YES.

const path = require("path");

const DEFAULT_BATCH = 200;

// → { total, missing, done, skipped, failed, dryRun }
// `model` is injectable so tests can run it against an in-memory database.
async function backfillSnippets({ model, dryRun = true, batchSize = DEFAULT_BATCH, limit = Infinity, log = () => {} } = {}) {
  const { decryptEmailContent, encryptSnippet } = require("../utils/emailCrypto");
  const needs = { snippetEnc: null, "content.cipherText": { $exists: true, $ne: "" } };

  const total = await model.estimatedDocumentCount();
  const missing = await model.countDocuments(needs);
  const stats = { total, missing, done: 0, skipped: 0, failed: 0, dryRun };
  log(`rows: ${total}, without a snippet envelope: ${missing}${dryRun ? " (dry run: nothing will be written)" : ""}`);

  // Dry run: prove the key can read a small sample, without writing or printing anything.
  if (dryRun) {
    const sample = await model.find(needs).select("content").limit(Math.min(50, missing)).lean();
    let readable = 0;
    for (const row of sample) {
      try {
        decryptEmailContent(row.content);
        readable += 1;
      } catch {
        stats.failed += 1;
      }
    }
    log(`sample of ${sample.length}: ${readable} readable, ${stats.failed} not readable`);
    return stats;
  }

  let lastId = null;
  let seen = 0;
  while (seen < limit) {
    const rows = await model
      .find({ ...needs, ...(lastId ? { _id: { $gt: lastId } } : {}) })
      .select("content")
      .sort({ _id: 1 })
      .limit(Math.min(batchSize, limit - seen))
      .lean();
    if (!rows.length) break;
    const ops = [];
    for (const row of rows) {
      lastId = row._id;
      seen += 1;
      try {
        const { snippet } = decryptEmailContent(row.content);
        ops.push({
          updateOne: {
            filter: { _id: row._id, snippetEnc: null },
            update: { $set: { snippetEnc: encryptSnippet(snippet || "") } },
            timestamps: false,
          },
        });
      } catch {
        stats.skipped += 1;
      }
    }
    if (ops.length) {
      const res = await model.bulkWrite(ops, { ordered: false });
      stats.done += res.modifiedCount || 0;
    }
    log(`progress: ${stats.done} written, ${stats.skipped} skipped`);
  }
  return stats;
}

function parseArgs(argv) {
  const get = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  return {
    dryRun: argv.includes("--dry-run"),
    batchSize: Math.max(1, Math.min(1000, Number(get("batch")) || DEFAULT_BATCH)),
    limit: Number(get("limit")) > 0 ? Number(get("limit")) : Infinity,
    allowProduction: argv.includes("--allow-production") && get("confirm-production") === "YES",
  };
}

async function main() {
  require("dotenv").config({ path: path.resolve(__dirname, "..", process.env.NODE_ENV === "production" ? ".env.production" : ".env") });
  const args = parseArgs(process.argv.slice(2));
  if (!args.allowProduction) {
    require("../utils/dbGuard").assertNotProductionDb({ uri: process.env.MONGO_URI });
  }
  const connectDB = require("../config/db");
  await connectDB();
  try {
    const stats = await backfillSnippets({ model: require("../models/EmailMessage"), ...args, log: (m) => console.log(`[backfill-snippets] ${m}`) });
    console.log("[backfill-snippets] finished:", JSON.stringify(stats));
  } finally {
    await require("mongoose").connection.close();
  }
}

module.exports = { backfillSnippets, parseArgs };

if (require.main === module) {
  main().catch((err) => {
    console.error("[backfill-snippets] failed:", err?.message || err);
    process.exit(1);
  });
}
