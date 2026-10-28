const crypto = require("crypto");
const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const EmailChangeChallenge = require("../models/EmailChangeChallenge");
const { hashOTP } = require("./otpUtils");
const mailer = require("./sendEmail");
const { revokeUserSessions } = require("./tokenRevocation");
const { recordEmailChangeAudit } = require("./doctorEmailChangeAudit");

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class EmailChangeError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.reason = "";
    Object.assign(this, extra);
  }
}

const normalizeEmail = (value) => (typeof value === "string" ? value.toLowerCase().trim() : "");

function hashesMatch(expectedHash, code) {
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(hashOTP(code), "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

// Step 1: validate the proposed address and email a fresh OTP to it.
// The doctor's canonical email is NOT changed here.
async function requestEmailChangeUnaudited(req, doctorId, rawNewEmail) {
  const newEmail = normalizeEmail(rawNewEmail);
  if (!newEmail || newEmail.length > 254 || !EMAIL_RE.test(newEmail)) {
    throw new EmailChangeError(400, "Enter a valid email address.", { reason: "invalid_email" });
  }

  const doctor = await Doctor.findById(doctorId).select("name email");
  if (!doctor) throw new EmailChangeError(404, "Doctor not found.");
  if (doctor.email === newEmail) {
    throw new EmailChangeError(400, "The new email must be different from your current email.", { reason: "same_email" });
  }

  // Deliberately no hint about WHO owns the address.
  const taken = await Doctor.exists({ email: newEmail, _id: { $ne: doctor._id } });
  if (taken) throw new EmailChangeError(409, "This email address can't be used. Try a different one.", { reason: "email_unavailable" });

  const previous = await EmailChangeChallenge.findOne({ doctorId: doctor._id });
  if (previous && Date.now() - previous.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    const retryAfterMs = RESEND_COOLDOWN_MS - (Date.now() - previous.lastSentAt.getTime());
    throw new EmailChangeError(429, "Please wait before requesting another OTP.", { retryAfterMs, reason: "resend_cooldown" });
  }

  const code = crypto.randomInt(100000, 1000000).toString();
  await EmailChangeChallenge.deleteMany({ doctorId: doctor._id });
  const challenge = await EmailChangeChallenge.create({
    doctorId: doctor._id,
    newEmail,
    otpHash: hashOTP(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  try {
    await mailer.sendEmailChangeOTPEmail(newEmail, code, doctor.name);
  } catch (err) {
    await EmailChangeChallenge.deleteOne({ _id: challenge._id });
    throw new EmailChangeError(502, "We couldn't send the OTP. Please try again shortly.", { reason: "email_delivery_failed" });
  }

  return { expiresInSeconds: OTP_TTL_MS / 1000 };
}

// Step 2: verify the OTP and, only then, replace the login email.
async function verifyEmailChangeUnaudited(req, doctorId, rawNewEmail, otp) {
  const newEmail = normalizeEmail(rawNewEmail);
  const code = typeof otp === "string" || typeof otp === "number" ? String(otp).trim() : "";
  if (!newEmail || !/^\d{6}$/.test(code)) {
    throw new EmailChangeError(400, "Enter the new email and the 6-digit OTP.", { reason: "invalid_input" });
  }

  const challenge = await EmailChangeChallenge.findOne({ doctorId, newEmail, usedAt: null });
  if (!challenge) throw new EmailChangeError(400, "OTP not found. Please request a new one.", { reason: "otp_not_found" });
  if (Date.now() > challenge.expiresAt.getTime()) {
    await EmailChangeChallenge.deleteOne({ _id: challenge._id });
    throw new EmailChangeError(400, "OTP has expired. Please request a new one.", { reason: "otp_expired" });
  }
  if (challenge.attempts >= MAX_ATTEMPTS) {
    await EmailChangeChallenge.deleteOne({ _id: challenge._id });
    throw new EmailChangeError(429, "Too many incorrect attempts. Please request a new OTP.", { reason: "attempts_exceeded" });
  }
  if (!hashesMatch(challenge.otpHash, code)) {
    await EmailChangeChallenge.updateOne({ _id: challenge._id }, { $inc: { attempts: 1 } });
    throw new EmailChangeError(400, "Invalid OTP. Please try again.", { reason: "otp_invalid" });
  }

  // Consume atomically: of two concurrent verifies with the right code, one wins.
  const consumed = await EmailChangeChallenge.findOneAndUpdate(
    { _id: challenge._id, usedAt: null },
    { usedAt: new Date() }
  );
  if (!consumed) throw new EmailChangeError(400, "This OTP has already been used.", { reason: "otp_already_used" });

  const doctor = await Doctor.findById(doctorId).select("email");
  if (!doctor) throw new EmailChangeError(404, "Doctor not found.");
  const oldEmail = doctor.email;

  if (await Doctor.exists({ email: newEmail, _id: { $ne: doctor._id } })) {
    throw new EmailChangeError(409, "This email address can't be used. Try a different one.", { reason: "email_unavailable" });
  }

  // Compare-and-set on the old email, and rely on the unique index for races.
  try {
    const res = await Doctor.updateOne({ _id: doctor._id, email: oldEmail }, { $set: { email: newEmail } });
    if (res.matchedCount !== 1) throw new EmailChangeError(409, "Your email changed in the meantime. Please start again.", { reason: "email_changed_concurrently" });
  } catch (err) {
    if (err?.code === 11000) throw new EmailChangeError(409, "This email address can't be used. Try a different one.", { reason: "email_unavailable" });
    throw err;
  }

  // The enrollment's email is the profile copy of the same address; keep it in
  // step. If that fails, put the login email back so the two never disagree.
  try {
    // Enrollment.email is schema-immutable so profile saves cannot touch it; this
    // verified flow is the one place allowed to overwrite it.
    await Enrollment.updateOne({ doctorId: doctor._id }, { $set: { email: newEmail } }, { overwriteImmutable: true });
  } catch (err) {
    await Doctor.updateOne({ _id: doctor._id, email: newEmail }, { $set: { email: oldEmail } });
    throw new EmailChangeError(500, "We couldn't update your email. Nothing was changed; please try again.", { reason: "operational_error" });
  }

  await EmailChangeChallenge.deleteMany({ doctorId: doctor._id });
  await revokeUserSessions(doctor._id, "email_change");
  return { email: newEmail };
}

// Failures worth an audit row: skip bad input and cooldown hits, which are noise.
const AUDITED_REQUEST_FAILURES = new Set(["email_unavailable", "email_delivery_failed", "operational_error"]);

async function requestEmailChange(req, doctorId, rawNewEmail) {
  try {
    const result = await requestEmailChangeUnaudited(req, doctorId, rawNewEmail);
    await recordEmailChangeAudit(req, { doctorId, action: "request", outcome: "success" });
    return result;
  } catch (err) {
    const reason = err instanceof EmailChangeError ? err.reason : "operational_error";
    if (AUDITED_REQUEST_FAILURES.has(reason)) {
      await recordEmailChangeAudit(req, { doctorId, action: "request", outcome: "failure", reason });
    }
    throw err;
  }
}

async function verifyEmailChange(req, doctorId, rawNewEmail, otp) {
  try {
    const result = await verifyEmailChangeUnaudited(req, doctorId, rawNewEmail, otp);
    await recordEmailChangeAudit(req, { doctorId, action: "complete", outcome: "success" });
    return result;
  } catch (err) {
    const reason = err instanceof EmailChangeError ? err.reason || "rejected" : "operational_error";
    await recordEmailChangeAudit(req, { doctorId, action: "verify", outcome: "failure", reason });
    throw err;
  }
}

module.exports = { requestEmailChange, verifyEmailChange, EmailChangeError, OTP_TTL_MS, RESEND_COOLDOWN_MS, MAX_ATTEMPTS };
