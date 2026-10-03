const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { encryptEmailContent, decryptEmailContent } = require("../utils/emailCrypto");
const Mailbox = require("../models/Mailbox");
const EmailMessage = require("../models/EmailMessage");
const EmailAttachment = require("../models/EmailAttachment");
const EmailView = require("../models/EmailView");

const oid = () => new mongoose.Types.ObjectId();

describe("emailCrypto", () => {
  test("round-trips text, html and snippet", () => {
    const content = { text: "Hello Meera", html: "<p>Hello Meera</p>", snippet: "Hello Meera" };
    assert.deepEqual(decryptEmailContent(encryptEmailContent(content)), content);
  });

  test("ciphertext does not contain the plaintext", () => {
    const env = encryptEmailContent({ text: "blood test result", html: "", snippet: "blood test" });
    assert.ok(!JSON.stringify(env).includes("blood"));
  });

  test("uses a fresh IV each time", () => {
    const a = encryptEmailContent({ text: "same" });
    const b = encryptEmailContent({ text: "same" });
    assert.notEqual(a.iv, b.iv);
    assert.notEqual(a.cipherText, b.cipherText);
  });

  test("tampered ciphertext is rejected", () => {
    const env = encryptEmailContent({ text: "secret" });
    const bad = { ...env, cipherText: Buffer.from("tampered-data").toString("base64") };
    assert.throws(() => decryptEmailContent(bad));
  });

  test("missing envelope yields empty content", () => {
    assert.deepEqual(decryptEmailContent(null), { text: "", html: "", snippet: "" });
  });
});

describe("Mailbox", () => {
  test("accepts a company-domain address and lowercases it", async () => {
    const m = new Mailbox({ address: "Support@HumanCareConnect.co", displayName: "Support" });
    await m.validate();
    assert.equal(m.address, "support@humancareconnect.co");
  });

  test("rejects an address outside the company domain", async () => {
    await assert.rejects(
      new Mailbox({ address: "someone@gmail.com", displayName: "X" }).validate(),
      (err) => Boolean(err.errors.address)
    );
  });

  test("rejects a malformed colour", async () => {
    await assert.rejects(
      new Mailbox({ address: "tech@humancareconnect.co", displayName: "Tech", color: "red" }).validate(),
      (err) => Boolean(err.errors.color)
    );
  });
});

describe("EmailMessage", () => {
  const base = () => ({
    mailbox: oid(),
    direction: "in",
    from: { name: "Anita", address: "Anita.Joshi@gmail.com" },
    messageDate: new Date(),
    status: "received",
  });

  test("valid inbound message", async () => {
    const m = new EmailMessage(base());
    await m.validate();
    assert.equal(m.from.address, "anita.joshi@gmail.com");
    assert.equal(m.firstViewedAt, null);
  });

  test("rejects an unknown status or direction", async () => {
    await assert.rejects(new EmailMessage({ ...base(), status: "bogus" }).validate(), (e) => Boolean(e.errors.status));
    await assert.rejects(new EmailMessage({ ...base(), direction: "sideways" }).validate(), (e) => Boolean(e.errors.direction));
  });

  test("setContent/getContent encrypt the body at rest", () => {
    const m = new EmailMessage(base());
    m.setContent({ text: "Report not downloading", html: "", snippet: "Report not" });
    assert.ok(!JSON.stringify(m.toObject().content).includes("Report"));
    assert.equal(m.getContent().text, "Report not downloading");
  });

  test("has the unique Gmail-id and idempotency indexes", () => {
    const idx = EmailMessage.schema.indexes();
    const unique = idx.filter(([, o]) => o.unique).map(([k]) => Object.keys(k).join(","));
    assert.ok(unique.includes("mailbox,gmailMessageId"));
    assert.ok(unique.includes("sentByAdmin,clientRequestId"));
  });
});

describe("EmailAttachment / EmailView", () => {
  test("attachment requires message, mailbox and filename", async () => {
    await assert.rejects(
      new EmailAttachment({}).validate(),
      (e) => Boolean(e.errors.message && e.errors.mailbox && e.errors.filename)
    );
  });

  test("view requires message, mailbox and admin and defaults viewedAt", async () => {
    await assert.rejects(
      new EmailView({}).validate(),
      (e) => Boolean(e.errors.message && e.errors.mailbox && e.errors.admin)
    );
    assert.ok(new EmailView({ message: oid(), mailbox: oid(), admin: oid() }).viewedAt instanceof Date);
  });
});
