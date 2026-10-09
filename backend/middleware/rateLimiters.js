const { recordSecurityEvent } = require("../utils/securityMonitor");

const registrationStore = new Map();
const contactStore = new Map();
const loginStore = new Map();
const otpRequestStore = new Map();
const otpVerifyStore = new Map();
const presignStore = new Map();
const uploadStore = new Map();
const directVideoRoomPublicStore = new Map();

function getEntry(store, key) {
  return store.get(key) || { count: 0, firstAttemptAt: Date.now() };
}

function pruneExpired(store, windowMs) {
  const cutoff = Date.now() - windowMs;
  for (const [key, entry] of store) {
    if (entry.firstAttemptAt < cutoff) store.delete(key);
  }
}

// Shared limiter engine: pruning, window/count bookkeeping, and the 429 +
// Retry-After + recordSecurityEvent response. keyFn derives the bucket key
// from the request (e.g. email or authenticated user id), falling back to IP.
function buildKeyedLimiter({ windowMs, max, message, store, keyFn, describeKey }) {
  return (req, res, next) => {
    pruneExpired(store, windowMs);

    const key = keyFn(req) || req.ip;

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
        metadata: { key: describeKey ? describeKey(req, key) : key, limitMessage: message },
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

function buildEmailLimiter({ windowMs, max, message, store }) {
  return buildKeyedLimiter({
    windowMs, max, message, store,
    keyFn: (req) => {
      const rawEmail = req.body?.email;
      return (typeof rawEmail === "string" ? rawEmail : "").toLowerCase().trim();
    },
    describeKey: (req, key) => key || "(no email)",
  });
}

// Keyed by the authenticated user's id (set by verifyToken before this
// middleware runs), falling back to IP — unlike login/OTP flows, upload
// requests carry no email to key on.
function buildUserLimiter({ windowMs, max, message, store }) {
  return buildKeyedLimiter({
    windowMs, max, message, store,
    keyFn: (req) => (req.user?.id ? String(req.user.id) : ""),
    describeKey: (req, key) => `user:${key}`,
  });
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

// Presign requests are cheap metadata-only calls (S3 does the actual byte
// transfer) — a real enrollment/document session is a handful of files, so
// 30/15min covers legitimate use plus retries while still bounding abuse.
const presignLimiter = buildUserLimiter({
  store:    presignStore,
  windowMs: 15 * 60 * 1000,
  max:      30,
  message:  "Too many upload requests. Please wait {min} minutes and try again.",
});

// Direct uploads buffer the file and push it to S3 through this server, so
// they're more expensive per request than presign — kept on a tighter cap
// and a separate store so exhausting one doesn't block the other.
const uploadLimiter = buildUserLimiter({
  store:    uploadStore,
  windowMs: 15 * 60 * 1000,
  max:      20,
  message:  "Too many uploads. Please wait {min} minutes and try again.",
});

// Mail sent from the admin Email module (compose + reply). Per admin: a person
// answering clients stays far below this, but it bounds a runaway script or a
// stolen session, and protects the shared mailboxes' Gmail daily sending quota.
const emailSendStore = new Map();
const emailSendLimiter = buildUserLimiter({
  store:    emailSendStore,
  windowMs: 10 * 60 * 1000,
  max:      30,
  message:  "You are sending mail too quickly. Please wait {min} minutes and try again.",
});

// Super Admin "Mail IDs": every connection check calls Google while impersonating
// a company address, so keep it modest. Per Super Admin.
const mailboxCheckStore = new Map();
const mailboxCheckLimiter = buildUserLimiter({
  store:    mailboxCheckStore,
  windowMs: 60 * 1000,
  max:      10,
  message:  "Too many mailbox checks. Please wait a minute and try again.",
});

// The public Direct Video Room endpoints (GET /:roomId/status and
// /:roomId/ice-servers) carry no login or email, so they're keyed by
// IP + roomId — different rooms behind one office NAT don't share a bucket.
// A real participant hits each a handful of times per join (plus reconnect
// re-fetches); the cap is well above that but bounds someone scripting the
// /ice-servers endpoint, which mints short-lived TURN (HMAC) credentials on
// every call.
const directVideoRoomPublicLimiter = buildKeyedLimiter({
  store:    directVideoRoomPublicStore,
  windowMs: 60 * 1000,
  max:      40,
  message:  "Too many requests for this meeting. Please wait a moment and try again.",
  keyFn:    (req) => `${req.ip}:${req.params?.roomId || ""}`,
  describeKey: (req, key) => `ip+room:${key}`,
});

// Public Healthcare Discovery Search (POST /api/search). Keyed by IP only -
// the request carries no identity, and the search text is never part of the
// key or of the logged security event. The frontend debounces keystrokes, so
// a person typing stays far below this.
const searchStore = new Map();
const searchLimiter = buildKeyedLimiter({
  store:    searchStore,
  windowMs: 60 * 1000,
  max:      60,
  message:  "Too many search requests. Please wait a moment and try again.",
  keyFn:    () => "",
  describeKey: (req, key) => `ip:${key}`,
});

// Live chat: public contact form and widget config. Per IP. The contact form is the gate to every chat, so it is
// limited tightly; Turnstile and the honeypot sit in front of the real work.
const liveChatContactStore = new Map();
const liveChatContactLimiter = buildKeyedLimiter({
  store:    liveChatContactStore,
  windowMs: 10 * 60 * 1000,
  max:      12,
  message:  "Too many attempts. Please wait {min} minutes and try again.",
  keyFn:    () => "",
  describeKey: (req, key) => `ip:${key}`,
});
const liveChatConfigStore = new Map();
const liveChatConfigLimiter = buildKeyedLimiter({
  store:    liveChatConfigStore,
  windowMs: 60 * 1000,
  max:      60,
  message:  "Too many requests. Please wait a moment and try again.",
  keyFn:    () => "",
  describeKey: (req, key) => `ip:${key}`,
});

// Public blog list/detail and the blog image proxy. Per-IP; the image limit is
// high because a list page loads up to ~10 images and pages are revisited.
const blogPublicStore = new Map();
const blogPublicLimiter = buildKeyedLimiter({
  store:    blogPublicStore,
  windowMs: 60 * 1000,
  max:      120,
  message:  "Too many requests. Please wait a moment and try again.",
  keyFn:    () => "",
  describeKey: (req, key) => `ip:${key}`,
});

const blogImageStore = new Map();
const blogImageLimiter = buildKeyedLimiter({
  store:    blogImageStore,
  windowMs: 60 * 1000,
  max:      600,
  message:  "Too many requests. Please wait a moment and try again.",
  keyFn:    () => "",
  describeKey: (req, key) => `ip:${key}`,
});

// Public app-version lookup (GET /api/app/version). The app calls it once per
// launch, so this is far above normal use. Per-IP.
const appVersionStore = new Map();
const appVersionLimiter = buildKeyedLimiter({
  store:    appVersionStore,
  windowMs: 60 * 1000,
  max:      60,
  message:  "Too many requests. Please wait a moment and try again.",
  keyFn:    () => "",
  describeKey: (req, key) => `ip:${key}`,
});

module.exports = {
  liveChatContactLimiter,
  liveChatConfigLimiter,
  appVersionLimiter,
  blogPublicLimiter,
  blogImageLimiter,
  registrationLimiter,
  contactLimiter,
  loginLimiter,
  otpRequestLimiter,
  otpVerifyLimiter,
  presignLimiter,
  uploadLimiter,
  directVideoRoomPublicLimiter,
  searchLimiter,
  emailSendLimiter,
  mailboxCheckLimiter,
};
