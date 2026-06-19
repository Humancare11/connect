const Counter = require("../models/Counter");

const PATIENT_SEQUENCE_NAME = "patient";
const PATIENT_ID_INITIAL_VALUE = 9999;
const PATIENT_ID_MAX_VALUE = 99999;

async function nextSequenceValue(name, options = {}) {
  const initialValue = Number.isFinite(Number(options.initialValue)) ? Number(options.initialValue) : 0;

  try {
    await Counter.updateOne(
      { _id: name },
      { $setOnInsert: { value: initialValue } },
      { upsert: true }
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }

  await Counter.updateOne(
    { _id: name, value: { $lt: initialValue } },
    { $set: { value: initialValue } }
  );

  const counter = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { value: 1 } },
    { returnDocument: 'after' }
  ).lean();

  return counter.value;
}

async function generatePatientId() {
  const value = await nextSequenceValue(PATIENT_SEQUENCE_NAME, { initialValue: PATIENT_ID_INITIAL_VALUE });
  if (value > PATIENT_ID_MAX_VALUE) {
    throw new Error("Patient ID range exhausted.");
  }
  return value;
}

module.exports = {
  generatePatientId,
  nextSequenceValue,
  PATIENT_SEQUENCE_NAME,
  PATIENT_ID_INITIAL_VALUE,
  PATIENT_ID_MAX_VALUE,
};

