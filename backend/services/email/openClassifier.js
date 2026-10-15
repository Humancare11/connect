// Decides whether one request for a tracking image is a person opening the mail.
// A pixel can never prove that, so these rules only remove the hits we can
// recognise as NOT a recipient. Every hit is stored with its verdict, so the
// rules can be tuned later without losing data.

const { ipMatches } = require("./ipRules");
const { matchScanner, isApplePrivacyProxy } = require("./scannerLists");

// Network scanners, link checkers and crawlers that no vendor list names.
const SCANNER_UA = /bot|crawl|spider|scanner|curl\/|wget|python|java\/|go-http-client|libwww|headless|proofpoint|mimecast|barracuda|symantec|trendmicro|fireeye|forcepoint|sophos|safelinks|monitor|preview|facebookexternalhit|slackbot|whatsapp|telegram/i;

// Short, non-identifying family name stored with the event (never the raw user agent).
function uaFamily(userAgent) {
  const ua = String(userAgent || "");
  if (!ua) return "";
  if (/GoogleImageProxy/i.test(ua)) return "GoogleImageProxy";
  if (/YahooMailProxy/i.test(ua)) return "YahooProxy";
  if (SCANNER_UA.test(ua) || matchScanner({ userAgent: ua })) return "Scanner";
  if (/Outlook|ms-office|Microsoft Office/i.test(ua)) return "Outlook";
  if (/Edg\//.test(ua)) return "Edge";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/AppleWebKit/.test(ua)) return "AppleWebKit";
  return "Other";
}

// → { counted, reason, automated, ... }
//   counted    a likely human open
//   reason     why it was ignored (empty when counted)
//   automated  ignored because it looks machine-made (shown as "Only automatic loads seen")
//   scanner    true when a scanner list or pattern matched; such a hit may still be counted
//              later by the "second hit" rule (see trackingRecorder.js)
//   apple      true for Apple's Mail Privacy Protection: not a normal open, but not hidden
//
// Options:
//   scannerIps       [{ vendor, rule }] from EMAIL_SCANNER_IPS
//   appleIps         extra Apple proxy ranges from EMAIL_APPLE_PROXY_IPS
//   allRecipientsApple  every To/Cc address is an Apple address, so a load that is not
//                    obviously a scanner went through Apple's proxy even if its address is unlisted
function classifyOpen({
  sentAt,
  now = new Date(),
  ip = "",
  userAgent = "",
  graceSeconds = 60,
  ignoreIps = [],
  scannerIps = [],
  appleIps = [],
  allRecipientsApple = false,
}) {
  if (ignoreIps.length && ipMatches(ip, ignoreIps)) return { counted: false, reason: "own_ip", automated: false };

  // Gmail's image proxy loads the image once, often at delivery, and then serves its
  // cached copy to later opens. That first hit can be the only signal we ever get, so
  // neither the grace window nor the scanner lists may discard it.
  const googleProxy = /GoogleImageProxy/i.test(userAgent);

  // Apple loads every image at delivery, so this comes before the grace window: it is
  // reported as Apple, never as "an open" and never silently dropped.
  if (!googleProxy && isApplePrivacyProxy(ip, appleIps)) {
    return { counted: false, reason: "apple_proxy", automated: false, apple: true };
  }

  const age = new Date(now).getTime() - new Date(sentAt).getTime();
  if (!googleProxy && age < graceSeconds * 1000) return { counted: false, reason: "grace_window", automated: true };

  if (!String(userAgent || "").trim()) return { counted: false, reason: "no_user_agent", automated: true };

  if (!googleProxy) {
    const hit = matchScanner({ userAgent, ip, scannerIps });
    if (hit) return { counted: false, reason: `scanner_${hit.vendor}`, automated: true, scanner: true };
    if (SCANNER_UA.test(userAgent)) return { counted: false, reason: "scanner_ua", automated: true, scanner: true };

    if (allRecipientsApple) return { counted: false, reason: "apple_proxy", automated: false, apple: true };
  }

  return { counted: true, reason: "", automated: false };
}

module.exports = { classifyOpen, uaFamily, ipMatches, SCANNER_UA };
