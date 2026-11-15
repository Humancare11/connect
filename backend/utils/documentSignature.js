const mongoose = require("mongoose");
const Doctor = require("../models/Doctor");
const Enrollment = require("../models/Enrollment");
const { copyObject, streamPng } = require("./visitNoteStorage");

// Signing for Prescriptions and Medical Certificates. Same model as Visit Notes: the doctor has ONE reusable
// profile signature (Enrollment.signatureKey); signing copies it to a key owned by the document, so replacing the
// profile signature later never changes an issued document. The key is never sent to a client: the image is only
// served through authenticated, role-scoped routes.
const KINDS = {
  prescription: "prescriptions",
  certificate: "certificates",
};

class DocumentSignatureError extends Error {
  constructor(message, status = 400, code = "") {
    super(message);
    this.name = "DocumentSignatureError";
    this.statusCode = status;
    this.code = code;
  }
}

const documentSignatureKey = (kind, docId) => `${KINDS[kind]}/${docId}/signature.png`;

// Copies the doctor's saved signature for a document about to be created.
// Returns the fields to merge into the new document. Throws SIGNATURE_REQUIRED if the doctor has none.
async function snapshotSignature({ kind, docId, doctorId }) {
  if (!KINDS[kind]) throw new Error(`unknown document kind: ${kind}`);
  const [doctor, enrollment] = await Promise.all([
    Doctor.findById(doctorId).select("name").lean(),
    Enrollment.findOne({ doctorId }).select("signatureKey medicalRegistrationNumber").lean(),
  ]);
  if (!enrollment?.signatureKey) {
    throw new DocumentSignatureError(
      "You have no saved signature. Add one in your profile, or issue this document unsigned.",
      422,
      "SIGNATURE_REQUIRED",
    );
  }
  const signatureKey = documentSignatureKey(kind, docId);
  try {
    await copyObject(enrollment.signatureKey, signatureKey);
  } catch (err) {
    console.error("document signature copy failed:", err);
    throw new DocumentSignatureError("Could not save the signature. Please try again.", 502, "SIGNATURE_COPY_FAILED");
  }
  return {
    signatureKey,
    signedAt: new Date(),
    signedBy: { name: doctor?.name || "", registrationNumber: String(enrollment.medicalRegistrationNumber || "").trim() },
  };
}

// Removes the private key from a document before it leaves the server and says whether it is signed.
function publicSignatureFields(doc) {
  if (!doc) return doc;
  const { signatureKey, ...rest } = doc;
  return { ...rest, isSigned: !!signatureKey };
}

// GET .../:id/signature for a role. `scope(req)` confines the lookup (e.g. { doctorId } or { patientId }).
// Anything outside the scope, unsigned, or an invalid id is a 404, so ids cannot be probed.
const streamDocumentSignature = (Model, scope) => async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(req.params.id || ""))) return res.status(404).json({ msg: "Signature not found." });
    const doc = await Model.findOne({ _id: req.params.id, ...scope(req) }).select("signatureKey").lean();
    if (!doc?.signatureKey) return res.status(404).json({ msg: "Signature not found." });
    return streamPng(res, doc.signatureKey);
  } catch (err) {
    console.error("document signature route error:", err);
    return res.status(500).json({ msg: "Failed to load signature." });
  }
};

module.exports = {
  DocumentSignatureError,
  documentSignatureKey,
  snapshotSignature,
  publicSignatureFields,
  streamDocumentSignature,
};
