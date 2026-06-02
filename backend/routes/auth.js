// routes/auth.js
const express = require("express");
const router  = express.Router();

const {
  register, login, doctorRegister, doctorLogin, adminLogin, paymentAdminLogin,
  updateProfile, googleAuthUser, googleAuthDoctor,
  sendRegisterOTP, sendForgotOTP, verifyForgotOTP, resetPasswordHandler,
  changePassword, me, adminMe, refresh, logout, adminLogout,
} = require("../controllers/authController");

const authMiddleware                        = require("../middleware/authMiddleware");
const { verifyUserToken, verifyAdminToken } = require("../middleware/verifyToken");
const {
  loginLimiter,
  registrationLimiter,
  otpGenerationLimiter,
  otpVerificationLimiter,
} = require("../middleware/rateLimiters");

// ── User auth ─────────────────────────────────────────────────────────────────
router.post("/send-register-otp", otpGenerationLimiter, sendRegisterOTP);
router.post("/register",          otpVerificationLimiter, register);
router.post("/login",             loginLimiter, login);
router.post("/refresh",           refresh);
router.post("/logout",            logout);
router.get ("/me",                verifyUserToken, me);

// ── Forgot password ───────────────────────────────────────────────────────────
router.post("/send-forgot-otp",   otpGenerationLimiter, sendForgotOTP);
router.post("/verify-forgot-otp", otpVerificationLimiter, verifyForgotOTP);
router.post("/reset-password",    loginLimiter, resetPasswordHandler);

// ── Google OAuth ──────────────────────────────────────────────────────────────
router.post("/google",            googleAuthUser);
router.post("/google-doctor",     googleAuthDoctor);

// ── Admin auth ────────────────────────────────────────────────────────────────
router.post("/admin-login",  loginLimiter, adminLogin);
router.post("/payment-admin-login", loginLimiter, paymentAdminLogin);
router.post("/admin-logout", adminLogout);
router.get ("/admin-me",     verifyAdminToken, adminMe);

// ── Doctor auth (legacy via authController) ───────────────────────────────────
router.post("/doctor-register", registrationLimiter, doctorRegister);
router.post("/doctor-login",    loginLimiter, doctorLogin);

// ── Protected user routes ─────────────────────────────────────────────────────
router.put("/update-profile",  authMiddleware, updateProfile);
router.put("/change-password", authMiddleware, changePassword);

module.exports = router;
