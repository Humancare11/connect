// Invoice-form helpers shared by Manual Invoices and Payment Links, so both
// forms price, date and word an invoice identically (the server recomputes the
// same rules in backend/utils/manualInvoiceValidation.js).

// value/days pairs drive the "Payment Terms" select — picking one recomputes
// the Due Date field to today + days, while the Due Date itself stays freely
// editable afterward for a one-off exception.
export const PAYMENT_TERMS_OPTIONS = [
  { value: "Due on Receipt", days: 0 },
  { value: "Net 15 Days", days: 15 },
  { value: "Net 30 Days", days: 30 },
  { value: "Net 60 Days", days: 60 },
];

// Net 30 — the default both forms start on.
export const DEFAULT_PAYMENT_TERMS = PAYMENT_TERMS_OPTIONS[2];

export function toDateInputValue(date) {
  const d = new Date(date);
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

// The "YYYY-MM-DD" due date for a payment-terms label, counted from `from`.
export function dueDateForTerms(terms, from = Date.now()) {
  const preset = PAYMENT_TERMS_OPTIONS.find((option) => option.value === terms);
  return preset ? toDateInputValue(from + preset.days * 86400000) : null;
}

export function computeItemAmountCents(item) {
  const quantity = Number(item.quantity);
  const rate = Number(item.rate);
  if (
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    !Number.isFinite(rate) ||
    rate < 0
  )
    return 0;
  const rateCents = Math.round(rate * 100);
  return Math.round(quantity * rateCents);
}

export function termsLine(paymentTerms) {
  return paymentTerms === "Due on Receipt"
    ? "Payment is due immediately on receipt of this invoice. Please remit payment for the amount above without delay."
    : `Payment is due within ${paymentTerms.replace(/\D/g, "")} days from the invoice date (${paymentTerms.replace(
        " Days",
        "",
      )}). Please remit payment for the amount above by the due date indicated.`;
}
