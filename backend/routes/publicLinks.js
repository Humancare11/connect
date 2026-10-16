const express = require("express");
const { recordClick, findLink } = require("../services/email/clickRecorder");
const { trackingEnv } = require("../services/email/emailSettings");
const { createIpGate } = require("./publicTracking");

// The public tracked link: GET /api/l/<token>  (no login — recipients click it).
//
// The visitor is redirected FIRST, immediately, to the address that was in the
// mail. Only a link that exists in our database can be followed (the token is
// unguessable and there is no URL parameter), so this is not an open redirect.
// Recording happens afterwards and its failures are swallowed.
//
// The redirect works whatever the tracking switches say: a link in a mail that
// was already sent must never break because tracking was switched off.

const HEADERS = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  // The token is in this URL: never pass it on to the destination as a referrer.
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
};

const MAX_IN_FLIGHT = 50;

// Only plain http(s) addresses without control characters are ever redirected to.
function safeTarget(raw) {
  const url = String(raw || "");
  if (!url || url.length > 2048 || /[\u0000-\u001F\u007F\s]/.test(url)) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

// Options exist so tests can use fakes and a small limit.
function createPublicLinksRouter({ record = recordClick, find = findLink, limitPerMinute = trackingEnv().ratePerMinute, now } = {}) {
  const router = express.Router();
  const allow = createIpGate({ limitPerMinute, now });
  let inFlight = 0;

  // A scanner often HEADs first: it is redirected the same way and never recorded.
  // Registered BEFORE the GET route (Express would otherwise answer HEAD through it).
  async function resolve(req, res) {
    if (!allow(req.ip || "")) {
      res.status(429).set(HEADERS).type("text/plain").send("Too many requests.");
      return null;
    }
    let found = null;
    try {
      found = await find(String(req.params.token || ""));
    } catch (err) {
      console.error("[email-links] lookup failed:", err?.message || err);
      res.status(503).set(HEADERS).type("text/plain").send("Please try again.");
      return null;
    }
    const target = found ? safeTarget(found.url) : null;
    if (!target) {
      res.status(404).set(HEADERS).type("text/plain").send("This link is not available.");
      return null;
    }
    res.status(302).set({ ...HEADERS, Location: target }).end();
    return found;
  }

  router.head("/:token", async (req, res) => {
    await resolve(req, res);
  });

  router.get("/:token", async (req, res) => {
    const found = await resolve(req, res);
    if (!found || inFlight >= MAX_IN_FLIGHT) return;

    inFlight += 1;
    setImmediate(() => {
      Promise.resolve()
        .then(() => record({ token: String(req.params.token), ip: req.ip || "", userAgent: String(req.headers["user-agent"] || "").slice(0, 400) }))
        .catch((err) => console.error("[email-links] record failed:", err?.message || err))
        .finally(() => {
          inFlight -= 1;
        });
    });
  });

  return router;
}

module.exports = createPublicLinksRouter();
module.exports.create = createPublicLinksRouter;
module.exports.safeTarget = safeTarget;
module.exports.HEADERS = HEADERS;
