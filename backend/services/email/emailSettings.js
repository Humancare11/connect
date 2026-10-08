const EmailSettings = require("../../models/EmailSettings");

// Open tracking is active only when ALL of these hold:
//   1. EMAIL_TRACKING_ENABLED=true            (deploy-time gate; unset in production until approved)
//   2. PUBLIC_TRACKING_BASE_URL is a public https URL (the tracking image must be reachable by recipients)
//   3. the Super Admin switch in the database is on
// Anything else → no image is added to outgoing mail and incoming hits are not recorded.

function normalizeBaseUrl(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.search || url.hash || url.username || url.password) return "";
    return `${url.protocol}//${url.host}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return "";
  }
}

const positive = (value, fallback) => (Number(value) > 0 ? Number(value) : fallback);

// Read on every call so tests (and a restart-free env change in dev) see current values.
function trackingEnv(env = process.env) {
  return {
    envEnabled: env.EMAIL_TRACKING_ENABLED === "true",
    baseUrl: normalizeBaseUrl(env.PUBLIC_TRACKING_BASE_URL),
    baseUrlSet: Boolean(String(env.PUBLIC_TRACKING_BASE_URL || "").trim()),
    graceSeconds: Number.isFinite(Number(env.EMAIL_TRACKING_GRACE_SECONDS)) && env.EMAIL_TRACKING_GRACE_SECONDS !== undefined && env.EMAIL_TRACKING_GRACE_SECONDS !== ""
      ? Math.max(0, Number(env.EMAIL_TRACKING_GRACE_SECONDS))
      : 60,
    dedupeMinutes: positive(env.EMAIL_TRACKING_DEDUPE_MINUTES, 10),
    ratePerMinute: positive(env.EMAIL_TRACKING_RATE_PER_MIN, 60),
    ignoreIps: String(env.EMAIL_TRACKING_IGNORE_IPS || "").split(",").map((s) => s.trim()).filter(Boolean),
  };
}

const CACHE_MS = 30_000;
let cache = null;

async function loadSettings({ now = Date.now() } = {}) {
  if (cache && now - cache.at < CACHE_MS) return cache.value;
  // upsert so a fresh database simply gets the safe defaults (tracking off).
  const doc = await EmailSettings.findOneAndUpdate({ key: "email" }, { $setOnInsert: { key: "email" } }, { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }).lean();
  cache = { at: now, value: doc };
  return doc;
}

const clearSettingsCache = () => {
  cache = null;
};

// → { active, envEnabled, baseUrl, baseUrlOk, switchOn, disclosureEnabled, disclosureText, ... }
// Without `full`, a deployment whose env gate is closed never touches the database.
async function getTrackingState({ env = process.env, now, full = false } = {}) {
  const e = trackingEnv(env);
  const gated = e.envEnabled && Boolean(e.baseUrl);
  const s = gated || full ? await loadSettings({ now }) : { trackingEnabled: false, disclosureEnabled: true, disclosureText: "" };
  return {
    ...e,
    baseUrlOk: Boolean(e.baseUrl),
    switchOn: Boolean(s.trackingEnabled),
    disclosureEnabled: Boolean(s.disclosureEnabled),
    disclosureText: s.disclosureText || "",
    active: e.envEnabled && Boolean(e.baseUrl) && Boolean(s.trackingEnabled),
  };
}

module.exports = { normalizeBaseUrl, trackingEnv, loadSettings, clearSettingsCache, getTrackingState };
