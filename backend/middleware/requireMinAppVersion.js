// middleware/requireMinAppVersion.js
//
// Sign-up endpoints only: rejects a declared mobile-app build that is older
// than the configured minimum with 426 + code APP_UPDATE_REQUIRED, which the
// app turns into its "Please update" screen.
//
// Requests that don't declare themselves (web, curl, and app builds that
// predate X-App-Version) pass straight through — an unversioned client can't
// be told to update, so this can only ever block builds that opt in.
const { parseBuild, getPlatformConfig } = require("../utils/appVersion");

const header = (req, name) => {
  const raw = req.headers?.[name];
  return String(Array.isArray(raw) ? raw[0] : raw || "").trim();
};

function requireMinAppVersion(req, res, next) {
  const platform = header(req, "x-client-platform").toLowerCase();
  const config = getPlatformConfig(platform);
  if (!config || config.minBuild <= 0) return next();

  const build = parseBuild(header(req, "x-app-version"));
  if (build === null || build >= config.minBuild) return next();

  return res.status(426).json({
    msg: "Please update the app to continue.",
    code: "APP_UPDATE_REQUIRED",
    storeUrl: config.storeUrl,
    minBuild: config.minBuild,
  });
}

module.exports = requireMinAppVersion;
