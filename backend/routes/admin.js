const express = require("express");
const router  = express.Router();
const { getAdminStats, getAllDoctors, approveDoctor, rejectDoctor, getAllUsers, deleteUser, getUserDetails, migrateDoctorIds } = require("../controllers/adminController");
const { verifyAdminToken, adminOnly } = require("../middleware/verifyToken");

router.get("/stats", getAdminStats);

router.get("/doctors",             verifyAdminToken, adminOnly, getAllDoctors);
router.put("/doctors/:id/approve", verifyAdminToken, adminOnly, approveDoctor);
router.put("/doctors/:id/reject",  verifyAdminToken, adminOnly, rejectDoctor);

router.post("/migrate/doctor-ids", verifyAdminToken, adminOnly, migrateDoctorIds);

router.get("/users",     verifyAdminToken, adminOnly, getAllUsers);
router.get("/users/:id", verifyAdminToken, adminOnly, getUserDetails);
router.delete("/users/:id", verifyAdminToken, adminOnly, deleteUser);

module.exports = router;
