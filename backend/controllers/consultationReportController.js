const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");
const ConsultationNote = require("../models/ConsultationNote");
const ConsultationReport = require("../models/ConsultationReport");
const ConsultationReportAmendment = require("../models/ConsultationReportAmendment");
const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const { recordActivity } = require("../utils/activityLogger");
const { streamPng } = require("../utils/visitNoteStorage");
const {
  ReportError, finaliseNote, addAmendment, serializeReport, attachAmendments, serializeAmendment,
} = require("../utils/consultationReportService");

const isObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));
const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const DONE_STATUSES = ["complete", "completed"];

const fail = (res, err, fallback) => {
  if (err instanceof ReportError) return res.status(err.statusCode).json({ msg: err.message, ...err.extra });
  console.error(fallback, err);
  return res.status(500).json({ msg: fallback });
};

const noStore = (res) => res.set("Cache-Control", "private, no-store");

// Audit trail must never break the request it describes.
const audit = async (req, entry) => {
  try {
    await recordActivity(req, entry);
  } catch (err) {
    console.error("visit note audit failed:", err?.message);
  }
};

// ── Doctor ────────────────────────────────────────────────────────────────────

// POST /api/consultation-reports  { noteId, confirm: true }
const createReport = async (req, res) => {
  try {
    const report = await finaliseNote({ doctorId: req.user.id, noteId: req.body?.noteId, confirm: req.body?.confirm });
    await audit(req, { action: "VISIT_NOTE_FINALISED", resource: "ConsultationReport", patientId: report.patientId, details: { reportNumber: report.reportNumber } });
    noStore(res);
    return res.status(201).json({ report: serializeReport(report) });
  } catch (err) {
    return fail(res, err, "Failed to add to Visit Note.");
  }
};

const listDoctorReports = async (req, res) => {
  try {
    const query = { doctorId: req.user.id };
    if (req.params.patientId) {
      if (!isObjectId(req.params.patientId)) return res.status(400).json({ msg: "Invalid patient ID." });
      query.patientId = req.params.patientId;
    }
    const reports = await ConsultationReport.find(query).sort({ signedAt: -1 }).limit(250).lean();
    noStore(res);
    return res.status(200).json({ reports: await attachAmendments(reports) });
  } catch (err) {
    return fail(res, err, "Failed to fetch Visit Notes.");
  }
};

// GET /api/consultation-reports/doctor/states -> { states: { [appointmentId]: { state, noteId, reportId } } }
// Drives the Draft / Signed state on the doctor's Appointments page in one request.
const doctorStates = async (req, res) => {
  try {
    const notes = await ConsultationNote.find({ doctorId: req.user.id }).select("appointmentId reportId").lean();
    const states = {};
    for (const n of notes) {
      states[String(n.appointmentId)] = { state: n.reportId ? "signed" : "draft", noteId: n._id, reportId: n.reportId || null };
    }
    noStore(res);
    return res.status(200).json({ states });
  } catch (err) {
    return fail(res, err, "Failed to fetch Visit Note states.");
  }
};

// Everything the Review screen needs besides the note itself.
const reviewInfo = async (req, res) => {
  try {
    const [doctor, enrollment] = await Promise.all([
      Doctor.findById(req.user.id).select("name").lean(),
      Enrollment.findOne({ doctorId: req.user.id }).select("specialization country medicalRegistrationNumber signatureKey").lean(),
    ]);
    noStore(res);
    return res.status(200).json({
      physician: {
        name: doctor?.name || "",
        registrationNumber: enrollment?.medicalRegistrationNumber || "",
        speciality: enrollment?.specialization || "",
        country: enrollment?.country || "",
      },
      hasSignature: !!enrollment?.signatureKey,
    });
  } catch (err) {
    return fail(res, err, "Failed to load physician details.");
  }
};

const createAmendment = async (req, res) => {
  try {
    const row = await addAmendment({ doctorId: req.user.id, reportId: req.params.id, reason: req.body?.reason, text: req.body?.text });
    await audit(req, { action: "VISIT_NOTE_AMENDED", resource: "ConsultationReport", details: { reportId: req.params.id } });
    return res.status(201).json({ amendment: serializeAmendment(row) });
  } catch (err) {
    return fail(res, err, "Failed to add amendment.");
  }
};

// ── Patient ───────────────────────────────────────────────────────────────────

// Finalised reports of the signed-in patient, newest first, plus "Report pending" completed consultations.
// Drafts are never read here: only the ConsultationReport collection is queried for content.
const listMine = async (req, res) => {
  try {
    const reports = await ConsultationReport.find({ patientId: req.user.id }).sort({ signedAt: -1 }).limit(250).lean();
    const have = new Set(reports.map((r) => String(r.appointmentId)));

    const [appts, ccs] = await Promise.all([
      Appointment.find({ patientId: req.user.id, status: { $in: DONE_STATUSES }, doctorId: { $ne: null } })
        .select("date time doctorId").populate("doctorId", "name").sort({ createdAt: -1 }).limit(100).lean(),
      CategoryConsultation.find({ patientId: req.user.id, status: { $in: DONE_STATUSES } })
        .select("date slot assignedSlot").sort({ createdAt: -1 }).limit(100).lean(),
    ]);
    const pending = [
      ...appts.map((a) => ({ appointmentId: a._id, date: a.date, time: a.time, doctorName: a.doctorId?.name || "" })),
      ...ccs.map((c) => ({ appointmentId: c._id, date: c.date, time: c.assignedSlot || c.slot || "", doctorName: "" })),
    ].filter((p) => !have.has(String(p.appointmentId)));

    noStore(res);
    return res.status(200).json({ reports: await attachAmendments(reports), pending });
  } catch (err) {
    return fail(res, err, "Failed to fetch your Visit Notes.");
  }
};

// ── Admin ─────────────────────────────────────────────────────────────────────

const listAdmin = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const q = String(req.query.q || "").trim().slice(0, 100);
    const query = {};
    if (q) {
      const rx = { $regex: escapeRegex(q), $options: "i" };
      query.$or = [{ reportNumber: rx }, { "patient.name": rx }];
    }
    const [total, reports] = await Promise.all([
      ConsultationReport.countDocuments(query),
      ConsultationReport.find(query).sort({ signedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ]);
    noStore(res);
    return res.status(200).json({ reports: await attachAmendments(reports), total, page, limit });
  } catch (err) {
    return fail(res, err, "Failed to fetch Visit Notes.");
  }
};

// ── Single report + signature, scoped per role ────────────────────────────────

// scope(req) returns the extra filter that confines the lookup to what this role may see. A report outside the scope
// is a 404 (never a 403) so ids cannot be probed.
const getOne = (scope, auditAction) => async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ msg: "Invalid report ID." });
    const report = await ConsultationReport.findOne({ _id: req.params.id, ...scope(req) }).lean();
    if (!report) return res.status(404).json({ msg: "Visit Note not found." });
    const amendments = await ConsultationReportAmendment.find({ reportId: report._id }).sort({ createdAt: 1 }).lean();
    if (auditAction) await audit(req, { action: auditAction, resource: "ConsultationReport", patientId: report.patientId, details: { reportNumber: report.reportNumber } });
    noStore(res);
    return res.status(200).json({ report: serializeReport(report, amendments) });
  } catch (err) {
    return fail(res, err, "Failed to fetch Visit Note.");
  }
};

const getSignature = (scope) => async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ msg: "Invalid report ID." });
    const report = await ConsultationReport.findOne({ _id: req.params.id, ...scope(req) }).select("signatureKey").lean();
    if (!report) return res.status(404).json({ msg: "Visit Note not found." });
    return streamPng(res, report.signatureKey);
  } catch (err) {
    return fail(res, err, "Failed to load signature.");
  }
};

module.exports = {
  createReport, listDoctorReports, doctorStates, reviewInfo, createAmendment, listMine, listAdmin, getOne, getSignature,
};
