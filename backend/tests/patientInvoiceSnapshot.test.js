const test = require("node:test");
const assert = require("node:assert/strict");
const { buildInvoicePdfBuffer } = require("../utils/invoicePdf");
const { buildInvoiceEmailHTML } = require("../utils/sendEmail");
const { extractText, contentHash } = require("./helpers/pdfText");
const golden = require("./fixtures/patientInvoice.golden.json");

// The golden values were captured from the patient/consultation invoice
// BEFORE payment-link B2C invoices were added (see paymentLinkB2c.test.js).
// Any change to the patient PDF or email makes these fail.
const patientInvoice = () =>
  buildInvoicePdfBuffer({
    invoiceNumber: "HC01-2610",
    issuedAt: new Date("2026-10-28T10:00:00Z"),
    billTo: { name: "Rahul Mehta", email: "rahul@example.com" },
    description: "Consultation booking fee",
    amountCents: 7500,
    currency: "usd",
    gateway: "stripe",
    gatewayReference: "pi_123",
  });

test("patient consultation invoice PDF is drawn exactly as before", async () => {
  const pdf = await patientInvoice();
  assert.equal(extractText(pdf), golden.pdfText);
  assert.equal(contentHash(pdf), golden.pdfHash);
});

test("patient invoice email HTML is unchanged", () => {
  const html = buildInvoiceEmailHTML({
    name: "Rahul Mehta",
    invoiceNumber: "HC01-2610",
    amountDisplay: "$75.00",
    description: "Consultation booking fee",
  }).replace(String(new Date().getFullYear()), "{{YEAR}}");
  assert.equal(html, golden.emailHtml);
});

// The B2B (manual) invoice shares the template; its due and paid renderings
// must not move either.
const manualBase = {
  invoiceNumber: "HC02-2610",
  issuedAt: new Date("2026-10-28T10:00:00Z"),
  billTo: { name: "Nova", email: "n@x.com", company: "Nova LTD", address: "Chisinau", country: "MD", postalCode: "2001", registrationNumber: "R1" },
  description: "Thanks",
  amountCents: 34950,
  currency: "usd",
  documentType: "manual",
  items: [
    { description: "House call", quantity: 2, rate: 150, amountCents: 30000 },
    { description: "Report", quantity: 1, rate: 49.5, amountCents: 4950 },
  ],
  dueDate: new Date("2026-12-01T00:00:00Z"),
  paymentTerms: "Net 30 Days",
};

test("B2B manual invoice PDFs (due and paid) are drawn exactly as before", async () => {
  assert.equal(contentHash(await buildInvoicePdfBuffer({ ...manualBase, status: "due" })), golden.manualDueHash);
  assert.equal(contentHash(await buildInvoicePdfBuffer({ ...manualBase, status: "paid" })), golden.manualPaidHash);
});
