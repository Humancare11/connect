const express = require("express");
const router = express.Router();
const { search } = require("../controllers/searchController");
const { searchLimiter } = require("../middleware/rateLimiters");

// Public Healthcare Discovery Search. Replaces the legacy handler removed
// in PR 1 (backend/searchRoutes.js is not used).
router.post("/", searchLimiter, search);

// Mounted in server.js right after this router, ahead of the global error
// handler: rejects malformed / oversized JSON bodies for this path without
// logging the error object, whose body-parser details can contain the raw
// search text.
function handleSearchErrors(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err?.type === "entity.parse.failed" || err?.type === "entity.too.large" || err?.status === 400 || err?.status === 413) {
    return res.status(400).json({
      success: false,
      error: { code: "INVALID_REQUEST", message: "Request body must be valid JSON." },
    });
  }
  console.error("[search] unexpected error:", err?.name || "Error");
  return res.status(500).json({
    success: false,
    error: { code: "SEARCH_FAILED", message: "Search failed. Please try again." },
  });
}

module.exports = router;
module.exports.handleSearchErrors = handleSearchErrors;
