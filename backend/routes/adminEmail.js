const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const Mailbox = require("../models/Mailbox");
const EmailMessage = require("../models/EmailMessage");
const EmailAttachment = require("../models/EmailAttachment");
const User = require("../models/User");
const { verifyAdminToken, adminOnly } = require("../middleware/verifyToken");
const { parseListQuery, buildMessageFilter, EmailQueryError } = require("../services/email/emailQueries");
const { serializeMailbox, serializeListItem, serializeThreadMessage, idOf } = require("../services/email/emailSerializers");
const { recordView, summarizeViews } = require("../services/email/emailViews");
const { EmailHttpError, pickReplyTarget, sendNewMail, sendReply, setSpamState } = require("../services/email/emailSender");
const { getAttachmentBytes } = require("../services/email/attachmentFiles");
const { getGmailApi } = require("../services/gmail/gmailAuth");
const { createGmailClient } = require("../services/gmail/gmailClient");
const { emailSendLimiter } = require("../middleware/rateLimiters");
const {
  EmailValidationError,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  normalizeAddressList,
} = require("../utils/emailValidation");
const {
  extensionFilter,
  validateAttachment,
  safeContentType,
  contentDisposition,
  createS3AttachmentStore,
} = require("../utils/emailAttachments");

// Admin + Super Admin only (paymentadmin is deliberately excluded).
// The Email module API: sidebar counts, lists with filters/search, the full mail
// page, view tracking, compose/reply (always attributed to the logged-in admin),
// spam toggle and attachment download.
//
// Options exist so tests can run without real Google/S3:
//   guard        auth middleware (default: verified admin session)
//   getGmail     (mailbox) => Gmail client for that shared mailbox
//   store        attachment storage { put, get, remove }
//   sendLimiter  per-admin send throttle
function createAdminEmailRouter({
  guard = [verifyAdminToken, adminOnly],
  getGmail = (mailbox) => createGmailClient(getGmailApi(mailbox)),
  store = createS3AttachmentStore(),
  sendLimiter = emailSendLimiter,
} = {}) {
  const router = express.Router();
  router.use(...guard);

  // The acting admin comes from the verified session — never from the request.
  // The JWT carries no name, so load it for the "first viewed by" snapshot.
  async function loadActor(req, res) {
    const user = await User.findById(req.user.id).select("name role accountDisabled").lean();
    if (!user || user.accountDisabled) {
      res.status(401).json({ msg: "Invalid session. Please login again." });
      return null;
    }
    return { id: user._id, name: user.name || "Admin", role: user.role };
  }

  // Active mailboxes this admin may use. Empty allowedAdmins = every admin.
  const accessibleMailboxes = (adminId) =>
    Mailbox.find({ isActive: true, $or: [{ allowedAdmins: { $size: 0 } }, { allowedAdmins: adminId }] })
      .sort({ sortOrder: 1, address: 1 })
      .lean();

  const replySubject = (subject) => (/^re:/i.test(subject) ? subject : `Re: ${subject}`);

  // Created only when Gmail is actually needed, so e.g. downloading a file we
  // already hold never requires Google credentials.
  const lazyGmail = (mailbox) => ({
    sendRaw: (...a) => getGmail(mailbox).sendRaw(...a),
    setSpam: (...a) => getGmail(mailbox).setSpam(...a),
    getMessage: (...a) => getGmail(mailbox).getMessage(...a),
    getAttachment: (...a) => getGmail(mailbox).getAttachment(...a),
  });

  // multipart/form-data with optional "files". Limits are enforced while
  // streaming; each file is content-checked afterwards (validateAttachment).
  const uploader = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_ATTACHMENT_BYTES, files: MAX_ATTACHMENTS, fields: 12, fieldSize: 300_000, parts: 30 },
    fileFilter: extensionFilter,
  }).array("files", MAX_ATTACHMENTS);

  const multipart = (req, res, next) =>
    uploader(req, res, (err) => {
      if (!err) return next();
      if (err instanceof EmailValidationError) return res.status(400).json({ msg: err.message });
      if (err instanceof multer.MulterError) {
        const msg =
          err.code === "LIMIT_FILE_SIZE" ? `A file is larger than ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB.`
          : err.code === "LIMIT_FILE_COUNT" ? `Too many attachments (max ${MAX_ATTACHMENTS}).`
          : "The upload could not be read.";
        return res.status(400).json({ msg });
      }
      return res.status(400).json({ msg: "The upload could not be read." });
    });

  const textField = (req, name) => (typeof req.body?.[name] === "string" ? req.body[name] : "");
  const validatedFiles = async (req) => Promise.all((req.files || []).map(validateAttachment));

  const handle = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof EmailQueryError || err instanceof EmailValidationError) {
        return res.status(err.status).json({ msg: err.message });
      }
      if (err instanceof EmailHttpError) return res.status(err.status).json({ msg: err.message, ...err.extra });
      console.error("[admin-email]", req.method, req.path, err?.message || err);
      res.status(500).json({ msg: "Something went wrong. Please try again." });
    }
  };

  // GET /mailboxes — sidebar: company IDs with unread counts.
  // Unread = received, not spam, not yet viewed by ANY admin.
  router.get("/mailboxes", handle(async (req, res) => {
    const actor = await loadActor(req, res);
    if (!actor) return;
    const mailboxes = await accessibleMailboxes(actor.id);
    const ids = mailboxes.map((m) => m._id);

    const rows = await EmailMessage.aggregate([
      { $match: { mailbox: { $in: ids }, direction: "in", firstViewedAt: null } },
      { $group: { _id: { mailbox: "$mailbox", isSpam: "$isSpam" }, n: { $sum: 1 } } },
    ]);
    const unread = new Map();
    let received = 0;
    let spam = 0;
    for (const r of rows) {
      if (r._id.isSpam) {
        spam += r.n;
      } else {
        received += r.n;
        unread.set(String(r._id.mailbox), r.n);
      }
    }

    res.json({
      mailboxes: mailboxes.map((m) => ({ ...serializeMailbox(m), unread: unread.get(String(m._id)) || 0 })),
      counts: { received, spam },
    });
  }));

  // GET /admins — options for the "Sent by" / "First viewed by" filters.
  router.get("/admins", handle(async (req, res) => {
    const admins = await User.find({ role: { $in: ["admin", "superadmin"] }, accountDisabled: { $ne: true } })
      .select("name role")
      .sort({ name: 1 })
      .lean();
    res.json({ admins: admins.map((a) => ({ id: idOf(a._id), name: a.name, role: a.role })) });
  }));

  // GET /messages — one folder, filtered, newest first, paginated.
  router.get("/messages", handle(async (req, res) => {
    const actor = await loadActor(req, res);
    if (!actor) return;
    const params = parseListQuery(req.query);
    const mailboxes = await accessibleMailboxes(actor.id);
    const filter = buildMessageFilter(params, mailboxes.map((m) => m._id));

    const [docs, total] = await Promise.all([
      EmailMessage.find(filter)
        .sort({ messageDate: -1, _id: -1 })
        .skip((params.page - 1) * params.limit)
        .limit(params.limit),
      EmailMessage.countDocuments(filter),
    ]);

    const mailboxMap = new Map(mailboxes.map((m) => [String(m._id), m]));
    res.json({
      items: docs.map((d) => serializeListItem(d, mailboxMap)),
      page: params.page,
      limit: params.limit,
      total,
      hasMore: params.page * params.limit < total,
    });
  }));

  // GET /messages/:id — the full mail page: the thread, attachments, who has
  // viewed it, and what a reply would be sent to/from. Read-only; opening is
  // recorded separately (POST …/view) so refetches never count as views.
  router.get("/messages/:id", handle(async (req, res) => {
    const actor = await loadActor(req, res);
    if (!actor) return;
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ msg: "Mail not found." });

    const mailboxes = await accessibleMailboxes(actor.id);
    const mailboxMap = new Map(mailboxes.map((m) => [String(m._id), m]));
    const opened = await EmailMessage.findOne({ _id: req.params.id, mailbox: { $in: mailboxes.map((m) => m._id) } });
    if (!opened) return res.status(404).json({ msg: "Mail not found." });

    // A spam mail stands alone; otherwise the thread hides any spam in it.
    const thread = opened.gmailThreadId && !opened.isSpam
      ? await EmailMessage.find({ mailbox: opened.mailbox, gmailThreadId: opened.gmailThreadId, isSpam: false }).sort({ messageDate: 1, _id: 1 })
      : [opened];

    const [attachments, views] = await Promise.all([
      EmailAttachment.find({ message: { $in: thread.map((m) => m._id) } }).sort({ _id: 1 }).lean(),
      summarizeViews(opened._id),
    ]);
    const attachmentsByMessage = new Map();
    for (const a of attachments) {
      const key = String(a.message);
      if (!attachmentsByMessage.has(key)) attachmentsByMessage.set(key, []);
      attachmentsByMessage.get(key).push(a);
    }
    const senderIds = [...new Set(thread.map((m) => idOf(m.sentByAdmin)).filter(Boolean))];
    const senders = senderIds.length ? await User.find({ _id: { $in: senderIds } }).select("name role").lean() : [];
    const adminsById = new Map(senders.map((u) => [idOf(u._id), { name: u.name, role: u.role }]));

    const { replyTo } = pickReplyTarget(opened, thread);

    res.json({
      message: serializeThreadMessage(opened, mailboxMap, attachmentsByMessage, adminsById),
      thread: thread.map((m) => serializeThreadMessage(m, mailboxMap, attachmentsByMessage, adminsById)),
      views,
      reply: {
        allowed: !opened.isSpam,
        mailboxId: idOf(opened.mailbox),
        to: { name: replyTo.name || "", address: replyTo.address },
        subject: replySubject(opened.subject),
      },
    });
  }));

  // POST /messages/:id/view — the admin opened this mail. Called once per page
  // open by the UI. → the refreshed viewer list.
  router.post("/messages/:id/view", handle(async (req, res) => {
    const actor = await loadActor(req, res);
    if (!actor) return;
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ msg: "Mail not found." });

    const mailboxes = await accessibleMailboxes(actor.id);
    const message = await EmailMessage.findOne({ _id: req.params.id, mailbox: { $in: mailboxes.map((m) => m._id) } })
      .select("mailbox direction sentByAdmin gmailThreadId");
    if (!message) return res.status(404).json({ msg: "Mail not found." });

    const { recorded } = await recordView(message, actor);
    const [views, fresh] = await Promise.all([
      summarizeViews(message._id),
      EmailMessage.findById(message._id).select("firstViewedBy firstViewedByName firstViewedAt").lean(),
    ]);
    res.json({
      recorded,
      views,
      firstViewed: fresh.firstViewedAt
        ? { by: { id: idOf(fresh.firstViewedBy), name: fresh.firstViewedByName }, at: fresh.firstViewedAt }
        : null,
    });
  }));

  // POST /send — compose. multipart: from (mailbox id), to, cc, subject, body,
  // clientRequestId (idempotency key), files[]. The sender recorded is always the
  // logged-in admin; the visible From is the chosen company mailbox.
  router.post("/send", sendLimiter, multipart, handle(async (req, res) => {
    const actor = await loadActor(req, res);
    if (!actor) return;

    const mailboxes = await accessibleMailboxes(actor.id);
    const mailbox = mongoose.isValidObjectId(textField(req, "from"))
      ? mailboxes.find((m) => String(m._id) === textField(req, "from"))
      : null;
    if (!mailbox) throw new EmailValidationError("Choose a valid From address.");

    const to = normalizeAddressList(textField(req, "to"), { label: "To", required: true });
    const cc = normalizeAddressList(textField(req, "cc"), { label: "Cc" });
    const files = await validatedFiles(req);

    const { message, duplicate } = await sendNewMail({
      mailbox, actor, to, cc,
      subject: textField(req, "subject"),
      body: textField(req, "body"),
      files,
      clientRequestId: textField(req, "clientRequestId"),
      gmail: lazyGmail(mailbox),
      store,
    });
    const mailboxMap = new Map(mailboxes.map((m) => [String(m._id), m]));
    res.status(duplicate ? 200 : 201).json({ duplicate, message: serializeListItem(message, mailboxMap) });
  }));

  // POST /messages/:id/reply — inline reply from the SAME company ID. The
  // recipient, subject and threading come from stored data, never the request.
  // 409 ALREADY_REPLIED if someone replied first; resend with confirm=1 to override.
  router.post("/messages/:id/reply", sendLimiter, multipart, handle(async (req, res) => {
    const actor = await loadActor(req, res);
    if (!actor) return;
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ msg: "Mail not found." });

    const mailboxes = await accessibleMailboxes(actor.id);
    const opened = await EmailMessage.findOne({ _id: req.params.id, mailbox: { $in: mailboxes.map((m) => m._id) } });
    if (!opened) return res.status(404).json({ msg: "Mail not found." });
    if (opened.isSpam) throw new EmailValidationError("Spam cannot be replied to. Mark it as not spam first.");

    const mailbox = mailboxes.find((m) => String(m._id) === String(opened.mailbox));
    const thread = opened.gmailThreadId
      ? await EmailMessage.find({ mailbox: opened.mailbox, gmailThreadId: opened.gmailThreadId, isSpam: false }).sort({ messageDate: 1, _id: 1 })
      : [opened];
    const { anchor, claimTarget, replyTo } = pickReplyTarget(opened, thread);
    if (!replyTo.address) throw new EmailValidationError("There is nobody to send this reply to.");

    const files = await validatedFiles(req);
    const { message, duplicate } = await sendReply({
      mailbox, actor, anchor, claimTarget, replyTo,
      subject: replySubject(opened.subject),
      body: textField(req, "body"),
      files,
      clientRequestId: textField(req, "clientRequestId"),
      confirm: textField(req, "confirm") === "1",
      gmail: lazyGmail(mailbox),
      store,
    });
    const mailboxMap = new Map(mailboxes.map((m) => [String(m._id), m]));
    res.status(duplicate ? 200 : 201).json({ duplicate, message: message ? serializeListItem(message, mailboxMap) : null });
  }));

  // POST /messages/:id/spam and /not-spam — mirrored into Gmail first.
  for (const [route, isSpam] of [["spam", true], ["not-spam", false]]) {
    router.post(`/messages/:id/${route}`, handle(async (req, res) => {
      const actor = await loadActor(req, res);
      if (!actor) return;
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ msg: "Mail not found." });

      const mailboxes = await accessibleMailboxes(actor.id);
      const message = await EmailMessage.findOne({ _id: req.params.id, mailbox: { $in: mailboxes.map((m) => m._id) } });
      if (!message) return res.status(404).json({ msg: "Mail not found." });

      const mailbox = mailboxes.find((m) => String(m._id) === String(message.mailbox));
      const updated = await setSpamState({ message, isSpam, gmail: lazyGmail(mailbox) });
      res.json({ message: serializeListItem(updated, new Map(mailboxes.map((m) => [String(m._id), m]))) });
    }));
  }

  // GET /attachments/:id — authenticated download. Always an attachment, never
  // rendered inline, and refused for spam mail.
  router.get("/attachments/:id", handle(async (req, res) => {
    const actor = await loadActor(req, res);
    if (!actor) return;
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ msg: "File not found." });

    const attachment = await EmailAttachment.findById(req.params.id);
    const mailboxes = await accessibleMailboxes(actor.id);
    const message = attachment
      ? await EmailMessage.findOne({ _id: attachment.message, mailbox: { $in: mailboxes.map((m) => m._id) } }).select("mailbox isSpam")
      : null;
    if (!attachment || !message) return res.status(404).json({ msg: "File not found." });
    if (message.isSpam) {
      return res.status(403).json({ msg: "Attachments of spam mail cannot be downloaded. Mark it as not spam first." });
    }

    const mailbox = mailboxes.find((m) => String(m._id) === String(message.mailbox));
    const bytes = await getAttachmentBytes({ attachment, gmail: lazyGmail(mailbox), store });
    if (!bytes) return res.status(404).json({ msg: "File not found." });

    res.set({
      "Content-Type": safeContentType(attachment.mimeType),
      "Content-Disposition": contentDisposition(attachment.filename),
      "Content-Length": String(bytes.length),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, no-store",
    });
    res.end(bytes);
  }));

  return router;
}

module.exports = createAdminEmailRouter();
module.exports.create = createAdminEmailRouter;
