// Shared STUN/TURN region configuration, used by both the authenticated
// appointment ICE endpoint (routes/rtc.js) and the guest direct-video-room
// ICE endpoint (routes/directVideoRoom.js) — kept in one place so the two
// never drift out of sync.

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

function buildStunServers() {
  const stunUrls = parseCsv(process.env.RTC_STUN_URLS);
  return [{ urls: stunUrls.length ? stunUrls : FALLBACK_STUN_URLS }];
}

// A TURN "region" is one independent relay deployment: its own hostname(s)
// and its own static-auth-secret. Deliberately never share one secret across
// physically separate machines you don't operate as a single trust unit —
// if one region's secret ever leaked, a shared secret would compromise every
// region at once, where a per-region secret only compromises that one.
const TURN_REGIONS = [
  { urls: parseCsv(process.env.RTC_TURN_URLS), secret: process.env.TURN_STATIC_AUTH_SECRET },
  { urls: parseCsv(process.env.RTC_TURN_URLS_2), secret: process.env.TURN_STATIC_AUTH_SECRET_2 },
].filter((region) => region.urls.length > 0);

module.exports = { parseCsv, FALLBACK_STUN_URLS, buildStunServers, TURN_REGIONS };
