// Patient file uploads (reports) and admin access to them.
//
//   - pdf, jpg or png only, max 10 MB. The REAL type is read from the file's bytes (file-type); the extension must
//     agree with it, so "malware.exe" renamed to "report.pdf" is refused.
//   - Stored in S3 under livechat/<conversationId>/<random>.<ext> with server-side encryption. The key is random
//     and the original file name (which can reveal health information) is kept encrypted in MongoDB only, never in
//     S3 metadata.
//   - There is no public URL. Admins get a 5-minute presigned URL from a role-checked endpoint, and every issue is
//     recorded on the file (who, when).
//   - File names are never given to the AI.
const crypto = require("crypto");
const mongoose = require("mongoose");
const { readFileLimits } = require("../../utils/liveChat/config");
const { encryptLiveChatText, decryptLiveChatText } = require("../../utils/liveChat/crypto");
const { createWindowLimiter } = require("./limits");

const TYPES = {
  "application/pdf": { ext: "pdf", accepts: ["pdf"] },
  "image/jpeg": { ext: "jpg", accepts: ["jpg", "jpeg"] },
  "image/png": { ext: "png", accepts: ["png"] },
};
const PRESIGN_SECONDS = 5 * 60;

class FileError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

// Name shown to the team: no path, no control characters, bounded length.
function displayName(originalName, ext) {
  const base = String(originalName || "")
    .split(/[\\/]/)
    .pop()
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f"<>|:*?]/g, "")
    .trim()
    .slice(0, 120);
  return base || `report.${ext}`;
}

// Checks size, real type (magic bytes) and extension. Returns { ok: true, mime, ext } or { ok: false, error }.
async function inspectUpload({ buffer, originalName, maxBytes }) {
  if (!buffer || !buffer.length) return { ok: false, error: "empty_file" };
  if (buffer.length > maxBytes) return { ok: false, error: "file_too_large" };
  const { fileTypeFromBuffer } = await import("file-type");
  const detected = await fileTypeFromBuffer(buffer);
  const type = detected && TYPES[detected.mime];
  if (!type) return { ok: false, error: "unsupported_type" };
  const ext = String(originalName || "").split(".").pop().toLowerCase();
  if (!type.accepts.includes(ext)) return { ok: false, error: "extension_mismatch" };
  return { ok: true, mime: detected.mime, ext: type.ext };
}

// The real S3 store. Required lazily so a disabled module loads nothing from AWS.
function createS3FileStore() {
  const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, DeleteObjectsCommand } = require("@aws-sdk/client-s3");
  const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
  const { s3Client, getBucketName } = require("../../config/s3");
  const asciiName = (name) => String(name).replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return {
    async put(key, buffer, contentType) {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: getBucketName(),
          Key: key,
          Body: buffer,
          ContentType: contentType,
          ContentLength: buffer.length,
          ServerSideEncryption: "AES256",
        })
      );
    },
    async presign(key, { expiresIn = PRESIGN_SECONDS, contentType, filename }) {
      const command = new GetObjectCommand({
        Bucket: getBucketName(),
        Key: key,
        ResponseContentType: contentType,
        ResponseContentDisposition: `inline; filename="${asciiName(filename)}"`,
      });
      return getSignedUrl(s3Client, command, { expiresIn });
    },
    async remove(key) {
      await s3Client.send(new DeleteObjectCommand({ Bucket: getBucketName(), Key: key }));
    },
    // Deletes many objects (retention). Returns the keys that could NOT be deleted; a missing key counts as deleted.
    async removeMany(keys) {
      const failed = [];
      for (let i = 0; i < keys.length; i += 1000) {
        const chunk = keys.slice(i, i + 1000);
        const out = await s3Client.send(new DeleteObjectsCommand({ Bucket: getBucketName(), Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true } }));
        for (const err of out.Errors || []) if (err.Code !== "NoSuchKey") failed.push(err.Key);
      }
      return failed;
    },
  };
}

function createFileService({ models, chat, store, env = process.env, now = () => Date.now() }) {
  const { LcFile } = models;
  const limits = readFileLimits(env);
  const uploadLimiter = createWindowLimiter({ windowMs: 10 * 60_000, max: limits.uploadsPer10Min, now });
  let fileStore = store || null;
  const getStore = () => (fileStore ||= createS3FileStore());

  // A patient uploads into their OWN open chat.
  async function upload({ visitorId, file }) {
    const conv = await chat.findOpenConversation(visitorId);
    if (!conv) throw new FileError(409, "no_conversation");
    if (!uploadLimiter.allow(visitorId)) throw new FileError(429, "rate_limited");
    if ((await LcFile.countDocuments({ conversationId: conv.conversationId })) >= limits.maxFilesPerChat) {
      throw new FileError(409, "too_many_files");
    }
    const check = await inspectUpload({ buffer: file?.buffer, originalName: file?.originalname, maxBytes: limits.maxBytes });
    if (!check.ok) throw new FileError(check.error === "file_too_large" ? 413 : 400, check.error);

    const name = displayName(file.originalname, check.ext);
    const key = `livechat/${conv.conversationId}/${crypto.randomUUID()}.${check.ext}`;
    try {
      await getStore().put(key, file.buffer, check.mime);
    } catch {
      throw new FileError(502, "storage_failed"); // never echo the storage error (it may name the bucket)
    }
    const doc = await LcFile.create({
      conversationId: conv.conversationId,
      visitorId,
      s3Key: key,
      name: encryptLiveChatText(name),
      mimeType: check.mime,
      size: file.buffer.length,
    });
    const meta = { id: String(doc._id), name, mime: check.mime, size: file.buffer.length };
    await chat.addMessage(conv, "patient", name, { fileId: doc._id, file: meta });
    return { ok: true, file: { name, mime: check.mime, size: meta.size } };
  }

  // Admin: a short-lived link to open the file. The route has already checked the admin role.
  async function presign(actor, fileId) {
    if (!mongoose.isValidObjectId(fileId)) throw new FileError(404, "not_found");
    const doc = await LcFile.findById(fileId);
    if (!doc) throw new FileError(404, "not_found");
    const name = decryptLiveChatText(doc.name);
    let url;
    try {
      url = await getStore().presign(doc.s3Key, { expiresIn: PRESIGN_SECONDS, contentType: doc.mimeType, filename: name });
    } catch {
      throw new FileError(502, "storage_failed");
    }
    await LcFile.updateOne(
      { _id: doc._id },
      { $push: { accessLog: { $each: [{ userId: new mongoose.Types.ObjectId(String(actor.id)), at: new Date(now()) }], $slice: -50 } } }
    );
    return { ok: true, url, name, mime: doc.mimeType, expiresAt: new Date(now() + PRESIGN_SECONDS * 1000).toISOString() };
  }

  // { fileId -> { id, name, mime, size } } for a list of messages (used when a conversation is shown).
  async function metaFor(messages) {
    const ids = messages.map((m) => m.fileId).filter(Boolean);
    if (!ids.length) return new Map();
    const rows = await LcFile.find({ _id: { $in: ids } }).lean();
    return new Map(rows.map((r) => [String(r._id), { id: String(r._id), name: decryptLiveChatText(r.name), mime: r.mimeType, size: r.size }]));
  }

  return { upload, presign, metaFor, limits };
}

module.exports = { createFileService, createS3FileStore, inspectUpload, displayName, FileError, TYPES, PRESIGN_SECONDS };
