// utils/clientDescriptor.js
//
// "Where did this participant join from?" for the admin call report.
//
// Everything a client sends is attacker-controlled, so this is strictly
// informational (shown to admins) and NEVER used for access control. The
// declared `clientInfo` from the join payload is validated against an
// allow-list, then reconciled with what the server itself observes (the
// socket's User-Agent). When they disagree, the observed value wins and the
// result says so.
//
// Native apps that declare nothing (e.g. the doctor app, which is not changed
// for this feature) are still recognised from their native HTTP/WebSocket
// stack's User-Agent (Dart / okhttp / CFNetwork) and reported as "app".
const Bowser = require("bowser");
const { describeCallClient } = require("./callClientInfo");

const NATIVE_UA = /^(dart|okhttp|cfnetwork|darwin)\b|\bdart:io\b/i;

const clean = (value, max) =>
  String(value ?? "")
    .replace(/[^\w .+()\-/]/g, "")
    .trim()
    .slice(0, max);

const VERSION_RE = /^[0-9A-Za-z][0-9A-Za-z._+\-]{0,23}$/;

// Validates the client-declared object. Unknown / malformed fields are dropped
// (never thrown on, never echoed back).
function sanitizeDeclared(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const platform = ["web", "android", "ios"].includes(raw.platform) ? raw.platform : "";
  if (!platform) return null;
  const appVersion = typeof raw.appVersion === "string" && VERSION_RE.test(raw.appVersion.trim()) ? raw.appVersion.trim() : "";
  return {
    platform,
    appVersion,
    osName: clean(raw.osName, 30),
    osVersion: clean(raw.osVersion, 30),
    deviceModel: clean(raw.deviceModel, 60),
  };
}

function observeUserAgent(userAgent) {
  if (typeof userAgent !== "string") return { kind: "unknown" };
  const ua = userAgent.trim();
  if (!ua) return { kind: "unknown" };
  if (NATIVE_UA.test(ua)) return { kind: "native" };
  try {
    const parser = Bowser.getParser(ua);
    const browser = parser.getBrowser() || {};
    const os = parser.getOS() || {};
    if (!browser.name && !os.name) return { kind: "unknown" }; // not a User-Agent we can read
    const label = describeCallClient(ua); // knows in-app browsers (WhatsApp, Instagram, ...)
    return {
      kind: "browser",
      browser: label.browser || clean(browser.name, 40),
      browserVersion: clean((browser.version || "").split(".")[0], 12),
      osName: clean(os.name, 30),
      osVersion: clean(os.versionName || os.version, 30),
    };
  } catch {
    return { kind: "unknown" };
  }
}

// -> { platform, platformSource, appVersion, osName, osVersion, browser,
//      browserVersion, deviceModel }
function describeJoinClient({ declared, userAgent } = {}) {
  const decl = sanitizeDeclared(declared);
  const obs = observeUserAgent(userAgent);
  const empty = { appVersion: "", osName: "", osVersion: "", browser: "", browserVersion: "", deviceModel: "" };

  if (obs.kind === "browser") {
    // A browser User-Agent: this is a web join, whatever the payload claims.
    return {
      ...empty,
      platform: "web",
      platformSource: decl && decl.platform !== "web" ? "ua-overrode-declared" : decl ? "declared" : "ua-inferred",
      browser: obs.browser,
      browserVersion: obs.browserVersion,
      osName: obs.osName,
      osVersion: obs.osVersion,
    };
  }

  if (decl && decl.platform !== "web" && obs.kind !== "unknown") {
    // Native stack + an app declaration: consistent.
    return { ...empty, ...decl, platformSource: "declared" };
  }

  if (decl && decl.platform !== "web") {
    // Declared app, no usable User-Agent: accept the declaration (informational).
    return { ...empty, ...decl, platformSource: "declared" };
  }

  if (decl && decl.platform === "web") {
    // Declared web but the server saw a native stack: trust the server.
    return { ...empty, platform: "app", platformSource: "ua-overrode-declared" };
  }

  if (obs.kind === "native") {
    // e.g. the doctor app: no declaration at all, but clearly a native client.
    return { ...empty, platform: "app", platformSource: "ua-inferred" };
  }

  return { ...empty, platform: "unknown", platformSource: "" };
}

const PLATFORM_NAMES = { android: "Android", ios: "iOS" };

// "App (Android 14, v1.0.18)" / "Web (Chrome 130 on Windows 11)" / ...
function describeClientLabel(p) {
  if (!p || !p.platform || p.platform === "unknown") return "Unknown";
  if (p.platform === "web") {
    const browser = [p.browser, p.browserVersion].filter(Boolean).join(" ");
    const os = [p.osName, p.osVersion].filter(Boolean).join(" ");
    const inner = [browser, os && `on ${os}`].filter(Boolean).join(" ");
    return inner ? `Web (${inner})` : "Web";
  }
  if (p.platform === "app") return "App (version and OS not reported)";
  const os = [PLATFORM_NAMES[p.platform] || p.platform, p.osVersion].filter(Boolean).join(" ");
  const parts = [os, p.appVersion && `v${p.appVersion}`, p.deviceModel].filter(Boolean);
  return `App (${parts.join(", ")})`;
}

module.exports = { describeJoinClient, describeClientLabel, sanitizeDeclared, observeUserAgent };
