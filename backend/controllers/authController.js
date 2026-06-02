// controllers/authController.js
const bcrypt     = require("bcryptjs");
const jwt        = require("jsonwebtoken");
const User       = require("../models/User");
const Doctor     = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const Consent    = require("../models/Consent");
const { createAndSendOTP, verifyOTPCode } = require("../utils/otpUtils");
const Session    = require("../models/Session");
const {
  COOKIE_OPTS,
  REFRESH_COOKIE_OPTS,
  REFRESH_COOKIE_BY_ROLE,
  ACCESS_COOKIE_BY_ROLE,
  issueAuthCookies,
  clearAuthCookies,
  signAccessToken,
  signRefreshToken,
  INACTIVITY_TIMEOUT_MS,
  REFRESH_TOKEN_MS,
} = require("../middleware/verifyToken");
const { logAudit, getIp }                 = require("../utils/auditLogger");
const { assertPasswordAllowed, rememberPassword, validatePasswordStrength } = require("../utils/passwordPolicy");
const { revokeSession, revokeUserSessions } = require("../utils/tokenRevocation");
const { recordFailedLogin, recordSecurityIncident } = require("../utils/securityMonitor");

const CONSENT_POLICY_VERSION = "privacy-hipaa-v1";
const passwordError = (res, result) => res.status(400).json({ msg: result.errors.join(" ") });
const DOB_MIN_YEAR = 1900;

const validateDob = (dob) => {
  if (!dob) return { valid: false, msg: "Date of Birth is required." };

  const value = String(dob).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { valid: false, msg: "Date of Birth must be a valid date." };
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return { valid: false, msg: "Date of Birth must be a valid date." };
  }

  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (date > todayUtc) return { valid: false, msg: "Date of Birth cannot be in the future." };
  if (date.getUTCFullYear() < DOB_MIN_YEAR) {
    return { valid: false, msg: `Date of Birth must be in or after ${DOB_MIN_YEAR}.` };
  }

  return { valid: true };
};

// ── helpers ───────────────────────────────────────────
const safeUser = (user) => ({
  _id:             user._id,
  name:            user.name,
  email:           user.email,
  role:            user.role,
  mobile:          user.mobile,
  dob:             user.dob,
  gender:          user.gender,
  country:         user.country,
  specialty:       user.specialty,
  degree:          user.degree,
  experience:      user.experience,
  licenseNumber:   user.licenseNumber,
  hospital:        user.hospital,
  consultationFee: user.consultationFee,
  bio:             user.bio,
  phone:           user.phone,
  isVerified:      user.isVerified,
  rating:          user.rating,
});

const STEP_LABELS = ["Identity", "Professional", "Availability", "Payout", "Submitted"];

const ensureDoctorEnrollment = async (doctor) => {
  const existingEnrollment = await Enrollment.findOne({ doctorId: doctor._id });
  if (existingEnrollment) return existingEnrollment;

  const nameParts = (doctor.name || "").trim().split(/\s+/);
  return Enrollment.create({
    doctorId: doctor._id,
    firstName: nameParts[0] || "",
    surname: nameParts.slice(1).join(" ") || "",
    email: doctor.email,
    approvalStatus: "pending",
    formCompleted: false,
    completedSteps: 0,
    currentStep: 1,
    currentStepLabel: STEP_LABELS[0],
    applicationStatus: "in_progress",
    pendingRequestType: "new_enrollment",
    profileDeleteRequestStatus: "none",
  });
};

// ════════════════════════════════════════════
//  1. SEND OTP — user registration
// ════════════════════════════════════════════
const sendRegisterOTP = async (req, res) => {
  try {
    const { email, password, dob, privacyConsent, hipaaConsent } = req.body;
    if (!email) return res.status(400).json({ msg: "Email is required." });
    if (password !== undefined) {
      const passwordCheck = validatePasswordStrength(password);
      if (!passwordCheck.valid) return passwordError(res, passwordCheck);
    }
    if (dob !== undefined) {
      const dobCheck = validateDob(dob);
      if (!dobCheck.valid) return res.status(400).json({ msg: dobCheck.msg });
    }
    if (privacyConsent !== undefined || hipaaConsent !== undefined) {
      if (!hasAcceptedConsent(privacyConsent) || !hasAcceptedConsent(hipaaConsent)) {
        return res.status(400).json({ msg: "Terms, Privacy Policy, and HIPAA consent must be accepted to register." });
      }
    }

    const clean = email.toLowerCase().trim();
    const exists = await User.findOne({ email: clean });
    if (exists) return res.status(409).json({ msg: "This email is already registered. Please sign in." });

    await createAndSendOTP(clean, "register", "user");
    return res.json({ msg: "OTP sent to your email." });
  } catch (err) {
    console.error("sendRegisterOTP error:", err);
    return res.status(500).json({ msg: `Failed to send OTP: ${err.message}` });
  }
};

// ════════════════════════════════════════════
//  2. USER REGISTER  (requires OTP)
// ════════════════════════════════════════════
const register = async (req, res) => {
  try {
    const { name, email, password, mobile, dob, gender, country, otp, privacyConsent, hipaaConsent } = req.body;

    if (!name || !email || !password || !otp)
      return res.status(400).json({ msg: "Name, email, password and OTP are required." });
    if (!hasAcceptedConsent(privacyConsent) || !hasAcceptedConsent(hipaaConsent))
      return res.status(400).json({ msg: "Terms, Privacy Policy, and HIPAA consent must be accepted to register." });
    const dobCheck = validateDob(dob);
    if (!dobCheck.valid) return res.status(400).json({ msg: dobCheck.msg });

    const clean = email.toLowerCase().trim();

    const exists = await User.findOne({ email: clean });
    if (exists) return res.status(409).json({ msg: "Email already registered." });

    const passwordCheck = await assertPasswordAllowed({ userType: "user", password });
    if (!passwordCheck.valid) return passwordError(res, passwordCheck);

    const check = await verifyOTPCode(clean, otp, "register", "user");
    if (!check.valid) return res.status(400).json({ msg: check.msg });

    const ip = getIp(req);

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name, email: clean, password: hashed, role: "user",
      mobile: mobile || "", dob: dob || "", gender: gender || "",
      country: country || "", registrationIp: ip,
    });
    await rememberPassword({ userId: user._id, userType: "user", passwordHash: hashed });

    await recordConsent(req, user);

    await issueAuthCookies(res, user);

    await logAudit(req, {
      action: "REGISTER",
      resource: "User",
      resourceId: user._id,
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      userRole: "user",
      details: { gender: user.gender, country: user.country },
    });

    return res.status(201).json({ msg: "Registration successful.", user: safeUser(user) });
  } catch (err) {
    console.error("register error:", err);
    return res.status(500).json({ msg: "Server error. Please try again." });
  }
};

// ════════════════════════════════════════════
//  3. USER LOGIN
// ════════════════════════════════════════════
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ msg: "Email and password are required." });

    const clean = email.toLowerCase().trim();
    const user  = await User.findOne({ email: clean });

    if (!user) {
      await logAudit(req, {
        action: "LOGIN_FAILED",
        resource: "User",
        userEmail: clean,
        success: false,
        details: { reason: "Email not found" },
      });
      await recordFailedLogin(req, { email: clean, portal: "patient" });
      return res.status(400).json({ msg: "Invalid email or password." });
    }

    if (user.accountDisabled) {
      await recordSecurityIncident(req, {
        type: "unauthorized_access",
        severity: "high",
        title: "Disabled account login attempt",
        userId: user._id,
        userEmail: user.email,
        userRole: user.role,
        metadata: { portal: "patient", disabledAt: user.disabledAt },
      });
      return res.status(403).json({ msg: "This account is disabled. Contact support." });
    }

    if (user.role === "doctor") {
      await logAudit(req, {
        action: "LOGIN_FAILED",
        resource: "User",
        userId: user._id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        success: false,
        details: { reason: "Wrong portal — doctor using patient login" },
      });
      await recordSecurityIncident(req, {
        type: "privilege_escalation",
        severity: "high",
        title: "Doctor account used patient login portal",
        userId: user._id,
        userEmail: user.email,
        userRole: user.role,
        metadata: { portal: "patient" },
      });
      return res.status(403).json({ msg: "Please use the Doctor Login page." });
    }
    if (user.role === "superadmin") {
      await logAudit(req, {
        action: "LOGIN_FAILED",
        resource: "User",
        userId: user._id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        success: false,
        details: { reason: "Wrong portal — superadmin using patient login" },
      });
      await recordSecurityIncident(req, {
        type: "privilege_escalation",
        severity: "high",
        title: "Superadmin account used patient login portal",
        userId: user._id,
        userEmail: user.email,
        userRole: user.role,
        metadata: { portal: "patient" },
      });
      return res.status(403).json({ msg: "Please use the Super Admin login." });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      await logAudit(req, {
        action: "LOGIN_FAILED",
        resource: "User",
        userId: user._id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        success: false,
        details: { reason: "Incorrect password" },
      });
      await recordFailedLogin(req, { email: clean, userId: user._id, userRole: user.role, portal: "patient" });
      return res.status(400).json({ msg: "Invalid email or password." });
    }

    await issueAuthCookies(res, user);

    await logAudit(req, {
      action: "LOGIN_SUCCESS",
      resource: "User",
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
    });

    return res.json({ msg: "Login successful.", user: safeUser(user) });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ msg: "Server error. Please try again." });
  }
};

// ════════════════════════════════════════════
//  4. DOCTOR REGISTER (legacy — kept for old clients)
// ════════════════════════════════════════════
const doctorRegister = async (req, res) => {
  try {
    const { name, email, password, phone, gender, specialty, degree, experience, licenseNumber, hospital, consultationFee, bio } = req.body;

    if (!name || !email || !password) return res.status(400).json({ msg: "Name, email and password are required." });
    if (!specialty)     return res.status(400).json({ msg: "Specialization is required." });
    if (!degree)        return res.status(400).json({ msg: "Degree / qualification is required." });
    if (!licenseNumber) return res.status(400).json({ msg: "Medical license number is required." });
    const passwordCheck = await assertPasswordAllowed({ userType: "user", password });
    if (!passwordCheck.valid) return passwordError(res, passwordCheck);

    const clean = email.toLowerCase().trim();
    const exists = await User.findOne({ email: clean });
    if (exists) return res.status(400).json({ msg: "Email already registered." });

    const hashed = await bcrypt.hash(password, 10);
    const doctor = await User.create({
      name, email: clean, password: hashed, role: "doctor",
      phone: phone || "", gender: gender || "", specialty: specialty || "",
      degree: degree || "", experience: experience || "",
      licenseNumber: licenseNumber || "", hospital: hospital || "",
      consultationFee: consultationFee ? Number(consultationFee) : 0,
      bio: bio || "", isVerified: false,
    });
    await rememberPassword({ userId: doctor._id, userType: "user", passwordHash: hashed });

    return res.status(201).json({ msg: "Doctor registration successful. Please login.", user: safeUser(doctor) });
  } catch (err) {
    console.error("doctorRegister error:", err);
    return res.status(500).json({ msg: "Server error. Please try again." });
  }
};

// ════════════════════════════════════════════
//  5. DOCTOR LOGIN (legacy)
// ════════════════════════════════════════════
const doctorLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ msg: "Email and password are required." });

    if (!email || !password)
      return res.status(400).json({ msg: "Email and password are required." });

    const doctor = await User.findOne({ email });
    if (!doctor) {
      await recordFailedLogin(req, { email, portal: "legacy-doctor" });
      return res.status(400).json({ msg: "Invalid email or password." });
    }

    if (doctor.role !== "doctor")
      return res.status(403).json({ msg: "This account is not registered as a doctor." });

    const match = await bcrypt.compare(password, doctor.password);
    if (!match) {
      await recordFailedLogin(req, { email, userId: doctor._id, userRole: doctor.role, portal: "legacy-doctor" });
      return res.status(400).json({ msg: "Invalid email or password." });
    }

    await issueAuthCookies(res, doctor);

    return res.json({
      msg: "Login successful.",
      user: safeUser(doctor),
    });
  } catch (err) {
    console.error("doctorLogin error:", err);
    return res.status(500).json({ msg: "Server error. Please try again." });
  }
};

// ════════════════════════════════════════════
//  6. ADMIN LOGIN
// ════════════════════════════════════════════
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ msg: "Email and password are required." });

    const clean = email.toLowerCase().trim();
    const user  = await User.findOne({ email: clean });

    if (!user || !["admin", "superadmin"].includes(user.role)) {
      await logAudit(req, {
        action: "LOGIN_FAILED",
        resource: "Admin",
        userEmail: clean,
        success: false,
        details: { reason: "Invalid admin credentials or not an admin" },
      });
      await recordFailedLogin(req, { email: clean, portal: "admin" });
      return res.status(401).json({ msg: "Invalid email or password." });
    }

    if (user.accountDisabled) {
      await recordSecurityIncident(req, {
        type: "unauthorized_access",
        severity: "high",
        title: "Disabled admin login attempt",
        userId: user._id,
        userEmail: user.email,
        userRole: user.role,
        metadata: { portal: "admin", disabledAt: user.disabledAt },
      });
      return res.status(403).json({ msg: "This account is disabled. Contact support." });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      await logAudit(req, {
        action: "LOGIN_FAILED",
        resource: "Admin",
        userId: user._id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        success: false,
        details: { reason: "Incorrect password" },
      });
      await recordFailedLogin(req, { email: clean, userId: user._id, userRole: user.role, portal: "admin" });
      return res.status(401).json({ msg: "Invalid email or password." });
    }

    await issueAuthCookies(res, user);

    await logAudit(req, {
      action: "LOGIN_SUCCESS",
      resource: "Admin",
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
    });

    return res.json({ msg: "Login successful.", user: safeUser(user) });
  } catch (err) {
    console.error("adminLogin error:", err);
    return res.status(500).json({ msg: "Server error. Please try again." });
  }
};

// ════════════════════════════════════════════
//  7. UPDATE USER PROFILE
// ════════════════════════════════════════════
const updateProfile = async (req, res) => {
  try {
    const { name, email, mobile, dob, gender, country } = req.body;
    const userId = req.user.id;
    if (!name || !email) return res.status(400).json({ msg: "Name and email are required." });

    const existing = await User.findOne({ email, _id: { $ne: userId } });
    if (existing) return res.status(400).json({ msg: "Email is already in use by another account." });

    const updated = await User.findByIdAndUpdate(
      userId,
      { name, email, mobile: mobile || "", dob: dob || "", gender: gender || "", country: country || "" },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ msg: "User not found." });

    await logAudit(req, {
      action: "PROFILE_UPDATE",
      resource: "User",
      resourceId: updated._id,
      userId: updated._id,
      userName: updated.name,
      userEmail: updated.email,
      userRole: updated.role,
      details: { updatedFields: ["name", "email", "mobile", "dob", "gender", "country"] },
    });

    return res.json({ msg: "Profile updated successfully.", user: safeUser(updated) });
  } catch (err) {
    console.error("updateProfile error:", err);
    return res.status(500).json({ msg: "Server error. Please try again." });
  }
};

// ════════════════════════════════════════════
//  8. GOOGLE AUTH — USER
// ════════════════════════════════════════════
const googleAuthUser = async (req, res) => {
  try {
    const { accessToken, mobile, dob, gender, country, privacyConsent, hipaaConsent } = req.body;
    if (!accessToken) return res.status(400).json({ msg: "Google access token is required." });

    // Verify token and fetch profile via Google's userinfo endpoint
    const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!infoRes.ok) return res.status(401).json({ msg: "Invalid Google token. Please try signing in again." });
    const { sub: googleId, email, name } = await infoRes.json();

    let user = await User.findOne({ $or: [{ googleId }, { email }] });
    if (user) {
      if (user.role === "doctor") return res.status(403).json({ msg: "Please use the Doctor Login page." });
      if (!user.googleId) { user.googleId = googleId; await user.save(); }
      await issueAuthCookies(res, user);
      return res.json({ msg: "Login successful.", user: safeUser(user) });
    }

    if (!mobile || !dob || !gender || !country)
      return res.status(200).json({ isNewUser: true, googleName: name, googleEmail: email });
    if (!hasAcceptedConsent(privacyConsent) || !hasAcceptedConsent(hipaaConsent))
      return res.status(400).json({ msg: "Terms, Privacy Policy, and HIPAA consent must be accepted to register." });
    const dobCheck = validateDob(dob);
    if (!dobCheck.valid) return res.status(400).json({ msg: dobCheck.msg });

    const ip = getIp(req);

    user = await User.create({ name, email, googleId, role: "user", mobile, dob, gender, country, registrationIp: ip });
    await recordConsent(req, user);
    await issueAuthCookies(res, user);
    return res.status(201).json({ msg: "Registration successful.", user: safeUser(user) });
  } catch (err) {
    console.error("googleAuthUser error:", err);
    return res.status(500).json({ msg: "Google Sign-In failed. Please try again." });
  }
};

// ════════════════════════════════════════════
//  9. GOOGLE AUTH — DOCTOR
// ════════════════════════════════════════════
const googleAuthDoctor = async (req, res) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken) return res.status(400).json({ msg: "Google access token is required." });

    const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!infoRes.ok) return res.status(401).json({ msg: "Invalid Google token. Please try signing in again." });
    const { sub: googleId, email, name } = await infoRes.json();

    let doctor = await Doctor.findOne({ $or: [{ googleId }, { email }] });
    const isNewUser = !doctor;

    if (doctor) {
      if (!doctor.googleId) { doctor.googleId = googleId; await doctor.save(); }
    } else {
      doctor = await Doctor.create({ name, email, googleId });
    }

    await ensureDoctorEnrollment(doctor);

    await issueAuthCookies(res, { ...doctor.toObject(), role: "doctor" });
    return res.status(isNewUser ? 201 : 200).json({
      message: isNewUser ? "Registration successful." : "Login successful.",
      isNewUser,
      doctor: { id: doctor._id, doctorId: doctor.doctorId, name: doctor.name, email: doctor.email, isEnrolled: doctor.isEnrolled },
    });
  } catch (err) {
    console.error("googleAuthDoctor error:", err);
    return res.status(500).json({ msg: "Google Sign-In failed. Please try again." });
  }
};

// ════════════════════════════════════════════
//  10. FORGOT PASSWORD — send OTP (user)
// ════════════════════════════════════════════
const sendForgotOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ msg: "Email is required." });

    const clean = email.toLowerCase().trim();
    const user  = await User.findOne({ email: clean });
    if (!user) return res.status(404).json({ msg: "No account found with this email." });
    if (["doctor"].includes(user.role))
      return res.status(403).json({ msg: "Please use the Doctor Login page." });

    await createAndSendOTP(clean, "forgot", "user");
    return res.json({ msg: "Password reset OTP sent to your email." });
  } catch (err) {
    console.error("sendForgotOTP error:", err);
    return res.status(500).json({ msg: `Failed to send OTP: ${err.message}` });
  }
};

// ════════════════════════════════════════════
//  13. FORGOT PASSWORD — verify OTP (user)
// ════════════════════════════════════════════
const verifyForgotOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ msg: "Email and OTP are required." });

    const clean = email.toLowerCase().trim();
    const check = await verifyOTPCode(clean, otp, "forgot", "user");
    if (!check.valid) return res.status(400).json({ msg: check.msg });

    // Issue a short-lived reset token (15 min)
    const resetToken = jwt.sign(
      { email: clean, role: "user", purpose: "password-reset" },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );
    return res.json({ msg: "OTP verified.", resetToken });
  } catch (err) {
    console.error("verifyForgotOTP error:", err);
    return res.status(500).json({ msg: "Server error. Please try again." });
  }
};

// ════════════════════════════════════════════
//  14. FORGOT PASSWORD — reset (user)
// ════════════════════════════════════════════
const resetPasswordHandler = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword)
      return res.status(400).json({ msg: "Reset token and new password are required." });

    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ msg: "Reset link expired. Please request a new one." });
    }
    if (decoded.purpose !== "password-reset" || decoded.role !== "user")
      return res.status(400).json({ msg: "Invalid reset token." });

    const user = await User.findOne({ email: decoded.email });
    if (!user) return res.status(404).json({ msg: "Account not found." });

    const passwordCheck = await assertPasswordAllowed({
      userId: user._id,
      userType: "user",
      password: newPassword,
      currentHash: user.password,
    });
    if (!passwordCheck.valid) return passwordError(res, passwordCheck);

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    await rememberPassword({ userId: user._id, userType: "user", passwordHash: user.password });
    await revokeUserSessions(user._id, "password_reset");
    return res.json({ msg: "Password reset successfully." });
  } catch (err) {
    console.error("resetPasswordHandler error:", err);
    return res.status(500).json({ msg: "Server error. Please try again." });
  }
};

// ════════════════════════════════════════════
//  15. CHANGE PASSWORD (authenticated)
// ════════════════════════════════════════════
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword)
      return res.status(400).json({ msg: "Current password and new password are required." });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found." });
    if (!user.password)
      return res.status(400).json({ msg: "Your account uses social Sign-In. Password cannot be changed here." });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(400).json({ msg: "Current password is incorrect." });

    const passwordCheck = await assertPasswordAllowed({
      userId: user._id,
      userType: "user",
      password: newPassword,
      currentHash: user.password,
    });
    if (!passwordCheck.valid) return passwordError(res, passwordCheck);

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    await rememberPassword({ userId: user._id, userType: "user", passwordHash: user.password });
    await revokeUserSessions(user._id, "password_change");

    await logAudit(req, {
      action: "PASSWORD_CHANGE",
      resource: "User",
      resourceId: user._id,
    });

    return res.json({ msg: "Password changed successfully." });
  } catch (err) {
    console.error("changePassword error:", err);
    return res.status(500).json({ msg: "Server error. Please try again." });
  }
};

// ════════════════════════════════════════════
//  16. /ME  /ADMIN-ME  LOGOUT
// ════════════════════════════════════════════
const me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ msg: "User not found." });
    return res.json({ user: safeUser(user) });
  } catch (err) {
    return res.status(500).json({ msg: "Server error." });
  }
};

const adminMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user || !["admin", "superadmin"].includes(user.role))
      return res.status(404).json({ msg: "Admin not found." });
    return res.json({ user: safeUser(user) });
  } catch (err) {
    return res.status(500).json({ msg: "Server error." });
  }
};

const hasAcceptedConsent = (value) => value === true || value === "true" || value === "accepted";

const recordConsent = async (req, user) => {
  const ipAddress = getIp(req);
  const acceptedAt = new Date();

  await Consent.create({
    userId: user._id,
    status: "accepted",
    policyVersion: CONSENT_POLICY_VERSION,
    acceptedAt,
    ipAddress,
    userAgent: req.headers["user-agent"] || "",
  });

  user.privacyConsent = {
    accepted: true,
    acceptedAt,
    policyVersion: CONSENT_POLICY_VERSION,
    ipAddress,
  };
  await user.save();

  await logAudit(req, {
    action: "PATIENT_CONSENT_ACCEPTED",
    resource: "Consent",
    resourceId: user._id,
    userId: user._id,
    userName: user.name,
    userEmail: user.email,
    userRole: user.role,
    patientId: user._id,
    details: { policyVersion: CONSENT_POLICY_VERSION },
  });
};

const refresh = async (req, res) => {
  const candidates = Object.entries(REFRESH_COOKIE_BY_ROLE)
    .map(([role, name]) => ({ role, token: req.cookies?.[name] }))
    .filter((item) => item.token);

  for (const { role, token } of candidates) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.type !== "refresh" || decoded.role !== role) continue;

      const session = await Session.findById(decoded.sid);
      if (!session || session.revokedAt) continue;
      if (session.userId !== String(decoded.id) || session.role !== decoded.role) continue;

      if (Date.now() - session.lastActivityAt.getTime() > INACTIVITY_TIMEOUT_MS) {
        session.revokedAt = new Date();
        await session.save();
        clearAuthCookies(res, decoded.role);
        return res.status(401).json({ msg: "Session timed out." });
      }

      session.lastActivityAt = new Date();
      session.expiresAt = new Date(Date.now() + REFRESH_TOKEN_MS);
      await session.save();

      const identity = { id: decoded.id, _id: decoded.id, email: decoded.email, role: decoded.role };
      res.cookie(ACCESS_COOKIE_BY_ROLE[decoded.role], signAccessToken(identity, session._id), COOKIE_OPTS);
      res.cookie(REFRESH_COOKIE_BY_ROLE[decoded.role], signRefreshToken(identity, session._id), REFRESH_COOKIE_OPTS);
      return res.json({ msg: "Session refreshed." });
    } catch {
      // Try the next refresh cookie.
    }
  }

  return res.status(401).json({ msg: "No valid refresh session." });
};

const logout = async (req, res) => {
  await logAudit(req, { action: "LOGOUT", resource: "User" });
  if (req.user?.sid) await revokeSession(req.user.sid, "logout");
  clearAuthCookies(res, "user");
  res.json({ msg: "Logged out." });
};

const adminLogout = async (req, res) => {
  await logAudit(req, { action: "LOGOUT", resource: "Admin" });
  if (req.user?.sid) await revokeSession(req.user.sid, "logout");
  clearAuthCookies(res, req.user?.role === "superadmin" ? "superadmin" : "admin");
  res.json({ msg: "Logged out." });
};

module.exports = {
  register, login, doctorRegister, doctorLogin, adminLogin,
  updateProfile, googleAuthUser, googleAuthDoctor,
  sendRegisterOTP, sendForgotOTP, verifyForgotOTP, resetPasswordHandler,
  changePassword, me, adminMe, refresh, logout, adminLogout,
};

