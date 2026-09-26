// Mobile-number rules. Mirrors backend/utils/mobileValidation.js — keep the
// two in sync. Numbers are "+<country code><number>" with no separators (the
// PhoneInputField emits exactly that).
//   +91  → national part must match /^[6-9]\d{9}$/
//   else → international shape, 8–15 digits after the "+"
export const INDIA_MOBILE_REGEX = /^[6-9]\d{9}$/;
const GENERIC_E164 = /^\+[1-9]\d{7,14}$/;

export const INDIA_MOBILE_MESSAGE =
  "Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9.";
export const GENERIC_MOBILE_MESSAGE = "Enter a valid mobile number with country code.";

// Returns "" when valid, otherwise the error message to show.
export function getMobileError(input) {
  const value = String(input || "").replace(/[\s\-().]/g, "");
  if (!value) return "Enter mobile number";
  if (value.startsWith("+91")) {
    return INDIA_MOBILE_REGEX.test(value.slice(3)) ? "" : INDIA_MOBILE_MESSAGE;
  }
  return GENERIC_E164.test(value) ? "" : GENERIC_MOBILE_MESSAGE;
}
