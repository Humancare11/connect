// utils/mobileValidation.js
//
// Mobile numbers are stored as "+<country code><number>" with no spaces
// (the frontend phone widget emits exactly that). Rules:
//   +91  → national part must match /^[6-9]\d{9}$/
//   else → generic E.164 shape, 8–15 digits total after the "+"
const INDIA_NATIONAL = /^[6-9]\d{9}$/;
const GENERIC_E164 = /^\+[1-9]\d{7,14}$/;

const INDIA_MSG = "Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9.";
const GENERIC_MSG = "Enter a valid mobile number with country code.";

// Returns { valid: true, value } (value normalized) or { valid: false, msg }.
function validateMobile(input) {
  if (typeof input !== "string") return { valid: false, msg: "Mobile number is required." };

  const value = input.replace(/[\s\-().]/g, "");
  if (!value) return { valid: false, msg: "Mobile number is required." };

  if (value.startsWith("+91")) {
    return INDIA_NATIONAL.test(value.slice(3))
      ? { valid: true, value }
      : { valid: false, msg: INDIA_MSG };
  }
  return GENERIC_E164.test(value) ? { valid: true, value } : { valid: false, msg: GENERIC_MSG };
}

module.exports = { validateMobile };
