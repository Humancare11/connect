const express = require("express");
const router = express.Router();
const { verifyDoctorToken, verifyUserToken, verifyAdminToken, adminOnly } = require("../middleware/verifyToken");
const c = require("../controllers/consultationReportController");

// Visit Notes (finalised consultation reports). Every route is role-scoped on the server:
//   doctor  - only reports they wrote; create + amend
//   patient - only their own finalised reports (read only)
//   admin   - every finalised report (read only)
// Report JSON and signature images are never public: there is no static or presigned URL.

// Doctor
router.post("/", verifyDoctorToken, c.createReport);
router.get("/doctor", verifyDoctorToken, c.listDoctorReports);
router.get("/doctor/states", verifyDoctorToken, c.doctorStates);
router.get("/doctor/review-info", verifyDoctorToken, c.reviewInfo);
router.get("/doctor/patient/:patientId", verifyDoctorToken, c.listDoctorReports);
const doctorScope = (req) => ({ doctorId: req.user.id });
router.get("/doctor/:id", verifyDoctorToken, c.getOne(doctorScope));
router.get("/doctor/:id/signature", verifyDoctorToken, c.getSignature(doctorScope));
router.post("/doctor/:id/amendments", verifyDoctorToken, c.createAmendment);

// Patient
router.get("/mine", verifyUserToken, c.listMine);
const patientScope = (req) => ({ patientId: req.user.id });
router.get("/mine/:id", verifyUserToken, c.getOne(patientScope));
router.get("/mine/:id/signature", verifyUserToken, c.getSignature(patientScope));

// Admin (admin + superadmin, read only)
const adminScope = () => ({});
router.get("/admin", verifyAdminToken, adminOnly, c.listAdmin);
router.get("/admin/:id", verifyAdminToken, adminOnly, c.getOne(adminScope, "VISIT_NOTE_ADMIN_VIEW"));
router.get("/admin/:id/signature", verifyAdminToken, adminOnly, c.getSignature(adminScope));

module.exports = router;
