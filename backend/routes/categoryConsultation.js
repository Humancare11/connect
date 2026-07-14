const express = require("express");
const router = express.Router();

const {
  verifyUserToken,
  verifyDoctorToken,
  verifyAdminToken,
  adminOnly,
} = require("../middleware/verifyToken");

const {
  createCategoryConsultation,
  getAllCategoryConsultations,
  getMyCategoryConsultations,
  getDoctorCategoryConsultations,
  getCategoryConsultationById,
  updateCategoryConsultationStatus,
  deleteCategoryConsultation,
  assignDoctor,
} = require("../controllers/CategoryConsultationController");

// IMPORTANT: /mine and /doctor/mine must be declared before /:id.
// Express matches routes top-to-bottom, so if /:id came first it would
// treat "mine" as an :id value and getCategoryConsultationById would run
// instead of these handlers.

// Patient: their own consultations
router.get("/mine", verifyUserToken, getMyCategoryConsultations);

// Doctor: consultations assigned to them
router.get("/doctor/mine", verifyDoctorToken, getDoctorCategoryConsultations);

// Admin: all consultations
router.get("/", verifyAdminToken, adminOnly, getAllCategoryConsultations);

// Patient: create a new consultation request
router.post("/", verifyUserToken, createCategoryConsultation);

// Admin: single consultation detail
router.get("/:id", verifyAdminToken, adminOnly, getCategoryConsultationById);

// Admin: update status
router.patch(
  "/:id/status",
  verifyAdminToken,
  adminOnly,
  updateCategoryConsultationStatus,
);

// Admin: delete
router.delete("/:id", verifyAdminToken, adminOnly, deleteCategoryConsultation);

// Admin: assign a doctor
router.patch(
  "/:id/assign-doctor",
  verifyAdminToken,
  adminOnly,
  assignDoctor,
);


module.exports = router;