const mongoose = require("mongoose");

const consultationNoteSchema = new mongoose.Schema(
  {
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "appointmentModel",
      required: true,
      index: true,
    },
    // Consultations booked through the category-consultation flow are stored
    // in a separate collection (assigned to a doctor via Enrollment rather
    // than a direct doctorId on the booking). This lets a single note point
    // at either source without two parallel note schemas.
    appointmentModel: {
      type: String,
      enum: ["Appointment", "CategoryConsultation"],
      default: "Appointment",
      required: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
      index: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Legacy single-text note. No longer written; shown as the "Note" field for notes that have no cipher blob
    // yet (utils/consultationNoteFields.js readFields) and copied into it by scripts/migrateConsultationNotes.js.
    content: {
      type: String,
      default: "",
      maxlength: 20000,
    },
    // PHI at rest: AES-256-GCM blob of { symptoms, clinicalFindings, plan, note } (utils/phiCrypto.js).
    cipherText: { type: String, default: "" },
    iv: { type: String, default: "" },
    authTag: { type: String, default: "" },
    keyVersion: { type: String, default: "" },
    // Set when the note is finalised into a Visit Note (ConsultationReport). A note with a reportId is locked forever.
    reportId: { type: mongoose.Schema.Types.ObjectId, ref: "ConsultationReport", default: null, index: true },
    status: {
      type: String,
      enum: ["draft", "final", "archived"],
      default: "draft",
      index: true,
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  },
);

consultationNoteSchema.index({ doctorId: 1, appointmentId: 1 }, { unique: true });
consultationNoteSchema.index({ doctorId: 1, updatedAt: -1 });
consultationNoteSchema.index({ doctorId: 1, patientId: 1, updatedAt: -1 });
consultationNoteSchema.index({ doctorId: 1, status: 1, updatedAt: -1 });
consultationNoteSchema.index({ content: "text" });

module.exports = mongoose.model("ConsultationNote", consultationNoteSchema);
