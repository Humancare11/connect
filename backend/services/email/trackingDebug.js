// Temporary, UAT-only help for tuning the scanner and Apple address lists.
//
// Events deliberately store no IP address. To learn which addresses to put into
// EMAIL_SCANNER_IPS / EMAIL_APPLE_PROXY_IPS, this can write the address and the
// user-agent family of hits that no list matched to the SERVER LOG (never the
// database, never the API). It is off unless ALL of these hold:
//
//   EMAIL_TRACKING_DEBUG_LOG=true
//   EMAIL_TRACKING_DEBUG_UNTIL=<future ISO date>   stops by itself; at most 14 days ahead
//   NODE_ENV is not "production"                   refused there, whatever the other settings say
//
// The log line has no token, message id, address or subject: only what is needed
// to recognise a scanner network.

const MAX_WINDOW_MS = 14 * 24 * 3600 * 1000;

let warnedProduction = false;

// → { on, reason, until }
function debugLogState(env = process.env, now = Date.now()) {
  if (env.EMAIL_TRACKING_DEBUG_LOG !== "true") return { on: false, reason: "flag_off", until: null };
  if (String(env.NODE_ENV || "").toLowerCase() === "production") {
    if (!warnedProduction) {
      warnedProduction = true;
      console.warn("[email-tracking-debug] EMAIL_TRACKING_DEBUG_LOG is ignored when NODE_ENV=production.");
    }
    return { on: false, reason: "production", until: null };
  }
  const until = new Date(String(env.EMAIL_TRACKING_DEBUG_UNTIL || ""));
  if (!env.EMAIL_TRACKING_DEBUG_UNTIL || Number.isNaN(until.getTime())) return { on: false, reason: "no_expiry", until: null };
  if (until.getTime() <= now) return { on: false, reason: "expired", until };
  // A far-away date is capped, so a typo cannot leave it running for months.
  const capped = new Date(Math.min(until.getTime(), now + MAX_WINDOW_MS));
  return { on: true, reason: "", until: capped };
}

// A hit no address list recognised: counted ones, grace-window and generic scanner-looking ones.
// Vendor-matched scanners, Apple and our own address need no tuning.
function isUnmatched(verdict) {
  if (!verdict || verdict.apple) return false;
  if (verdict.reason === "own_ip") return false;
  if (/^scanner_/.test(verdict.reason || "") && verdict.reason !== "scanner_ua") return false;
  return true;
}

// kind: "open" | "click"
function logUnmatched({ kind, ip, family, verdict }, { env = process.env, now = Date.now(), logger = console.log } = {}) {
  if (!isUnmatched(verdict) || !debugLogState(env, now).on) return false;
  const safe = (v) => String(v || "").replace(/[^\w.:\-]/g, "").slice(0, 64);
  const result = verdict.counted ? "counted" : verdict.reason || "ignored";
  logger(`[email-tracking-debug] ${kind} ip=${safe(ip)} ua=${safe(family)} verdict=${safe(result)}`);
  return true;
}

module.exports = { debugLogState, isUnmatched, logUnmatched, MAX_WINDOW_MS };
