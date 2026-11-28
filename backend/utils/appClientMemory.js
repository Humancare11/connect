// The installed app sends X-Client-Platform / X-App-Version on its API calls,
// including the ICE-server fetch it makes just before joining a call, but not
// on the socket join. Remember them per user for the call report. In memory
// only and informational: never used for access control.
const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_ENTRIES = 5000;
const PLATFORMS = new Set(["android", "ios"]);
const VERSION_RE = /^[0-9A-Za-z][0-9A-Za-z._+\-]{0,23}$/;

function createAppClientMemory({ now = () => Date.now(), ttlMs = TTL_MS, maxEntries = MAX_ENTRIES } = {}) {
  const byUser = new Map();
  return {
    remember(userId, headers = {}) {
      const platform = String(headers["x-client-platform"] || "").trim().toLowerCase();
      const appVersion = String(headers["x-app-version"] || "").trim();
      if (!userId || !PLATFORMS.has(platform) || !VERSION_RE.test(appVersion)) return;
      const key = String(userId);
      byUser.delete(key); // re-insert so the oldest entry is always first
      byUser.set(key, { platform, appVersion, at: now() });
      if (byUser.size > maxEntries) byUser.delete(byUser.keys().next().value);
    },
    // -> { platform, appVersion } or null
    recall(userId) {
      const entry = byUser.get(String(userId));
      if (!entry || now() - entry.at > ttlMs) return null;
      return { platform: entry.platform, appVersion: entry.appVersion };
    },
  };
}

const appClientMemory = createAppClientMemory();

module.exports = { createAppClientMemory, appClientMemory };
