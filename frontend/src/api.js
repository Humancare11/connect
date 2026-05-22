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

export default api;
