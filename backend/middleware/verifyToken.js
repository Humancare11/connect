const jwt = require("jsonwebtoken");

// ── shared cookie options (exported so login routes can reuse) ────────────────
// HTTPS=true must be set in .env when SSL is enabled; without it, Secure+SameSite=None
// cookies are silently dropped by browsers on HTTP connections.
const isHTTPS = process.env.HTTPS === "true";
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: isHTTPS ? "none" : "lax",
  secure: isHTTPS,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// ── low-level token extractor ─────────────────────────────────────────────────
function extractBearerToken(req) {
  return req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.split(" ")[1]
    : null;
}

// ── middleware factory for role-specific cookies ──────────────────────────────
// roleMap maps cookie name → expected role value in the JWT payload.
const roleMap = {
  userToken:   "user",
  doctorToken: "doctor",
  adminToken:  null, // admin/superadmin — checked by adminOnly guard separately
};

function makeVerify(cookieName) {
  const expectedRole = roleMap[cookieName];
  return function (req, res, next) {
    const candidates = [
      req.cookies?.[cookieName],
      extractBearerToken(req),
    ].filter(Boolean);

    if (candidates.length === 0)
      return res.status(401).json({ msg: "No token provided. Please login." });

    for (const token of candidates) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Enforce the expected role so a stale user/doctor Bearer token can't
        // slip through a role-specific middleware.
        if (expectedRole && decoded.role !== expectedRole) continue;
        req.user = decoded;
        return next();
      } catch {
        // Try the next candidate; browsers can retain a stale role cookie while
        // the SPA sends the current token in the Authorization header.
      }
    }

    return res.status(401).json({ msg: "Invalid or expired token. Please login again." });
  };
}

// ── Generic verifyToken — tries all cookies, then header ─────────────────────
// Use for routes accessible by any authenticated role (mixed routes).
// Priority: userToken → doctorToken → adminToken → Authorization header.
const verifyToken = (req, res, next) => {
  const bearerToken = extractBearerToken(req);

  const candidates = [
    req.cookies?.userToken,
    req.cookies?.doctorToken,
    req.cookies?.adminToken,
    bearerToken,
  ].filter(Boolean);

  if (candidates.length === 0)
    return res.status(401).json({ msg: "No token provided. Please login." });

  for (const token of candidates) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
      return next();
    } catch { /* try next */ }
  }

  res.status(401).json({ msg: "Invalid or expired token. Please login again." });
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
