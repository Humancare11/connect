const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

// Stub the modules that would touch S3 / SMTP / PDF rendering / auth before
// the service and route are loaded, so the tests exercise only GOP logic.
const calls = { sent: [], stored: [], failSend: null };
function stub(rel, exports) {
  const file = require.resolve(path.join("..", rel));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
}
stub("utils/uploadStorage", {
  storeUploadInS3: async (file) => {
    calls.stored.push(file.filename);
    return { key: `uploads/${file.filename}` };
  },
  getUploadBuffer: async () => Buffer.from("%PDF-stored"),
});
stub("utils/sendEmail", {
  sendGopEmail: async (to, payload) => {
    if (calls.failSend) throw calls.failSend;
    calls.sent.push({ to, ...payload });
  },
});
stub("utils/gopPdf", {
  buildGopPdfBuffer: async () => Buffer.from("%PDF-built"),
  formatAmount: (cents, cur) => `${cur.toUpperCase()} ${(cents / 100).toFixed(2)}`,
});
stub("utils/s3PresignedUrl", { createS3PresignedGetUrl: async () => ({ url: "https://x", expiresAt: 0 }) });
stub("middleware/verifyToken", {
  verifyAdminToken: (req, res, next) => {
    req.user = { id: req.headers["x-test-admin"], role: "admin" };
    next();
  },
  adminOnly: (req, res, next) => next(),
});

require("../models/User"); // the list route populates createdBy
const Gop = require("../models/Gop");
const { createGop, resendGopEmail } = require("../utils/gopService");
const gopRouter = require("../routes/gop");

describe("GOP: generate and send are separate steps", () => {
  let mongod, server, base;
  const adminId = new mongoose.Types.ObjectId().toString();

  const validBody = {
    caseType: "House Call Visit",
    patientName: "Jane Patient",
    providerName: "Dr Who",
    providerEmail: "doc@example.com",
    authorizedByName: "Admin A",
    amount: "150.50",
    currency: "usd",
  };

  const call = async (method, url, body) => {
    const res = await fetch(`${base}${url}`, {
      method,
      headers: { "content-type": "application/json", "x-test-admin": adminId },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  };

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    const app = express();
    app.use(express.json());
    app.use("/api/admin/gop", gopRouter);
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    await Gop.deleteMany({});
    calls.sent.length = 0;
    calls.stored.length = 0;
    calls.failSend = null;
  });

  const makeGop = (extra = {}) =>
    Gop.create({
      gopNumber: `GOP-T-${Math.random().toString(36).slice(2, 8)}`,
      caseType: "House Call Visit",
      patientName: "Jane",
      providerName: "Dr Who",
      providerEmail: "doc@example.com",
      amountCents: 1000,
      authorizedByName: "Admin",
      pdfKey: "uploads/gop/x.pdf",
      createdBy: adminId,
      ...extra,
    });

  test("createGop stores the PDF and record but sends no email", async () => {
    const gop = await createGop({
      createdBy: adminId,
      caseType: "House Call Visit",
      patientName: "Jane",
      providerName: "Dr Who",
      providerEmail: "doc@example.com",
      amountCents: 15050,
      currency: "usd",
      authorizedByName: "Admin",
    });
    assert.equal(calls.sent.length, 0);
    assert.equal(calls.stored.length, 1);
    assert.ok(gop.pdfKey);
    assert.equal(gop.emailedAt, null);
    assert.equal(gop.emailError, "");
  });

  test("POST / returns 201 with emailed:false and does not send", async () => {
    const r = await call("POST", "/api/admin/gop", validBody);
    assert.equal(r.status, 201);
    assert.equal(r.body.gop.emailed, false);
    assert.equal(calls.sent.length, 0);
  });

  test("POST / keeps validating input", async () => {
    assert.equal((await call("POST", "/api/admin/gop", { ...validBody, providerEmail: "nope" })).status, 400);
    assert.equal((await call("POST", "/api/admin/gop", { ...validBody, caseType: "Other" })).status, 400);
    assert.equal((await call("POST", "/api/admin/gop", { ...validBody, amount: "0" })).status, 400);
    assert.equal((await call("POST", "/api/admin/gop", { ...validBody, patientName: "" })).status, 400);
  });

  test("resend-email sends the stored PDF and records emailedAt", async () => {
    const gop = await makeGop();
    const r = await call("POST", `/api/admin/gop/${gop._id}/resend-email`);
    assert.equal(r.status, 200);
    assert.equal(r.body.gop.emailed, true);
    assert.ok(r.body.gop.emailedAt);
    assert.equal(calls.sent.length, 1);
    assert.equal(calls.sent[0].to, "doc@example.com");
    assert.equal(calls.sent[0].pdfBuffer.toString(), "%PDF-stored");
  });

  test("resend-email can be repeated and updates emailedAt", async () => {
    const earlier = new Date("2026-01-01");
    const gop = await makeGop({ emailedAt: earlier });
    const r = await call("POST", `/api/admin/gop/${gop._id}/resend-email`);
    assert.equal(r.status, 200);
    const fresh = await Gop.findById(gop._id).lean();
    assert.ok(fresh.emailedAt > earlier);
  });

  test("a failed send stores emailError and the route returns 502", async () => {
    const gop = await makeGop();
    calls.failSend = new Error("smtp down");
    const r = await call("POST", `/api/admin/gop/${gop._id}/resend-email`);
    assert.equal(r.status, 502);
    assert.match(r.body.msg, /smtp down/);
    const fresh = await Gop.findById(gop._id).lean();
    assert.equal(fresh.emailedAt, null);
    assert.equal(fresh.emailError, "smtp down");
  });

  test("a later successful send clears the stored emailError", async () => {
    const gop = await makeGop({ emailError: "old failure" });
    await resendGopEmail({ gopId: gop._id });
    const fresh = await Gop.findById(gop._id).lean();
    assert.equal(fresh.emailError, "");
    assert.ok(fresh.emailedAt);
  });

  test("a GOP with no provider email returns a clean 400 and sends nothing", async () => {
    // Bypass schema validation to simulate a legacy/blank record.
    const { insertedId } = await Gop.collection.insertOne({
      gopNumber: "GOP-LEGACY-1",
      caseType: "House Call Visit",
      patientName: "Jane",
      providerName: "Dr Who",
      providerEmail: "",
      amountCents: 1000,
      authorizedByName: "Admin",
      pdfKey: "uploads/gop/legacy.pdf",
      createdBy: new mongoose.Types.ObjectId(adminId),
    });
    const r = await call("POST", `/api/admin/gop/${insertedId}/resend-email`);
    assert.equal(r.status, 400);
    assert.match(r.body.msg, /no provider email/i);
    assert.equal(calls.sent.length, 0);
  });

  test("resend-email 404s for an unknown id and 400s for a malformed one", async () => {
    const missing = new mongoose.Types.ObjectId();
    assert.equal((await call("POST", `/api/admin/gop/${missing}/resend-email`)).status, 404);
    assert.equal((await call("POST", "/api/admin/gop/not-an-id/resend-email")).status, 400);
  });

  test("list exposes emailed, emailedAt and emailError", async () => {
    await makeGop({ emailedAt: new Date("2026-02-02") });
    await makeGop({ emailError: "boom" });
    const r = await call("GET", "/api/admin/gop");
    assert.equal(r.status, 200);
    const sent = r.body.gops.find((g) => g.emailed);
    const failed = r.body.gops.find((g) => !g.emailed);
    assert.ok(sent.emailedAt);
    assert.equal(failed.emailError, "boom");
    assert.equal(failed.emailedAt, undefined);
  });
});
