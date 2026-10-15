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

module.exports = {
  MAX_SIGNATURES,
  MAX_NAME_LENGTH,
  MAX_CONTENT_LENGTH,
  MAX_LINES,
  SignatureValidationError,
  cleanSignatureName,
  cleanSignatureContent,
};
