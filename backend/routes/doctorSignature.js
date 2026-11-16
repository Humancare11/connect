const express = require("express");
const multer = require("multer");
const router = express.Router();
const Enrollment = require("../models/Enrollment");
const { verifyDoctorToken } = require("../middleware/verifyToken");
const { doctorSignatureLimiter } = require("../middleware/rateLimiters");
const { MAX_SIGNATURE_BYTES, SignatureUploadError, processSignatureUpload } = require("../utils/signatureUpload");
const { isDoctorSignatureRequired } = require("../utils/documentSignature");
const { doctorSignatureKey, putPng, streamPng } = require("../utils/visitNoteStorage");

// Mounted at /api/doctor/signature (before /api/doctor). The doctor's one reusable signature, used on
// Prescriptions, Medical Certificates and Visit Notes. PNG or JPG, 2 MB; always stored as a re-encoded PNG.
const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIGNATURE_BYTES, files: 1, fields: 5 },
}).single("signature");

router.use(verifyDoctorToken);

// multipart field "removeBackground": "0" turns the JPG white-background removal off (default on).
const wantsBackgroundRemoval = (req) => String(req.body?.removeBackground ?? "1") !== "0";

// Shared by preview and save so both run the identical processing.
const handleUpload = (onProcessed) => (req, res) => {
  uploader(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ msg: "The signature image must be 2 MB or smaller." });
      }
      return res.status(400).json({ msg: "The upload could not be read." });
    }
    try {
      const processed = await processSignatureUpload(req.file, { removeBackground: wantsBackgroundRemoval(req) });
      return await onProcessed(req, res, processed);
    } catch (e) {
      if (e instanceof SignatureUploadError) return res.status(e.status).json({ msg: e.message });
      console.error("signature upload error:", e);
      return res.status(500).json({ msg: "Failed to save signature." });
    }
  });
};

router.get("/", async (req, res) => {
  const enrollment = await Enrollment.findOne({ doctorId: req.user.id }).select("signatureKey").lean();
  // `required` tells the forms whether Prescriptions / Certificates need a signature (emergency switch).
  res.status(200).json({ hasSignature: !!enrollment?.signatureKey, required: isDoctorSignatureRequired() });
});

router.get("/image", async (req, res) => {
  const enrollment = await Enrollment.findOne({ doctorId: req.user.id }).select("signatureKey").lean();
  if (!enrollment?.signatureKey) return res.status(404).json({ msg: "No signature uploaded yet." });
  return streamPng(res, enrollment.signatureKey);
});

// Nothing is stored: returns the processed signature so the doctor can check it before saving.
router.post(
  "/preview",
  doctorSignatureLimiter,
  handleUpload(async (req, res, p) => {
    res.set("Cache-Control", "private, no-store");
    return res.status(200).json({
      previewDataUrl: `data:image/png;base64,${p.buffer.toString("base64")}`,
      width: p.width,
      height: p.height,
      sourceType: p.sourceType,
      backgroundRemoved: p.backgroundRemoved,
    });
  }),
);

router.put(
  "/",
  doctorSignatureLimiter,
  handleUpload(async (req, res, p) => {
    const enrollment = await Enrollment.findOne({ doctorId: req.user.id }).select("_id").lean();
    if (!enrollment) return res.status(404).json({ msg: "Complete your doctor profile before uploading a signature." });
    const key = doctorSignatureKey(req.user.id);
    await putPng(key, p.buffer);
    await Enrollment.updateOne({ _id: enrollment._id }, { $set: { signatureKey: key } });
    return res.status(200).json({ hasSignature: true, backgroundRemoved: p.backgroundRemoved });
  }),
);

module.exports = router;
