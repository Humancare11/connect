import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  withCredentials: true,
});

export function getTokenRole(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]))?.role || "";
  } catch {
    return "";
  }
}

function getTokenPayload(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

function isExpired(payload) {
  return payload?.exp && payload.exp * 1000 <= Date.now();
}

function getToken(...keys) {
  for (const key of keys) {
    const token = localStorage.getItem(key);
    if (!token) continue;

    const payload = getTokenPayload(token);
    if (!payload || isExpired(payload)) {
      localStorage.removeItem(key);
      continue;
    }

    return token;
  }
  return "";
}

function getTokenForRole(role, ...keys) {
  for (const key of keys) {
    const token = localStorage.getItem(key);
    if (!token) continue;

    const payload = getTokenPayload(token);
    if (!payload || isExpired(payload) || payload.role !== role) {
      localStorage.removeItem(key);
      continue;
    }

    return token;
  }
  return "";
}

export function getUserAuthToken() {
  return getTokenForRole("user", "userToken", "token");
}

function tokenForUrl(url = "") {
  const path = url.startsWith("http") ? new URL(url).pathname : url;

  if (
    path.startsWith("/api/payments") ||
    path.startsWith("/api/paypal") ||
    path.startsWith("/api/appointments") ||
    path.startsWith("/api/auth/me") ||
    path.startsWith("/api/auth/logout") ||
    path.startsWith("/api/auth/update-profile") ||
    path.startsWith("/api/auth/change-password")
  ) {
    return getUserAuthToken();
  }

  if (path.startsWith("/api/doctor")) {
    return getTokenForRole("doctor", "doctorToken", "token");
  }

  if (
    path.startsWith("/api/admin") ||
    path.startsWith("/api/superadmin") ||
    path.startsWith("/api/auth/admin")
  ) {
    return getTokenForRole("admin", "adminToken", "token") || getTokenForRole("superadmin", "adminToken", "token");
  }

  return getToken("userToken", "doctorToken", "adminToken", "token");
}

// Auto-attach token to every request.
// Do NOT override an Authorization header that was explicitly set by the caller
// (e.g. VideoCall sends doctorToken directly to avoid a stale userToken taking over).
api.interceptors.request.use((config) => {
  if (!config.headers?.Authorization) {
    const token = tokenForUrl(config.url);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─────────────────────────────────────────────────────────────────
// URL normalizer — rewrites any localhost / 127.0.0.1 file URLs
// that were stored in the database during local development.
// Runs transparently on every API response so no component changes
// are needed.  In local dev (VITE_API_URL is localhost) it's a no-op.
// ─────────────────────────────────────────────────────────────────
const _apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
const _isProduction = _apiBase.length > 0 && !/localhost|127\.0\.0\.1/.test(_apiBase);

function _deepNormalizeUrls(data) {
  if (!data) return data;
  if (typeof data === "string") {
    // Rewrite localhost file URLs to the production base
    if (data.startsWith("http://localhost") || data.startsWith("http://127.")) {
      try {
        const u = new URL(data);
        if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
          // Also fix /uploads/ → /api/uploads/ so the nginx /api/ proxy rule applies
          const pathname = u.pathname.startsWith("/uploads/")
            ? "/api" + u.pathname
            : u.pathname;
          return _apiBase + pathname + u.search + u.hash;
        }
      } catch {
        /* not a valid URL — leave as-is */
      }
      return data;
    }
    // Rewrite legacy /uploads/ → /api/uploads/ for URLs already stored in the database.
    // Nginx proxies /api/ to the backend but not /uploads/, so old stored URLs 404 in prod.
    if (_isProduction) {
      try {
        const u = new URL(data);
        const base = new URL(_apiBase);
        if (u.hostname === base.hostname && u.pathname.startsWith("/uploads/")) {
          u.pathname = "/api" + u.pathname;
          return u.toString();
        }
      } catch { /* not a valid URL */ }
    }
    return data;
  }
  if (Array.isArray(data)) return data.map(_deepNormalizeUrls);
  if (typeof data === "object") {
    // Avoid mutating the original; build a fresh object
    const out = {};
    for (const [k, v] of Object.entries(data)) {
      out[k] = _deepNormalizeUrls(v);
    }
    return out;
  }
  return data;
}

if (_isProduction) {
  api.interceptors.response.use((response) => {
    if (response.data) {
      response.data = _deepNormalizeUrls(response.data);
    }
    return response;
  });
}

/**
 * Normalise a single file URL for use in <img src> or <a href>.
 * Converts any http://localhost:PORT/... URL to the production base URL.
 * Safe to call in components — returns the original string unchanged
 * when already a production URL or when running locally.
 */
export function normalizeFileUrl(url) {
  if (!url || !_isProduction) return url;
  return _deepNormalizeUrls(url);
}

export default api;
