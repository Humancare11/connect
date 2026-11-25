const crypto = require("crypto");

// How a link in a marketing mail is made trackable WITHOUT showing a technical tracking URL on hover.
//
//   own site  (humancareconnect.co, www., and the host of PUBLIC_TRACKING_BASE_URL, i.e. uat. on UAT)
//             the real page URL + "?r=<code>". The site reports the code once and removes it from the address bar.
//   elsewhere https://<our domain>/go/<code>, a 302 to the stored address.
//   never     mailto:, tel:, #anchors (not http(s) so never matched), the unsubscribe link, the plain-text part.
//
// The code is ~10 random base62 characters. It carries no data (no email, name, campaign); only its SHA-256 is
// stored, next to the recipient and the original URL.

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const CODE_LENGTH = 10;
const CODE_RE = /^[0-9A-Za-z]{8,16}$/;

const hashCode = (code) => crypto.createHash("sha256").update(String(code)).digest("hex");
const isCodeShape = (value) => typeof value === "string" && CODE_RE.test(value);

function newClickCode() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) code += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return { code, hash: hashCode(code) };
}

const stripWww = (host) => String(host || "").toLowerCase().replace(/^www\./, "");

// The hosts whose pages carry the "r" reporter: the public site, plus the host of the configured base URL
// (that is uat.humancareconnect.co on UAT). MARKETING_SITE_HOSTS can add more (comma separated).
function ownSiteHosts({ baseUrl = "", extra = "" } = {}) {
  const hosts = new Set(["humancareconnect.co"]);
  try {
    if (baseUrl) hosts.add(stripWww(new URL(baseUrl).hostname));
  } catch {
    /* an unusable base URL adds nothing */
  }
  for (const h of String(extra || "").split(",")) if (h.trim()) hosts.add(stripWww(h.trim()));
  return hosts;
}

const FILE_EXT_RE = /\.[A-Za-z0-9]{1,6}$/;

// A page of the website (the SPA runs there and can report the code) vs. a file or an API address.
function isSitePage(pathname) {
  if (/^\/(api|go|assets|socket\.io)(\/|$)/i.test(pathname)) return false;
  const last = pathname.split("/").pop() || "";
  return !FILE_EXT_RE.test(last) || /\.html?$/i.test(last);
}

// → { kind: "own", url } | { kind: "go" } | null
//   null: not a plain http(s) link (leave it alone).
function planLink(original, { hosts, code, goUrl }) {
  let parsed;
  try {
    parsed = new URL(original);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  const own = hosts.has(stripWww(parsed.hostname)) && !parsed.username && !parsed.password;
  if (own && isSitePage(parsed.pathname) && !parsed.searchParams.has("r")) {
    // URL#search/hash are kept as written; "r" is appended last, before the #fragment.
    const hashIndex = original.indexOf("#");
    const base = hashIndex === -1 ? original : original.slice(0, hashIndex);
    const fragment = hashIndex === -1 ? "" : original.slice(hashIndex);
    const joiner = base.includes("?") ? (/[?&]$/.test(base) ? "" : "&") : "?";
    return { kind: "own", url: `${base}${joiner}r=${code}${fragment}` };
  }
  return { kind: "go", url: goUrl(code) };
}

const goUrl = (baseUrl, code) => `${baseUrl}/go/${code}`;

// The links gate for marketing: the env switches are the emergency stop; the Super Admin "Record which links are
// clicked" switch belongs to the Email page and is NOT consulted here. Test mails never get links at all.
// `state` is what getTrackingState() returns.
const marketingLinksOn = (state) => Boolean(state && state.envEnabled && state.linksEnvEnabled && state.baseUrl);

module.exports = { CODE_LENGTH, isCodeShape, hashCode, newClickCode, ownSiteHosts, isSitePage, planLink, goUrl, marketingLinksOn };
