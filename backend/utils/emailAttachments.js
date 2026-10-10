const path = require("path");
const crypto = require("crypto");
const {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { s3Client, getBucketName } = require("../config/s3");
const { EmailValidationError, MAX_ATTACHMENT_BYTES, stripLineBreaks } = require("./emailValidation");

// Attachments for mail sent from the dashboard. Wider than the general upload
// route (email needs zip/csv/presentations) but still an allow-list: the type
// must be on the list AND the file's real content must match its extension.
const ALLOWED_TYPES = {
  ".jpg": { mime: "image/jpeg", detected: ["image/jpeg"] },
  ".jpeg": { mime: "image/jpeg", detected: ["image/jpeg"] },
  ".png": { mime: "image/png", detected: ["image/png"] },
  ".gif": { mime: "image/gif", detected: ["image/gif"] },
  ".webp": { mime: "image/webp", detected: ["image/webp"] },
  ".pdf": { mime: "application/pdf", detected: ["application/pdf"] },
  ".txt": { mime: "text/plain", text: true },
  ".csv": { mime: "text/csv", text: true },
  ".doc": { mime: "application/msword", detected: ["application/x-cfb"] },
  ".xls": { mime: "application/vnd.ms-excel", detected: ["application/x-cfb"] },
  ".ppt": { mime: "application/vnd.ms-powerpoint", detected: ["application/x-cfb"] },
  ".docx": {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    detected: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip"],
  },
  ".xlsx": {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    detected: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip"],
  },
  ".pptx": {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    detected: ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/zip"],
  },
  ".zip": { mime: "application/zip", detected: ["application/zip"] },
};

const ALLOWED_LIST = "images, PDF, Word, Excel, PowerPoint, CSV, TXT, ZIP";

// Windows PE ("MZ"), ELF, and shebang scripts — refused whatever the extension says.
function hasExecutableSignature(buf) {
  if (!buf || buf.length < 2) return false;
  if (buf[0] === 0x4d && buf[1] === 0x5a) return true;
  if (buf.length >= 4 && buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46) return true;
  return buf[0] === 0x23 && buf[1] === 0x21;
}

function looksLikeText(buf) {
  const sample = buf.subarray(0, 4096);
  for (const byte of sample) if (byte === 0) return false;
  return true;
}

// Strips any path, control characters and header-breaking characters.
function sanitizeFilename(name) {
  const base = path.basename(String(name || "").replace(/\\/g, "/"));
  const cleaned = stripLineBreaks(base).replace(/[\u0000-\u001f"<>|:*?]/g, "_").replace(/^\.+/, "").slice(0, 150);
  return cleaned || "attachment";
}

// Multer fileFilter: cheap extension check before the bytes are buffered.
function extensionFilter(_req, file, cb) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (ALLOWED_TYPES[ext]) return cb(null, true);
  cb(new EmailValidationError(`"${sanitizeFilename(file.originalname)}": file type not allowed. Accepted: ${ALLOWED_LIST}.`));
}

// Full check once the bytes are in memory. → { filename, contentType, content }
async function validateAttachment(file) {
  const filename = sanitizeFilename(file.originalname);
  const ext = path.extname(filename).toLowerCase();
  const rule = ALLOWED_TYPES[ext];
  const fail = (why) => new EmailValidationError(`"${filename}": ${why}`);

  if (!rule) throw fail(`file type not allowed. Accepted: ${ALLOWED_LIST}.`);
  const buf = file.buffer;
  if (!buf?.length) throw fail("file is empty.");
  if (buf.length > MAX_ATTACHMENT_BYTES) throw fail(`file is larger than ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB.`);
  if (hasExecutableSignature(buf)) throw fail("executable files are not allowed.");

  if (rule.text) {
    if (!looksLikeText(buf)) throw fail("contents do not look like plain text.");
  } else {
    const { fileTypeFromBuffer } = await import("file-type");
    const detected = (await fileTypeFromBuffer(buf))?.mime;
    if (!detected || !rule.detected.includes(detected)) {
      throw fail("file contents do not match its type.");
    }
  }
  return { filename, contentType: rule.mime, content: buf };
}

// Downloads: never let the browser treat a stored file as a page.
const UNSAFE_MIME = /^(text\/html|application\/xhtml|image\/svg|text\/xml|application\/xml|text\/javascript|application\/javascript)/i;
const safeContentType = (mime) => (!mime || UNSAFE_MIME.test(mime) ? "application/octet-stream" : mime);

function contentDisposition(filename) {
  const ascii = sanitizeFilename(filename).replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(sanitizeFilename(filename))}`;
}

// ── storage (S3) ──
const PREFIX = "email-attachments";

function attachmentKey(mailboxId, messageId, filename) {
  return `${PREFIX}/${mailboxId}/${messageId}/${crypto.randomBytes(8).toString("hex")}-${sanitizeFilename(filename).replace(/[^A-Za-z0-9._-]/g, "_")}`;
}

// Same shape the tests fake: put(key, buffer, contentType), get(key) → Buffer, remove(key).
function createS3AttachmentStore() {
  return {
    async put(key, buffer, contentType) {
      await s3Client.send(new PutObjectCommand({
        Bucket: getBucketName(),
        Key: key,
        Body: buffer,
        ContentType: safeContentType(contentType),
        ContentLength: buffer.length,
        ServerSideEncryption: "AES256",
      }));
    },
    async get(key) {
      const object = await s3Client.send(new GetObjectCommand({ Bucket: getBucketName(), Key: key }));
      const chunks = [];
      for await (const chunk of object.Body) chunks.push(Buffer.from(chunk));
      return Buffer.concat(chunks);
    },
    async remove(key) {
      await s3Client.send(new DeleteObjectCommand({ Bucket: getBucketName(), Key: key }));
    },
  };
}

module.exports = {
  ALLOWED_TYPES,
  hasExecutableSignature,
  sanitizeFilename,
  extensionFilter,
  validateAttachment,
  safeContentType,
  contentDisposition,
  attachmentKey,
  createS3AttachmentStore,
};
