const express = require("express");
const router = express.Router();

const {
  verifyUserToken,
  verifyDoctorToken,
  verifyAdminToken,
  adminOnly,
} = require("../middleware/verifyToken");
const retiredEndpoint = require("../middleware/retiredEndpoint");

const {
  createCategoryConsultation,
  getMyCategoryConsultations,
  getDoctorCategoryConsultations,
} = require("../controllers/CategoryConsultationController");

// IMPORTANT: /mine and /doctor/mine must be declared before /:id.
// Express matches routes top-to-bottom, so if /:id came first it would
// treat "mine" as an :id value instead of running these handlers.

// Patient: their own consultations
router.get("/mine", verifyUserToken, getMyCategoryConsultations);

// Doctor: consultations assigned to them
router.get("/doctor/mine", verifyDoctorToken, getDoctorCategoryConsultations);

// Patient: create a new consultation request
router.post("/", verifyUserToken, createCategoryConsultation);

// ── Retired admin routes ────────────────────────────────────────────────────
// Category consultations are managed in the unified admin bookings API now. These answer 410 Gone, and say
// where to go, for one release. (The status route could set a booking to Confirmed without the doctor, which
// the call lock relies on; assign-doctor is replaced by assign-doctor / alternate-doctor there.)
router.get("/", verifyAdminToken, adminOnly, retiredEndpoint("GET /api/admin/bookings"));
router.get("/:id", verifyAdminToken, adminOnly, retiredEndpoint("GET /api/admin/bookings/:id"));
router.patch(
  "/:id/status",
  verifyAdminToken,
  adminOnly,
  retiredEndpoint("POST /api/admin/bookings/:id/cancel (super admin) or /auto-complete"),
);
router.delete("/:id", verifyAdminToken, adminOnly, retiredEndpoint("DELETE /api/admin/bookings/:id (super admin only)"));
router.patch(
  "/:id/assign-doctor",
  verifyAdminToken,
  adminOnly,
  retiredEndpoint("POST /api/admin/bookings/:id/assign-doctor (or /alternate-doctor)"),
);

module.exports = router;
