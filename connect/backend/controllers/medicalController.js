const Prescription       = require("../models/Prescription");
const MedicalCertificate = require("../models/MedicalCertificate");
const Appointment        = require("../models/Appointment");
const Enrollment         = require("../models/Enrollment");
const { logAudit }       = require("../utils/auditLogger");

// ── Doctor: get distinct patients from completed appointments ─────────────────
const getDoctorPatients = async (req, res) => {
  try {
    if (req.user.role !== "doctor") {
      return res.status(403).json({ msg: "Access denied. Doctors only." });
    }

    const appointments = await Appointment.find({
      doctorId: req.user.id,
      status:   "completed",
    })
      .populate("patientId", "name email mobile gender dob")
      .sort({ createdAt: -1 })
      .lean();

    // Deduplicate patients, attach last appointment info
    const seen = new Map();
    for (const appt of appointments) {
      const pid = appt.patientId?._id?.toString();
      if (!pid) continue;
      if (!seen.has(pid)) {
        seen.set(pid, {
          patient:         appt.patientId,
          lastAppointment: appt,
          totalVisits:     1,
        });
      } else {
        seen.get(pid).totalVisits += 1;
      }
    }

    const result = Array.from(seen.values());

    await logAudit(req, {
      action: "PHI_VIEW_PATIENT_LIST",
      resource: "Appointment",
      details: { patientCount: result.length },
    });

    res.status(200).json(result);
  } catch (err) {
    console.error("getDoctorPatients error:", err);
    res.status(500).json({ msg: "Failed to fetch patients." });
  }
};

// ── Doctor: get a single patient's appointment history ───────────────────────
const getPatientHistory = async (req, res) => {
  try {
    if (req.user.role !== "doctor") {
      return res.status(403).json({ msg: "Access denied. Doctors only." });
    }

    const { patientId } = req.params;

    const appointments = await Appointment.find({
      doctorId:  req.user.id,
      patientId,
    })
      .populate("patientId", "name email mobile")
      .sort({ createdAt: -1 })
      .lean();

    const prescriptions = await Prescription.find({
      doctorId:  req.user.id,
      patientId,
    })
      .populate("appointmentId", "date time")
      .sort({ createdAt: -1 })
      .lean();

    const certificates = await MedicalCertificate.find({
      doctorId:  req.user.id,
      patientId,
    })
      .populate("appointmentId", "date time")
      .sort({ createdAt: -1 })
      .lean();

    // Attach the doctor's own enrollment for certificate slip rendering
    const enrollment = await Enrollment.findOne({ doctorId: req.user.id })
      .select("specialization qualification clinicName clinicAddress medicalRegistrationNumber medicalCouncilName")
      .lean();

    await logAudit(req, {
      action: "PHI_VIEW_PATIENT_HISTORY",
      resource: "Appointment",
      patientId,
      details: {
        appointmentCount: appointments.length,
        prescriptionCount: prescriptions.length,
        certificateCount: certificates.length,
      },
    });

    res.status(200).json({ appointments, prescriptions, certificates, doctorEnrollment: enrollment || null });
  } catch (err) {
    console.error("getPatientHistory error:", err);
    res.status(500).json({ msg: "Failed to fetch patient history." });
  }
};

// ── Doctor: create prescription ───────────────────────────────────────────────
const createPrescription = async (req, res) => {
  try {
    if (req.user.role !== "doctor") {
      return res.status(403).json({ msg: "Access denied. Doctors only." });
    }

    const { appointmentId, patientId, diagnosis, medicines, instructions, followUpDate } = req.body;

    if (!appointmentId || !patientId || !diagnosis) {
      return res.status(400).json({ msg: "appointmentId, patientId, and diagnosis are required." });
    }

    const prescription = await Prescription.create({
      appointmentId,
      doctorId: req.user.id,
      patientId,
      diagnosis,
      medicines:    medicines    || [],
      instructions: instructions || "",
      followUpDate: followUpDate || "",
    });

    // Notify patient in real-time
    const io = req.app.get("io");
    if (io) {
      io.to(`patient_${patientId}`).emit("new-prescription", {
        prescriptionId: prescription._id,
        diagnosis,
        patientId,
      });
    }

    await logAudit(req, {
      action: "PHI_CREATE_PRESCRIPTION",
      resource: "Prescription",
      resourceId: prescription._id,
      patientId,
      details: { appointmentId, diagnosis },
    });

    res.status(201).json({ msg: "Prescription created.", prescription });
  } catch (err) {
    console.error("createPrescription error:", err);
    res.status(500).json({ msg: "Failed to create prescription." });
  }
};

// ── Doctor: create medical certificate ───────────────────────────────────────
const createMedicalCertificate = async (req, res) => {
  try {
    if (req.user.role !== "doctor") {
      return res.status(403).json({ msg: "Access denied. Doctors only." });
    }

    const { appointmentId, patientId, diagnosis, recommendation, restFromDate, restToDate, notes } = req.body;

    if (!appointmentId || !patientId || !diagnosis) {
      return res.status(400).json({ msg: "appointmentId, patientId, and diagnosis are required." });
    }

    const issuedDate = new Date().toISOString().split("T")[0];

    const certificate = await MedicalCertificate.create({
      appointmentId,
      doctorId:       req.user.id,
      patientId,
      diagnosis,
      recommendation: recommendation || "",
      restFromDate:   restFromDate   || "",
      restToDate:     restToDate     || "",
      notes:          notes          || "",
      issuedDate,
    });

    // Notify patient in real-time
    const io = req.app.get("io");
    if (io) {
      io.to(`patient_${patientId}`).emit("new-certificate", {
        certificateId: certificate._id,
        diagnosis,
        patientId,
      });
    }

    await logAudit(req, {
      action: "PHI_CREATE_CERTIFICATE",
      resource: "MedicalCertificate",
      resourceId: certificate._id,
      patientId,
      details: { appointmentId, diagnosis },
    });

    res.status(201).json({ msg: "Medical certificate issued.", certificate });
  } catch (err) {
    console.error("createMedicalCertificate error:", err);
    res.status(500).json({ msg: "Failed to issue certificate." });
  }
};

// ── Patient: get own prescriptions ───────────────────────────────────────────
const getMyPrescriptions = async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ patientId: req.user.id })
      .populate("doctorId",      "name email")
      .populate("appointmentId", "date time problem")
      .sort({ createdAt: -1 })
      .lean();

    await logAudit(req, {
      action: "PHI_VIEW_PRESCRIPTIONS",
      resource: "Prescription",
      patientId: req.user.id,
      details: { count: prescriptions.length },
    });

    res.status(200).json(prescriptions);
  } catch (err) {
    console.error("getMyPrescriptions error:", err);
    res.status(500).json({ msg: "Failed to fetch prescriptions." });
  }
};

// ── Patient: get own certificates ────────────────────────────────────────────
const getMyMedicalCertificates = async (req, res) => {
  try {
    const certificates = await MedicalCertificate.find({ patientId: req.user.id })
      .populate("doctorId",      "name email doctorId")
      .populate("appointmentId", "date time problem")
      .sort({ createdAt: -1 })
      .lean();

    // Enrich each certificate with the issuing doctor's enrollment details
    const doctorMongoIds = [...new Set(
      certificates.map((c) => c.doctorId?._id?.toString()).filter(Boolean)
    )];
    const enrollments = await Enrollment.find({ doctorId: { $in: doctorMongoIds } })
      .select("doctorId specialization qualification clinicName clinicAddress medicalRegistrationNumber medicalCouncilName")
      .lean();
    const enrollMap = {};
    for (const e of enrollments) enrollMap[e.doctorId.toString()] = e;

    const enriched = certificates.map((cert) => ({
      ...cert,
      doctorEnrollment: enrollMap[cert.doctorId?._id?.toString()] || null,
    }));

    await logAudit(req, {
      action: "PHI_VIEW_CERTIFICATES",
      resource: "MedicalCertificate",
      patientId: req.user.id,
      details: { count: enriched.length },
    });

    res.status(200).json(enriched);
  } catch (err) {
    console.error("getMyMedicalCertificates error:", err);
    res.status(500).json({ msg: "Failed to fetch medical certificates." });
  }
};

module.exports = {
  getDoctorPatients,
  getPatientHistory,
  createPrescription,
  createMedicalCertificate,
  getMyPrescriptions,
  getMyMedicalCertificates,
};
