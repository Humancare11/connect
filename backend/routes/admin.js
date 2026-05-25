const express = require("express");
const router  = express.Router();
const {
  getAdminStats, getAllDoctors, getDoctorById, approveDoctor, rejectDoctor,
  approveDoctorDeleteRequest, rejectDoctorDeleteRequest,
  getAllUsers, deleteUser, getUserDetails, migrateDoctorIds,
  getApprovedDoctors, getDoctorWorkflowStats, getDoctorPayments, markDoctorPayout, editDoctorPayout,
  processDoctorPayout,
} = require("../controllers/adminController");
const { verifyAdminToken, adminOnly, superAdminOnly } = require("../middleware/verifyToken");

router.get("/stats", getAdminStats);

router.get("/doctors",                verifyAdminToken, adminOnly, getAllDoctors);
router.get("/approved-doctors",       verifyAdminToken, adminOnly, getApprovedDoctors);
router.get("/doctors/:id",            verifyAdminToken, adminOnly, getDoctorById);
router.get("/doctor-workflow-stats",  verifyAdminToken, adminOnly, getDoctorWorkflowStats);
router.put("/doctors/:id/approve",    verifyAdminToken, adminOnly, approveDoctor);
router.put("/doctors/:id/reject",     verifyAdminToken, adminOnly, rejectDoctor);
router.put("/doctors/:id/delete/approve", verifyAdminToken, adminOnly, approveDoctorDeleteRequest);
router.put("/doctors/:id/delete/reject",  verifyAdminToken, adminOnly, rejectDoctorDeleteRequest);

router.post("/migrate/doctor-ids", verifyAdminToken, adminOnly, migrateDoctorIds);

router.get("/users",        verifyAdminToken, adminOnly, getAllUsers);
router.get("/users/:id",    verifyAdminToken, adminOnly, getUserDetails);
router.delete("/users/:id", verifyAdminToken, adminOnly, deleteUser);

router.get("/doctor-payments",                  verifyAdminToken, adminOnly,      getDoctorPayments);
router.put("/doctor-payments/:id/mark-paid",    verifyAdminToken, superAdminOnly, markDoctorPayout);
router.put("/doctor-payments/:id",              verifyAdminToken, superAdminOnly, editDoctorPayout);
router.post("/doctor-payments/:id/process-payout", verifyAdminToken, superAdminOnly, processDoctorPayout);

module.exports = router;
