const EmailSettings = require("../../models/EmailSettings");
const { parseScannerIps } = require("./scannerLists");

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
    // Second deploy-time gate: link click tracking (rewriting links through /api/l).
    linksEnvEnabled: env.EMAIL_TRACKING_LINKS_ENABLED === "true",
    // Several different links of one mail hit within a few seconds is a scanner, not a person.
    clickBurstLinks: positive(env.EMAIL_CLICK_BURST_LINKS, 3),
    clickBurstSeconds: positive(env.EMAIL_CLICK_BURST_SECONDS, 5),
    baseUrl: normalizeBaseUrl(env.PUBLIC_TRACKING_BASE_URL),
    baseUrlSet: Boolean(String(env.PUBLIC_TRACKING_BASE_URL || "").trim()),
    graceSeconds: Number.isFinite(Number(env.EMAIL_TRACKING_GRACE_SECONDS)) && env.EMAIL_TRACKING_GRACE_SECONDS !== undefined && env.EMAIL_TRACKING_GRACE_SECONDS !== ""
      ? Math.max(0, Number(env.EMAIL_TRACKING_GRACE_SECONDS))
      : 60,
    dedupeMinutes: positive(env.EMAIL_TRACKING_DEDUPE_MINUTES, 10),
    ratePerMinute: positive(env.EMAIL_TRACKING_RATE_PER_MIN, 60),
    ignoreIps: String(env.EMAIL_TRACKING_IGNORE_IPS || "").split(",").map((s) => s.trim()).filter(Boolean),
    // Scanner address ranges, "vendor=cidr,vendor=cidr" (a bare range is vendor "other").
    scannerIps: parseScannerIps(env.EMAIL_SCANNER_IPS),
    // Extra Apple Mail Privacy Protection ranges (Apple's own 17.0.0.0/8 is built in).
    appleIps: String(env.EMAIL_APPLE_PROXY_IPS || "").split(",").map((s) => s.trim()).filter(Boolean),
    // A scanner-flagged hit counts as an open only when another hit comes this long after the first.
    secondHitMinutes: positive(env.EMAIL_SECOND_HIT_MINUTES, 2),
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
  const s = gated || full ? await loadSettings({ now }) : { trackingEnabled: false, disclosureEnabled: true, disclosureText: "", trackInternalRecipients: true, trackClicks: false };
  return {
    ...e,
    baseUrlOk: Boolean(e.baseUrl),
    switchOn: Boolean(s.trackingEnabled),
    disclosureEnabled: Boolean(s.disclosureEnabled),
    disclosureText: s.disclosureText || "",
    // Default ON: mail to company addresses is tracked too, with a caveat (see emailTracking.js).
    trackInternalRecipients: s.trackInternalRecipients !== false,
    trackClicks: Boolean(s.trackClicks),
    active: e.envEnabled && Boolean(e.baseUrl) && Boolean(s.trackingEnabled),
    // Link tracking needs open tracking to be active AND its own env gate AND its own switch.
    linksActive: e.envEnabled && Boolean(e.baseUrl) && Boolean(s.trackingEnabled) && e.linksEnvEnabled && Boolean(s.trackClicks),
  };
}

module.exports = { normalizeBaseUrl, trackingEnv, loadSettings, clearSettingsCache, getTrackingState };
