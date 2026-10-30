// utils/currencyConfig.js
//
// Single source of truth for the pricing currencies (USD / EUR / GBP, plus INR for
// India): which countries pay in which currency, which payment gateway takes which
// currency, how a request's currency is decided, and how a price value is validated.
//
// Countries are keyed by ISO 3166-1 alpha-2 code, never by name: the
// country-state-city names differ from everyday ones ("Czech Republic",
// "Vatican City State (Holy See)", "Man (Isle of)"). User.country holds one of
// those library names, so names are converted to a code before the lookup.
//
// Everything here fails closed to USD: an unknown, empty or unreadable country
// is a USD customer.
//
// Env:
//   MULTI_CURRENCY_ENABLED  "true" / "1" turns EUR/GBP on for customers. Off by
//                           default; while off, every customer decision is USD.
//   RAZORPAY_KEY_ID +       INR (India only) is active ONLY when MULTI_CURRENCY_ENABLED
//   RAZORPAY_KEY_SECRET     is on AND both Razorpay keys are set. Without them an Indian
//                           customer is a USD customer on Stripe / PayPal, exactly as
//                           before: the server never sends anyone to Razorpay without keys.
const { Country } = require("country-state-city");

const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "INR"];
const DEFAULT_CURRENCY = "USD";

const MAX_PRICE = 100000;
// INR amounts are numerically ~85x larger than the same value in USD, so the cap is higher (Rs 10,00,000).
const MAX_PRICE_INR = 1000000;
const MIN_PRICE = 0.01;
const MIN_PRICE_INR = 1;

// The only gateway that may take each currency (the gateway follows the currency, never the other way round):
// INR -> Razorpay only; USD / EUR / GBP -> Stripe or PayPal only.
const GATEWAYS_FOR_CURRENCY = {
  USD: ["stripe", "paypal"],
  EUR: ["stripe", "paypal"],
  GBP: ["stripe", "paypal"],
  INR: ["razorpay"],
};

// India is the only country priced in rupees.
const INR_COUNTRIES = new Set(["IN"]);

// 21 euro-area members + 6 non-members that use the euro + 16 other European
// countries priced in euros. XK (Kosovo) is not an official ISO code but is the
// code country-state-city (and most geo databases) use.
const EUR_COUNTRIES = new Set([
  // Eurozone (21)
  "AT", "BE", "BG", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES",
  // Non-eurozone euro users (6)
  "AD", "MC", "SM", "VA", "XK", "ME",
  // Other European countries priced in EUR (16)
  "AL", "BA", "CZ", "DK", "HU", "IS", "LI", "MD", "MK", "NO", "PL", "RO", "RS", "SE", "CH", "UA",
]);

// United Kingdom (England, Scotland, Wales, Northern Ireland all resolve to GB)
// plus the Crown Dependencies and the UK territories that use sterling.
const GBP_COUNTRIES = new Set(["GB", "JE", "GG", "IM", "GI", "FK", "SH"]);

const SYMBOLS = { USD: "$", EUR: "€", GBP: "£", INR: "₹" };

function isMultiCurrencyEnabled() {
  const raw = String(process.env.MULTI_CURRENCY_ENABLED || "").trim().toLowerCase();
  return raw === "true" || raw === "1";
}

// True when both Razorpay keys are set (non-empty). Says nothing about the feature flag.
function isRazorpayConfigured() {
  return Boolean(String(process.env.RAZORPAY_KEY_ID || "").trim() && String(process.env.RAZORPAY_KEY_SECRET || "").trim());
}

// INR is active only with the flag on AND both Razorpay keys present.
function isInrEnabled() {
  return isMultiCurrencyEnabled() && isRazorpayConfigured();
}

// Whether `gateway` ("stripe" / "paypal" / "razorpay") may take `currency`.
function gatewayAllowsCurrency(gateway, currency) {
  const allowed = GATEWAYS_FOR_CURRENCY[String(currency || "").trim().toUpperCase()];
  return Boolean(allowed && allowed.includes(String(gateway || "").trim().toLowerCase()));
}

// The highest price an admin may enter in `currency`.
function maxPriceFor(currency) {
  return String(currency || "").trim().toUpperCase() === "INR" ? MAX_PRICE_INR : MAX_PRICE;
}

// The smallest price that can be charged: 0.01 for USD / EUR / GBP, 1 rupee for INR.
function minPriceFor(currency) {
  return String(currency || "").trim().toUpperCase() === "INR" ? MIN_PRICE_INR : MIN_PRICE;
}

function normalizeCurrency(value) {
  const code = String(value || "").trim().toUpperCase();
  return SUPPORTED_CURRENCIES.includes(code) ? code : DEFAULT_CURRENCY;
}

// "EUR" for any code in the euro list, "GBP" for the sterling list, "INR" for India
// (only while INR is active, see isInrEnabled), else USD.
function currencyForCountryCode(code) {
  const iso = String(code || "").trim().toUpperCase();
  if (EUR_COUNTRIES.has(iso)) return "EUR";
  if (GBP_COUNTRIES.has(iso)) return "GBP";
  if (INR_COUNTRIES.has(iso) && isInrEnabled()) return "INR";
  return DEFAULT_CURRENCY;
}

const fold = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

let nameIndex = null;
function getNameIndex() {
  if (!nameIndex) {
    nameIndex = new Map();
    for (const country of Country.getAllCountries()) {
      nameIndex.set(fold(country.name), country.isoCode);
    }
    // Everyday names for places the library spells differently, so a free-text
    // profile value written the common way still resolves.
    const aliases = {
      kosovo: "XK",
      czechia: "CZ",
      vaticancity: "VA",
      unitedkingdom: "GB",
      uk: "GB",
      isleofman: "IM",
      guernsey: "GG",
      northmacedonia: "MK",
      macedonia: "MK",
      sthelena: "SH",
    };
    for (const [key, iso] of Object.entries(aliases)) {
      if (!nameIndex.has(key)) nameIndex.set(key, iso);
    }
  }
  return nameIndex;
}

// A country NAME (as stored in User.country) -> its ISO code, or "" when unknown.
// An ISO code passed in is accepted as well.
function isoForCountryName(name) {
  const raw = String(name || "").trim();
  if (!raw) return "";
  if (/^[A-Za-z]{2}$/.test(raw)) {
    const code = raw.toUpperCase();
    if (code === "XK" || Country.getCountryByCode(code)) return code;
  }
  return getNameIndex().get(fold(raw)) || "";
}

// Currency for a country name; USD for an empty or unknown one.
function currencyForCountryName(name) {
  return currencyForCountryCode(isoForCountryName(name));
}

// Decides the currency for one request, on the server only.
//   1. the logged-in user's profile country (when it is a recognisable country)
//   2. otherwise the IP's country
//   3. otherwise USD
// While MULTI_CURRENCY_ENABLED is off the answer is always USD, so customers see
// exactly what they saw before this feature existed.
//
// `lookupLocation` is injectable for tests; it defaults to the offline GeoIP
// lookup and never throws.
async function resolveRequestCurrency({ userCountry = "", ip = "", lookupLocation } = {}) {
  if (!isMultiCurrencyEnabled()) {
    return { currency: DEFAULT_CURRENCY, country: "", source: "disabled" };
  }

  const profileIso = isoForCountryName(userCountry);
  if (profileIso) {
    return { currency: currencyForCountryCode(profileIso), country: profileIso, source: "profile" };
  }

  try {
    const lookup = lookupLocation || require("./geoIp").lookupLocation;
    const location = ip ? await lookup(ip) : null;
    const ipIso = isoForCountryName(location?.country);
    if (ipIso) {
      return { currency: currencyForCountryCode(ipIso), country: ipIso, source: "ip" };
    }
  } catch {
    // fall through to the default
  }
  return { currency: DEFAULT_CURRENCY, country: "", source: "default" };
}

// Validates one price value from an API body.
// Accepts a number or a numeric string; rejects empty, booleans, arrays, NaN,
// zero, negatives, more than two decimals and anything over the cap (MAX_PRICE, or
// MAX_PRICE_INR when `max` is passed, see maxPriceFor) and anything below the minimum
// (`min`: 0.01, or 1 for INR, see minPriceFor), so a tiny value can never round to 0.
// Returns { value } or { error } (error is a sentence without the field name).
function parsePrice(raw, max = MAX_PRICE, min = MIN_PRICE) {
  if (typeof raw === "string") {
    if (raw.trim() === "" || !/^\d+(\.\d+)?$/.test(raw.trim())) {
      return { error: "must be a valid number greater than 0." };
    }
  } else if (typeof raw !== "number") {
    return { error: "must be a valid number greater than 0." };
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return { error: "must be greater than 0." };
  if (value < min) return { error: `must be at least ${min.toLocaleString("en-US")}.` };
  if (value > max) return { error: `must not be more than ${max.toLocaleString("en-US")}.` };
  if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) {
    return { error: "can have at most 2 decimal places." };
  }
  return { value: Math.round(value * 100) / 100 };
}

module.exports = {
  SUPPORTED_CURRENCIES,
  DEFAULT_CURRENCY,
  MAX_PRICE,
  MAX_PRICE_INR,
  GATEWAYS_FOR_CURRENCY,
  EUR_COUNTRIES,
  GBP_COUNTRIES,
  SYMBOLS,
  isMultiCurrencyEnabled,
  isRazorpayConfigured,
  isInrEnabled,
  gatewayAllowsCurrency,
  maxPriceFor,
  minPriceFor,
  MIN_PRICE,
  MIN_PRICE_INR,
  normalizeCurrency,
  currencyForCountryCode,
  currencyForCountryName,
  isoForCountryName,
  resolveRequestCurrency,
  parsePrice,
};
