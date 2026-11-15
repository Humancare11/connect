const mongoose = require("mongoose");
const { lockAgainstUpdates } = require("../utils/lockUpdates");

const medicineSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  dosage:    { type: String, default: "" },
  frequency: { type: String, default: "" },
  duration:  { type: String, default: "" },
  notes:     { type: String, default: "" },
}, { _id: false });

const prescriptionSchema = new mongoose.Schema(
  {
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", required: true },
    doctorId:      { type: mongoose.Schema.Types.ObjectId, ref: "Doctor",      required: true },
    patientId:     { type: mongoose.Schema.Types.ObjectId, ref: "User",        required: true },
    // Legacy plaintext fields — no longer written (see controllers/medicalController.js,
    // which now encrypts diagnosis/medicines/instructions/followUpDate into
    // cipherText below via utils/phiCrypto.js), kept only so prescriptions
    // created before this change stay readable without a data migration.
    diagnosis:     { type: String, default: undefined },
    medicines:     { type: [medicineSchema], default: undefined },
    instructions:  { type: String, default: undefined },
    followUpDate:  { type: String, default: undefined },
    // PHI at rest, AES-256-GCM-encrypted blob of { diagnosis, medicines, instructions, followUpDate }.
    cipherText:    { type: String, default: "" },
    iv:            { type: String, default: "" },
    authTag:       { type: String, default: "" },
    keyVersion:    { type: String, default: "" },
    // Optional doctor signature (see utils/documentSignature.js). Private S3 key of THIS prescription's own copy;
    // never sent to clients. Absent on prescriptions issued unsigned or before signing existed.
    signatureKey:  { type: String, default: "" },
    signedAt:      { type: Date },
    signedBy:      { name: { type: String, default: "" }, registrationNumber: { type: String, default: "" } },
  },
  { timestamps: true }
);

// Write-once: updates are rejected, deletes (retention job) are not.
lockAgainstUpdates(prescriptionSchema, "Prescriptions");

module.exports = mongoose.model("Prescription", prescriptionSchema);
