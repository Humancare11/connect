process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const express = require("express");
const mongoose = require("mongoose");
const sharp = require("sharp");
const { MongoMemoryServer } = require("mongodb-memory-server");

const s3 = { objects: new Map(), sent: [], failCopy: false };
function stub(rel, exports) {
  const file = require.resolve(path.join("..", rel));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
}
stub("config/s3", {
  s3Client: {
    send: async (command) => {
      const name = command.constructor.name;
      const input = command.input;
      s3.sent.push({ name, input });
      if (name === "PutObjectCommand") s3.objects.set(input.Key, input.Body);
      if (name === "CopyObjectCommand") {
        if (s3.failCopy) throw new Error("S3 down");
        const source = decodeURIComponent(input.CopySource.split("/").slice(1).join("/"));
        if (!s3.objects.has(source)) throw Object.assign(new Error("missing"), { name: "NoSuchKey" });
        s3.objects.set(input.Key, s3.objects.get(source));
      }
      if (name === "GetObjectCommand") {
        if (!s3.objects.has(input.Key)) throw Object.assign(new Error("missing"), { name: "NoSuchKey" });
        return { Body: [s3.objects.get(input.Key)] };
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
  verifyUserToken: (req, res, next) => {
    if (!req.headers["x-test-user"]) return res.status(401).json({ msg: "no token" });
    req.user = { id: req.headers["x-test-user"], role: "user" };
    next();
  },
});
stub("utils/pushNotifications", { sendPushToUser: async () => {} });

const User = require("../models/User");
const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const Appointment = require("../models/Appointment");
const Prescription = require("../models/Prescription");
const MedicalCertificate = require("../models/MedicalCertificate");
const { processSignatureUpload, SignatureUploadError, MAX_SIGNATURE_BYTES } = require("../utils/signatureUpload");

const png = (color, w = 120, h = 50) => sharp({ create: { width: w, height: h, channels: 4, background: color } }).png().toBuffer();
const fileOf = (buffer, mimetype = "image/png", originalname = "sig.png") => ({ buffer, mimetype, originalname, size: buffer.length });

// White 300x100 JPG with a black stroke block (x 100-140) and a faint grey one (x 160-200), both full height of y 30-70.
async function jpgSignature({ background = "#ffffff" } = {}) {
  const block = (w, h, c) => sharp({ create: { width: w, height: h, channels: 3, background: c } }).png().toBuffer();
  return sharp({ create: { width: 300, height: 100, channels: 3, background } })
    .composite([
      { input: await block(40, 40, "#000000"), left: 100, top: 30 },
      { input: await block(40, 40, "#d0d0d0"), left: 160, top: 30 },
    ])
    .jpeg({ quality: 95 })
    .toBuffer();
}
const alphaAt = async (buffer, x, y) => {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return data[(y * info.width + x) * 4 + 3];
};

describe("processSignatureUpload", () => {
  test("PNG keeps its transparency and comes back as PNG", async () => {
    const out = await processSignatureUpload(fileOf(await png({ r: 0, g: 0, b: 0, alpha: 0 })));
    assert.equal(out.sourceType, "png");
    assert.equal(out.backgroundRemoved, false);
    assert.equal(await alphaAt(out.buffer, 5, 5), 0);
    assert.equal((await sharp(out.buffer).metadata()).format, "png");
  });

  test("JPG: white background becomes transparent, black stroke stays opaque, faint stroke is kept (not erased)", async () => {
    const out = await processSignatureUpload(fileOf(await jpgSignature(), "image/jpeg", "s.jpg"));
    assert.equal(out.sourceType, "jpeg");
    assert.equal(out.backgroundRemoved, true);
    assert.equal(await alphaAt(out.buffer, 5, 5), 0);
    assert.ok((await alphaAt(out.buffer, 120, 50)) > 250);
    const faint = await alphaAt(out.buffer, 180, 50);
    assert.ok(faint > 40 && faint < 255, `faint stroke alpha ${faint}`);
  });

  test("JPG: removeBackground=false leaves it opaque", async () => {
    const out = await processSignatureUpload(fileOf(await jpgSignature(), "image/jpeg", "s.jpg"), { removeBackground: false });
    assert.equal(out.backgroundRemoved, false);
    assert.equal(await alphaAt(out.buffer, 5, 5), 255);
  });

  test("JPG with a grey (non-white) border is left alone", async () => {
    const out = await processSignatureUpload(fileOf(await jpgSignature({ background: "#9a9a9a" }), "image/jpeg", "s.jpg"));
    assert.equal(out.backgroundRemoved, false);
    assert.equal(await alphaAt(out.buffer, 5, 5), 255);
  });

  test("a JPG sent with a .png name / png mime is accepted by its real type", async () => {
    const out = await processSignatureUpload(fileOf(await jpgSignature(), "image/png", "s.png"));
    assert.equal(out.sourceType, "jpeg");
  });

  test("rejects GIF, SVG, text, garbage after PNG magic, empty, over 2 MB (413), too small", async () => {
    const gif = await sharp({ create: { width: 60, height: 30, channels: 3, background: "#fff" } }).gif().toBuffer();
    await assert.rejects(processSignatureUpload(fileOf(gif, "image/gif", "s.gif")), SignatureUploadError);
    await assert.rejects(processSignatureUpload(fileOf(Buffer.from("<svg onload=alert(1)></svg>"), "image/svg+xml", "s.svg")), SignatureUploadError);
    await assert.rejects(processSignatureUpload(fileOf(Buffer.from("<svg></svg>"))), /not a valid/);
    const fake = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("not an image")]);
    await assert.rejects(processSignatureUpload(fileOf(fake)), /not a valid/);
    await assert.rejects(processSignatureUpload(null), SignatureUploadError);
    await assert.rejects(processSignatureUpload(fileOf(Buffer.alloc(MAX_SIGNATURE_BYTES + 1))), (e) => e.status === 413);
    await assert.rejects(processSignatureUpload(fileOf(await png("#000", 10, 10))), /too small/);
  });

  test("large images are scaled down to a bounded size", async () => {
    const out = await processSignatureUpload(fileOf(await png("#000", 3000, 1000)));
    assert.ok(out.width <= 1000 && out.height <= 400);
  });
});

describe("/api/doctor/signature (PNG + JPG, preview)", () => {
  let mongod, server, base, doctorId;
  const send = async (method, urlPath, buffer, { type = "image/png", name = "sig.png", fields = {} } = {}) => {
    const form = new FormData();
    form.append("signature", new Blob([buffer], { type }), name);
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    const res = await fetch(`${base}/api/doctor/signature${urlPath}`, { method, headers: { "x-test-doctor": String(doctorId) }, body: form });
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
    s3.objects.clear();
    s3.sent.length = 0;
  });

  test("preview returns the processed PNG and stores nothing", async () => {
    const res = await send("POST", "/preview", await jpgSignature(), { type: "image/jpeg", name: "s.jpg" });
    assert.equal(res.status, 200);
    assert.match(res.body.previewDataUrl, /^data:image\/png;base64,/);
    assert.equal(res.body.backgroundRemoved, true);
    assert.equal(s3.objects.size, 0);
    assert.equal((await Enrollment.findOne({ doctorId }).lean()).signatureKey, undefined);
  });

  test("saving a JPG stores a PNG privately and honours removeBackground=0", async () => {
    const res = await send("PUT", "", await jpgSignature(), { type: "image/jpeg", name: "s.jpg", fields: { removeBackground: "0" } });
    assert.equal(res.status, 200);
    assert.equal(res.body.backgroundRemoved, false);
    const key = (await Enrollment.findOne({ doctorId }).lean()).signatureKey;
    assert.match(key, new RegExp(`^doctors/${doctorId}/signature/.+\\.png$`));
    assert.equal((await sharp(s3.objects.get(key)).metadata()).format, "png");
    assert.equal(s3.sent[0].input.ServerSideEncryption, "AES256");
  });

  test("preview and save share one per-doctor rate limit (429 after 20), other doctors are unaffected", async () => {
    const other = new mongoose.Types.ObjectId();
    const tiny = await png("#000", 60, 30);
    const hit = async (id, method, urlPath) => {
      const form = new FormData();
      form.append("signature", new Blob([tiny], { type: "image/png" }), "s.png");
      return fetch(`${base}/api/doctor/signature${urlPath}`, { method, headers: { "x-test-doctor": String(id) }, body: form });
    };
    for (let i = 0; i < 20; i += 1) {
      const res = await hit(other, i % 2 ? "PUT" : "POST", i % 2 ? "" : "/preview");
      assert.notEqual(res.status, 429, `call ${i + 1}`);
    }
    for (const [method, urlPath] of [["POST", "/preview"], ["PUT", ""]]) {
      const blocked = await hit(other, method, urlPath);
      assert.equal(blocked.status, 429);
      assert.ok(blocked.headers.get("retry-after"));
    }
    assert.notEqual((await hit(doctorId, "POST", "/preview")).status, 429);
  });

  test("2 MB limit: just over is 413, GIF is 400", async () => {
    assert.equal((await send("PUT", "", Buffer.alloc(MAX_SIGNATURE_BYTES + 10))).status, 413);
    const gif = await sharp({ create: { width: 60, height: 30, channels: 3, background: "#fff" } }).gif().toBuffer();
    assert.equal((await send("PUT", "", gif, { type: "image/gif", name: "s.gif" })).status, 400);
    assert.equal(s3.objects.size, 0);
  });
});

describe("Prescription / Certificate signing", () => {
  let mongod, server, base;
  let doctor, otherDoctor, patient, otherPatient, appt, sigA, sigB;

  const call = async (who, method, url, body) => {
    const headers = { "content-type": "application/json" };
    if (who.doctor) headers["x-test-doctor"] = String(who.doctor);
    if (who.user) headers["x-test-user"] = String(who.user);
    const res = await fetch(`${base}${url}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const type = res.headers.get("content-type") || "";
    return { status: res.status, headers: res.headers, body: type.includes("json") ? await res.json() : Buffer.from(await res.arrayBuffer()) };
  };
  const asDoctor = (d = doctor) => ({ doctor: d._id });
  const asPatient = (p = patient) => ({ user: p._id });
  const giveSignature = async (d, buffer) => {
    const key = `doctors/${d._id}/signature/${new mongoose.Types.ObjectId()}.png`;
    s3.objects.set(key, buffer);
    await Enrollment.updateOne({ doctorId: d._id }, { $set: { signatureKey: key } });
    return key;
  };
  const rx = (over = {}) => call(asDoctor(), "POST", "/api/medical/prescriptions", { appointmentId: appt._id, diagnosis: "Flu", medicines: [{ name: "Para" }], ...over });
  const cert = (over = {}) => call(asDoctor(), "POST", "/api/medical/certificates", { appointmentId: appt._id, diagnosis: "Flu", ...over });

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    const app = express();
    app.use(express.json());
    app.use("/api/medical", require("../routes/medical"));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));
    base = `http://127.0.0.1:${server.address().port}`;
    sigA = await png({ r: 255, g: 0, b: 0, alpha: 1 });
    sigB = await png({ r: 0, g: 0, b: 255, alpha: 1 });
  });
  after(async () => {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    for (const m of [User, Doctor, Enrollment, Appointment, Prescription, MedicalCertificate]) await m.deleteMany({});
    s3.objects.clear();
    s3.sent.length = 0;
    s3.failCopy = false;
    patient = await User.create({ name: "Jane Patient", email: "jane@x.com", role: "user" });
    otherPatient = await User.create({ name: "Other Person", email: "other@x.com", role: "user" });
    doctor = await Doctor.create({ name: "Dr Who", email: "who@x.com", password: "x" });
    otherDoctor = await Doctor.create({ name: "Dr Other", email: "other-dr@x.com", password: "x" });
    await Enrollment.collection.insertMany([
      { doctorId: doctor._id, specialization: "Cardiology", country: "India", medicalRegistrationNumber: "MCI-12345" },
      { doctorId: otherDoctor._id, specialization: "ENT", country: "India", medicalRegistrationNumber: "MCI-99999" },
    ]);
    appt = await Appointment.create({ patientId: patient._id, doctorId: doctor._id, date: "2026-10-01", time: "10:00 AM", status: "complete" });
  });

  for (const [kind, folder, create, mine, doctorList] of [
    ["prescription", "prescriptions", () => rx({ sign: true }), "my-prescriptions", "prescriptions"],
    ["certificate", "certificates", () => cert({ sign: true }), "my-certificates", "certificates"],
  ]) {
    describe(kind, () => {
      const unsigned = () => (kind === "prescription" ? rx() : cert());

      test("sign:true copies the saved signature to a key the document owns and never exposes the key", async () => {
        await giveSignature(doctor, sigA);
        const res = await create();
        assert.equal(res.status, 201);
        const out = res.body[kind];
        assert.equal(out.isSigned, true);
        assert.ok(out.signedAt);
        assert.equal(out.signatureKey, undefined);
        assert.ok(!JSON.stringify(res.body).includes(`${folder}/`));
        const raw = await (kind === "prescription" ? Prescription : MedicalCertificate).findById(out._id).lean();
        assert.equal(raw.signatureKey, `${folder}/${out._id}/signature.png`);
        assert.ok(s3.objects.get(raw.signatureKey).equals(sigA));
        assert.equal(raw.signedBy.name, "Dr Who");
        assert.equal(raw.signedBy.registrationNumber, "MCI-12345");
      });

      test("unsigned (no sign flag, or sign:false) stays unsigned and copies nothing", async () => {
        await giveSignature(doctor, sigA);
        const before = s3.sent.length;
        for (const res of [await unsigned(), await (kind === "prescription" ? rx({ sign: false }) : cert({ sign: false }))]) {
          assert.equal(res.status, 201);
          assert.equal(res.body[kind].isSigned, false);
          assert.equal(res.body[kind].signedAt, undefined);
        }
        assert.equal(s3.sent.length, before);
      });

      test("sign:true with no saved signature is 422 SIGNATURE_REQUIRED and creates nothing; unsigned still works", async () => {
        const res = await create();
        assert.equal(res.status, 422);
        assert.equal(res.body.code, "SIGNATURE_REQUIRED");
        assert.equal(await (kind === "prescription" ? Prescription : MedicalCertificate).countDocuments(), 0);
        assert.equal((await unsigned()).status, 201);
      });

      test("a failed signature copy is 502 and creates nothing", async () => {
        await giveSignature(doctor, sigA);
        s3.failCopy = true;
        const res = await create();
        assert.equal(res.status, 502);
        assert.equal(await (kind === "prescription" ? Prescription : MedicalCertificate).countDocuments(), 0);
      });

      test("replacing the profile signature never changes an issued document", async () => {
        await giveSignature(doctor, sigA);
        const out = (await create()).body[kind];
        await giveSignature(doctor, sigB);
        const img = await call(asDoctor(), "GET", `/api/medical/${doctorList}/${out._id}/signature`);
        assert.equal(img.status, 200);
        assert.ok(img.body.equals(sigA));
        const later = (await create()).body[kind];
        const img2 = await call(asDoctor(), "GET", `/api/medical/${doctorList}/${later._id}/signature`);
        assert.ok(img2.body.equals(sigB));
      });

      test("signature route: owner doctor and own patient only (404 otherwise), unauthenticated 401, private headers", async () => {
        await giveSignature(doctor, sigA);
        const out = (await create()).body[kind];
        const own = await call(asPatient(), "GET", `/api/medical/${mine}/${out._id}/signature`);
        assert.equal(own.status, 200);
        assert.equal(own.headers.get("content-type"), "image/png");
        assert.match(own.headers.get("cache-control"), /no-store/);
        assert.equal((await call(asPatient(otherPatient), "GET", `/api/medical/${mine}/${out._id}/signature`)).status, 404);
        assert.equal((await call(asDoctor(otherDoctor), "GET", `/api/medical/${doctorList}/${out._id}/signature`)).status, 404);
        assert.equal((await call({}, "GET", `/api/medical/${mine}/${out._id}/signature`)).status, 401);
        assert.equal((await call(asPatient(), "GET", `/api/medical/${mine}/not-an-id/signature`)).status, 404);
      });

      test("an unsigned / old document has no signature (404) and lists show isSigned without the key", async () => {
        const old = (await unsigned()).body[kind];
        // a pre-feature document: no signature fields at all
        await (kind === "prescription" ? Prescription : MedicalCertificate).collection.updateOne(
          { _id: new mongoose.Types.ObjectId(old._id) },
          { $unset: { signatureKey: "", signedAt: "", signedBy: "" } },
        );
        assert.equal((await call(asPatient(), "GET", `/api/medical/${mine}/${old._id}/signature`)).status, 404);
        await giveSignature(doctor, sigA);
        await create();
        const list = await call(asPatient(), "GET", `/api/medical/${mine}`);
        assert.equal(list.status, 200);
        assert.equal(list.body.length, 2);
        assert.deepEqual(list.body.map((d) => d.isSigned).sort(), [false, true]);
        assert.ok(!JSON.stringify(list.body).includes("signatureKey"));
        const history = await call(asDoctor(), "GET", `/api/medical/patients/${patient._id}/history`);
        assert.ok(!JSON.stringify(history.body).includes("signatureKey"));
      });
    });
  }

  // Access matrix for ALL FOUR signature routes. (verifyToken is stubbed in this file: a request with no matching
  // role header is "no token" = 401, so a doctor's token on a patient route and vice versa also get 401.)
  describe("signature routes: access matrix", () => {
    const ROUTES = [
      { name: "doctor prescription route", role: "doctor", kind: "prescription", path: (id) => `/api/medical/prescriptions/${id}/signature` },
      { name: "doctor certificate route", role: "doctor", kind: "certificate", path: (id) => `/api/medical/certificates/${id}/signature` },
      { name: "patient prescription route", role: "patient", kind: "prescription", path: (id) => `/api/medical/my-prescriptions/${id}/signature` },
      { name: "patient certificate route", role: "patient", kind: "certificate", path: (id) => `/api/medical/my-certificates/${id}/signature` },
    ];

    for (const route of ROUTES) {
      test(`${route.name}: owner 200, another ${route.role} 404, no token 401, wrong-role token 401, unsigned/unknown id 404`, async () => {
        await giveSignature(doctor, sigA);
        const make = route.kind === "prescription" ? () => rx({ sign: true }) : () => cert({ sign: true });
        const signedDoc = (await make()).body[route.kind];
        const unsignedDoc = (await (route.kind === "prescription" ? rx() : cert())).body[route.kind];

        const owner = route.role === "doctor" ? asDoctor() : asPatient();
        const stranger = route.role === "doctor" ? asDoctor(otherDoctor) : asPatient(otherPatient);
        const wrongRole = route.role === "doctor" ? asPatient() : asDoctor();

        const ok = await call(owner, "GET", route.path(signedDoc._id));
        assert.equal(ok.status, 200);
        assert.ok(ok.body.equals(sigA), "owner gets the signed image");

        assert.equal((await call(stranger, "GET", route.path(signedDoc._id))).status, 404, "another " + route.role);
        assert.equal((await call({}, "GET", route.path(signedDoc._id))).status, 401, "no token");
        assert.equal((await call(wrongRole, "GET", route.path(signedDoc._id))).status, 401, "wrong-role token");

        // The 404 for a stranger must be indistinguishable from "no such signature" (ids cannot be probed).
        const strangerBody = (await call(stranger, "GET", route.path(signedDoc._id))).body;
        const unknownBody = (await call(owner, "GET", route.path(new mongoose.Types.ObjectId()))).body;
        assert.deepEqual(strangerBody, unknownBody);

        assert.equal((await call(owner, "GET", route.path(unsignedDoc._id))).status, 404, "own but unsigned");
        assert.equal((await call(owner, "GET", route.path("not-an-id"))).status, 404, "malformed id");
      });
    }
  });
});
