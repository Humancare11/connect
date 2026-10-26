// Plain logic for the full-page Assign / Alternate doctor screen (AdminAssignDoctor.jsx): no React, tested with
// `node --test` (see assignPageLogic.test.mjs). The ranking code is the old page's, unchanged.

// ── Coming from and going back to the Appointments list ──────────────────────

const LIST_PATH = "/admin-dashboard/appointments";
const LIST_KEYS = ["tab", "hideTesting", "page"];

// The list's own URL query (tab, Hide testing, page), copied to the assign page as ?from=..., so saving goes back to the
// same tab and page. Only those three keys are kept, whatever the address says.
export function safeListQuery(raw) {
  const incoming = new URLSearchParams(String(raw || "").replace(/^\?/, ""));
  const kept = new URLSearchParams();
  for (const key of LIST_KEYS) {
    const value = incoming.get(key);
    if (value && /^[a-z0-9]{1,20}$/i.test(value)) kept.set(key, value);
  }
  return kept.toString();
}

export const listUrl = (raw) => {
  const query = safeListQuery(raw);
  return query ? `${LIST_PATH}?${query}` : LIST_PATH;
};

// The link from a list row to its assign page; listSearch is the list's current location.search.
export const assignUrl = (id, listSearch) => {
  const from = safeListQuery(listSearch);
  return `${LIST_PATH}/${id}/assign${from ? `?from=${encodeURIComponent(from)}` : ""}`;
};

// ── The old page's ranking ───────────────────────────────────────────────────

export function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function includesToken(source, target) {
  const a = normalize(source);
  const b = normalize(target);
  return Boolean(a && b && (a.includes(b) || b.includes(a)));
}

function uniqueValues(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

export function doctorDisplayName(name) {
  const cleanName = String(name || "").trim();
  if (!cleanName) return "Doctor";
  return cleanName.toLowerCase().startsWith("dr.") ? cleanName : `Dr. ${cleanName}`;
}

function getLicenseCountries(doctor) {
  return uniqueValues([
    doctor.licenseCountry,
    doctor.medicalLicenseCountry,
    doctor.registrationCountry,
    doctor.country,
    ...(Array.isArray(doctor.internationalLicenses) ? doctor.internationalLicenses : []),
  ]);
}

// `fit` = { specialty, category, condition, country } of the booking.
export function scoreDoctor(doctor, fit) {
  const licenseCountries = getLicenseCountries(doctor);
  const priority = {
    specialty: includesToken(doctor.specialty, fit.specialty),
    country: includesToken(doctor.country, fit.country),
    licenseCountry: licenseCountries.some((country) => includesToken(country, fit.country)),
  };
  let secondaryScore = 0;

  if (includesToken(doctor.subSpecialty, fit.specialty)) secondaryScore += 40;
  if (includesToken(doctor.specialty, fit.category) || includesToken(doctor.about, fit.category)) secondaryScore += 25;
  if (includesToken(doctor.about, fit.condition) || includesToken(doctor.subSpecialty, fit.condition)) secondaryScore += 20;
  if (Number(doctor.experience) >= 10) secondaryScore += 5;

  const score = (priority.specialty ? 1000 : 0) + (priority.country ? 100 : 0) + (priority.licenseCountry ? 10 : 0) + secondaryScore / 100;
  return { score, priority, secondaryScore };
}

// The approved doctors that match the search, best fit first (specialty, then country, then licence country, then
// clinical fit, then name).
export function rankDoctors(doctors, fit, query) {
  const q = normalize(query);
  return (Array.isArray(doctors) ? doctors : [])
    .map((doctor) => {
      const match = scoreDoctor(doctor, fit);
      return { ...doctor, matchPriority: match.priority, matchSecondaryScore: match.secondaryScore };
    })
    .filter((doctor) => {
      if (!q) return true;
      return [
        doctor.name,
        doctor.doctorId,
        doctor.specialty,
        doctor.subSpecialty,
        doctor.city,
        doctor.state,
        doctor.country,
        ...(Array.isArray(doctor.internationalLicenses) ? doctor.internationalLicenses : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    })
    .sort((a, b) => {
      const priorityCompare =
        Number(b.matchPriority?.specialty) - Number(a.matchPriority?.specialty) ||
        Number(b.matchPriority?.country) - Number(a.matchPriority?.country) ||
        Number(b.matchPriority?.licenseCountry) - Number(a.matchPriority?.licenseCountry);
      return priorityCompare || b.matchSecondaryScore - a.matchSecondaryScore || String(a.name).localeCompare(String(b.name));
    });
}

// ── One view of a booking, whichever kind ────────────────────────────────────

// `row` is the booking from GET /api/admin/bookings/:id; `appointment` is GET /api/appointments/:id (regular
// appointments, as the old page used it); `detail` is what the same bookings endpoint adds for a category
// consultation (what the old category page used).
export function buildView(row, appointment, detail) {
  const hasDoctor = Boolean(row.doctorName);
  const base = {
    kind: row.kind,
    status: row.status,
    closed: row.status === "complete" || row.status === "cancelled",
    hasDoctor,
    currentDoctorName: row.doctorName || "",
    originalDoctorName: row.originalDoctorName || "",
    patientName: row.patient?.name || "",
  };

  if (row.kind === "category") {
    const d = detail || {};
    const flexible = d.appointmentType === "FLEXIBLE_TIME";
    return {
      ...base,
      country: row.patient?.country || "",
      concern: d.concern || "",
      severity: d.severity || "",
      supportType: d.supportType || "",
      urgency: d.urgency || "",
      timeWindow: d.timeWindow || "",
      slotText: (flexible ? d.slot : d.assignedSlot) || "",
      // Same rule as the server: a Next Available booking has no time until the admin gives one.
      needsTime: !hasDoctor && !flexible,
      initialTime: d.assignedSlot || "",
      currentEnrollmentId: d.assignedDoctorId ? String(d.assignedDoctorId) : "",
      currentDoctorMongoId: "",
      fit: { specialty: d.specialtyName, category: d.categoryName, condition: d.conditionName || d.serviceName, country: row.patient?.country },
    };
  }

  const a = appointment || {};
  const country = a.patientId?.country || a.country || row.patient?.country || "";
  return {
    ...base,
    patientName: a.patientId?.name || base.patientName,
    country,
    category: a.category || "",
    specialty: a.specialty || "",
    condition: a.condition || "",
    date: a.date || "",
    time: a.time || "",
    needsTime: false,
    initialTime: "",
    currentEnrollmentId: "",
    currentDoctorMongoId: a.doctorId?._id ? String(a.doctorId._id) : "",
    fit: { specialty: a.specialty, category: a.category, condition: a.condition, country },
  };
}

// Is this doctor the booking's current one? (The approved list gives each doctor's enrollment id and Mongo doctor id.)
export function isCurrentDoctor(doctor, view) {
  if (!view.hasDoctor) return false;
  if (view.kind === "category") return Boolean(view.currentEnrollmentId) && String(doctor.id) === view.currentEnrollmentId;
  return Boolean(view.currentDoctorMongoId) && String(doctor.mongoId || "") === view.currentDoctorMongoId;
}

// The message the toast shows after saving.
export const savedMessage = (action, originalDoctorName) =>
  ({
    assign: "Doctor assigned. They need to confirm the booking.",
    alternate: "Doctor changed. The new doctor needs to confirm the booking.",
    revert: `The booking is back with ${originalDoctorName || "the original doctor"}. They need to confirm it.`,
  })[action];
