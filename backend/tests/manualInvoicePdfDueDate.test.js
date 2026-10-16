const test = require("node:test");
const assert = require("node:assert/strict");
const zlib = require("node:zlib");
const { buildInvoicePdfBuffer } = require("../utils/invoicePdf");

// Pulls the drawn text out of a pdfkit PDF using only zlib: inflate every
// stream, then decode the TJ hex strings pdfkit writes for standard fonts.
function extractText(buf) {
  const raw = buf.toString("latin1");
  let out = "";
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(raw))) {
    const start = m.index + m[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) break;
    let content;
    try {
      content = zlib.inflateSync(buf.subarray(start, end)).toString("latin1");
    } catch {
      continue;
    }
    // Kerning splits a word across a TJ array's hex pieces; rejoin them.
    for (const arr of content.matchAll(/\[([^\]]*)\]\s*TJ/g)) {
      for (const h of arr[1].matchAll(/<([0-9a-fA-F]*)>/g)) {
        out += Buffer.from(h[1], "hex").toString("latin1");
      }
      out += "\n";
    }
  }
  return out;
}

const base = {
  invoiceNumber: "INV-TEST-1",
  issuedAt: new Date("2026-01-01"),
  billTo: { name: "Acme", email: "a@example.com" },
  description: "Test",
  amountCents: 10000,
  currency: "USD",
  documentType: "manual",
  items: [{ description: "Visit", quantity: 1, rate: 100, amountCents: 10000 }],
  dueDate: new Date("2026-02-01"),
  paymentTerms: "Net 30 Days",
};

test("paid manual invoice PDF omits all due-date content", async () => {
  const text = extractText(await buildInvoicePdfBuffer({ ...base, status: "paid" }));
  assert.ok(text.includes("PAYMENT TERMS"), "sanity: text extraction works");
  assert.ok(!text.includes("DUE DATE"));
  assert.ok(!text.includes("Payment Due Date"));
  assert.ok(!text.includes("by the due date indicated"));
});

test("unpaid manual invoice PDF still shows the due date", async () => {
  const text = extractText(await buildInvoicePdfBuffer({ ...base, status: "due" }));
  assert.ok(text.includes("DUE DATE"));
  assert.ok(text.includes("Payment Due Date"));
});
