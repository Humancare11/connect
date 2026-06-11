import axios from "axios";
import { dispatchSessionActivity } from "./utils/session";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  dispatchSessionActivity();
  return config;
});

let refreshPromise = null;

api.interceptors.response.use(
  (response) => {
    if (response.data) response.data = _deepNormalizeUrls(response.data);
    return response;
  },
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const url = original?.url || "";

    if (status === 401 && original && !original._retry && !url.includes("/api/auth/refresh")) {
      original._retry = true;
      refreshPromise ||= api.post("/api/auth/refresh").finally(() => {
        refreshPromise = null;
      });
      try {
        await refreshPromise;
        return api(original);
      } catch {
        window.dispatchEvent(new CustomEvent("hc:session-expired"));
      }
    }

    return Promise.reject(error);
  }
);

export function getUserAuthToken() {
  return "";
}

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
