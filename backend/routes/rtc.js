const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/verifyToken");
const { generateTurnCredentials } = require("../utils/turnCredentials");

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const FALLBACK_STUN_URLS = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
];

// A TURN "region" is one independent relay deployment: its own hostname(s)
// and its own static-auth-secret. Deliberately never share one secret across
// physically separate machines you don't operate as a single trust unit —
// if one region's secret ever leaked, a shared secret would compromise every
// region at once, where a per-region secret only compromises that one.
//
// Configuring a 2nd region (RTC_TURN_URLS_2 / TURN_STATIC_AUTH_SECRET_2) is
// what actually buys redundancy: if the whole primary region is unreachable
// (an outage, a bad deploy, a network partition — not just one blocked
// port), the browser still gathers working relay candidates from the
// secondary, since ICE queries every configured server in parallel and uses
// whichever produces a working candidate pair. Today only the primary is
// populated; add a 3rd by following the same "_3" naming pattern below.
const TURN_REGIONS = [
  { urls: parseCsv(process.env.RTC_TURN_URLS), secret: process.env.TURN_STATIC_AUTH_SECRET },
  { urls: parseCsv(process.env.RTC_TURN_URLS_2), secret: process.env.TURN_STATIC_AUTH_SECRET_2 },
].filter((region) => region.urls.length > 0);

// GET /api/rtc/ice-servers
// Returns STUN URLs (no secret needed there) plus, for each configured TURN
// region, a short-lived TURN credential minted just for this request — see
// utils/turnCredentials.js for why. Requires any authenticated identity
// (doctor/user/admin); the credential isn't tied to a specific appointment,
// this is just to avoid handing out relay credentials to anonymous callers.
router.get("/ice-servers", verifyToken, (req, res) => {
  const stunUrls = parseCsv(process.env.RTC_STUN_URLS);
  const iceServers = [{ urls: stunUrls.length ? stunUrls : FALLBACK_STUN_URLS }];

  let ttlSeconds = null;
  for (const region of TURN_REGIONS) {
    if (!region.secret) {
      console.warn("[rtc] A TURN region has urls configured but no matching secret — skipping it.");
      continue;
    }

    const creds = generateTurnCredentials({ identifier: req.user?.id, secret: region.secret });
    if (!creds) continue;

    iceServers.push({
      urls: region.urls,
      username: creds.username,
      credential: creds.credential,
      credentialType: "password",
    });
    // Report the soonest expiry across regions, so a client that ever uses
    // this to schedule a refresh never holds on to an already-expired
    // credential for a region with a shorter TTL.
    ttlSeconds = ttlSeconds === null ? creds.ttlSeconds : Math.min(ttlSeconds, creds.ttlSeconds);
  }

  if (!TURN_REGIONS.length) {
    console.warn("[rtc] No TURN region is configured — serving STUN-only ICE config.");
  }

  res.json({ iceServers, ttlSeconds: ttlSeconds || 0 });
});

module.exports = router;
