import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api, { clearUserAuthToken } from "../api";
import { clearClientSession } from "../utils/session";

const PartnerContext = createContext(null);

export function PartnerProvider({ children }) {
  const [partnerUser, setPartnerUser] = useState(null);
  const [partner, setPartner] = useState(null); // the Partner Company
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const path = window.location.pathname;
    const shouldCheckPartner = path === "/partner-login" || path.startsWith("/partner");

    if (!shouldCheckPartner) {
      setLoading(false);
      return;
    }

    api
      .get("/api/auth/partner-me", { authRole: "partner", skipAuthRefresh: true })
      .then((res) => {
        setPartnerUser(res.data.user);
        setPartner(res.data.partner);
      })
      .catch(() => {
        setPartnerUser(null);
        setPartner(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback((userData, companyData) => {
    setPartnerUser(userData);
    setPartner(companyData || null);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/partner-logout", null, { authRole: "partner" });
    } catch {
      /* ignore */
    }
    clearUserAuthToken("partner");
    clearClientSession();
    setPartnerUser(null);
    setPartner(null);
  }, []);

  return (
    <PartnerContext.Provider value={{ partnerUser, partner, loading, login, logout }}>
      {children}
    </PartnerContext.Provider>
  );
}

export const usePartner = () => useContext(PartnerContext);
