const express  = require("express");
const router   = express.Router();
const jwt      = require("jsonwebtoken");
const bcrypt   = require("bcryptjs");
const Doctor   = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const { COOKIE_OPTS, verifyDoctorToken } = require("../middleware/verifyToken");
const { createAndSendOTP, verifyOTPCode } = require("../utils/otpUtils");

const signToken = (id, email) =>
  jwt.sign({ id, email, role: "doctor" }, process.env.JWT_SECRET, { expiresIn: "7d" });

// ── POST /api/doctor/send-register-otp ───────────────────────────────────────
router.post("/send-register-otp", async (req, res) => {
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
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, confirmPassword, otp } = req.body;

    if (!name || !email || !password || !confirmPassword || !otp)
      return res.status(400).json({ message: "All fields are required." });
    if (!/\S+@\S+\.\S+/.test(email))
      return res.status(400).json({ message: "Enter a valid email." });
    if (password.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    if (password !== confirmPassword)
      return res.status(400).json({ message: "Passwords do not match." });

    const cleanEmail = email.toLowerCase().trim();
    const existing = await Doctor.findOne({ email: cleanEmail });
    if (existing)
      return res.status(409).json({ message: "This email is already registered. Please login." });

    const check = await verifyOTPCode(cleanEmail, otp, "register", "doctor");
    if (!check.valid) return res.status(400).json({ message: check.msg });

    const doctor = await Doctor.create({ name, email: cleanEmail, password });
    const token  = signToken(doctor._id, doctor.email);

    res.cookie("doctorToken", token, COOKIE_OPTS);
    return res.status(201).json({
      message: "Doctor registered successfully.",
      token,
      doctor: { id: doctor._id, name: doctor.name, email: doctor.email, isEnrolled: doctor.isEnrolled },
    });
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ message: "This email is already registered. Please login." });
    return res.status(500).json({ message: err.message || "Server error. Please try again." });
  }
});

// ── POST /api/doctor/login ────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required." });

    const cleanEmail = email.toLowerCase().trim();
    const doctor = await Doctor.findOne({ email: cleanEmail });
    if (!doctor)
      return res.status(401).json({ message: "Login credentials are incorrect." });

    const isMatch = await doctor.comparePassword(password);
    if (!isMatch)
      return res.status(401).json({ message: "Login credentials are incorrect." });

    const token = signToken(doctor._id, doctor.email);
    res.cookie("doctorToken", token, COOKIE_OPTS);
    return res.status(200).json({
      message: "Login successful.",
      token,
      doctor: { id: doctor._id, name: doctor.name, email: doctor.email, isEnrolled: doctor.isEnrolled },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error. Please try again." });
  }
});

// ── POST /api/doctor/send-forgot-otp ─────────────────────────────────────────
router.post("/send-forgot-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required." });

    const clean  = email.toLowerCase().trim();
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
router.post("/verify-forgot-otp", async (req, res) => {
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
router.post("/reset-password", async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword)
      return res.status(400).json({ message: "Reset token and new password are required." });
    if (newPassword.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters." });

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

    // Pre-save hook in Doctor model handles hashing
    doctor.password = newPassword;
    await doctor.save();

    return res.json({ message: "Password reset successfully." });
  } catch (err) {
    console.error("resetDoctorPassword error:", err);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
});

// ── POST /api/doctor/logout ───────────────────────────────────────────────────
router.post("/logout", (req, res) => {
  res.clearCookie("doctorToken", COOKIE_OPTS);
  res.json({ message: "Logged out." });
});

// ── GET /api/doctor/me ────────────────────────────────────────────────────────
router.get("/me", verifyDoctorToken, async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.user.id).select("-password");
    if (!doctor) return res.status(404).json({ message: "Doctor not found." });
    return res.status(200).json({
      doctor: { id: doctor._id, name: doctor.name, email: doctor.email, isEnrolled: doctor.isEnrolled },
    });
  } catch {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
});

// ── GET /api/doctor/enrollment/:doctorId ──────────────────────────────────────
router.get("/enrollment/:doctorId", async (req, res) => {
  try {
    const enrollment = await Enrollment.findOne({ doctorId: req.params.doctorId });
    res.json(enrollment);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

// ── POST /api/doctor/enrollment ───────────────────────────────────────────────
router.post("/enrollment", async (req, res) => {
  try {
    const { doctorId, ...enrollmentData } = req.body;
    if (!doctorId) return res.status(400).json({ message: "Doctor ID required" });

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });

    let enrollment = await Enrollment.findOne({ doctorId });
    let responseMessage = "Enrollment submitted successfully";

    if (enrollment) {
      const wasApprovedOrRejected =
        enrollment.approvalStatus === "approved" || enrollment.approvalStatus === "rejected";
      Object.assign(enrollment, enrollmentData);
      if (wasApprovedOrRejected) {
        enrollment.approvalStatus = "pending";
        enrollment.verified = false;
        responseMessage = "Update request submitted and pending admin approval.";
      }
      enrollment.updatedAt = new Date();
      await enrollment.save();
    } else {
      enrollment = new Enrollment({ doctorId, ...enrollmentData });
      await enrollment.save();
      await Doctor.findByIdAndUpdate(doctorId, { isEnrolled: true });
    }

    res.status(201).json({ message: responseMessage, enrollment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── GET /api/doctor/approved ──────────────────────────────────────────────────
router.get("/approved", async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ approvalStatus: "approved" })
      .populate("doctorId", "name email")
      .lean();

    const doctors = enrollments.map((e) => ({
      id:         e._id,
      doctorId:   e.doctorId?._id,
      name:       `Dr. ${e.firstName || ""} ${e.surname || ""}`.trim(),
      degree:     e.qualification || "",
      specialty:  e.specialization || "",
      languages:  e.languagesKnown || [],
      location:   [e.city, e.state].filter(Boolean).join(", "),
      price:      e.consultantFees || 0,
      experience: e.experience || 0,
      gender:     e.gender || "",
      rating:     0,
      initials:   `${(e.firstName || " ")[0]}${(e.surname || " ")[0]}`.toUpperCase(),
      color:      "#2563eb",
      source:     "enrollment",
    }));

    return res.json(doctors);
  } catch (err) {
    console.error("approved doctors error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
