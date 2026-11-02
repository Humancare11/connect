// Small display helpers for the Recent Payments table on the Payment Links page.

// "28 Oct 2026, 12:33 pm" (what formatDate in PaymentLinks.jsx returns) -> the
// date on one line and the time under it. Only splits the string it is given, so
// the date format and timezone stay whatever formatDate produces.
export function splitDateTime(formatted) {
  const text = String(formatted ?? "");
  const at = text.indexOf(", ");
  return at === -1 ? { date: text, time: "" } : { date: text.slice(0, at), time: text.slice(at + 2) };
}

// Who a link is for. Links created before customer names were stored have
// neither a name nor an email, so every field falls back instead of throwing.
export function personOf(link) {
  const invoice = link?.invoice;
  return {
    name: link?.customerName || invoice?.clientName || "-",
    email: link?.customerEmail || invoice?.clientEmail || "",
  };
}
