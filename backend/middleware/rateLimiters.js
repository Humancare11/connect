const { recordSecurityEvent } = require("../utils/securityMonitor");

const registrationStore = new Map();

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

module.exports = { registrationLimiter };
