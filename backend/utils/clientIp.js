// utils/clientIp.js
//
// Resolves the real client IP for the current request.
//
// Express already knows how to walk X-Forwarded-For safely once `trust proxy`
// matches the real proxy chain, so req.ip is the primary source. The one
// exception is Cloudflare: when USE_CLOUDFLARE_HEADERS=true we prefer the
// CF-Connecting-IP header. That header is only trustworthy when the origin
// accepts traffic *exclusively* from Cloudflare — otherwise a client can send
// it themselves — so it is off by default.
const net = require("net");

// TRUST_PROXY env → value for app.set("trust proxy", ...).
//   unset / ""           → 1  (the previous hard-coded behaviour)
//   "false" / "0"        → false (no proxy in front of Node)
//   "true"               → true  (trust every hop — only for locked-down setups)
//   "2"                  → trust that many hops
//   "loopback, 10.0.0.0/8" → Express subnet list / keywords
function parseTrustProxy(value) {
  const raw = String(value ?? "").trim();
  if (raw === "") return 1;
  const lower = raw.toLowerCase();
  if (lower === "false") return false;
  if (lower === "true") return true;
  if (/^\d+$/.test(raw)) return Number(raw) === 0 ? false : Number(raw);
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function useCloudflareHeaders() {
  return String(process.env.USE_CLOUDFLARE_HEADERS || "").trim().toLowerCase() === "true";
}

// Strips whitespace, an IPv4 port ("1.2.3.4:5678"), IPv6 brackets/ports
// ("[::1]:80") and the IPv4-mapped IPv6 prefix ("::ffff:1.2.3.4"). Returns ""
// when the result is not a valid IP address.
function normalizeIp(raw) {
  let ip = String(raw || "").trim();
  if (!ip) return "";

  const bracketed = ip.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketed) ip = bracketed[1];
  else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.slice(0, ip.lastIndexOf(":"));

  const zone = ip.indexOf("%");
  if (zone !== -1) ip = ip.slice(0, zone);

  const mapped = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped) ip = mapped[1];

  return net.isIP(ip) ? ip.toLowerCase() : "";
}

const V4_NON_PUBLIC = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
];

const v4ToInt = (ip) => ip.split(".").reduce((acc, part) => acc * 256 + Number(part), 0);

function isPublicV4(ip) {
  const value = v4ToInt(ip);
  return !V4_NON_PUBLIC.some(([base, bits]) => {
    const size = 2 ** (32 - bits);
    const start = v4ToInt(base);
    return value >= start && value < start + size;
  });
}

function isPublicV6(ip) {
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return false;
  const firstGroup = parseInt(lower.split(":")[0] || "0", 16);
  if ((firstGroup & 0xfe00) === 0xfc00) return false; // fc00::/7 unique-local
  if ((firstGroup & 0xffc0) === 0xfe80) return false; // fe80::/10 link-local
  if ((firstGroup & 0xff00) === 0xff00) return false; // ff00::/8 multicast
  if (lower.startsWith("2001:db8:") || lower === "2001:db8::") return false; // documentation
  return true;
}

// True only for a normalized, publicly routable address — i.e. one a GeoIP
// database could actually know about.
function isPublicIp(raw) {
  const ip = normalizeIp(raw);
  if (!ip) return false;
  return net.isIPv4(ip) ? isPublicV4(ip) : isPublicV6(ip);
}

// Best-effort client IP as a normalized string, or "" when unknown.
function getClientIp(req) {
  if (useCloudflareHeaders()) {
    const cf = normalizeIp(req?.headers?.["cf-connecting-ip"]);
    if (cf) return cf;
  }
  return normalizeIp(req?.ip) || normalizeIp(req?.socket?.remoteAddress);
}

module.exports = { getClientIp, isPublicIp, normalizeIp, parseTrustProxy };
