import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api, { clearUserAuthToken } from "../api";
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
      return;
    }

    api.get("/api/auth/me", { authRole: "user", skipAuthRefresh: true })
      .then((res) => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));

    // Hydrates the in-memory bearer token that VideoCall passes as the
    // explicit `token` field on socket events (user-online,
    // join-appointment-room) — otherwise empty for any session restored from
    // a cookie rather than the login form, which silently disables that
    // fallback and leaves socket auth resting entirely on the connection's
    // one-time cookie snapshot. Fire-and-forget: on failure, socket auth
    // falls back to that existing snapshot, unchanged from current behavior.
    api.post("/api/auth/refresh", null, { authRole: "user", skipAuthRefresh: true }).catch(() => {});
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
