const express = require("express");
const { recordOpen } = require("../services/email/trackingRecorder");
const { trackingEnv } = require("../services/email/emailSettings");

// The public tracking image: GET /api/e/<token>.gif  (no login — mail clients call it).
//
// Whatever is asked, the answer is the same tiny transparent GIF with the same
// headers and status 200: a valid token, an unknown one, garbage, or a caller that
// is over the rate limit. Nothing here can tell anyone whether a token exists.
// The image is sent FIRST; recording happens afterwards and its failures are swallowed.

// 1x1 transparent GIF.
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

const HEADERS = {
  "Content-Type": "image/gif",
  "Content-Length": String(PIXEL.length),
  // Every open must reach us, and no cache (browser, proxy, CDN) may keep it.
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  // Webmail on another origin must be allowed to embed it (helmet's default would block that).
  "Cross-Origin-Resource-Policy": "cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
};

const MAX_IN_FLIGHT = 50;
const MAX_TRACKED_IPS = 10_000;

// Fixed-window per-IP counter. Unlike the API limiters it never answers 429:
// an over-limit request still gets the image, it just isn't recorded.
function createIpGate({ limitPerMinute, now = () => Date.now() }) {
  const hits = new Map();
  return function allow(ip) {
    const t = now();
    const entry = hits.get(ip);
    if (!entry || t - entry.start >= 60_000) {
      if (hits.size >= MAX_TRACKED_IPS) hits.clear();
      hits.set(ip, { start: t, count: 1 });
      return true;
    }
    entry.count += 1;
    return entry.count <= limitPerMinute;
  };
}

// Options exist so tests can use a fake recorder and a small limit.
function createPublicTrackingRouter({ record = recordOpen, limitPerMinute = trackingEnv().ratePerMinute, now } = {}) {
  const router = express.Router();
  const allow = createIpGate({ limitPerMinute, now });
  let inFlight = 0;

  // Link scanners often HEAD first: same headers, never recorded. Registered BEFORE
  // the GET route, because Express would otherwise answer HEAD through it (and record it).
  router.head("/:file", (req, res) => {
    res.status(200).set(HEADERS).end();
  });

  router.get("/:file", (req, res) => {
    res.status(200).set(HEADERS).end(PIXEL);

    const file = String(req.params.file || "");
    const token = file.endsWith(".gif") ? file.slice(0, -4) : file;
    const ip = req.ip || "";
    if (inFlight >= MAX_IN_FLIGHT || !allow(ip)) return;

    inFlight += 1;
    setImmediate(() => {
      Promise.resolve()
        .then(() => record({ token, ip, userAgent: String(req.headers["user-agent"] || "").slice(0, 400) }))
        .catch((err) => console.error("[email-tracking] record failed:", err?.message || err))
        .finally(() => {
          inFlight -= 1;
        });
    });
  });

  return router;
}

module.exports = createPublicTrackingRouter();
module.exports.create = createPublicTrackingRouter;
module.exports.PIXEL = PIXEL;
module.exports.HEADERS = HEADERS;
