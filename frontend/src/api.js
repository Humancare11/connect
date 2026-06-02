import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  withCredentials: true,
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

const _apiBase = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");
const UPLOAD_URL_RE = /^(https?:\/\/[^/]+)\/(?:api\/)?(uploads\/.+)$/;
const UPLOAD_PATH_RE = /^\/(?:api\/)?(uploads\/.+)$/;

function _deepNormalizeUrls(data) {
  if (!data) return data;
  if (typeof data === "string") {
    const m = UPLOAD_URL_RE.exec(data) || UPLOAD_PATH_RE.exec(data);
    if (m) return `${_apiBase}/api/${m[m.length - 1]}`;
    return data;
  }
  if (Array.isArray(data)) return data.map(_deepNormalizeUrls);
  if (typeof data === "object") {
    const out = {};
    for (const [k, v] of Object.entries(data)) out[k] = _deepNormalizeUrls(v);
    return out;
  }
  return data;
}

export function normalizeFileUrl(url) {
  return _deepNormalizeUrls(url);
}

export default api;
