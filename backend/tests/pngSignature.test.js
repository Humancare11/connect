process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const express = require("express");
const mongoose = require("mongoose");
const sharp = require("sharp");
const { MongoMemoryServer } = require("mongodb-memory-server");

const calls = { sent: [] };
const store = new Map();
function stub(rel, exports) {
  const file = require.resolve(path.join("..", rel));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
}
stub("config/s3", {
  s3Client: {
    send: async (command) => {
      calls.sent.push(command);
      const input = command.input;
      if (command.constructor.name === "PutObjectCommand") store.set(input.Key, input.Body);
      if (command.constructor.name === "GetObjectCommand") {
        if (!store.has(input.Key)) throw Object.assign(new Error("nope"), { name: "NoSuchKey" });
        return { Body: [store.get(input.Key)] };
      }
      return {};
    },
  },
  getBucketName: () => "test-bucket",
});
stub("middleware/verifyToken", {
  verifyDoctorToken: (req, res, next) => {
    if (!req.headers["x-test-doctor"]) return res.status(401).json({ msg: "no token" });
    req.user = { id: req.headers["x-test-doctor"], role: "doctor" };
    next();
  },
});

const { validatePngSignature, PngSignatureError, PNG_MAGIC } = require("../utils/pngSignature");
const Enrollment = require("../models/Enrollment");

const makePng = (w = 200, h = 80) =>
  sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
const fileOf = (buffer, over = {}) => ({ buffer, mimetype: "image/png", originalname: "sig.png", size: buffer.length, ...over });

describe("validatePngSignature", () => {
  test("accepts a real PNG", async () => {
    const out = await validatePngSignature(fileOf(await makePng()));
    assert.equal(out.width, 200);
  });

  test("rejects wrong MIME, wrong extension, missing file", async () => {
    const png = await makePng();
    await assert.rejects(validatePngSignature(fileOf(png, { mimetype: "image/jpeg" })), PngSignatureError);
    await assert.rejects(validatePngSignature(fileOf(png, { originalname: "sig.jpg" })), PngSignatureError);
    await assert.rejects(validatePngSignature(null), PngSignatureError);
  });

  test("rejects a JPEG renamed to .png with PNG mime (bad magic bytes)", async () => {
    const jpeg = await sharp({ create: { width: 50, height: 50, channels: 3, background: "#fff" } }).jpeg().toBuffer();
    await assert.rejects(validatePngSignature(fileOf(jpeg)), /not a valid PNG/);
  });

  test("rejects PNG magic bytes followed by garbage", async () => {
    const fake = Buffer.concat([PNG_MAGIC, Buffer.from("this is not an image at all")]);
    await assert.rejects(validatePngSignature(fileOf(fake)), /not a valid PNG/);
  });

  test("rejects an SVG / HTML payload", async () => {
    await assert.rejects(validatePngSignature(fileOf(Buffer.from("<svg onload=alert(1)></svg>"))), PngSignatureError);
  });

  test("rejects over 1 MB with 413", async () => {
    const big = Buffer.concat([PNG_MAGIC, Buffer.alloc(1024 * 1024)]);
    await assert.rejects(validatePngSignature(fileOf(big)), (e) => e.status === 413);
  });
});

describe("/api/doctor/signature", () => {
  let mongod, server, base, doctorId;

  const put = async (buffer, { type = "image/png", name = "sig.png", doctor = String(doctorId) } = {}) => {
    const form = new FormData();
    form.append("signature", new Blob([buffer], { type }), name);
    const headers = doctor ? { "x-test-doctor": doctor } : {};
    const res = await fetch(`${base}/api/doctor/signature`, { method: "PUT", headers, body: form });
    return { status: res.status, body: await res.json() };
  };

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    doctorId = new mongoose.Types.ObjectId();
    const app = express();
    app.use("/api/doctor/signature", require("../routes/doctorSignature"));
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
    await Enrollment.collection.deleteMany({});
    await Enrollment.collection.insertOne({ doctorId });
    store.clear();
    calls.sent.length = 0;
  });

  test("requires auth", async () => {
    const res = await put(await makePng(), { doctor: "" });
    assert.equal(res.status, 401);
  });

  test("uploads a PNG, stores it privately on the enrollment, and serves it back through the API", async () => {
    const png = await makePng();
    const res = await put(png);
    assert.equal(res.status, 200);
    const enr = await Enrollment.findOne({ doctorId }).lean();
    assert.match(enr.signatureKey, new RegExp(`^doctors/${doctorId}/signature/.+\.png$`));
    assert.equal(calls.sent[0].input.ServerSideEncryption, "AES256");
    const img = await fetch(`${base}/api/doctor/signature/image`, { headers: { "x-test-doctor": String(doctorId) } });
    assert.equal(img.status, 200);
    assert.equal(img.headers.get("content-type"), "image/png");
  });

  test("replacing the signature stores a new key", async () => {
    await put(await makePng());
    const first = (await Enrollment.findOne({ doctorId }).lean()).signatureKey;
    await put(await makePng(300, 100));
    const second = (await Enrollment.findOne({ doctorId }).lean()).signatureKey;
    assert.notEqual(first, second);
  });

  test("rejects JPEG, wrong extension and fake PNG with 400 and stores nothing", async () => {
    const jpeg = await sharp({ create: { width: 50, height: 50, channels: 3, background: "#fff" } }).jpeg().toBuffer();
    assert.equal((await put(jpeg, { type: "image/jpeg", name: "s.jpg" })).status, 400);
    assert.equal((await put(await makePng(), { name: "sig.jpg" })).status, 400);
    assert.equal((await put(jpeg)).status, 400);
    assert.equal(store.size, 0);
  });

  test("rejects over 1 MB", async () => {
    const res = await put(Buffer.concat([PNG_MAGIC, Buffer.alloc(1024 * 1024 + 10)]));
    assert.equal(res.status, 413);
  });

  test("image endpoint 404s when none uploaded", async () => {
    const img = await fetch(`${base}/api/doctor/signature/image`, { headers: { "x-test-doctor": String(doctorId) } });
    assert.equal(img.status, 404);
  });
});
