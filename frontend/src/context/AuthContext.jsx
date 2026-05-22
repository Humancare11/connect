import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: restore session from httpOnly cookie via /me endpoint.
  // The response now includes a fresh token so localStorage stays in sync
  // with the cookie — axios interceptors rely on localStorage for Bearer auth.
  useEffect(() => {
    api.get("/api/auth/me")
      .then(res => {
        if (res.data.token) {
          localStorage.setItem("userToken", res.data.token);
          localStorage.setItem("token", res.data.token);
        }
        setUser(res.data.user);
      })
      .catch(() => {
        localStorage.removeItem("userToken");
        localStorage.removeItem("token");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback((userData) => setUser(userData), []);

  const logout = useCallback(async () => {
    try { await api.post("/api/auth/logout"); } catch { /* ignore */ }
    localStorage.removeItem("userToken");
    localStorage.removeItem("token");
    setUser(null);
  }, []);

  // Called after profile update so UI reflects new data immediately
  const updateUser = useCallback((userData) => setUser(userData), []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
