import { createContext, useContext, useState, useEffect } from "react";
import api from "../api";

const PricingContext = createContext(null);

export function PricingProvider({ children }) {
  const [prices, setPrices] = useState(null);

  useEffect(() => {
    api.get("/api/pricing").then((res) => setPrices(res.data)).catch(() => {});
  }, []);

  return (
    <PricingContext.Provider value={prices}>{children}</PricingContext.Provider>
  );
}

export function usePrices() {
  return useContext(PricingContext);
}
