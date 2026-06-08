const OTP          = require("../models/OTP");
const { sendOTPEmail } = require("./sendEmail");
const crypto       = require("crypto");

const OTP_TTL_MINUTES = 10;
// OTP resend policy:
// Allow up to 5 immediate resends per (email + type + role), then require a short cooldown (60s).
const RESEND_MAX = 9999;
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds

// In-memory resend tracker keyed by "email:type:role". Structure: { count, firstAttemptAt }
const resendStore = new Map();

function _resendKey(email, type, role) {
  return `${String(email).toLowerCase().trim()}:${type}:${role}`;
}

function _getResendEntry(key) {
  const now = Date.now();
  const entry = resendStore.get(key) || { count: 0, firstAttemptAt: now };
  if (now - entry.firstAttemptAt > RESEND_COOLDOWN_MS) {
    const fresh = { count: 0, firstAttemptAt: now };
    resendStore.set(key, fresh);
    return fresh;
  }
  return entry;
}

function registerResendAttempt(email, type, role) {
  const key = _resendKey(email, type, role);
  const entry = _getResendEntry(key);
  entry.count += 1;
  resendStore.set(key, entry);
  return entry;
}

function canResend(email, type, role) {
  const key = _resendKey(email, type, role);
  const entry = _getResendEntry(key);
  const allowed = entry.count < RESEND_MAX;
  if (!allowed) {
    console.warn("OTP rate-limited check FAILED", { key, count: entry.count, firstAttemptAt: new Date(entry.firstAttemptAt).toISOString(), ageMs: Date.now() - entry.firstAttemptAt, RESEND_MAX, RESEND_COOLDOWN_MS });
  }
  return allowed;
}

const generateCode = () =>
  crypto.randomInt(100000, 1000000).toString();

const hashOTP = (code) =>
  crypto.createHash("sha256").update(String(code).trim()).digest("hex");

function hashesMatch(expectedHash, candidateCode) {
  const actualHash = hashOTP(candidateCode);
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(actualHash, "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

// Delete any prior OTP for this email+type+role, generate a fresh one, persist and email it.
const createAndSendOTP = async (email, type, role = "user") => {
  const clean = email.toLowerCase().trim();

  // Resend limiter: enforce per-(email + type + role) policy.
  const allowed = canResend(clean, type, role);
  if (!allowed) {
    const key = _resendKey(clean, type, role);
    const entry = _getResendEntry(key);
    const retryAfterMs = Math.max(0, RESEND_COOLDOWN_MS - (Date.now() - entry.firstAttemptAt));
    console.warn("OTP rate limited", { email: clean, type, role, retryAfterMs });
    const err = new Error("Too many OTP requests. Please wait before requesting another code.");
    err.statusCode = 429;
    err.retryAfterMs = retryAfterMs;
    throw err;
  }

  // Register this attempt before sending so even failed sends count.
  registerResendAttempt(clean, type, role);

  await OTP.deleteMany({ email: clean, type, role });

  const code      = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  const record = await OTP.create({ email: clean, otpHash: hashOTP(code), type, role, expiresAt });
  try {
    await sendOTPEmail(clean, code, type);
  } catch (err) {
    await OTP.deleteOne({ _id: record._id });
    throw err;
  }
};

// Returns { valid: true } on success or { valid: false, msg: "..." } on failure.
// Deletes the record on successful verification (single-use).
const verifyOTPCode = async (email, code, type, role = "user") => {
  const clean  = email.toLowerCase().trim();
  const record = await OTP.findOne({ email: clean, type, role });

  if (!record)
    return { valid: false, msg: "OTP not found. Please request a new one." };

  if (new Date() > record.expiresAt) {
    await OTP.deleteOne({ _id: record._id });
    return { valid: false, msg: "OTP has expired. Please request a new one." };
  }

  if (!hashesMatch(record.otpHash, code))
    return { valid: false, msg: "Invalid OTP. Please try again." };

  await OTP.deleteOne({ _id: record._id });
  return { valid: true };
};

module.exports = { createAndSendOTP, verifyOTPCode, hashOTP };
