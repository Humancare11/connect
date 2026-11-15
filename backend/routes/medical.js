const express = require("express");
const router  = express.Router();
const { verifyUserToken, verifyDoctorToken } = require("../middleware/verifyToken");
const {
  getDoctorPatients, getPatientHistory,
  createPrescription, createMedicalCertificate,
  getMyPrescriptions, getMyMedicalCertificates,
  getMyMedicalReports, downloadMyMedicalReport,
  doctorPrescriptionSignature, doctorCertificateSignature,
  myPrescriptionSignature, myCertificateSignature,
} = require("../controllers/medicalController");

// Doctor routes
router.get("/patients",                    verifyDoctorToken, getDoctorPatients);
router.get("/patients/:patientId/history", verifyDoctorToken, getPatientHistory);
router.post("/prescriptions",              verifyDoctorToken, createPrescription);
router.post("/certificates",               verifyDoctorToken, createMedicalCertificate);
router.get("/prescriptions/:id/signature", verifyDoctorToken, doctorPrescriptionSignature);
router.get("/certificates/:id/signature",  verifyDoctorToken, doctorCertificateSignature);

// Patient routes
router.get("/my-prescriptions", verifyUserToken, getMyPrescriptions);
router.get("/my-certificates",  verifyUserToken, getMyMedicalCertificates);
router.get("/my-prescriptions/:id/signature", verifyUserToken, myPrescriptionSignature);
router.get("/my-certificates/:id/signature",  verifyUserToken, myCertificateSignature);
router.get("/my-reports",       verifyUserToken, getMyMedicalReports);
router.get("/my-reports/:id/download", verifyUserToken, downloadMyMedicalReport);

module.exports = router;
