const express = require("express");
const EmailAttachment = require("../models/EmailAttachment");
const EmailMessage = require("../models/EmailMessage");
const { recordDownload, findDownloadLink } = require("../services/email/downloadRecorder");
const { trackingEnv } = require("../services/email/emailSettings");
const { createS3AttachmentStore, safeContentType, contentDisposition } = require("../utils/emailAttachments");
const { createIpGate } = require("./publicTracking");

// The public secure download: GET /api/d/<token>  (no login — recipients use it).
//
// The token is unguessable (192 random bits, only its hash is stored) and expires. An
// expired, unknown or malformed link gets the same plain page, so nothing says which.
// The file is streamed through here, so the storage address is never exposed and the
// response headers are ours: always a download, never a page.
//
// Scanners are served the file like anyone else (blocking them would get the mail
// flagged); they are just not counted. Recording happens after the file is sent and its
// failures are swallowed.

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Link expired</title>
<style>body{font-family:Arial,Helvetica,sans-serif;background:#f6f7f9;color:#1f1f1f;margin:0;padding:48px 16px}
main{max-width:460px;margin:0 auto;background:#fff;border:1px solid #e1e4e8;border-radius:10px;padding:28px}
h1{font-size:20px;margin:0 0 12px}p{margin:0;line-height:1.5;color:#444}</style></head>
<body><main><h1>This link has expired</h1>
<p>This download link has expired or is no longer available. Please ask the sender to send the file again.</p></main></body></html>`;

const BASE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  // The token is in this URL: never pass it on as a referrer.
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
};

const MAX_CONCURRENT = 10;
const MAX_IN_FLIGHT_RECORDS = 50;

// Options exist so tests can use fakes, a small limit and a fixed clock.
function createPublicDownloadsRouter({
  store = null,
  record = recordDownload,
  find = findDownloadLink,
  limitPerMinute = trackingEnv().ratePerMinute,
  now: clock,
  nowDate = () => new Date(),
} = {}) {
  const router = express.Router();
  const allow = createIpGate({ limitPerMinute, now: clock });
  let files = store;
  let sending = 0;
  let recording = 0;

  const page = (res, status) => res.status(status).set({ ...BASE_HEADERS, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" }).send(PAGE);

  // Everything before the first byte: rate limit, lookup, expiry, file.
  // → { link, attachment, bytes? } or null (the response was already sent).
  async function resolve(req, res, { withBytes }) {
    if (!allow(req.ip || "")) {
      res.status(429).set(BASE_HEADERS).type("text/plain").send("Too many requests.");
      return null;
    }
    let link;
    try {
      link = await find(String(req.params.token || ""), nowDate());
    } catch (err) {
      console.error("[email-downloads] lookup failed:", err?.message || err);
      res.status(503).set(BASE_HEADERS).type("text/plain").send("Please try again.");
      return null;
    }
    if (!link) return void page(res, 404);
    if (link.expired) return void page(res, 410);

    const message = await EmailMessage.findOne({ _id: link.messageId, direction: "out" }).select("status").lean();
    const attachment = message && message.status !== "failed" ? await EmailAttachment.findById(link.attachmentId).lean() : null;
    if (!attachment?.s3Key) return void page(res, 404);

    if (!withBytes) return { link, attachment };
    try {
      files = files || createS3AttachmentStore();
      return { link, attachment, bytes: await files.get(attachment.s3Key) };
    } catch (err) {
      console.error("[email-downloads] file could not be read:", err?.message || err);
      res.status(503).set(BASE_HEADERS).type("text/plain").send("The file is temporarily unavailable. Please try again.");
      return null;
    }
  }

  const fileHeaders = (attachment, size) => ({
    ...BASE_HEADERS,
    "Content-Type": safeContentType(attachment.mimeType),
    "Content-Disposition": contentDisposition(attachment.filename),
    "Content-Length": String(size),
    // Even if something renders it, it cannot run or load anything.
    "Content-Security-Policy": "default-src 'none'; sandbox",
  });

  // Scanners often HEAD first: same checks, same headers, no body, never recorded.
  // Registered BEFORE the GET route (Express would otherwise answer HEAD through it).
  router.head("/:token", async (req, res) => {
    const found = await resolve(req, res, { withBytes: false });
    if (!found) return;
    res.status(200).set(fileHeaders(found.attachment, found.attachment.size || 0)).end();
  });

  router.get("/:token", async (req, res) => {
    // Files are read into memory (at most 10 MB each), so only a few at a time.
    if (sending >= MAX_CONCURRENT) {
      res.status(503).set({ ...BASE_HEADERS, "Retry-After": "5" }).type("text/plain").send("Busy. Please try again in a moment.");
      return;
    }
    sending += 1;
    let found;
    try {
      found = await resolve(req, res, { withBytes: true });
      if (!found) return;
      res.status(200).set(fileHeaders(found.attachment, found.bytes.length)).end(found.bytes);
    } finally {
      sending -= 1;
    }

    if (recording >= MAX_IN_FLIGHT_RECORDS) return;
    recording += 1;
    setImmediate(() => {
      Promise.resolve()
        .then(() => record({ token: String(req.params.token), ip: req.ip || "", userAgent: String(req.headers["user-agent"] || "").slice(0, 400) }))
        .catch((err) => console.error("[email-downloads] record failed:", err?.message || err))
        .finally(() => {
          recording -= 1;
        });
    });
  });

  return router;
}

module.exports = createPublicDownloadsRouter();
module.exports.create = createPublicDownloadsRouter;
module.exports.PAGE = PAGE;
