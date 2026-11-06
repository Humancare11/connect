const { encryptPHI, decryptPHI } = require("./phiCrypto");

// Structured visit-note fields. Clinical text is encrypted at rest (phiCrypto, same as prescriptions) as one
// blob on the note / report; nothing here is stored in plaintext.
const FIELD_LIMITS = { symptoms: 5000, clinicalFindings: 5000, plan: 5000, note: 20000 };
const FIELD_KEYS = Object.keys(FIELD_LIMITS);
const REQUIRED_KEYS = ["symptoms", "clinicalFindings", "plan"];
const FIELD_LABELS = { symptoms: "Symptoms", clinicalFindings: "Clinical Findings", plan: "Plan / Treatment", note: "Note" };

class FieldError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.statusCode = status;
  }
}

const emptyFields = () => ({ symptoms: "", clinicalFindings: "", plan: "", note: "" });

// Reads the four fields off a note/report document. Notes written before structured fields existed have no cipher
// blob: their single `content` text is shown in Note so nothing is lost (see scripts/migrateConsultationNotes.js).
function readFields(doc) {
  const out = emptyFields();
  if (!doc) return out;
  const decrypted = decryptPHI(doc);
  if (decrypted && typeof decrypted === "object") {
    for (const key of FIELD_KEYS) out[key] = typeof decrypted[key] === "string" ? decrypted[key] : "";
    return out;
  }
  out.note = typeof doc.content === "string" ? doc.content : "";
  return out;
}

// Validates a partial update. Only keys present in `body` are returned; `content` is accepted as an alias of `note`
// so older clients keep working.
function pickFieldUpdates(body = {}) {
  const updates = {};
  const source = { ...body };
  if (source.note === undefined && source.content !== undefined) source.note = source.content;
  for (const key of FIELD_KEYS) {
    if (source[key] === undefined) continue;
    if (typeof source[key] !== "string") throw new FieldError(`${FIELD_LABELS[key]} must be text.`);
    if (source[key].length > FIELD_LIMITS[key]) {
      throw new FieldError(`${FIELD_LABELS[key]} must be ${FIELD_LIMITS[key].toLocaleString("en-US")} characters or fewer.`);
    }
    updates[key] = source[key];
  }
  return updates;
}

const missingRequired = (fields) => REQUIRED_KEYS.filter((key) => !String(fields[key] || "").trim());

const encryptFields = (fields) => {
  const clean = {};
  for (const key of FIELD_KEYS) clean[key] = String(fields[key] || "");
  return encryptPHI(clean);
};

module.exports = {
  FIELD_LIMITS, FIELD_KEYS, REQUIRED_KEYS, FIELD_LABELS, FieldError,
  emptyFields, readFields, pickFieldUpdates, missingRequired, encryptFields,
};
