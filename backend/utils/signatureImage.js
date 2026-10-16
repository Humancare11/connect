const sharp = require("sharp");

// Image signatures: whatever is uploaded is decoded and re-encoded here, so what is stored and
// sent is OUR file, never the uploaded bytes. Limits are fixed on purpose.
const MAX_RAW_BYTES = 5 * 1024 * 1024; // the upload itself
const MAX_OUTPUT_BYTES = 200 * 1024; // after processing
const MAX_WIDTH = 600;
const MAX_HEIGHT = 400; // a signature banner, not a poster
const MIN_WIDTH = 50;
const MIN_HEIGHT = 20;
const MAX_INPUT_PIXELS = 36_000_000; // 6000 x 6000: refuses decompression bombs

const ALLOWED = new Set(["image/png", "image/jpeg"]);
const JPEG_QUALITIES = [85, 75, 65, 55];

class SignatureImageError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "SignatureImageError";
    this.status = status;
  }
}

// → { content: Buffer, mime, ext, width, height, bytes }
//
// 1. the real type is read from the bytes (not the file name): only PNG and JPEG pass,
//    so SVG, GIF, WebP and HEIC are refused, and so is anything that merely claims to be an image
// 2. decoded with a pixel limit; animated or multi-frame images are refused
// 3. EXIF orientation is applied, then ALL metadata is dropped
// 4. scaled down to at most 600 px wide (never enlarged), transparency flattened onto white
// 5. lossless PNG if it fits in 200 KB (best for logos and flat colour), otherwise JPEG at
//    falling quality (best for photographs), otherwise refused. No reduced-colour PNG: it
//    would make a photograph look posterised and hide the real size problem.
// `limit` exists only so tests can exercise the refusal; the product limit is fixed (200 KB).
async function processSignatureImage(input, { limit = MAX_OUTPUT_BYTES } = {}) {
  if (!Buffer.isBuffer(input) || !input.length) throw new SignatureImageError("Choose an image file.");
  if (input.length > MAX_RAW_BYTES) throw new SignatureImageError("The image is larger than 5 MB. Choose a smaller file.");

  const { fileTypeFromBuffer } = await import("file-type");
  const detected = (await fileTypeFromBuffer(input))?.mime;
  if (!detected || !ALLOWED.has(detected)) {
    throw new SignatureImageError("Only PNG or JPG images are allowed (not SVG, GIF or other formats).");
  }

  let meta;
  try {
    meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" }).metadata();
  } catch {
    throw new SignatureImageError("That image could not be read, or it is too large. Try another file.");
  }
  if (!["png", "jpeg"].includes(meta.format)) throw new SignatureImageError("Only PNG or JPG images are allowed.");
  if ((meta.pages || 1) > 1) throw new SignatureImageError("Animated images are not allowed.");

  // Same pipeline for every output format. sharp drops metadata unless asked to keep it.
  const base = () =>
    sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .toColourspace("srgb");

  let probe;
  try {
    probe = await base().png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true });
  } catch {
    throw new SignatureImageError("That image could not be read, or it is too large. Try another file.");
  }

  const { width, height } = probe.info;
  if (width < MIN_WIDTH || height < MIN_HEIGHT) {
    throw new SignatureImageError(`The image is too small (at least ${MIN_WIDTH} x ${MIN_HEIGHT} px).`);
  }
  if (height > MAX_HEIGHT) {
    throw new SignatureImageError(`The image is too tall (at most ${MAX_HEIGHT} px high at ${MAX_WIDTH} px wide). Use a banner.`);
  }

  if (probe.data.length <= limit) {
    return { content: probe.data, mime: "image/png", ext: "png", width, height, bytes: probe.data.length };
  }
  for (const quality of JPEG_QUALITIES) {
    const out = await base().jpeg({ quality, progressive: true, mozjpeg: true }).toBuffer({ resolveWithObject: true });
    if (out.data.length <= limit) {
      return { content: out.data, mime: "image/jpeg", ext: "jpg", width: out.info.width, height: out.info.height, bytes: out.data.length };
    }
  }
  throw new SignatureImageError("The image is too detailed to fit in 200 KB. Use a simpler banner (logo, name, title).");
}

module.exports = {
  processSignatureImage,
  SignatureImageError,
  MAX_RAW_BYTES,
  MAX_OUTPUT_BYTES,
  MAX_WIDTH,
  MAX_HEIGHT,
  MIN_WIDTH,
  MIN_HEIGHT,
  MAX_INPUT_PIXELS,
};
