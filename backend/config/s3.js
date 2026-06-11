const { S3Client } = require("@aws-sdk/client-s3");

const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
const AWS_S3_PUBLIC_BASE_URL = process.env.AWS_S3_PUBLIC_BASE_URL || process.env.S3_PUBLIC_BASE_URL || "";

if (!AWS_S3_BUCKET) {
  console.warn("AWS_S3_BUCKET or S3_BUCKET_NAME is not configured. Uploads will fail until it is set.");
}

const s3Client = new S3Client({
  region: AWS_REGION,
});

function getBucketName() {
  if (!AWS_S3_BUCKET) throw new Error("AWS S3 bucket is not configured.");
  return AWS_S3_BUCKET;
}

function encodeS3Key(key) {
  return String(key || "")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
}

function getS3ObjectUrl(key) {
  if (!key) return "";
  if (AWS_S3_PUBLIC_BASE_URL) {
    return `${AWS_S3_PUBLIC_BASE_URL.replace(/\/+$/, "")}/${encodeS3Key(key)}`;
  }
  const bucket = getBucketName();
  return `https://${bucket}.s3.${AWS_REGION}.amazonaws.com/${encodeS3Key(key)}`;
}

module.exports = {
  s3Client,
  getBucketName,
  getS3ObjectUrl,
};
