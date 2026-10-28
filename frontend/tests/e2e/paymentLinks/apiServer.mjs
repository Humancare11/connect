// The API for the Payment Links browser tests: the REAL /api/payments router (real request validation, real model code,
// real invoice PDF generation) over a throwaway in-memory MongoDB. Only the outside world is replaced: no login (the token
// check is swapped for a fixed payment admin; the real role guard still runs), Stripe, S3 and e-mail are in-memory stand-ins.
// The dummy keys are placeholders so the backend modules load. Nothing real is touched.
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, "..", "..", "..", "..", "backend");
const requireBackend = createRequire(path.join(backendRoot, "package.json"));

process.env.JWT_SECRET ||= "e2e-placeholder-not-a-secret";
process.env.STRIPE_SECRET_KEY ||= "sk_test_dummy_not_used";
process.env.FRONTEND_URL = "https://app.test";

export async function startApiServer() {
  const express = requireBackend("express");
  const mongoose = requireBackend("mongoose");
  const { MongoMemoryServer } = requireBackend("mongodb-memory-server");
  const load = (file) => requireBackend(path.join(backendRoot, file));

  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(uri)) throw new Error("refusing to run: the test database is not local");
  await mongoose.connect(uri);

  // Outside world, replaced before the routes load (they bind these at require time).
  const stored = new Map();
  const uploadStorage = load("utils/uploadStorage.js");
  uploadStorage.storeUploadInS3 = async (file) => {
    stored.set(file.filename, file.buffer);
    return { key: file.filename };
  };
  uploadStorage.getUploadBuffer = async (key) => stored.get(key);
  const sendEmail = load("utils/sendEmail.js");
  const mails = [];
  sendEmail.sendInvoiceEmail = async (to, payload) => mails.push({ to, ...payload });
  sendEmail.sendManualInvoiceEmail = async (to, payload) => mails.push({ to, ...payload });
  const stripePath = requireBackend.resolve("stripe");
  requireBackend.cache[stripePath] = {
    id: stripePath,
    filename: stripePath,
    loaded: true,
    exports: () => ({ paymentIntents: { retrieve: async () => ({}), create: async () => ({}) } }),
  };
  const verifyToken = load("middleware/verifyToken.js");
  verifyToken.verifyAdminToken = (req, res, next) => {
    req.user = { id: "000000000000000000000001", role: "paymentadmin" };
    next();
  };

  const ManualInvoice = load("models/ManualInvoice.js");
  const PaymentLink = load("models/PaymentLink.js");
  await ManualInvoice.init();

  const app = express();
  app.use(express.json());
  app.use("/api/payments", load("routes/payments.js"));
  app.use("/api/admin/manual-invoices", load("routes/manualInvoices.js"));
  // Everything else the page might ask for gets an empty answer.
  app.use("/api", (req, res) => res.json([]));

  // Control endpoints for the tests.
  app.get("/__invoices", async (req, res) => res.json(await ManualInvoice.find({}).lean()));
  app.get("/__links", async (req, res) => res.json(await PaymentLink.find({}).lean()));
  app.get("/__mails", (req, res) => res.json(mails));
  // A link as an older version of the app stored it: no customer, no invoice. (Created straight in the database.)
  app.post("/__legacy-link", async (req, res) => {
    const link = await PaymentLink.collection.insertOne({
      token: `legacy${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      amountPaise: req.body.amountPaise || 5000,
      currency: "usd",
      note: req.body.note || "",
      status: req.body.status || "pending",
      invoiceError: req.body.invoiceError || "",
      createdBy: new mongoose.Types.ObjectId("000000000000000000000001"),
      createdAt: new Date(req.body.createdAt || Date.now()),
      updatedAt: new Date(),
    });
    res.json({ id: String(link.insertedId) });
  });
  // Empties the data so a test starts from a clean table.
  app.post("/__reset", async (req, res) => {
    await PaymentLink.deleteMany({});
    await ManualInvoice.deleteMany({});
    mails.length = 0;
    res.json({ ok: true });
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;

  return {
    url,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await mongoose.disconnect();
      await mongod.stop();
    },
  };
}
