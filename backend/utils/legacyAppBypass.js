// utils/legacyAppBypass.js
//
// TEMPORARY. Country/State became mandatory at signup, but app builds up to
// 1.0.0+15 never send them, so those builds could not register anyone. Until
// the new app build is live, signup requests from such builds may omit the
// location. Web (browser User-Agent) and the new app build (which sends
// X-Client-Platform) stay strict.
//
// A "legacy app" is a request detectRegistrationClient() classifies as an app
// purely by sniffing a native HTTP User-Agent (okhttp / CFNetwork / Dart) —
// source "inferred" — i.e. it did NOT declare itself with X-Client-Platform.
// The User-Agent is client-controlled, so this is spoofable; the only thing a
// spoofer gains is a blank (informational) location. Kill switch:
// LEGACY_APP_LOCATION_BYPASS=false.
//
// TODO: remove this file and its call sites once old app builds are gone.
const { detectRegistrationClient } = require("./clientInfo");

const DISABLED_VALUES = new Set(["false", "0", "off", "no"]);

// On by default; set LEGACY_APP_LOCATION_BYPASS=false to switch it off.
const isBypassEnabled = () =>
  !DISABLED_VALUES.has(String(process.env.LEGACY_APP_LOCATION_BYPASS ?? "").trim().toLowerCase());

const isLegacyAppClient = (req) => {
  const client = detectRegistrationClient(req);
  return client.registrationPlatform === "app" && client.registrationPlatformSource === "inferred";
};

// True when this signup may skip the Country/State requirement: the bypass is
// on, the caller is a legacy app build, and it sent no country at all. A
// legacy build that does send a country is validated like everyone else.
const shouldSkipSignupLocation = (req, body = {}) =>
  isBypassEnabled() &&
  isLegacyAppClient(req) &&
  !String(body?.country ?? "").trim();

module.exports = { isBypassEnabled, isLegacyAppClient, shouldSkipSignupLocation };
