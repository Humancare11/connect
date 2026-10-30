// Showing prices in the visitor's currency. Pure functions: no React, no network.
//
// The server decides which currency a visitor is priced in (GET /api/geo/currency). The browser only displays it; it never
// converts an amount, and it never tells the server which currency or amount to charge.

export const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "INR"];
export const DEFAULT_CURRENCY = "USD";

const SYMBOLS = { USD: "$", EUR: "€", GBP: "£", INR: "₹" };

// The gateway follows the currency: rupees are paid through Razorpay only; dollars, euros and pounds through Stripe or PayPal.
// (The server enforces the same rule; this only decides which payment buttons to show.)
export const gatewaysForCurrency = (currency) => (normalizeCurrency(currency) === "INR" ? ["razorpay"] : ["stripe", "paypal"]);

export function normalizeCurrency(value) {
  const code = String(value || "").trim().toUpperCase();
  return SUPPORTED_CURRENCIES.includes(code) ? code : DEFAULT_CURRENCY;
}

export const currencySymbol = (currency) => SYMBOLS[normalizeCurrency(currency)];

// Symbol first: $30, €30, £30, ₹4,999 (rupees use Indian digit grouping: ₹1,00,000). A whole amount has no decimals; a fractional
// one always has two ($29.50, not $29.5).
// Returns "" when the amount is not a number, so a missing price never shows as "$NaN".
export function formatPrice(amount, currency = DEFAULT_CURRENCY) {
  if (amount === null || amount === undefined || amount === "") return "";
  const value = Number(amount);
  if (!Number.isFinite(value)) return "";
  const whole = Math.abs(value % 1) < 1e-9;
  const digits = whole ? 0 : 2;
  const locale = normalizeCurrency(currency) === "INR" ? "en-IN" : "en-US";
  return `${currencySymbol(currency)}${value.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

const positive = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// One category's price in the visitor's currency, from its /api/pricing entry ({ price, priceEur, priceGbp, priceInr }).
// A EUR / GBP / INR price that is not set falls back to the USD price, labelled USD - the same rule the server charges by, so what is
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
  if (wanted === "INR") {
    const inr = positive(record.priceInr);
    if (inr) return { amount: inr, currency: "INR" };
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

// The pricing-table record of a selection's category. The table (/api/pricing) is keyed by the category's pricing slug, but a
// selection built from the appointment tree carries the Mongo _id as catId, so the slug is tried first, then catId, and last the
// category name (the table also carries each label) for a selection saved before the slug was recorded.
export function priceRecordFor(selection, prices) {
  if (!prices || !selection) return undefined;
  for (const key of [selection.pricingSlug, selection.catId]) {
    if (key && prices[key]) return prices[key];
  }
  const label = String(selection.catLabel || "").trim().toLowerCase();
  if (!label) return undefined;
  return Object.values(prices).find((record) => String(record?.label || "").trim().toLowerCase() === label);
}

// One service's price slot (service pages and the services list): the same rules as useCategoryPriceInfo. `record` is a service from
// /api/services (or /by-slug): { price, priceEur?, priceGbp?, priceInr? }. A skeleton while the currency or the record is loading,
// "Price unavailable" when there is no price at all - never a made-up price.
export function servicePriceInfo({ record, loading = false, currency, currencyLoading = false }) {
  const usd = positive(record?.price);
  if (currencyLoading || (loading && !record)) return { amount: null, currency: normalizeCurrency(currency), loading: true, unavailable: false, usdAmount: usd };
  const info = record ? resolveCategoryPrice(record, currency) : null;
  if (!info) return { amount: null, currency: normalizeCurrency(currency), loading: false, unavailable: true, usdAmount: usd };
  return { ...info, loading: false, unavailable: false, usdAmount: usd };
}

// The price of a booking selection. A service booking and the doctor-fee path are always USD; a category booking is priced in the
// visitor's currency. `selection.cost` is the USD price the booking page already loaded. The result is for display only - the
// server prices the payment itself.
export function selectionPriceInfo({
  selection,
  prices,
  currency,
  currencyLoading = false,
  pricesLoading = false,
  serviceRecord = null,
  serviceLoading = false,
}) {
  const usdCost = positive(selection?.cost);
  if (selection?.isServiceBooking) {
    // A service is priced like a category: in the visitor's currency, from the service's own record (/api/services/by-slug), with the
    // USD price (labelled USD) when it has none in that currency.
    if (currencyLoading) return { amount: null, currency: DEFAULT_CURRENCY, loading: true, unavailable: false };
    const wantedForService = normalizeCurrency(currency);
    const usdService = usdCost || positive(serviceRecord?.price);
    if (wantedForService !== "USD") {
      if (serviceLoading && !serviceRecord) return { amount: null, currency: wantedForService, loading: true, unavailable: false };
      const native = serviceRecord ? resolveCategoryPrice(serviceRecord, wantedForService) : null;
      if (native && native.currency === wantedForService) return { ...native, loading: false, unavailable: false };
    }
    return { amount: usdService, currency: "USD", loading: false, unavailable: !usdService };
  }
  if (currencyLoading) return { amount: null, currency: DEFAULT_CURRENCY, loading: true, unavailable: false };
  const wanted = normalizeCurrency(currency);
  if (wanted === "USD") {
    // Exactly today's behaviour: the price the page already loaded, else the pricing table's USD price.
    const fromTable = prices ? resolveCategoryPrice(priceRecordFor(selection, prices), "USD") : null;
    const amount = usdCost || fromTable?.amount || null;
    return { amount, currency: "USD", loading: false, unavailable: !amount };
  }
  if (pricesLoading && !prices) return { amount: null, currency: wanted, loading: true, unavailable: false };
  const info = prices ? resolveCategoryPrice(priceRecordFor(selection, prices), wanted) : null;
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
