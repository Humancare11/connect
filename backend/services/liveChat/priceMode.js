// Live chat prices for visitors who are not priced in USD.
//
// The chat's canned replies and the AI's price list are written in USD. A visitor whose country is priced in EUR, GBP or INR (by the
// same country list the website uses, see utils/currencyConfig) must not be quoted a dollar amount that is not what they will be
// charged, and the chat has no way to know the exact EUR / GBP price of each service. So for them the chat never quotes an
// amount: it says the price is shown at booking, before they pay, and points to the booking page. USD visitors, visitors whose
// country is unknown, and every visitor while MULTI_CURRENCY_ENABLED is off are unchanged.
const { isMultiCurrencyEnabled, currencyForCountryName } = require("../../utils/currencyConfig");

const PRICE_AT_BOOKING = "The exact price is shown when you book, before you pay.";

// A money amount in a sentence: a symbol before a number ($49, €30, £25, ₹999) or a number with a currency word (49 USD, 30 euros,
// 999 rupees, Rs. 999).
const AMOUNT = /[$€£₹]\s?\d|\d[\d.,]*\s?(?:usd|eur|gbp|inr|dollars?|euros?|pounds?|rupees?)\b|\b(?:usd|eur|gbp|inr)\s?\d|\brs\.?\s?\d/i;

const hasAmount = (text) => AMOUNT.test(String(text || ""));

// The chat's currency for a conversation: its visitor's country (from the IP) decides. USD when the flag is off.
function chatCurrencyOf(conversation) {
  if (!isMultiCurrencyEnabled()) return "USD";
  return currencyForCountryName(conversation?.geo?.country);
}

// True when this visitor must not be quoted an exact price.
const hidesPrices = (conversation) => chatCurrencyOf(conversation) !== "USD";

// The text without the sentences that quote an amount; the "price is shown at booking" line goes first when something was cut,
// and is not repeated when the text already says it.
function withoutPrices(text) {
  const original = String(text || "");
  if (!hasAmount(original)) return original;
  // "Rs. 1499" is one amount, not two sentences, so no split after "Rs."
  const kept = original.split(/(?<=[.!?])(?<!\b[Rr][Ss]\.)\s+/).filter((sentence) => !hasAmount(sentence));
  const rest = kept.join(" ").trim();
  return rest ? `${PRICE_AT_BOOKING} ${rest}` : PRICE_AT_BOOKING;
}

module.exports = { PRICE_AT_BOOKING, hasAmount, chatCurrencyOf, hidesPrices, withoutPrices };
