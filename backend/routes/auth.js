// routes/auth.js
const express = require("express");
const router  = express.Router();

const {
  register, login, doctorRegister, doctorLogin, adminLogin,
  updateProfile, googleAuthUser, googleAuthDoctor,
  sendRegisterOTP, sendForgotOTP, verifyForgotOTP, resetPasswordHandler,
  changePassword, me, adminMe, logout, adminLogout,
} = require("../controllers/authController");

const authMiddleware                        = require("../middleware/authMiddleware");
const { verifyUserToken, verifyAdminToken } = require("../middleware/verifyToken");

// ── User auth ─────────────────────────────────────────────────────────────────
router.post("/send-register-otp", sendRegisterOTP);
router.post("/register",          register);
router.post("/login",             login);
router.post("/logout",            logout);
router.get ("/me",                verifyUserToken, me);

// ── Forgot password ───────────────────────────────────────────────────────────
router.post("/send-forgot-otp",   sendForgotOTP);
router.post("/verify-forgot-otp", verifyForgotOTP);
router.post("/reset-password",    resetPasswordHandler);

// ── Google OAuth ──────────────────────────────────────────────────────────────
router.post("/google",            googleAuthUser);
router.post("/google-doctor",     googleAuthDoctor);

// ── Admin auth ────────────────────────────────────────────────────────────────
router.post("/admin-login",  adminLogin);
router.post("/admin-logout", adminLogout);
router.get ("/admin-me",     verifyAdminToken, adminMe);

// ── Doctor auth (legacy via authController) ───────────────────────────────────
router.post("/doctor-register", doctorRegister);
router.post("/doctor-login",    doctorLogin);

// ── Protected user routes ─────────────────────────────────────────────────────
router.put("/update-profile",  authMiddleware, updateProfile);
router.put("/change-password", authMiddleware, changePassword);

module.exports = router;
