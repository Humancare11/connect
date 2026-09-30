import axios from "axios";
import { dispatchSessionActivity, SESSION_EXPIRED_EVENT } from "./utils/session";

// URLs that must never trigger the reactive refresh-and-retry flow below:
// the refresh call itself (obviously), and every login/OAuth endpoint —
// none of those represent an existing authenticated session that could be
// refreshed, a 401/400 there just means bad credentials. Covers
// /api/auth/login, /api/doctor/login, every "*-login" endpoint
// (admin-login, payment-admin-login, employee-admin-login, partner-login,
// doctor-login), and /api/auth/google(-doctor).
const AUTH_BOOTSTRAP_URL_RE = /\/api\/(auth\/refresh|auth\/login|doctor\/login|auth\/[a-z-]*-login|auth\/google(-doctor)?)\b/;

const AUTH_ROLES = new Set(["user", "doctor", "admin", "superadmin", "paymentadmin", "employeeadmin", "partner"]);
const TOKEN_ROLE_ALIASES = {
  superadmin: "admin",
  paymentadmin: "admin",
};
const authTokens = {
  user: { accessToken: "", refreshToken: "" },
  doctor: { accessToken: "", refreshToken: "" },
  admin: { accessToken: "", refreshToken: "" },
  employeeadmin: { accessToken: "", refreshToken: "" },
  partner: { accessToken: "", refreshToken: "" },
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

  if (value.startsWith("/api/auth/partner")) return "partner";
  // NOTE: must stay above the generic /api/admin check below so that
  // /api/admin/partner-cases still resolves to "admin", not "partner".
  if (value.startsWith("/api/partner")) return "partner";

  if (
    value.startsWith("/api/admin") ||
    value.startsWith("/api/superadmin") ||
    value.startsWith("/api/auth/admin") ||
    value.startsWith("/api/auth/payment-admin") ||
    value.startsWith("/api/payments/admin") ||
    value.startsWith("/api/pricing") ||
    value.startsWith("/api/services")
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

// Declares which role this page is authenticating as, WITHOUT touching its
// tokens — call this synchronously at the top of a protected page/context's
// mount effect, before any API request fires. Closes a real race: on a cold
// load with an already-expired access token, activeAuthRole starts "" and
// only used to get set as a side effect of a successful token-bearing
// response — so any request that fires before that first response resolves
// (e.g. a page's own data fetch, running in parallel with its auth
// context's own /api/auth/me check) can't infer its role from
// inferAuthRoleFromUrl, 401s, and its own reactive refresh attempt then has
// no role to key a retry on either.
export function setActiveAuthRole(role = "") {
  const normalizedRole = normalizeAuthRole(role);
  if (normalizedRole) activeAuthRole = normalizedRole;
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
      !AUTH_BOOTSTRAP_URL_RE.test(url)
    ) {
      // The role this failing request was actually made as — this is the
      // ONLY source of truth for which session to refresh and which bucket
      // to store the new tokens under. Never re-derive it from the refresh
      // response afterward: buildTokenPayload() on the backend returns just
      // {accessToken, refreshToken}, no role field, so re-inferring from
      // that response was silently storing refreshed tokens under an empty
      // role key (a no-op) whenever the ORIGINAL request's role couldn't be
      // read off its URL — the refresh looked successful (200 from the
      // server) but the app never actually picked up the new token.
      const role = normalizeAuthRole(original.authRole || inferAuthRoleFromUrl(url));
      if (!role) return Promise.reject(error);

      original._retry = true;
      if (!refreshPromisesByRole.has(role)) {
        refreshPromisesByRole.set(
          role,
          api
            .post("/api/auth/refresh", null, { authRole: role, skipAuthRefresh: true })
            .then((res) => {
              setAuthTokenForRole(role, res.data?.accessToken, res.data?.refreshToken);
              return res;
            })
            .finally(() => refreshPromisesByRole.delete(role)),
        );
      }
      try {
        await refreshPromisesByRole.get(role);
        return api(original);
      } catch {
        clearAuthTokenForRole(role);
        window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { role } }));
      }
    }

    return Promise.reject(error);
  }
);

const _apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
const UPLOAD_URL_RE = /^(https?:\/\/[^/]+)\/(?:api\/)?(uploads\/.+)$/;
const UPLOAD_PATH_RE = /^\/(?:api\/)?(uploads\/.+)$/;
const STRUCTURED_UPLOAD_KEY_RE = /^(uploads|doctors|patients|employee-tasks)\/.+$/;
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
