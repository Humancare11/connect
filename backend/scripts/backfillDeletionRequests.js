// Backfills the account-deletion history (AccountDeletionRequest) from users
// that still carry a deletion request: status "pending" or "rejected".
//
// What can and cannot be recovered:
//   - pending / rejected requests: recoverable from the user record (name,
//     email, patient ID, reason, dates). The deciding admin and the request
//     source are unknown, so those rows are marked backfilled with an empty
//     source ("Unknown" in the admin list).
//   - requests that were already APPROVED (user deleted) or CANCELLED were never
//     saved anywhere (activity logging is a no-op) and cannot be recovered here.
//
// Safe to re-run: a user who already has a row for the same request is skipped.
//
// DRY RUN by default — reads only, writes nothing. Pass --apply to write.
//
// Usage (from backend/):
//   node scripts/backfillDeletionRequests.js            # dry run
//   node scripts/backfillDeletionRequests.js --apply    # write the rows
//   NODE_ENV=production node scripts/backfillDeletionRequests.js [--apply]
//     (production loads .env.production, like the other backfill scripts)
const path = require("path");
require("dotenv").config({
  path: path.resolve(
    __dirname,
    "..",
    process.env.NODE_ENV === "production" ? ".env.production" : ".env"
  ),
});

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const AccountDeletionRequest = require("../models/AccountDeletionRequest");

const APPLY = process.argv.includes("--apply");

const maskEmail = (email) => {
  const [local = "", domain = ""] = String(email || "").split("@");
  return `${local.slice(0, 1)}***@${domain}`;
};

function rowFor(user) {
  const status = user.deletionRequestStatus; // "pending" | "rejected"
  const requestedAt =
    user.deletionRequestedAt || user.deletionRejectedAt || user.updatedAt || user.createdAt || new Date();
  return {
    userId: user._id,
    patientId: Number.isFinite(Number(user.patientId)) && user.patientId != null ? Number(user.patientId) : null,
    name: user.name || "",
    email: user.email || "",
    reason: String(user.deletionReason || "").trim().slice(0, 500),
    status,
    requestedAt,
    decidedAt: status === "rejected" ? user.deletionRejectedAt || null : null,
    decidedBy: null,
    decidedVia: "",
    emails: { requested: false, decision: false },
    requestSource: {},
    backfilled: true,
  };
}

async function main() {
  await connectDB();
  console.log(APPLY ? "MODE: APPLY (writing rows)" : "MODE: DRY RUN (nothing is written; pass --apply to write)");

  const users = await User.find({
    role: "user",
    deletionRequestStatus: { $in: ["pending", "rejected"] },
  })
    .select("name email patientId deletionRequestStatus deletionReason deletionRequestedAt deletionRejectedAt createdAt updatedAt")
    .lean();

  const toCreate = [];
  let skipped = 0;
  for (const user of users) {
    const row = rowFor(user);
    // A pending user already has an open row if one exists; a rejected user is
    // skipped when a row for that same request (same date) already exists.
    const existing = await AccountDeletionRequest.findOne(
      row.status === "pending"
        ? { userId: user._id, status: "pending" }
        : { userId: user._id, requestedAt: row.requestedAt }
    )
      .select("_id")
      .lean();
    if (existing) {
      skipped += 1;
      continue;
    }
    toCreate.push(row);
  }

  const byStatus = (status) => toCreate.filter((r) => r.status === status).length;
  console.log(`Users with a pending/rejected request: ${users.length}`);
  console.log(`  already in the history (skipped):    ${skipped}`);
  console.log(`  rows to create:                      ${toCreate.length} (pending ${byStatus("pending")}, rejected ${byStatus("rejected")})`);
  console.log("  Not recoverable: requests already approved (user deleted) or cancelled.");

  if (toCreate.length) {
    console.log("\nRows (email masked):");
    for (const r of toCreate) {
      console.log(
        `  ${String(r.patientId ?? "-").padStart(5)}  ${r.status.padEnd(8)}  ${new Date(r.requestedAt).toISOString().slice(0, 10)}  ${maskEmail(r.email)}`
      );
    }
  }

  if (!APPLY) {
    console.log("\nDry run complete. Re-run with --apply to write these rows.");
    return;
  }

  if (!toCreate.length) {
    console.log("\nNothing to write.");
    return;
  }

  await AccountDeletionRequest.createIndexes();
  let inserted = 0;
  try {
    const result = await AccountDeletionRequest.insertMany(toCreate, { ordered: false });
    inserted = result.length;
  } catch (err) {
    // ordered:false keeps going past duplicate-key errors (e.g. a pending row
    // created by a user in the meantime); report what did get written.
    inserted = err.insertedDocs ? err.insertedDocs.length : err.result?.insertedCount || 0;
    console.warn(`Some rows were not inserted (${err.message}).`);
  }
  console.log(`\nInserted ${inserted} of ${toCreate.length} rows.`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
