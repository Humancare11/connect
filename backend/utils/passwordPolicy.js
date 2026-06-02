const bcrypt = require("bcryptjs");
const PasswordHistory = require("../models/PasswordHistory");

const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789", "qwerty123",
  "admin123", "admin1234", "welcome1", "welcome123", "letmein1", "iloveyou1",
  "humancare", "humancare123", "doctor123", "patient123",
]);

function validatePasswordStrength(password) {
  const value = String(password || "");
  const errors = [];
  if (value.length < 8) errors.push("Password must be at least 8 characters.");
  if (!/[A-Z]/.test(value)) errors.push("Password must include at least one uppercase letter.");
  if (!/[a-z]/.test(value)) errors.push("Password must include at least one lowercase letter.");
  if (!/[0-9]/.test(value)) errors.push("Password must include at least one number.");
  if (!/[^A-Za-z0-9]/.test(value)) errors.push("Password must include at least one special character.");
  if (COMMON_PASSWORDS.has(value.toLowerCase())) errors.push("Password is too common. Choose a stronger password.");
  return { valid: errors.length === 0, errors };
}

async function assertPasswordAllowed({ userId, userType, password, currentHash = "" }) {
  const strength = validatePasswordStrength(password);
  if (!strength.valid) return strength;

  if (currentHash && await bcrypt.compare(password, currentHash)) {
    return { valid: false, errors: ["New password must be different from your current password."] };
  }

  if (userId && userType) {
    const previous = await PasswordHistory.find({ userId: String(userId), userType })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    for (const item of previous) {
      if (await bcrypt.compare(password, item.passwordHash)) {
        return { valid: false, errors: ["You cannot reuse one of your previous passwords."] };
      }
    }
  }

  return { valid: true, errors: [] };
}

async function rememberPassword({ userId, userType, passwordHash }) {
  if (!userId || !userType || !passwordHash) return;
  await PasswordHistory.create({ userId: String(userId), userType, passwordHash });
  const keep = await PasswordHistory.find({ userId: String(userId), userType })
    .sort({ createdAt: -1 })
    .skip(5)
    .select("_id")
    .lean();
  if (keep.length) await PasswordHistory.deleteMany({ _id: { $in: keep.map((item) => item._id) } });
}

module.exports = {
  validatePasswordStrength,
  assertPasswordAllowed,
  rememberPassword,
};
