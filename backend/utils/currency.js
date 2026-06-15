const FALLBACK_RATES = {
  USD: 1, EUR: 0.92, GBP: 0.79, INR: 83.5, AUD: 1.54,
  CAD: 1.36, AED: 3.67, SAR: 3.75, SGD: 1.35, JPY: 149,
  CNY: 7.24, KRW: 1330, CHF: 0.90, SEK: 10.4, NOK: 10.6,
  DKK: 6.88, MXN: 17.2, BRL: 4.97, ZAR: 18.6, NGN: 1550,
  KES: 129, PKR: 278, BDT: 110, LKR: 305, MYR: 4.72,
  THB: 35.1, PHP: 56.4, IDR: 15700, VND: 24350, HKD: 7.82,
  TWD: 31.8, NZD: 1.63, ILS: 3.72, EGP: 30.9, QAR: 3.64,
  KWD: 0.307, BHD: 0.377, OMR: 0.385, MAD: 10.0,
};

function convertAmount(amount, fromCurrency = "USD", toCurrency = "INR") {
  const value = Number(amount) || 0;
  if (value <= 0) return 0;

  const from = String(fromCurrency || "USD").toUpperCase();
  const to = String(toCurrency || "INR").toUpperCase();
  const fromRate = FALLBACK_RATES[from] || FALLBACK_RATES.USD;
  const toRate = FALLBACK_RATES[to] || FALLBACK_RATES.INR;

  return (value / fromRate) * toRate;
}

function toPaise(amount, fromCurrency = "USD") {
  return Math.round(convertAmount(amount, fromCurrency, "INR") * 100);
}

// Convert any currency amount to USD cents (Stripe/PayPal minor unit for USD)
function toCents(amount, fromCurrency = "USD") {
  return Math.round(convertAmount(amount, fromCurrency, "USD") * 100);
}

module.exports = {
  convertAmount,
  toPaise,
  toCents,
};
