const mongoose = require("mongoose");

const medicalCertificateSchema = new mongoose.Schema(
  {
    appointmentId:   { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", required: true },
    doctorId:        { type: mongoose.Schema.Types.ObjectId, ref: "Doctor",      required: true },
    patientId:       { type: mongoose.Schema.Types.ObjectId, ref: "User",        required: true },
    diagnosis:       { type: String, required: true },
    recommendation:  { type: String, default: "" },
    restFromDate:    { type: String, default: "" },
    restToDate:      { type: String, default: "" },
    notes:           { type: String, default: "" },
    issuedDate:      { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MedicalCertificate", medicalCertificateSchema);
