// utils/appVersion.js
//
// Mobile-app version gate. The app sends X-Client-Platform (android|ios) and
// X-App-Version ("1.0.0+16"); versions are compared by BUILD NUMBER (the part
// after "+"), since that's what always increases between store releases.
//
// Config lives in env vars, per platform (suffix ANDROID / IOS):
//   APP_MIN_BUILD_<P>     lowest build allowed to sign up; below it → 426.
//                         0 / unset = nothing is blocked.
//   APP_LATEST_BUILD_<P>  newest published build; the app only uses it to
//                         suggest an optional update.
//   APP_STORE_URL_<P>     where the "Please update" screen sends the user.
//                         Android defaults to the Play listing; iOS to "".
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.humancareconnect.app";

const PLATFORMS = { android: "ANDROID", ios: "IOS" };
const DEFAULT_STORE_URLS = { android: PLAY_STORE_URL, ios: "" };

// "1.0.0+16" → 16, "16" → 16, anything else → null.
function parseBuild(version) {
  const value = String(version ?? "").trim();
  const match = value.match(/\+(\d{1,9})$/) || value.match(/^(\d{1,9})$/);
  return match ? Number(match[1]) : null;
}

const toBuild = (raw) => {
  const n = Number.parseInt(String(raw ?? "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

function getPlatformConfig(platform, env = process.env) {
  const suffix = PLATFORMS[platform];
  if (!suffix) return null;
  const minBuild = toBuild(env[`APP_MIN_BUILD_${suffix}`]);
  const latestBuild = Math.max(toBuild(env[`APP_LATEST_BUILD_${suffix}`]), minBuild);
  const configuredUrl = env[`APP_STORE_URL_${suffix}`];
  const storeUrl = configuredUrl !== undefined ? String(configuredUrl).trim() : DEFAULT_STORE_URLS[platform];
  return { minBuild, latestBuild, storeUrl };
}

function getAppVersionConfig(env = process.env) {
  return {
    android: getPlatformConfig("android", env),
    ios: getPlatformConfig("ios", env),
  };
}

module.exports = { PLAY_STORE_URL, parseBuild, getPlatformConfig, getAppVersionConfig };
