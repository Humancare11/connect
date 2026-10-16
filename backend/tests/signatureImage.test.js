const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const sharp = require("sharp");
const { processSignatureImage, SignatureImageError, MAX_OUTPUT_BYTES, MAX_WIDTH } = require("../utils/signatureImage");

const solid = (w, h, background = { r: 20, g: 90, b: 160, alpha: 1 }) => sharp({ create: { width: w, height: h, channels: 4, background } });
const rejects = (p, re) => assert.rejects(p, (e) => e instanceof SignatureImageError && e.status === 400 && re.test(e.message));

describe("signature image processing", () => {
  test("a PNG banner is accepted, re-encoded and small", async () => {
    const out = await processSignatureImage(await solid(500, 120).png().toBuffer());
    assert.equal(out.mime, "image/png");
    assert.equal(out.ext, "png");
    assert.deepEqual([out.width, out.height], [500, 120]);
    assert.ok(out.bytes <= MAX_OUTPUT_BYTES);
    assert.equal(out.bytes, out.content.length);
  });

  test("a JPEG is accepted", async () => {
    const out = await processSignatureImage(await solid(400, 100).jpeg().toBuffer());
    assert.ok(["image/png", "image/jpeg"].includes(out.mime));
    assert.equal(out.width, 400);
  });

  test("wider than 600 px is scaled down, keeping the proportions; smaller is never enlarged", async () => {
    const big = await processSignatureImage(await solid(1800, 300).png().toBuffer());
    assert.deepEqual([big.width, big.height], [MAX_WIDTH, 100]);
    const small = await processSignatureImage(await solid(300, 80).png().toBuffer());
    assert.deepEqual([small.width, small.height], [300, 80]);
  });

  test("metadata is stripped: EXIF, colour profile and orientation tag are gone", async () => {
    const withExif = await solid(300, 100)
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: "Secret Person", ImageDescription: "GPS home address" } }, orientation: 1 })
      .toBuffer();
    assert.ok(withExif.includes(Buffer.from("Secret Person")), "the test image really carries metadata");
    const out = await processSignatureImage(withExif);
    assert.ok(!out.content.includes(Buffer.from("Secret Person")));
    assert.ok(!out.content.includes(Buffer.from("GPS home address")));
    const meta = await sharp(out.content).metadata();
    assert.equal(meta.exif, undefined);
    assert.equal(meta.icc, undefined);
    assert.ok(!meta.orientation || meta.orientation === 1);
  });

  test("EXIF orientation is applied before it is dropped", async () => {
    const rotated = await solid(200, 100).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const out = await processSignatureImage(rotated);
    assert.deepEqual([out.width, out.height], [100, 200 > 400 ? 400 : 200].map((v, i) => (i === 0 ? 100 : v)));
  });

  test("transparency is flattened onto white", async () => {
    const png = await solid(200, 60, { r: 255, g: 0, b: 0, alpha: 0 }).png().toBuffer(); // fully transparent
    const out = await processSignatureImage(png);
    const { data, info } = await sharp(out.content).raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.channels, 3, "no alpha channel left");
    assert.deepEqual([data[0], data[1], data[2]], [255, 255, 255]);
  });

  // ── type checks look at the bytes, not at a name ──
  test("SVG is refused, even though it is an 'image'", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><script>alert(1)</script></svg>');
    await rejects(processSignatureImage(svg), /PNG or JPG/);
  });

  test("GIF, WebP and plain text are refused", async () => {
    await rejects(processSignatureImage(await solid(100, 40).gif().toBuffer()), /PNG or JPG/);
    await rejects(processSignatureImage(await solid(100, 40).webp().toBuffer()), /PNG or JPG/);
    await rejects(processSignatureImage(Buffer.from("not an image at all")), /PNG or JPG/);
  });

  test("a script with an image extension is just bytes: refused", async () => {
    await rejects(processSignatureImage(Buffer.from("<?php system($_GET['c']); ?>")), /PNG or JPG/);
    await rejects(processSignatureImage(Buffer.from("MZ" + "\u0000".repeat(200))), /PNG or JPG/);
  });

  test("a PNG signature followed by garbage is refused, not passed through", async () => {
    const png = await solid(100, 40).png().toBuffer();
    const broken = Buffer.concat([png.subarray(0, 40), crypto.randomBytes(300)]);
    await assert.rejects(processSignatureImage(broken), (e) => e instanceof SignatureImageError);
  });

  test("an image with a script appended is cleaned: the output holds only pixels", async () => {
    const png = await solid(120, 40).png().toBuffer();
    const polyglot = Buffer.concat([png, Buffer.from("<script>alert(1)</script>")]);
    const out = await processSignatureImage(polyglot);
    assert.ok(!out.content.includes(Buffer.from("<script>")));
  });

  // ── limits ──
  test("empty and non-buffer input", async () => {
    await rejects(processSignatureImage(Buffer.alloc(0)), /Choose an image/);
    await rejects(processSignatureImage(null), /Choose an image/);
    await rejects(processSignatureImage("x"), /Choose an image/);
  });

  test("a file over 5 MB is refused before any decoding", async () => {
    await rejects(processSignatureImage(Buffer.alloc(5 * 1024 * 1024 + 1, 1)), /5 MB/);
  });

  test("an image with too many pixels is refused (decompression bomb)", async () => {
    const bomb = await sharp({ create: { width: 7000, height: 7000, channels: 3, background: "#fff" } }).png({ compressionLevel: 9 }).toBuffer();
    assert.ok(bomb.length < 5 * 1024 * 1024, "small on disk");
    await rejects(processSignatureImage(bomb), /too large|could not be read/);
  });

  test("too small and too tall are refused with a reason", async () => {
    await rejects(processSignatureImage(await solid(20, 10).png().toBuffer()), /too small/);
    await rejects(processSignatureImage(await solid(300, 900).png().toBuffer()), /too tall/);
  });

  test("an image that cannot fit the limit is refused with advice; pure noise still fits as a JPEG", async () => {
    const noise = crypto.randomBytes(600 * 400 * 3);
    const img = await sharp(noise, { raw: { width: 600, height: 400, channels: 3 } }).png().toBuffer();
    // 600 x 400 of pure noise squeezes under 200 KB as a JPEG, so the refusal is exercised with a tighter limit.
    await rejects(processSignatureImage(img, { limit: 5000 }), /too detailed/);
    const out = await processSignatureImage(img);
    assert.ok(out.bytes <= MAX_OUTPUT_BYTES);
  });

  test("a busy image falls back to JPEG and fits", async () => {
    // smooth gradient with texture: large as PNG, small as JPEG
    const w = 600;
    const h = 300;
    const raw = Buffer.alloc(w * h * 3);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 3;
        raw[i] = (x * 255) / w + ((x * y) % 7);
        raw[i + 1] = (y * 255) / h + ((x + y) % 5);
        raw[i + 2] = 128 + ((x ^ y) % 9);
      }
    }
    const png = await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer();
    const out = await processSignatureImage(png);
    assert.ok(out.bytes <= MAX_OUTPUT_BYTES);
    assert.equal(out.mime, "image/jpeg");
    assert.equal(out.ext, "jpg");
  });
});
