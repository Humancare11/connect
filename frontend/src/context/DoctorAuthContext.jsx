import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api, { clearUserAuthToken, setActiveAuthRole } from "../api";
import { clearClientSession } from "../utils/session";

const DoctorAuthContext = createContext(null);

export function DoctorAuthProvider({ children }) {
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const path = window.location.pathname;
    const shouldCheckDoctor =
      path === "/doctor-login" ||
      path.startsWith("/doctor-dashboard") ||
      path.startsWith("/video-call");

    if (!shouldCheckDoctor) {
      setLoading(false);
      return undefined;
    }

    // Declared before any request fires — see setActiveAuthRole's own
    // comment in api.js.
    setActiveAuthRole("doctor");

    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/api/doctor/me", { authRole: "doctor", skipAuthRefresh: true });
        if (!cancelled) setDoctor(res.data.doctor);
      } catch {
        // A stale/expired access token 401s here — skipAuthRefresh keeps
        // this specific call from looping through the reactive interceptor,
        // so try one explicit refresh (the still-valid refresh cookie is
        // enough on its own) and re-check before concluding there's no
        // session. Also hydrates the in-memory bearer token DoctorLayout/
        // VideoCall pass as the explicit `token` field on socket events —
        // otherwise empty for any session restored from a cookie rather
        // than the login form.
        try {
          await api.post("/api/auth/refresh", null, { authRole: "doctor", skipAuthRefresh: true });
          const res = await api.get("/api/doctor/me", { authRole: "doctor", skipAuthRefresh: true });
          if (!cancelled) setDoctor(res.data.doctor);
        } catch {
          if (!cancelled) setDoctor(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback((doctorData) => setDoctor(doctorData), []);

  const logout = useCallback(async () => {
    try { await api.post("/api/doctor/logout", null, { authRole: "doctor" }); } catch { /* ignore */ }
    clearUserAuthToken();
    clearClientSession();
    setDoctor(null);
  }, []);

  const updateDoctor = useCallback((doctorData) => setDoctor(doctorData), []);

  return (
    <DoctorAuthContext.Provider value={{ doctor, loading, login, logout, updateDoctor }}>
      {children}
    </DoctorAuthContext.Provider>
  );
}

export const useDoctorAuth = () => useContext(DoctorAuthContext);
