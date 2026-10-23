const express = require("express");
const router = require("express").Router();
const { verifyToken, verifyUserToken, verifyDoctorToken, verifyAdminToken, adminOnly } = require("../middleware/verifyToken");
const retiredEndpoint = require("../middleware/retiredEndpoint");
const {
  createAppointment, getPatientAppointments, getDoctorAppointments,
  confirmAppointment, completeAppointment, adminCompleteAppointment, reopenAppointment,
  cancelAppointment,
  getAllAppointments, getAppointmentById, getDoctorOwnAppointment, getPatientOwnAppointment, getBookedSlots,
} = require("../controllers/appointmentController");

router.post("/", verifyUserToken, createAppointment);
router.get("/mine", verifyUserToken, getPatientAppointments);
router.get("/doctor", verifyDoctorToken, getDoctorAppointments);
router.get("/booked-slots", verifyUserToken, getBookedSlots);
router.get("/admin/all", verifyAdminToken, adminOnly, getAllAppointments);
// Retired: it set the booking Confirmed straight away, which skips the doctor's confirmation. Answers 410 for one release.
router.put("/:id/change-doctor", verifyAdminToken, adminOnly, retiredEndpoint("POST /api/admin/bookings/:id/alternate-doctor (or /assign-doctor for a booking with no doctor)"));
router.put("/:id/confirm", verifyDoctorToken, confirmAppointment);
router.put("/:id/complete", verifyDoctorToken, completeAppointment);
router.put("/:id/admin-complete", verifyAdminToken, adminOnly, adminCompleteAppointment);
router.put("/:id/reopen", verifyAdminToken, adminOnly, reopenAppointment);
router.put("/:id/cancel", verifyDoctorToken, cancelAppointment);
// Doctor-specific fetch — DB-level ownership check, must be before /:id
router.get("/doctor/:id", verifyDoctorToken, getDoctorOwnAppointment);
// Patient-specific fetch — DB-level ownership check, must be before /:id
router.get("/patient/:id", verifyUserToken, getPatientOwnAppointment);
router.get("/:id", verifyToken, getAppointmentById);

module.exports = router;
