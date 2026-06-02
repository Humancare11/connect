const fs = require("fs");
const mongoose = require("mongoose");
const { GridFSBucket } = require("mongodb");

const BUCKET_NAME = "uploads";

function getBucket() {
  if (!mongoose.connection.db) {
    throw new Error("MongoDB connection is not ready.");
  }
  return new GridFSBucket(mongoose.connection.db, { bucketName: BUCKET_NAME });
}

async function storeUploadInGridFS(file, owner = {}) {
  if (!file?.path || !file?.filename) return;

  const bucket = getBucket();
  const existingFiles = await bucket.find({ filename: file.filename }).toArray();
  await Promise.all(existingFiles.map((existing) => bucket.delete(existing._id)));

  await new Promise((resolve, reject) => {
    const read = fs.createReadStream(file.path);
    const write = bucket.openUploadStream(file.filename, {
      contentType: file.mimetype,
      metadata: {
        originalName: file.originalname,
        contentType: file.mimetype,
        size: file.size,
        uploadedBy: owner.userId ? String(owner.userId) : null,
        uploadedByRole: owner.role || "",
        uploadedAt: new Date(),
      },
    });

    read.on("error", reject);
    write.on("error", reject);
    write.on("finish", resolve);
    read.pipe(write);
  });
}

async function streamUploadFromGridFS(filename, res) {
  const bucket = getBucket();
  const files = await bucket.find({ filename }).limit(1).toArray();
  const file = files[0];
  if (!file) return false;

  const contentType = file.contentType || file.metadata?.contentType;
  if (contentType) res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Length", file.length);
  res.setHeader("Cache-Control", "private, no-store");

  await new Promise((resolve, reject) => {
    const stream = bucket.openDownloadStreamByName(filename);
    stream.on("error", reject);
    stream.on("end", resolve);
    stream.pipe(res);
  });

  return true;
}

async function findUploadInGridFS(filename) {
  const bucket = getBucket();
  const files = await bucket.find({ filename }).limit(1).toArray();
  return files[0] || null;
}

module.exports = {
  storeUploadInGridFS,
  findUploadInGridFS,
  streamUploadFromGridFS,
};
