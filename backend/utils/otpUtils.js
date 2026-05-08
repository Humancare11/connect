const OTP          = require("../models/OTP");
const { sendOTPEmail } = require("./sendEmail");

const OTP_TTL_MINUTES = 10;

const generateCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// Delete any prior OTP for this email+type+role, generate a fresh one, persist and email it.
const createAndSendOTP = async (email, type, role = "user") => {
  const clean = email.toLowerCase().trim();
  await OTP.deleteMany({ email: clean, type, role });

  const code      = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await OTP.create({ email: clean, otp: code, type, role, expiresAt });
  await sendOTPEmail(clean, code, type);
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

  if (record.otp !== code)
    return { valid: false, msg: "Invalid OTP. Please try again." };

  await OTP.deleteOne({ _id: record._id });
  return { valid: true };
};

module.exports = { createAndSendOTP, verifyOTPCode };
