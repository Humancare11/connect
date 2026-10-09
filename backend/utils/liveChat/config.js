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

// ── Phase 2: AI, Turnstile and abuse limits ───────────────────────────────────

const numberOrNull = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

// Cloudflare's published test secret key ("always passes"). Used only outside production when no secret is set.
const TURNSTILE_TEST_SECRET = "1x0000000000000000000000000000000AA";

// AI provider settings. Prices are USD per 1M tokens and are required: the daily spend cap cannot work without
// them, so the AI refuses to run (and the widget shows the unavailable fallback) when they are missing.
function readAiConfig(env = process.env) {
  // LIVECHAT_REASONING_EFFORT: unset -> "none" (the lowest value gpt-6-luna supports); set to an empty string to
  // send no reasoning parameter at all (for models that do not accept one).
  const effortRaw = env.LIVECHAT_REASONING_EFFORT;
  const reasoningEffort = effortRaw === undefined ? "none" : String(effortRaw).trim();
  const priceInput = numberOrNull(env.LIVECHAT_PRICE_INPUT_PER_1M);
  const priceOutput = numberOrNull(env.LIVECHAT_PRICE_OUTPUT_PER_1M);
  const priceCached = numberOrNull(env.LIVECHAT_PRICE_CACHED_INPUT_PER_1M);
  return {
    provider: String(env.LIVECHAT_AI_PROVIDER || "openai").trim().toLowerCase(),
    model: String(env.LIVECHAT_MODEL || "").trim(),
    apiKey: String(env.LIVECHAT_OPENAI_API_KEY || "").trim(),
    reasoningEffort,
    maxOutputTokens: intFromEnv("LIVECHAT_MAX_OUTPUT_TOKENS", 300, env),
    timeoutMs: intFromEnv("LIVECHAT_AI_TIMEOUT_MS", 20_000, env),
    priceInput,
    priceOutput,
    priceCached: priceCached ?? priceInput,
    usable: Boolean(env.LIVECHAT_MODEL && env.LIVECHAT_OPENAI_API_KEY && priceInput !== null && priceOutput !== null),
  };
}

function readTurnstileSecret(env = process.env) {
  const secret = String(env.TURNSTILE_SECRET_KEY || "").trim();
  if (secret) return secret;
  return isProduction(env) ? "" : TURNSTILE_TEST_SECRET;
}

// Abuse limits. Message length and per-minute rate are fixed by the brief; the others can be tuned by env.
function readLimits(env = process.env) {
  return {
    maxMessageChars: 1000,
    messagesPerMinute: intFromEnv("LIVECHAT_MESSAGES_PER_MINUTE", 6, env),
    chatsPerIpPerDay: intFromEnv("LIVECHAT_IP_DAILY_CHAT_LIMIT", 5, env),
  };
}

// File uploads from patients (reports): pdf / jpg / png only.
function readFileLimits(env = process.env) {
  return {
    maxBytes: 10 * 1024 * 1024,
    maxFilesPerChat: intFromEnv("LIVECHAT_MAX_FILES_PER_CHAT", 10, env),
    uploadsPer10Min: intFromEnv("LIVECHAT_UPLOADS_PER_10_MIN", 5, env),
  };
}

// Abuse alerts: an IP or visitor that starts this many chats within an hour raises one admin alert.
function readAbuseLimits(env = process.env) {
  return { chatsPerHourAlert: intFromEnv("LIVECHAT_ABUSE_CHATS_PER_HOUR", 3, env) };
}

// Mailbox the offline follow-up email is sent from (an active mailbox of the Email module).
const followUpMailboxAddress = (env = process.env) =>
  String(env.LIVECHAT_FOLLOWUP_MAILBOX || "support@humancareconnect.co").trim().toLowerCase();

module.exports = {
  readFileLimits,
  readAbuseLimits,
  followUpMailboxAddress,
  isLiveChatEnabled,
  isProduction,
  parseLiveChatKey,
  checkLiveChatConfig,
  intFromEnv,
  readAiConfig,
  readTurnstileSecret,
  readLimits,
  TURNSTILE_TEST_SECRET,
};
