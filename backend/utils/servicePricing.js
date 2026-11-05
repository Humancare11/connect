const { normalizeCurrency } = require("./currencyConfig");

// The price of a ServicePrice record in the wanted currency (USD / EUR / GBP / INR, default USD): { price, currency }.
// Nothing is converted. A EUR / GBP / INR price that is not set (or not positive) falls back to the USD price and the result says
// currency "USD" (the customer is shown and charged USD), and [CURRENCY_FALLBACK_USED] is logged - the same rule as the categories.
function resolveEffectiveServicePrice(service, wantedCurrency = "USD") {
  const wanted = normalizeCurrency(wantedCurrency);
  if (wanted !== "USD") {
    const native = Number({ EUR: service?.priceEur, GBP: service?.priceGbp, INR: service?.priceInr }[wanted]);
    if (Number.isFinite(native) && native > 0) return { price: native, currency: wanted };
    console.warn(
      `[CURRENCY_FALLBACK_USED] wanted=${wanted} used=USD serviceId=${service?._id} name="${service?.name}" slug=${service?.slug || "(none)"}`,
    );
  }
  const usd = Number(service?.price);
  return { price: Number.isFinite(usd) && usd > 0 ? usd : 0, currency: "USD" };
}

module.exports = { resolveEffectiveServicePrice };
