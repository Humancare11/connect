const express = require("express");
const { recordMarketingClick, findMarketingCode } = require("../services/marketing/tracking");
const { trackingEnv } = require("../services/email/emailSettings");
const { isCodeShape } = require("../services/marketing/clickLinks");
const { createIpGate } = require("./publicTracking");
const { safeTarget, HEADERS } = require("./publicLinks");

// Public click codes of Email Marketing (no login, no CORS; mounted before helmet/CORS like the other tracking routes).
//
//   GET  /go/<code>      a short redirect for links to OTHER sites: 302 to the address stored for that code.
//                        Only a code that exists in our database can be followed and there is no URL parameter,
//                        so this is not an open redirect. Works whatever the tracking switches say (mail already
//                        sent must never break); recording follows the response and its failures are swallowed.
//   POST /api/r/<code>   the website reports a ?r=<code> visit (navigator.sendBeacon, empty body). Always answers
//                        204 so nothing about codes can be learned from it; the click is recorded afterwards with
//                        the SAME classifiers as every other click (scanner lists, grace window, burst rule...).

const MAX_IN_FLIGHT = 50;
const userAgentOf = (req) => String(req.headers["user-agent"] || "").slice(0, 400);

function createClickCodeRouters({ record = recordMarketingClick, find = findMarketingCode, limitPerMinute = trackingEnv().ratePerMinute, now } = {}) {
  const allow = createIpGate({ limitPerMinute, now });
  let inFlight = 0;

  const later = (req, code) => {
    if (inFlight >= MAX_IN_FLIGHT) return;
    inFlight += 1;
    setImmediate(() => {
      Promise.resolve()
        .then(() => record({ code, ip: req.ip || "", userAgent: userAgentOf(req) }))
        .catch((err) => console.error("[marketing-click] record failed:", err?.message || err))
        .finally(() => {
          inFlight -= 1;
        });
    });
  };

  // ── /go/<code> ──
  const go = express.Router();
  async function resolve(req, res) {
    if (!allow(req.ip || "")) {
      res.status(429).set(HEADERS).type("text/plain").send("Too many requests.");
      return null;
    }
    const code = String(req.params.code || "");
    let found = null;
    try {
      found = isCodeShape(code) ? await find(code) : null;
    } catch (err) {
      console.error("[marketing-click] lookup failed:", err?.message || err);
      res.status(503).set(HEADERS).type("text/plain").send("Please try again.");
      return null;
    }
    const target = found ? safeTarget(found.url) : null;
    if (!target) {
      res.status(404).set(HEADERS).type("text/plain").send("This link is not available.");
      return null;
    }
    res.status(302).set({ ...HEADERS, Location: target }).end();
    return code;
  }
  // HEAD first (Express would otherwise answer it through the GET route); a scanner's HEAD is never recorded.
  go.head("/:code", async (req, res) => {
    await resolve(req, res);
  });
  go.get("/:code", async (req, res) => {
    const code = await resolve(req, res);
    if (code) later(req, code);
  });

  // ── /api/r/<code> ──
  const report = express.Router();
  report.post("/:code", (req, res) => {
    res.set(HEADERS);
    if (!allow(req.ip || "")) return res.status(429).end();
    const code = String(req.params.code || "");
    res.status(204).end();
    if (isCodeShape(code)) later(req, code);
  });

  return { go, report };
}

const routers = createClickCodeRouters();
module.exports = routers;
module.exports.create = createClickCodeRouters;
