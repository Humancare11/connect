const sharp = require("sharp");

// Doctor signature uploads (used for Prescription, Medical Certificate and Visit Note): PNG or JPG, 2 MB max.
// The type is decided from the real bytes (not the file name or the declared MIME), the image is fully decoded,
// and what is stored is OUR re-encoded PNG - never the uploaded bytes. Metadata is dropped.
const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;
const MAX_INPUT_PIXELS = 25_000_000;
const MAX_OUT_WIDTH = 1000;
const MAX_OUT_HEIGHT = 400;
const MIN_SIDE = 30;

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/jpg", "image/pjpeg"]);

// Conservative white-background removal (JPG only). A pixel is made fully transparent only when its darkest channel
// is >= WHITE_FULL; it is fully opaque from OPAQUE_FROM down; in between alpha ramps linearly, so light or faint pen
// strokes stay visible (just lighter) instead of being erased.
const WHITE_FULL = 248;
const OPAQUE_FROM = 160;
// The background is only removed if the image border really is near-white (median of the darkest channel on the
// border). A photo of paper on a grey desk is left as it is.
const BORDER_WHITE_MIN = 225;

class SignatureUploadError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "SignatureUploadError";
    this.status = status;
  }
}

function sniffType(buf) {
  if (buf.length >= PNG_MAGIC.length && buf.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) return "png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  return null;
}

// raw: RGBA buffer. Returns { removed, data }.
function removeWhiteBackground(raw, width, height) {
  const border = [];
  const sample = (x, y) => {
    const i = (y * width + x) * 4;
    border.push(Math.min(raw[i], raw[i + 1], raw[i + 2]));
  };
  const stepX = Math.max(1, Math.floor(width / 200));
  const stepY = Math.max(1, Math.floor(height / 200));
  for (let x = 0; x < width; x += stepX) {
    sample(x, 0);
    sample(x, height - 1);
  }
  for (let y = 0; y < height; y += stepY) {
    sample(0, y);
    sample(width - 1, y);
  }
  border.sort((a, b) => a - b);
  const median = border[Math.floor(border.length / 2)] ?? 0;
  if (median < BORDER_WHITE_MIN) return { removed: false, data: raw };

  const out = Buffer.from(raw);
  for (let i = 0; i < out.length; i += 4) {
    const m = Math.min(out[i], out[i + 1], out[i + 2]);
    let alpha;
    if (m >= WHITE_FULL) alpha = 0;
    else if (m <= OPAQUE_FROM) alpha = 255;
    else alpha = Math.round(((WHITE_FULL - m) / (WHITE_FULL - OPAQUE_FROM)) * 255);
    out[i + 3] = Math.min(out[i + 3], alpha);
  }
  return { removed: true, data: out };
}

// file: multer memory file { buffer, mimetype, size }.
// opts.removeBackground (default true): applies to JPG only.
// Returns { buffer (PNG), width, height, bytes, sourceType, backgroundRemoved }.
async function processSignatureUpload(file, { removeBackground = true } = {}) {
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw new SignatureUploadError("Please choose a PNG or JPG signature image.");
  }
  if (file.buffer.length > MAX_SIGNATURE_BYTES) {
    throw new SignatureUploadError("The signature image must be 2 MB or smaller.", 413);
  }
  if (!ALLOWED_MIME.has(String(file.mimetype || "").toLowerCase())) {
    throw new SignatureUploadError("The signature must be a PNG or JPG image.");
  }
  const sourceType = sniffType(file.buffer);
  if (!sourceType) throw new SignatureUploadError("This file is not a valid PNG or JPG image.");

  const opts = { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" };
  try {
    const meta = await sharp(file.buffer, opts).metadata();
    if (meta.format !== sourceType) throw new Error("type mismatch");
    if ((meta.pages || 1) > 1) throw new Error("animated");
    if (!meta.width || !meta.height) throw new Error("no size");

    // Orientation applied, scaled down (never up), always RGBA so the output is a real transparent PNG.
    const { data, info } = await sharp(file.buffer, opts)
      .rotate()
      .resize({ width: MAX_OUT_WIDTH, height: MAX_OUT_HEIGHT, fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .toColourspace("srgb")
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (info.width < MIN_SIDE || info.height < MIN_SIDE / 2) {
      throw new SignatureUploadError(`The image is too small (at least ${MIN_SIDE} x ${MIN_SIDE / 2} px).`);
    }

    let pixels = data;
    let backgroundRemoved = false;
    if (sourceType === "jpeg" && removeBackground) {
      const result = removeWhiteBackground(data, info.width, info.height);
      pixels = result.data;
      backgroundRemoved = result.removed;
    }

    const buffer = await sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    return { buffer, width: info.width, height: info.height, bytes: buffer.length, sourceType, backgroundRemoved };
  } catch (err) {
    if (err instanceof SignatureUploadError) throw err;
    throw new SignatureUploadError("This file is not a valid PNG or JPG image, or it is too large.");
  }
}

module.exports = { MAX_SIGNATURE_BYTES, SignatureUploadError, processSignatureUpload, removeWhiteBackground };
