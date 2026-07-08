import { createContext, useCallback, useContext, useState, useEffect } from "react";
import api from "../api";

const PricingContext = createContext(null);
const PricingMetaContext = createContext({ loading: true, error: null });

export function PricingProvider({ children }) {
  const [prices, setPrices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPrices = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get("/api/pricing");
      setPrices(res.data);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  useEffect(() => {
    const refresh = () => fetchPrices({ silent: true });
    const intervalId = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refresh);
    };
  }, [fetchPrices]);

  return (
    <PricingMetaContext.Provider value={{ loading, error, refresh: fetchPrices }}>
      <PricingContext.Provider value={prices}>{children}</PricingContext.Provider>
    </PricingMetaContext.Provider>
  );
}

export function usePrices() {
  return useContext(PricingContext);
}

export function usePricingMeta() {
  return useContext(PricingMetaContext);
}
