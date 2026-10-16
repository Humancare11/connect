// Who is NOT a person when an image or link is requested: mail-security scanners and
// Apple's Mail Privacy Protection proxy. One place to maintain, one place to tune.
//
// Two kinds of evidence, per vendor: the User-Agent (cheap, but many scanners send a
// normal browser agent) and the network address (reliable, but the vendors' ranges
// change). The IP lists are therefore NOT guessed here: they start empty and are
// filled from the vendor's own published ranges through the environment, see
// EMAIL_SCANNER_IPS and EMAIL_APPLE_PROXY_IPS in emailSettings.js.

const { ipMatches } = require("./ipRules");

// vendor → User-Agent patterns. Every hit is stored with `scanner_<vendor>` as its
// reason, so the rules can be tuned later without losing data.
// GoogleImageProxy is deliberately absent: it is Gmail loading the image for a real
// recipient (see openClassifier.js).
const VENDOR_UA = {
  microsoft: /safelinks|bingpreview|microsoftpreview|microsoft defender|defender for office|office ?365.*(scan|protect)/i,
  mimecast: /mimecast/i,
  proofpoint: /proofpoint|urldefense|ppe-?scan/i,
  barracuda: /barracuda|bmsp/i,
  google: /google-safebrowsing|googlebot|google-inspectiontool|googlesecurityscanner|google-read-aloud/i,
  symantec: /symantec|messagelabs|broadcom.*email/i,
  trendmicro: /trendmicro|trend micro/i,
};

// Apple's own address block: Mail Privacy Protection requests come from Apple-owned
// addresses or from Apple's relay partners. Only the part that is certainly Apple's
// is built in; the partner egress ranges come from EMAIL_APPLE_PROXY_IPS.
const APPLE_SEED_IPS = ["17.0.0.0/8"];

// "microsoft=40.92.0.0/15, mimecast=…, 203.0.113.0/24" → [{ vendor, rule }]
// A bare range has no vendor name and is reported as "other".
function parseScannerIps(value) {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const eq = entry.indexOf("=");
      const vendor = eq > 0 ? entry.slice(0, eq).trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16) : "other";
      const rule = (eq > 0 ? entry.slice(eq + 1) : entry).trim();
      return { vendor: vendor || "other", rule };
    })
    .filter((e) => e.rule);
}

// → { vendor, by: "ua" | "ip" } | null
function matchScanner({ userAgent = "", ip = "", scannerIps = [] } = {}) {
  const ua = String(userAgent || "");
  for (const [vendor, re] of Object.entries(VENDOR_UA)) {
    if (re.test(ua)) return { vendor, by: "ua" };
  }
  for (const { vendor, rule } of scannerIps) {
    if (ipMatches(ip, [rule])) return { vendor, by: "ip" };
  }
  return null;
}

const isApplePrivacyProxy = (ip, extraIps = []) => ipMatches(ip, [...APPLE_SEED_IPS, ...extraIps]);

module.exports = { VENDOR_UA, APPLE_SEED_IPS, parseScannerIps, matchScanner, isApplePrivacyProxy };
