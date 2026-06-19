const {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");
const { Readable } = require("stream");
const { s3Client, getBucketName } = require("../config/s3");

const UPLOAD_PREFIX = (process.env.AWS_S3_UPLOAD_PREFIX || process.env.S3_UPLOAD_PREFIX || "uploads").replace(/^\/+|\/+$/g, "");

function uploadKey(filename) {
  if (String(filename || "").includes("/")) return filename;
  return UPLOAD_PREFIX ? `${UPLOAD_PREFIX}/${filename}` : filename;
}

function isKnownStructuredKey(value) {
  return /^(uploads|doctors|patients)\//.test(String(value || ""));
}

function stripApiUploadsPrefix(path) {
  // Strip /api/uploads/ prefix added by the frontend URL normalizer
  if (path.startsWith("api/uploads/")) return path.slice("api/uploads/".length);
  return path;
}

function keyFromStoredValue(value) {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    const pathname = stripApiUploadsPrefix(decodeURIComponent(url.pathname.replace(/^\/+/, "")));
    if (!pathname) return "";
    if (isKnownStructuredKey(pathname)) return pathname;
    return uploadKey(pathname.split("/").pop());
  } catch {
    // Handle relative paths like /api/uploads/doctors/xxx/file
    const stripped = stripApiUploadsPrefix(raw.replace(/^\/+/, ""));
    if (isKnownStructuredKey(stripped)) return stripped;
    if (stripped.includes("/")) return stripped;
    return uploadKey(stripped.split("/").pop());
  }
}

function filenameFromKey(key) {
  return String(key || "").split("/").pop();
}

async function streamToBuffer(stream) {
  if (Buffer.isBuffer(stream)) return stream;
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function storeUploadInS3(file, owner = {}) {
  if (!file?.buffer || !file?.filename) throw new Error("No uploaded file buffer available.");

  const folderKey = String(owner.folderKey || "").replace(/^\/+|\/+$/g, "");
  const key = folderKey ? `${folderKey}/${file.filename}` : uploadKey(file.filename);
  await s3Client.send(new PutObjectCommand({
    Bucket: getBucketName(),
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype || "application/octet-stream",
    ContentLength: file.size,
    Metadata: {
      originalname: file.originalname || file.filename,
      contenttype: file.mimetype || "application/octet-stream",
      size: String(file.size || file.buffer.length || 0),
      uploadedby: owner.userId ? String(owner.userId) : "",
      uploadedbyrole: owner.role || "",
      uploadedat: new Date().toISOString(),
    },
  }));

  return {
    key,
    filename: file.filename,
  };
}

async function findUploadInS3(filename) {
  const key = uploadKey(filename);
  try {
    const head = await s3Client.send(new HeadObjectCommand({
      Bucket: getBucketName(),
      Key: key,
    }));

    return {
      key,
      filename: filenameFromKey(key),
      length: head.ContentLength,
      contentType: head.ContentType,
      metadata: {
        originalName: head.Metadata?.originalname || filename,
        contentType: head.Metadata?.contenttype || head.ContentType,
        size: head.Metadata?.size || String(head.ContentLength || 0),
        uploadedBy: head.Metadata?.uploadedby || null,
        uploadedByRole: head.Metadata?.uploadedbyrole || "",
        uploadedAt: head.Metadata?.uploadedat || "",
      },
    };
  } catch (err) {
    if (err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

async function streamUploadFromS3(filename, res) {
  const key = uploadKey(filename);
  try {
    const object = await s3Client.send(new GetObjectCommand({
      Bucket: getBucketName(),
      Key: key,
    }));

    if (object.ContentType) res.setHeader("Content-Type", object.ContentType);
    if (object.ContentLength) res.setHeader("Content-Length", object.ContentLength);
    res.setHeader("Cache-Control", "private, no-store");

    const body = object.Body instanceof Readable ? object.Body : Readable.from(await streamToBuffer(object.Body));
    await new Promise((resolve, reject) => {
      body.on("error", reject);
      body.on("end", resolve);
      body.pipe(res);
    });

    return true;
  } catch (err) {
    if (err?.name === "NoSuchKey" || err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404) return false;
    throw err;
  }
}

async function deleteUploadFromS3(filename) {
  await s3Client.send(new DeleteObjectCommand({
    Bucket: getBucketName(),
    Key: uploadKey(filename),
  }));
}

async function deleteUploadsOlderThan(olderThan) {
  let ContinuationToken;
  let deleted = 0;
  const Prefix = UPLOAD_PREFIX ? `${UPLOAD_PREFIX}/` : undefined;

  do {
    const listed = await s3Client.send(new ListObjectsV2Command({
      Bucket: getBucketName(),
      Prefix,
      ContinuationToken,
    }));

    const oldObjects = (listed.Contents || []).filter((object) => object.LastModified && object.LastModified < olderThan);
    for (const object of oldObjects) {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: getBucketName(),
        Key: object.Key,
      }));
      deleted++;
    }

    ContinuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (ContinuationToken);

  return deleted;
}

module.exports = {
  storeUploadInS3,
  findUploadInS3,
  streamUploadFromS3,
  deleteUploadFromS3,
  deleteUploadsOlderThan,
  uploadKey,
  keyFromStoredValue,
};
