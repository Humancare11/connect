const fs = require("fs");
const path = require("path");

require("dotenv").config({
  path: path.resolve(
    __dirname,
    "..",
    process.env.NODE_ENV === "production" ? ".env.production" : ".env"
  ),
});

const { storeUploadInS3 } = require("../utils/uploadStorage");

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
  if (!fs.existsSync(uploadsDir)) {
    return;
  }

  const files = fs
    .readdirSync(uploadsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);

  for (const filename of files) {
    const filePath = path.join(uploadsDir, filename);
    const buffer = fs.readFileSync(filePath);
    await storeUploadInS3({
      buffer,
      filename,
      originalname: filename,
      mimetype: MIME_BY_EXT[path.extname(filename).toLowerCase()] || "application/octet-stream",
      size: buffer.length,
    });
  }

}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
