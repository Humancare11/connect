// utils/clientInfo.js
//
// Works out where a signup came from (web vs. the mobile app) so admins can see
// it on the user profile. Purely informational — every input here is chosen by
// the client, so it must never be used for access control.
//
// Detection order:
//   1. App header      X-Client-Platform: android|ios  (+ X-App-Version)
//                      → app, source "header" (declared by the app itself)
//   2. Native client   User-Agent of a known native HTTP stack (okhttp, Dart,
//                      CFNetwork/Darwin) → app, source "inferred" (a guess, for
//                      app builds that don't send the header yet)
//   3. Browser         User-Agent parsed by bowser → web, source "user-agent"
//   4. Otherwise       everything left empty ("Unknown" in the admin UI)
//
// detectRegistrationClient() never throws: on any failure it returns the empty
// result so signup is never affected.
const Bowser = require("bowser");

const EMPTY = Object.freeze({
  registrationPlatform: "",
  registrationSubType: "",
  registrationPlatformSource: "",
  registrationAppVersion: "",
});

const APP_PLATFORMS = new Set(["android", "ios"]);

// bowser's names → the short names shown to admins.
const BROWSER_NAMES = {
  "Microsoft Edge": "Edge",
  "Samsung Internet for Android": "Samsung Internet",
  "Opera Coast": "Opera",
};

const headerValue = (req, name) => {
  const raw = req?.headers?.[name];
  return String(Array.isArray(raw) ? raw[0] : raw || "").trim();
};

// Keep only harmless characters and bound the length before storing.
const sanitize = (value, max) =>
  String(value || "")
    .replace(/[^\w .+()\-]/g, "")
    .trim()
    .slice(0, max);

// Known native HTTP clients. Web browsers never send these tokens.
function inferNativeApp(userAgent) {
  if (/\bokhttp\//i.test(userAgent)) return "android";
  if (/CFNetwork|Darwin\//i.test(userAgent)) return "ios";
  if (/\bDart\//i.test(userAgent)) return "unknown"; // Flutter: same UA on both OSes
  return "";
}

function parseBrowser(userAgent) {
  const parser = Bowser.getParser(userAgent);
  const browser = sanitize(BROWSER_NAMES[parser.getBrowserName()] || parser.getBrowserName(), 40);
  const os = sanitize(parser.getOSName(), 30);
  return { browser, os };
}

function detectRegistrationClient(req) {
  try {
    const appVersion = sanitize(headerValue(req, "x-app-version"), 32);

    const declared = headerValue(req, "x-client-platform").toLowerCase();
    if (APP_PLATFORMS.has(declared)) {
      return {
        registrationPlatform: "app",
        registrationSubType: declared,
        registrationPlatformSource: "header",
        registrationAppVersion: appVersion,
      };
    }

    const userAgent = headerValue(req, "user-agent");
    if (!userAgent) return { ...EMPTY };

    const native = inferNativeApp(userAgent);
    if (native) {
      return {
        registrationPlatform: "app",
        registrationSubType: native,
        registrationPlatformSource: "inferred",
        registrationAppVersion: appVersion,
      };
    }

    const { browser, os } = parseBrowser(userAgent);
    if (!browser && !os) return { ...EMPTY }; // curl, scripts, unknown clients
    return {
      registrationPlatform: "web",
      registrationSubType: [browser, os].filter(Boolean).join(" on "),
      registrationPlatformSource: "user-agent",
      registrationAppVersion: "",
    };
  } catch (err) {
    console.warn("[clientInfo] detection failed:", err.message);
    return { ...EMPTY };
  }
}

module.exports = { detectRegistrationClient };
