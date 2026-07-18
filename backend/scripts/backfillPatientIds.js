const path = require("path");
require("dotenv").config({
  path: path.resolve(
    __dirname,
    "..",
    process.env.NODE_ENV === "production" ? ".env.production" : ".env"
  ),
});

const connectDB = require("../config/db");
const Counter = require("../models/Counter");
const User = require("../models/User");
const {
  generatePatientId,
  PATIENT_SEQUENCE_NAME,
  PATIENT_ID_INITIAL_VALUE,
  PATIENT_ID_MAX_VALUE,
} = require("../utils/idSequence");

async function backfillPatientIds() {
  await connectDB();

  const [existingMax] = await User.aggregate([
    {
      $match: {
        role: "user",
        patientId: {
          $type: "number",
          $gte: PATIENT_ID_INITIAL_VALUE + 1,
          $lte: PATIENT_ID_MAX_VALUE,
        },
      },
    },
    { $group: { _id: null, maxPatientId: { $max: "$patientId" } } },
  ]);
  const counterFloor = Math.max(
    Number(existingMax?.maxPatientId || 0),
    PATIENT_ID_INITIAL_VALUE
  );

  await Counter.updateOne(
    { _id: PATIENT_SEQUENCE_NAME },
    { $setOnInsert: { value: counterFloor } },
    { upsert: true }
  );
  await Counter.updateOne(
    { _id: PATIENT_SEQUENCE_NAME, value: { $lt: counterFloor } },
    { $set: { value: counterFloor } }
  );

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

  process.exit(0);
}

backfillPatientIds().catch((error) => {
  console.error("Patient ID backfill failed:", error);
  process.exit(1);
});
