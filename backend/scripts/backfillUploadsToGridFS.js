const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { storeUploadInGridFS } = require("../utils/uploadStorage");

require("dotenv").config({
  path: path.resolve(
    __dirname,
    "..",
    process.env.NODE_ENV === "production" ? ".env.production" : ".env"
  ),
});

const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

async function main() {
  const uploadsDir = path.resolve(__dirname, "..", "uploads");
  await mongoose.connect(process.env.MONGO_URI);

  const files = fs
    .readdirSync(uploadsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);

  for (const filename of files) {
    const filePath = path.join(uploadsDir, filename);
    const stat = fs.statSync(filePath);
    await storeUploadInGridFS({
      path: filePath,
      filename,
      originalname: filename,
      mimetype: MIME_BY_EXT[path.extname(filename).toLowerCase()] || "application/octet-stream",
      size: stat.size,
    });
    console.log(`Backfilled ${filename}`);
  }

  await mongoose.disconnect();
  console.log(`Backfilled ${files.length} upload file(s).`);
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
