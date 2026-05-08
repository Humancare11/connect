const express = require("express");
const router  = express.Router();
const { verifyUserToken, verifyDoctorToken } = require("../middleware/verifyToken");
const {
  getDoctorPatients, getPatientHistory,
  createPrescription, createMedicalCertificate,
  getMyPrescriptions, getMyMedicalCertificates,
} = require("../controllers/medicalController");

// Doctor routes
router.get("/patients",                    verifyDoctorToken, getDoctorPatients);
router.get("/patients/:patientId/history", verifyDoctorToken, getPatientHistory);
router.post("/prescriptions",              verifyDoctorToken, createPrescription);
router.post("/certificates",               verifyDoctorToken, createMedicalCertificate);

// Patient routes
router.get("/my-prescriptions", verifyUserToken, getMyPrescriptions);
router.get("/my-certificates",  verifyUserToken, getMyMedicalCertificates);

module.exports = router;
