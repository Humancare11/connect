// Prints the key the PHI code derives from JWT_SECRET when PHI_ENCRYPTION_KEY is not set, as 64 hex characters.
//
//   npm run phi:fallback-key
//
// Use: on an environment that has been running on the fallback, set PHI_ENCRYPTION_KEY to this value and keep reading its old data
// (a NEW random key would make every existing record unreadable). Run it ON that environment's own server terminal, with that
// environment's env file loaded (NODE_ENV=production / uat / staging). The key goes to the terminal only: it is not logged, not written to
// a file, and not sent anywhere. Treat the output like a password.
const path = require("path");
const nodeEnv = process.env.NODE_ENV;
// Same file choice as server.js (staging and development use .env). PHI_ENV_FILE overrides it (an absolute path).
const file = process.env.PHI_ENV_FILE || (nodeEnv === "production" ? ".env.production" : nodeEnv === "uat" ? ".env.uat" : ".env");
require("dotenv").config({ path: path.resolve(__dirname, "..", file), quiet: true });
const { fallbackKey, keyFingerprint, phiKeyStatus } = require("../utils/phiCrypto");

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is not set in " + file + ": nothing to derive from.");
  process.exit(1);
}
const status = phiKeyStatus();
if (status.source === "configured") {
  console.error(`PHI_ENCRYPTION_KEY is already set here (fingerprint ${status.fingerprint}); this environment is not using the fallback.`);
  console.error("Run with PHI_FORCE_PRINT=true if you still want the fallback value printed.");
  if (process.env.PHI_FORCE_PRINT !== "true") process.exit(1);
}
const key = fallbackKey();
process.stderr.write(`Fallback key fingerprint ${keyFingerprint(key)} (env file ${file}). Set on this environment:\n`);
process.stdout.write(`PHI_ENCRYPTION_KEY=${key.toString("hex")}\n`);
