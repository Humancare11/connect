import express from "express";
import {
    registerDoctor,
    loginDoctor,
    getEnrollment,
    submitEnrollment,
    saveEnrollmentStep,
    saveEnrollmentProgress,
    getApprovedDoctors,
    getDoctorById,
} from "../controllers/doctorController.js";

const router = express.Router();

router.post("/register", registerDoctor);
router.post("/login", loginDoctor);
router.get("/enrollment/:doctorId", getEnrollment);

// Autosave — must be registered BEFORE "/enrollment" (POST) so they don't
// collide, and before "/:id" below so "step"/"progress" are never treated
// as a doctor id.
router.patch("/enrollment/step", saveEnrollmentStep);
router.patch("/enrollment/progress", saveEnrollmentProgress);

router.post("/enrollment", submitEnrollment);
router.get("/approved", getApprovedDoctors);
router.get("/:id", getDoctorById);

export default router;