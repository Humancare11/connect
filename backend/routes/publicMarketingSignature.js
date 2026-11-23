const express = require("express");
const { findHostedByToken } = require("../services/marketing/signature");

// GET /api/m/sig/<token>: the signature image of a marketing mail (no login, mail clients call it).
//
// This is NOT tracking: it never records anything, so loading the image can never count as an open or a click.
// A wrong, malformed, expired or removed token answers 404 and nothing else. Mounted before helmet/CORS like the
// other public mail routes, so it sets its own headers.
function createRouter({ store = null, find = findHostedByToken } = {}) {
  const router = express.Router();
  let s3 = store;
  const getStore = () => s3 || (s3 = require("../utils/emailAttachments").createS3AttachmentStore());

  router.get("/:token", async (req, res) => {
    try {
      const hosted = await find(String(req.params.token || ""));
      if (!hosted) return res.status(404).end();
      const bytes = await getStore().get(hosted.key);
      res.status(200).set({
        "Content-Type": hosted.mime,
        "Content-Length": String(bytes.length),
        "Cache-Control": "public, max-age=3600",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      });
      res.end(bytes);
    } catch (err) {
      console.error("[marketing] signature image:", err?.name || "error");
      res.status(404).end();
    }
  });

  return router;
}

module.exports = createRouter();
module.exports.create = createRouter;
