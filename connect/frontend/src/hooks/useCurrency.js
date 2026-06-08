import { useState, useEffect } from "react";

const FALLBACK_RATES = {
  USD: 1,      EUR: 0.92,   GBP: 0.79,   INR: 83.5,   AUD: 1.54,
  CAD: 1.36,   AED: 3.67,   SAR: 3.75,   SGD: 1.35,   JPY: 149,
  CNY: 7.24,   KRW: 1330,   CHF: 0.90,   SEK: 10.4,   NOK: 10.6,
  DKK: 6.88,   MXN: 17.2,   BRL: 4.97,   ZAR: 18.6,   NGN: 1550,
  KES: 129,    PKR: 278,    BDT: 110,    LKR: 305,    MYR: 4.72,
  THB: 35.1,   PHP: 56.4,   IDR: 15700,  VND: 24350,  HKD: 7.82,
  TWD: 31.8,   NZD: 1.63,   ILS: 3.72,   EGP: 30.9,   QAR: 3.64,
  KWD: 0.307,  BHD: 0.377,  OMR: 0.385,  MAD: 10.0,
};

const WHOLE_NUMBER_CURRENCIES = new Set(["JPY", "KRW", "IDR", "VND"]);

const SYMBOLS = {
  USD: "$",    EUR: "€",    GBP: "£",    INR: "₹",    AUD: "A$",
  CAD: "C$",   AED: "AED ", SAR: "SAR ", SGD: "S$",   JPY: "¥",
  CNY: "¥",    KRW: "₩",    CHF: "CHF ", SEK: "kr",   NOK: "kr",
  DKK: "kr",   MXN: "MX$",  BRL: "R$",   ZAR: "R",    NGN: "₦",
  KES: "KSh ", PKR: "₨",    BDT: "৳",    LKR: "Rs ",  MYR: "RM ",
  THB: "฿",    PHP: "₱",    IDR: "Rp ",  VND: "₫",    HKD: "HK$",
  TWD: "NT$",  NZD: "NZ$",  ILS: "₪",    EGP: "E£",   QAR: "QR ",
  KWD: "KD ",  BHD: "BD ",  OMR: "OMR ", MAD: "MAD ",
};

const COUNTRY_TO_CURRENCY = {
  US: "USD", GB: "GBP", IN: "INR", AU: "AUD", CA: "CAD",
  AE: "AED", SA: "SAR", SG: "SGD", JP: "JPY", DE: "EUR",
  FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", BE: "EUR",
  PT: "EUR", AT: "EUR", FI: "EUR", IE: "EUR", GR: "EUR",
  CH: "CHF", CN: "CNY", KR: "KRW", MX: "MXN", BR: "BRL",
  ZA: "ZAR", NG: "NGN", KE: "KES", PK: "PKR", BD: "BDT",
  LK: "LKR", MY: "MYR", TH: "THB", PH: "PHP", ID: "IDR",
  VN: "VND", HK: "HKD", TW: "TWD", NZ: "NZD", IL: "ILS",
  EG: "EGP", QA: "QAR", KW: "KWD", MA: "MAD", OM: "OMR",
  BH: "BHD", SE: "SEK", NO: "NOK", DK: "DKK",
};

// Try three independent geo APIs in sequence; return ISO currency code or null.
async function detectCurrencyFromIP() {
  // API 1: api.country.is — minimal, no key, very high limits, CORS-safe
  try {
    const res  = await fetch("https://api.country.is/", { signal: AbortSignal.timeout(4000) });
    const data = await res.json();
    const code = COUNTRY_TO_CURRENCY[data?.country?.toUpperCase()];
    if (code) return code;
  } catch {}

  // API 2: ipwho.is — returns currency.code directly
  try {
    const res  = await fetch("https://ipwho.is/", { signal: AbortSignal.timeout(4000) });
    const data = await res.json();
    const code = data?.currency?.code?.toUpperCase();
    if (code && FALLBACK_RATES[code]) return code;
    const byCountry = COUNTRY_TO_CURRENCY[data?.country_code?.toUpperCase()];
    if (byCountry) return byCountry;
  } catch {}

  // API 3: ipapi.co full JSON (more reliable than the plain-text /currency/ endpoint)
  try {
    const res  = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    const code = data?.currency?.toUpperCase();
    if (code && FALLBACK_RATES[code]) return code;
  } catch {}

  return null; // all failed — caller stays on "USD"
}

export function useCurrency() {
  // Default to USD; IP detection updates this once resolved
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [rates, setRates] = useState(FALLBACK_RATES);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // ── 1. Live exchange rates (no localStorage, fetched fresh each session) ─
      try {
        const res  = await fetch("https://open.er-api.com/v6/latest/USD");
        const data = await res.json();
        if (data.result === "success" && data.rates && !cancelled) {
          setRates({ ...FALLBACK_RATES, ...data.rates });
        }
      } catch { /* keep FALLBACK_RATES */ }

      // ── 2. IP-based currency detection (no localStorage) ────────────────────
      const detected = await detectCurrencyFromIP();
      if (detected && !cancelled) setCurrencyCode(detected);
    };

    run();
    return () => { cancelled = true; };
  }, []);

  const formatPrice = (amount, fromCurrency = "USD") => {
    if (!amount || amount <= 0) return "—";
    const fromRate  = rates[fromCurrency] ?? 1;
    const toRate    = rates[currencyCode] ?? 1;
    const converted = (amount / fromRate) * toRate;
    const symbol    = SYMBOLS[currencyCode] ?? `${currencyCode} `;
    const rounded   = WHOLE_NUMBER_CURRENCIES.has(currencyCode)
      ? Math.round(converted)
      : converted >= 100
        ? Math.round(converted)
        : Math.round(converted * 100) / 100;
    return `${symbol}${rounded.toLocaleString()}`;
  };

  return { currencyCode, formatPrice };
}
