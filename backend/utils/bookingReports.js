// Medical reports attached to a category ("Get Help With") or service booking.
//
// On create (normalizeBookingReports) every entry the browser sends is checked against the storage itself, never trusted:
//   - the key must be a plain key under the patient upload folders ("patients/..." or the flat "uploads/..."), with an allowed file
//     extension and no path tricks - so "doctors/..." files, invoices or other people's folders cannot be named;
//   - the object must exist and have been uploaded by THIS user (the uploader id the upload endpoints stamp on the object);
//   - its stored content type must be one allowed for the extension, and its size within the upload limit.
// The stored entry is rebuilt from what the storage says (key, url, name, type, size); nothing else from the request is kept.
//
// On read (safeStoredReports) only entries with a key of that same shape are returned, so an entry written before this check existed
// cannot be used to sign a link to a file outside the patient folders.
const path = require("path");
const { keyFromStoredValue, headUploadByKey } = require("./uploadStorage");
const { getS3ObjectUrl } = require("../config/s3");

const MAX_REPORTS = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_KEY_LENGTH = 300;
// Same table as routes/upload.js (what the upload endpoints accept); tests/bookingReports.test.js keeps the two in step.
const ALLOWED_TYPES = {
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".gif": ["image/gif"],
  ".webp": ["image/webp"],
  ".pdf": ["application/pdf"],
  ".txt": ["text/plain"],
  ".doc": ["application/msword", "application/x-cfb"],
  ".xls": ["application/vnd.ms-excel", "application/x-cfb"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip"],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip"],
};

class BookingReportError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "BookingReportError";
    this.status = status;
  }
}

// A key the patient upload endpoints can have produced: patients/<folder>/<file> or uploads/<file>.
function isSafeReportKey(key) {
  const value = String(key || "");
  if (!value || value.length > MAX_KEY_LENGTH) return false;
  if (!/^(patients|uploads)\/[A-Za-z0-9._\-/]+$/.test(value)) return false;
  if (value.split("/").some((part) => part === "" || part === "." || part === "..")) return false;
  return Boolean(ALLOWED_TYPES[path.extname(value).toLowerCase()]);
}

const cleanName = (value, fallback) =>
  String(value || fallback || "Medical report")
    .replace(/[^\t\x20-\x7e]/g, "")
    .trim()
    .slice(0, 180) || "Medical report";

async function normalizeBookingReports(reports, { userId, head = headUploadByKey } = {}) {
  if (reports === undefined || reports === null || reports === "") return [];
  if (!Array.isArray(reports)) throw new BookingReportError("The attached files are not valid. Remove them and upload them again.");
  if (reports.length > MAX_REPORTS) throw new BookingReportError(`You can attach up to ${MAX_REPORTS} files.`);
  if (!userId) throw new BookingReportError("Sign in to attach files.", 401);

  const invalid = () => new BookingReportError("One of the attached files could not be verified. Remove it, upload it again and retry.");
  const out = [];
  const seen = new Set();
  for (const report of reports) {
    const key = keyFromStoredValue(report?.key || report?.url);
    if (!isSafeReportKey(key)) throw invalid();
    if (seen.has(key)) continue;
    seen.add(key);

    let found;
    try {
      found = await head(key);
    } catch {
      // The storage could not be asked (not "no such file"): nothing is charged or booked yet, the patient may simply retry.
      throw new BookingReportError("Your files could not be checked right now. Please try again in a moment.", 503);
    }
    if (!found) throw invalid();
    if (!found.uploadedBy || String(found.uploadedBy) !== String(userId)) throw invalid();

    const ext = path.extname(key).toLowerCase();
    const type = String(found.contentType || "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_TYPES[ext].includes(type)) throw invalid();
    const size = Number(found.length);
    if (!Number.isFinite(size) || size <= 0 || size > MAX_FILE_SIZE) throw invalid();

    out.push({
      key,
      url: getS3ObjectUrl(key),
      name: cleanName(found.originalName, report?.name || key.split("/").pop()),
      type,
      size,
    });
  }
  return out;
}

// What a booking's saved reports may be shown (and signed) as.
function safeStoredReports(reports) {
  if (!Array.isArray(reports)) return [];
  return reports.filter((report) => isSafeReportKey(keyFromStoredValue(report?.key || report?.url)));
}

module.exports = { BookingReportError, normalizeBookingReports, safeStoredReports, isSafeReportKey, ALLOWED_TYPES, MAX_REPORTS };
