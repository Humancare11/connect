// utils/callClientInfo.js
//
// Human-readable device/browser/OS description for a direct-call
// participant's User-Agent, for the admin call report (e.g. "iPhone,
// WhatsApp browser"). Separate from utils/clientInfo.js (which drives
// registration-source tracking and has its own established output shape) —
// this one is purely descriptive text for admins, never used for access
// control, and free to add in-app-browser detection without touching that
// other, already-relied-upon module.
const Bowser = require("bowser");

// Mirrors the frontend's utils/inAppBrowser.js detection list — an in-app
// browser's User-Agent otherwise just reports as its underlying engine
// (e.g. "Chrome"), which hides the actual likely cause of a connection
// problem from the admin reading the report.
const IN_APP_BROWSERS = [
  { name: "Facebook browser", pattern: /FBAN|FBAV|FB_IAB/i },
  { name: "Instagram browser", pattern: /Instagram/i },
  { name: "WhatsApp browser", pattern: /WhatsApp/i },
  { name: "Messenger browser", pattern: /Messenger/i },
  { name: "Line browser", pattern: /\bLine\//i },
  { name: "Twitter browser", pattern: /Twitter/i },
];

const sanitize = (value, max) =>
  String(value || "")
    .replace(/[^\w .+()\-]/g, "")
    .trim()
    .slice(0, max);

// Never throws — call reporting must never fail because a User-Agent string
// was unusual.
function describeCallClient(userAgent) {
  const ua = String(userAgent || "").trim();
  if (!ua) return { device: "", browser: "", os: "" };
  try {
    const parser = Bowser.getParser(ua);
    const os = sanitize(parser.getOSName(), 30);
    const platform = parser.getPlatform() || {};
    const deviceType = platform.type || "";
    const deviceLabel =
      [platform.vendor, platform.model].filter(Boolean).join(" ") ||
      (deviceType ? deviceType.charAt(0).toUpperCase() + deviceType.slice(1) : "");
    const device = sanitize(deviceLabel, 40);

    const inApp = IN_APP_BROWSERS.find((b) => b.pattern.test(ua));
    const browser = inApp ? inApp.name : sanitize(parser.getBrowserName(), 40);

    return { device, browser, os };
  } catch {
    return { device: "", browser: "", os: "" };
  }
}

module.exports = { describeCallClient };
