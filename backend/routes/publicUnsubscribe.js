const express = require("express");
const mongoose = require("mongoose");
const MarketingRecipient = require("../models/MarketingRecipient");
const { marketingConfig } = require("../services/marketing/config");
const { verifyUnsubscribeToken } = require("../services/marketing/unsubscribe");
const { suppress, skipQueuedFor } = require("../services/marketing/suppression");
const { escapeHtml } = require("../services/marketing/render");
const { createIpGate } = require("./publicTracking");

// The public unsubscribe page and the one-click endpoint: /api/u/<token> (no login: recipients use it).
//   GET   shows the page with an "Unsubscribe" button. A mail scanner that merely opens the link therefore never
//         unsubscribes anyone.
//   POST  does it. Mail apps' one-click (RFC 8058: body "List-Unsubscribe=One-Click", from the List-Unsubscribe-Post
//         header) and the page's button both end here.
// Works whether or not MARKETING_ENABLED is on: a link in mail that is already out must never break.
// The address is added to the global suppression list; it affects marketing mail only (OTP, appointment and
// account emails never look at it). Nothing here logs an address.

const HEADERS = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
};

const TITLE = "Unsubscribe from Humancare Connect emails";
const TEXT = "Click the button to stop receiving marketing emails from Humancare Connect. You will still receive emails about your appointments and account.";
const DONE = "You have been unsubscribed. You will not receive marketing emails from us again.";

function page({ heading = TITLE, body, button = false, action = "" }) {
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    `<meta name="robots" content="noindex,nofollow"><title>${escapeHtml(heading)}</title><style>` +
    "body{margin:0;background:#eef1f7;font-family:Arial,Helvetica,sans-serif;color:#16213e}" +
    ".card{max-width:480px;margin:48px auto;padding:32px 28px;background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(22,33,62,.08)}" +
    "h1{font-size:21px;margin:0 0 14px}p{font-size:15px;line-height:1.55;margin:0 0 18px;color:#3b4660}" +
    "button{background:#2563eb;color:#fff;border:0;border-radius:9px;padding:12px 24px;font-size:15px;font-weight:700;cursor:pointer}" +
    `</style></head><body><div class="card"><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(body)}</p>` +
    (button ? `<form method="post" action="${escapeHtml(action)}"><button type="submit">Unsubscribe</button></form>` : "") +
    "</div></body></html>"
  );
}

function createPublicUnsubscribeRouter({ cfg = () => marketingConfig(), limitPerMinute = 30, now } = {}) {
  const router = express.Router();
  const allow = createIpGate({ limitPerMinute, now });
  router.use(express.urlencoded({ extended: false, limit: "4kb" }));

  const send = (res, status, html) => res.status(status).set(HEADERS).type("html").send(html);

  async function resolve(req, res) {
    if (!allow(req.ip || "")) {
      res.status(429).set(HEADERS).type("text/plain").send("Too many requests. Please try again in a minute.");
      return null;
    }
    const id = verifyUnsubscribeToken(String(req.params.token || ""), cfg().unsubscribeSecret);
    if (!id || !mongoose.isValidObjectId(id)) {
      send(res, 404, page({ body: "This unsubscribe link is not valid. If you copied it from an email, please use the button in the email itself." }));
      return null;
    }
    const recipient = await MarketingRecipient.findById(id).select("_id campaign email").lean();
    if (!recipient) {
      send(res, 404, page({ body: "This unsubscribe link is no longer available." }));
      return null;
    }
    return recipient;
  }

  router.get("/:token", async (req, res) => {
    try {
      const recipient = await resolve(req, res);
      if (!recipient) return;
      send(res, 200, page({ body: TEXT, button: true, action: `/api/u/${String(req.params.token)}` }));
    } catch (err) {
      console.error("[unsubscribe] page failed:", err?.name || "error");
      send(res, 503, page({ body: "Please try again in a moment." }));
    }
  });

  router.post("/:token", async (req, res) => {
    try {
      const recipient = await resolve(req, res);
      if (!recipient) return;
      if (!recipient.email) {
        // The personal data of this old campaign was already removed, so we cannot tell who to unsubscribe.
        return send(res, 410, page({ body: "This link has expired. Please reply to the email and we will remove you." }));
      }
      await suppress({ email: recipient.email, reason: "unsubscribe", campaign: recipient.campaign });
      await MarketingRecipient.updateOne({ _id: recipient._id, unsubscribedAt: null }, { $set: { unsubscribedAt: new Date() } });
      await skipQueuedFor(recipient.email);

      const oneClick = String(req.body?.["List-Unsubscribe"] || "").toLowerCase() === "one-click";
      if (oneClick) return res.status(200).set(HEADERS).type("text/plain").send("OK");
      return send(res, 200, page({ body: DONE }));
    } catch (err) {
      console.error("[unsubscribe] failed:", err?.name || "error");
      send(res, 503, page({ body: "Please try again in a moment." }));
    }
  });

  return router;
}

module.exports = createPublicUnsubscribeRouter();
module.exports.create = createPublicUnsubscribeRouter;
module.exports.HEADERS = HEADERS;
