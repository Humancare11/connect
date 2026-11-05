// The currency this visitor is priced in. The server decides it from the visitor's IP location (GET /api/geo/currency: the IP's
// country, USD when it is unknown, and always USD while multi-currency is switched off), logged in or not - the profile country plays no
// part; the browser only displays it.
//
// It is fetched once per page load (logging in or out changes nothing: the IP is the same); the answer is
// remembered in sessionStorage so every page and component uses the same one. While a load is in flight `loading` is true and price
// slots show a skeleton, so the page never flashes "$" before "€". A failed request (including 429) is retried with backoff; only if
// the server stays unreachable does the visitor see the last known currency, or USD (source "error"), until it answers.
// The visitor's IP can change while the tab stays open, so the answer is also re-checked during the session: on a route change
// (CurrencyRouteWatcher), when the tab becomes visible again (both throttled) and, unthrottled, by the payment step right before it
// creates an intent or an order (recheck({ force: true })). When the currency changes, every price follows it and a small notice says so.
// See utils/currencyLoader.js.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../api";
import { createCurrencyLoader } from "../utils/currencyLoader";
import { DEFAULT_CURRENCY, currencyChangeNotice } from "../utils/currencyDisplay";

// Without a provider above (a page rendered on its own) the visitor is simply priced in USD and nothing waits for a currency.
const noRecheck = async () => ({ changed: false, currency: DEFAULT_CURRENCY, ok: false, skipped: true });
const CurrencyContext = createContext({ currency: DEFAULT_CURRENCY, loading: false, source: "", recheck: noRecheck });

const NOTICE_MS = 8000;

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
  const [notice, setNotice] = useState("");
  const loaderRef = useRef(null);

  useEffect(() => {
    // Nothing about the visitor's login can change the currency, so there is nothing to wait for or to reload on.
    const onCurrencyChanged = ({ to }) => setNotice(currencyChangeNotice(to));
    const loader = createCurrencyLoader({ fetchCurrency, onChange: setState, storage: sessionStore(), identity: CURRENCY_IDENTITY, onCurrencyChanged });
    loaderRef.current = loader;
    loader.load();
    // Back on this tab after a while (maybe on another network now): ask again.
    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") loader.recheck();
    };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisible);
      loaderRef.current = null;
      loader.dispose();
    };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  // Stable: pages call it from effects and handlers. Never rejects; a failed re-check leaves the currency as it was.
  const recheck = useCallback((options) => (loaderRef.current ? loaderRef.current.recheck(options) : noRecheck()), []);

  const value = useMemo(() => ({ ...state, recheck }), [state, recheck]);
  return (
    <CurrencyContext.Provider value={value}>
      {children}
      {notice && (
        <div
          role="status"
          aria-live="polite"
          data-testid="currency-change-notice"
          style={{
            position: "fixed",
            left: "50%",
            bottom: 20,
            transform: "translateX(-50%)",
            zIndex: 10000,
            maxWidth: "calc(100vw - 32px)",
            padding: "10px 16px",
            borderRadius: 8,
            background: "#12263f",
            color: "#fff",
            fontSize: 14,
            lineHeight: 1.4,
            boxShadow: "0 4px 16px rgba(0,0,0,.25)",
          }}
        >
          {notice}
        </div>
      )}
    </CurrencyContext.Provider>
  );
}

export const useSiteCurrency = () => useContext(CurrencyContext);

// Rendered once inside the router: every route change re-checks the currency (the loader throttles it to once per 20 s).
export function CurrencyRouteWatcher() {
  const { recheck } = useSiteCurrency();
  const { pathname } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false; // the page load itself has just asked
      return;
    }
    recheck();
  }, [pathname, recheck]);
  return null;
}
