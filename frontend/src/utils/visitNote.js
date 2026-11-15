// Shared constants and helpers for Visit Notes (structured consultation notes + finalised reports).

export const NOTE_FIELDS = [
  { key: "symptoms", label: "Symptoms", required: true, rows: 3, max: 5000, placeholder: "Presenting symptoms and history..." },
  { key: "clinicalFindings", label: "Clinical Findings", required: true, rows: 3, max: 5000, placeholder: "Examination and observations..." },
  { key: "plan", label: "Plan / Treatment", required: true, rows: 3, max: 5000, placeholder: "Plan, treatment and follow-up..." },
  { key: "note", label: "Note", required: false, rows: 8, max: 20000, placeholder: "Any other notes (optional)..." },
];

export const REQUIRED_KEYS = NOTE_FIELDS.filter((f) => f.required).map((f) => f.key);

export const emptyFields = () => ({ symptoms: "", clinicalFindings: "", plan: "", note: "" });

export const pickFields = (note) => {
  const out = emptyFields();
  if (note) for (const key of Object.keys(out)) out[key] = typeof note[key] === "string" ? note[key] : "";
  return out;
};

export const missingRequired = (fields) => REQUIRED_KEYS.filter((key) => !String(fields?.[key] || "").trim());

export const fieldLabel = (key) => NOTE_FIELDS.find((f) => f.key === key)?.label || key;

export const fmtTime = (value) =>
  value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

export const fmtDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";

export const fmtDateTime = (value) => (value ? `${fmtDate(value)} ${fmtTime(value)}` : "");

// ── Signature (PNG or JPG, 2 MB) - one rule for Prescription, Medical Certificate and Visit Note ────────────────
export const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/jpg", "image/pjpeg"];
const startsWith = (head, magic) => head.length >= magic.length && magic.every((byte, i) => head[i] === byte);

// Quick client-side check so obvious mistakes fail before the upload (the server repeats all of it and decodes the
// image). The real type comes from the first bytes, not the name. Returns an error string, or "" when OK.
export async function validateSignatureFile(file) {
  if (!file) return "Please choose a PNG or JPG signature image.";
  if (file.size > MAX_SIGNATURE_BYTES) return "The signature image must be 2 MB or smaller.";
  if (!ALLOWED_MIME.includes(String(file.type).toLowerCase())) return "The signature must be a PNG or JPG image.";
  const head = new Uint8Array(await file.slice(0, PNG_MAGIC.length).arrayBuffer());
  if (!startsWith(head, PNG_MAGIC) && !startsWith(head, JPEG_MAGIC)) return "This file is not a valid PNG or JPG image.";
  return "";
}

// Report states used on the Appointments page.
export const REPORT_STATE_LABEL = { draft: "Draft", signed: "Signed" };

// The signature is drawn into the PDF by html-to-image, which re-fetches every image URL. The page CSP
// (connect-src) does not allow blob: URLs, so the slip is given a data: URL instead.
export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
