export const SESSION_ACTIVITY_EVENT = "hc:session-activity";
export const SESSION_EXPIRED_EVENT = "hc:session-expired";

export const ROLE_TIMEOUT_MS = {
  admin: 30 * 60 * 1000,
  superadmin: 60 * 60 * 1000,
  doctor: 60 * 60 * 1000,
  user: 45 * 60 * 1000,
  employeeadmin: 30 * 60 * 1000,
  partner: 30 * 60 * 1000,
};

export const LOGOUT_PATH_BY_ROLE = {
  admin: "/adminauth",
  superadmin: "/adminauth",
  doctor: "/doctor-login",
  user: "/login",
  employeeadmin: "/employee-admin-login",
  partner: "/partner-login",
};

export function getActiveSessionRole({ admin, doctor, user }) {
  if (admin) {
    return admin.role === "superadmin" ? "superadmin" : "admin";
  }
  if (doctor) return "doctor";
  if (user) return "user";
  return null;
}

export function getLogoutRedirectPath(role) {
  return LOGOUT_PATH_BY_ROLE[role] || "/login";
}

// Live Chat theme (useLiveChatTheme) and sound (liveChatNotify) preferences.
const KEEP_ON_LOGOUT = ["hc-livechat-theme", "hcLiveChatSound"];

export function clearClientSession() {
  if (typeof window === "undefined") return;
  try {
    // Live Chat display preferences are not account or patient data: they survive a sign-out.
    const kept = KEEP_ON_LOGOUT.map((key) => [key, window.localStorage.getItem(key)]).filter(([, value]) => value !== null);
    window.localStorage.clear();
    window.sessionStorage.clear();
    kept.forEach(([key, value]) => window.localStorage.setItem(key, value));
  } catch (_err) {
    // ignore storage clearing failures
  }

  const cookieNames = [
    "userToken",
    "userRefreshToken",
    "doctorToken",
    "doctorRefreshToken",
    "adminToken",
    "adminRefreshToken",
    "employeeAdminToken",
    "employeeAdminRefreshToken",
    "partnerToken",
    "partnerRefreshToken",
  ];
  const expires = "Thu, 01 Jan 1970 00:00:00 GMT";

  cookieNames.forEach((name) => {
    document.cookie = `${name}=; path=/; expires=${expires};`;
    document.cookie = `${name}=; path=/; SameSite=None; Secure; expires=${expires};`;
  });
}

export function dispatchSessionActivity() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SESSION_ACTIVITY_EVENT));
}
