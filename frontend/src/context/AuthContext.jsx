import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api, { clearUserAuthToken, setActiveAuthRole } from "../api";
import { clearClientSession } from "../utils/session";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const path = window.location.pathname;
    const shouldCheckUser =
      path.startsWith("/user") ||
      path.startsWith("/appointment") ||
      path.startsWith("/medical") ||
      path.startsWith("/patient") ||
      path.startsWith("/video-call");

    if (!shouldCheckUser) {
      setLoading(false);
      return undefined;
    }

    // Declared before any request fires — a page's own data fetch, racing
    // this same effect, would otherwise see no role to attribute a 401
    // retry to yet (see setActiveAuthRole's own comment in api.js).
    setActiveAuthRole("user");

    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/api/auth/me", { authRole: "user", skipAuthRefresh: true });
        if (!cancelled) setUser(res.data.user);
      } catch {
        // A stale/expired access token 401s here — skipAuthRefresh keeps
        // this specific call from looping through the reactive interceptor,
        // so try one explicit refresh (the still-valid refresh cookie is
        // enough on its own) and re-check before concluding there's no
        // session. Also hydrates the in-memory bearer token VideoCall
        // passes as the explicit `token` field on socket events — otherwise
        // empty for any session restored from a cookie rather than the
        // login form.
        try {
          await api.post("/api/auth/refresh", null, { authRole: "user", skipAuthRefresh: true });
          const res = await api.get("/api/auth/me", { authRole: "user", skipAuthRefresh: true });
          if (!cancelled) setUser(res.data.user);
        } catch {
          if (!cancelled) setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback((userData) => setUser(userData), []);

  const logout = useCallback(async () => {
    try { await api.post("/api/auth/logout", null, { authRole: "user" }); } catch { /* ignore */ }
    clearUserAuthToken();
    clearClientSession();
    setUser(null);
  }, []);

  const updateUser = useCallback((userData) => setUser(userData), []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
