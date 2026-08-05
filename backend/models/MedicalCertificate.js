const mongoose = require("mongoose");

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
    issuedDate:      { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MedicalCertificate", medicalCertificateSchema);
