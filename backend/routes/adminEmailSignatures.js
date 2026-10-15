const crypto = require("crypto");
const express = require("express");
const multer = require("multer");
const EmailSignature = require("../models/EmailSignature");
const User = require("../models/User");
const { verifyAdminToken, adminOnly } = require("../middleware/verifyToken");
const { createS3AttachmentStore } = require("../utils/emailAttachments");
const { processSignatureImage, SignatureImageError, MAX_RAW_BYTES, MAX_OUTPUT_BYTES, MAX_WIDTH, MAX_HEIGHT } = require("../utils/signatureImage");

const IMAGE_PREFIX = "email-signature-images";
const UPLOADS_PER_HOUR = 20;

// My signature (Email module): ONE image per admin. Admin and Super Admin, each strictly their OWN.
//
//   GET    /         my signature { image | null, autoAdd } and the limits
//   PATCH  /         { autoAdd: boolean }
//   PUT    /image    multipart "image" (png/jpg): upload or replace
//   GET    /image    the image (bytes)
//   DELETE /image    remove the image
//
// Whose signature it is is decided ONLY by the verified session (req.user.id). It is never read
// from the body or the URL, and there is no override for a Super Admin.
function createRouter({
  guard = [verifyAdminToken, adminOnly],
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
      if (err instanceof SignatureImageError) return res.status(err.status).json({ msg: err.message });
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

  // Never includes the storage key. No signature yet reads as "no image, automatic on".
  const toView = (s) => ({
    image: s?.image ? { mime: s.image.mime, width: s.image.width, height: s.image.height, bytes: s.image.bytes } : null,
    autoAdd: s ? s.autoAdd !== false : true,
    updatedAt: s?.updatedAt || null,
  });
  const mine = (actor) => EmailSignature.findOne({ owner: actor.id }).lean();

  router.get("/", handle(async (req, res) => {
    const actor = await loadActor(req, res);
    if (!actor) return;
    res.json({
      signature: toView(await mine(actor)),
      limits: { maxImageBytes: MAX_OUTPUT_BYTES, maxImageWidth: MAX_WIDTH, maxImageHeight: MAX_HEIGHT },
    });
  }));

  router.patch("/", handle(async (req, res) => {
    const actor = await loadActor(req, res);
    if (!actor) return;
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    if (typeof body.autoAdd !== "boolean" || Object.keys(body).length !== 1) {
      return res.status(400).json({ msg: "Only autoAdd (true or false) can be changed." });
    }
    const saved = await EmailSignature.findOneAndUpdate(
      { owner: actor.id },
      { $set: { autoAdd: body.autoAdd } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    ).lean();
    res.json({ signature: toView(saved) });
  }));

  // The owner is the session user and is part of every query.
  router.put("/image", imageUpload, handle(async (req, res) => {
    const actor = await loadActor(req, res);
    if (!actor) return;
    if (!allowUpload(actor.id)) {
      return res.status(429).json({ msg: "You have uploaded a lot of images in the last hour. Please try again later." });
    }

    // Decoded and re-encoded: what is stored is our file, never the uploaded bytes.
    const processed = await processSignatureImage(req.file?.buffer);
    const key = `${IMAGE_PREFIX}/${actor.id}/${crypto.randomBytes(12).toString("hex")}.${processed.ext}`;
    await store.put(key, processed.content, processed.mime);

    let previous;
    try {
      previous = await EmailSignature.findOneAndUpdate(
        { owner: actor.id },
        { $set: { image: { key, mime: processed.mime, width: processed.width, height: processed.height, bytes: processed.bytes } } },
        { upsert: true, returnDocument: "before", setDefaultsOnInsert: true }
      ).lean();
    } catch (err) {
      await removeObject(key);
      throw err;
    }
    await removeObject(previous?.image?.key);
    res.json({ signature: toView(await mine(actor)) });
  }));

  router.delete("/image", handle(async (req, res) => {
    const actor = await loadActor(req, res);
    if (!actor) return;
    const previous = await EmailSignature.findOneAndUpdate({ owner: actor.id }, { $set: { image: null } }, { returnDocument: "before" }).lean();
    // Mail already sent keeps its own copy of the image, so this cannot change it.
    await removeObject(previous?.image?.key);
    res.json({ signature: toView(await mine(actor)) });
  }));

  router.get("/image", handle(async (req, res) => {
    const actor = await loadActor(req, res);
    if (!actor) return;
    const current = await mine(actor);
    if (!current?.image) return res.status(404).json({ msg: "Signature not found." });
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

  return router;
}

module.exports = createRouter();
module.exports.create = createRouter;
