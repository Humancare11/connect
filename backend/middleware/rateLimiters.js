const rateLimit = require("express-rate-limit");
const { recordSecurityIncident } = require("../utils/securityMonitor");

// ── Generic IP-keyed limiter (login, registration) ────────────────────────────
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

// ── Per-email OTP rate limiting ────────────────────────────────────────────────
// Tracks attempts per email address so one account's block never affects others.
// Uses a lightweight in-memory Map; entries auto-expire after the window.

const OTP_SEND_WINDOW_MS    = 10 * 60 * 1000; // 10-minute cooldown
const OTP_VERIFY_WINDOW_MS  = 15 * 60 * 1000; // 15-minute cooldown
const OTP_SEND_MAX          = 3;               // max sends per window
const OTP_VERIFY_MAX        = 5;               // max failed verifications per window

// store: Map<email, { count: number, firstAttemptAt: number }>
const otpSendStore    = new Map();
const otpVerifyStore  = new Map();

function getEntry(store, key) {
  return store.get(key) || { count: 0, firstAttemptAt: Date.now() };
}

function pruneExpired(store, windowMs) {
  const cutoff = Date.now() - windowMs;
  for (const [key, entry] of store) {
    if (entry.firstAttemptAt < cutoff) store.delete(key);
  }
}

/**
 * Returns Express middleware that rate-limits by req.body.email.
 * Falls back to IP if email is missing (so bots without a body are still blocked).
 */
function buildEmailLimiter({ windowMs, max, skipSuccessful = false, message, store }) {
  return (req, res, next) => {
    pruneExpired(store, windowMs);

    const email = (req.body?.email || "").toLowerCase().trim();
    const key   = email || req.ip; // fallback to IP only when no email provided

    const entry = getEntry(store, key);
    const windowExpired = Date.now() - entry.firstAttemptAt >= windowMs;

    if (windowExpired) {
      // Window has passed — reset counter
      store.set(key, { count: 1, firstAttemptAt: Date.now() });
      return next();
    }

    if (entry.count >= max) {
      const retryAfterSec = Math.ceil((entry.firstAttemptAt + windowMs - Date.now()) / 1000);
      const retryMin      = Math.ceil(retryAfterSec / 60);

      recordSecurityIncident(req, {
        type: "suspicious_activity",
        severity: "high",
        title: "OTP rate limit exceeded",
        resource: req.originalUrl,
        metadata: { email: email || "(no email)", limitMessage: message },
      });

      res.set("Retry-After", String(retryAfterSec));
      return res.status(429).json({
        msg: message.replace("{min}", retryMin),
        message: message.replace("{min}", retryMin),
        retryAfterSeconds: retryAfterSec,
      });
    }

    // Count this attempt (increment before handler so limits are enforced on the
    // current request, not deferred to the next one)
    entry.count += 1;
    store.set(key, entry);

    if (skipSuccessful) {
      // Roll back the increment if the downstream handler succeeds (2xx)
      const origJson = res.json.bind(res);
      res.json = function (body) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const cur = store.get(key);
          if (cur && cur.count > 0) {
            cur.count -= 1;
            if (cur.count === 0) store.delete(key);
            else store.set(key, cur);
          }
        }
        return origJson(body);
      };
    }

    next();
  };
}

const otpGenerationLimiter = buildEmailLimiter({
  store:    otpSendStore,
  windowMs: OTP_SEND_WINDOW_MS,
  max:      OTP_SEND_MAX,
  message:  "Too many OTP requests. Please wait {min} minutes before requesting another code.",
});

const otpVerificationLimiter = buildEmailLimiter({
  store:         otpVerifyStore,
  windowMs:      OTP_VERIFY_WINDOW_MS,
  max:           OTP_VERIFY_MAX,
  skipSuccessful: true,
  message:  "Too many incorrect OTP attempts. Please wait {min} minutes and try again.",
});

module.exports = {
  loginLimiter,
  registrationLimiter,
  otpGenerationLimiter,
  otpVerificationLimiter,
};
