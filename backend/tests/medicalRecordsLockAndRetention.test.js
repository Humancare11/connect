process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_not_used";

const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const s3 = { objects: new Map(), deleted: [], failKeys: new Set() };
function stub(rel, exports) {
  const file = require.resolve(path.join("..", rel));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
}
stub("config/s3", {
  s3Client: {
    send: async (command) => {
      const name = command.constructor.name;
      const input = command.input;
      if (name === "DeleteObjectCommand") {
        if (s3.failKeys.has(input.Key)) throw new Error("S3 down");
        s3.deleted.push(input.Key);
        s3.objects.delete(input.Key);
      }
      return {};
    },
  },
  getBucketName: () => "test-bucket",
});

const Prescription = require("../models/Prescription");
const MedicalCertificate = require("../models/MedicalCertificate");
const RetentionPolicy = require("../models/RetentionPolicy");
const { runRetentionCleanup } = require("../jobs/retentionJobs");

const oid = () => new mongoose.Types.ObjectId();
const DAY = 24 * 60 * 60 * 1000;

describe("Prescription / MedicalCertificate are write-once (updates blocked, deletes allowed)", () => {
  let mongod;
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });
  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await Prescription.deleteMany({});
    await MedicalCertificate.deleteMany({});
  });

  const make = {
    Prescription: () => Prescription.create({ appointmentId: oid(), doctorId: oid(), patientId: oid() }),
    MedicalCertificate: () => MedicalCertificate.create({ appointmentId: oid(), doctorId: oid(), patientId: oid(), issuedDate: "2026-10-01" }),
  };

  for (const [name, Model] of [["Prescription", Prescription], ["MedicalCertificate", MedicalCertificate]]) {
    test(`${name}: every update path is rejected and the stored document is unchanged`, async () => {
      const doc = await make[name]();
      const id = doc._id;
      await assert.rejects(Model.updateOne({ _id: id }, { $set: { signatureKey: "x" } }), /cannot be changed/);
      await assert.rejects(Model.updateMany({}, { $set: { signatureKey: "x" } }), /cannot be changed/);
      await assert.rejects(Model.findOneAndUpdate({ _id: id }, { $set: { signatureKey: "x" } }), /cannot be changed/);
      await assert.rejects(Model.findByIdAndUpdate(id, { $set: { signatureKey: "x" } }), /cannot be changed/);
      await assert.rejects(Model.replaceOne({ _id: id }, { appointmentId: oid(), doctorId: oid(), patientId: oid() }), /cannot be changed/);
      const loaded = await Model.findById(id);
      loaded.signatureKey = "x";
      await assert.rejects(loaded.save(), /cannot be changed/);
      await assert.rejects(loaded.updateOne({ $set: { signatureKey: "y" } }), /cannot be changed/);
      assert.equal((await Model.findById(id).lean()).signatureKey, "");
    });

    test(`${name}: creating and deleting still work`, async () => {
      const a = await make[name]();
      const b = await make[name]();
      await Model.deleteOne({ _id: a._id });
      await (await Model.findById(b._id)).deleteOne();
      assert.equal(await Model.countDocuments(), 0);
    });
  }
});

describe("retention job: medical records and their S3 signature copies", () => {
  let mongod;
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  });
  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    for (const M of [Prescription, MedicalCertificate, RetentionPolicy]) await M.collection.deleteMany({});
    s3.objects.clear();
    s3.deleted.length = 0;
    s3.failKeys.clear();
    await RetentionPolicy.create({ key: "medicalRecords", label: "Medical records", retentionDays: 30, enabled: true });
  });

  // Raw insert so createdAt can be in the past.
  const insert = (Model, extra, ageDays) =>
    Model.collection.insertOne({ appointmentId: oid(), doctorId: oid(), patientId: oid(), issuedDate: "2026-01-01", createdAt: new Date(Date.now() - ageDays * DAY), ...extra });

  test("old records are deleted with their signature copies; recent and unsigned ones behave correctly", async () => {
    const oldRxKey = "prescriptions/aaa/signature.png";
    const oldCertKey = "certificates/bbb/signature.png";
    const newRxKey = "prescriptions/ccc/signature.png";
    await insert(Prescription, { signatureKey: oldRxKey }, 90);
    await insert(MedicalCertificate, { signatureKey: oldCertKey }, 90);
    await insert(Prescription, {}, 90); // old, unsigned: just the row
    await insert(MedicalCertificate, { signatureKey: "" }, 90); // old, empty key
    await insert(Prescription, { signatureKey: newRxKey }, 1); // recent: kept, signature kept
    for (const k of [oldRxKey, oldCertKey, newRxKey]) s3.objects.set(k, Buffer.from("x"));

    const out = await runRetentionCleanup();

    assert.equal(out.deleted.medicalRecords, 4);
    assert.equal(out.deleted.medicalSignatureFiles, 2);
    assert.deepEqual([...s3.deleted].sort(), [oldCertKey, oldRxKey].sort());
    assert.ok(s3.objects.has(newRxKey));
    assert.equal(await Prescription.countDocuments(), 1);
    assert.equal(await MedicalCertificate.countDocuments(), 0);
  });

  test("an S3 delete failure is logged and does not stop the job (rows still deleted, other copies still removed)", async () => {
    const bad = "prescriptions/bad/signature.png";
    const good = "certificates/good/signature.png";
    await insert(Prescription, { signatureKey: bad }, 90);
    await insert(MedicalCertificate, { signatureKey: good }, 90);
    s3.failKeys.add(bad);

    const logged = [];
    const original = console.error;
    console.error = (...a) => logged.push(a.join(" "));
    let out;
    try {
      out = await runRetentionCleanup();
    } finally {
      console.error = original;
    }

    assert.equal(out.deleted.medicalRecords, 2);
    assert.equal(out.deleted.medicalSignatureFiles, 1);
    assert.deepEqual(s3.deleted, [good]);
    assert.ok(logged.some((l) => l.includes(bad)));
    assert.equal(await Prescription.countDocuments(), 0);
  });

  test("no medicalRecords policy: nothing is touched", async () => {
    await RetentionPolicy.collection.deleteMany({});
    await insert(Prescription, { signatureKey: "prescriptions/z/signature.png" }, 90);
    await runRetentionCleanup();
    assert.equal(await Prescription.countDocuments(), 1);
    assert.equal(s3.deleted.length, 0);
  });
});
