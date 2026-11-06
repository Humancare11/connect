const sharp = require("sharp");

// Doctor signature images for Visit Notes: PNG only, 1 MB max.
// Three independent checks (declared MIME, file extension, real magic bytes) and then a decode,
// so a renamed JPEG / SVG / HTML file or a PNG header in front of garbage is refused.
const MAX_SIGNATURE_BYTES = 1024 * 1024;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_INPUT_PIXELS = 25_000_000;

class PngSignatureError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "PngSignatureError";
    this.status = status;
  }
}

function hasPngMagic(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= PNG_MAGIC.length && buffer.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC);
}

// file: multer memory file { buffer, mimetype, originalname, size }. Returns { buffer, width, height, bytes }.
async function validatePngSignature(file) {
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw new PngSignatureError("Please choose a PNG signature image to upload.");
  }
  if (file.buffer.length > MAX_SIGNATURE_BYTES) {
    throw new PngSignatureError("The signature image must be 1 MB or smaller.", 413);
  }
  if (String(file.mimetype || "").toLowerCase() !== "image/png") {
    throw new PngSignatureError("The signature must be a PNG image (image/png).");
  }
  if (!/\.png$/i.test(String(file.originalname || ""))) {
    throw new PngSignatureError("The signature file name must end in .png.");
  }
  if (!hasPngMagic(file.buffer)) {
    throw new PngSignatureError("This file is not a valid PNG image.");
  }
  let meta;
  try {
    meta = await sharp(file.buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" }).metadata();
    if (meta.format !== "png" || !meta.width || !meta.height) throw new Error("not png");
    // Force a full decode so truncated / corrupt files are caught here, not when rendering.
    await sharp(file.buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" }).raw().toBuffer();
  } catch {
    throw new PngSignatureError("This file is not a valid PNG image.");
  }
  return { buffer: file.buffer, width: meta.width, height: meta.height, bytes: file.buffer.length };
}

module.exports = { MAX_SIGNATURE_BYTES, PNG_MAGIC, PngSignatureError, hasPngMagic, validatePngSignature };
