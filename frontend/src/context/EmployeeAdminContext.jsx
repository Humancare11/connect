import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api, { clearUserAuthToken } from "../api";
import { clearClientSession } from "../utils/session";

const EmployeeAdminContext = createContext(null);

export function EmployeeAdminProvider({ children }) {
  const [employeeAdmin, setEmployeeAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const path = window.location.pathname;
    const shouldCheckEmployeeAdmin =
      path === "/employee-admin-login" ||
      path.startsWith("/employee");

    if (!shouldCheckEmployeeAdmin) {
      setLoading(false);
      return;
    }

    api.get("/api/auth/employee-admin-me", { authRole: "employeeadmin", skipAuthRefresh: true })
      .then((res) => setEmployeeAdmin(res.data.user))
      .catch(() => setEmployeeAdmin(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback((userData) => setEmployeeAdmin(userData), []);

  const logout = useCallback(async () => {
    try { await api.post("/api/auth/employee-admin-logout", null, { authRole: "employeeadmin" }); } catch { /* ignore */ }
    clearUserAuthToken();
    clearClientSession();
    setEmployeeAdmin(null);
  }, []);

  return (
    <EmployeeAdminContext.Provider value={{ employeeAdmin, loading, login, logout }}>
      {children}
    </EmployeeAdminContext.Provider>
  );
}

export const useEmployeeAdmin = () => useContext(EmployeeAdminContext);
