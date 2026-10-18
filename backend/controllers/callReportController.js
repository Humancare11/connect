const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const CategoryConsultation = require("../models/CategoryConsultation");
const CallReport = require("../models/CallReport");
const { recordActivity } = require("../utils/activityLogger");
const { buildCallReportView } = require("../utils/callReportView");

const VIEW_LOG_CAP = 50;

const isObjectId = (id) => /^[a-f0-9]{24}$/i.test(String(id || "")) && mongoose.Types.ObjectId.isValid(String(id));

// Basic, non-technical context for the report header.
async function loadSubject(appointmentId) {
  const appt = await Appointment.findById(appointmentId)
    .select("patientId doctorId status date time category specialty")
    .populate("patientId", "name")
    .populate("doctorId", "name")
    .lean();
  if (appt) {
    return {
      kind: "appointment",
      id: String(appt._id),
      patientName: appt.patientId?.name || "",
      doctorName: appt.doctorId?.name || "",
      status: appt.status || "",
      date: appt.date || "",
      time: appt.time || "",
      category: appt.category || "",
    };
  }
  const cc = await CategoryConsultation.findById(appointmentId).select("patientId status category createdAt").populate("patientId", "name").lean();
  if (cc) {
    return {
      kind: "category_consultation",
      id: String(cc._id),
      patientName: cc.patientId?.name || "",
      doctorName: "",
      status: cc.status || "",
      date: cc.createdAt ? new Date(cc.createdAt).toISOString().slice(0, 10) : "",
      time: "",
      category: cc.category || "",
    };
  }
  return null;
}

// GET /api/call-reports/:appointmentId - admin only (see the route's guards).
const getCallReport = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    if (!isObjectId(appointmentId)) return res.status(400).json({ msg: "Invalid appointment id." });

    const subject = await loadSubject(appointmentId);
    if (!subject) return res.status(404).json({ msg: "Appointment not found." });

    const report = await CallReport.findOne({ appointmentId }).lean();
    const recorder = req.app.get("callReportRecorder");
    const view = buildCallReportView(report, { openSegmentSec: recorder ? recorder.openSegmentSec(appointmentId) : 0 });

    // Audit: who opened which report. recordActivity() is a no-op in this app by
    // design, so the last VIEW_LOG_CAP views are also kept on the report itself.
    recordActivity(req, {
      action: "CALL_REPORT_VIEWED",
      resource: "CallReport",
      resourceId: appointmentId,
      details: { kind: subject.kind },
    }).catch(() => {});
    if (report) {
      CallReport.updateOne(
        { appointmentId },
        { $push: { views: { $each: [{ at: new Date(), adminId: String(req.user?.id || ""), adminName: String(req.user?.name || req.user?.email || "").slice(0, 80) }], $slice: -VIEW_LOG_CAP } } },
      ).catch(() => {});
    }

    res.status(200).json({ appointment: subject, ...view });
  } catch (error) {
    console.error("getCallReport error:", error);
    res.status(500).json({ msg: "Failed to load the call report." });
  }
};

// DELETE /api/call-reports/:appointmentId - superadmin only.
const deleteCallReport = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    if (!isObjectId(appointmentId)) return res.status(400).json({ msg: "Invalid appointment id." });
    const result = await CallReport.deleteOne({ appointmentId });
    recordActivity(req, {
      action: "CALL_REPORT_DELETED",
      resource: "CallReport",
      resourceId: appointmentId,
      details: { deleted: result.deletedCount || 0 },
    }).catch(() => {});
    res.status(200).json({ msg: result.deletedCount ? "Call report deleted." : "There was no call report to delete." });
  } catch (error) {
    console.error("deleteCallReport error:", error);
    res.status(500).json({ msg: "Failed to delete the call report." });
  }
};

module.exports = { getCallReport, deleteCallReport };
