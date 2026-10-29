const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const User = require("../models/User");
const { getClientIp } = require("../utils/clientIp");
const { resolveRequestCurrency } = require("../utils/currencyConfig");
const { lookupLocation } = require("../utils/geoIp");

// Tiny in-memory per-IP limiter: this is a public endpoint that may touch the
// database and the GeoIP file, so it is capped at 60 requests a minute per IP.
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 60;
const hits = new Map();

function limiter(req, res, next) {
  const now = Date.now();
  const key = getClientIp(req) || req.ip || "unknown";
  for (const [k, v] of hits) if (now - v.start >= WINDOW_MS) hits.delete(k);
  const entry = hits.get(key);
  if (!entry || now - entry.start >= WINDOW_MS) {
    hits.set(key, { start: now, count: 1 });
    return next();
  }
  if (entry.count >= MAX_PER_WINDOW) {
    res.set("Retry-After", String(Math.ceil((entry.start + WINDOW_MS - now) / 1000)));
    return res.status(429).json({ msg: "Too many requests. Please try again shortly." });
  }
  entry.count += 1;
  return next();
}

// The logged-in customer's id, if any. This only decides which currency to
// show, so a plain signature + expiry check is enough (no session bookkeeping,
// no security event for a visitor who simply is not logged in).
function optionalUserId(req) {
  const header = String(req.headers?.authorization || "");
  const bearer = /^Bearer\s+(.+)$/i.exec(header)?.[1];
  const token = req.cookies?.userToken || bearer;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded?.type === "refresh" || decoded?.role !== "user") return null;
    return decoded.id || null;
  } catch {
    return null;
  }
}

// GET /api/geo/currency - public. Which currency this visitor should see:
// the logged-in user's profile country first, then the IP's country, else USD.
// Always USD while MULTI_CURRENCY_ENABLED is off. Never cached: the answer
// depends on who is asking.
//   -> { currency: "USD" | "EUR" | "GBP", country: "DE" | "", source }
router.get("/currency", limiter, async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  try {
    let userCountry = "";
    const userId = optionalUserId(req);
    if (userId) {
      const user = await User.findById(userId).select("country").lean();
      userCountry = user?.country || "";
    }
    const result = await resolveRequestCurrency({
      userCountry,
      ip: getClientIp(req),
      lookupLocation,
    });
    res.json(result);
  } catch (err) {
    console.error("GET /api/geo/currency error:", err.message);
    // Never block the site on this: USD is the safe default.
    res.json({ currency: "USD", country: "", source: "default" });
  }
});

module.exports = router;
