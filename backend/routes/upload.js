const express  = require("express");
const router   = express.Router();
const multer   = require("multer");
const path     = require("path");
const { verifyToken } = require("../middleware/verifyToken");

const ALLOWED_TYPES = /jpeg|jpg|png|gif|webp|pdf|doc|docx|txt|xls|xlsx/;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = Date.now() + "-" + Math.round(Math.random() * 1e9) + ext;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (ALLOWED_TYPES.test(ext)) return cb(null, true);
    cb(new Error("File type not allowed. Accepted: images, PDF, Word, Excel, TXT."));
  },
});

// Resolve the public base URL for uploaded files.
// Priority:
//   1. BACKEND_URL env var — but ONLY if it is not a localhost/127.x address.
//      (Prevents dev .env leaking into production when the wrong .env is loaded.)
//   2. X-Forwarded-Proto / X-Forwarded-Host headers set by Nginx / Apache / Cloudflare.
//   3. req.protocol + req.get("host") for direct (non-proxied) connections.
function resolveBaseUrl(req) {
  const envUrl = (process.env.BACKEND_URL || "").replace(/\/+$/, "");
  if (envUrl && !/localhost|127\.0\.0\.1/.test(envUrl)) {
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
router.post("/", verifyToken, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ msg: "No file uploaded." });
  const baseUrl = resolveBaseUrl(req);
  return res.json({
    url:  `${baseUrl}/api/uploads/${req.file.filename}`,
    name: req.file.originalname,
    type: req.file.mimetype,
    size: req.file.size,
  });
});

// Multer error handler
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message) {
    return res.status(400).json({ msg: err.message });
  }
  next(err);
});

module.exports = router;
