import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../api";

const AdminContext = createContext(null);

export function AdminProvider({ children }) {
  const [admin,   setAdmin]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/auth/admin-me")
      .then(res => setAdmin(res.data.user))
      .catch(() => setAdmin(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback((adminData) => setAdmin(adminData), []);

  const logout = useCallback(async () => {
    try { await api.post("/api/auth/admin-logout"); } catch { /* ignore */ }
    setAdmin(null);
  }, []);

  return (
    <AdminContext.Provider value={{ admin, loading, login, logout }}>
      {children}
    </AdminContext.Provider>
  );
}

export const useAdmin = () => useContext(AdminContext);
