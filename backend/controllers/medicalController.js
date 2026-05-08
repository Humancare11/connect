const Prescription      = require("../models/Prescription");
const MedicalCertificate = require("../models/MedicalCertificate");
const Appointment        = require("../models/Appointment");

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

    res.status(200).json(Array.from(seen.values()));
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

    res.status(200).json({ appointments, prescriptions, certificates });
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
      .populate("doctorId",      "name email")
      .populate("appointmentId", "date time problem")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(certificates);
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
