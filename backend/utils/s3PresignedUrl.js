const { GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { s3Client, getBucketName } = require("../config/s3");

const DEFAULT_EXPIRY_SECONDS = 5 * 60;

async function createS3PresignedGetUrl(key, options = {}) {
  if (!key) throw new Error("S3 object key is required.");

  const expiresIn = Number(options.expiresIn || DEFAULT_EXPIRY_SECONDS);
  const command = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn });
  return {
    url,
    key,
    expiresIn,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
}

async function createS3PresignedPutUrl(key, options = {}) {
  if (!key) throw new Error("S3 object key is required.");

  const expiresIn = Number(options.expiresIn || DEFAULT_EXPIRY_SECONDS);
  const contentType = options.contentType || "application/octet-stream";
  const metadata = options.metadata || {};
  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: key,
    ContentType: contentType,
    Metadata: metadata,
  });
  const url = await getSignedUrl(s3Client, command, { expiresIn });
  return {
    url,
    key,
    expiresIn,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
}

module.exports = {
  DEFAULT_EXPIRY_SECONDS,
  createS3PresignedGetUrl,
  createS3PresignedPutUrl,
};
