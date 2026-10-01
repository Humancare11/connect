// Detects the handful of in-app browsers (WebViews embedded inside another
// app, e.g. tapping a link inside WhatsApp) with well-known, stable
// User-Agent tokens. These WebViews often restrict camera/mic access more
// than a real browser, so a direct-call link opened inside one is a common
// source of "call won't connect" reports. Scoped deliberately to apps with a
// documented, stable UA marker — not an exhaustive list, and never used to
// block anything, only to suggest opening the link in a real browser.
const IN_APP_BROWSERS = [
  // Facebook's own in-app browser and Messenger's both carry these tokens;
  // FB_IAB is the explicit "in-app browser" marker, FBAN/FBAV are the host
  // app's name/version and appear even when FB_IAB is missing on some builds.
  { name: "Facebook", pattern: /FBAN|FBAV|FB_IAB/i },
  { name: "Instagram", pattern: /Instagram/i },
  { name: "WhatsApp", pattern: /WhatsApp/i },
  { name: "Messenger", pattern: /Messenger/i },
  { name: "Line", pattern: /\bLine\//i },
  { name: "Twitter", pattern: /Twitter/i },
];

// Returns { isInApp: false } for a normal browser, or { isInApp: true, name }
// naming the first match. Never throws — worst case, no banner shows.
export function detectInAppBrowser(userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "") {
  if (!userAgent) return { isInApp: false, name: "" };
  for (const { name, pattern } of IN_APP_BROWSERS) {
    if (pattern.test(userAgent)) return { isInApp: true, name };
  }
  return { isInApp: false, name: "" };
}

// Best-effort Android "open in Chrome" intent for the given https URL. Many
// in-app WebViews block or ignore intent:// navigation entirely (by design,
// to keep users inside the host app) — this is a nice-to-have, never the
// only escape hatch, which is why the UI always also offers "Copy link".
export function buildAndroidChromeIntentUrl(httpsUrl) {
  try {
    const u = new URL(httpsUrl);
    const withoutScheme = `${u.host}${u.pathname}${u.search}${u.hash}`;
    return `intent://${withoutScheme}#Intent;scheme=https;package=com.android.chrome;end;`;
  } catch {
    return null;
  }
}

export function isAndroidUserAgent(userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "") {
  return /Android/i.test(userAgent);
}
