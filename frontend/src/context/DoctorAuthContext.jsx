import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../api";

const DoctorAuthContext = createContext(null);

export function DoctorAuthProvider({ children }) {
  const [doctor,  setDoctor]  = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/doctor/me")
      .then(res => setDoctor(res.data.doctor))
      .catch(() => setDoctor(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback((doctorData) => setDoctor(doctorData), []);

  const logout = useCallback(async () => {
    try { await api.post("/api/doctor/logout"); } catch { /* ignore */ }
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
