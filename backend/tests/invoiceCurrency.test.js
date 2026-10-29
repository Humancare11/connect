// Phase D2: the receipt email and the invoice PDF show the payment's own currency symbol and amount
// ($30.00 / €30.00 / £30.00). The real billing flow runs (Payment + Invoice records, the PDF, the email body); only S3 and
// the SMTP transport are replaced.
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const zlib = require("node:zlib");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.SMTP_HOST = "smtp.test.local";
process.env.SMTP_PORT = "587";
process.env.SMTP_USER = "tester";
process.env.EMAIL_USER = "alert@test.local";

// The transport is replaced before sendEmail.js is loaded.
const mails = [];
require("nodemailer").createTransport = () => ({ sendMail: async (message) => { mails.push(message); } });
const uploads = [];
require("../utils/uploadStorage").storeUploadInS3 = async (file) => { uploads.push(file); return { key: `invoices/${file.originalname}` }; };

const Payment = require("../models/Payment");
const Invoice = require("../models/Invoice");
const { recordPaymentAndInvoice } = require("../utils/billing");
const { formatAmount, buildInvoicePdfBuffer } = require("../utils/invoicePdf");

// The visible text of a PDF made by pdfkit with the standard fonts: inflate every stream and read the text-show
// operators. Standard fonts are WinAnsi, where 0x80 is the euro sign (the pound sign and "$" are plain Latin-1).
function pdfText(buffer) {
  const raw = buffer.toString("latin1");
  const lines = [];
  const streams = /stream\r?\n/g;
  let match;
  while ((match = streams.exec(raw))) {
    const start = match.index + match[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) break;
    let content;
    try { content = zlib.inflateSync(buffer.subarray(start, end)).toString("latin1"); } catch { continue; }
    for (const op of content.matchAll(/\[([^\]]*)\]\s*TJ|<([0-9a-fA-F]+)>\s*Tj/g)) {
      const hexes = op[1] !== undefined ? [...op[1].matchAll(/<([0-9a-fA-F]+)>/g)].map((h) => h[1]) : [op[2]];
      lines.push(hexes.map((h) => Buffer.from(h, "hex").toString("latin1")).join("").replace(/\u0080/g, "€"));
    }
  }
  return lines.join("\n");
}

describe("receipts and invoices in USD / EUR / GBP", () => {
  let mongod;
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([Payment.init(), Invoice.init()]);
  });
  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    mails.length = 0;
    uploads.length = 0;
    await Promise.all([Payment.deleteMany({}), Invoice.deleteMany({})]);
  });

  describe("formatAmount", () => {
    test("shows the right symbol and two decimals", () => {
      assert.equal(formatAmount(3000, "usd"), "$30.00");
      assert.equal(formatAmount(3000, "eur"), "€30.00");
      assert.equal(formatAmount(3000, "gbp"), "£30.00");
      assert.equal(formatAmount(2550, "GBP"), "£25.50");
      assert.equal(formatAmount(123456, "eur"), "€1,234.56");
    });
  });

  for (const [currency, symbol] of [["usd", "$"], ["eur", "€"], ["gbp", "£"]]) {
    describe(`a ${currency.toUpperCase()} payment`, () => {
      test(`is recorded with its currency, and the receipt email and PDF show ${symbol}30.00`, async () => {
        const userId = new mongoose.Types.ObjectId();
        await recordPaymentAndInvoice({
          userId,
          userName: "Pat Patient",
          userEmail: "pat@example.com",
          gateway: "stripe",
          gatewayReference: `pi_${currency}`,
          amountCents: 3000,
          currency,
          description: "General Care consultation booking",
        });

        const payment = await Payment.findOne({ gatewayReference: `pi_${currency}` }).lean();
        const invoice = await Invoice.findOne({ payment: payment._id }).lean();
        assert.deepEqual([payment.currency, payment.amountCents], [currency, 3000]);
        assert.deepEqual([invoice.currency, invoice.amountCents], [currency, 3000]);

        // The email: the amount line is in the payment's currency, and nothing says dollars for a EUR / GBP payment.
        assert.equal(mails.length, 1);
        const html = mails[0].html;
        assert.ok(html.includes(`${symbol}30.00`), `email should contain ${symbol}30.00`);
        if (currency !== "usd") assert.ok(!html.includes("$30.00"), "a non-USD receipt must not show a dollar amount");

        // The PDF that was uploaded and the copy attached to the email.
        assert.equal(uploads.length, 1);
        for (const pdf of [uploads[0].buffer, mails[0].attachments[0].content]) {
          const text = pdfText(pdf);
          assert.ok(text.includes(`${symbol}30.00`), `PDF should contain ${symbol}30.00`);
          assert.ok(text.includes(`${currency.toUpperCase()} (${symbol})`), `PDF should name the currency ${currency.toUpperCase()} (${symbol})`);
          if (currency !== "usd") assert.ok(!text.includes("$30.00"), "a non-USD invoice must not show a dollar amount");
        }
      });
    });
  }

  test("a repeat call for the same payment does not create a second invoice or email", async () => {
    const args = {
      userId: new mongoose.Types.ObjectId(), userName: "Pat", userEmail: "pat@example.com", gateway: "paypal",
      gatewayReference: "ORDER_X", amountCents: 2500, currency: "gbp", description: "x",
    };
    await recordPaymentAndInvoice(args);
    await recordPaymentAndInvoice(args);
    assert.equal(await Payment.countDocuments({}), 1);
    assert.equal(await Invoice.countDocuments({}), 1);
    assert.equal(mails.length, 1);
    assert.ok(mails[0].html.includes("£25.00"));
  });

  test("the PDF builder itself prints each currency symbol", async () => {
    for (const [currency, symbol] of [["usd", "$"], ["eur", "€"], ["gbp", "£"]]) {
      const pdf = await buildInvoicePdfBuffer({
        invoiceNumber: "HC01-2611", issuedAt: new Date(), billTo: { name: "Pat", email: "p@x.co" },
        description: "Test", amountCents: 3000, currency, gateway: "stripe", gatewayReference: "pi_1",
      });
      assert.ok(pdfText(pdf).includes(`${symbol}30.00`), currency);
    }
  });
});
