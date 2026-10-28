const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { extractText } = require("./helpers/pdfText");
const { normalizeB2cItems } = require("../utils/manualInvoiceValidation");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";
process.env.FRONTEND_URL = "https://app.test";

// ---- outside world, installed before the routes load ----
const stored = new Map(); // S3 key -> PDF bytes (the real PDF, so tests can read it)
const uploadStorage = require("../utils/uploadStorage");
uploadStorage.storeUploadInS3 = async (file) => {
  stored.set(file.filename, file.buffer);
  return { key: file.filename };
};
uploadStorage.getUploadBuffer = async (key) => stored.get(key);

const sendEmail = require("../utils/sendEmail");
const mails = []; // { kind: "patient-style" | "b2b", to, ...payload }
sendEmail.sendInvoiceEmail = async (to, payload) => mails.push({ kind: "patient-style", to, ...payload });
sendEmail.sendManualInvoiceEmail = async (to, payload) => mails.push({ kind: "b2b", to, ...payload });

const stripeState = { intent: null };
const stripePath = require.resolve("stripe");
require.cache[stripePath] = {
  id: stripePath,
  filename: stripePath,
  loaded: true,
  exports: () => ({ paymentIntents: { retrieve: async () => stripeState.intent, create: async () => ({}) } }),
};

const verifyToken = require("../middleware/verifyToken");
verifyToken.verifyAdminToken = (req, res, next) => {
  const role = req.headers["x-test-role"];
  if (!role) return res.status(401).json({ msg: "No token provided." });
  req.user = { id: req.headers["x-test-user"] || "000000000000000000000001", role };
  next();
};

const PaymentLink = require("../models/PaymentLink");
const ManualInvoice = require("../models/ManualInvoice");
const paymentsRouter = require("../routes/payments");
const manualInvoicesRouter = require("../routes/manualInvoices");
const { buildInvoiceEmailHTML } = sendEmail;

const b2c = (extra = {}) => ({
  customerType: "b2c",
  name: "Rahul Mehta",
  email: "Rahul.Mehta@Gmail.com",
  items: [
    { description: "Tele Consultation", amount: 75 },
    { description: "Follow-up report", amount: 20.5 },
  ],
  note: "internal",
  ...extra,
});

describe("B2C payment link invoices", () => {
  let mongod, server, base;

  const call = async (method, path, { role = "paymentadmin", json } = {}) => {
    const headers = { "content-type": "application/json" };
    if (role) headers["x-test-role"] = role;
    const res = await fetch(`${base}${path}`, { method, headers, body: json === undefined ? undefined : JSON.stringify(json) });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
  const create = (json = b2c()) => call("POST", "/api/payments/admin/payment-links", { json });
  const pdfText = async (invoiceId) => extractText(stored.get((await ManualInvoice.findById(invoiceId)).pdfKey));
  const intentFor = (link) => ({
    id: "pi_b2c",
    status: "succeeded",
    amount: link.amountPaise,
    currency: link.currency,
    metadata: { paymentLinkId: String(link._id) },
    payment_method: { type: "card", card: { last4: "4242", brand: "visa", funding: "credit" } },
  });
  const confirm = (token) =>
    call("POST", `/api/payments/payment-links/${token}/confirm`, { role: "", json: { paymentIntentId: "pi_b2c" } });

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await ManualInvoice.init();
    const app = express();
    app.use(express.json());
    app.use("/api/payments", paymentsRouter);
    app.use("/api/admin/manual-invoices", manualInvoicesRouter);
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    await PaymentLink.deleteMany({});
    await ManualInvoice.deleteMany({});
    mails.length = 0;
    stored.clear();
    stripeState.intent = null;
  });

  test("create: a due b2c invoice in the consultation layout, one row per service, nothing emailed", async () => {
    const { status, body } = await create();
    assert.equal(status, 201);
    assert.equal(body.customerType, "b2c");
    assert.equal(body.amountPaise, 9550); // 75.00 + 20.50, server-computed
    assert.equal(body.invoice.status, "due");
    assert.equal(body.invoice.customerType, "b2c");
    assert.equal(body.invoice.emailed, false);
    assert.match(body.invoice.invoiceNumber, /^HC\d{2}-\d{4}$/);
    assert.equal(mails.length, 0);

    const invoice = await ManualInvoice.findById(body.invoice._id);
    assert.equal(invoice.source, "payment_link");
    assert.equal(invoice.customerType, "b2c");
    assert.equal(invoice.clientEmail, "rahul.mehta@gmail.com");
    assert.equal(invoice.paymentTerms, "Due on Receipt");
    assert.equal(invoice.dueDate, null);
    assert.deepEqual(invoice.items.map((i) => [i.description, i.quantity, i.amountCents]), [
      ["Tele Consultation", 1, 7500],
      ["Follow-up report", 1, 2050],
    ]);

    const text = await pdfText(invoice._id);
    for (const expected of ["Rahul Mehta", "rahul.mehta@gmail.com", "Tele Consultation", "$75.00", "Follow-up report", "$20.50", "Amount Due:", "$95.50",
      "STATUS: DUE", "secure payment link sent with this invoice", "Thank you for choosing Humancare Connect"]) {
      assert.ok(text.includes(expected), `PDF should contain "${expected}"`);
    }
    for (const absent of ["QTY", "RATE", "DUE DATE", "PAYMENT TERMS", "TERMS", "Total Paid", "UNPAID"]) {
      assert.ok(!text.includes(absent), `PDF should not contain "${absent}"`);
    }
  });

  test("create: company, address and the other B2B fields are ignored and never printed", async () => {
    const { body } = await create(
      b2c({
        companyName: "Evil Corp",
        registrationNumber: "REG-999",
        address: "1 Secret Street",
        country: "Atlantis",
        postalCode: "ZZ-1",
        paymentTerms: "Net 60 Days",
        dueDate: "2027-01-01",
        description: "internal notes text",
      })
    );
    const invoice = await ManualInvoice.findById(body.invoice._id);
    for (const field of ["companyName", "registrationNumber", "address", "country", "postalCode"]) assert.equal(invoice[field], "", field);
    assert.equal(invoice.paymentTerms, "Due on Receipt");
    assert.equal(invoice.dueDate, null);
    assert.equal(invoice.description, "");

    const text = await pdfText(invoice._id);
    for (const leaked of ["Evil Corp", "REG-999", "Secret Street", "Atlantis", "ZZ-1", "Net 60", "internal notes text"]) {
      assert.ok(!text.includes(leaked), `PDF must not contain "${leaked}"`);
    }
  });

  test("create: validation covers name, email and services only", async () => {
    assert.equal((await create(b2c({ name: "" }))).status, 400);
    assert.equal((await create(b2c({ email: "nope" }))).status, 400);
    assert.equal((await create(b2c({ items: [] }))).status, 400);
    assert.equal((await create(b2c({ items: [{ description: "", amount: 5 }] }))).status, 400);
    assert.equal((await create(b2c({ items: [{ description: "x", amount: 0 }] }))).status, 400);
    assert.equal((await create(b2c({ items: [{ description: "x", amount: -3 }] }))).status, 400);
    assert.equal(await PaymentLink.countDocuments(), 0);
  });

  // The reported bug: "Each item needs a quantity greater than zero." on a B2C link. A B2C service has
  // no quantity field, so the request carries none; the server must treat every service as quantity 1.
  test("create: a service with no quantity is accepted (quantity 1, rate = amount) and the invoice is due", async () => {
    const { status, body } = await create({
      customerType: "b2c", name: "Rahul Mehta", email: "rahul@example.com", note: "na", currency: "USD",
      items: [{ description: "tele consultation", amount: 100 }],
    });
    assert.equal(status, 201);
    assert.equal(body.invoice.status, "due");
    assert.equal(body.amountPaise, 10000);
    const invoice = await ManualInvoice.findById(body.invoice._id);
    assert.deepEqual(invoice.items.map((i) => [i.description, i.quantity, i.rate, i.amountCents]), [["tele consultation", 1, 100, 10000]]);
  });

  test("create: a client-sent quantity is ignored — it stays 1 and the amount is the rate", async () => {
    const { status, body } = await create(b2c({ amount: 1, items: [{ description: "x", amount: 10, quantity: 5 }, { description: "y", amount: 2.5, quantity: 0 }] }));
    assert.equal(status, 201);
    assert.equal(body.amountPaise, 1250);
    const invoice = await ManualInvoice.findById(body.invoice._id);
    assert.deepEqual(invoice.items.map((i) => [i.quantity, i.rate, i.amountCents]), [[1, 10, 1000], [1, 2.5, 250]]);
  });

  test("normalizeB2cItems: quantity 1 and rate = amount, whatever the client sent", () => {
    assert.deepEqual(normalizeB2cItems([{ description: "a", amount: 7, quantity: 9, rate: 99 }, { description: "b", amount: 3 }]), [
      { description: "a", quantity: 1, rate: 7 },
      { description: "b", quantity: 1, rate: 3 },
    ]);
    assert.deepEqual(normalizeB2cItems(undefined), []);
  });

  test("a B2C request with no services, or a bad amount, is still rejected", async () => {
    assert.equal((await create(b2c({ items: undefined }))).status, 400);
    assert.equal((await create(b2c({ items: [{ description: "x" }] }))).status, 400);
    assert.equal((await create(b2c({ items: [{ description: "x", amount: "abc" }] }))).status, 400);
  });

  // ---- B2B is switched off (B2B_PAYMENT_LINKS_ENABLED = false in routes/payments.js) ----
  test("a new link without a customerType is a B2C link", async () => {
    const { customerType, ...noType } = b2c();
    const { status, body } = await create(noType);
    assert.equal(status, 201);
    assert.equal(body.customerType, "b2c");
    assert.equal(body.invoice.customerType, "b2c");
    assert.equal((await create(b2c({ customerType: "something-else" }))).body.customerType, "b2c");
  });

  test("customerType b2b is refused with 400 while B2B is disabled, and nothing is created", async () => {
    const { status, body } = await create(b2c({ customerType: "b2b" }));
    assert.equal(status, 400);
    assert.equal(body.msg, "Business payment links are not enabled yet.");
    assert.equal(await PaymentLink.countDocuments(), 0);
    assert.equal(await ManualInvoice.countDocuments(), 0);

    const bizPayload = { customerType: "b2b", name: "Nova", email: "n@example.com", paymentTerms: "Net 30 Days", items: [{ description: "House call", quantity: 2, rate: 150 }] };
    assert.equal((await create(bizPayload)).status, 400);
  });

  // B2B disabled for now (see B2B_PAYMENT_LINKS_ENABLED in routes/payments.js): re-enable with the flag.
  test.skip("B2B: customerType b2b keeps the business form's own layout", async () => {
    const b2b = {
      customerType: "b2b", name: "Nova", email: "n@example.com", paymentTerms: "Net 30 Days", dueDate: "2026-12-01",
      items: [{ description: "House call", quantity: 2, rate: 150 }],
    };
    const { body } = await create(b2b);
    assert.equal(body.customerType, "b2b");
    const text = await pdfText(body.invoice._id);
    assert.ok(text.includes("QTY") && text.includes("PAYMENT TERMS"), "B2B keeps its own layout");
  });

  test("send email: patient-style email, Pay now on the due invoice, escaped, only on request", async () => {
    const { body } = await create(b2c({ name: "<b>Rahul</b>" }));
    assert.equal(mails.length, 0);

    const sent = await call("POST", `/api/payments/admin/payment-links/${body._id}/invoice/send-email`);
    assert.equal(sent.status, 200);
    assert.equal(sent.body.invoice.emailed, true);
    assert.equal(mails.length, 1);
    const mail = mails[0];
    assert.equal(mail.kind, "patient-style");
    assert.equal(mail.to, "rahul.mehta@gmail.com");
    assert.equal(mail.status, "due");
    assert.equal(mail.forLinkPayer, true);
    assert.equal(mail.payUrl, `https://app.test/pay/${body.token}`);
    assert.equal(mail.description, "Tele Consultation, Follow-up report");

    const html = buildInvoiceEmailHTML(mail);
    assert.ok(html.includes("Pay now") && html.includes(mail.payUrl));
    assert.ok(html.includes("Amount Due"));
    assert.ok(html.includes("&lt;b&gt;Rahul&lt;/b&gt;") && !html.includes("<b>Rahul</b>"));
    assert.ok(!html.includes("Payment History"));
  });

  test("confirm: the same invoice becomes a paid receipt (Total Paid, PAID), no email", async () => {
    const { body } = await create();
    await call("POST", `/api/payments/admin/payment-links/${body._id}/invoice/send-email`);
    assert.equal(mails.length, 1);

    stripeState.intent = intentFor(await PaymentLink.findById(body._id));
    assert.equal((await confirm(body.token)).status, 200);

    const invoice = await ManualInvoice.findById(body.invoice._id);
    assert.equal(invoice.status, "paid");
    assert.equal(invoice.invoiceNumber, body.invoice.invoiceNumber);
    assert.equal(invoice.gatewayReference, "pi_b2c");
    assert.equal(invoice.customerType, "b2c");
    assert.equal(invoice.emailedAt, null, "the paid receipt is a new document, so it is unsent until Send Email");
    assert.equal(mails.length, 1, "paying must not send an email");

    const text = await pdfText(invoice._id);
    for (const expected of ["Total Paid:", "$95.50", "STATUS: PAID", "No balance outstanding", "Tele Consultation", "Follow-up report"]) {
      assert.ok(text.includes(expected), `receipt should contain "${expected}"`);
    }
    for (const absent of ["Amount Due", "STATUS: DUE", "pi_b2c", "QTY", "TERMS"]) {
      assert.ok(!text.includes(absent), `receipt should not contain "${absent}"`);
    }

    await call("POST", `/api/payments/admin/payment-links/${body._id}/invoice/send-email`);
    assert.equal(mails.length, 2);
    assert.equal(mails[1].status, "paid");
    assert.equal(mails[1].payUrl, "");
    const html = buildInvoiceEmailHTML(mails[1]);
    assert.ok(html.includes("Payment Receipt") && html.includes("Amount Paid") && !html.includes("Pay now"));
  });

  test("manual mark-paid is still refused and the Manual Invoices list reports b2c", async () => {
    const { body } = await create();
    const mark = await call("PATCH", `/api/admin/manual-invoices/${body.invoice._id}/mark-paid`, { json: {} });
    assert.equal(mark.status, 400);
    const list = await call("GET", "/api/admin/manual-invoices");
    assert.equal(list.body.invoices[0].customerType, "b2c");
    assert.equal(list.body.invoices[0].source, "payment_link");
  });
});
