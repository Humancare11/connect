const express  = require("express");
const router   = express.Router();
const multer   = require("multer");
const path     = require("path");
const { randomBytes } = require("crypto");
const { verifyToken } = require("../middleware/verifyToken");
const { storeUploadInS3, uploadKey } = require("../utils/uploadStorage");
const { createS3PresignedPutUrl, DEFAULT_EXPIRY_SECONDS } = require("../utils/s3PresignedUrl");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const { getS3ObjectUrl } = require("../config/s3");

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const BLOCKED_EXTENSIONS = new Set([
  ".exe", ".dll", ".bat", ".cmd", ".com", ".scr", ".msi", ".ps1", ".sh", ".jar", ".js", ".vbs", ".php", ".py", ".rb",
  ".html", ".htm", ".svg", ".xml", ".ts", ".tsx", ".jsx",
]);
const BLOCKED_MIME_PREFIXES = ["application/x-msdownload", "application/x-dosexec", "application/x-sh"];
const ALLOWED_TYPES = {
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".gif": ["image/gif"],
  ".webp": ["image/webp"],
  ".pdf": ["application/pdf"],
  ".txt": ["text/plain"],
  ".doc": ["application/msword", "application/x-cfb"],
  ".xls": ["application/vnd.ms-excel", "application/x-cfb"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
  ],
  ".xlsx": [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
  ],
};

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) return cb(new Error("Executable files are not allowed."));
    if (ALLOWED_TYPES[ext]) return cb(null, true);
    cb(new Error("File type not allowed. Accepted: images, PDF, Word, Excel, TXT."));
  },
});

function generateStoredFilename(originalname) {
  const ext = path.extname(originalname).toLowerCase();
  const base = path.basename(originalname, ext)
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "document";
  return `${base}-${Date.now()}-${randomBytes(4).toString("hex")}${ext}`;
}

function sanitizeMetadataValue(value) {
  return String(value || "")
    .replace(/[^\t\x20-\x7e]/g, "")
    .slice(0, 500);
}

function slugFolderName(name, fallback) {
  const slug = String(name || fallback || "Unknown")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "Unknown";
}

function fullNameFromEnrollment(enrollment) {
  return [enrollment?.firstName, enrollment?.surname].filter(Boolean).join(" ").trim();
}

async function resolveUploadFolder(req) {
  const role = req.user?.role;

  if (role === "doctor") {
    const doctor = await Doctor.findById(req.user.id).select("name email").lean();
    return `doctors/${slugFolderName(doctor?.name || doctor?.email, req.user.id)}`;
  }

  if (role === "user") {
    const user = await User.findById(req.user.id).select("name email").lean();
    return `patients/${slugFolderName(user?.name || user?.email, req.user.id)}`;
  }

  if (["admin", "superadmin", "paymentadmin"].includes(role)) {
    const ownerType = String(req.body.ownerType || "").toLowerCase();
    const ownerId = req.body.ownerId;

    if (ownerType === "doctor" && ownerId) {
      const enrollment = await Enrollment.findById(ownerId)
        .populate("doctorId", "name email")
        .select("firstName surname email doctorId")
        .lean();
      if (!enrollment) throw new Error("Target doctor enrollment was not found.");

      const doctorName = fullNameFromEnrollment(enrollment) || enrollment.doctorId?.name || enrollment.email || enrollment.doctorId?.email;
      return `doctors/${slugFolderName(doctorName, ownerId)}`;
    }

    if (ownerType === "patient" && ownerId) {
      const user = await User.findById(ownerId).select("name email").lean();
      if (!user) throw new Error("Target patient was not found.");
      return `patients/${slugFolderName(user.name || user.email, ownerId)}`;
    }
  }

  return "";
}

function hasExecutableSignature(buffer) {
  if (!buffer || buffer.length < 4) return false;
  const ascii = buffer.toString("utf8", 0, Math.min(buffer.length, 128));
  return (
    buffer.subarray(0, 2).equals(Buffer.from("MZ")) ||
    buffer.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) ||
    ascii.startsWith("#!") ||
    /<script[\s>]/i.test(ascii)
  );
}

function isTextFile(buffer) {
  if (!buffer || buffer.length === 0) return true;
  if (buffer.includes(0)) return false;
  return buffer.toString("utf8").includes("\ufffd") === false;
}

function mimeAllowedForExtension(ext, detectedMime, declaredMime) {
  const allowed = ALLOWED_TYPES[ext] || [];
  if (detectedMime && allowed.includes(detectedMime)) return true;
  if (ext === ".txt" && !detectedMime && declaredMime === "text/plain") return true;
  if ([".doc", ".xls"].includes(ext) && detectedMime === "application/x-cfb") return true;
  if ([".docx", ".xlsx"].includes(ext) && detectedMime === "application/zip") return true;
  return false;
}

async function validateUploadedFile(file) {
  if (!file) throw new Error("No file uploaded.");

  const ext = path.extname(file.originalname).toLowerCase();
  const allowed = ALLOWED_TYPES[ext];
  if (!allowed || BLOCKED_EXTENSIONS.has(ext)) {
    throw new Error("File type not allowed. Accepted: images, PDF, Word, Excel, TXT.");
  }
  if (BLOCKED_MIME_PREFIXES.some((prefix) => file.mimetype?.startsWith(prefix))) {
    throw new Error("Executable files are not allowed.");
  }

  const sample = file.buffer;
  if (hasExecutableSignature(sample)) throw new Error("Executable files are not allowed.");

  const { fileTypeFromBuffer } = await import("file-type");
  const detected = await fileTypeFromBuffer(file.buffer);
  const detectedMime = detected?.mime || null;

  if (ext === ".txt" && !isTextFile(sample)) {
    throw new Error("TXT uploads must contain plain text content.");
  }
  if (!mimeAllowedForExtension(ext, detectedMime, file.mimetype)) {
    throw new Error("Uploaded file content does not match the allowed file type.");
  }

  return detectedMime || file.mimetype;
}

function validateUploadMetadata({ originalName, contentType, size }) {
  const ext = path.extname(originalName || "").toLowerCase();
  const allowed = ALLOWED_TYPES[ext];
  const fileSize = Number(size);

  if (!originalName || !allowed || BLOCKED_EXTENSIONS.has(ext)) {
    throw new Error("File type not allowed. Accepted: images, PDF, Word, Excel, TXT.");
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
    throw new Error("File is too large. Maximum allowed size is 10 MB.");
  }
  if (BLOCKED_MIME_PREFIXES.some((prefix) => String(contentType || "").startsWith(prefix))) {
    throw new Error("Executable files are not allowed.");
  }
  if (!allowed.includes(contentType)) {
    throw new Error("Uploaded file content type is not allowed for this file extension.");
  }
}

// POST /api/upload/presign — returns a private S3 PUT URL for direct browser upload
router.post("/presign", verifyToken, async (req, res) => {
  try {
    const originalName = String(req.body.originalName || req.body.name || "").trim();
    const contentType = String(req.body.contentType || req.body.type || "").trim();
    const size = Number(req.body.size);

    validateUploadMetadata({ originalName, contentType, size });

    const filename = generateStoredFilename(originalName);
    const folderKey = await resolveUploadFolder(req);
    const key = folderKey ? `${folderKey}/${filename}` : uploadKey(filename);
    const metadata = {
      originalname: sanitizeMetadataValue(originalName),
      contenttype: sanitizeMetadataValue(contentType),
      size: String(size),
      uploadedby: req.user?.id ? String(req.user.id) : "",
      uploadedbyrole: sanitizeMetadataValue(req.user?.role || ""),
      uploadedat: new Date().toISOString(),
    };
    const signed = await createS3PresignedPutUrl(key, {
      expiresIn: DEFAULT_EXPIRY_SECONDS,
      contentType,
      metadata,
    });

    return res.json({
      uploadUrl: signed.url,
      expiresAt: signed.expiresAt,
      // Only Content-Type is needed — all x-amz-meta-* headers are already
      // embedded (hoisted) in the presigned URL query string by the SDK.
      // Sending them again from the browser triggers CORS preflight failures.
      headers: { "Content-Type": contentType },
      file: {
        url: getS3ObjectUrl(key),
        key,
        name: originalName,
        type: contentType,
        size,
      },
    });
  } catch (err) {
    console.error("upload presign error:", err);
    const status = /not allowed|too large|Executable|content type/i.test(err.message) ? 400 : 500;
    return res.status(status).json({ msg: status === 400 ? err.message : "Could not prepare direct upload." });
  }
});

// POST /api/upload  — protected, any logged-in user or doctor
router.post("/", verifyToken, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ msg: "No file uploaded." });
  try {
    const verifiedMime = await validateUploadedFile(req.file);
    req.file.mimetype = verifiedMime;
    req.file.filename = generateStoredFilename(req.file.originalname);
    const folderKey = await resolveUploadFolder(req);
    const uploaded = await storeUploadInS3(req.file, { userId: req.user.id, role: req.user.role, folderKey });
    return res.json({
      url:  uploaded.key,
      key:  uploaded.key,
      name: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size,
    });
  } catch (err) {
    console.error("upload validation/storage error:", err);
    const status = /not allowed|Executable|does not match|plain text/i.test(err.message) ? 400 : 500;
    return res.status(status).json({ msg: status === 400 ? err.message : "File could not be stored for shared access." });
  }
});

// Multer error handler
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message) {
    return res.status(400).json({ msg: err.message });
  }
  next(err);
});

module.exports = router;
