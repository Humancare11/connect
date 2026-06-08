const express = require("express");
const router  = express.Router();
const {
  getAdminStats, getAllDoctors, getDoctorById, updateDoctorByAdmin,
  getDoctorDocumentAccessUrl,
  approveDoctor, rejectDoctor,
  approveDoctorDeleteRequest, rejectDoctorDeleteRequest,
  getAllUsers, deleteUser, getUserDetails, forceLogoutUser, disableUser, migrateDoctorIds,
  getApprovedDoctors, getDoctorWorkflowStats, getDoctorPayments, markDoctorPayout, editDoctorPayout,
  processDoctorPayout,
} = require("../controllers/adminController");
const { verifyAdminToken, adminOnly, superAdminOnly } = require("../middleware/verifyToken");

router.get("/stats", verifyAdminToken, adminOnly, getAdminStats);

router.get("/doctors",                verifyAdminToken, adminOnly, getAllDoctors);
router.get("/approved-doctors",       verifyAdminToken, adminOnly, getApprovedDoctors);
router.get("/doctors/:id/documents/:field/access-url", verifyAdminToken, adminOnly, getDoctorDocumentAccessUrl);
router.get("/doctors/:id",            verifyAdminToken, adminOnly, getDoctorById);
router.put("/doctors/:id",            verifyAdminToken, adminOnly, updateDoctorByAdmin);
router.get("/doctor-workflow-stats",  verifyAdminToken, adminOnly, getDoctorWorkflowStats);
router.put("/doctors/:id/approve",    verifyAdminToken, adminOnly, approveDoctor);
router.put("/doctors/:id/reject",     verifyAdminToken, adminOnly, rejectDoctor);
router.put("/doctors/:id/delete/approve", verifyAdminToken, adminOnly, approveDoctorDeleteRequest);
router.put("/doctors/:id/delete/reject",  verifyAdminToken, adminOnly, rejectDoctorDeleteRequest);

router.post("/migrate/doctor-ids", verifyAdminToken, adminOnly, migrateDoctorIds);

router.get("/users",        verifyAdminToken, adminOnly, getAllUsers);
router.get("/users/:id",    verifyAdminToken, adminOnly, getUserDetails);
router.post("/users/:id/force-logout", verifyAdminToken, superAdminOnly, forceLogoutUser);
router.put("/users/:id/disable",       verifyAdminToken, superAdminOnly, disableUser);
router.delete("/users/:id", verifyAdminToken, adminOnly, deleteUser);

router.get("/doctor-payments",                  verifyAdminToken, adminOnly,      getDoctorPayments);
router.put("/doctor-payments/:id/mark-paid",    verifyAdminToken, superAdminOnly, markDoctorPayout);
router.put("/doctor-payments/:id",              verifyAdminToken, superAdminOnly, editDoctorPayout);
router.post("/doctor-payments/:id/process-payout", verifyAdminToken, superAdminOnly, processDoctorPayout);

module.exports = router;
