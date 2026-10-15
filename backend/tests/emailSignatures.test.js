const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const EmailSignature = require("../models/EmailSignature");
const EmailSignatureDefault = require("../models/EmailSignatureDefault");
const EmailSettings = require("../models/EmailSettings");
const Mailbox = require("../models/Mailbox");
const User = require("../models/User");
const signaturesRouter = require("../routes/adminEmailSignatures");
const { clearSettingsCache } = require("../services/email/emailSettings");
const { cleanSignatureContent, cleanSignatureName } = require("../utils/emailSignature");

describe("cleaning", () => {
  test("content: LF breaks, trailing spaces gone, control characters gone, at most one blank line", () => {
    assert.equal(cleanSignatureContent("  Dr Rao  \r\nCare team\t\r\n\r\n\r\n\r\n+91 98\u0000 76"), "Dr Rao  \nCare team\n\n+91 98 76".replace("Dr Rao  ", "Dr Rao"));
    assert.equal(cleanSignatureContent("a​b‮c"), "abc");
  });
  test("content: must exist, fit 1000 characters and 20 lines, and not hold a '--' divider line", () => {
    assert.throws(() => cleanSignatureContent("   \n  "), /Write the signature/);
    assert.throws(() => cleanSignatureContent(5), /Write the signature/);
    assert.equal(cleanSignatureContent("x".repeat(1000)).length, 1000);
    assert.throws(() => cleanSignatureContent("x".repeat(1001)), /1000 characters/);
    assert.throws(() => cleanSignatureContent(Array.from({ length: 21 }, (_, i) => `line ${i}`).join("\n")), /20 lines/);
    assert.throws(() => cleanSignatureContent("Hello\n--\nWorld"), /divider/);
    assert.throws(() => cleanSignatureContent("Hello\n-- \nWorld"), /divider/);
    assert.equal(cleanSignatureContent("Hello -- world\n--- ok"), "Hello -- world\n--- ok");
  });
  test("content: markup is kept as plain text, never interpreted", () => {
    assert.equal(cleanSignatureContent('<img src=x onerror="alert(1)">\n<b>Dr</b>'), '<img src=x onerror="alert(1)">\n<b>Dr</b>');
  });
  test("name: single line, 1 to 40 characters", () => {
    assert.equal(cleanSignatureName("  Formal \n  reply "), "Formal reply");
    assert.throws(() => cleanSignatureName(""), /name/);
    assert.throws(() => cleanSignatureName("   "), /name/);
    assert.throws(() => cleanSignatureName(null), /name/);
    assert.equal(cleanSignatureName("x".repeat(40)).length, 40);
    assert.throws(() => cleanSignatureName("x".repeat(41)), /40 characters/);
  });
});

describe("my signatures: API", () => {
  let mongod, server, base, anita, ravi, root, support, strategic, restricted;
  // The session user comes from a header here; in production it is the verified token.
  const fakeAuth = (req, res, next) => { req.user = { id: req.headers["x-test-user"], role: req.headers["x-test-role"] || "admin" }; next(); };

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([EmailSignature.init(), EmailSignatureDefault.init(), Mailbox.init(), User.init(), EmailSettings.init()]);
    const app = express();
    app.use(express.json());
    app.use("/api/admin/email/signatures", signaturesRouter.create({ guard: [fakeAuth] }));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}/api/admin/email/signatures`;
  });
  after(async () => {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await mongod.stop();
  });
  beforeEach(async () => {
    await Promise.all([EmailSignature.deleteMany({}), EmailSignatureDefault.deleteMany({}), Mailbox.deleteMany({}), User.deleteMany({}), EmailSettings.deleteMany({})]);
    clearSettingsCache();
    anita = await User.create({ name: "Anita Rao", email: "anita@x.co", role: "admin" });
    ravi = await User.create({ name: "Ravi", email: "ravi@x.co", role: "admin" });
    root = await User.create({ name: "Root", email: "root@x.co", role: "superadmin" });
    support = await Mailbox.create({ address: "support@humancareconnect.co", displayName: "Support", signature: "Human Care Connect\nsupport@humancareconnect.co" });
    strategic = await Mailbox.create({ address: "strategicalliance@humancareconnect.co", displayName: "Strategic Alliance", signature: "Human Care Connect" });
    restricted = await Mailbox.create({ address: "billing@humancareconnect.co", displayName: "Billing", allowedAdmins: [ravi._id] });
  });

  const call = async (user, method, path = "", body, role) => {
    const res = await fetch(base + path, {
      method,
      headers: { "content-type": "application/json", "x-test-user": String(user._id), ...(role ? { "x-test-role": role } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
  const as = (user, role) => ({
    get: (p) => call(user, "GET", p, undefined, role),
    post: (p, b) => call(user, "POST", p, b, role),
    patch: (p, b) => call(user, "PATCH", p, b, role),
    del: (p) => call(user, "DELETE", p, undefined, role),
    put: (p, b) => call(user, "PUT", p, b, role),
  });
  const A = () => as(anita);
  const R = () => as(ravi);
  const ROOT = () => as(root, "superadmin");

  // ── basics ──
  test("a new admin has none, and gets a template: their name and the company footer", async () => {
    const { status, body } = await A().get("/");
    assert.equal(status, 200);
    assert.deepEqual(body.signatures, []);
    // The first mailbox this admin may use (by sort order, then address) supplies the footer text.
    assert.equal(body.template, "Anita Rao\nHuman Care Connect");
    assert.equal(body.companyFooterWithSignature, true);
    assert.deepEqual(body.limits, { maxSignatures: 10, maxNameLength: 40, maxContentLength: 1000, maxLines: 20 });
  });

  test("create, list, edit and delete", async () => {
    let r = await A().post("/", { name: "Formal", content: "Anita Rao\nCare Coordinator" });
    assert.equal(r.status, 201);
    const id = r.body.signature.id;
    assert.deepEqual([r.body.signature.name, r.body.signature.isDefault], ["Formal", true], "the first one becomes the default");

    r = await A().patch(`/${id}`, { name: "Formal reply", content: "Anita\n+91 98765 43210" });
    assert.deepEqual([r.status, r.body.signature.name, r.body.signature.content], [200, "Formal reply", "Anita\n+91 98765 43210"]);

    assert.equal((await A().get("/")).body.signatures.length, 1);
    assert.equal((await A().del(`/${id}`)).status, 200);
    assert.equal((await A().get("/")).body.signatures.length, 0);
  });

  test("the response carries no owner and the owner cannot be chosen in the request", async () => {
    const r = await A().post("/", { name: "Mine", content: "x", owner: String(ravi._id) });
    assert.equal(r.status, 201);
    assert.equal(JSON.stringify(r.body).includes(String(anita._id)), false);
    const row = await EmailSignature.findById(r.body.signature.id);
    assert.equal(String(row.owner), String(anita._id));
    assert.equal((await A().patch(`/${r.body.signature.id}`, { owner: String(ravi._id) })).status, 400);
  });

  test("names are unique per admin, ignoring case; two admins may use the same name", async () => {
    await A().post("/", { name: "Short", content: "a" });
    assert.equal((await A().post("/", { name: "SHORT", content: "b" })).status, 409);
    assert.equal((await R().post("/", { name: "Short", content: "c" })).status, 201);
  });

  test("at most 10 per admin", async () => {
    for (let i = 0; i < 10; i += 1) assert.equal((await A().post("/", { name: `S${i}`, content: "x" })).status, 201);
    const r = await A().post("/", { name: "One more", content: "x" });
    assert.equal(r.status, 400);
    assert.match(r.body.msg, /up to 10/);
    assert.equal((await R().post("/", { name: "Other admin", content: "x" })).status, 201, "the limit is per admin");
  });

  test("validation errors are 400 with a plain message", async () => {
    for (const body of [{}, { name: "", content: "x" }, { name: "x".repeat(41), content: "x" }, { name: "N", content: "" }, { name: "N", content: "y".repeat(1001) }, { name: "N", content: "a\n--\nb" }, { name: "N", content: "x", isDefault: "yes" }]) {
      const r = await A().post("/", body);
      assert.equal(r.status, 400, JSON.stringify(body).slice(0, 60));
      assert.equal(typeof r.body.msg, "string");
    }
    assert.equal((await A().get("/")).body.signatures.length, 0);
  });

  // ── default ──
  test("exactly one default; making another one default moves it", async () => {
    const a = (await A().post("/", { name: "A", content: "a" })).body.signature;
    const b = (await A().post("/", { name: "B", content: "b" })).body.signature;
    assert.deepEqual([a.isDefault, b.isDefault], [true, false]);
    await A().patch(`/${b.id}`, { isDefault: true });
    const list = (await A().get("/")).body.signatures;
    assert.deepEqual(list.map((s) => [s.name, s.isDefault]).sort(), [["A", false], ["B", true]]);
    assert.equal(await EmailSignature.countDocuments({ owner: anita._id, isDefault: true }), 1);
  });

  test("create with isDefault moves the default too", async () => {
    await A().post("/", { name: "A", content: "a" });
    await A().post("/", { name: "B", content: "b", isDefault: true });
    assert.equal(await EmailSignature.countDocuments({ owner: anita._id, isDefault: true }), 1);
    assert.equal((await EmailSignature.findOne({ owner: anita._id, isDefault: true })).name, "B");
  });

  test("the database refuses a second default for one owner", async () => {
    await EmailSignature.create({ owner: anita._id, name: "A", nameKey: "a", content: "a", isDefault: true });
    await assert.rejects(EmailSignature.create({ owner: anita._id, name: "B", nameKey: "b", content: "b", isDefault: true }), (e) => e.code === 11000);
    await EmailSignature.create({ owner: ravi._id, name: "A", nameKey: "a", content: "a", isDefault: true });
  });

  test("simultaneous 'make default' requests leave exactly one default", async () => {
    const ids = [];
    for (const n of ["A", "B", "C", "D"]) ids.push((await A().post("/", { name: n, content: n })).body.signature.id);
    await Promise.all(ids.map((id) => A().patch(`/${id}`, { isDefault: true })));
    assert.equal(await EmailSignature.countDocuments({ owner: anita._id, isDefault: true }), 1);
  });

  test("un-ticking the default, or deleting it, leaves no default (nothing is promoted)", async () => {
    const a = (await A().post("/", { name: "A", content: "a" })).body.signature;
    await A().post("/", { name: "B", content: "b" });
    await A().patch(`/${a.id}`, { isDefault: false });
    assert.equal(await EmailSignature.countDocuments({ owner: anita._id, isDefault: true }), 0);
    await A().patch(`/${a.id}`, { isDefault: true });
    await A().del(`/${a.id}`);
    assert.equal(await EmailSignature.countDocuments({ owner: anita._id, isDefault: true }), 0);
    assert.equal(await EmailSignature.countDocuments({ owner: anita._id }), 1);
  });

  // ── isolation ──
  test("one admin cannot see another admin's signatures", async () => {
    await A().post("/", { name: "Anita private", content: "Anita's number" });
    const r = await R().get("/");
    assert.deepEqual(r.body.signatures, []);
    assert.ok(!JSON.stringify(r.body).includes("Anita's number"));
  });

  test("another admin's id is 'not found' for read-modify-delete, and nothing changes", async () => {
    const mine = (await A().post("/", { name: "Anita", content: "original" })).body.signature;
    const patch = await R().patch(`/${mine.id}`, { content: "hacked", isDefault: false });
    assert.equal(patch.status, 404);
    assert.deepEqual(patch.body, { msg: "Signature not found." });
    assert.equal((await R().del(`/${mine.id}`)).status, 404);
    const unknown = await R().patch(`/${new mongoose.Types.ObjectId()}`, { content: "x" });
    assert.deepEqual([unknown.status, unknown.body], [404, patch.body], "indistinguishable from an id that does not exist");
    const row = await EmailSignature.findById(mine.id);
    assert.deepEqual([row.content, row.isDefault], ["original", true]);
  });

  test("a Super Admin gets no access to other admins' signatures either", async () => {
    const mine = (await A().post("/", { name: "Anita", content: "original" })).body.signature;
    const list = await ROOT().get("/");
    assert.deepEqual(list.body.signatures, []);
    assert.equal((await ROOT().patch(`/${mine.id}`, { content: "x" })).status, 404);
    assert.equal((await ROOT().del(`/${mine.id}`)).status, 404);
    assert.equal((await ROOT().put("/mailbox-defaults", { mailbox: String(support._id), signatureId: mine.id })).status, 404);
    assert.equal((await EmailSignature.findById(mine.id)).content, "original");
  });

  test("a Super Admin has their own signatures like any admin", async () => {
    assert.equal((await ROOT().post("/", { name: "Root", content: "Root" })).status, 201);
    assert.equal((await A().get("/")).body.signatures.length, 0);
  });

  test("malformed ids are 404, not an error", async () => {
    for (const id of ["abc", "123", "%00", "mailbox-defaults"]) {
      assert.equal((await A().patch(`/${id}`, { name: "x" })).status, 404, id);
      assert.equal((await A().del(`/${id}`)).status, 404, id);
    }
  });

  test("a disabled account is refused", async () => {
    await User.updateOne({ _id: anita._id }, { accountDisabled: true });
    assert.equal((await A().get("/")).status, 401);
    assert.equal((await A().post("/", { name: "x", content: "x" })).status, 401);
  });

  // ── per-mailbox default ──
  test("per-mailbox default: set, replace, clear; listed only for mailboxes the admin may use", async () => {
    const a = (await A().post("/", { name: "A", content: "a" })).body.signature;
    const b = (await A().post("/", { name: "B", content: "b" })).body.signature;
    assert.equal((await A().put("/mailbox-defaults", { mailbox: String(strategic._id), signatureId: a.id })).status, 200);
    assert.equal((await A().put("/mailbox-defaults", { mailbox: String(strategic._id), signatureId: b.id })).status, 200);
    let r = await A().get("/");
    assert.deepEqual(r.body.mailboxDefaults, { [String(strategic._id)]: b.id });
    assert.equal(await EmailSignatureDefault.countDocuments({ owner: anita._id }), 1);
    await A().put("/mailbox-defaults", { mailbox: String(strategic._id), signatureId: null });
    r = await A().get("/");
    assert.deepEqual(r.body.mailboxDefaults, {});
  });

  test("per-mailbox default needs a mailbox the admin may use, and one of their own signatures", async () => {
    const a = (await A().post("/", { name: "A", content: "a" })).body.signature;
    const theirs = (await R().post("/", { name: "R", content: "r" })).body.signature;
    assert.equal((await A().put("/mailbox-defaults", { mailbox: String(restricted._id), signatureId: a.id })).status, 404, "restricted mailbox");
    assert.equal((await A().put("/mailbox-defaults", { mailbox: String(strategic._id), signatureId: theirs.id })).status, 404, "someone else's signature");
    assert.equal((await A().put("/mailbox-defaults", { mailbox: "nope", signatureId: a.id })).status, 400);
    assert.equal((await A().put("/mailbox-defaults", { mailbox: String(strategic._id), signatureId: "nope" })).status, 400);
    assert.equal(await EmailSignatureDefault.countDocuments({}), 0);
    assert.equal((await R().put("/mailbox-defaults", { mailbox: String(restricted._id), signatureId: theirs.id })).status, 200, "Ravi may use it");
  });

  test("deleting a signature removes the mailbox defaults that pointed at it", async () => {
    const a = (await A().post("/", { name: "A", content: "a" })).body.signature;
    await A().put("/mailbox-defaults", { mailbox: String(strategic._id), signatureId: a.id });
    await A().put("/mailbox-defaults", { mailbox: String(support._id), signatureId: a.id });
    await A().del(`/${a.id}`);
    assert.equal(await EmailSignatureDefault.countDocuments({}), 0);
  });

  test("the mailbox list shows only mailboxes the admin may use", async () => {
    const a = await A().get("/");
    assert.deepEqual(a.body.mailboxes.map((m) => m.address).sort(), ["strategicalliance@humancareconnect.co", "support@humancareconnect.co"]);
    const r = await R().get("/");
    assert.equal(r.body.mailboxes.length, 3);
  });

  test("the footer setting is read as ON when the settings document predates the field", async () => {
    await EmailSettings.collection.insertOne({ key: "email", trackingEnabled: false });
    clearSettingsCache();
    assert.equal((await A().get("/")).body.companyFooterWithSignature, true);
    await EmailSettings.updateOne({ key: "email" }, { companyFooterWithSignature: false });
    clearSettingsCache();
    assert.equal((await A().get("/")).body.companyFooterWithSignature, false);
  });
});
