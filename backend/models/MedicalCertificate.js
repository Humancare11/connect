const mongoose = require("mongoose");
const { lockAgainstUpdates } = require("../utils/lockUpdates");

const medicalCertificateSchema = new mongoose.Schema(
  {
    appointmentId:   { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", required: true },
    doctorId:        { type: mongoose.Schema.Types.ObjectId, ref: "Doctor",      required: true },
    patientId:       { type: mongoose.Schema.Types.ObjectId, ref: "User",        required: true },
    // Legacy plaintext fields — no longer written (see controllers/medicalController.js,
    // which now encrypts these into cipherText below via utils/phiCrypto.js),
    // kept only so certificates created before this change stay readable
    // without a data migration.
    diagnosis:       { type: String, default: undefined },
    recommendation:  { type: String, default: undefined },
    restFromDate:    { type: String, default: undefined },
    restToDate:      { type: String, default: undefined },
    notes:           { type: String, default: undefined },
    // PHI at rest, AES-256-GCM-encrypted blob of { diagnosis, recommendation, restFromDate, restToDate, notes }.
    cipherText:      { type: String, default: "" },
    iv:              { type: String, default: "" },
    authTag:         { type: String, default: "" },
    keyVersion:      { type: String, default: "" },
    // Optional doctor signature (see utils/documentSignature.js). Private S3 key of THIS certificate's own copy;
    // never sent to clients. Absent on certificates issued unsigned or before signing existed.
    signatureKey:    { type: String, default: "" },
    signedAt:        { type: Date },
    signedBy:        { name: { type: String, default: "" }, registrationNumber: { type: String, default: "" } },
    issuedDate:      { type: String, required: true },
  },
  { timestamps: true }
);

// Write-once: updates are rejected, deletes (retention job) are not.
lockAgainstUpdates(medicalCertificateSchema, "Medical certificates");

module.exports = mongoose.model("MedicalCertificate", medicalCertificateSchema);
