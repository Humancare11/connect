const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const EmailSignature = require("../models/EmailSignature");
const EmailSignatureDefault = require("../models/EmailSignatureDefault");
const Mailbox = require("../models/Mailbox");
const User = require("../models/User");
const { verifyAdminToken, adminOnly } = require("../middleware/verifyToken");
const { getSignatureSettings } = require("../services/email/emailSettings");
const { createS3AttachmentStore } = require("../utils/emailAttachments");
const { processSignatureImage, SignatureImageError, MAX_RAW_BYTES, MAX_OUTPUT_BYTES, MAX_WIDTH, MAX_HEIGHT } = require("../utils/signatureImage");
const {
  MAX_SIGNATURES,
  MAX_NAME_LENGTH,
  MAX_CONTENT_LENGTH,
  MAX_LINES,
  SignatureValidationError,
  cleanSignatureName,
  cleanSignatureContent,
  LAYOUTS,
  cleanImageAlt,
  cleanImageLink,
} = require("../utils/emailSignature");

const IMAGE_PREFIX = "email-signature-images";
const UPLOADS_PER_HOUR = 20;

// My signatures (Email module). Admin and Super Admin, each strictly their OWN.
//
//   GET    /                   my signatures, my per-mailbox defaults, the mailboxes I may use, limits
//   POST   /                   { name, content, isDefault? }
//   PATCH  /:id                { name?, content?, isDefault? }
//   DELETE /:id
//   PUT    /mailbox-defaults   { mailbox, signatureId | null }
//
// Who owns a signature is decided ONLY by the verified session (req.user.id). It is never
// read from the body or the URL, every query below includes it, and someone else's id is
// answered exactly like an id that does not exist. There is no override for a Super Admin.
function createRouter({
  guard = [verifyAdminToken, adminOnly],
  getSettings = () => getSignatureSettings(),
  store = createS3AttachmentStore(),
  uploadsPerHour = UPLOADS_PER_HOUR,
  now = () => Date.now(),
} = {}) {
  const router = express.Router();
  router.use(...guard);

  // Per-admin upload throttle: decoding images is the one expensive thing here.
  const uploads = new Map();
  const allowUpload = (ownerId) => {
    const key = String(ownerId);
    const t = now();
    const recent = (uploads.get(key) || []).filter((at) => t - at < 3_600_000);
    if (recent.length >= uploadsPerHour) {
      uploads.set(key, recent);
      return false;
    }
    recent.push(t);
    uploads.set(key, recent);
    return true;
  };

  const uploader = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_RAW_BYTES, files: 1, fields: 2, parts: 4 } }).single("image");
  const imageUpload = (req, res, next) =>
    uploader(req, res, (err) => {
      if (!err) return next();
      const msg = err.code === "LIMIT_FILE_SIZE" ? "The image is larger than 5 MB. Choose a smaller file." : "The upload could not be read.";
      return res.status(400).json({ msg });
    });

  const removeObject = (key) => (key ? store.remove(key).catch((err) => console.error("[email-signatures] could not remove image:", err?.message || err)) : null);

  const handle = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof SignatureValidationError || err instanceof SignatureImageError) return res.status(err.status).json({ msg: err.message });
      if (err?.code === 11000) return res.status(409).json({ msg: "You already have a signature with that name." });
      console.error("[email-signatures]", req.method, req.path, err?.message || err);
      res.status(500).json({ msg: "Something went wrong. Please try again." });
    }
  };

  // The acting admin comes from the verified session, like the rest of the Email module.
  async function loadActor(req, res) {
    const user = await User.findById(req.user.id).select("name role accountDisabled").lean();
    if (!user || user.accountDisabled) {
      res.status(401).json({ msg: "Invalid session. Please login again." });
      return null;
    }
    return { id: user._id, name: user.name || "" };
  }

  // Active mailboxes this admin may use (same rule as the rest of the Email module).
  const accessibleMailboxes = (adminId) =>
    Mailbox.find({ isActive: true, $or: [{ allowedAdmins: { $size: 0 } }, { allowedAdmins: adminId }] })
      .sort({ sortOrder: 1, address: 1 })
      .lean();

  // Never includes the storage key. `imageAltEffective` is what the mail uses.
  const toView = (s) => ({
    id: String(s._id),
    name: s.name,
    content: s.content,
    isDefault: Boolean(s.isDefault),
    layout: s.image ? s.layout || "text" : "text",
    image: s.image ? { mime: s.image.mime, width: s.image.width, height: s.image.height, bytes: s.image.bytes } : null,
    imageAlt: s.imageAlt || "",
    imageAltEffective: s.imageAlt || String(s.content || "").split("\n")[0].trim().slice(0, 120),
    imageLink: s.imageLink || "",
    updatedAt: s.updatedAt,
  });
  const validId = (id) => mongoose.isValidObjectId(id) && String(new mongoose.Types.ObjectId(id)) === String(id);
  const notFound = (res) => res.status(404).json({ msg: "Signature not found." });

  // Makes `id` this owner's one default (unsetting the previous one first). The database
  // allows only one default per owner, so a concurrent request cannot leave two: the
  // loser gets a duplicate-key error and tries once more.
  async function makeDefault(owner, id) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await EmailSignature.updateMany({ owner, isDefault: true, _id: { $ne: id } }, { $set: { isDefault: false } });
        await EmailSignature.updateOne({ _id: id, owner }, { $set: { isDefault: true } });
        return;
      } catch (err) {
        if (err?.code !== 11000 || attempt === 1) throw err;
      }
    }
  }

  router.get("/", handle(async (req, res) => {
    const actor = await loadActor(req, res);
    if (!actor) return;
    const [signatures, defaults, mailboxes, settings] = await Promise.all([
      EmailSignature.find({ owner: actor.id }).sort({ isDefault: -1, nameKey: 1 }).lean(),
      EmailSignatureDefault.find({ owner: actor.id }).lean(),
      accessibleMailboxes(actor.id),
      getSettings(),
    ]);
    const first = mailboxes.find((m) => String(m.signature || "").trim());
    res.json({
      signatures: signatures.map(toView),
      // { mailboxId: signatureId }; entries for mailboxes I can no longer use are not shown
      mailboxDefaults: Object.fromEntries(
        defaults.filter((d) => mailboxes.some((m) => String(m._id) === String(d.mailbox))).map((d) => [String(d.mailbox), String(d.signature)])
      ),
      mailboxes: mailboxes.map((m) => ({ id: String(m._id), address: m.address, displayName: m.displayName, companyFooter: m.signature || "" })),
      // What a new signature starts with: my name and the company footer, both editable.
      template: [actor.name, first?.signature || ""].map((s) => String(s).trim()).filter(Boolean).join("\n"),
      companyFooterWithSignature: settings.companyFooterWithSignature,
      limits: {
        maxSignatures: MAX_SIGNATURES,
        maxNameLength: MAX_NAME_LENGTH,
        maxContentLength: MAX_CONTENT_LENGTH,
        maxLines: MAX_LINES,
        maxImageBytes: MAX_OUTPUT_BYTES,
        maxImageWidth: MAX_WIDTH,
        maxImageHeight: MAX_HEIGHT,
      },
    });
  }));

  router.post("/", handle(async (req, res) => {
    const actor = await loadActor(req, res);
    if (!actor) return;
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const name = cleanSignatureName(body.name);
    const content = cleanSignatureContent(body.content);
    if (body.isDefault !== undefined && typeof body.isDefault !== "boolean") throw new SignatureValidationError("isDefault must be true or false.");

    const count = await EmailSignature.countDocuments({ owner: actor.id });
    if (count >= MAX_SIGNATURES) throw new SignatureValidationError(`You can keep up to ${MAX_SIGNATURES} signatures. Delete one first.`);

    // Never an owner from the request. The first signature becomes the default.
    const created = await EmailSignature.create({ owner: actor.id, name, nameKey: name.toLowerCase(), content, isDefault: false });
    if (body.isDefault === true || count === 0) await makeDefault(actor.id, created._id);
    res.status(201).json({ signature: toView(await EmailSignature.findById(created._id).lean()) });
  }));

  router.patch("/:id", handle(async (req, res) => {
    const actor = await loadActor(req, res);
    if (!actor) return;
    if (!validId(req.params.id)) return notFound(res);
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const unknown = Object.keys(body).filter((k) => !["name", "content", "isDefault", "layout", "imageAlt", "imageLink"].includes(k));
    if (unknown.length) throw new SignatureValidationError(`Cannot edit: ${unknown.join(", ")}.`);

    // Includes `owner`: someone else's id is simply "not found".
    const current = await EmailSignature.findOne({ _id: req.params.id, owner: actor.id });
    if (!current) return notFound(res);

    const set = {};
    if (body.name !== undefined) {
      set.name = cleanSignatureName(body.name);
      set.nameKey = set.name.toLowerCase();
    }
    if (body.content !== undefined) set.content = cleanSignatureContent(body.content);
    if (body.imageAlt !== undefined) set.imageAlt = cleanImageAlt(body.imageAlt);
    if (body.imageLink !== undefined) set.imageLink = cleanImageLink(body.imageLink);
    if (body.layout !== undefined) {
      if (!LAYOUTS.includes(body.layout)) throw new SignatureValidationError("Choose text only, image only, or image with text.");
      if (body.layout !== "text" && !current.image) throw new SignatureValidationError("Upload an image first.");
      set.layout = body.layout;
    }
    if (body.isDefault !== undefined && typeof body.isDefault !== "boolean") throw new SignatureValidationError("isDefault must be true or false.");
    if (!Object.keys(set).length && body.isDefault === undefined) throw new SignatureValidationError("Nothing to update.");

    if (Object.keys(set).length) await EmailSignature.updateOne({ _id: current._id, owner: actor.id }, { $set: set });
    if (body.isDefault === true) await makeDefault(actor.id, current._id);
    // Un-ticking the default leaves the admin with no default (nothing is promoted).
    if (body.isDefault === false) await EmailSignature.updateOne({ _id: current._id, owner: actor.id }, { $set: { isDefault: false } });
    res.json({ signature: toView(await EmailSignature.findOne({ _id: current._id, owner: actor.id }).lean()) });
  }));

  router.delete("/:id", handle(async (req, res) => {
    const actor = await loadActor(req, res);
    if (!actor) return;
    if (!validId(req.params.id)) return notFound(res);
    const removed = await EmailSignature.findOneAndDelete({ _id: req.params.id, owner: actor.id });
    if (!removed) return notFound(res);
    // Mail already sent keeps its own copy of the image, so this cannot change it.
    await removeObject(removed.image?.key);
    // A mailbox default that pointed at it goes too. Deleting the default leaves no default.
    await EmailSignatureDefault.deleteMany({ owner: actor.id, signature: removed._id });
    res.json({ ok: true });
  }));

  // ── the image ──
  // The owner is the session user and is part of every query. Another admin's id is "not found".
  router.put("/:id/image", imageUpload, handle(async (req, res) => {
    const actor = await loadActor(req, res);
    if (!actor) return;
    if (!validId(req.params.id)) return notFound(res);
    const current = await EmailSignature.findOne({ _id: req.params.id, owner: actor.id });
    if (!current) return notFound(res);
    if (!allowUpload(actor.id)) {
      return res.status(429).json({ msg: "You have uploaded a lot of images in the last hour. Please try again later." });
    }

    // Decoded and re-encoded: what is stored is our file, never the uploaded bytes.
    const processed = await processSignatureImage(req.file?.buffer);
    const key = `${IMAGE_PREFIX}/${actor.id}/${crypto.randomBytes(12).toString("hex")}.${processed.ext}`;
    await store.put(key, processed.content, processed.mime);

    const previousKey = current.image?.key;
    try {
      const set = { image: { key, mime: processed.mime, width: processed.width, height: processed.height, bytes: processed.bytes } };
      // A first image switches a text-only signature to "image with text lines".
      if (!current.image && current.layout === "text") set.layout = "image_text";
      await EmailSignature.updateOne({ _id: current._id, owner: actor.id }, { $set: set });
    } catch (err) {
      await removeObject(key);
      throw err;
    }
    await removeObject(previousKey);
    res.json({ signature: toView(await EmailSignature.findOne({ _id: current._id, owner: actor.id }).lean()) });
  }));

  router.delete("/:id/image", handle(async (req, res) => {
    const actor = await loadActor(req, res);
    if (!actor) return;
    if (!validId(req.params.id)) return notFound(res);
    const current = await EmailSignature.findOne({ _id: req.params.id, owner: actor.id });
    if (!current) return notFound(res);
    const key = current.image?.key;
    await EmailSignature.updateOne(
      { _id: current._id, owner: actor.id },
      { $set: { image: null, layout: "text", imageAlt: "", imageLink: "" } }
    );
    await removeObject(key);
    res.json({ signature: toView(await EmailSignature.findOne({ _id: current._id, owner: actor.id }).lean()) });
  }));

  router.get("/:id/image", handle(async (req, res) => {
    const actor = await loadActor(req, res);
    if (!actor) return;
    if (!validId(req.params.id)) return notFound(res);
    const current = await EmailSignature.findOne({ _id: req.params.id, owner: actor.id }).lean();
    if (!current?.image) return notFound(res);
    let bytes;
    try {
      bytes = await store.get(current.image.key);
    } catch (err) {
      console.error("[email-signatures] image could not be read:", err?.message || err);
      return res.status(503).json({ msg: "The image could not be loaded. Please try again." });
    }
    res.set({
      "Content-Type": current.image.mime,
      "Content-Length": String(bytes.length),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, no-store",
    });
    res.end(bytes);
  }));

  router.put("/mailbox-defaults", handle(async (req, res) => {
    const actor = await loadActor(req, res);
    if (!actor) return;
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    if (typeof body.mailbox !== "string" || !validId(body.mailbox)) throw new SignatureValidationError("Choose a mailbox.");

    const mailboxes = await accessibleMailboxes(actor.id);
    if (!mailboxes.some((m) => String(m._id) === body.mailbox)) throw new SignatureValidationError("You cannot use that mailbox.", 404);

    if (body.signatureId === null) {
      await EmailSignatureDefault.deleteOne({ owner: actor.id, mailbox: body.mailbox });
      return res.json({ ok: true });
    }
    if (typeof body.signatureId !== "string" || !validId(body.signatureId)) throw new SignatureValidationError("Choose a signature.");
    const mine = await EmailSignature.exists({ _id: body.signatureId, owner: actor.id });
    if (!mine) return notFound(res);

    await EmailSignatureDefault.updateOne(
      { owner: actor.id, mailbox: body.mailbox },
      { $set: { signature: body.signatureId } },
      { upsert: true }
    );
    res.json({ ok: true });
  }));

  return router;
}

module.exports = createRouter();
module.exports.create = createRouter;
