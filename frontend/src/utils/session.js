export const SESSION_ACTIVITY_EVENT = "hc:session-activity";
export const SESSION_EXPIRED_EVENT = "hc:session-expired";

export const ROLE_TIMEOUT_MS = {
  admin: 30 * 60 * 1000,
  superadmin: 60 * 60 * 1000,
  doctor: 60 * 60 * 1000,
  user: 45 * 60 * 1000,
  employeeadmin: 30 * 60 * 1000,
};

export const LOGOUT_PATH_BY_ROLE = {
  admin: "/adminauth",
  superadmin: "/adminauth",
  doctor: "/doctor-login",
  user: "/login",
  employeeadmin: "/employee-admin-login",
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

export function clearClientSession() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.clear();
    window.sessionStorage.clear();
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
