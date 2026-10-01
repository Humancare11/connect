// Backend-controlled configuration for Healthcare Discovery Search.

// "condition" and "service" both come from HealthcareCondition, split by its
// `kind` field ("service" records such as Doctor's Note are not conditions).
const RESULT_TYPES = ["category", "specialty", "condition", "service", "doctor", "blog"];

// Types searched when a request does not name any (the global search sends
// none). Every supported type in RESULT_TYPES can still be requested
// explicitly.
//
// TEMPORARILY DISABLED:
// Doctor results are intentionally excluded from global search.
// Re-enable after doctor-search requirements are finalized by setting this
// back to RESULT_TYPES (see PR7_2_DISABLE_DOCTOR_GLOBAL_SEARCH_REPORT.md).
const DEFAULT_SEARCH_TYPES = Object.freeze(RESULT_TYPES.filter((type) => type !== "doctor"));

// Response group key for each result type.
const RESULT_GROUPS = {
  category: "categories",
  specialty: "specialties",
  condition: "conditions",
  service: "services",
  doctor: "doctors",
  blog: "blogs",
};

const MAX_RESULTS_PER_TYPE = 5;
const MAX_RESULTS_TOTAL = 25;

// Category landing pages, keyed by the exact HealthcareCategory.name (names
// are already join keys across pricing/booking - see
// frontend/src/hooks/useCategoryPrice.js). Each path was verified against
// frontend/src/App.jsx. Categories not listed here fall back to the generic
// /categories page (see discoveryRoutes.js).
const CATEGORY_LANDING_ROUTES = Object.freeze({
  "Children & Family": "/child-and-family-care",
  "Chronic Care & Expert Opinion": "/chronic-care",
  "Eye, Ear & Bone": "/eye-ear-bone",
  "General & Everyday Care": "/general-and-everyday-care",
  "Men's Health": "/mens-health",
  "Mental Health": "/mental-health",
  "Sexual Health": "/sexual-health",
  "Skin & Hair": "/skin-and-hair-care",
  "Travel & Global Care": "/travel-and-global-care",
  "Weight & Nutrition": "/weight-and-nurtrition",
  "Women's Health": "/women-health",
});

// Approved mapping from Enrollment.specialization values to
// HealthcareSpecialty names. Values not listed map to themselves.
const DOCTOR_SPECIALIZATION_MAP = Object.freeze({
  "General Practice": "General Physician",
  "OB/GYN": "OB-GYN",
  Oncology: "Oncology",
  "Emergency Medicine": "Emergency Medicine",
});

module.exports = {
  RESULT_TYPES,
  DEFAULT_SEARCH_TYPES,
  RESULT_GROUPS,
  MAX_RESULTS_PER_TYPE,
  MAX_RESULTS_TOTAL,
  CATEGORY_LANDING_ROUTES,
  DOCTOR_SPECIALIZATION_MAP,
};
