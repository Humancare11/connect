const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const Session = require("../models/Session");
const { issueAuthCookies, clearAuthCookies, verifyDoctorToken } = require("../middleware/verifyToken");
const { createAndSendOTP, verifyOTPCode } = require("../utils/otpUtils");
const {
  loginLimiter,
  otpGenerationLimiter,
  otpVerificationLimiter,
} = require("../middleware/rateLimiters");
const { assertPasswordAllowed, rememberPassword } = require("../utils/passwordPolicy");
const { revokeSession, revokeUserSessions } = require("../utils/tokenRevocation");
const { recordFailedLogin } = require("../utils/securityMonitor");

const withDoctorRole = (doctor) => ({ ...doctor.toObject(), role: "doctor" });

const STEP_LABELS = ["Identity", "Professional", "Availability", "Payout", "Submitted"];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const toStepNumber = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.trunc(parsed);
};

const deriveApplicationStatus = (enrollment) => {
  if (enrollment.approvalStatus === "approved") return "Approved";
  if (enrollment.approvalStatus === "rejected") return "Rejected";
  return "Pending";
};

const applyProgress = (enrollment, nextCompletedSteps, nextCurrentStep) => {
  const completedSteps = clamp(toStepNumber(nextCompletedSteps, enrollment.completedSteps || 0), 0, 5);
  const currentStep = clamp(toStepNumber(nextCurrentStep, enrollment.currentStep || 1), 1, 5);
  enrollment.completedSteps = completedSteps;
  enrollment.currentStep = currentStep;
  enrollment.currentStepLabel = STEP_LABELS[currentStep - 1] || "Identity";
  enrollment.applicationStatus = deriveApplicationStatus(enrollment);
};

// ── POST /api/doctor/send-register-otp ───────────────────────────────────────
router.post("/send-register-otp", otpGenerationLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required." });

    const clean = email.toLowerCase().trim();
    const exists = await Doctor.findOne({ email: clean });
    if (exists)
      return res.status(409).json({ message: "This email is already registered. Please login." });

    await createAndSendOTP(clean, "register", "doctor");
    return res.json({ message: "OTP sent to your email." });
  } catch (err) {
    console.error("sendDoctorRegisterOTP error:", err);
    return res.status(500).json({ message: `Failed to send OTP: ${err.message}` });
  }
});

// ── POST /api/doctor/register ─────────────────────────────────────────────────
router.post("/register", otpVerificationLimiter, async (req, res) => {
  try {
    const { name, email, password, confirmPassword, otp } = req.body;

    if (!name || !email || !password || !confirmPassword || !otp)
      return res.status(400).json({ message: "All fields are required." });
    if (!/\S+@\S+\.\S+/.test(email))
      return res.status(400).json({ message: "Enter a valid email." });
    const passwordCheck = await assertPasswordAllowed({ userType: "doctor", password });
    if (!passwordCheck.valid)
      return res.status(400).json({ message: passwordCheck.errors.join(" ") });
    if (password !== confirmPassword)
      return res.status(400).json({ message: "Passwords do not match." });

    const cleanEmail = email.toLowerCase().trim();
    const existing = await Doctor.findOne({ email: cleanEmail });
    if (existing)
      return res.status(409).json({ message: "This email is already registered. Please login." });

    const check = await verifyOTPCode(cleanEmail, otp, "register", "doctor");
    if (!check.valid) return res.status(400).json({ message: check.msg });

    const doctor = await Doctor.create({ name, email: cleanEmail, password });
    await rememberPassword({ userId: doctor._id, userType: "doctor", passwordHash: doctor.password });

    // Auto-create a minimal enrollment so the doctor can be tracked immediately
    const nameParts = name.trim().split(/\s+/);
    await Enrollment.create({
      doctorId: doctor._id,
      firstName: nameParts[0] || "",
      surname: nameParts.slice(1).join(" ") || "",
      email: cleanEmail,
      approvalStatus: "pending",
      formCompleted: false,
      completedSteps: 0,
      currentStep: 1,
      currentStepLabel: STEP_LABELS[0],
      applicationStatus: "Pending",
      pendingRequestType: "new_enrollment",
      profileDeleteRequestStatus: "none",
    });

    await issueAuthCookies(res, withDoctorRole(doctor));
    return res.status(201).json({
      message: "Doctor registered successfully.",
      doctor: { id: doctor._id, doctorId: doctor.doctorId, name: doctor.name, email: doctor.email, isEnrolled: doctor.isEnrolled },
    });
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ message: "This email is already registered. Please login." });
    return res.status(500).json({ message: err.message || "Server error. Please try again." });
  }
});

// ── POST /api/doctor/login ────────────────────────────────────────────────────
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required." });

    const cleanEmail = email.toLowerCase().trim();
    const doctor = await Doctor.findOne({ email: cleanEmail });
    if (!doctor) {
      await recordFailedLogin(req, { email: cleanEmail, portal: "doctor" });
      return res.status(401).json({ message: "Login credentials are incorrect." });
    }
    if (doctor.accountDisabled) {
      return res.status(403).json({ message: "This account is disabled. Contact support." });
    }

    const isMatch = await doctor.comparePassword(password);
    if (!isMatch) {
      await recordFailedLogin(req, { email: cleanEmail, userId: doctor._id, userRole: "doctor", portal: "doctor" });
      return res.status(401).json({ message: "Login credentials are incorrect." });
    }

    await issueAuthCookies(res, withDoctorRole(doctor));

    // Ensure every doctor appears in Manage Doctors even if enrollment is missing.
    const existingEnrollment = await Enrollment.findOne({ doctorId: doctor._id });
    if (!existingEnrollment) {
      const nameParts = doctor.name.trim().split(/\s+/);
      await Enrollment.create({
        doctorId: doctor._id,
        firstName: nameParts[0] || "",
        surname: nameParts.slice(1).join(" ") || "",
        email: doctor.email,
        approvalStatus: "pending",
        formCompleted: false,
        completedSteps: 0,
        currentStep: 1,
        currentStepLabel: STEP_LABELS[0],
        applicationStatus: "Pending",
        pendingRequestType: "new_enrollment",
        profileDeleteRequestStatus: "none",
      });
    }

    return res.status(200).json({
      message: "Login successful.",
      doctor: { id: doctor._id, doctorId: doctor.doctorId, name: doctor.name, email: doctor.email, isEnrolled: doctor.isEnrolled },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error. Please try again." });
  }
});

// ── POST /api/doctor/send-forgot-otp ─────────────────────────────────────────
router.post("/send-forgot-otp", otpGenerationLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required." });

    const clean = email.toLowerCase().trim();
    const doctor = await Doctor.findOne({ email: clean });
    if (!doctor)
      return res.status(404).json({ message: "No doctor account found with this email." });

    await createAndSendOTP(clean, "forgot", "doctor");
    return res.json({ message: "Password reset OTP sent to your email." });
  } catch (err) {
    console.error("sendDoctorForgotOTP error:", err);
    return res.status(500).json({ message: "Failed to send OTP. Please try again." });
  }
});

// ── POST /api/doctor/verify-forgot-otp ───────────────────────────────────────
router.post("/verify-forgot-otp", otpVerificationLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required." });

    const clean = email.toLowerCase().trim();
    const check = await verifyOTPCode(clean, otp, "forgot", "doctor");
    if (!check.valid) return res.status(400).json({ message: check.msg });

    // Short-lived reset token (15 min)
    const resetToken = jwt.sign(
      { email: clean, role: "doctor", purpose: "password-reset" },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );
    return res.json({ message: "OTP verified.", resetToken });
  } catch (err) {
    console.error("verifyDoctorForgotOTP error:", err);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
});

// ── POST /api/doctor/reset-password ──────────────────────────────────────────
router.post("/reset-password", loginLimiter, async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword)
      return res.status(400).json({ message: "Reset token and new password are required." });

    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "Reset link expired. Please request a new one." });
    }
    if (decoded.purpose !== "password-reset" || decoded.role !== "doctor")
      return res.status(400).json({ message: "Invalid reset token." });

    const doctor = await Doctor.findOne({ email: decoded.email });
    if (!doctor) return res.status(404).json({ message: "Doctor account not found." });

    const passwordCheck = await assertPasswordAllowed({
      userId: doctor._id,
      userType: "doctor",
      password: newPassword,
      currentHash: doctor.password,
    });
    if (!passwordCheck.valid)
      return res.status(400).json({ message: passwordCheck.errors.join(" ") });

    // Pre-save hook in Doctor model handles hashing
    doctor.password = newPassword;
    await doctor.save();
    await rememberPassword({ userId: doctor._id, userType: "doctor", passwordHash: doctor.password });
    await revokeUserSessions(doctor._id, "password_reset");

    return res.json({ message: "Password reset successfully." });
  } catch (err) {
    console.error("resetDoctorPassword error:", err);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
});

// ── POST /api/doctor/logout ───────────────────────────────────────────────────
router.post("/logout", verifyDoctorToken, async (req, res) => {
  if (req.user?.sid) await revokeSession(req.user.sid, "logout");
  clearAuthCookies(res, "doctor");
  res.json({ message: "Logged out." });
});

// ── GET /api/doctor/me ────────────────────────────────────────────────────────
router.get("/me", verifyDoctorToken, async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.user.id).select("-password");
    if (!doctor) return res.status(404).json({ message: "Doctor not found." });
    return res.status(200).json({
      doctor: { id: doctor._id, doctorId: doctor.doctorId, name: doctor.name, email: doctor.email, isEnrolled: doctor.isEnrolled },
    });
  } catch {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
});

// ── GET /api/doctor/enrollment/:doctorId ──────────────────────────────────────
router.get("/enrollment/:doctorId", verifyDoctorToken, async (req, res) => {
  try {
    if (req.user.id !== req.params.doctorId) {
      return res.status(403).json({ message: "Access denied." });
    }
    const enrollment = await Enrollment.findOne({ doctorId: req.params.doctorId });
    res.json(enrollment);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

// ── POST /api/doctor/enrollment ───────────────────────────────────────────────
router.post("/enrollment", verifyDoctorToken, async (req, res) => {
  try {
    const { doctorId, ...enrollmentData } = req.body;
    if (!doctorId) return res.status(400).json({ message: "Doctor ID required" });
    if (req.user.id !== doctorId) {
      return res.status(403).json({ message: "Access denied." });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });

    let enrollment = await Enrollment.findOne({ doctorId });
    let responseMessage = "Enrollment submitted successfully";

    if (enrollment) {
      const wasApprovedOrRejected =
        enrollment.approvalStatus === "approved" || enrollment.approvalStatus === "rejected";
      // Use Mongoose's .set() instead of Object.assign so all field types are
      // properly tracked as modified. Then explicitly markModified for Mixed-type
      // (availability) and Array-type (languagesKnown) which Mongoose cannot
      // auto-detect when replaced wholesale.
      enrollment.set(enrollmentData);
      enrollment.markModified("availability");
      enrollment.markModified("languagesKnown");
      enrollment.formCompleted = true;
      enrollment.completedSteps = 5;
      enrollment.currentStep = 5;
      enrollment.currentStepLabel = STEP_LABELS[4];
      if (wasApprovedOrRejected) {
        enrollment.approvalStatus = "pending";
        enrollment.verified = false;
        enrollment.pendingRequestType = "profile_update";
        enrollment.profileUpdateRequestedAt = new Date();
        responseMessage = "Update request submitted and pending admin approval.";
      } else {
        enrollment.pendingRequestType = enrollment.pendingRequestType || "new_enrollment";
      }
      enrollment.profileDeleteRequestStatus = "none";
      enrollment.applicationStatus = deriveApplicationStatus(enrollment);
      enrollment.updatedAt = new Date();
      await enrollment.save();
    } else {
      enrollment = new Enrollment({
        doctorId,
        ...enrollmentData,
        formCompleted: true,
        completedSteps: 5,
        currentStep: 5,
        currentStepLabel: STEP_LABELS[4],
        applicationStatus: "Pending",
        pendingRequestType: "new_enrollment",
        profileDeleteRequestStatus: "none",
      });
      await enrollment.save();
    }

    // Enrollment submission means the profile is under review until admin approval.
    await Doctor.findByIdAndUpdate(doctorId, { isEnrolled: false });

    res.status(201).json({ message: responseMessage, enrollment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── PATCH /api/doctor/enrollment/:doctorId/consultation-fee ──────────────────

router.patch("/enrollment/progress", verifyDoctorToken, async (req, res) => {
  try {
    const { doctorId, completedSteps, currentStep } = req.body;
    if (!doctorId) return res.status(400).json({ message: "Doctor ID required" });
    if (req.user.id !== doctorId) return res.status(403).json({ message: "Access denied." });

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });

    let enrollment = await Enrollment.findOne({ doctorId });
    if (!enrollment) {
      const nameParts = doctor.name.trim().split(/\s+/);
      enrollment = new Enrollment({
        doctorId,
        firstName: nameParts[0] || "",
        surname: nameParts.slice(1).join(" ") || "",
        email: doctor.email,
        approvalStatus: "pending",
        formCompleted: false,
        pendingRequestType: "new_enrollment",
      });
    }

    applyProgress(enrollment, completedSteps, currentStep);
    enrollment.updatedAt = new Date();
    await enrollment.save();

    return res.json({
      message: "Progress saved",
      enrollment: {
        completedSteps: enrollment.completedSteps,
        currentStep: enrollment.currentStep,
        currentStepLabel: enrollment.currentStepLabel,
        applicationStatus: enrollment.applicationStatus,
      },
    });
  } catch (err) {
    console.error("update enrollment progress error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

router.post("/profile-delete-request", verifyDoctorToken, async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { reason } = req.body || {};

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ message: "Doctor not found." });

    const enrollment = await Enrollment.findOne({ doctorId });
    if (!enrollment) return res.status(404).json({ message: "Enrollment not found." });

    if (enrollment.profileDeleteRequestStatus === "pending") {
      return res.status(400).json({ message: "A delete request is already pending admin approval." });
    }

    enrollment.profileDeleteReason = String(reason || "").trim();
    enrollment.profileDeleteRequestedAt = new Date();
    enrollment.profileDeleteRejectedAt = undefined;
    enrollment.profileDeleteApprovedAt = undefined;
    enrollment.profileDeleteRequestStatus = "pending";
    enrollment.pendingRequestType = "profile_delete";
    enrollment.applicationStatus = "Pending";
    enrollment.updatedAt = new Date();
    await enrollment.save();

    return res.status(201).json({
      message: "Profile delete request sent to admin for approval.",
      enrollment,
    });
  } catch (err) {
    console.error("profile delete request error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});
router.patch("/enrollment/:doctorId/consultation-fee", verifyDoctorToken, async (req, res) => {
  try {
    if (req.user.id !== req.params.doctorId) {
      return res.status(403).json({ message: "Access denied." });
    }
    const { consultantFees } = req.body;
    const fee = Number(consultantFees);
    if (isNaN(fee) || fee < 0)
      return res.status(400).json({ message: "Invalid fee amount." });

    const enrollment = await Enrollment.findOneAndUpdate(
      { doctorId: req.params.doctorId },
      { consultantFees: fee, updatedAt: new Date() },
      { new: true }
    );
    if (!enrollment)
      return res.status(404).json({ message: "Enrollment not found." });

    return res.json({ message: "Consultation fee updated.", consultantFees: enrollment.consultantFees });
  } catch (err) {
    console.error("update consultation fee error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

// ── GET /api/doctor/profile/:doctorId (lookup by 5-digit doctorId) ───────────
router.get("/profile/:doctorId", async (req, res) => {
  try {
    const numericId = parseInt(req.params.doctorId, 10);
    if (isNaN(numericId) || numericId < 10000 || numericId > 99999) {
      return res.status(400).json({ message: "Invalid doctor ID" });
    }

    const doctorDoc = await Doctor.findOne({ doctorId: numericId });
    if (!doctorDoc) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const enrollment = await Enrollment.findOne({ doctorId: doctorDoc._id })
      .populate("doctorId", "name email doctorId")
      .lean();

    if (!enrollment || enrollment.approvalStatus !== "approved") {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const e = enrollment;
    return res.json({
      id: e._id,
      doctorId: e.doctorId?.doctorId,
      mongoId: e.doctorId?._id,
      name: `${e.firstName || ""} ${e.surname || ""}`.trim() || e.doctorId?.name || "Unknown",
      email: e.email || e.doctorId?.email || "",
      specialty: e.specialization || "",
      subSpecialty: e.subSpecialization || "",
      degree: e.qualification || "",
      experience: e.experience || 0,
      price: e.consultantFees || 0,
      feeCurrency: e.feeCurrency || "USD",
      city: e.city || "",
      state: e.state || "",
      country: e.country || "",
      location: [e.city, e.state].filter(Boolean).join(", "),
      languages: e.languagesKnown || [],
      gender: e.gender || "",
      about: e.aboutDoctor || "",
      verified: e.verified || false,
      rating: 4.8,
      medicalSchool: e.medicalSchool || "",
      registrationYear: e.registrationYear || "",
      clinicName: e.clinicName || "",
      clinicAddress: e.clinicAddress || "",
      consultationMode: e.consultationMode || "",
      medicalRegistrationNumber: e.medicalRegistrationNumber || "",
      medicalCouncilName: e.medicalCouncilName || "",
      availability: e.availability || null,
      timezone: e.timezone || "",
    });
  } catch (err) {
    console.error("getDoctorByNumericId error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ── GET /api/doctor/approved ──────────────────────────────────────────────────
router.get("/approved", async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ approvalStatus: "approved" })
      .populate("doctorId", "name email doctorId")
      .lean();

    const doctors = enrollments.map((e) => ({
      id: e._id,
      doctorId: e.doctorId?.doctorId,
      mongoId: e.doctorId?._id,
      name: `Dr. ${e.firstName || ""} ${e.surname || ""}`.trim(),
      degree: e.qualification || "",
      specialty: e.specialization || "",
      languages: e.languagesKnown || [],
      location: [e.city, e.state].filter(Boolean).join(", "),
      price: e.consultantFees || 0,
      feeCurrency: e.feeCurrency || "USD",
      experience: e.experience || 0,
      gender: e.gender || "",
      rating: 0,
      initials: `${(e.firstName || " ")[0]}${(e.surname || " ")[0]}`.toUpperCase(),
      color: "#2563eb",
      source: "enrollment",
    }));

    return res.json(doctors);
  } catch (err) {
    console.error("approved doctors error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ── GET /api/doctor/:id ───────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id)
      .populate("doctorId", "name email doctorId")
      .lean();

    if (!enrollment || enrollment.approvalStatus !== "approved") {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const e = enrollment;
    return res.json({
      id: e._id,
      doctorId: e.doctorId?.doctorId,
      mongoId: e.doctorId?._id,
      name: `${e.firstName || ""} ${e.surname || ""}`.trim() || e.doctorId?.name || "Unknown",
      email: e.email || e.doctorId?.email || "",
      specialty: e.specialization || "",
      subSpecialty: e.subSpecialization || "",
      degree: e.qualification || "",
      experience: e.experience || 0,
      price: e.consultantFees || 0,
      feeCurrency: e.feeCurrency || "USD",
      city: e.city || "",
      state: e.state || "",
      country: e.country || "",
      location: [e.city, e.state].filter(Boolean).join(", "),
      languages: e.languagesKnown || [],
      gender: e.gender || "",
      about: e.aboutDoctor || "",
      verified: e.verified || false,
      rating: 4.8,
      medicalSchool: e.medicalSchool || "",
      registrationYear: e.registrationYear || "",
      clinicName: e.clinicName || "",
      clinicAddress: e.clinicAddress || "",
      consultationMode: e.consultationMode || "",
      medicalRegistrationNumber: e.medicalRegistrationNumber || "",
      medicalCouncilName: e.medicalCouncilName || "",
      availability: e.availability || null,
      timezone: e.timezone || "",
    });
  } catch (err) {
    console.error("getDoctorById error:", err);
    if (err.name === "CastError") {
      return res.status(404).json({ message: "Doctor not found" });
    }
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

