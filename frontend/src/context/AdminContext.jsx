import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../api";

const AdminContext = createContext(null);

export function AdminProvider({ children }) {
  const [admin,   setAdmin]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("adminToken") || localStorage.getItem("token");
    let role = "";
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        role = payload?.role || "";
      } catch {
        role = "";
      }
    }

    if (!["admin", "superadmin"].includes(role)) {
      setAdmin(null);
      setLoading(false);
      return;
    }

    api.get("/api/auth/admin-me")
      .then(res => setAdmin(res.data.user))
      .catch(() => setAdmin(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback((adminData) => setAdmin(adminData), []);

  const logout = useCallback(async () => {
    try { await api.post("/api/auth/admin-logout"); } catch { /* ignore */ }
    localStorage.removeItem("adminToken");
    localStorage.removeItem("token");
    setAdmin(null);
  }, []);

  return (
    <AdminContext.Provider value={{ admin, loading, login, logout }}>
      {children}
    </AdminContext.Provider>
  );
}

export const useAdmin = () => useContext(AdminContext);
