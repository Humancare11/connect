import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api, { clearUserAuthToken } from "../api";
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
      return;
    }

    api.get("/api/doctor/me", { authRole: "doctor", skipAuthRefresh: true })
      .then((res) => setDoctor(res.data.doctor))
      .catch(() => setDoctor(null))
      .finally(() => setLoading(false));

    // Hydrates the in-memory bearer token that DoctorLayout/VideoCall pass as
    // the explicit `token` field on socket events (user-online,
    // join-appointment-room) — otherwise empty for any session restored from
    // a cookie rather than the login form, which silently disables that
    // fallback and leaves socket auth resting entirely on the connection's
    // one-time cookie snapshot. Fire-and-forget: on failure, socket auth
    // falls back to that existing snapshot, unchanged from current behavior.
    api.post("/api/auth/refresh", null, { authRole: "doctor", skipAuthRefresh: true }).catch(() => {});
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
