// Cleaning and limits for personal email signatures (plain text).

const MAX_SIGNATURES = 10;
const MAX_NAME_LENGTH = 40;
const MAX_CONTENT_LENGTH = 1000;
const MAX_LINES = 20;
// Anything longer than this is refused before cleaning (abuse guard, not a product limit).
const MAX_RAW_LENGTH = 4000;

class SignatureValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "SignatureValidationError";
    this.status = status;
  }
}

// → the cleaned name. Single line, no control characters, 1..40 characters.
function cleanSignatureName(value) {
  if (typeof value !== "string") throw new SignatureValidationError("Give the signature a name.");
  const name = value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  if (!name) throw new SignatureValidationError("Give the signature a name.");
  if (name.length > MAX_NAME_LENGTH) throw new SignatureValidationError(`The name can be up to ${MAX_NAME_LENGTH} characters.`);
  return name;
}

// → the cleaned content: LF line breaks, no control characters, no trailing spaces,
// at most one blank line in a row. Throws when it is empty, too long, or contains a
// "-- " line (that line is the divider between message and signature).
function cleanSignatureContent(value) {
  if (typeof value !== "string") throw new SignatureValidationError("Write the signature text.");
  if (value.length > MAX_RAW_LENGTH) throw new SignatureValidationError(`The signature can be up to ${MAX_CONTENT_LENGTH} characters.`);

  const text = value
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, "    ")
    // control characters other than the line break (zero-width and bidi tricks as well)
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F​-‏‪-‮⁠﻿]/g, "")
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!text) throw new SignatureValidationError("Write the signature text.");
  if (text.length > MAX_CONTENT_LENGTH) throw new SignatureValidationError(`The signature can be up to ${MAX_CONTENT_LENGTH} characters.`);
  const lines = text.split("\n");
  if (lines.length > MAX_LINES) throw new SignatureValidationError(`The signature can have up to ${MAX_LINES} lines.`);
  if (lines.some((l) => /^--\s*$/.test(l))) {
    throw new SignatureValidationError('A line with only "--" is not allowed: it is the divider the mail adds above your signature.');
  }
  return text;
}

const LAYOUTS = ["text", "image", "image_text"];
const MAX_ALT_LENGTH = 120;
const MAX_LINK_LENGTH = 500;

// "" (use the first text line) or a cleaned single line of at most 120 characters.
function cleanImageAlt(value) {
  if (typeof value !== "string") throw new SignatureValidationError("The image description must be text.");
  const alt = value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  if (alt.length > MAX_ALT_LENGTH) throw new SignatureValidationError(`The image description can be up to ${MAX_ALT_LENGTH} characters.`);
  return alt;
}

// "" (no link) or a normalised http(s) address of at most 500 characters.
function cleanImageLink(value) {
  if (typeof value !== "string") throw new SignatureValidationError("The link must be text.");
  const raw = value.trim();
  if (!raw) return "";
  if (raw.length > MAX_LINK_LENGTH || /[\u0000-\u0020\u007F]/.test(raw)) throw new SignatureValidationError("That link is not valid.");
  // A bare "www." address is common to type: it becomes https://
  const candidate = /^www\./i.test(raw) ? `https://${raw}` : raw;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new SignatureValidationError("That link is not valid. Use an address like https://humancareconnect.co");
  }
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) {
    throw new SignatureValidationError("The link must start with https:// or http://");
  }
  if (url.username || url.password) throw new SignatureValidationError("The link must not contain a user name or password.");
  const out = url.toString();
  if (out.length > MAX_LINK_LENGTH) throw new SignatureValidationError("That link is too long.");
  return out;
}

module.exports = {
  LAYOUTS,
  MAX_ALT_LENGTH,
  MAX_LINK_LENGTH,
  cleanImageAlt,
  cleanImageLink,
  MAX_SIGNATURES,
  MAX_NAME_LENGTH,
  MAX_CONTENT_LENGTH,
  MAX_LINES,
  SignatureValidationError,
  cleanSignatureName,
  cleanSignatureContent,
};
