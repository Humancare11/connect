const mongoose = require("mongoose");

// Admin-issued medical report for a registered patient. Two modes:
//  - "generated": the admin fills the typed template; the clinical fields are
//    encrypted (utils/phiCrypto.js) and a PDF is rendered from them.
//  - "uploaded":  the admin supplies an existing PDF; clinical fields are optional.
// Reports are never edited. A correction is a void (status "voided") followed by
// a new report. Delete is soft: the row and the S3 object are kept for audit.
const medicalReportSchema = new mongoose.Schema(
  {
    reportNumber: { type: String, required: true, unique: true, index: true },
    reportType: { type: String, enum: ["generated", "uploaded"], required: true },

    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    title: { type: String, required: true, trim: true },
    reportDate: { type: Date, required: true },

    // Who issued it. issuedByRole is "admin" or "superadmin" (a doctor-issued
    // variant can be added later without a migration).
    issuedByRole: { type: String, enum: ["admin", "superadmin"], required: true },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // Printed on the report; free text. Defaults to "Issued by Humancare".
    doctorName: { type: String, default: "Issued by Humancare", trim: true },

    // PHI at rest: AES-256-GCM blob of { chiefComplaint, history, examination,
    // investigations, diagnosis, treatment, followUp, remarks }.
    cipherText: { type: String, default: "" },
    iv: { type: String, default: "" },
    authTag: { type: String, default: "" },
    keyVersion: { type: String, default: "" },

    pdfKey: { type: String, required: true },
    originalFilename: { type: String, default: "" },

    status: { type: String, enum: ["active", "voided"], default: "active", index: true },
    voidedAt: { type: Date, default: null },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    voidReason: { type: String, default: "" },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    patientNotifiedAt: { type: Date, default: null },

    // Minimal access log: one entry per download-link issued, newest last, capped to the last
    // ACCESS_LOG_MAX entries (see logReportAccess). Read-only: shown in the admin detail view only.
    accessLog: {
      type: [
        new mongoose.Schema(
          {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
            role: { type: String, required: true },
            action: { type: String, required: true },
            at: { type: Date, required: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

medicalReportSchema.index({ patientId: 1, isDeleted: 1, createdAt: -1 });

module.exports = mongoose.model("MedicalReport", medicalReportSchema);
