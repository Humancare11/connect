// The currency this visitor is priced in. The server decides it from the visitor's IP location (GET /api/geo/currency: the IP's
// country, USD when it is unknown, and always USD while multi-currency is switched off), logged in or not - the profile country plays no
// part; the browser only displays it.
//
// It is fetched once per page load (logging in or out changes nothing: the IP is the same); the answer is
// remembered in sessionStorage so every page and component uses the same one. While a load is in flight `loading` is true and price
// slots show a skeleton, so the page never flashes "$" before "€". A failed request (including 429) is retried with backoff; only if
// the server stays unreachable does the visitor see the last known currency, or USD (source "error"), until it answers.
// See utils/currencyLoader.js.
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../api";
import { createCurrencyLoader } from "../utils/currencyLoader";
import { DEFAULT_CURRENCY } from "../utils/currencyDisplay";

// Without a provider above (a page rendered on its own) the visitor is simply priced in USD and nothing waits for a currency.
const CurrencyContext = createContext({ currency: DEFAULT_CURRENCY, loading: false, source: "" });

// The remembered currency belongs to the browser session and its IP, not to a person: one fixed key, whoever logs in or out.
const CURRENCY_IDENTITY = "ip";

const fetchCurrency = async () => {
  const res = await api.get("/api/geo/currency", { skipAuthRefresh: true });
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
  const [state, setState] = useState({ currency: DEFAULT_CURRENCY, loading: true, source: "" });

  useEffect(() => {
    // Nothing about the visitor's login can change the currency, so there is nothing to wait for or to reload on.
    const loader = createCurrencyLoader({ fetchCurrency, onChange: setState, storage: sessionStore(), identity: CURRENCY_IDENTITY });
    loader.load();
    return () => loader.dispose();
  }, []);

  const value = useMemo(() => state, [state]);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export const useSiteCurrency = () => useContext(CurrencyContext);
