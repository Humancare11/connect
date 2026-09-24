// Shared helpers for the Partner Case feature — input sanitisation, the
// admin status-transition map, and the partner-facing serializer.
//
// SECURITY: serializeCaseForPartner() is an explicit allow-list. It builds a
// brand-new object field-by-field and never spreads the Mongoose document, so
// internal/admin-only fields (adminNotes, assignedBy, linkedAppointment, raw
// refs, __v, ...) can never leak to a Partner response.

const MAX = {
  short: 200,
  medium: 500,
  long: 4000,
  url: 1000,
  key: 500,
};

const SERVICE_TYPES = ["teleconsultation", "house-call", "in-clinic"];
const URGENCIES = ["routine", "urgent", "emergency"];

// Legal admin status transitions. "submitted" -> "cancelled" is also allowed
// for the partner, but only through the dedicated cancel route.
const ALLOWED_TRANSITIONS = {
  submitted: ["assigned", "cancelled"],
  assigned: ["in-progress", "cancelled"],
  "in-progress": ["completed", "cancelled"],
  completed: ["invoiced"],
  invoiced: [],
  cancelled: [],
};

// Strip ASCII control characters (0x00-0x1F and 0x7F) from free text.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = new RegExp("[\\u0000-\\u001F\\u007F]", "g");

function cleanText(value, max = MAX.medium) {
  return String(value == null ? "" : value).replace(CONTROL_CHARS, "").trim().slice(0, max);
}

function cleanDate(value) {
  const v = cleanText(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "";
}

function cleanTime(value) {
  const v = cleanText(value, 5);
  return /^\d{2}:\d{2}$/.test(v) ? v : "";
}

function cleanAttachments(value) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 20)
    .map((file) => ({
      name: cleanText(file && file.name, 255),
      key: cleanText(file && file.key, MAX.key),
      url: cleanText(file && file.url, MAX.url),
      type: cleanText(file && file.type, 100),
      size: cleanText(file && file.size, 40),
    }))
    .filter((file) => file.name || file.key);
}

// Allow-listed case payload from a partner. Anything not named here is dropped.
function sanitizeCaseInput(body = {}) {
  const serviceType = SERVICE_TYPES.includes(body.serviceType) ? body.serviceType : null;
  const urgency = URGENCIES.includes(body.urgency) ? body.urgency : "routine";
  const patient = body.patient && typeof body.patient === "object" ? body.patient : {};
  const location = body.location && typeof body.location === "object" ? body.location : {};

  return {
    serviceType,
    urgency,
    preferredDate: cleanDate(body.preferredDate),
    preferredTime: cleanTime(body.preferredTime),
    patient: {
      name: cleanText(patient.name, MAX.short),
      dob: cleanDate(patient.dob),
      gender: cleanText(patient.gender, 20),
      phone: cleanText(patient.phone, 40),
      language: cleanText(patient.language, 60),
      policyId: cleanText(patient.policyId, 100),
      complaint: cleanText(patient.complaint, MAX.long),
    },
    location: {
      country: cleanText(location.country, MAX.short),
      state: cleanText(location.state, MAX.short),
      postalCode: cleanText(location.postalCode, MAX.short),
      pharmacyAddress: cleanText(location.pharmacyAddress, MAX.medium),
      clinicName: cleanText(location.clinicName, MAX.short),
      address: cleanText(location.address, MAX.medium),
    },
    attachments: cleanAttachments(body.attachments),
  };
}

function serializeMessage(msg) {
  return {
    _id: msg._id,
    body: msg.body,
    authorName: msg.authorName || "",
    authorRole: msg.authorRole,
    createdAt: msg.createdAt,
  };
}


// Partner-facing message view: admin identities are collapsed to a generic
// support label so individual staff names/emails are never exposed.
function serializeMessageForPartner(msg) {
  const isAdmin = msg.authorRole === "admin";
  return {
    _id: msg._id,
    body: msg.body,
    authorName: isAdmin ? "Humancare Support" : msg.authorName || "",
    authorRole: msg.authorRole,
    createdAt: msg.createdAt,
  };
}

// The ONLY shape a partner ever receives for a case.
function serializeCaseForPartner(doc) {
  if (!doc) return null;
  const c = typeof doc.toObject === "function" ? doc.toObject() : doc;

  let assignedDoctorName = "";
  if (c.assignedDoctor && typeof c.assignedDoctor === "object" && c.assignedDoctor.name) {
    assignedDoctorName = c.assignedDoctor.name;
  }

  const patient = c.patient || {};
  const location = c.location || {};

  return {
    _id: c._id,
    caseNumber: c.caseNumber,
    serviceType: c.serviceType,
    urgency: c.urgency,
    preferredDate: c.preferredDate || "",
    preferredTime: c.preferredTime || "",
    status: c.status,
    patient: {
      name: patient.name || "",
      dob: patient.dob || "",
      gender: patient.gender || "",
      phone: patient.phone || "",
      language: patient.language || "",
      policyId: patient.policyId || "",
      complaint: patient.complaint || "",
    },
    location: {
      country: location.country || "",
      state: location.state || "",
      postalCode: location.postalCode || "",
      pharmacyAddress: location.pharmacyAddress || "",
      clinicName: location.clinicName || "",
      address: location.address || "",
    },
    attachments: Array.isArray(c.attachments)
      ? c.attachments.map((a) => ({ name: a.name, key: a.key, type: a.type, size: a.size }))
      : [],
    assignedDoctorName,
    // The video consultation link is only relevant for teleconsultations —
    // never expose it for house-call / in-clinic cases.
    videoLink: c.serviceType === "teleconsultation" ? c.videoLink || "" : "",
    amountCents: typeof c.amountCents === "number" ? c.amountCents : null,
    currency: c.currency || "usd",
    hasInvoice: Boolean(c.invoice),
    messages: Array.isArray(c.messages) ? c.messages.map(serializeMessageForPartner) : [],
    statusHistory: Array.isArray(c.statusHistory)
      ? c.statusHistory.map((h) => ({ status: h.status, at: h.at }))
      : [],
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

module.exports = {
  SERVICE_TYPES,
  URGENCIES,
  ALLOWED_TRANSITIONS,
  cleanText,
  cleanDate,
  cleanTime,
  cleanAttachments,
  sanitizeCaseInput,
  serializeCaseForPartner,
  serializeMessage,
};
