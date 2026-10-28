const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { extractText } = require("./helpers/pdfText");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

// ---- outside world, installed before the routes load ----
const stored = new Map(); // S3 key -> PDF bytes (the real PDF, so tests can read it)
const uploadStorage = require("../utils/uploadStorage");
uploadStorage.storeUploadInS3 = async (file) => {
  stored.set(file.filename, file.buffer);
  return { key: file.filename };
};
uploadStorage.getUploadBuffer = async (key) => stored.get(key);
require("../utils/s3PresignedUrl").createS3PresignedGetUrl = async (key) => ({ url: `https://s3.test/${key}`, expiresAt: new Date(Date.now() + 300000) });

const sendEmail = require("../utils/sendEmail");
const mails = []; // { kind: "patient-style" | "b2b", to, ...payload }
sendEmail.sendInvoiceEmail = async (to, payload) => mails.push({ kind: "patient-style", to, ...payload });
sendEmail.sendManualInvoiceEmail = async (to, payload) => mails.push({ kind: "b2b", to, ...payload });

const verifyToken = require("../middleware/verifyToken");
verifyToken.verifyAdminToken = (req, res, next) => {
  const role = req.headers["x-test-role"];
  if (!role) return res.status(401).json({ msg: "No token provided." });
  req.user = { id: "000000000000000000000001", role };
  next();
};

const ManualInvoice = require("../models/ManualInvoice");
const PaymentLink = require("../models/PaymentLink");
const manualInvoicesRouter = require("../routes/manualInvoices");
const { buildInvoiceEmailHTML } = sendEmail;

const b2c = (extra = {}) => ({
  name: "Rahul Mehta",
  email: "Rahul.Mehta@Gmail.com",
  status: "due",
  note: "internal",
  items: [{ description: "Tele Consultation", amount: 75 }, { description: "Follow-up report", amount: 20.5 }],
  ...extra,
});

describe("B2C manual invoices", () => {
  let mongod, server, base;

  const call = async (method, path, { role = "paymentadmin", json } = {}) => {
    const headers = { "content-type": "application/json" };
    if (role) headers["x-test-role"] = role;
    const res = await fetch(`${base}${path}`, { method, headers, body: json === undefined ? undefined : JSON.stringify(json) });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
  const create = (json = b2c(), opts) => call("POST", "/api/admin/manual-invoices", { json, ...opts });
  const pdfText = async (id) => extractText(stored.get((await ManualInvoice.findById(id)).pdfKey));

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await ManualInvoice.init();
    const app = express();
    app.use(express.json());
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
    await ManualInvoice.deleteMany({});
    await PaymentLink.deleteMany({});
    mails.length = 0;
    stored.clear();
  });

  test("create (due): consultation layout, Amount Due, no payment link, nothing emailed", async () => {
    const { status, body } = await create();
    assert.equal(status, 201);
    const inv = body.invoice;
    assert.equal(inv.status, "due");
    assert.equal(inv.source, "manual");
    assert.equal(inv.customerType, "b2c");
    assert.equal(inv.emailed, false);
    assert.equal(inv.amountCents, 9550);
    assert.match(inv.invoiceNumber, /^HC\d{2}-\d{4}$/);
    assert.equal(mails.length, 0, "no email call");
    assert.equal(await PaymentLink.countDocuments(), 0, "no payment link");

    const text = await pdfText(inv._id);
    for (const expected of ["Rahul Mehta", "rahul.mehta@gmail.com", "Tele Consultation", "$75.00", "Follow-up report", "$20.50", "Amount Due:", "$95.50",
      "STATUS: DUE", "Payment pending. Please contact us to complete payment.", "Thank you for choosing Humancare Connect"]) {
      assert.ok(text.includes(expected), `PDF should contain "${expected}"`);
    }
    for (const absent of ["secure payment link", "QTY", "RATE", "DUE DATE", "PAYMENT TERMS", "Total Paid", "UNPAID"]) {
      assert.ok(!text.includes(absent), `PDF should not contain "${absent}"`);
    }
  });

  test("create (paid): Total Paid and the PAID line", async () => {
    const { status, body } = await create(b2c({ status: "paid" }));
    assert.equal(status, 201);
    assert.equal(body.invoice.status, "paid");
    assert.equal(body.invoice.paymentMethod, "Received");
    assert.equal(body.invoice.emailed, false);
    const text = await pdfText(body.invoice._id);
    for (const expected of ["Total Paid:", "$95.50", "STATUS: PAID", "No balance outstanding"]) assert.ok(text.includes(expected), expected);
    for (const absent of ["Amount Due", "STATUS: DUE", "Payment pending"]) assert.ok(!text.includes(absent), absent);
    assert.equal(mails.length, 0);
  });

  test("quantity is always 1: missing, or 5 sent, either way rate = amount", async () => {
    const none = await create(b2c({ items: [{ description: "tele consultation", amount: 100 }] }));
    assert.equal(none.status, 201);
    const five = await create(b2c({ items: [{ description: "x", amount: 40, quantity: 5 }] }));
    assert.equal(five.status, 201);
    assert.equal(five.body.invoice.amountCents, 4000);
    const stored5 = await ManualInvoice.findById(five.body.invoice._id);
    assert.deepEqual(stored5.items.map((i) => [i.quantity, i.rate, i.amountCents]), [[1, 40, 4000]]);
    const storedNone = await ManualInvoice.findById(none.body.invoice._id);
    assert.deepEqual(storedNone.items.map((i) => [i.quantity, i.rate, i.amountCents]), [[1, 100, 10000]]);
  });

  test("only name, email, services and due/paid are read; the B2B fields, partner and other currencies are ignored", async () => {
    const { body } = await create(b2c({
      companyName: "Evil Corp", registrationNumber: "REG-9", address: "1 Secret Street", country: "Atlantis", postalCode: "ZZ-1",
      paymentTerms: "Net 60 Days", dueDate: "2027-01-01", description: "internal", currency: "EUR", partnerId: "64b000000000000000000009",
    }));
    const inv = await ManualInvoice.findById(body.invoice._id);
    for (const field of ["companyName", "registrationNumber", "address", "country", "postalCode"]) assert.equal(inv[field], "", field);
    assert.equal(inv.description, "internal", "only `note` is read (the B2B `description` field is ignored)");
    assert.equal(inv.currency, "usd");
    assert.equal(inv.partner, null);
    assert.equal(inv.dueDate, null);
    const text = await pdfText(inv._id);
    for (const leaked of ["Evil Corp", "REG-9", "Secret Street", "Atlantis", "Net 60"]) assert.ok(!text.includes(leaked), leaked);
  });

  test("the internal note is stored with the invoice but not printed on it", async () => {
    const { body } = await create(b2c({ note: "paid in cash at the clinic" }));
    assert.equal(body.invoice.description, "paid in cash at the clinic");
    assert.ok(!(await pdfText(body.invoice._id)).includes("paid in cash"));
  });

  test("validation: name, email and services are required", async () => {
    assert.equal((await create(b2c({ name: "" }))).status, 400);
    assert.equal((await create(b2c({ email: "nope" }))).status, 400);
    assert.equal((await create(b2c({ items: [] }))).status, 400);
    assert.equal((await create(b2c({ items: [{ description: "x", amount: 0 }] }))).status, 400);
    assert.equal(await ManualInvoice.countDocuments(), 0);
  });

  test("customerType b2b is refused with 400 while B2B is disabled, and nothing is created", async () => {
    const { status, body } = await create(b2c({ customerType: "b2b" }));
    assert.equal(status, 400);
    assert.equal(body.msg, "Business invoices are not enabled yet.");
    assert.equal(await ManualInvoice.countDocuments(), 0);
    const missing = await create(b2c());
    assert.equal(missing.body.invoice.customerType, "b2c", "no customerType means b2c");
  });

  test("Send Email: a patient-style email goes out, emailed becomes true, and it has no Pay now button", async () => {
    const { body } = await create(b2c({ name: "<b>Rahul</b>" }));
    assert.equal(mails.length, 0);
    const sent = await call("POST", `/api/admin/manual-invoices/${body.invoice._id}/resend-email`);
    assert.equal(sent.status, 200);
    assert.equal(sent.body.invoice.emailed, true);
    assert.equal(mails.length, 1);
    const mail = mails[0];
    assert.equal(mail.kind, "patient-style");
    assert.equal(mail.to, "rahul.mehta@gmail.com");
    assert.equal(mail.status, "due");
    assert.ok(!mail.payUrl, "no payment link, so no payUrl");
    const html = buildInvoiceEmailHTML(mail);
    assert.ok(html.includes("Amount Due") && html.includes("&lt;b&gt;Rahul&lt;/b&gt;"));
    assert.ok(!html.includes("Pay now") && !html.includes("payment link") && !html.includes("Payment History"));
  });

  test("Mark as Paid: due -> paid, the PDF is drawn again as a receipt, nothing is emailed by itself", async () => {
    const { body } = await create();
    const id = body.invoice._id;
    const keyBefore = (await ManualInvoice.findById(id)).pdfKey;
    assert.ok((await pdfText(id)).includes("Amount Due:"));

    const mark = await call("PATCH", `/api/admin/manual-invoices/${id}/mark-paid`, { json: {} });
    assert.equal(mark.status, 200);
    assert.equal(mark.body.invoice.status, "paid");
    assert.equal(mark.body.invoice.emailed, false);
    assert.equal(mails.length, 0, "no automatic email");
    assert.equal((await ManualInvoice.findById(id)).pdfKey, keyBefore, "same file, replaced");
    const text = await pdfText(id);
    for (const expected of ["Total Paid:", "STATUS: PAID"]) assert.ok(text.includes(expected), expected);
    assert.ok(!text.includes("Amount Due"));

    const sent = await call("POST", `/api/admin/manual-invoices/${id}/resend-email`);
    assert.equal(sent.status, 200);
    assert.equal(mails.length, 1);
    assert.equal(mails[0].status, "paid");
    assert.ok(buildInvoiceEmailHTML(mails[0]).includes("Payment Receipt"));
  });

  test("an older B2B invoice still shows in the list and downloads", async () => {
    const old = await ManualInvoice.create({
      invoiceNumber: "HC01-2601", clientName: "Nova Assistance", clientEmail: "accounts@nova.example", companyName: "Nova LTD",
      paymentTerms: "Net 30 Days", items: [{ description: "House call", quantity: 2, rate: 150, amountCents: 30000 }],
      amountCents: 30000, currency: "usd", status: "due", pdfKey: "manual-invoices/HC01-2601.pdf", createdBy: new mongoose.Types.ObjectId("000000000000000000000001"),
    });
    const list = await call("GET", "/api/admin/manual-invoices");
    const row = list.body.invoices.find((i) => i._id === String(old._id));
    assert.ok(row, "listed");
    assert.equal(row.customerType, "b2b");
    assert.equal(row.companyName, "Nova LTD");
    const download = await call("GET", `/api/admin/manual-invoices/${old._id}/download`);
    assert.equal(download.status, 200);
    assert.equal(download.body.url, "https://s3.test/manual-invoices/HC01-2601.pdf");
  });

  test("both roles that use the page can create (paymentadmin and superadmin); a plain user cannot", async () => {
    assert.equal((await create(b2c(), { role: "paymentadmin" })).status, 201);
    assert.equal((await create(b2c(), { role: "superadmin" })).status, 201);
    assert.equal((await create(b2c(), { role: "user" })).status, 403);
  });

  // B2B disabled for now (see B2B_MANUAL_INVOICES_ENABLED in routes/manualInvoices.js): re-enable with the flag.
  test.skip("B2B: a business manual invoice keeps its own layout, terms and due date", async () => {
    const { body } = await create({
      customerType: "b2b", name: "Nova", email: "n@example.com", paymentTerms: "Net 30 Days", dueDate: "2026-12-01", status: "due",
      items: [{ description: "House call", quantity: 2, rate: 150 }],
    });
    const text = await pdfText(body.invoice._id);
    assert.ok(text.includes("QTY") && text.includes("PAYMENT TERMS"));
  });
});
