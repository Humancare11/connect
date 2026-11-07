const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");
const ConsultationNote = require("../models/ConsultationNote");
const ConsultationReport = require("../models/ConsultationReport");
const ConsultationReportAmendment = require("../models/ConsultationReportAmendment");
const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const User = require("../models/User");
const { encryptPHI, decryptPHI } = require("./phiCrypto");
const { nextSequenceValue } = require("./idSequence");
const { readFields, missingRequired, encryptFields, FIELD_LABELS } = require("./consultationNoteFields");
const { reportSignatureKey, copyObject } = require("./visitNoteStorage");

const MAX_AMENDMENT_REASON = 300;
const MAX_AMENDMENT_TEXT = 5000;
const DEFAULT_MODE = "Video Consultation";

class ReportError extends Error {
  constructor(message, status = 400, extra = {}) {
    super(message);
    this.name = "ReportError";
    this.statusCode = status;
    this.extra = extra;
  }
}

// HCR-<year>-<4+ digit sequence>, one counter per year.
async function nextReportNumber(now = new Date()) {
  const year = now.getFullYear();
  const value = await nextSequenceValue(`consultation-report-${year}`);
  return `HCR-${year}-${String(value).padStart(4, "0")}`;
}

function ageFromDob(dob, onDate) {
  if (!dob) return "";
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return "";
  const ref = onDate && !Number.isNaN(new Date(onDate).getTime()) ? new Date(onDate) : new Date();
  let age = ref.getFullYear() - birth.getFullYear();
  const m = ref.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age -= 1;
  return age >= 0 && age < 150 ? String(age) : "";
}

// The consultation behind a note, from either collection, reduced to what the report snapshots.
async function loadConsultation(note) {
  const user = await User.findById(note.patientId).select("name dob gender").lean();
  if (note.appointmentModel === "CategoryConsultation") {
    const cc = await CategoryConsultation.findById(note.appointmentId).select("date slot assignedSlot appointmentType urgency").lean();
    if (!cc) throw new ReportError("Appointment not found.", 404);
    const flexible = (cc.appointmentType || (cc.urgency === "flexible" ? "FLEXIBLE_TIME" : "NEXT_AVAILABLE")) === "FLEXIBLE_TIME";
    return { user, details: {}, date: cc.date || "", time: (flexible ? cc.slot : cc.assignedSlot) || "" };
  }
  const appt = await Appointment.findById(note.appointmentId).select("date time patientDetails").lean();
  if (!appt) throw new ReportError("Appointment not found.", 404);
  return { user, details: appt.patientDetails || {}, date: appt.date || "", time: appt.time || "" };
}

async function loadPhysician(doctorId) {
  const [doctor, enrollment] = await Promise.all([
    Doctor.findById(doctorId).select("name").lean(),
    Enrollment.findOne({ doctorId }).select("specialization country medicalRegistrationNumber signatureKey").lean(),
  ]);
  return { doctor, enrollment };
}

// Review & Finalise → Add to Visit Note. Order matters because there are no multi-document transactions
// (works on any Mongo deployment): validate → copy signature to a key owned by the report → insert the report
// (unique noteId/appointmentId make a double submit fail) → lock the note. A report whose note link was lost to a
// crash is re-linked on the next attempt.
async function finaliseNote({ doctorId, noteId, confirm }) {
  if (confirm !== true) throw new ReportError("Please confirm the details before adding to the Visit Note.", 400, { code: "CONFIRM_REQUIRED" });
  if (!mongoose.Types.ObjectId.isValid(String(noteId || ""))) throw new ReportError("Invalid note ID.", 400);

  const note = await ConsultationNote.findOne({ _id: noteId, doctorId });
  if (!note) throw new ReportError("Note not found or access denied.", 404);

  const existing = await ConsultationReport.findOne({ noteId: note._id }).select("_id").lean();
  if (existing || note.reportId) {
    if (existing && !note.reportId) {
      await ConsultationNote.updateOne({ _id: note._id, reportId: null }, { $set: { reportId: existing._id, status: "final" } });
    }
    throw new ReportError("This note has already been added to a Visit Note.", 409, { code: "ALREADY_FINALISED", reportId: String(existing?._id || note.reportId) });
  }

  const fields = readFields(note);
  const missing = missingRequired(fields);
  if (missing.length) {
    throw new ReportError(`Please fill in: ${missing.map((k) => FIELD_LABELS[k]).join(", ")}.`, 422, { code: "REQUIRED_FIELDS", missing });
  }

  const { doctor, enrollment } = await loadPhysician(doctorId);
  const registrationNumber = String(enrollment?.medicalRegistrationNumber || "").trim();
  if (!registrationNumber) {
    throw new ReportError(
      "Please complete your profile (Medical Registration Number) before finalising a visit note",
      422,
      { code: "PROFILE_INCOMPLETE" },
    );
  }
  if (!enrollment?.signatureKey) {
    throw new ReportError("Please upload your digital signature (PNG) before finalising.", 422, { code: "SIGNATURE_REQUIRED" });
  }

  const { user, details, date, time } = await loadConsultation(note);
  const fullName = [details.firstName, details.lastName].filter(Boolean).join(" ").trim();
  const dob = details.dob || user?.dob || "";

  // The report owns its signature: copy it now so replacing the profile signature never changes this report.
  const reportId = new mongoose.Types.ObjectId();
  const signatureKey = reportSignatureKey(reportId);
  try {
    await copyObject(enrollment.signatureKey, signatureKey);
  } catch (err) {
    console.error("visit note signature copy failed:", err);
    throw new ReportError("Could not save the signature. Please try again.", 502);
  }

  const signedAt = new Date();
  let report;
  try {
    report = await ConsultationReport.create({
      _id: reportId,
      reportNumber: await nextReportNumber(signedAt),
      noteId: note._id,
      appointmentId: note.appointmentId,
      appointmentModel: note.appointmentModel,
      patientId: note.patientId,
      doctorId,
      ...encryptFields(fields),
      patient: { name: fullName || user?.name || "", gender: details.gender || user?.gender || "", dob, age: ageFromDob(dob, date) },
      consultation: { date, time, mode: DEFAULT_MODE },
      physician: {
        name: doctor?.name || "",
        registrationNumber,
        speciality: enrollment.specialization || "",
        country: enrollment.country || "",
      },
      signatureKey,
      signedAt,
    });
  } catch (err) {
    if (err?.code === 11000) throw new ReportError("This note has already been added to a Visit Note.", 409, { code: "ALREADY_FINALISED" });
    throw err;
  }

  const linked = await ConsultationNote.updateOne({ _id: note._id, reportId: null }, { $set: { reportId: report._id, status: "final" }, $inc: { __v: 1 } });
  if (linked.modifiedCount !== 1) console.error("visit note: report created but note link missing", String(report._id));
  return report;
}

async function addAmendment({ doctorId, reportId, reason, text }) {
  if (!mongoose.Types.ObjectId.isValid(String(reportId || ""))) throw new ReportError("Invalid report ID.", 400);
  const cleanReason = typeof reason === "string" ? reason.trim() : "";
  const cleanText = typeof text === "string" ? text.trim() : "";
  if (!cleanReason) throw new ReportError("Please give a reason for the amendment.", 400, { code: "REASON_REQUIRED" });
  if (!cleanText) throw new ReportError("Please enter the correction text.", 400, { code: "TEXT_REQUIRED" });
  if (cleanReason.length > MAX_AMENDMENT_REASON) throw new ReportError(`Reason must be ${MAX_AMENDMENT_REASON} characters or fewer.`, 400);
  if (cleanText.length > MAX_AMENDMENT_TEXT) throw new ReportError(`Correction must be ${MAX_AMENDMENT_TEXT} characters or fewer.`, 400);

  const report = await ConsultationReport.findOne({ _id: reportId, doctorId }).select("_id physician").lean();
  if (!report) throw new ReportError("Visit Note not found or access denied.", 404);
  const doctor = await Doctor.findById(doctorId).select("name").lean();
  return ConsultationReportAmendment.create({
    reportId: report._id,
    authorId: doctorId,
    authorName: doctor?.name || report.physician?.name || "",
    ...encryptPHI({ reason: cleanReason, text: cleanText }),
  });
}

const serializeAmendment = (a) => {
  const body = decryptPHI(a) || {};
  return { _id: a._id, authorName: a.authorName, reason: body.reason || "", text: body.text || "", createdAt: a.createdAt };
};

// Full report for the viewer. signatureKey is never exposed: the signature is fetched through the authenticated
// /signature route of the same role.
function serializeReport(report, amendments = []) {
  const plain = typeof report.toObject === "function" ? report.toObject() : report;
  const fields = readFields(plain);
  return {
    _id: plain._id,
    reportNumber: plain.reportNumber,
    appointmentId: plain.appointmentId,
    appointmentModel: plain.appointmentModel,
    patientId: plain.patientId,
    doctorId: plain.doctorId,
    patient: plain.patient,
    consultation: plain.consultation,
    physician: plain.physician,
    ...fields,
    signedAt: plain.signedAt,
    status: plain.status,
    amendments: amendments.map(serializeAmendment),
  };
}

// One query for the amendments of many reports.
async function attachAmendments(reports) {
  if (!reports.length) return [];
  const rows = await ConsultationReportAmendment.find({ reportId: { $in: reports.map((r) => r._id) } }).sort({ createdAt: 1 }).lean();
  const byReport = new Map();
  for (const row of rows) {
    const key = String(row.reportId);
    if (!byReport.has(key)) byReport.set(key, []);
    byReport.get(key).push(row);
  }
  return reports.map((r) => serializeReport(r, byReport.get(String(r._id)) || []));
}

module.exports = {
  ReportError, MAX_AMENDMENT_REASON, MAX_AMENDMENT_TEXT,
  nextReportNumber, ageFromDob, finaliseNote, addAmendment, serializeReport, serializeAmendment, attachAmendments,
};
