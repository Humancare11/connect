// Request validation shared by the Manual Invoices routes and the Payment
// Links routes (a payment-link invoice is a ManualInvoice, so both accept the
// same bill-to details, items and due date).

const EMAIL_RE = /^\S+@\S+\.\S+$/;
// INR intentionally excluded — only these three currencies are offered on
// the form (ManualInvoices.jsx), validated here too so a stored/printed
// invoice can never end up in an arbitrary client-supplied currency.
const ALLOWED_CURRENCIES = ["usd", "eur", "gbp"];
const MAX_LENGTHS = {
  clientName: 120,
  clientEmail: 254,
  description: 500,
  paymentMethod: 80,
  companyName: 160,
  registrationNumber: 60,
  address: 200,
  country: 100,
  postalCode: 30,
  paymentTerms: 40,
  itemDescription: 200,
};
// $1,000,000 ceiling — guards against a fat-finger typo (e.g. a stray extra
// digit) minting a wildly oversized invoice; not a business limit.
const MAX_AMOUNT_CENTS = 100_000_000;
const MAX_ITEMS = 50;

// Same rounding rule the form's live preview uses (ManualInvoices.jsx's
// computeItemAmountCents) — computed server-side here too since the client
// total is never trusted as-is.
function computeItemAmountCents(quantity, rate) {
  const rateCents = Math.round(rate * 100);
  return Math.round(quantity * rateCents);
}

// Validates and normalizes the raw items array from the request body.
// Returns { items, amountCents } on success, or { error } on failure.
function parseItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { error: "Add at least one invoice item." };
  }
  if (rawItems.length > MAX_ITEMS) {
    return { error: `An invoice can have at most ${MAX_ITEMS} items.` };
  }

  const items = [];
  let amountCents = 0;
  for (const raw of rawItems) {
    const description = String(raw?.description || "").trim();
    const quantity = Number(raw?.quantity);
    const rate = Number(raw?.rate);

    if (!description || description.length > MAX_LENGTHS.itemDescription) {
      return { error: "Each item needs a description under 200 characters." };
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { error: "Each item needs a quantity greater than zero." };
    }
    if (!Number.isFinite(rate) || rate < 0) {
      return { error: "Each item needs a valid, non-negative rate." };
    }

    const itemAmountCents = computeItemAmountCents(quantity, rate);
    items.push({ description, quantity, rate, amountCents: itemAmountCents });
    amountCents += itemAmountCents;
  }

  if (amountCents <= 0) {
    return { error: "Enter a valid amount greater than zero." };
  }
  return { items, amountCents };
}

// dueDate arrives as a "YYYY-MM-DD" date-input string; empty/invalid input
// is fine (dueDate is optional) but a non-empty unparsable string is not.
function parseDueDate(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === "") return { dueDate: null };
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return { error: "Enter a valid due date." };
  return { dueDate: parsed };
}

// The "Billed To" block plus payment terms and the free-text Notes field.
// `body` uses the request field names of POST /api/admin/manual-invoices
// (name, email, companyName, ...). Returns { details } or { error }.
function parseBillingDetails(body = {}) {
  const details = {
    clientName: String(body.name || "").trim(),
    clientEmail: String(body.email || "").trim().toLowerCase(),
    companyName: String(body.companyName || "").trim(),
    registrationNumber: String(body.registrationNumber || "").trim(),
    address: String(body.address || "").trim(),
    country: String(body.country || "").trim(),
    postalCode: String(body.postalCode || "").trim(),
    paymentTerms: String(body.paymentTerms || "").trim() || "Due on Receipt",
    // description is the optional free-text "Notes" field, not a billable
    // line item — the itemized lines carry that.
    description: String(body.description || "").trim(),
  };

  if (!details.clientName || !details.clientEmail) {
    return { error: "Name and email are required." };
  }
  if (!EMAIL_RE.test(details.clientEmail)) {
    return { error: "Enter a valid client email address." };
  }
  if (
    details.clientName.length > MAX_LENGTHS.clientName ||
    details.clientEmail.length > MAX_LENGTHS.clientEmail ||
    details.description.length > MAX_LENGTHS.description ||
    details.companyName.length > MAX_LENGTHS.companyName ||
    details.registrationNumber.length > MAX_LENGTHS.registrationNumber ||
    details.address.length > MAX_LENGTHS.address ||
    details.country.length > MAX_LENGTHS.country ||
    details.postalCode.length > MAX_LENGTHS.postalCode ||
    details.paymentTerms.length > MAX_LENGTHS.paymentTerms
  ) {
    return { error: "One or more fields exceed the allowed length." };
  }
  return { details };
}

module.exports = {
  EMAIL_RE,
  ALLOWED_CURRENCIES,
  MAX_LENGTHS,
  MAX_AMOUNT_CENTS,
  MAX_ITEMS,
  computeItemAmountCents,
  parseItems,
  parseDueDate,
  parseBillingDetails,
};
