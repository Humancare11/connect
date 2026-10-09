const express = require("express");
const { getClientIp } = require("../utils/clientIp");
const { liveChatContactLimiter, liveChatConfigLimiter } = require("../middleware/rateLimiters");
const { signChatToken } = require("../services/liveChat/chatToken");

// Public Live Chat API (visitors). Only mounted when LIVECHAT_ENABLED=true, so with the kill switch off these
// URLs do not exist.
//
//   GET  /api/livechat/config   tells the widget the module is on (the widget stays hidden on a 404)
//   POST /api/livechat/contact  the contact form: validates, checks Turnstile + honeypot, registers the visitor and
//                               returns the chat token that unlocks the chat sockets
//
// Options exist so tests run without Cloudflare or the real limiters:
//   chat, loadSettings, verifyTurnstile, isIpBlocked, env, limiters
const HONEYPOT_FIELD = "companyUrl"; // hidden in the form; real people never fill it in

function create({ chat, loadSettings, verifyTurnstile, isIpBlocked, env = process.env, limiters = {} }) {
  const router = express.Router();
  router.use(express.json({ limit: "8kb" }));
  const contactLimiter = limiters.contact || liveChatContactLimiter;
  const configLimiter = limiters.config || liveChatConfigLimiter;

  router.get("/config", configLimiter, async (req, res, next) => {
    try {
      const settings = await loadSettings();
      res.set("Cache-Control", "no-store");
      res.json({ enabled: true, agentName: settings.agentDisplayName || "Sam", privacyPolicyUrl: "/privacy-policy" });
    } catch (err) {
      next(err);
    }
  });

  router.post("/contact", contactLimiter, async (req, res, next) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const ip = getClientIp(req);
      res.set("Cache-Control", "no-store");

      // Honeypot: bots fill every field. Answer like a success but create nothing and issue no token.
      if (typeof body[HONEYPOT_FIELD] === "string" && body[HONEYPOT_FIELD].trim() !== "") {
        return res.json({ ok: true, visitorId: "", token: "" });
      }
      if (await isIpBlocked(ip)) return res.status(403).json({ ok: false, errors: { form: "Chat is not available right now." } });
      if (body.consent !== true) {
        return res.status(400).json({ ok: false, errors: { form: "Please accept the privacy notice to continue." } });
      }

      const captcha = await verifyTurnstile({ token: body.turnstileToken, ip, env });
      if (!captcha.ok) {
        return res.status(400).json({
          ok: false,
          errors: {
            captcha:
              captcha.reason === "failed" || captcha.reason === "missing_token"
                ? "Please complete the verification and try again."
                : "Verification is unavailable right now. Please try again in a moment.",
          },
        });
      }

      const result = await chat.registerContact({
        visitorId: body.visitorId,
        name: body.name,
        email: body.email,
        phone: body.phone,
        ip,
      });
      if (!result.ok) return res.status(400).json({ ok: false, errors: result.errors });

      return res.json({ ok: true, visitorId: result.visitorId, firstName: result.firstName, token: signChatToken(result.visitorId, env) });
    } catch (err) {
      return next(err);
    }
  });

  return router;
}

module.exports = { create, HONEYPOT_FIELD };
