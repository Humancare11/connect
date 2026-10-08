import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api, { clearUserAuthToken, setActiveAuthRole } from "../api";
import { clearClientSession } from "../utils/session";

const AdminContext = createContext(null);

export function AdminProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const path = window.location.pathname;
    const shouldCheckAdmin =
      path === "/adminauth" ||
      path === "/payment-admin-login" ||
      path.startsWith("/admin") ||
      path.startsWith("/superadmin") ||
      path.startsWith("/payment-admin");

    if (!shouldCheckAdmin) {
      setLoading(false);
      return undefined;
    }

    // Declared before any request fires — see setActiveAuthRole's own
    // comment in api.js.
    setActiveAuthRole("admin");

    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/api/auth/admin-me", { authRole: "admin", skipAuthRefresh: true });
        if (!cancelled) setAdmin(res.data.user);
      } catch {
        // A stale/expired access token 401s here — unlike AuthContext/
        // DoctorAuthContext, this previously had no refresh fallback at
        // all, so an admin whose access token expired (15 min) while their
        // refresh cookie (8h) was still valid stayed permanently logged out
        // until they manually re-authenticated. Try one explicit refresh
        // and re-check before concluding there's no session.
        try {
          await api.post("/api/auth/refresh", null, { authRole: "admin", skipAuthRefresh: true });
          const res = await api.get("/api/auth/admin-me", { authRole: "admin", skipAuthRefresh: true });
          if (!cancelled) setAdmin(res.data.user);
        } catch {
          if (!cancelled) setAdmin(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback((adminData) => setAdmin(adminData), []);

  const logout = useCallback(async () => {
    try { await api.post("/api/auth/admin-logout", null, { authRole: "admin" }); } catch { /* ignore */ }
    clearUserAuthToken();
    clearClientSession();
    setAdmin(null);
  }, []);

  return (
    <AdminContext.Provider value={{ admin, loading, login, logout }}>
      {children}
    </AdminContext.Provider>
  );
}

export const useAdmin = () => useContext(AdminContext);
