const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";
process.env.FRONTEND_URL = "https://app.test";

// ---- stand-ins for the outside world, installed before the routes load ----
const s3 = { puts: [], fail: false };
const uploadStorage = require("../utils/uploadStorage");
uploadStorage.storeUploadInS3 = async (file) => {
  if (s3.fail) throw new Error("S3 down");
  s3.puts.push(file.filename);
  return { key: file.filename };
};
uploadStorage.getUploadBuffer = async () => Buffer.from("%PDF-fake");

const sendEmail = require("../utils/sendEmail");
const emails = [];
sendEmail.sendManualInvoiceEmail = async (to, payload) => {
  emails.push({ to, ...payload });
};
// B2C invoices are emailed with the patient-style template (sendInvoiceEmail).
sendEmail.sendInvoiceEmail = async (to, payload) => {
  emails.push({ to, ...payload });
};

// Stripe: the confirm route retrieves the PaymentIntent we hand it here.
const stripeState = { intent: null };
const stripePath = require.resolve("stripe");
require.cache[stripePath] = {
  id: stripePath,
  filename: stripePath,
  loaded: true,
  exports: () => ({ paymentIntents: { retrieve: async () => stripeState.intent, create: async () => ({}) } }),
};

// Auth: the real paymentAdminOnly runs; only the token check is replaced.
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

const ADMIN_A = "000000000000000000000001";
const ADMIN_B = "000000000000000000000002";

// The default payload is an individual (B2C) link: B2B payment links are
// disabled for now (B2B_PAYMENT_LINKS_ENABLED in routes/payments.js), so the
// generic behaviour covered here (confirm, permissions, e-mail, list) runs on B2C.
const body = (extra = {}) => ({
  customerType: "b2c",
  name: "Rahul Mehta",
  email: "Rahul.Mehta@Gmail.com",
  items: [
    { description: "Tele Consultation", amount: 150 },
    { description: "Follow-up report", amount: 49.5 },
  ],
  note: "internal",
  ...extra,
});

// B2B disabled for now: the business payload, kept for the skipped B2B tests below.
const b2bBody = (extra = {}) => ({
  customerType: "b2b",
  name: "Nova Assistance",
  email: "Accounts@Example.com",
  companyName: "Nova LTD",
  registrationNumber: "P-123",
  country: "Moldova",
  postalCode: "2001",
  address: "Chisinau",
  paymentTerms: "Net 30 Days",
  dueDate: "2026-12-01",
  description: "Thank you.",
  note: "internal",
  items: [
    { description: "House call", quantity: 2, rate: 150 },
    { description: "Report", quantity: 1, rate: 49.5 },
  ],
  amount: 1, // a client-sent amount must be ignored
  ...extra,
});

describe("payment link invoices", () => {
  let mongod, server, base;

  const call = async (method, path, { role = "paymentadmin", user = ADMIN_A, json } = {}) => {
    const headers = { "content-type": "application/json" };
    if (role) headers["x-test-role"] = role;
    if (user) headers["x-test-user"] = user;
    const res = await fetch(`${base}${path}`, { method, headers, body: json === undefined ? undefined : JSON.stringify(json) });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
  const create = (json = body(), opts = {}) => call("POST", "/api/payments/admin/payment-links", { json, ...opts });
  const intentFor = (link, extra = {}) => ({
    id: "pi_1",
    status: "succeeded",
    amount: link.amountPaise,
    currency: link.currency,
    metadata: { paymentLinkId: String(link._id) },
    receipt_email: "payer@example.com",
    payment_method: { type: "card", card: { last4: "4242", brand: "visa", funding: "credit" } },
    ...extra,
  });
  const confirm = (token, id = "pi_1") => call("POST", `/api/payments/payment-links/${token}/confirm`, { role: "", user: "", json: { paymentIntentId: id } });

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
    emails.length = 0;
    s3.puts.length = 0;
    stripeState.intent = null;
  });

  // B2B disabled for now (see B2B_PAYMENT_LINKS_ENABLED in routes/payments.js): re-enable with the flag.
  test.skip("B2B: create: the link amount is the items total, the invoice is due, and nothing is emailed", async () => {
    const { status, body: out } = await create(b2bBody());
    assert.equal(status, 201);
    assert.equal(out.amountPaise, 34950); // 2 x 150.00 + 49.50, not the client's "amount: 1"
    assert.equal(out.invoice.status, "due");
    assert.equal(out.invoice.emailed, false);
    assert.match(out.invoice.invoiceNumber, /^HC\d{2}-\d{4}$/);
    assert.equal(emails.length, 0);

    const invoice = await ManualInvoice.findOne({ paymentLink: out._id });
    assert.equal(invoice.source, "payment_link");
    assert.equal(invoice.amountCents, 34950);
    assert.equal(invoice.clientEmail, "accounts@example.com");
    assert.equal(invoice.registrationNumber, "P-123");
    assert.equal((await PaymentLink.findById(out._id)).manualInvoice.toString(), invoice._id.toString());
  });

  test("create: invalid invoice fields are rejected and no link is left behind", async () => {
    assert.equal((await create(body({ items: [] }))).status, 400);
    assert.equal((await create(body({ email: "nope" }))).status, 400);
    assert.equal((await create(body({ name: "" }))).status, 400);
    assert.equal(await PaymentLink.countDocuments(), 0);
  });

  test("create: only a payment admin or super admin may create (plain admin is refused)", async () => {
    assert.equal((await create(body(), { role: "admin" })).status, 403);
    assert.equal((await create(body(), { role: "superadmin" })).status, 201);
  });

  test("createInvoiceForPaymentLink twice yields one invoice", async () => {
    const { createInvoiceForPaymentLink } = require("../utils/paymentLinkInvoice");
    const { body: out } = await create();
    const link = await PaymentLink.findById(out._id);
    const again = await createInvoiceForPaymentLink(link, {
      details: { clientName: "X", clientEmail: "x@example.com", paymentTerms: "Due on Receipt" },
      items: [{ description: "a", quantity: 1, rate: 1, amountCents: 100 }],
      amountCents: 100,
      dueDate: null,
      createdBy: ADMIN_A,
    });
    assert.equal(String(again._id), String(out.invoice._id));
    assert.equal(await ManualInvoice.countDocuments({ paymentLink: link._id }), 1);
  });

  test("send-email emails the bill with a Pay now link, then the receipt after payment", async () => {
    const { body: out } = await create();

    const sent = await call("POST", `/api/payments/admin/payment-links/${out._id}/invoice/send-email`);
    assert.equal(sent.status, 200);
    assert.equal(sent.body.invoice.emailed, true);
    assert.equal(emails.length, 1);
    assert.equal(emails[0].to, "rahul.mehta@gmail.com");
    assert.equal(emails[0].status, "due");
    assert.equal(emails[0].payUrl, `https://app.test/pay/${out.token}`);

    const link = await PaymentLink.findById(out._id);
    stripeState.intent = intentFor(link);
    assert.equal((await confirm(out.token)).status, 200);
    assert.equal(emails.length, 1, "paying must not send an email");

    const receipt = await call("POST", `/api/payments/admin/payment-links/${out._id}/invoice/send-email`);
    assert.equal(receipt.status, 200);
    assert.equal(emails.length, 2);
    assert.equal(emails[1].status, "paid");
    assert.equal(emails[1].payUrl, "");
  });

  test("confirm: the invoice becomes a paid receipt with the same number and no email", async () => {
    const { body: out } = await create();
    const link = await PaymentLink.findById(out._id);
    stripeState.intent = intentFor(link);

    const res = await confirm(out.token);
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "paid");

    const invoice = await ManualInvoice.findOne({ paymentLink: out._id });
    assert.equal(invoice.status, "paid");
    assert.equal(invoice.invoiceNumber, out.invoice.invoiceNumber);
    assert.equal(invoice.gatewayReference, "pi_1");
    assert.equal(invoice.paymentMethod, "Card (Stripe)");
    assert.equal(emails.length, 0);
    assert.equal((await PaymentLink.findById(out._id)).payerEmail, "payer@example.com");
  });

  test("confirm twice settles once", async () => {
    const { body: out } = await create();
    const link = await PaymentLink.findById(out._id);
    stripeState.intent = intentFor(link);

    assert.equal((await confirm(out.token)).status, 200);
    const putsAfterFirst = s3.puts.length;
    const second = await confirm(out.token);
    assert.equal(second.status, 200);
    assert.equal(s3.puts.length, putsAfterFirst, "no second PDF is generated");
    assert.equal(await ManualInvoice.countDocuments({ paymentLink: out._id }), 1);
  });

  test("confirm refuses a PaymentIntent that belongs to another link", async () => {
    const { body: a } = await create();
    const { body: b } = await create();
    const linkA = await PaymentLink.findById(a._id);
    stripeState.intent = intentFor(linkA);

    const res = await confirm(b.token);
    assert.equal(res.status, 400);
    assert.equal((await PaymentLink.findById(b._id)).status, "pending");
    assert.equal((await ManualInvoice.findOne({ paymentLink: b._id })).status, "due");
  });

  test("confirm: a paid link refuses a different PaymentIntent", async () => {
    const { body: out } = await create();
    const link = await PaymentLink.findById(out._id);
    stripeState.intent = intentFor(link);
    assert.equal((await confirm(out.token)).status, 200);

    stripeState.intent = intentFor(link, { id: "pi_other" });
    assert.equal((await confirm(out.token, "pi_other")).status, 400);
  });

  test("confirm still succeeds when the invoice step fails, and records the error for a retry", async () => {
    const { body: out } = await create();
    const link = await PaymentLink.findById(out._id);
    stripeState.intent = intentFor(link);

    s3.fail = true;
    let res;
    try {
      res = await confirm(out.token);
    } finally {
      s3.fail = false;
    }
    assert.equal(res.status, 200);
    assert.equal((await PaymentLink.findById(out._id)).status, "paid");
    assert.equal((await ManualInvoice.findOne({ paymentLink: out._id })).status, "due");
    assert.match((await PaymentLink.findById(out._id)).invoiceError, /S3 down/);

    const retry = await call("POST", `/api/payments/admin/payment-links/${out._id}/invoice`);
    assert.equal(retry.status, 200);
    assert.equal(retry.body.invoice.status, "paid");
    assert.equal((await PaymentLink.findById(out._id)).invoiceError, "");
  });

  test("a payment admin cannot touch another payment admin's link or invoice", async () => {
    const { body: out } = await create(body(), { user: ADMIN_A });

    const email = await call("POST", `/api/payments/admin/payment-links/${out._id}/invoice/send-email`, { user: ADMIN_B });
    assert.equal(email.status, 404);
    const retry = await call("POST", `/api/payments/admin/payment-links/${out._id}/invoice`, { user: ADMIN_B });
    assert.equal(retry.status, 404);
    const download = await call("GET", `/api/admin/manual-invoices/${out.invoice._id}/download`, { user: ADMIN_B });
    assert.equal(download.status, 404);

    const mine = await call("GET", "/api/payments/admin/payment-links", { user: ADMIN_A });
    assert.equal(mine.body.links.length, 1);
    const theirs = await call("GET", "/api/payments/admin/payment-links", { user: ADMIN_B });
    assert.equal(theirs.body.links.length, 0);
    assert.equal(emails.length, 0);
  });

  test("list carries the invoice and the email filter works", async () => {
    const { body: one } = await create();
    await create();
    await call("POST", `/api/payments/admin/payment-links/${one._id}/invoice/send-email`);

    const all = await call("GET", "/api/payments/admin/payment-links");
    assert.equal(all.body.links.length, 2);
    assert.ok(all.body.links.every((l) => l.invoice?.invoiceNumber));

    const sent = await call("GET", "/api/payments/admin/payment-links?emailStatus=sent");
    assert.deepEqual(sent.body.links.map((l) => l._id), [one._id]);
    const unsent = await call("GET", "/api/payments/admin/payment-links?emailStatus=unsent");
    assert.equal(unsent.body.links.length, 1);
    assert.notEqual(unsent.body.links[0]._id, one._id);
  });

  test("manual-invoices: mark-paid is refused for a payment-link invoice and the list reports its source", async () => {
    const { body: out } = await create();

    const mark = await call("PATCH", `/api/admin/manual-invoices/${out.invoice._id}/mark-paid`, { json: {} });
    assert.equal(mark.status, 400);
    assert.equal((await ManualInvoice.findById(out.invoice._id)).status, "due");

    const list = await call("GET", "/api/admin/manual-invoices");
    assert.equal(list.body.invoices[0].source, "payment_link");
  });

  // B2B disabled for now: POST /api/admin/manual-invoices refuses b2b (B2B_MANUAL_INVOICES_ENABLED). The B2C
  // equivalent (no email, source manual, mark-paid works) is in manualInvoiceB2c.test.js.
  test.skip("B2B: manual-invoices: the existing create flow is unchanged (no email, source manual, mark-paid works)", async () => {
    const created = await call("POST", "/api/admin/manual-invoices", {
      json: { ...b2bBody(), status: "due", currency: "usd" },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.invoice.source, "manual");
    assert.equal(created.body.invoice.emailed, false);
    assert.equal(emails.length, 0);

    const mark = await call("PATCH", `/api/admin/manual-invoices/${created.body.invoice._id}/mark-paid`, { json: { paymentMethod: "Wire" } });
    assert.equal(mark.status, 200);
    assert.equal(mark.body.invoice.status, "paid");

    const bad = await call("POST", "/api/admin/manual-invoices", { json: { ...b2bBody(), email: "bad" } });
    assert.equal(bad.status, 400);
  });
});
