const jwt = require("jsonwebtoken");
const Session = require("../models/Session");
const RevokedToken = require("../models/RevokedToken");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const { recordSecurityIncident } = require("../utils/securityMonitor");

const ACCESS_TOKEN_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_MS = 8 * 60 * 60 * 1000;
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
const isSecureCookie = process.env.NODE_ENV === "production" || process.env.HTTPS === "true";

const BASE_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: isSecureCookie ? "none" : "lax",
  secure: isSecureCookie,
};

const COOKIE_OPTS = { ...BASE_COOKIE_OPTS, maxAge: ACCESS_TOKEN_MS };
const REFRESH_COOKIE_OPTS = { ...BASE_COOKIE_OPTS, maxAge: REFRESH_TOKEN_MS };

const ACCESS_COOKIE_BY_ROLE = {
  user: "userToken",
  doctor: "doctorToken",
  admin: "adminToken",
  superadmin: "adminToken",
  paymentadmin: "adminToken",
  employeeadmin: "employeeAdminToken",
};

const REFRESH_COOKIE_BY_ROLE = {
  user: "userRefreshToken",
  doctor: "doctorRefreshToken",
  admin: "adminRefreshToken",
  superadmin: "adminRefreshToken",
  paymentadmin: "adminRefreshToken",
  employeeadmin: "employeeAdminRefreshToken",
};

function extractBearerToken(req) {
  return req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.split(" ")[1]
    : null;
}

function identityId(user) {
  return String(user._id || user.id);
}

function signAccessToken(user, sessionId) {
  return jwt.sign(
    { id: identityId(user), email: user.email, role: user.role, sid: String(sessionId) },
    process.env.JWT_SECRET,
    { expiresIn: Math.floor(ACCESS_TOKEN_MS / 1000) }
  );
}

function signRefreshToken(user, sessionId) {
  return jwt.sign(
    {
      id: identityId(user),
      email: user.email,
      role: user.role,
      sid: String(sessionId),
      type: "refresh",
    },
    process.env.JWT_SECRET,
    { expiresIn: Math.floor(REFRESH_TOKEN_MS / 1000) }
  );
}

async function issueAuthCookies(res, user) {
  const session = await Session.create({
    userId: identityId(user),
    role: user.role,
    lastActivityAt: new Date(),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_MS),
  });
  res.cookie(ACCESS_COOKIE_BY_ROLE[user.role], signAccessToken(user, session._id), COOKIE_OPTS);
  res.cookie(REFRESH_COOKIE_BY_ROLE[user.role], signRefreshToken(user, session._id), REFRESH_COOKIE_OPTS);
  return session;
}

function clearAuthCookies(res, role = "user") {
  res.clearCookie(ACCESS_COOKIE_BY_ROLE[role] || "userToken", COOKIE_OPTS);
  res.clearCookie(REFRESH_COOKIE_BY_ROLE[role] || "userRefreshToken", REFRESH_COOKIE_OPTS);
}

async function validateDecodedSession(decoded) {
  if (!decoded?.sid || decoded.type === "refresh") return false;

  const session = await Session.findById(decoded.sid);
  if (!session || session.revokedAt) return false;
  if (session.userId !== String(decoded.id) || session.role !== decoded.role) return false;
  const revoked = await RevokedToken.exists({ sessionId: String(decoded.sid), userId: String(decoded.id) });
  if (revoked) return false;

  if (["user", "admin", "superadmin", "paymentadmin", "employeeadmin"].includes(decoded.role)) {
    const user = await User.findById(decoded.id).select("accountDisabled disabledAt role").lean();
    if (!user || user.accountDisabled) return false;
  }
  if (decoded.role === "doctor") {
    const doctor = await Doctor.findById(decoded.id).select("accountDisabled disabledAt").lean();
    if (!doctor || doctor.accountDisabled) return false;
  }

  if (Date.now() - session.lastActivityAt.getTime() > INACTIVITY_TIMEOUT_MS) {
    session.revokedAt = new Date();
    await session.save();
    return false;
  }

  session.lastActivityAt = new Date();
  session.expiresAt = new Date(Date.now() + REFRESH_TOKEN_MS);
  await session.save();
  return true;
}

const roleMap = {
  userToken: "user",
  doctorToken: "doctor",
  adminToken: null,
  employeeAdminToken: "employeeadmin",
};

function makeVerify(cookieName) {
  const expectedRole = roleMap[cookieName];
  return async function (req, res, next) {
    const candidates = [req.cookies?.[cookieName], extractBearerToken(req)].filter(Boolean);

    if (candidates.length === 0) {
      recordSecurityIncident(req, {
        type: "unauthorized_access",
        severity: "medium",
        title: "Authenticated endpoint accessed without token",
        resource: req.originalUrl,
      });
      return res.status(401).json({ msg: "No token provided. Please login." });
    }

    for (const token of candidates) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (expectedRole && decoded.role !== expectedRole) continue;
        if (!(await validateDecodedSession(decoded))) continue;
        req.user = decoded;
        return next();
      } catch {
        // Try the next candidate.
      }
    }

    recordSecurityIncident(req, {
      type: "unauthorized_access",
      severity: "medium",
      title: "Authenticated endpoint accessed with invalid or revoked token",
      resource: req.originalUrl,
    });
    return res.status(401).json({ msg: "Invalid, expired, or timed out session. Please login again." });
  };
}

const verifyToken = async (req, res, next) => {
  // Try higher-privilege tokens first so an admin who also holds a userToken
  // cookie is correctly identified as admin, not as the user.
  const candidates = [
    req.cookies?.adminToken,
    req.cookies?.doctorToken,
    req.cookies?.userToken,
    extractBearerToken(req),
  ].filter(Boolean);

  if (candidates.length === 0) {
    recordSecurityIncident(req, {
      type: "unauthorized_access",
      severity: "medium",
      title: "Authenticated endpoint accessed without token",
      resource: req.originalUrl,
    });
    return res.status(401).json({ msg: "No token provided. Please login." });
  }

  for (const token of candidates) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!(await validateDecodedSession(decoded))) continue;
      req.user = decoded;
      return next();
    } catch {
      // Try the next candidate.
    }
  }

  recordSecurityIncident(req, {
    type: "unauthorized_access",
    severity: "medium",
    title: "Authenticated endpoint accessed with invalid or revoked token",
    resource: req.originalUrl,
  });
  return res.status(401).json({ msg: "Invalid, expired, or timed out session. Please login again." });
};

const verifyUserToken = makeVerify("userToken");
const verifyDoctorToken = makeVerify("doctorToken");
const verifyAdminToken = makeVerify("adminToken");
const verifyEmployeeAdminToken = makeVerify("employeeAdminToken");

const doctorOnly = (req, res, next) => {
  if (req.user?.role !== "doctor") {
    recordSecurityIncident(req, {
      type: "privilege_escalation",
      severity: "high",
      title: "Non-doctor attempted doctor-only access",
      resource: req.originalUrl,
      metadata: { requiredRole: "doctor", actualRole: req.user?.role || "anonymous" },
    });
    return res.status(403).json({ msg: "Access denied. Doctors only." });
  }
  next();
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin" && req.user?.role !== "superadmin") {
    recordSecurityIncident(req, {
      type: "unauthorized_access",
      severity: "high",
      title: "Non-admin attempted admin access",
      resource: req.originalUrl,
      metadata: { requiredRole: "admin", actualRole: req.user?.role || "anonymous" },
    });
    return res.status(403).json({ msg: "Access denied. Admins only." });
  }
  next();
};

const paymentAdminOnly = (req, res, next) => {
  if (!["superadmin", "paymentadmin"].includes(req.user?.role)) {
    recordSecurityIncident(req, {
      type: "unauthorized_access",
      severity: "high",
      title: "Non-payment-admin attempted payment-link access",
      resource: req.originalUrl,
      metadata: { requiredRole: "paymentadmin", actualRole: req.user?.role || "anonymous" },
    });
    return res.status(403).json({ msg: "Access denied. Payment admins only." });
  }
  next();
};

const employeeAdminOnly = (req, res, next) => {
  if (req.user?.role !== "employeeadmin") {
    recordSecurityIncident(req, {
      type: "unauthorized_access",
      severity: "high",
      title: "Non-employee-admin attempted employee-admin access",
      resource: req.originalUrl,
      metadata: { requiredRole: "employeeadmin", actualRole: req.user?.role || "anonymous" },
    });
    return res.status(403).json({ msg: "Access denied. Employee Admins only." });
  }
  next();
};

const superAdminOnly = (req, res, next) => {
  if (req.user?.role !== "superadmin") {
    recordSecurityIncident(req, {
      type: "privilege_escalation",
      severity: "critical",
      title: "Non-superadmin attempted superadmin access",
      resource: req.originalUrl,
      metadata: { requiredRole: "superadmin", actualRole: req.user?.role || "anonymous" },
    });
    return res.status(403).json({ msg: "Access denied. Super Admins only." });
  }
  next();
};

module.exports = {
  COOKIE_OPTS,
  REFRESH_COOKIE_OPTS,
  ACCESS_TOKEN_MS,
  REFRESH_TOKEN_MS,
  INACTIVITY_TIMEOUT_MS,
  ACCESS_COOKIE_BY_ROLE,
  REFRESH_COOKIE_BY_ROLE,
  issueAuthCookies,
  clearAuthCookies,
  signAccessToken,
  signRefreshToken,
  verifyToken,
  verifyUserToken,
  verifyDoctorToken,
  verifyAdminToken,
  verifyEmployeeAdminToken,
  doctorOnly,
  adminOnly,
  paymentAdminOnly,
  employeeAdminOnly,
  superAdminOnly,
};
