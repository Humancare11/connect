const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const multer = require("multer");
const MedicalReport = require("../models/MedicalReport");
const User = require("../models/User");
const { verifyAdminToken, adminOnly } = require("../middleware/verifyToken");
const { createS3PresignedGetUrl } = require("../utils/s3PresignedUrl");
const { recordActivity } = require("../utils/activityLogger");
const {
  MAX_PDF_BYTES,
  DEFAULT_DOCTOR_NAME,
  ReportValidationError,
  validatePdfUpload,
  cleanClinicalFields,
  createMedicalReport,
  serializeReport,
  readClinicalContent,
  logReportAccess,
} = require("../utils/medicalReportService");

const MAX_TITLE = 150;
const MAX_DOCTOR_NAME = 120;
const MAX_VOID_REASON = 500;

const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// JSON for the typed template; multipart/form-data (field "file") for an uploaded PDF.
// The size limit is enforced while streaming, the type and magic bytes afterwards.
const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_BYTES, files: 1, fields: 20, fieldSize: 20_000 },
}).single("file");

const parseBody = (req, res, next) => {
  if (!req.is("multipart/form-data")) return next();
  uploader(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      const msg = err.code === "LIMIT_FILE_SIZE" ? "The PDF must be 10 MB or smaller." : "The upload could not be read.";
      return res.status(status).json({ msg });
    }
    return res.status(400).json({ msg: "The upload could not be read." });
  });
};

const text = (value) => (typeof value === "string" ? value.trim() : "");

const parseReportDate = (raw) => {
  const value = text(raw);
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/* POST /api/admin/medical-reports
   Issues a report to one patient: either generated from the typed template or an
   uploaded PDF. Admin + superadmin only. Reports are never edited (see :id/void). */
router.post("/", verifyAdminToken, adminOnly, parseBody, async (req, res) => {
  try {
    const body = req.body || {};
    const reportType = text(body.reportType);
    if (!["generated", "uploaded"].includes(reportType)) {
      return res.status(400).json({ msg: "Choose a valid report type." });
    }
    if (!mongoose.isValidObjectId(body.patientId)) {
      return res.status(400).json({ msg: "Select a patient." });
    }

    const title = text(body.title);
    const doctorName = text(body.doctorName) || DEFAULT_DOCTOR_NAME;
    const reportDate = parseReportDate(body.reportDate);
    if (!title) return res.status(400).json({ msg: "A report title is required." });
    if (title.length > MAX_TITLE) return res.status(400).json({ msg: "The title is too long." });
    if (doctorName.length > MAX_DOCTOR_NAME) return res.status(400).json({ msg: "The doctor name is too long." });
    if (!reportDate) return res.status(400).json({ msg: "A valid report date is required." });

    // Patient accounts only — never an admin, doctor or other staff login.
    const patient = await User.findOne({ _id: body.patientId, role: "user" })
      .select("name email patientId dob gender")
      .lean();
    if (!patient) return res.status(404).json({ msg: "Patient not found." });

    const content = cleanClinicalFields(body);
    let file = null;
    if (reportType === "uploaded") {
      file = validatePdfUpload(req.file);
    } else {
      if (req.file) return res.status(400).json({ msg: "A file can only be attached to an uploaded report." });
      if (!Object.keys(content).length) {
        return res.status(400).json({ msg: "Fill in at least one section of the report." });
      }
    }

    const report = await createMedicalReport({
      reportType,
      patient,
      issuedBy: req.user.id,
      issuedByRole: req.user.role,
      title,
      reportDate,
      doctorName,
      content,
      file,
      notify: body.notify !== false && body.notify !== "false" && body.notify !== "0",
    });

    await recordActivity(req, {
      action: "PHI_CREATE_MEDICAL_REPORT",
      resource: "MedicalReport",
      resourceId: report._id,
      patientId: patient._id,
      details: { reportNumber: report.reportNumber, reportType },
    });

    res.status(201).json({ report: serializeReport(report, { forAdmin: true }) });
  } catch (err) {
    if (err instanceof ReportValidationError) return res.status(err.status).json({ msg: err.message });
    console.error("create medical report error:", err.message);
    res.status(500).json({ msg: "Failed to issue the medical report. Please try again." });
  }
});

/* GET /api/admin/medical-reports
   Paged history. Soft-deleted reports are hidden unless includeDeleted=1.
   Filters: q (report no. / title / patient name / email), patientId, status. */
router.get("/", verifyAdminToken, adminOnly, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const query = {};
    if (req.query.includeDeleted !== "1") query.isDeleted = { $ne: true };
    if (["active", "voided"].includes(req.query.status)) query.status = req.query.status;
    if (req.query.patientId) {
      if (!mongoose.isValidObjectId(req.query.patientId)) return res.status(400).json({ msg: "Invalid patient id." });
      query.patientId = req.query.patientId;
    }
    const q = text(req.query.q).slice(0, 100);
    if (q) {
      const pattern = new RegExp(escapeRegex(q), "i");
      const matchingPatients = await User.find({ role: "user", $or: [{ name: pattern }, { email: pattern }] })
        .select("_id")
        .limit(200)
        .lean();
      query.$or = [
        { reportNumber: pattern },
        { title: pattern },
        { patientId: { $in: matchingPatients.map((p) => p._id) } },
      ];
    }

    const [reports, total] = await Promise.all([
      MedicalReport.find(query)
        .populate("patientId", "name email patientId")
        .populate("issuedBy", "name email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      MedicalReport.countDocuments(query),
    ]);

    res.json({
      reports: reports.map((r) => serializeReport(r, { forAdmin: true })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    console.error("list medical reports error:", err.message);
    res.status(500).json({ msg: "Failed to load medical reports." });
  }
});

const loadOr404 = async (req, res, { allowDeleted = false } = {}) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ msg: "Invalid report id." });
    return null;
  }
  const report = await MedicalReport.findById(req.params.id);
  if (!report || (report.isDeleted && !allowDeleted)) {
    res.status(404).json({ msg: "Report not found." });
    return null;
  }
  return report;
};

/* GET /api/admin/medical-reports/:id — one report with its decrypted clinical content. */
router.get("/:id", verifyAdminToken, adminOnly, async (req, res) => {
  try {
    const report = await loadOr404(req, res);
    if (!report) return;
    await recordActivity(req, {
      action: "PHI_VIEW_MEDICAL_REPORT",
      resource: "MedicalReport",
      resourceId: report._id,
      patientId: report.patientId,
    });
    const accessLog = (report.accessLog || []).map((e) => ({ userId: e.userId, role: e.role, action: e.action, at: e.at }));
    res.json({ report: { ...serializeReport(report, { forAdmin: true }), content: readClinicalContent(report), accessLog } });
  } catch (err) {
    console.error("get medical report error:", err.message);
    res.status(500).json({ msg: "Failed to load the report." });
  }
});

/* GET /api/admin/medical-reports/:id/download — short-lived presigned S3 URL. */
router.get("/:id/download", verifyAdminToken, adminOnly, async (req, res) => {
  try {
    const report = await loadOr404(req, res, { allowDeleted: true });
    if (!report) return;
    const signed = await createS3PresignedGetUrl(report.pdfKey, { expiresIn: 300 });
    await logReportAccess(report._id, req.user, "download");
    await recordActivity(req, {
      action: "PHI_DOWNLOAD_MEDICAL_REPORT",
      resource: "MedicalReport",
      resourceId: report._id,
      patientId: report.patientId,
    });
    res.json({ url: signed.url, reportNumber: report.reportNumber, expiresAt: signed.expiresAt });
  } catch (err) {
    console.error("medical report download error:", err.message);
    res.status(500).json({ msg: "Failed to generate download link." });
  }
});

/* POST /api/admin/medical-reports/:id/void   { reason }
   The correction path (reports have no edit endpoint). The patient then sees the report
   as "Voided"; the admin issues a new report. */
router.post("/:id/void", verifyAdminToken, adminOnly, async (req, res) => {
  try {
    const reason = text(req.body?.reason);
    if (reason.length < 3) return res.status(400).json({ msg: "Enter a reason for voiding this report." });
    if (reason.length > MAX_VOID_REASON) return res.status(400).json({ msg: "The reason is too long." });

    const report = await loadOr404(req, res);
    if (!report) return;
    if (report.status === "voided") return res.status(409).json({ msg: "This report is already voided." });

    report.status = "voided";
    report.voidedAt = new Date();
    report.voidedBy = req.user.id;
    report.voidReason = reason;
    await report.save();

    await recordActivity(req, {
      action: "PHI_VOID_MEDICAL_REPORT",
      resource: "MedicalReport",
      resourceId: report._id,
      patientId: report.patientId,
      details: { reportNumber: report.reportNumber, reason },
    });
    res.json({ report: serializeReport(report, { forAdmin: true }) });
  } catch (err) {
    console.error("void medical report error:", err.message);
    res.status(500).json({ msg: "Failed to void the report." });
  }
});

/* DELETE /api/admin/medical-reports/:id
   Soft delete: hides the report from the patient and from the default list. The row and
   the S3 object are kept. */
router.delete("/:id", verifyAdminToken, adminOnly, async (req, res) => {
  try {
    const report = await loadOr404(req, res);
    if (!report) return;

    report.isDeleted = true;
    report.deletedAt = new Date();
    report.deletedBy = req.user.id;
    await report.save();

    await recordActivity(req, {
      action: "PHI_DELETE_MEDICAL_REPORT",
      resource: "MedicalReport",
      resourceId: report._id,
      patientId: report.patientId,
      details: { reportNumber: report.reportNumber },
    });
    res.json({ msg: "Report deleted." });
  } catch (err) {
    console.error("delete medical report error:", err.message);
    res.status(500).json({ msg: "Failed to delete the report." });
  }
});

module.exports = router;
