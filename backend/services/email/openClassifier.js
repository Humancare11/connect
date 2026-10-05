// Decides whether one request for a tracking image is a person opening the mail.
// A pixel can never prove that, so these rules only remove the hits we can
// recognise as NOT a recipient. Every hit is stored with its verdict, so the
// rules can be tuned later without losing data.

// Network scanners, link checkers and crawlers.
const SCANNER_UA = /bot|crawl|spider|scanner|curl\/|wget|python|java\/|go-http-client|libwww|headless|proofpoint|mimecast|barracuda|symantec|trendmicro|fireeye|forcepoint|sophos|safelinks|monitor|preview|facebookexternalhit|slackbot|whatsapp|telegram/i;

// Short, non-identifying family name stored with the event (never the raw user agent).
function uaFamily(userAgent) {
  const ua = String(userAgent || "");
  if (!ua) return "";
  if (/GoogleImageProxy/i.test(ua)) return "GoogleImageProxy";
  if (/YahooMailProxy/i.test(ua)) return "YahooProxy";
  if (SCANNER_UA.test(ua)) return "Scanner";
  if (/Outlook|ms-office|Microsoft Office/i.test(ua)) return "Outlook";
  if (/Edg\//.test(ua)) return "Edge";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/AppleWebKit/.test(ua)) return "AppleWebKit";
  return "Other";
}

// ── own addresses (offices, VPN) ──
const stripV4Mapped = (ip) => String(ip || "").trim().replace(/^::ffff:/i, "");

function v4ToInt(ip) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

// Rules: an exact address (v4 or v6) or an IPv4 CIDR such as 203.0.113.0/24.
function ipMatches(ip, rules) {
  const addr = stripV4Mapped(ip).toLowerCase();
  if (!addr) return false;
  const asInt = v4ToInt(addr);
  for (const raw of rules) {
    const [base, bitsRaw] = String(raw).trim().split("/");
    const rule = stripV4Mapped(base).toLowerCase();
    if (bitsRaw === undefined) {
      if (rule === addr) return true;
      continue;
    }
    const bits = Number(bitsRaw);
    const ruleInt = v4ToInt(rule);
    if (asInt === null || ruleInt === null || !Number.isInteger(bits) || bits < 0 || bits > 32) continue;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    if (((asInt & mask) >>> 0) === ((ruleInt & mask) >>> 0)) return true;
  }
  return false;
}

// → { counted, reason, automated }
//   counted    a likely human open
//   reason     why it was ignored (empty when counted)
//   automated  ignored because it looks machine-made (feeds "Tracking unavailable")
function classifyOpen({ sentAt, now = new Date(), ip = "", userAgent = "", graceSeconds = 60, ignoreIps = [] }) {
  if (ignoreIps.length && ipMatches(ip, ignoreIps)) return { counted: false, reason: "own_ip", automated: false };

  const age = new Date(now).getTime() - new Date(sentAt).getTime();
  if (age < graceSeconds * 1000) return { counted: false, reason: "grace_window", automated: true };

  if (!String(userAgent || "").trim()) return { counted: false, reason: "no_user_agent", automated: true };
  if (SCANNER_UA.test(userAgent) && !/GoogleImageProxy/i.test(userAgent)) {
    return { counted: false, reason: "scanner_ua", automated: true };
  }
  return { counted: true, reason: "", automated: false };
}

module.exports = { classifyOpen, uaFamily, ipMatches, SCANNER_UA };
