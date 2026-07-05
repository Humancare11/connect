const mongoose = require("mongoose");

const consultationNoteSchema = new mongoose.Schema(
  {
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
      index: true,
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
    content: {
      type: String,
      default: "",
      maxlength: 20000,
    },
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
