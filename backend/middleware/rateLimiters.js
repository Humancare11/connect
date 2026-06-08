const { recordSecurityIncident } = require("../utils/securityMonitor");

// ── Per-email store declarations (shared across all email-keyed limiters) ─────
// store: Map<email, { count: number, firstAttemptAt: number }>
const registrationStore = new Map();
const otpSendStore      = new Map();
const otpVerifyStore    = new Map();

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
 * Falls back to IP only when no email is present (e.g. bots sending empty bodies).
 * When skipSuccessful is true, a 2xx response rolls back the increment so only
 * failed attempts count toward the limit.
 */
function buildEmailLimiter({ windowMs, max, skipSuccessful = false, message, store, incidentType = "suspicious_activity" }) {
  return (req, res, next) => {
    pruneExpired(store, windowMs);

    const email = (req.body?.email || "").toLowerCase().trim();
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

      recordSecurityIncident(req, {
        type: incidentType,
        severity: "high",
        title: incidentType === "failed_login" ? "Multiple failed login attempts" : "Rate limit exceeded",
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

    if (skipSuccessful) {
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

const registrationLimiter = buildEmailLimiter({
  store:    registrationStore,
  windowMs: 15 * 60 * 1000,
  max:      5,
  message:  "Too many registration attempts. Please wait {min} minutes and try again.",
});

const otpGenerationLimiter = buildEmailLimiter({
  store:    otpSendStore,
  windowMs: 10 * 60 * 1000, // 10-minute cooldown, 3 sends max
  max:      3,
  message:  "Too many OTP requests. Please wait {min} minutes before requesting another code.",
});

const otpVerificationLimiter = buildEmailLimiter({
  store:          otpVerifyStore,
  windowMs:       15 * 60 * 1000, // 15-minute cooldown, 5 failed attempts max
  max:            5,
  skipSuccessful: true,
  message:        "Too many incorrect OTP attempts. Please wait {min} minutes and try again.",
});

module.exports = {
  registrationLimiter,
  otpGenerationLimiter,
  otpVerificationLimiter,
};
