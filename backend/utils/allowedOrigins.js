// The origins the API, Socket.IO and the S3 bucket CORS rule accept.
//
// Built-in sites are always allowed. The localhost entries are for development and UAT only:
// in production they are removed, wherever they come from (the built-in list or the
// FRONTEND_URL / CORS_ALLOWED_ORIGINS environment values).
// https://uat.humancareconnect.co stays for now, until the UAT and production S3 buckets are
// confirmed to be separate.

const BUILT_IN = ["https://humancareconnect.co", "https://www.humancareconnect.co", "https://uat.humancareconnect.co"];
const DEV_ONLY = ["http://localhost:5173", "http://localhost:3000"];

function normalizeOrigin(value) {
  const origin = String(value || "").trim().replace(/\/+$/, "");
  if (!origin) return "";
  try {
    return new URL(origin).origin;
  } catch {
    return origin;
  }
}

function parseOriginList(value) {
  return String(value || "").split(",").map(normalizeOrigin).filter(Boolean);
}

function isLocalOrigin(origin) {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
  }
}

function buildAllowedOrigins({ env = process.env, nodeEnv = process.env.NODE_ENV } = {}) {
  const all = [
    ...parseOriginList(env.FRONTEND_URL),
    ...parseOriginList(env.CORS_ALLOWED_ORIGINS),
    ...BUILT_IN,
    ...DEV_ONLY,
  ].filter(Boolean);
  const list = nodeEnv === "production" ? all.filter((o) => !isLocalOrigin(o)) : all;
  return Array.from(new Set(list));
}

module.exports = { buildAllowedOrigins, normalizeOrigin, parseOriginList, isLocalOrigin };
