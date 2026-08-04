const Prescription       = require("../models/Prescription");
const MedicalCertificate = require("../models/MedicalCertificate");
const Appointment        = require("../models/Appointment");
const Enrollment         = require("../models/Enrollment");
const CategoryConsultation = require("../models/CategoryConsultation");
const { recordActivity }       = require("../utils/activityLogger");
const { sendPushToUser }       = require("../utils/pushNotifications");

// ── Doctor: get all completed consultations (newest to oldest) ───────────────
const getDoctorPatients = async (req, res) => {
  try {
    if (req.user.role !== "doctor") {
      return res.status(403).json({ msg: "Access denied. Doctors only." });
    }

    // Fetch regular appointments
    const appointments = await Appointment.find({
      doctorId: req.user.id,
      status:   { $in: ["complete", "completed"] },
    })
      .populate("patientId", "patientId name email mobile gender dob")
      .sort({ createdAt: -1 })
      .lean();

    // Fetch category consultations (Next Availability appointments)
    // First find the enrollment for this doctor
    const enrollment = await Enrollment.findOne({ doctorId: req.user.id }).select("_id").lean();
    
    let categoryConsultations = [];
    if (enrollment) {
      categoryConsultations = await CategoryConsultation.find({
        assignedDoctorId: enrollment._id,
        status: "Completed",
      })
        .populate("patientId", "patientId name email mobile gender dob")
        .sort({ createdAt: -1 })
        .lean();
    }

    // Combine both appointment types and sort by createdAt (newest to oldest)
    const allAppointments = [...appointments, ...categoryConsultations].sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    // Map each appointment to the expected format
    const result = allAppointments
      .filter(appt => appt.patientId) // Filter out any appointments without patient data
      .map(appt => ({
        patient: appt.patientId,
        appointment: appt,
        totalVisits: 1, // Each entry represents one consultation
      }));

    // Count unique patients for activity logging
    const uniquePatients = new Set(result.map(r => r.patient._id.toString())).size;

    await recordActivity(req, {
      action: "PHI_VIEW_PATIENT_LIST",
      resource: "Appointment",
      details: { 
        patientCount: uniquePatients,
        totalConsultations: result.length 
      },
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

    // Fetch regular appointments
    const appointments = await Appointment.find({
      doctorId:  req.user.id,
      patientId,
    })
      .populate("patientId", "patientId name email mobile")
      .sort({ createdAt: -1 })
      .lean();

    // Fetch category consultations (Next Availability appointments)
    const enrollment = await Enrollment.findOne({ doctorId: req.user.id }).select("_id specialization qualification clinicName clinicAddress medicalRegistrationNumber medicalCouncilName country").lean();
    
    let categoryConsultations = [];
    if (enrollment) {
      categoryConsultations = await CategoryConsultation.find({
        assignedDoctorId: enrollment._id,
        patientId,
      })
        .populate("patientId", "patientId name email mobile")
        .sort({ createdAt: -1 })
        .lean();
    }

    // Combine both appointment types
    const allAppointments = [...appointments, ...categoryConsultations].sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );

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

    await recordActivity(req, {
      action: "PHI_VIEW_PATIENT_HISTORY",
      resource: "Appointment",
      patientId,
      details: {
        appointmentCount: allAppointments.length,
        prescriptionCount: prescriptions.length,
        certificateCount: certificates.length,
      },
    });

    res.status(200).json({ appointments: allAppointments, prescriptions, certificates, doctorEnrollment: enrollment || null });
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

    sendPushToUser(patientId, {
      title: "New prescription available",
      body: "Your doctor has issued a new prescription.",
      data: { type: "prescription", recordType: "prescription" },
    });

    await recordActivity(req, {
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

    sendPushToUser(patientId, {
      title: "Medical certificate issued",
      body: "Your doctor has issued a new medical certificate.",
      data: { type: "certificate", recordType: "certificate" },
    });

    await recordActivity(req, {
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
      .populate("patientId",     "patientId name email mobile gender dob")
      .populate("doctorId",      "name email")
      .populate("appointmentId", "date time problem")
      .sort({ createdAt: -1 })
      .lean();

    // Enrich each prescription with the issuing doctor's enrollment details
    const doctorMongoIds = [...new Set(
      prescriptions.map((p) => p.doctorId?._id?.toString()).filter(Boolean)
    )];
    const enrollments = await Enrollment.find({ doctorId: { $in: doctorMongoIds } })
      .select("doctorId specialization qualification clinicName clinicAddress medicalRegistrationNumber medicalCouncilName country")
      .lean();
    const enrollMap = {};
    for (const e of enrollments) enrollMap[e.doctorId.toString()] = e;

    const enriched = prescriptions.map((rx) => ({
      ...rx,
      doctorEnrollment: enrollMap[rx.doctorId?._id?.toString()] || null,
    }));

    await recordActivity(req, {
      action: "PHI_VIEW_PRESCRIPTIONS",
      resource: "Prescription",
      patientId: req.user.id,
      details: { count: enriched.length },
    });

    res.status(200).json(enriched);
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
      .select("doctorId specialization qualification clinicName clinicAddress medicalRegistrationNumber medicalCouncilName country")
      .lean();
    const enrollMap = {};
    for (const e of enrollments) enrollMap[e.doctorId.toString()] = e;

    const enriched = certificates.map((cert) => ({
      ...cert,
      doctorEnrollment: enrollMap[cert.doctorId?._id?.toString()] || null,
    }));

    await recordActivity(req, {
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
