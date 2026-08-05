const mongoose = require("mongoose");

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
  },
  { timestamps: true }
);

module.exports = mongoose.model("Prescription", prescriptionSchema);
