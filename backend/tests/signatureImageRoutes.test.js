const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const mongoose = require("mongoose");
const sharp = require("sharp");
const { MongoMemoryServer } = require("mongodb-memory-server");
const EmailSignature = require("../models/EmailSignature");
const EmailSignatureDefault = require("../models/EmailSignatureDefault");
const Mailbox = require("../models/Mailbox");
const User = require("../models/User");
const signaturesRouter = require("../routes/adminEmailSignatures");
const { cleanImageAlt, cleanImageLink } = require("../utils/emailSignature");

const png = (w = 500, h = 120) => sharp({ create: { width: w, height: h, channels: 4, background: { r: 10, g: 90, b: 150, alpha: 1 } } }).png().toBuffer();

describe("alt text and image link cleaning", () => {
  test("alt: single line, up to 120, empty allowed", () => {
    assert.equal(cleanImageAlt("  Anita Rao \n Care  Coordinator "), "Anita Rao Care Coordinator");
    assert.equal(cleanImageAlt(""), "");
    assert.throws(() => cleanImageAlt("x".repeat(121)), /120/);
    assert.throws(() => cleanImageAlt(5), /text/);
  });

  test("link: only http(s), normalised, no credentials, no spaces", () => {
    assert.equal(cleanImageLink(""), "");
    assert.equal(cleanImageLink("  https://humancareconnect.co  "), "https://humancareconnect.co/");
    assert.equal(cleanImageLink("www.humancareconnect.co"), "https://www.humancareconnect.co/");
    assert.equal(cleanImageLink("http://example.com/a?b=1"), "http://example.com/a?b=1");
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "ftp://example.com", "//evil.example.com", "https://user:pw@example.com", "https://exa mple.com", "https://localhost", "mailto:a@b.co", `https://example.com/${"a".repeat(500)}`, "not a link"]) {
      assert.throws(() => cleanImageLink(bad), /link|https|valid|long/i, bad);
    }
  });
});

describe("signature images: API", () => {
  let mongod, server, base, anita, ravi, root, store, now;
  const fakeAuth = (req, res, next) => { req.user = { id: req.headers["x-test-user"], role: req.headers["x-test-role"] || "admin" }; next(); };

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await Promise.all([EmailSignature.init(), EmailSignatureDefault.init(), Mailbox.init(), User.init()]);
    store = {
      files: new Map(),
      failPut: false,
      async put(key, buf, type) { if (this.failPut) throw new Error("S3 down"); this.files.set(key, { buf, type }); },
      async get(key) { if (!this.files.has(key)) throw new Error("missing"); return this.files.get(key).buf; },
      async remove(key) { this.files.delete(key); },
    };
    now = () => Date.now();
    const app = express();
    app.use(express.json());
    app.use("/api/admin/email/signatures", signaturesRouter.create({ guard: [fakeAuth], store, uploadsPerHour: 4, now: () => now() }));
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
    await Promise.all([EmailSignature.deleteMany({}), EmailSignatureDefault.deleteMany({}), Mailbox.deleteMany({}), User.deleteMany({})]);
    store.files.clear();
    store.failPut = false;
    now = () => Date.now();
    anita = await User.create({ name: "Anita Rao", email: "anita@x.co", role: "admin" });
    ravi = await User.create({ name: "Ravi", email: "ravi@x.co", role: "admin" });
    root = await User.create({ name: "Root", email: "root@x.co", role: "superadmin" });
    await Mailbox.create({ address: "support@humancareconnect.co", displayName: "Support", signature: "Human Care Connect" });
  });

  const headers = (user, role) => ({ "x-test-user": String(user._id), ...(role ? { "x-test-role": role } : {}) });
  const json = async (user, method, path, body, role) => {
    const res = await fetch(base + path, { method, headers: { "content-type": "application/json", ...headers(user, role) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  };
  const upload = async (user, id, buf, { name = "banner.png", type = "image/png", role } = {}) => {
    const fd = new FormData();
    if (buf) fd.set("image", new Blob([buf], { type }), name);
    const res = await fetch(`${base}/${id}/image`, { method: "PUT", headers: headers(user, role), body: fd });
    return { status: res.status, body: await res.json() };
  };
  const make = async (user, name = "Formal", content = "Anita Rao\nCare Coordinator") => (await json(user, "POST", "/", { name, content })).body.signature;

  test("upload: processed, stored privately, and the response never carries the storage key", async () => {
    const sig = await make(anita);
    const r = await upload(anita, sig.id, await png(1200, 300));
    assert.equal(r.status, 200);
    assert.deepEqual([r.body.signature.image.width, r.body.signature.image.height, r.body.signature.image.mime], [600, 150, "image/png"]);
    assert.equal(r.body.signature.layout, "image_text", "a first image switches the layout");
    assert.ok(!JSON.stringify(r.body).includes("email-signature-images"));
    const [key] = [...store.files.keys()];
    assert.match(key, new RegExp(`^email-signature-images/${anita._id}/[0-9a-f]{24}\\.png$`));
    const row = await EmailSignature.findById(sig.id).lean();
    assert.equal(row.image.key, key);
  });

  test("the list shows the image facts and the effective alt text", async () => {
    const sig = await make(anita, "Formal", "Anita Rao, Care Coordinator\n+91 98765 43210");
    await upload(anita, sig.id, await png());
    const g = (await json(anita, "GET", "/")).body.signatures[0];
    assert.equal(g.imageAlt, "");
    assert.equal(g.imageAltEffective, "Anita Rao, Care Coordinator");
    await json(anita, "PATCH", `/${sig.id}`, { imageAlt: "Human Care Connect banner" });
    assert.equal((await json(anita, "GET", "/")).body.signatures[0].imageAltEffective, "Human Care Connect banner");
  });

  test("replace: new object, the old one is deleted", async () => {
    const sig = await make(anita);
    await upload(anita, sig.id, await png());
    const first = [...store.files.keys()][0];
    await upload(anita, sig.id, await png(300, 90));
    assert.equal(store.files.size, 1);
    assert.ok(!store.files.has(first));
    assert.equal((await EmailSignature.findById(sig.id)).image.width, 300);
  });

  test("remove: image, link and layout reset, object deleted", async () => {
    const sig = await make(anita);
    await upload(anita, sig.id, await png());
    await json(anita, "PATCH", `/${sig.id}`, { imageLink: "https://humancareconnect.co", layout: "image" });
    const r = await json(anita, "DELETE", `/${sig.id}/image`);
    assert.equal(r.status, 200);
    assert.deepEqual([r.body.signature.image, r.body.signature.layout, r.body.signature.imageLink], [null, "text", ""]);
    assert.equal(store.files.size, 0);
  });

  test("deleting the signature deletes its image object", async () => {
    const sig = await make(anita);
    await upload(anita, sig.id, await png());
    await json(anita, "DELETE", `/${sig.id}`);
    assert.equal(store.files.size, 0);
  });

  test("layout needs an image; alt and link are validated", async () => {
    const sig = await make(anita);
    assert.equal((await json(anita, "PATCH", `/${sig.id}`, { layout: "image" })).status, 400);
    assert.equal((await json(anita, "PATCH", `/${sig.id}`, { layout: "banner" })).status, 400);
    await upload(anita, sig.id, await png());
    assert.equal((await json(anita, "PATCH", `/${sig.id}`, { layout: "image" })).body.signature.layout, "image");
    assert.equal((await json(anita, "PATCH", `/${sig.id}`, { imageLink: "javascript:alert(1)" })).status, 400);
    assert.equal((await json(anita, "PATCH", `/${sig.id}`, { imageAlt: "x".repeat(121) })).status, 400);
    const ok = await json(anita, "PATCH", `/${sig.id}`, { imageLink: "www.humancareconnect.co" });
    assert.equal(ok.body.signature.imageLink, "https://www.humancareconnect.co/");
  });

  test("the text version stays required for every layout", async () => {
    const sig = await make(anita);
    await upload(anita, sig.id, await png());
    assert.equal((await json(anita, "PATCH", `/${sig.id}`, { layout: "image", content: "   " })).status, 400);
  });

  // ── bad images ──
  test("SVG, GIF, WebP, a script named .png, and an empty upload are refused and nothing is stored", async () => {
    const sig = await make(anita);
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const cases = [
      [svg, { name: "logo.png", type: "image/png" }],
      [await sharp({ create: { width: 100, height: 40, channels: 3, background: "#fff" } }).gif().toBuffer(), { name: "a.gif", type: "image/gif" }],
      [await sharp({ create: { width: 100, height: 40, channels: 3, background: "#fff" } }).webp().toBuffer(), { name: "a.png", type: "image/png" }],
      [Buffer.from("<?php echo 1; ?>"), { name: "shell.png", type: "image/png" }],
      [null, {}],
    ];
    let tick = 0;
    for (const [buf, opts] of cases) {
      // every attempt counts towards the hourly throttle, so move the clock on between them
      tick += 1;
      now = () => Date.now() + tick * 3_700_000;
      const r = await upload(anita, sig.id, buf, opts);
      assert.equal(r.status, 400, opts.name || "empty");
    }
    assert.equal(store.files.size, 0);
    assert.equal((await EmailSignature.findById(sig.id)).image, null);
  });

  test("a real PNG with a misleading name and content type is still processed from its bytes", async () => {
    const sig = await make(anita);
    const r = await upload(anita, sig.id, await png(), { name: "photo.exe", type: "application/octet-stream" });
    assert.equal(r.status, 200);
  });

  test("over 5 MB is refused", async () => {
    const sig = await make(anita);
    const r = await upload(anita, sig.id, Buffer.alloc(5 * 1024 * 1024 + 10, 7));
    assert.equal(r.status, 400);
    assert.match(r.body.msg, /5 MB/);
  });

  test("a storage failure leaves the signature unchanged", async () => {
    const sig = await make(anita);
    await upload(anita, sig.id, await png());
    const before = await EmailSignature.findById(sig.id).lean();
    store.failPut = true;
    const r = await upload(anita, sig.id, await png(300, 90));
    assert.equal(r.status, 500);
    const after = await EmailSignature.findById(sig.id).lean();
    assert.equal(after.image.key, before.image.key);
    assert.ok(store.files.has(before.image.key), "the old image is still there");
  });

  test("uploads are throttled per admin", async () => {
    const sig = await make(anita);
    const buf = await png();
    for (let i = 0; i < 4; i += 1) assert.equal((await upload(anita, sig.id, buf)).status, 200);
    const r = await upload(anita, sig.id, buf);
    assert.equal(r.status, 429);
    // another admin is not affected, and the window moves on
    const theirs = await make(ravi, "Mine");
    assert.equal((await upload(ravi, theirs.id, buf)).status, 200);
    now = () => Date.now() + 3_700_000;
    assert.equal((await upload(anita, sig.id, buf)).status, 200);
  });

  // ── privacy ──
  test("only the owner can read the image; nobody else, including a Super Admin", async () => {
    const sig = await make(anita);
    await upload(anita, sig.id, await png());
    const mine = await fetch(`${base}/${sig.id}/image`, { headers: headers(anita) });
    assert.equal(mine.status, 200);
    assert.equal(mine.headers.get("content-type"), "image/png");
    assert.equal(mine.headers.get("x-content-type-options"), "nosniff");
    assert.match(mine.headers.get("content-security-policy"), /sandbox/);
    assert.match(mine.headers.get("cache-control"), /no-store/);
    for (const [who, role] of [[ravi, undefined], [root, "superadmin"]]) {
      const r = await fetch(`${base}/${sig.id}/image`, { headers: headers(who, role) });
      assert.equal(r.status, 404);
      assert.equal(r.headers.get("content-type").includes("image"), false);
    }
  });

  test("nobody else can replace or remove it, and nothing changes", async () => {
    const sig = await make(anita);
    await upload(anita, sig.id, await png());
    const before = (await EmailSignature.findById(sig.id).lean()).image.key;
    for (const [who, role] of [[ravi, undefined], [root, "superadmin"]]) {
      assert.equal((await upload(who, sig.id, await png(100, 40), { role })).status, 404);
      assert.equal((await json(who, "DELETE", `/${sig.id}/image`, undefined, role)).status, 404);
      assert.equal((await json(who, "PATCH", `/${sig.id}`, { imageLink: "https://evil.example.com", layout: "text" }, role)).status, 404);
    }
    const row = await EmailSignature.findById(sig.id).lean();
    assert.equal(row.image.key, before);
    assert.equal(row.imageLink, "");
    assert.equal(store.files.size, 1);
  });

  test("an unknown or malformed id is 404; a signature without an image is 404 for GET", async () => {
    const sig = await make(anita);
    assert.equal((await fetch(`${base}/${sig.id}/image`, { headers: headers(anita) })).status, 404);
    assert.equal((await fetch(`${base}/${new mongoose.Types.ObjectId()}/image`, { headers: headers(anita) })).status, 404);
    assert.equal((await fetch(`${base}/nope/image`, { headers: headers(anita) })).status, 404);
    assert.equal((await upload(anita, "nope", await png())).status, 404);
  });

  test("the object key is under the owner's own prefix, so the two admins' files never share a path", async () => {
    const a = await make(anita);
    const b = await make(ravi, "Mine");
    await upload(anita, a.id, await png());
    await upload(ravi, b.id, await png());
    const keys = [...store.files.keys()];
    assert.equal(keys.filter((k) => k.includes(`/${anita._id}/`)).length, 1);
    assert.equal(keys.filter((k) => k.includes(`/${ravi._id}/`)).length, 1);
  });

  test("the image does not travel with the per-mailbox defaults or other lists", async () => {
    const sig = await make(anita);
    await upload(anita, sig.id, await png());
    const list = JSON.stringify((await json(anita, "GET", "/")).body);
    assert.ok(!list.includes("email-signature-images"));
    assert.ok(!list.includes(String(anita._id)));
  });
});
