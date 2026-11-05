// Medical reports attached to a booking (category / service booking and Book Appointment).
//
// Every entry the browser sends is checked against the storage itself, never trusted:
//   - the key must be a plain key under the patient upload folders ("patients/..." or the flat "uploads/..."), with an allowed file
//     extension and no path tricks - so "doctors/..." files, invoices or other people's folders cannot be named;
//   - the object must exist and have been uploaded by THIS user (the uploader id the upload endpoints stamp on the object);
//   - its stored content type must be one allowed for the extension, and its size within the upload limit.
// The entry that is kept is rebuilt from what the storage says (key, url, name, type, size); nothing else from the request is kept.
//
// The patient PAYS FIRST and the booking is created after, so the rules differ by moment:
//   - before a payment is created: assertReportsBookable() refuses the files (nothing was charged yet);
//   - when the booking is created: checkBookingReports() never throws and never refuses - a file that fails is DROPPED (and logged as
//     [REPORT_DROPPED]), a file the storage could not be asked about is kept aside as "unverified" and verified later by
//     jobs/pendingReportsJob.js; the booking is created either way and the response carries a warning (reportsWarning()).
//
// On read (safeStoredReports) only entries with a key of the same shape are returned, so an entry written before these checks existed
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
  constructor(message, status = 400, details = {}) {
    super(message);
    this.name = "BookingReportError";
    this.status = status;
    this.details = details;
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

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Asks the storage about one key, retrying a storage error a couple of times. Throws only when every try failed.
async function headWithRetry(head, key, attempts, delayMs) {
  let last;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await head(key);
    } catch (err) {
      last = err;
      if (i < attempts - 1 && delayMs > 0) await pause(delayMs);
    }
  }
  throw last;
}

// Sorts what the browser sent into kept / dropped / unverified. NEVER throws.
//   kept       - verified, rebuilt from the storage
//   dropped    - [{ name, key, reason }]: not a bookable file (reason: malformed, too_many, not_an_upload_key, not_found, not_yours,
//                type_not_allowed, size_not_allowed)
//   unverified - well-formed keys the storage could not be asked about (it was down): [{ key, name }], to be verified later
async function checkBookingReports(reports, { userId, head = headUploadByKey, attempts = 2, retryDelayMs = 250 } = {}) {
  const result = { kept: [], dropped: [], unverified: [] };
  if (reports === undefined || reports === null || reports === "") return result;
  if (!Array.isArray(reports)) {
    result.dropped.push({ name: "", key: "", reason: "malformed" });
    return result;
  }
  const nameOf = (report, key) => cleanName(report?.name, key ? key.split("/").pop() : "");

  const seen = new Set();
  for (const [index, report] of reports.entries()) {
    let key = "";
    try {
      key = keyFromStoredValue(report?.key || report?.url);
    } catch {
      key = "";
    }
    if (index >= MAX_REPORTS) {
      result.dropped.push({ name: nameOf(report, key), key, reason: "too_many" });
      continue;
    }
    if (!isSafeReportKey(key)) {
      result.dropped.push({ name: nameOf(report, key), key, reason: "not_an_upload_key" });
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    if (!userId) {
      result.dropped.push({ name: nameOf(report, key), key, reason: "not_yours" });
      continue;
    }

    let found;
    try {
      found = await headWithRetry(head, key, attempts, retryDelayMs);
    } catch {
      result.unverified.push({ key, name: nameOf(report, key) });
      continue;
    }
    if (!found) {
      result.dropped.push({ name: nameOf(report, key), key, reason: "not_found" });
      continue;
    }
    if (!found.uploadedBy || String(found.uploadedBy) !== String(userId)) {
      result.dropped.push({ name: nameOf(report, key), key, reason: "not_yours" });
      continue;
    }
    const ext = path.extname(key).toLowerCase();
    const type = String(found.contentType || "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_TYPES[ext].includes(type)) {
      result.dropped.push({ name: nameOf(report, key), key, reason: "type_not_allowed" });
      continue;
    }
    const size = Number(found.length);
    if (!Number.isFinite(size) || size <= 0 || size > MAX_FILE_SIZE) {
      result.dropped.push({ name: nameOf(report, key), key, reason: "size_not_allowed" });
      continue;
    }
    result.kept.push({
      key,
      url: getS3ObjectUrl(key),
      name: cleanName(found.originalName, report?.name || key.split("/").pop()),
      type,
      size,
    });
  }
  return result;
}

// BEFORE a payment is created: the files must all be bookable now. Throws BookingReportError (400 for a file that cannot be
// attached, naming it; 503 when the storage cannot be asked) - at this point nothing has been charged, so refusing is safe.
async function assertReportsBookable(reports, options = {}) {
  const checked = await checkBookingReports(reports, options);
  if (checked.dropped.length) {
    const names = checked.dropped.map((d) => d.name || "a file").join(", ");
    throw new BookingReportError(
      `These files cannot be attached: ${names}. Remove them and upload them again, then continue.`,
      400,
      { invalid: checked.dropped.map((d) => ({ name: d.name, reason: d.reason })) },
    );
  }
  if (checked.unverified.length) {
    throw new BookingReportError("Your files could not be checked right now. Please try again in a moment.", 503);
  }
  return checked.kept;
}

// One log line per dropped / unverified file: the reason, who and the key (never the file's content).
function logReportOutcome(checked, { patientId, bookingId = "", kind = "booking" } = {}) {
  for (const d of checked.dropped) {
    console.warn(`[REPORT_DROPPED] kind=${kind} booking=${bookingId} patient=${patientId} reason=${d.reason} key=${d.key || "-"} name=${JSON.stringify(d.name || "")}`);
  }
  for (const u of checked.unverified) {
    console.warn(`[REPORT_UNVERIFIED] kind=${kind} booking=${bookingId} patient=${patientId} reason=storage_unavailable key=${u.key}`);
  }
}

// The warning a booking response carries when some files did not make it (empty string when all did).
function reportsWarning(checked) {
  const dropped = checked.dropped.length;
  const unverified = checked.unverified.length;
  const parts = [];
  if (dropped) {
    parts.push(
      `${dropped === 1 ? "1 file" : `${dropped} files`} could not be attached to your booking. Your booking and payment are confirmed; please contact support to send ${dropped === 1 ? "it" : "them"} to your doctor.`,
    );
  }
  if (unverified) {
    parts.push(
      `${unverified === 1 ? "1 file" : `${unverified} files`} could not be checked right now and will be attached to your booking shortly.`,
    );
  }
  return parts.join(" ");
}

// What a booking's saved reports may be shown (and signed) as.
function safeStoredReports(reports) {
  if (!Array.isArray(reports)) return [];
  return reports.filter((report) => isSafeReportKey(keyFromStoredValue(report?.key || report?.url)));
}

module.exports = {
  BookingReportError,
  checkBookingReports,
  assertReportsBookable,
  logReportOutcome,
  reportsWarning,
  safeStoredReports,
  isSafeReportKey,
  ALLOWED_TYPES,
  MAX_REPORTS,
};
