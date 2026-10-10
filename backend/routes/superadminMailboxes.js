const express = require("express");
const mongoose = require("mongoose");
const Mailbox = require("../models/Mailbox");
const EmailMessage = require("../models/EmailMessage");
const { verifyAdminToken, superAdminOnly } = require("../middleware/verifyToken");
const { mailboxCheckLimiter } = require("../middleware/rateLimiters");
const { checkMailboxConnection } = require("../services/gmail/connectionCheck");
const { isCompanyAddress, EMAIL_DOMAIN } = Mailbox;

const DEFAULT_COLOR = "#0d7a6f";
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const EDITABLE = ["displayName", "color", "signature", "isActive", "sortOrder", "trackOpensDefault"];

class ValidationError extends Error {
  constructor(message, status = 400, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

// Control characters never belong in a label or footer; newlines are kept in the footer.
const clean = (v, { multiline = false } = {}) =>
  String(v).replace(multiline ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, "").trim();

// Explicit response shape: nothing internal (history id, lease, ...) leaves the server.
function serialize(mb, messageCount = 0) {
  return {
    id: String(mb._id),
    address: mb.address,
    displayName: mb.displayName,
    color: mb.color,
    signature: mb.signature,
    sortOrder: mb.sortOrder,
    trackOpensDefault: mb.trackOpensDefault !== false,
    isActive: mb.isActive,
    deactivatedAt: mb.deactivatedAt,
    lastSyncAt: mb.lastSyncAt,
    lastSyncError: mb.lastSyncError || "",
    // Active but never synced yet: the sync job picks it up within a minute.
    firstSyncPending: mb.isActive && !mb.gmailHistoryId,
    messageCount,
    createdAt: mb.createdAt,
  };
}

function validateFields(body, { requireAll }) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ValidationError("Invalid request.");
  const out = {};

  if (body.displayName !== undefined || requireAll) {
    if (typeof body.displayName !== "string") throw new ValidationError("Display name is required.");
    const name = clean(body.displayName);
    if (!name) throw new ValidationError("Display name is required.");
    if (name.length > 60) throw new ValidationError("Display name must be 60 characters or fewer.");
    out.displayName = name;
  }
  if (body.color !== undefined) {
    if (typeof body.color !== "string" || !COLOR_RE.test(body.color)) throw new ValidationError("Colour must be a hex value like #0d7a6f.");
    out.color = body.color.toLowerCase();
  }
  if (body.signature !== undefined) {
    if (typeof body.signature !== "string") throw new ValidationError("Footer must be text.");
    const footer = clean(body.signature, { multiline: true });
    if (footer.length > 500) throw new ValidationError("Footer must be 500 characters or fewer.");
    out.signature = footer;
  }
  if (body.sortOrder !== undefined) {
    if (!Number.isInteger(body.sortOrder) || body.sortOrder < 0 || body.sortOrder > 1000) {
      throw new ValidationError("Sort order must be a whole number between 0 and 1000.");
    }
    out.sortOrder = body.sortOrder;
  }
  if (body.trackOpensDefault !== undefined) {
    if (typeof body.trackOpensDefault !== "boolean") throw new ValidationError("trackOpensDefault must be true or false.");
    out.trackOpensDefault = body.trackOpensDefault;
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") throw new ValidationError("isActive must be true or false.");
    out.isActive = body.isActive;
  }
  return out;
}

function parseAddress(raw) {
  const address = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!isCompanyAddress(address)) throw new ValidationError(`Enter a valid @${EMAIL_DOMAIN} address.`);
  return address;
}

// Super Admin only. Manages the company mailboxes the Email module uses
// (list, add after a read-only Gmail check, edit, activate/deactivate — never delete,
// so mail history stays).
//
// Options exist so tests can run without real Google:
//   guard    auth middleware (default: verified admin session + Super Admin role)
//   check    (address) => connection-check result
//   limiter  throttle for calls that reach Google
function createSuperadminMailboxesRouter({
  guard = [verifyAdminToken, superAdminOnly],
  check = checkMailboxConnection,
  limiter = mailboxCheckLimiter,
} = {}) {
  const router = express.Router();
  router.use(...guard);

  const handle = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof ValidationError) return res.status(err.status).json({ msg: err.message, ...err.extra });
      if (err?.code === 11000) {
        return res.status(409).json({ msg: "A mailbox with this address already exists.", code: "EXISTS" });
      }
      console.error("[superadmin-mailboxes]", req.method, req.path, err?.message || err);
      res.status(500).json({ msg: "Something went wrong. Please try again." });
    }
  };

  // Runs the throttle from inside a handler (reactivation checks Google too, edits don't).
  const throttled = (req, res) =>
    new Promise((resolve) => {
      res.once("finish", () => resolve(false));
      limiter(req, res, () => resolve(true));
    });

  // GET / — every mailbox, inactive included, with sync state.
  router.get("/", handle(async (req, res) => {
    const [boxes, counts] = await Promise.all([
      Mailbox.find({}).sort({ sortOrder: 1, address: 1 }).lean(),
      EmailMessage.aggregate([{ $group: { _id: "$mailbox", n: { $sum: 1 } } }]),
    ]);
    const countOf = new Map(counts.map((c) => [String(c._id), c.n]));
    res.json({ domain: EMAIL_DOMAIN, mailboxes: boxes.map((m) => serialize(m, countOf.get(String(m._id)) || 0)) });
  }));

  // POST /check — dry run for the Add form. Saves nothing.
  router.post("/check", limiter, handle(async (req, res) => {
    const address = parseAddress(req.body?.address);
    const existing = await Mailbox.findOne({ address }).select("_id isActive").lean();
    if (existing) {
      return res.json({
        ok: false,
        code: "EXISTS",
        message: existing.isActive
          ? "This mailbox is already added."
          : "This mailbox was added before and is inactive. Reactivate it from the list instead.",
        mailboxId: String(existing._id),
      });
    }
    const result = await check(address);
    res.json(result.ok ? { ok: true, address } : { ok: false, code: result.code, message: result.message });
  }));

  // POST / — add. The server runs the Gmail check itself; the client's own check is never trusted.
  router.post("/", limiter, handle(async (req, res) => {
    const address = parseAddress(req.body?.address);
    const fields = validateFields(req.body, { requireAll: true });

    const existing = await Mailbox.findOne({ address }).select("_id isActive").lean();
    if (existing) {
      throw new ValidationError(
        existing.isActive ? "This mailbox is already added." : "This mailbox exists but is inactive. Reactivate it instead.",
        409,
        { code: "EXISTS", mailboxId: String(existing._id) }
      );
    }

    const result = await check(address);
    if (!result.ok) throw new ValidationError(result.message, 422, { code: result.code });

    const last = await Mailbox.findOne({}).sort({ sortOrder: -1 }).select("sortOrder").lean();
    const mailbox = await Mailbox.create({
      address,
      displayName: fields.displayName,
      color: fields.color || DEFAULT_COLOR,
      ...(fields.signature !== undefined ? { signature: fields.signature } : {}),
      ...(fields.trackOpensDefault !== undefined ? { trackOpensDefault: fields.trackOpensDefault } : {}),
      sortOrder: fields.sortOrder ?? (last?.sortOrder || 0) + 1,
      isActive: true,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });
    res.status(201).json({ mailbox: serialize(mailbox, 0) });
  }));

  // PATCH /:id — display name, colour, footer, sort order, activate/deactivate.
  // The address can never change (it is what the service account impersonates).
  router.patch("/:id", handle(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new ValidationError("Mailbox not found.", 404);
    const body = req.body;
    if (body && typeof body === "object" && !Array.isArray(body)) {
      if (body.address !== undefined) throw new ValidationError("The address of a mailbox cannot be changed.");
      const unknown = Object.keys(body).filter((k) => !EDITABLE.includes(k));
      if (unknown.length) throw new ValidationError(`Cannot edit: ${unknown.join(", ")}.`);
    }
    const fields = validateFields(body, { requireAll: false });
    if (!Object.keys(fields).length) throw new ValidationError("Nothing to update.");

    const mailbox = await Mailbox.findById(req.params.id);
    if (!mailbox) throw new ValidationError("Mailbox not found.", 404);

    const reactivating = fields.isActive === true && !mailbox.isActive;
    if (reactivating) {
      // Delegation may have changed while it was off: check again before it goes live.
      if (!(await throttled(req, res))) return;
      const result = await check(mailbox.address);
      if (!result.ok) throw new ValidationError(result.message, 422, { code: result.code });
    }

    Object.assign(mailbox, fields);
    if (fields.isActive === false && mailbox.deactivatedAt === null) mailbox.deactivatedAt = new Date();
    if (fields.isActive === true) mailbox.deactivatedAt = null;
    mailbox.updatedBy = req.user.id;
    await mailbox.save();

    const messageCount = await EmailMessage.countDocuments({ mailbox: mailbox._id });
    res.json({ mailbox: serialize(mailbox, messageCount) });
  }));

  return router;
}

module.exports = createSuperadminMailboxesRouter();
module.exports.create = createSuperadminMailboxesRouter;
