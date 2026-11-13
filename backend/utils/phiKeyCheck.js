// Startup check of PHI_ENCRYPTION_KEY (the key that protects prescriptions, certificates, visit notes and transcripts).
//
// Without a valid key the code silently derives one from JWT_SECRET. An environment that has been doing that for a while can only read
// its old data with that same derived key, so this check never refuses by default: it WARNS (with a fingerprint to compare environments).
// It refuses to start only when PHI_KEY_REQUIRED=true, a switch turned on per environment after its key has been confirmed.
// Nothing here ever prints a key.
const { phiKeyStatus } = require("./phiCrypto");

const isDevelopment = (env) => {
  const name = String(env.NODE_ENV || "").trim().toLowerCase();
  return name === "" || name === "development" || name === "test";
};

// -> { level: "ok" | "info" | "warn" | "refuse", source, fingerprint, message }
function evaluatePhiKey(env = process.env) {
  const { source, fingerprint } = phiKeyStatus(env);
  const required = String(env.PHI_KEY_REQUIRED || "").trim().toLowerCase() === "true";
  const where = String(env.NODE_ENV || "development");
  if (source === "configured") return { level: "ok", source, fingerprint, message: `[config] PHI_ENCRYPTION_KEY is set (fingerprint ${fingerprint}).` };

  const why = source === "invalid" ? "PHI_ENCRYPTION_KEY is set but is not a valid 32-byte key (64 hex characters or base64)" : "PHI_ENCRYPTION_KEY is not set";
  if (required) {
    return {
      level: "refuse", source, fingerprint,
      message: `[config] FATAL: ${why}, and PHI_KEY_REQUIRED=true. Set PHI_ENCRYPTION_KEY (see npm run phi:fallback-key if this environment already holds data).`,
    };
  }
  if (isDevelopment(env)) {
    return { level: "info", source, fingerprint, message: `[config] ${why}: using the JWT_SECRET-derived development key (fingerprint ${fingerprint}).` };
  }
  return {
    level: "warn", source, fingerprint,
    message:
      `[config] WARNING (${where}): ${why}. Using the JWT_SECRET fallback key (fingerprint ${fingerprint}). Records written here can only be read ` +
      "by an environment with the same JWT_SECRET. Run npm run phi:fallback-key on this server to keep reading existing data, set PHI_ENCRYPTION_KEY " +
      "to that value, then set PHI_KEY_REQUIRED=true.",
  };
}

// Prints the outcome; returns true when the server may start.
function runPhiKeyCheck(env = process.env, log = console) {
  const result = evaluatePhiKey(env);
  if (result.level === "refuse") { log.error(result.message); return false; }
  if (result.level === "warn") log.warn(result.message);
  else log.log(result.message);
  return true;
}

module.exports = { evaluatePhiKey, runPhiKeyCheck };
