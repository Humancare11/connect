import api from "../api";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function uploadFileDirectToS3(file, options = {}) {
  if (!file) throw new Error("No file selected.");
  if (file.size > MAX_FILE_SIZE) throw new Error("Max 10 MB per file.");

  const { data } = await api.post("/api/upload/presign", {
    originalName: file.name,
    contentType: file.type || "application/octet-stream",
    size: file.size,
    ownerType: options.ownerType,
    ownerId: options.ownerId,
  });

  const uploadRes = await fetch(data.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });

  if (!uploadRes.ok) {
    throw new Error("Upload to S3 failed.");
  }

  return data.file;
}
