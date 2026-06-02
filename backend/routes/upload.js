const express  = require("express");
const router   = express.Router();
const multer   = require("multer");
const path     = require("path");
const fs       = require("fs/promises");
const { randomBytes } = require("crypto");
const { verifyToken } = require("../middleware/verifyToken");
const { storeUploadInGridFS } = require("../utils/uploadStorage");

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const BLOCKED_EXTENSIONS = new Set([
  ".exe", ".dll", ".bat", ".cmd", ".com", ".scr", ".msi", ".ps1", ".sh", ".jar", ".js", ".vbs", ".php", ".py", ".rb",
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

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = Date.now() + "-" + randomBytes(8).toString("hex") + ext;
    cb(null, name);
  },
});

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

async function removeLocalFile(file) {
  if (file?.path) await fs.rm(file.path, { force: true });
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

  const sample = await fs.readFile(file.path);
  if (hasExecutableSignature(sample)) throw new Error("Executable files are not allowed.");

  const { fileTypeFromFile } = await import("file-type");
  const detected = await fileTypeFromFile(file.path);
  const detectedMime = detected?.mime || null;

  if (ext === ".txt" && !isTextFile(sample)) {
    throw new Error("TXT uploads must contain plain text content.");
  }
  if (!mimeAllowedForExtension(ext, detectedMime, file.mimetype)) {
    throw new Error("Uploaded file content does not match the allowed file type.");
  }

  return detectedMime || file.mimetype;
}

// Resolve the public base URL for uploaded files.
// Local requests should always get a local URL; production requests use the
// configured production URL or reverse-proxy headers.
function resolveBaseUrl(req) {
  const requestHost = req.get("host");
  const requestIsLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestHost || "");
  if (requestIsLocal) {
    return `${req.protocol}://${requestHost}`;
  }

  const envUrl = (process.env.BACKEND_URL || "").replace(/\/+$/, "");
  if (envUrl) {
    return envUrl;
  }

  // Honour reverse-proxy forwarded headers (requires "trust proxy" in app)
  const proto = (req.headers["x-forwarded-proto"] || req.protocol || "https")
    .split(",")[0]
    .trim();
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${proto}://${host}`;
}

// POST /api/upload  — protected, any logged-in user or doctor
router.post("/", verifyToken, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ msg: "No file uploaded." });
  try {
    const verifiedMime = await validateUploadedFile(req.file);
    req.file.mimetype = verifiedMime;
    await storeUploadInGridFS(req.file, { userId: req.user.id, role: req.user.role });
    const baseUrl = resolveBaseUrl(req);
    return res.json({
      url:  `${baseUrl}/api/uploads/${req.file.filename}`,
      name: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size,
    });
  } catch (err) {
    await removeLocalFile(req.file);
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
