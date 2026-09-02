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

const PARTNER_SEQUENCE_NAME = "partner";
const PARTNER_CASE_SEQUENCE_NAME = "partnerCase";

// "PTR-0001" — human-friendly Partner Company identifier.
async function generatePartnerCode() {
  const value = await nextSequenceValue(PARTNER_SEQUENCE_NAME, { initialValue: 0 });
  return `PTR-${String(value).padStart(4, "0")}`;
}

// "HC-2026-000001" — human-friendly Partner Case identifier.
async function generatePartnerCaseNumber() {
  const value = await nextSequenceValue(PARTNER_CASE_SEQUENCE_NAME, { initialValue: 0 });
  return `HC-${new Date().getFullYear()}-${String(value).padStart(6, "0")}`;
}

module.exports = {
  generatePatientId,
  generatePartnerCode,
  generatePartnerCaseNumber,
  nextSequenceValue,
  PATIENT_SEQUENCE_NAME,
  PATIENT_ID_INITIAL_VALUE,
  PATIENT_ID_MAX_VALUE,
  PARTNER_SEQUENCE_NAME,
  PARTNER_CASE_SEQUENCE_NAME,
};

