const path = require("path");
require("dotenv").config({
  path: path.resolve(
    __dirname,
    "..",
    process.env.NODE_ENV === "production" ? ".env.production" : ".env"
  ),
});

const connectDB = require("../config/db");
const User = require("../models/User");
const { generatePatientId } = require("../utils/idSequence");

async function backfillPatientIds() {
  await connectDB();

  const users = await User.find({
    role: "user",
    $or: [
      { patientId: { $exists: false } },
      { patientId: null },
      { patientId: "" },
      { patientId: { $type: "string" } },
      { patientId: { $lt: 10000 } },
      { patientId: { $gt: 99999 } },
    ],
  }).select("_id email name patientId");

  let updated = 0;
  for (const user of users) {
    await User.collection.updateOne(
      { _id: user._id },
      { $set: { patientId: await generatePatientId() } }
    );
    updated += 1;
  }

  console.log(`Backfilled ${updated} patient IDs.`);
  process.exit(0);
}

backfillPatientIds().catch((error) => {
  console.error("Patient ID backfill failed:", error);
  process.exit(1);
});
