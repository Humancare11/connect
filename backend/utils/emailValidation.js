const addressParser = require("nodemailer/lib/addressparser");

// Limits for mail sent from the dashboard. Gmail caps a message at ~25 MB and
// base64 inflates attachments by ~37%, so ~18 MB of raw files is the safe ceiling.
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 18 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;
const MAX_RECIPIENTS = 50;
const MAX_SUBJECT_LENGTH = 998;
const MAX_BODY_LENGTH = 200_000;

const ADDRESS_RE = /^[^\s@<>(),;:"[\]\\]+@[^\s@<>(),;:"[\]\\]+\.[^\s@<>(),;:"[\]\\]+$/;

class EmailValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "EmailValidationError";
    this.status = 400;
  }
}

// Header values must never contain CR/LF (header injection).
const LINE_BREAKS_RE = new RegExp("[\\r\\n\\u2028\\u2029]+", "g");

function stripLineBreaks(value) {
  return String(value ?? "").replace(LINE_BREAKS_RE, " ").trim();
}

function cleanSubject(value) {
  const subject = stripLineBreaks(value);
  if (subject.length > MAX_SUBJECT_LENGTH) {
    throw new EmailValidationError(`Subject is too long (max ${MAX_SUBJECT_LENGTH} characters).`);
  }
  return subject;
}

// Accepts an array or a comma/semicolon separated string. Returns
// [{ name, address }] with lowercased, de-duplicated, validated addresses.
function normalizeAddressList(input, { label = "Recipient", required = false } = {}) {
  const raw = Array.isArray(input) ? input.join(",") : String(input ?? "").replace(/;/g, ",");
  const parsed = raw.trim() ? addressParser(raw, { flatten: true }) : [];

  const seen = new Set();
  const list = [];
  for (const entry of parsed) {
    const address = String(entry.address || "").trim().toLowerCase();
    if (!ADDRESS_RE.test(address) || address.length > 254) {
      throw new EmailValidationError(`${label} "${stripLineBreaks(entry.address || raw).slice(0, 80)}" is not a valid email address.`);
    }
    if (seen.has(address)) continue;
    seen.add(address);
    list.push({ name: stripLineBreaks(entry.name).slice(0, 200), address });
  }
  if (required && list.length === 0) throw new EmailValidationError(`${label} is required.`);
  return list;
}

function assertRecipientCount(...lists) {
  const total = lists.reduce((n, l) => n + l.length, 0);
  if (total > MAX_RECIPIENTS) {
    throw new EmailValidationError(`Too many recipients (max ${MAX_RECIPIENTS}).`);
  }
}

module.exports = {
  EmailValidationError,
  MAX_ATTACHMENT_BYTES,
  MAX_TOTAL_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  MAX_RECIPIENTS,
  MAX_SUBJECT_LENGTH,
  MAX_BODY_LENGTH,
  stripLineBreaks,
  cleanSubject,
  normalizeAddressList,
  assertRecipientCount,
};
