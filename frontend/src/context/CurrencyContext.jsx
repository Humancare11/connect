// The currency this visitor is priced in. The server decides it (GET /api/geo/currency: the logged-in user's profile country,
// then the IP's country, else USD, and always USD while multi-currency is switched off); the browser only displays it.
//
// It is fetched once per session and again when the login state changes (login, logout, a changed profile country); the answer is
// remembered in sessionStorage so every page and component uses the same one. While a load is in flight `loading` is true and price
// slots show a skeleton, so the page never flashes "$" before "€". A failed request (including 429) is retried with backoff; only if
// the server stays unreachable does the visitor see the last known currency, or USD (source "error"), until it answers.
// See utils/currencyLoader.js.
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../api";
import { useAuth } from "./AuthContext";
import { createCurrencyLoader } from "../utils/currencyLoader";
import { DEFAULT_CURRENCY } from "../utils/currencyDisplay";

// Without a provider above (a page rendered on its own) the visitor is simply priced in USD and nothing waits for a currency.
const CurrencyContext = createContext({ currency: DEFAULT_CURRENCY, loading: false, source: "" });

const fetchCurrency = async () => {
  const res = await api.get("/api/geo/currency", { authRole: "user", skipAuthRefresh: true });
  return res.data;
};

// sessionStorage can throw (private window, blocked site data) or not exist (server render): then nothing is remembered.
const sessionStore = () => {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
};

export function CurrencyProvider({ children }) {
  const auth = useAuth();
  const authLoading = auth ? auth.loading : false;
  const user = auth ? auth.user : null;
  // Who the visitor is, as far as pricing goes: a different person or a different profile country can mean a different currency.
  const identity = `${user?._id || user?.id || ""}|${user?.country || ""}`;

  const [state, setState] = useState({ currency: DEFAULT_CURRENCY, loading: true, source: "" });

  useEffect(() => {
    if (authLoading) return undefined; // wait until we know whether someone is logged in
    const loader = createCurrencyLoader({ fetchCurrency, onChange: setState, storage: sessionStore(), identity });
    loader.load();
    return () => loader.dispose();
  }, [authLoading, identity]);

  const value = useMemo(() => state, [state]);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export const useSiteCurrency = () => useContext(CurrencyContext);
