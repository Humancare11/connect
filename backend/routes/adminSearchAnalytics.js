const express = require("express");
const { verifyAdminToken, adminOnly } = require("../middleware/verifyToken");
const { searchAnalyticsAdminLimiter } = require("../middleware/rateLimiters");
const { createSearchAnalyticsAdminController } = require("../controllers/searchAnalyticsAdminController");

// Admin Search Analytics - read-only aggregate APIs, mounted at
// /api/admin/search-analytics:
//   GET /summary   GET /terms   GET /daily-terms   GET /gaps   GET /trend
//
// Guard order: no-store header first (so even a 401/403 is never cached), then
// the same authentication and authorization as the other Admin panel routes
// (verifyAdminToken, adminOnly - "admin" and "superadmin" only; paymentadmin,
// employeeadmin, partner, doctor and user are refused), then the per-admin rate
// limit. The routes exist whether or not analytics collection
// is switched on; with it off they simply report whatever was collected before.

// URL path -> controller handler.
const ENDPOINTS = Object.freeze({
  summary: "summary",
  terms: "terms",
  "daily-terms": "dailyTerms",
  gaps: "gaps",
  trend: "trend",
});

function noStore(req, res, next) {
  res.set("Cache-Control", "no-store");
  next();
}

function createAdminSearchAnalyticsRouter({
  guard = [verifyAdminToken, adminOnly, searchAnalyticsAdminLimiter],
  controller = createSearchAnalyticsAdminController(),
} = {}) {
  const router = express.Router();
  router.use(noStore, ...guard);

  for (const [name, handler] of Object.entries(ENDPOINTS)) {
    router.get(`/${name}`, controller[handler]);
    // Everything else on a known path is refused, never routed to a handler.
    router.all(`/${name}`, (req, res) => {
      res.set("Allow", "GET");
      res.status(405).json({ success: false, error: { code: "METHOD_NOT_ALLOWED", message: "Only GET is supported." } });
    });
  }
  router.use((req, res) => {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Not found." } });
  });
  return router;
}

module.exports = createAdminSearchAnalyticsRouter();
module.exports.create = createAdminSearchAnalyticsRouter;
