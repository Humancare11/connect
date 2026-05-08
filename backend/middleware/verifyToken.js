const jwt = require("jsonwebtoken");

// ── shared cookie options (exported so login routes can reuse) ────────────────
const COOKIE_OPTS = {
  httpOnly: true,
  // For cross-site requests (frontend hosted on different origin), browsers
  // require SameSite=None and Secure to send cookies. Use 'none' in
  // production where frontend/backends are on different hosts.
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// ── low-level token extractor ─────────────────────────────────────────────────
function extractToken(req, cookieName) {
  return (
    req.cookies?.[cookieName] ||
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null)
  );
}

// ── middleware factory for role-specific cookies ──────────────────────────────
function makeVerify(cookieName) {
  return function (req, res, next) {
    const token = extractToken(req, cookieName);
    if (!token) return res.status(401).json({ msg: "No token provided. Please login." });
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      res.status(401).json({ msg: "Invalid or expired token. Please login again." });
    }
  };
}

// ── Generic verifyToken — tries all cookies, then header ─────────────────────
// Use for routes accessible by any authenticated role (mixed routes)
const verifyToken = (req, res, next) => {
  const token =
    req.cookies?.userToken ||
    req.cookies?.doctorToken ||
    req.cookies?.adminToken ||
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null);

  if (!token) return res.status(401).json({ msg: "No token provided. Please login." });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ msg: "Invalid or expired token. Please login again." });
  }
};

// ── Role-specific middleware ───────────────────────────────────────────────────
// These read from the correct cookie so multi-role sessions don't conflict
const verifyUserToken   = makeVerify("userToken");
const verifyDoctorToken = makeVerify("doctorToken");
const verifyAdminToken  = makeVerify("adminToken");

// ── Role guards ───────────────────────────────────────────────────────────────
const doctorOnly = (req, res, next) => {
  if (req.user?.role !== "doctor")
    return res.status(403).json({ msg: "Access denied. Doctors only." });
  next();
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin" && req.user?.role !== "superadmin")
    return res.status(403).json({ msg: "Access denied. Admins only." });
  next();
};

const superAdminOnly = (req, res, next) => {
  if (req.user?.role !== "superadmin")
    return res.status(403).json({ msg: "Access denied. Super Admins only." });
  next();
};

module.exports = {
  COOKIE_OPTS,
  verifyToken,
  verifyUserToken,
  verifyDoctorToken,
  verifyAdminToken,
  doctorOnly,
  adminOnly,
  superAdminOnly,
};
