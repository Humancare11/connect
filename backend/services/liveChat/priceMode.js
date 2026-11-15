// What the live chat may say about money.
//
// Prices come from the Super Admin pricing (see livePrices.js), in the visitor's own currency: the same country -> currency rule
// as checkout (currencyConfig: the MULTI_CURRENCY_ENABLED flag, INR only while Razorpay is set up, USD for an unknown country).
// Whatever the model, a quick-option text or a fallback says is then CHECKED against that list: an amount that is not an
// exact price of the list (or is in another currency than the list says) is cut, and the patient is told the exact price is
// shown when they book.
const { isMultiCurrencyEnabled, currencyForCountryName } = require("../../utils/currencyConfig");

const PRICE_AT_BOOKING = "The exact price is shown when you book, before you pay.";

// A money amount in a sentence: a symbol before a number ($49, €30, £25, ₹999) or a number with a currency word (49 USD, 30 euros,
// 999 rupees, Rs. 999).
const AMOUNT = /[$€£₹]\s?\d|\d[\d.,]*\s?(?:usd|eur|gbp|inr|dollars?|euros?|pounds?|rupees?)\b|\b(?:usd|eur|gbp|inr)\s?\d|\brs\.?\s?\d/i;

const hasAmount = (text) => AMOUNT.test(String(text || ""));

const NUMBER = "(\\d[\\d,]*(?:\\.\\d+)?)";
const WORD_CURRENCY = { usd: "USD", dollar: "USD", dollars: "USD", eur: "EUR", euro: "EUR", euros: "EUR", gbp: "GBP", pound: "GBP", pounds: "GBP", inr: "INR", rupee: "INR", rupees: "INR", rs: "INR" };
const SYMBOL_CURRENCY = { $: "USD", "€": "EUR", "£": "GBP", "₹": "INR" };

// Every amount in a text: [{ value, currency }] (currency "" when the text does not say).
function amountsIn(text) {
  const source = String(text || "");
  const found = [];
  const take = (re, build) => {
    for (const m of source.matchAll(re)) found.push(build(m));
  };
  const num = (s) => Number(String(s).replace(/,/g, ""));
  take(new RegExp(`([$€£₹])\\s?${NUMBER}`, "g"), (m) => ({ value: num(m[2]), currency: SYMBOL_CURRENCY[m[1]] }));
  take(new RegExp(`${NUMBER}\\s?(usd|eur|gbp|inr|dollars?|euros?|pounds?|rupees?)\\b`, "gi"), (m) => ({ value: num(m[1]), currency: WORD_CURRENCY[m[2].toLowerCase()] }));
  take(new RegExp(`\\b(usd|eur|gbp|inr)\\s?${NUMBER}`, "gi"), (m) => ({ value: num(m[2]), currency: WORD_CURRENCY[m[1].toLowerCase()] }));
  take(new RegExp(`\\brs\\.?\\s?${NUMBER}`, "gi"), (m) => ({ value: num(m[1]), currency: "INR" }));
  return found.filter((a) => Number.isFinite(a.value));
}

// The chat's currency for a conversation: its visitor's country (from the IP) decides, by the same rule as checkout. USD when the
// flag is off or the country is unknown.
function chatCurrencyOf(conversation) {
  if (!isMultiCurrencyEnabled()) return "USD";
  return currencyForCountryName(conversation?.geo?.country);
}

// True when every amount in `text` is exactly a price of `items` (same number, and the same currency when the text names one).
function amountsAllowed(text, items = []) {
  return amountsIn(text).every((a) => items.some((i) => Math.abs(i.amount - a.value) < 0.005 && (!a.currency || a.currency === i.currency)));
}

const SENTENCES = /(?<=[.!?])(?<!\b[Rr][Ss]\.)\s+/; // "Rs. 1499" is one amount, not two sentences

// The text without the sentences that fail `drop`; the "price is shown at booking" line goes first when something was cut,
// and is not repeated when the text already says it.
function cutSentences(text, drop) {
  const original = String(text || "");
  const parts = original.split(SENTENCES);
  const kept = parts.filter((sentence) => !drop(sentence));
  if (kept.length === parts.length) return { text: original, cut: false };
  const rest = kept.join(" ").trim();
  const intro = original.includes(PRICE_AT_BOOKING) ? "" : `${PRICE_AT_BOOKING} `;
  return { text: rest ? `${intro}${rest}`.trim() : PRICE_AT_BOOKING, cut: true };
}

// The reply check: sentences with an amount that is not on the visitor's list are removed. { text, changed }.
function guardAmounts(text, items = []) {
  const original = String(text || "");
  if (!hasAmount(original) || amountsAllowed(original, items)) return { text: original, changed: false };
  const { text: out } = cutSentences(original, (sentence) => hasAmount(sentence) && !amountsAllowed(sentence, items));
  return { text: out, changed: out !== original };
}

// Quick-option text: {price:key} becomes the live price. A sentence whose price is missing is cut (and the "shown at booking" line added).
const PLACEHOLDER = /\{\s*price\s*:\s*([a-z0-9-]+)\s*\}/gi;
function fillPrices(text, items = []) {
  const original = String(text || "");
  const byKey = new Map(items.map((i) => [i.key, i]));
  const missing = (sentence) => [...sentence.matchAll(PLACEHOLDER)].some((m) => !byKey.has(m[1].toLowerCase()));
  const { text: kept } = cutSentences(original, missing);
  return kept.replace(PLACEHOLDER, (_all, key) => byKey.get(String(key).toLowerCase())?.text || "");
}

// The text without the sentences that quote any amount (kept for callers that must never quote one).
function withoutPrices(text) {
  const original = String(text || "");
  if (!hasAmount(original)) return original;
  return cutSentences(original, hasAmount).text;
}

module.exports = { PRICE_AT_BOOKING, hasAmount, amountsIn, amountsAllowed, chatCurrencyOf, guardAmounts, fillPrices, withoutPrices };
