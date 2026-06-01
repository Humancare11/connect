const rateLimit = require("express-rate-limit");
const { recordSecurityIncident } = require("../utils/securityMonitor");

const buildLimiter = ({ windowMs, max, message, skipSuccessfulRequests = false }) =>
  rateLimit({
    windowMs,
    max,
    skipSuccessfulRequests,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      recordSecurityIncident(req, {
        type: message.includes("login") ? "failed_login" : "suspicious_activity",
        severity: "high",
        title: message.includes("login") ? "Multiple failed login attempts" : "Rate limit exceeded",
        resource: req.originalUrl,
        metadata: { limitMessage: message },
      });
      res.status(429).json({ msg: message, message });
    },
  });

const loginLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many login attempts. Please wait 15 minutes and try again.",
});

const registrationLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many registration attempts. Please wait 15 minutes and try again.",
});

const otpGenerationLimiter = buildLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: "Too many OTP requests. Please wait 1 hour before requesting another code.",
});

const otpVerificationLimiter = buildLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  skipSuccessfulRequests: true,
  message: "Too many OTP verification attempts. Please wait 1 hour and try again.",
});

module.exports = {
  loginLimiter,
  registrationLimiter,
  otpGenerationLimiter,
  otpVerificationLimiter,
};
