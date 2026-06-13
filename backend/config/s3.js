const { S3Client, PutBucketCorsCommand } = require("@aws-sdk/client-s3");

const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
const AWS_S3_PUBLIC_BASE_URL = process.env.AWS_S3_PUBLIC_BASE_URL || process.env.S3_PUBLIC_BASE_URL || "";

if (!AWS_S3_BUCKET) {
  console.warn("AWS_S3_BUCKET or S3_BUCKET_NAME is not configured. Uploads will fail until it is set.");
}

const s3Client = new S3Client({
  region: AWS_REGION,
  // Prevent SDK from auto-adding x-amz-checksum-crc32 to presigned PUT URLs.
  // Browsers cannot compute CRC32 checksums, which causes CORS preflight failures.
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
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

function normalizeCorsOrigins(allowedOrigins) {
  const values = Array.isArray(allowedOrigins) ? allowedOrigins : [allowedOrigins];
  return Array.from(
    new Set(
      values
        .flatMap((value) => String(value || "").split(","))
        .map((value) => value.trim().replace(/\/+$/, ""))
        .filter(Boolean)
    )
  );
}

async function ensureBucketCors(allowedOrigins) {
  if (!AWS_S3_BUCKET) return;
  const origins = normalizeCorsOrigins(allowedOrigins);
  if (!origins.length) return;
  try {
    await s3Client.send(
      new PutBucketCorsCommand({
        Bucket: AWS_S3_BUCKET,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: origins,
              AllowedMethods: ["PUT", "GET", "HEAD"],
              AllowedHeaders: ["*"],
              ExposeHeaders: ["ETag", "x-amz-request-id", "x-amz-id-2"],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      })
    );
    console.log("S3 bucket CORS configured ✅");
  } catch (err) {
    console.warn("Could not set S3 CORS policy (check bucket permissions):", err.message);
  }
}

module.exports = {
  s3Client,
  getBucketName,
  getS3ObjectUrl,
  ensureBucketCors,
};
