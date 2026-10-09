// Live Chat module switches.
//
//   LIVECHAT_ENABLED          "true" turns the whole module on (backend + widget). Default: off.
//   LIVECHAT_ENCRYPTION_KEY   32 bytes, 64 hex chars or base64. Separate from CHAT_ENCRYPTION_KEY on
//                             purpose: chatCrypto.js protects existing doctor-patient messages and must not
//                             change. Required when the module is enabled in production.
//
// checkLiveChatConfig() never throws. When the module is enabled but misconfigured it reports why, and the
// caller leaves the module off (the rest of the app keeps running).

function isLiveChatEnabled(env = process.env) {
  return String(env.LIVECHAT_ENABLED || "").trim().toLowerCase() === "true";
}

function isProduction(env = process.env) {
  return String(env.NODE_ENV || "").trim().toLowerCase() === "production";
}

// Returns the 32-byte key buffer for a valid configured value, otherwise null.
function parseLiveChatKey(value) {
  const configured = String(value || "").trim();
  if (!configured) return null;
  const key = Buffer.from(configured, /^[A-Fa-f0-9]{64}$/.test(configured) ? "hex" : "base64");
  return key.length === 32 ? key : null;
}

function checkLiveChatConfig(env = process.env) {
  if (!isLiveChatEnabled(env)) return { enabled: false, ok: false, reason: "disabled" };
  if (isProduction(env) && !parseLiveChatKey(env.LIVECHAT_ENCRYPTION_KEY)) {
    return {
      enabled: true,
      ok: false,
      reason:
        "LIVECHAT_ENCRYPTION_KEY is missing or invalid (need 32 bytes as 64 hex chars or base64). " +
        "Live chat will not start.",
    };
  }
  return { enabled: true, ok: true, reason: "" };
}

const intFromEnv = (name, fallback, env = process.env) => {
  const n = Number(env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

module.exports = { isLiveChatEnabled, isProduction, parseLiveChatKey, checkLiveChatConfig, intFromEnv };
