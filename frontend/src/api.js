import axios from "axios";
import { dispatchSessionActivity } from "./utils/session";

const AUTH_ROLES = new Set(["user", "doctor", "admin", "superadmin", "paymentadmin", "employeeadmin"]);
const TOKEN_ROLE_ALIASES = {
  superadmin: "admin",
  paymentadmin: "admin",
};
const authTokens = {
  user: { accessToken: "", refreshToken: "" },
  doctor: { accessToken: "", refreshToken: "" },
  admin: { accessToken: "", refreshToken: "" },
  employeeadmin: { accessToken: "", refreshToken: "" },
};
let activeAuthRole = "";

const normalizeAuthRole = (role = "") => {
  const value = String(role || "").toLowerCase();
  return TOKEN_ROLE_ALIASES[value] || value;
};

const inferAuthRoleFromUrl = (url = "") => {
  const value = String(url || "");

  if (value.startsWith("/api/doctor")) return "doctor";
  if (value.startsWith("/api/notes")) return "doctor";
  if (value.startsWith("/api/appointments/doctor")) return "doctor";
  if (/^\/api\/appointments\/[^/]+\/(confirm|complete|cancel)\b/.test(value)) return "doctor";
  if (value.startsWith("/api/auth/google-doctor")) return "doctor";

  if (value.startsWith("/api/appointments/patient")) return "user";
  if (value.startsWith("/api/auth/me")) return "user";
  if (value.startsWith("/api/auth/logout")) return "user";
  if (value.startsWith("/api/auth/login") || value.startsWith("/api/auth/google")) return "user";

  if (value.startsWith("/api/auth/employee-admin")) return "employeeadmin";
  if (value.startsWith("/api/employee-admin")) return "employeeadmin";

  if (
    value.startsWith("/api/admin") ||
    value.startsWith("/api/superadmin") ||
    value.startsWith("/api/auth/admin") ||
    value.startsWith("/api/auth/payment-admin") ||
    value.startsWith("/api/payments/admin") ||
    value.startsWith("/api/pricing")
  ) {
    return "admin";
  }

  if (value.startsWith("/api/auth/refresh")) return activeAuthRole;
  return activeAuthRole;
};

const getRoleTokens = (role = "") => authTokens[normalizeAuthRole(role)] || null;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  withCredentials: true,
});

export function setAuthTokenForRole(role = "user", nextAccessToken = "", nextRefreshToken = "") {
  const normalizedRole = normalizeAuthRole(role);
  const tokens = getRoleTokens(normalizedRole);
  if (!tokens) return;

  tokens.accessToken = nextAccessToken || "";
  tokens.refreshToken = nextRefreshToken || "";
  activeAuthRole = normalizedRole;
}

export function setUserAuthToken(nextAccessToken = "", nextRefreshToken = "", role = "user") {
  setAuthTokenForRole(role, nextAccessToken, nextRefreshToken);
}

export function clearAuthTokenForRole(role = "") {
  const normalizedRole = normalizeAuthRole(role);
  if (!normalizedRole) {
    Object.values(authTokens).forEach((tokens) => {
      tokens.accessToken = "";
      tokens.refreshToken = "";
    });
    activeAuthRole = "";
    return;
  }

  const tokens = getRoleTokens(normalizedRole);
  if (!tokens) return;
  tokens.accessToken = "";
  tokens.refreshToken = "";
  if (activeAuthRole === normalizedRole) activeAuthRole = "";
}

export function clearUserAuthToken(role = "") {
  clearAuthTokenForRole(role);
}

export function getUserAuthToken(role = activeAuthRole || "user") {
  return getRoleTokens(role)?.accessToken || "";
}

api.interceptors.request.use((config) => {
  dispatchSessionActivity();
  const url = config.url || "";
  const role = normalizeAuthRole(config.authRole || inferAuthRoleFromUrl(url));
  const tokens = getRoleTokens(role);
  const token = url.includes("/api/auth/refresh") ? tokens?.refreshToken : tokens?.accessToken;
  config.headers = config.headers || {};
  if (role && AUTH_ROLES.has(role)) {
    config.headers["X-Auth-Role"] = role;
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }
  return config;
});

const refreshPromisesByRole = new Map();

api.interceptors.response.use(
  (response) => {
    if (response.data?.accessToken) {
      const role =
        normalizeAuthRole(response.data.role || response.data.user?.role || response.data.doctor && "doctor") ||
        normalizeAuthRole(response.config?.authRole || inferAuthRoleFromUrl(response.config?.url || ""));
      const currentRefreshToken = getRoleTokens(role)?.refreshToken || "";
      setAuthTokenForRole(role, response.data.accessToken, response.data.refreshToken || currentRefreshToken);
    }
    if (response.data) response.data = _deepNormalizeUrls(response.data);
    return response;
  },
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const url = original?.url || "";

    if (
      status === 401 &&
      original &&
      !original._retry &&
      !original.skipAuthRefresh &&
      !url.includes("/api/auth/refresh")
    ) {
      original._retry = true;
      const role = normalizeAuthRole(original.authRole || inferAuthRoleFromUrl(url));
      const refreshKey = role || "default";
      if (!refreshPromisesByRole.has(refreshKey)) {
        refreshPromisesByRole.set(
          refreshKey,
          api.post("/api/auth/refresh", null, { authRole: role }).finally(() => {
            refreshPromisesByRole.delete(refreshKey);
          })
        );
      }
      try {
        await refreshPromisesByRole.get(refreshKey);
        return api(original);
      } catch {
        clearAuthTokenForRole(role);
        window.dispatchEvent(new CustomEvent("hc:session-expired"));
      }
    }

    return Promise.reject(error);
  }
);

const _apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
const UPLOAD_URL_RE = /^(https?:\/\/[^/]+)\/(?:api\/)?(uploads\/.+)$/;
const UPLOAD_PATH_RE = /^\/(?:api\/)?(uploads\/.+)$/;
const STRUCTURED_UPLOAD_KEY_RE = /^(uploads|doctors|patients)\/.+$/;
const RAW_UPLOAD_KEY_FIELDS = new Set(["key", "storageKey"]);
const _apiOrigin = (() => {
  try { return new URL(_apiBase).origin; } catch { return ""; }
})();

function _deepNormalizeUrls(data, fieldName = "") {
  if (!data) return data;
  if (typeof data === "string") {
    if (RAW_UPLOAD_KEY_FIELDS.has(fieldName)) return data;
    if (STRUCTURED_UPLOAD_KEY_RE.test(data)) return `${_apiBase}/api/uploads/${data}`;

    const pathMatch = UPLOAD_PATH_RE.exec(data);
    if (pathMatch) return `${_apiBase}/api/${pathMatch[pathMatch.length - 1]}`;

    const urlMatch = UPLOAD_URL_RE.exec(data);
    if (urlMatch) {
      try {
        if (new URL(data).origin === _apiOrigin) return `${_apiBase}/api/${urlMatch[urlMatch.length - 1]}`;
      } catch { /* keep original value */ }
    }
    return data;
  }
  if (Array.isArray(data)) return data.map((item) => _deepNormalizeUrls(item, fieldName));
  if (typeof data === "object") {
    const out = {};
    for (const [k, v] of Object.entries(data)) out[k] = _deepNormalizeUrls(v, k);
    return out;
  }
  return data;
}

export function normalizeFileUrl(url) {
  return _deepNormalizeUrls(url);
}

export default api;
