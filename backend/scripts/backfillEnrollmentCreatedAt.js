const path = require("path");
require("dotenv").config({
  path: path.resolve(
    __dirname,
    "..",
    process.env.NODE_ENV === "production" ? ".env.production" : ".env"
  ),
});

const connectDB = require("../config/db");
const Enrollment = require("../models/Enrollment");

// One-time migration: Enrollment now uses Mongoose's built-in `timestamps`
// option (createdAt/updatedAt). Existing documents predate that change and
// have no createdAt, so we derive it from each document's ObjectId, which
// embeds the actual creation time to the nearest second.
async function backfillEnrollmentCreatedAt() {
  await connectDB();

  const enrollments = await Enrollment.find({
    createdAt: { $exists: false },
  }).select("_id");

  if (enrollments.length === 0) {
    console.log("No enrollments missing createdAt. Nothing to do.");
    process.exit(0);
  }

  const bulkOps = enrollments.map((doc) => ({
    updateOne: {
      filter: { _id: doc._id },
      update: { $set: { createdAt: doc._id.getTimestamp() } },
    },
  }));

  const result = await Enrollment.collection.bulkWrite(bulkOps);
  console.log(
    `Backfilled createdAt for ${result.modifiedCount} of ${enrollments.length} enrollment(s).`
  );
  process.exit(0);
}

backfillEnrollmentCreatedAt().catch((error) => {
  console.error("Enrollment createdAt backfill failed:", error);
  process.exit(1);
});
