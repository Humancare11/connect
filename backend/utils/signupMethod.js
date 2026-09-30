// utils/signupMethod.js
//
// How an account was created, for the admin user profile.
//
// New accounts store it explicitly (User.signupMethod = "email" | "google").
// Older accounts are worked out from what they have:
//   Google ID, no password      → "google"      (Google sign-up never sets a password)
//   password, no Google ID      → "email"
//   Google ID and a password    → "email_google" (ambiguous: an email account that
//                                  later linked Google, or a Google account that later
//                                  set a password via "forgot password")
//   neither                     → ""            (shown as "Unknown")
function resolveSignupMethod(user) {
  if (user?.signupMethod) return user.signupMethod;

  const hasGoogle = Boolean(user?.googleId);
  const hasPassword = Boolean(user?.password);
  if (hasGoogle && hasPassword) return "email_google";
  if (hasGoogle) return "google";
  if (hasPassword) return "email";
  return "";
}

// A plain object for the admin API: password hash removed, signupMethod resolved.
function toAdminUser(user) {
  const plain = typeof user?.toObject === "function" ? user.toObject() : { ...user };
  const signupMethod = resolveSignupMethod(plain);
  delete plain.password;
  return { ...plain, signupMethod };
}

module.exports = { resolveSignupMethod, toAdminUser };
