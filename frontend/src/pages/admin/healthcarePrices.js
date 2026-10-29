// The category price rules of Super Admin > Healthcare Management. Pure functions: no React, no network.
// The server (PUT /api/pricing/:id, POST /categories) is the real check; this only tells the admin early.

export const PRICE_CURRENCIES = [
  { code: "USD", symbol: "$", field: "price", lockField: null },
  { code: "EUR", symbol: "€", field: "priceEur", lockField: "priceEurLocked" },
  { code: "GBP", symbol: "£", field: "priceGbp", lockField: "priceGbpLocked" },
  // Rupees: India only, paid through Razorpay. Up to ₹10,00,000.
  { code: "INR", symbol: "₹", field: "priceInr", lockField: "priceInrLocked" },
];

// The highest price per currency (INR amounts are numerically larger).
export const MAX_PRICE = 100000;
export const MAX_PRICE_INR = 1000000;
export const maxPriceFor = (code) => (code === "INR" ? MAX_PRICE_INR : MAX_PRICE);

const isUnset = (value) => value === null || value === undefined;

// Symbol first, like the site: $30, €30, £30.50, ₹4,999 (rupees use Indian digit grouping). Not set -> null.
export function formatMoney(value, currency) {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  const symbol = PRICE_CURRENCIES.find((c) => c.code === currency)?.symbol || "$";
  return `${symbol}${amount.toLocaleString(currency === "INR" ? "en-IN" : "en-US", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

// A category is "missing" a price when EUR, GBP or INR has not been entered yet.
export const isMissingForeignPrice = (category) =>
  isUnset(category.priceEur) || isUnset(category.priceGbp) || isUnset(category.priceInr);

// The currencies (codes) a category still has no price in.
export const missingCurrencies = (category) =>
  PRICE_CURRENCIES.filter(({ code, field }) => code !== "USD" && isUnset(category[field])).map(({ code }) => code);

// Same rules as the server (which is the real check): a number above 0, at most 100,000 (INR: 10,00,000), at most 2 decimals. USD
// is always required. On create all four are required; on edit a EUR / GBP / INR price that was already set can be changed but not
// emptied, and one that was never set may stay empty.
export function checkCategoryPrices(form, creating) {
  for (const { code, field, lockField } of PRICE_CURRENCIES) {
    const label = `${code} price`;
    const required = field === "price" || creating || Boolean(lockField && form[lockField]);
    const text = String(form[field] ?? "").trim();
    if (!text) {
      if (!required) continue;
      return creating || field === "price" ? `${label} is required.` : `${label} cannot be cleared once it is set.`;
    }
    const value = Number(text);
    const max = maxPriceFor(code);
    if (!/^\d+(\.\d+)?$/.test(text) || !(value > 0)) return `${label} must be greater than 0.`;
    if (value > max) return `${label} must not be more than ${max.toLocaleString(code === "INR" ? "en-IN" : "en-US")}.`;
    if (!/^\d+(\.\d{1,2})?$/.test(text)) return `${label} can have at most 2 decimal places.`;
  }
  return "";
}
