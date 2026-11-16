const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const EmailMessage = require("../models/EmailMessage");
const { backfillSnippets, parseArgs } = require("../scripts/backfillEmailSnippets");
const { encryptEmailContent, decryptSnippet } = require("../utils/emailCrypto");

describe("backfill of EmailMessage.snippetEnc (in-memory database only)", () => {
  let mongod;
  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await EmailMessage.init();
  });
  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  let seq = 0;
  const base = () => ({
    mailbox: new mongoose.Types.ObjectId(),
    direction: "in",
    status: "received",
    gmailMessageId: `g${++seq}`,
    gmailThreadId: `t${seq}`,
    from: { address: "c@x.com" },
    subject: "S",
    messageDate: new Date(),
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  });
  // A row written before snippetEnc existed: content only.
  const legacy = (snippet) => EmailMessage.collection.insertOne({ ...base(), content: encryptEmailContent({ text: "body", html: "", snippet }) });

  beforeEach(() => EmailMessage.deleteMany({}));

  test("dry run counts, samples the key, and writes nothing", async () => {
    await legacy("one");
    await legacy("two");
    const lines = [];
    const stats = await backfillSnippets({ model: EmailMessage, dryRun: true, log: (l) => lines.push(l) });
    assert.deepEqual([stats.missing, stats.done, stats.dryRun], [2, 0, true]);
    assert.equal(await EmailMessage.countDocuments({ snippetEnc: { $ne: null } }), 0);
    assert.ok(lines.every((l) => !/one|two|body/.test(l)), "no mail content in the output");
  });

  test("writes only the snippet envelope, keeps the body and updatedAt, and is safe to re-run", async () => {
    const { insertedId } = await legacy("hello snippet");
    const before = await EmailMessage.collection.findOne({ _id: insertedId });
    const stats = await backfillSnippets({ model: EmailMessage, dryRun: false, batchSize: 1 });
    assert.equal(stats.done, 1);
    const after = await EmailMessage.collection.findOne({ _id: insertedId });
    assert.equal(decryptSnippet(after.snippetEnc), "hello snippet");
    assert.deepEqual(after.content, before.content);
    assert.deepEqual(after.updatedAt, before.updatedAt);
    assert.equal((await backfillSnippets({ model: EmailMessage, dryRun: false })).done, 0, "second run changes nothing");
  });

  test("rows that already have a snippet, or have no body, are not touched; an unreadable body is skipped", async () => {
    const doc = new EmailMessage({ ...base() });
    doc.setContent({ text: "t", html: "", snippet: "already" });
    await doc.save();
    await EmailMessage.collection.insertOne({ ...base() }); // no content at all
    await EmailMessage.collection.insertOne({ ...base(), content: { cipherText: "AAAA", iv: "AAAAAAAAAAAAAAAA", authTag: "AAAAAAAAAAAAAAAAAAAAAA==", keyVersion: "v1" } });
    const stats = await backfillSnippets({ model: EmailMessage, dryRun: false });
    assert.deepEqual([stats.done, stats.skipped], [0, 1]);
    assert.equal(decryptSnippet((await EmailMessage.findById(doc._id)).snippetEnc), "already");
  });

  test("--limit stops early; production needs both flags", () => {
    assert.equal(parseArgs(["--limit=5"]).limit, 5);
    assert.equal(parseArgs(["--allow-production"]).allowProduction, false);
    assert.equal(parseArgs(["--confirm-production=YES"]).allowProduction, false);
    assert.equal(parseArgs(["--allow-production", "--confirm-production=YES"]).allowProduction, true);
    assert.equal(parseArgs(["--dry-run"]).dryRun, true);
  });
});
