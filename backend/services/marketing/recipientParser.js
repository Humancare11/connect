// Turns what the admin typed or uploaded into a clean recipient list. Pure: no database, no logging.
//
// Modes
//   emails  addresses separated by commas, semicolons or new lines ("Name <a@b.com>" is accepted too)
//   lines   one person per line: "Name, email"  or  "Name, Company, email"
//   csv     header row with columns name, company (optional), email
// Result: valid recipients (case-insensitive de-duplication, first one wins), the invalid addresses, and how
// many duplicates were dropped. The caller then removes suppressed (unsubscribed) addresses.

class RecipientInputError extends Error {
  constructor(message, code = "BAD_INPUT") {
    super(message);
    this.name = "RecipientInputError";
    this.code = code;
  }
}

const MAX_ROWS_SCANNED = 50_000;
const MAX_INVALID_LISTED = 200;

const EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/i;

function isValidEmail(value) {
  const email = String(value || "").trim();
  if (!email || email.length > 254) return false;
  if (!EMAIL_RE.test(email)) return false;
  const [local] = email.split("@");
  return local.length <= 64 && !local.startsWith(".") && !local.endsWith(".") && !local.includes("..");
}

const cleanText = (value, max) =>
  String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

// RFC 4180 style: quoted fields, "" for a quote, CRLF or LF, optional BOM. Blank lines are skipped.
function parseDelimited(text, delimiter = ",") {
  const src = String(text ?? "").replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
    row = [];
  };
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"' && field === "") inQuotes = true;
    else if (ch === delimiter) endField();
    else if (ch === "\n") endRow();
    else if (ch === "\r") {
      if (src[i + 1] === "\n") i += 1;
      endRow();
    } else field += ch;
    if (rows.length > MAX_ROWS_SCANNED) throw new RecipientInputError("That file has too many rows.", "TOO_MANY_ROWS");
  }
  if (field !== "" || row.length) endRow();
  return rows;
}

// "Name <a@b.com>" -> { name, email }; anything else is taken as the address itself.
function splitAngle(token) {
  const m = /^(.*?)<([^<>]+)>\s*$/.exec(token);
  return m ? { name: m[1].replace(/^["'\s]+|["'\s]+$/g, ""), email: m[2].trim() } : { name: "", email: token.trim() };
}

function rowsFrom(mode, text) {
  const raw = String(text ?? "");
  if (mode === "emails") {
    return raw
      .split(/[,;\r\n]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => splitAngle(t));
  }
  if (mode === "lines") {
    return parseDelimited(raw.replace(/;/g, ","), ",").map((parts) => {
      const cells = parts.map((p) => p.trim());
      if (cells.length === 1) return splitAngle(cells[0]);
      if (cells.length === 2) return { name: cells[0], email: cells[1] };
      return { name: cells[0], company: cells.slice(1, -1).filter(Boolean).join(", "), email: cells[cells.length - 1] };
    });
  }
  if (mode === "csv") {
    const firstLine = raw.replace(/^﻿/, "").split(/\r?\n/, 1)[0] || "";
    const delimiter = firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";
    const table = parseDelimited(raw, delimiter);
    if (!table.length) return [];
    const header = table[0].map((h) => h.trim().toLowerCase());
    const col = (names) => header.findIndex((h) => names.includes(h));
    const emailAt = col(["email", "e-mail", "email address", "emailaddress"]);
    if (emailAt < 0) throw new RecipientInputError("The CSV needs a header row with an email column (name, company, email).", "NO_EMAIL_COLUMN");
    const nameAt = col(["name", "full name", "fullname"]);
    const companyAt = col(["company", "organisation", "organization"]);
    return table.slice(1).map((cells) => ({
      name: nameAt >= 0 ? cells[nameAt] || "" : "",
      company: companyAt >= 0 ? cells[companyAt] || "" : "",
      email: cells[emailAt] || "",
    }));
  }
  throw new RecipientInputError("Choose how the recipients are entered.", "BAD_MODE");
}

// → { recipients: [{ name, company, email }], invalid: [string], invalidCount, duplicates }
function parseRecipientInput({ mode, text }, { max = 2000 } = {}) {
  const rows = rowsFrom(mode, text);
  if (rows.length > MAX_ROWS_SCANNED) throw new RecipientInputError("That list has too many rows.", "TOO_MANY_ROWS");

  const seen = new Set();
  const recipients = [];
  const invalid = [];
  let invalidCount = 0;
  let duplicates = 0;

  for (const row of rows) {
    const email = String(row.email || "").trim();
    if (!isValidEmail(email)) {
      invalidCount += 1;
      if (invalid.length < MAX_INVALID_LISTED) invalid.push(cleanText(email, 120) || "(empty)");
      continue;
    }
    const key = email.toLowerCase();
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    recipients.push({ name: cleanText(row.name, 120), company: cleanText(row.company, 160), email: key });
  }

  if (recipients.length > max) {
    throw new RecipientInputError(`A campaign can have at most ${max} recipients. This list has ${recipients.length}.`, "TOO_MANY_RECIPIENTS");
  }
  return { recipients, invalid, invalidCount, duplicates };
}

module.exports = { parseRecipientInput, parseDelimited, isValidEmail, RecipientInputError };
