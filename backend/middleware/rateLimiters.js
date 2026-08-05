const { recordSecurityEvent } = require("../utils/securityMonitor");

const registrationStore = new Map();
const contactStore = new Map();
const loginStore = new Map();
const otpRequestStore = new Map();
const otpVerifyStore = new Map();

function getEntry(store, key) {
  return store.get(key) || { count: 0, firstAttemptAt: Date.now() };
}

function pruneExpired(store, windowMs) {
  const cutoff = Date.now() - windowMs;
  for (const [key, entry] of store) {
    if (entry.firstAttemptAt < cutoff) store.delete(key);
  }
}

function buildEmailLimiter({ windowMs, max, message, store }) {
  return (req, res, next) => {
    pruneExpired(store, windowMs);

    const rawEmail = req.body?.email;
    const email = (typeof rawEmail === "string" ? rawEmail : "").toLowerCase().trim();
    const key   = email || req.ip;

    const entry       = getEntry(store, key);
    const windowReset = Date.now() - entry.firstAttemptAt >= windowMs;

    if (windowReset) {
      store.set(key, { count: 1, firstAttemptAt: Date.now() });
      return next();
    }

    if (entry.count >= max) {
      const retryAfterSec = Math.ceil((entry.firstAttemptAt + windowMs - Date.now()) / 1000);
      const retryMin      = Math.ceil(retryAfterSec / 60);

      recordSecurityEvent(req, {
        type: "suspicious_activity",
        severity: "high",
        title: "Rate limit exceeded",
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

    entry.count += 1;
    store.set(key, entry);
    next();
  };
}

const registrationLimiter = buildEmailLimiter({
  store:    registrationStore,
  windowMs: 15 * 60 * 1000,
  max:      5,
  message:  "Too many registration attempts. Please wait {min} minutes and try again.",
});

const contactLimiter = buildEmailLimiter({
  store:    contactStore,
  windowMs: 15 * 60 * 1000,
  max:      5,
  message:  "Too many messages sent. Please wait {min} minutes and try again.",
});

// Applies to every login endpoint (user/doctor/admin/payment-admin/employee-admin).
// Keyed by the submitted email (falls back to IP only if no email was sent),
// same as the other limiters here — so a distributed brute-force attempt
// against one target account is caught regardless of how many source IPs
// it's spread across.
const loginLimiter = buildEmailLimiter({
  store:    loginStore,
  windowMs: 15 * 60 * 1000,
  max:      10,
  message:  "Too many login attempts. Please wait {min} minutes and try again.",
});

// Applies to every "send an OTP to this email" endpoint (register + forgot
// password, user + doctor). Without this, the endpoint can be used to
// email-bomb any address for free (each call triggers an SMTP send) — there
// is no password/secret involved yet, only an email address, so this limit
// is intentionally tighter than the login limiter.
const otpRequestLimiter = buildEmailLimiter({
  store:    otpRequestStore,
  windowMs: 15 * 60 * 1000,
  max:      5,
  message:  "Too many OTP requests. Please wait {min} minutes and try again.",
});

// Applies to every "verify this OTP" / "verify this OTP + create the
// account" endpoint. A 6-digit OTP has only 1,000,000 possible values and
// the underlying otpUtils.verifyOTPCode() has no per-record attempt
// counter, so this route-level limit is the only thing standing between an
// attacker and brute-forcing a live OTP within its TTL.
const otpVerifyLimiter = buildEmailLimiter({
  store:    otpVerifyStore,
  windowMs: 15 * 60 * 1000,
  max:      10,
  message:  "Too many OTP verification attempts. Please wait {min} minutes and try again.",
});

module.exports = {
  registrationLimiter,
  contactLimiter,
  loginLimiter,
  otpRequestLimiter,
  otpVerifyLimiter,
};
