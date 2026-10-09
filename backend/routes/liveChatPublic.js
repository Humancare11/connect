const express = require("express");
const multer = require("multer");
const { getClientIp: realClientIp } = require("../utils/clientIp");
const { devFakeIp } = require("../utils/liveChat/config");
const { liveChatContactLimiter, liveChatConfigLimiter, liveChatUploadLimiter } = require("../middleware/rateLimiters");
const { signChatToken, verifyChatToken } = require("../services/liveChat/chatToken");
const { FileError } = require("../services/liveChat/fileService");

// Public Live Chat API (visitors). Only mounted when LIVECHAT_ENABLED=true, so with the kill switch off these
// URLs do not exist.
//
//   GET  /api/livechat/config   tells the widget the module is on (the widget stays hidden on a 404)
//   POST /api/livechat/upload   a patient's report (pdf/jpg/png, max 10 MB) into their own open chat; needs the chat token
//   POST /api/livechat/contact  the contact form: validates, checks Turnstile + honeypot, registers the visitor and
//                               returns the chat token that unlocks the chat sockets
//
// Options exist so tests run without Cloudflare or the real limiters:
//   chat, loadSettings, verifyTurnstile, isIpBlocked, env, limiters
const HONEYPOT_FIELD = "companyUrl"; // hidden in the form; real people never fill it in

function create({ chat, loadSettings, verifyTurnstile, isIpBlocked, files, env = process.env, limiters = {} }) {
  // Real client IP (same proxy rules as everywhere); LIVECHAT_DEV_FAKE_IP replaces it outside production only.
  const getClientIp = (req) => devFakeIp(env) || realClientIp(req);
  const router = express.Router();
  router.use(express.json({ limit: "8kb" }));
  const contactLimiter = limiters.contact || liveChatContactLimiter;
  const configLimiter = limiters.config || liveChatConfigLimiter;
  const uploadLimiter = limiters.upload || liveChatUploadLimiter;

  // One file, in memory. The parser stops one byte past the limit (it flags a file that reaches its limit as cut off);
  // fileService enforces the exact limit and checks the real type from the bytes.
  const uploadOne = multer({ storage: multer.memoryStorage(), limits: { fileSize: files.limits.maxBytes + 1, files: 1, fields: 2 } }).single("file");
  const bearer = (req) => (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : "");

  router.get("/config", configLimiter, async (req, res, next) => {
    try {
      const settings = await loadSettings();
      res.set("Cache-Control", "no-store");
      res.json({ enabled: true, agentName: settings.agentDisplayName || "Sam", privacyPolicyUrl: "/privacy-policy" });
    } catch (err) {
      next(err);
    }
  });

  router.post(
    "/upload",
    uploadLimiter,
    // Who is it? Checked BEFORE the body is read, so an anonymous caller cannot make the server buffer 10 MB.
    async (req, res, next) => {
      try {
        const visitorId = verifyChatToken(bearer(req), env);
        if (!visitorId) return res.status(401).json({ ok: false, error: "unauthorized" });
        if (await isIpBlocked(getClientIp(req))) return res.status(403).json({ ok: false, error: "blocked" });
        req.visitorId = visitorId;
        return next();
      } catch (err) {
        return next(err);
      }
    },
    (req, res, next) =>
      uploadOne(req, res, (err) => {
        if (err?.code === "LIMIT_FILE_SIZE") return res.status(413).json({ ok: false, error: "file_too_large" });
        if (err) return res.status(400).json({ ok: false, error: "invalid_upload" });
        return next();
      }),
    async (req, res, next) => {
      try {
        res.set("Cache-Control", "no-store");
        if (!req.file) return res.status(400).json({ ok: false, error: "no_file" });
        return res.json(await files.upload({ visitorId: req.visitorId, file: req.file }));
      } catch (err) {
        if (err instanceof FileError) return res.status(err.status).json({ ok: false, error: err.code });
        return next(err);
      }
    }
  );

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
