// routes/auth.js
const express = require("express");
const router  = express.Router();

const {
  register, login, doctorRegister, doctorLogin, adminLogin, paymentAdminLogin,
  updateProfile, googleAuthUser, googleAuthDoctor,
  sendRegisterOTP, sendForgotOTP, verifyForgotOTP, resetPasswordHandler,
  changePassword, me, adminMe, refresh, logout, adminLogout,
  employeeAdminLogin, employeeAdminMe, employeeAdminLogout,
  requestAccountDeletion,
} = require("../controllers/authController");

const authMiddleware                                                    = require("../middleware/authMiddleware");
const { verifyUserToken, verifyAdminToken, verifyEmployeeAdminToken } = require("../middleware/verifyToken");
const {
  registrationLimiter,
  loginLimiter,
  otpRequestLimiter,
  otpVerifyLimiter,
} = require("../middleware/rateLimiters");

// ── User auth ─────────────────────────────────────────────────────────────────
router.post("/send-register-otp", otpRequestLimiter, sendRegisterOTP);
router.post("/register",          otpVerifyLimiter, registrationLimiter, register);
router.post("/login",             loginLimiter, login);
router.post("/refresh",           refresh);
router.post("/logout",            logout);
router.get ("/me",                verifyUserToken, me);

// ── Forgot password ───────────────────────────────────────────────────────────
router.post("/send-forgot-otp",   otpRequestLimiter, sendForgotOTP);
router.post("/verify-forgot-otp", otpVerifyLimiter, verifyForgotOTP);
router.post("/reset-password",    resetPasswordHandler);

// ── Google OAuth ──────────────────────────────────────────────────────────────
router.post("/google",            googleAuthUser);
router.post("/google-doctor",     googleAuthDoctor);

// ── Admin auth ────────────────────────────────────────────────────────────────
router.post("/admin-login",  loginLimiter, adminLogin);
router.post("/payment-admin-login", loginLimiter, paymentAdminLogin);
router.post("/admin-logout", adminLogout);
router.get ("/admin-me",     verifyAdminToken, adminMe);

// ── Employee Admin auth ───────────────────────────────────────────────────────
router.post("/employee-admin-login",  loginLimiter, employeeAdminLogin);
router.post("/employee-admin-logout", verifyEmployeeAdminToken, employeeAdminLogout);
router.get ("/employee-admin-me",     verifyEmployeeAdminToken, employeeAdminMe);

// ── Doctor auth (legacy via authController) ───────────────────────────────────
router.post("/doctor-register", registrationLimiter, doctorRegister);
router.post("/doctor-login",    loginLimiter, doctorLogin);

// ── Protected user routes ─────────────────────────────────────────────────────
router.put("/update-profile",  authMiddleware, updateProfile);
router.put("/change-password", authMiddleware, changePassword);
router.post("/account-delete-request", authMiddleware, requestAccountDeletion);

module.exports = router;
