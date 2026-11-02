const { PutObjectCommand } = require("@aws-sdk/client-s3");
const MedicalReport = require("../models/MedicalReport");
const { s3Client, getBucketName } = require("../config/s3");
const { encryptPHI, decryptPHI } = require("./phiCrypto");
const { buildMedicalReportPdfBuffer, SECTIONS } = require("./medicalReportPdf");
const { nextSequenceValue } = require("./idSequence");
const { sendPushToUser } = require("./pushNotifications");

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const ACCESS_LOG_MAX = 200;
const FIELD_KEYS = SECTIONS.map(([key]) => key);
const MAX_FIELD_LENGTH = 5000;
const DEFAULT_DOCTOR_NAME = "Issued by Humancare";

// Dedicated prefix in the private uploads bucket. The bucket is shared between dev and prod, so
// non-production runs write under their own prefix: MEDICAL_REPORT_S3_PREFIX if set, else
// "medical-reports" in production and "medical-reports-dev" everywhere else. Resolved on every
// call (not at load) so it always reflects the current environment.
// Objects are never public: they are only handed out as short-lived presigned URLs after a
// role / ownership check.
function resolveReportPrefix(env = process.env) {
  const configured = String(env.MEDICAL_REPORT_S3_PREFIX || "").trim().replace(/^\/+|\/+$/g, "");
  if (configured) return configured;
  return env.NODE_ENV === "production" ? "medical-reports" : "medical-reports-dev";
}

// "MR-000042" — one global counter (atomic $inc), never reused, even for voided/deleted reports.
async function nextReportNumber() {
  const value = await nextSequenceValue("medical-report", { initialValue: 0 });
  return `MR-${String(value).padStart(6, "0")}`;
}

class ReportValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

// Type must be application/pdf AND the bytes must start with the PDF magic number, so a
// renamed file (or a client-supplied mimetype) can't smuggle anything else in.
function validatePdfUpload(file) {
  if (!file || !file.buffer || !file.buffer.length) throw new ReportValidationError("Choose a PDF file to upload.");
  if (file.mimetype !== "application/pdf") throw new ReportValidationError("Only PDF files are allowed.");
  if (file.buffer.length > MAX_PDF_BYTES) throw new ReportValidationError("The PDF must be 10 MB or smaller.");
  if (file.buffer.subarray(0, 5).toString("latin1") !== "%PDF-") throw new ReportValidationError("That file is not a valid PDF.");
  return file;
}

// Trims and length-checks the optional clinical fields. Unknown keys are dropped.
function cleanClinicalFields(raw = {}) {
  const out = {};
  for (const key of FIELD_KEYS) {
    const value = typeof raw[key] === "string" ? raw[key].trim() : "";
    if (value.length > MAX_FIELD_LENGTH) throw new ReportValidationError(`"${key}" is too long (max ${MAX_FIELD_LENGTH} characters).`);
    if (value) out[key] = value;
  }
  return out;
}

async function putReportPdf(key, buffer) {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      Body: buffer,
      ContentType: "application/pdf",
      ContentLength: buffer.length,
      ServerSideEncryption: "AES256",
    })
  );
}

async function createMedicalReport({ reportType, patient, issuedBy, issuedByRole, title, reportDate, doctorName, content, file, notify = true }) {
  const reportNumber = await nextReportNumber();
  const doctor = doctorName || DEFAULT_DOCTOR_NAME;

  let pdfBuffer;
  let originalFilename = "";
  if (reportType === "uploaded") {
    pdfBuffer = file.buffer;
    originalFilename = String(file.originalname || "").slice(0, 200);
  } else {
    pdfBuffer = await buildMedicalReportPdfBuffer({
      reportNumber,
      title,
      reportDate,
      doctorName: doctor,
      patient: { name: patient.name, patientId: patient.patientId, dob: patient.dob, gender: patient.gender },
      content,
    });
  }

  const pdfKey = `${resolveReportPrefix()}/${patient._id}/${reportNumber}.pdf`;
  await putReportPdf(pdfKey, pdfBuffer);

  const hasContent = Object.keys(content || {}).length > 0;
  const report = await MedicalReport.create({
    reportNumber,
    reportType,
    patientId: patient._id,
    title,
    reportDate,
    issuedBy,
    issuedByRole,
    doctorName: doctor,
    ...(hasContent ? encryptPHI(content) : {}),
    pdfKey,
    originalFilename,
  });

  if (notify) {
    // Generic text only — no clinical detail ever leaves the server in a push payload.
    await sendPushToUser(patient._id, {
      title: "Humancare Connect",
      body: "A new medical report is available",
      data: { type: "medical-report" },
    });
    // sendPushToUser never throws and does not report delivery, so this records "push attempted".
    report.patientNotifiedAt = new Date();
    await report.save();
  }
  return report;
}

// Metadata only — no clinical content, no storage key. Shared by the admin list and the patient list.
function serializeReport(doc, { forAdmin = false } = {}) {
  const issuer = doc.issuedBy && typeof doc.issuedBy === "object" && doc.issuedBy.name ? doc.issuedBy : null;
  const patient = doc.patientId && typeof doc.patientId === "object" && doc.patientId.name ? doc.patientId : null;
  const base = {
    _id: doc._id,
    reportNumber: doc.reportNumber,
    reportType: doc.reportType,
    title: doc.title,
    reportDate: doc.reportDate,
    doctorName: doc.doctorName,
    status: doc.status,
    createdAt: doc.createdAt,
  };
  if (!forAdmin) return base;
  return {
    ...base,
    patient: patient
      ? { _id: patient._id, name: patient.name, email: patient.email, patientId: patient.patientId }
      : { _id: String(doc.patientId?._id || doc.patientId) },
    issuedByRole: doc.issuedByRole,
    issuedBy: issuer ? { name: issuer.name, email: issuer.email } : undefined,
    originalFilename: doc.originalFilename || undefined,
    voidedAt: doc.voidedAt || undefined,
    voidReason: doc.voidReason || undefined,
    isDeleted: Boolean(doc.isDeleted),
    deletedAt: doc.deletedAt || undefined,
    patientNotifiedAt: doc.patientNotifiedAt || undefined,
  };
}

// Appends { userId, role, action, at } to the report's accessLog, keeping only the newest
// ACCESS_LOG_MAX entries ($slice, so the cap is applied atomically in the same update).
// Called before a download link is issued, so a failed write means no link.
async function logReportAccess(reportId, user, action = "download") {
  await MedicalReport.updateOne(
    { _id: reportId },
    { $push: { accessLog: { $each: [{ userId: user.id, role: user.role, action, at: new Date() }], $slice: -ACCESS_LOG_MAX } } }
  );
}

function readClinicalContent(doc) {
  try {
    return decryptPHI(doc) || {};
  } catch {
    return {};
  }
}

module.exports = {
  MAX_PDF_BYTES,
  MAX_FIELD_LENGTH,
  ACCESS_LOG_MAX,
  FIELD_KEYS,
  DEFAULT_DOCTOR_NAME,
  resolveReportPrefix,
  ReportValidationError,
  validatePdfUpload,
  cleanClinicalFields,
  createMedicalReport,
  serializeReport,
  readClinicalContent,
  logReportAccess,
};
