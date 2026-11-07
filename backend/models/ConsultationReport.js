const mongoose = require("mongoose");

// A finalised Visit Note ("Medical Report" in code). Created once from a ConsultationNote and then read-only forever:
// the schema hooks below reject every update/replace/delete issued through Mongoose, and the only route that writes
// here is the create in controllers/consultationReportController.js. Corrections are ConsultationReportAmendment rows.
const consultationReportSchema = new mongoose.Schema(
  {
    reportNumber: { type: String, required: true, unique: true, index: true }, // HCR-2026-0001
    noteId: { type: mongoose.Schema.Types.ObjectId, ref: "ConsultationNote", required: true, unique: true },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, refPath: "appointmentModel", required: true, unique: true },
    appointmentModel: { type: String, enum: ["Appointment", "CategoryConsultation"], default: "Appointment" },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true, index: true },

    // PHI at rest: AES-256-GCM blob of { symptoms, clinicalFindings, plan, note } (utils/phiCrypto.js).
    cipherText: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    keyVersion: { type: String, default: "" },

    // Snapshots taken at signing time, so later profile edits never change an issued report.
    patient: {
      name: { type: String, default: "" },
      gender: { type: String, default: "" },
      dob: { type: String, default: "" },
      age: { type: String, default: "" },
    },
    consultation: {
      date: { type: String, default: "" },
      time: { type: String, default: "" },
      mode: { type: String, default: "Video Consultation" },
    },
    physician: {
      name: { type: String, default: "" },
      registrationNumber: { type: String, default: "" },
      speciality: { type: String, default: "" },
      country: { type: String, default: "" },
    },

    // Private S3 key of THIS report's own copy of the signature (consultation-reports/<id>/signature.png).
    signatureKey: { type: String, required: true },
    signedAt: { type: Date, required: true },
    status: { type: String, enum: ["final"], default: "final" },
  },
  { timestamps: true }
);

consultationReportSchema.index({ doctorId: 1, signedAt: -1 });
consultationReportSchema.index({ patientId: 1, signedAt: -1 });
consultationReportSchema.index({ signedAt: -1 });
consultationReportSchema.index({ "patient.name": 1 });

const locked = () => new Error("Finalised Visit Notes are read-only. Add an amendment instead.");

consultationReportSchema.pre("save", function () {
  if (!this.isNew) throw locked();
});
consultationReportSchema.pre(
  ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace", "deleteOne", "deleteMany", "findOneAndDelete", "findOneAndRemove"],
  function () {
    throw locked();
  }
);
consultationReportSchema.pre("deleteOne", { document: true, query: false }, function () {
  throw locked();
});

module.exports = mongoose.model("ConsultationReport", consultationReportSchema);
