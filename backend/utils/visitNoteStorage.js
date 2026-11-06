const crypto = require("crypto");
const { PutObjectCommand, GetObjectCommand, CopyObjectCommand } = require("@aws-sdk/client-s3");
const { s3Client, getBucketName } = require("../config/s3");

// Private S3 objects for Visit Notes (signatures). Never public, never presigned for the browser:
// they are streamed through authenticated API routes only.
const doctorSignatureKey = (doctorId) => `doctors/${doctorId}/signature/${crypto.randomUUID()}.png`;
const reportSignatureKey = (reportId) => `consultation-reports/${reportId}/signature.png`;

async function putPng(key, buffer) {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      Body: buffer,
      ContentType: "image/png",
      ContentLength: buffer.length,
      ServerSideEncryption: "AES256",
    })
  );
}

async function copyObject(sourceKey, destKey) {
  const bucket = getBucketName();
  await s3Client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${sourceKey.split("/").map(encodeURIComponent).join("/")}`,
      Key: destKey,
      ContentType: "image/png",
      MetadataDirective: "REPLACE",
      ServerSideEncryption: "AES256",
    })
  );
}

async function getObjectBuffer(key) {
  const out = await s3Client.send(new GetObjectCommand({ Bucket: getBucketName(), Key: key }));
  const chunks = [];
  for await (const chunk of out.Body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

// Sends a stored PNG to the client with private, no-store headers.
async function streamPng(res, key) {
  try {
    const buffer = await getObjectBuffer(key);
    res.set({ "Content-Type": "image/png", "Content-Length": buffer.length, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
    return res.status(200).send(buffer);
  } catch (err) {
    if (err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) return res.status(404).json({ msg: "Signature not found." });
    console.error("visit note signature stream error:", err);
    return res.status(500).json({ msg: "Failed to load signature." });
  }
}

module.exports = { doctorSignatureKey, reportSignatureKey, putPng, copyObject, getObjectBuffer, streamPng };
