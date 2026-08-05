const OTP          = require("../models/OTP");
const { sendOTPEmail } = require("./sendEmail");
const crypto       = require("crypto");

const OTP_TTL_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

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
const createAndSendOTP = async (email, type, role = "user", name) => {
  const clean = email.toLowerCase().trim();

  await OTP.deleteMany({ email: clean, type, role });

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  const record = await OTP.create({
    email: clean,
    otpHash: hashOTP(code),
    type,
    role,
    expiresAt
  });

  try {
    await sendOTPEmail(clean, code, type, name);
  } catch (err) {
    await OTP.deleteOne({ _id: record._id });
    throw err;
  }
};

// Returns { valid: true } on success or { valid: false, msg: "..." } on failure.
// Deletes the record on successful verification (single-use).
//
// This attempt counter is defense-in-depth alongside the route-level OTP
// rate limiter (see middleware/rateLimiters.js): the limiter is keyed by
// email+IP window, this is keyed to the specific OTP record itself, so a
// single OTP can't be brute-forced across its full TTL even if the route
// limiter were ever misconfigured or bypassed.
const verifyOTPCode = async (email, code, type, role = "user") => {
  const clean  = email.toLowerCase().trim();
  const record = await OTP.findOne({ email: clean, type, role });

  if (!record)
    return { valid: false, msg: "OTP not found. Please request a new one." };

  if (new Date() > record.expiresAt) {
    await OTP.deleteOne({ _id: record._id });
    return { valid: false, msg: "OTP has expired. Please request a new one." };
  }

  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    await OTP.deleteOne({ _id: record._id });
    return { valid: false, msg: "Too many incorrect attempts. Please request a new OTP." };
  }

  if (!hashesMatch(record.otpHash, code)) {
    await OTP.updateOne({ _id: record._id }, { $inc: { attempts: 1 } });
    return { valid: false, msg: "Invalid OTP. Please try again." };
  }

  await OTP.deleteOne({ _id: record._id });
  return { valid: true };
};

// Pads a handler's response time up to `minMs` measured from `startedAt`.
// Used by the "forgot password" OTP endpoints, which intentionally return an
// identical body whether or not the account exists (to avoid leaking that in
// the response text) — without this, the branch that skips the real SMTP
// send (unknown email) still returns far faster than the branch that does
// one, so the account's existence leaks through response timing instead.
// Only ever adds delay (never subtracts), so the real-account path — already
// bounded below by an actual SMTP round trip — is unaffected.
const padToMinDuration = async (startedAt, minMs = 400) => {
  const elapsed = Date.now() - startedAt;
  if (elapsed < minMs) {
    await new Promise((resolve) => setTimeout(resolve, minMs - elapsed));
  }
};

module.exports = { createAndSendOTP, verifyOTPCode, hashOTP, padToMinDuration };
