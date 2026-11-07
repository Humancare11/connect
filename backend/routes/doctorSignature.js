const express = require("express");
const multer = require("multer");
const router = express.Router();
const Enrollment = require("../models/Enrollment");
const { verifyDoctorToken } = require("../middleware/verifyToken");
const { MAX_SIGNATURE_BYTES, PngSignatureError, validatePngSignature } = require("../utils/pngSignature");
const { doctorSignatureKey, putPng, streamPng } = require("../utils/visitNoteStorage");

// Mounted at /api/doctor/signature (before /api/doctor). The doctor's reusable Visit Note signature.
const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIGNATURE_BYTES, files: 1, fields: 5 },
}).single("signature");

router.use(verifyDoctorToken);

router.get("/", async (req, res) => {
  const enrollment = await Enrollment.findOne({ doctorId: req.user.id }).select("signatureKey").lean();
  res.status(200).json({ hasSignature: !!enrollment?.signatureKey });
});

router.get("/image", async (req, res) => {
  const enrollment = await Enrollment.findOne({ doctorId: req.user.id }).select("signatureKey").lean();
  if (!enrollment?.signatureKey) return res.status(404).json({ msg: "No signature uploaded yet." });
  return streamPng(res, enrollment.signatureKey);
});

router.put("/", (req, res) => {
  uploader(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ msg: "The signature image must be 1 MB or smaller." });
      }
      return res.status(400).json({ msg: "The upload could not be read." });
    }
    try {
      const { buffer } = await validatePngSignature(req.file);
      const enrollment = await Enrollment.findOne({ doctorId: req.user.id }).select("_id").lean();
      if (!enrollment) return res.status(404).json({ msg: "Complete your doctor profile before uploading a signature." });
      const key = doctorSignatureKey(req.user.id);
      await putPng(key, buffer);
      await Enrollment.updateOne({ _id: enrollment._id }, { $set: { signatureKey: key } });
      return res.status(200).json({ hasSignature: true });
    } catch (e) {
      if (e instanceof PngSignatureError) return res.status(e.status).json({ msg: e.message });
      console.error("signature upload error:", e);
      return res.status(500).json({ msg: "Failed to save signature." });
    }
  });
});

module.exports = router;
