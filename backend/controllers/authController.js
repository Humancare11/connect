// controllers/authController.js
const bcrypt     = require("bcryptjs");
const jwt        = require("jsonwebtoken");
const User       = require("../models/User");
const Doctor     = require("../models/Doctor");
const { createAndSendOTP, verifyOTPCode } = require("../utils/otpUtils");
const { COOKIE_OPTS }                     = require("../middleware/verifyToken");

// ── helpers ───────────────────────────────────────────
const generateToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });

const cookieName = (role) => {
  if (role === "admin" || role === "superadmin") return "adminToken";
  if (role === "doctor") return "doctorToken";
  return "userToken";
};

const safeUser = (user) => ({
  _id:             user._id,
  name:            user.name,
  email:           user.email,
  role:            user.role,
  mobile:          user.mobile,
  dob:             user.dob,
  gender:          user.gender,
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

// ════════════════════════════════════════════
//  1. SEND OTP — user registration
// ════════════════════════════════════════════
const sendRegisterOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ msg: "Email is required." });

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
    const { name, email, password, mobile, dob, gender, otp } = req.body;

    if (!name || !email || !password || !otp)
      return res.status(400).json({ msg: "Name, email, password and OTP are required." });

    const clean = email.toLowerCase().trim();

    const exists = await User.findOne({ email: clean });
    if (exists) return res.status(409).json({ msg: "Email already registered." });

    const check = await verifyOTPCode(clean, otp, "register", "user");
    if (!check.valid) return res.status(400).json({ msg: check.msg });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name, email: clean, password: hashed, role: "user",
      mobile: mobile || "", dob: dob || "", gender: gender || "",
    });

    const token = generateToken(user);
    res.cookie("userToken", token, COOKIE_OPTS);
    return res.status(201).json({ msg: "Registration successful.", token, user: safeUser(user) });
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

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(400).json({ msg: "Invalid email or password." });

    if (user.role === "doctor")
      return res.status(403).json({ msg: "Please use the Doctor Login page." });
    if (user.role === "superadmin")
      return res.status(403).json({ msg: "Please use the Super Admin login." });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ msg: "Invalid email or password." });

    const token = generateToken(user);
    res.cookie("userToken", token, COOKIE_OPTS);
    return res.json({ msg: "Login successful.", token, user: safeUser(user) });
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
    if (password.length < 6) return res.status(400).json({ msg: "Password must be at least 6 characters." });

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
    if (!doctor)
      return res.status(400).json({ msg: "Invalid email or password." });

    if (doctor.role !== "doctor")
      return res.status(403).json({ msg: "This account is not registered as a doctor." });

    const match = await bcrypt.compare(password, doctor.password);
    if (!match) return res.status(400).json({ msg: "Invalid email or password." });

    const token = generateToken(doctor);
    res.cookie("doctorToken", token, COOKIE_OPTS);

    return res.json({
      msg: "Login successful.",
      token,              // ✅ frontend saves this to localStorage
      user: safeUser(doctor), // ✅ key is "user" (safeUser returns user object)
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

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !["admin", "superadmin"].includes(user.role))
      return res.status(401).json({ msg: "Invalid email or password." });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ msg: "Invalid email or password." });

    const token = generateToken(user);
    res.cookie("adminToken", token, COOKIE_OPTS);
    return res.json({ msg: "Login successful.", token, user: safeUser(user) });
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
    const { name, email, mobile, dob, gender } = req.body;
    const userId = req.user.id;
    if (!name || !email) return res.status(400).json({ msg: "Name and email are required." });

    if (!name || !email)
      return res.status(400).json({ msg: "Name and email are required." });

    const existing = await User.findOne({ email, _id: { $ne: userId } });
    if (existing) return res.status(400).json({ msg: "Email is already in use by another account." });

    const updated = await User.findByIdAndUpdate(
      userId,
      { name, email, mobile: mobile || "", dob: dob || "", gender: gender || "" },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ msg: "User not found." });

    const token = generateToken(updated);
    res.cookie("userToken", token, COOKIE_OPTS);
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
    const { accessToken, mobile, dob, gender } = req.body;
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
      const token = generateToken(user);
      res.cookie("userToken", token, COOKIE_OPTS);
      return res.json({ msg: "Login successful.", token, user: safeUser(user) });
    }

    if (!mobile || !dob || !gender)
      return res.status(200).json({ isNewUser: true, googleName: name, googleEmail: email });

    user = await User.create({ name, email, googleId, role: "user", mobile, dob, gender });
    const newToken = generateToken(user);
    res.cookie("userToken", newToken, COOKIE_OPTS);
    return res.status(201).json({ msg: "Registration successful.", token: newToken, user: safeUser(user) });
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

    const token = jwt.sign(
      { id: doctor._id, email: doctor.email, role: "doctor" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.cookie("doctorToken", token, COOKIE_OPTS);
    return res.status(isNewUser ? 201 : 200).json({
      message: isNewUser ? "Registration successful." : "Login successful.",
      token,
      isNewUser,
      doctor: { id: doctor._id, name: doctor.name, email: doctor.email, isEnrolled: doctor.isEnrolled },
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
    if (newPassword.length < 6)
      return res.status(400).json({ msg: "Password must be at least 6 characters." });

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

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
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
    if (newPassword.length < 6)
      return res.status(400).json({ msg: "New password must be at least 6 characters." });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found." });
    if (!user.password)
      return res.status(400).json({ msg: "Your account uses social Sign-In. Password cannot be changed here." });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(400).json({ msg: "Current password is incorrect." });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
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

const logout = (req, res) => {
  res.clearCookie("userToken", COOKIE_OPTS);
  res.json({ msg: "Logged out." });
};

const adminLogout = (req, res) => {
  res.clearCookie("adminToken", COOKIE_OPTS);
  res.json({ msg: "Logged out." });
};

module.exports = {
  register, login, doctorRegister, doctorLogin, adminLogin,
  updateProfile, googleAuthUser, googleAuthDoctor,
  sendRegisterOTP, sendForgotOTP, verifyForgotOTP, resetPasswordHandler,
  changePassword, me, adminMe, logout, adminLogout,
};
