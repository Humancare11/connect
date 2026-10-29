// Showing prices in the visitor's currency. Pure functions: no React, no network.
//
// The server decides which currency a visitor is priced in (GET /api/geo/currency). The browser only displays it; it never
// converts an amount, and it never tells the server which currency or amount to charge.

export const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP"];
export const DEFAULT_CURRENCY = "USD";

const SYMBOLS = { USD: "$", EUR: "€", GBP: "£" };

export function normalizeCurrency(value) {
  const code = String(value || "").trim().toUpperCase();
  return SUPPORTED_CURRENCIES.includes(code) ? code : DEFAULT_CURRENCY;
}

export const currencySymbol = (currency) => SYMBOLS[normalizeCurrency(currency)];

// Symbol first: $30, €30, £30. A whole amount has no decimals; a fractional one always has two ($29.50, not $29.5).
// Returns "" when the amount is not a number, so a missing price never shows as "$NaN".
export function formatPrice(amount, currency = DEFAULT_CURRENCY) {
  if (amount === null || amount === undefined || amount === "") return "";
  const value = Number(amount);
  if (!Number.isFinite(value)) return "";
  const whole = Math.abs(value % 1) < 1e-9;
  const digits = whole ? 0 : 2;
  return `${currencySymbol(currency)}${value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

const positive = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// One category's price in the visitor's currency, from its /api/pricing entry ({ price, priceEur, priceGbp }).
// A EUR / GBP price that is not set falls back to the USD price, labelled USD - the same rule the server charges by, so what is
// shown is what is charged. Returns null when there is no usable price at all.
export function resolveCategoryPrice(record, currency = DEFAULT_CURRENCY) {
  if (!record) return null;
  const wanted = normalizeCurrency(currency);
  if (wanted === "EUR") {
    const eur = positive(record.priceEur);
    if (eur) return { amount: eur, currency: "EUR" };
  }
  if (wanted === "GBP") {
    const gbp = positive(record.priceGbp);
    if (gbp) return { amount: gbp, currency: "GBP" };
  }
  const usd = positive(record.price);
  return usd ? { amount: usd, currency: "USD" } : null;
}

// What a price slot shows: a skeleton while the currency or the prices are loading (never "$" first and then "€"; the USD price, when
// known, stays in the markup behind the skeleton for crawlers - see PriceText), a
// "price unavailable" state when there is no price, otherwise the formatted price.
export function priceTextState(info) {
  if (!info || info.loading) return { kind: "skeleton", text: formatPrice(info?.usdAmount, "USD") };
  const text = formatPrice(info.amount, info.currency);
  if (!text) return { kind: "unavailable", text: "Price unavailable" };
  return { kind: "price", text };
}

// The price of a booking selection. A service booking and the doctor-fee path are always USD; a category booking is priced in the
// visitor's currency. `selection.cost` is the USD price the booking page already loaded. The result is for display only - the
// server prices the payment itself.
export function selectionPriceInfo({ selection, prices, currency, currencyLoading = false, pricesLoading = false }) {
  const usdCost = positive(selection?.cost);
  if (selection?.isServiceBooking) {
    return { amount: usdCost, currency: "USD", loading: false, unavailable: !usdCost };
  }
  if (currencyLoading) return { amount: null, currency: DEFAULT_CURRENCY, loading: true, unavailable: false };
  const wanted = normalizeCurrency(currency);
  if (wanted === "USD") {
    // Exactly today's behaviour: the price the page already loaded, else the pricing table's USD price.
    const slug = selection?.catId;
    const fromTable = slug && prices ? resolveCategoryPrice(prices[slug], "USD") : null;
    const amount = usdCost || fromTable?.amount || null;
    return { amount, currency: "USD", loading: false, unavailable: !amount };
  }
  if (pricesLoading && !prices) return { amount: null, currency: wanted, loading: true, unavailable: false };
  const slug = selection?.catId;
  const info = slug && prices ? resolveCategoryPrice(prices[slug], wanted) : null;
  if (info) return { ...info, loading: false, unavailable: false };
  // No price table entry for this category: the USD price the page loaded, labelled USD (never converted).
  return { amount: usdCost, currency: "USD", loading: false, unavailable: !usdCost };
}

// The PayPal script is loaded for one currency and cannot change it afterwards, so the provider is keyed by the currency:
// a different currency mounts a fresh provider that loads the SDK again for that currency.
export function paypalProviderProps(clientId, currency) {
  const code = normalizeCurrency(currency);
  return {
    key: `paypal-${code}`,
    options: { "client-id": clientId, currency: code, intent: "capture" },
  };
}
