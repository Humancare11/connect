// Approved search-taxonomy migration decisions (data only, no logic).
//
// Consumed by prepareSearchTaxonomyMigration.js (DRY-RUN). Sources:
//   - GLOBAL_SEARCH_IMPLEMENTATION_AUDIT.md §4, §14, §20
//   - the PR 4 specification (taxonomy migration preparation)
//   - the PR 4.5 review decisions (3 approved records, gp alias, specialty aliases)
// Every entry keyed by a legacy id also records the legacy title it expects,
// so the planner fails loudly if searchIndex.js drifts from these decisions.
//
// Specialty and category values are the exact LIVE names in MongoDB. No
// category or existing specialty is renamed by any decision here.

// Legacy searchIndex category id → live HealthcareCategory.name.
// "chronic-care-and-expert-opinion" is a typo'd duplicate id used only by the
// legacy Cardiology specialty record; it is the same category.
const LEGACY_CATEGORY_TO_LIVE = Object.freeze({
  "child-and-family-care": "Children & Family",
  "chronic-care": "Chronic Care & Expert Opinion",
  "chronic-care-and-expert-opinion": "Chronic Care & Expert Opinion",
  "eye-ear-bone": "Eye, Ear & Bone",
  "general-and-everyday-care": "General & Everyday Care",
  "men-health": "Men's Health",
  "mental-health": "Mental Health",
  "categories-sexual-health": "Sexual Health",
  "skin-and-hair-care": "Skin & Hair",
  "travel-global-care": "Travel & Global Care",
  "weight-and-nurtrition": "Weight & Nutrition",
  "women-health": "Women's Health",
});

// Legacy searchIndex specialty id → live HealthcareSpecialty.name.
const LEGACY_SPECIALTY_TO_LIVE = Object.freeze({
  "adolescent-medicine": "Adolescent Care",
  pediatrics: "Pediatrics",
  cardiology: "Cardiology",
  "export-medical-opinion": "Expert Medical Opinion",
  gastroenterology: "Gastroenterology",
  neurology: "Neurology",
  pulmonology: "Pulmonology",
  endocrinology: "Endocrinology",
  "ear-nose-throat": "ENT",
  ophthalmology: "Ophthalmology",
  orthopedics: "Orthopedics",
  "family-medicine": "Family Medicine",
  "general-physician": "General Physician",
  "internal-medicine": "Internal Medicine",
  "mens-health-specialty": "Men's Health",
  urology: "Urology",
  "behavioral-health": "Behavioral Health",
  psychiatry: "Psychiatry",
  "psychology-counseling": "Psychology / Counselling",
  "speciality-sexual-health": "Sexual Health",
  dermatology: "Dermatology",
  "global-cross-border-care": "Global / Cross-Border Care",
  "travel-medicine": "Travel Medicine",
  "weight-management": "Weight Management",
  "lifestyle-medicine": "Lifestyle Medicine",
  "nutrition-and-dietetics": "Nutrition & Dietetics",
  "menopause-care": "Menopause Care",
  "obstetrics-and-gynaecology": "OB-GYN",
  "women-mental-health": "Women's Mental Health",
  "lactation-consulting": "Lactation Consulting",
});

// Specialty implied by a legacy condition route. Only the specialty segment
// of "/<category>/<specialty>/<condition>" routes is read, plus the
// "/online-second-medical-opinion/<condition>" section.
const ROUTE_SECTION_TO_SPECIALTY = Object.freeze({
  "online-second-medical-opinion": "Expert Medical Opinion",
});
const ROUTE_SPECIALTY_SEGMENT_TO_LIVE = Object.freeze({
  cardiology: "Cardiology",
  neurology: "Neurology",
  gastroenterology: "Gastroenterology",
  pulmonology: "Pulmonology",
  endocrinology: "Endocrinology",
  orthopedics: "Orthopedics",
  ophthalmology: "Ophthalmology",
  "ear-nose-throat": "ENT",
  "general-physician": "General Physician",
  "internal-medicine": "Internal Medicine",
  "family-medicine": "Family Medicine",
  pediatrics: "Pediatrics",
  "adolescent-medicine": "Adolescent Care",
  urology: "Urology",
  "men-health": "Men's Health",
  "obstetrics-and-gynaecology": "OB-GYN",
  "global-cross-border-care": "Global / Cross-Border Care",
  "sexual-health-and-wellness": "Sexual Health",
});

// New specialties (PR 4 spec §3). Created INACTIVE: an active specialty is
// immediately bookable through the "General Consultation" booking option.
const NEW_SPECIALTIES = Object.freeze([
  { name: "Oncology", category: "Chronic Care & Expert Opinion", isActive: false },
  { name: "Emergency Medicine", category: "General & Everyday Care", isActive: false },
]);

// Doctor Enrollment.specialization → specialty name (PR 4 spec §4). Search
// and planning only: doctor/enrollment records are never modified.
const DOCTOR_SPECIALIZATION_TO_SPECIALTY = Object.freeze({
  "General Practice": "General Physician",
  "OB/GYN": "OB-GYN",
  Oncology: "Oncology",
  "Emergency Medicine": "Emergency Medicine",
  Dermatology: "Dermatology",
  Cardiology: "Cardiology",
  Gastroenterology: "Gastroenterology",
  "Internal Medicine": "Internal Medicine",
  Endocrinology: "Endocrinology",
  Pulmonology: "Pulmonology",
});

// Canonical names that differ from the legacy title (PR 4 spec §7A; audit C3).
const CANONICAL_RENAMES = Object.freeze({
  "urinary-tract-infection": { legacyTitle: "Urinary Tract Infection", name: "Urinary Tract Infection (UTI)" },
});

// Approved target specialties for records whose legacy data was NEEDS_REVIEW
// or INSUFFICIENT_DATA (PR 4 spec §5; audit §14).
const APPROVED_SPECIALTY_DECISIONS = Object.freeze({
  // Hierarchy decisions (legacy category and specialty/route disagreed).
  gastritis: { legacyTitle: "Gastritis", specialty: "Gastroenterology", basis: "approved-hierarchy" },
  hemorrhoids: { legacyTitle: "Hemorrhoids", specialty: "Gastroenterology", basis: "approved-hierarchy" },
  "irritable-bowel-syndrome": { legacyTitle: "Irritable Bowel Syndrome", specialty: "Gastroenterology", basis: "approved-hierarchy" },
  "abdominal-pain": { legacyTitle: "Abdominal Pain", specialty: "Gastroenterology", basis: "approved-hierarchy" },
  bloating: { legacyTitle: "Bloating", specialty: "Gastroenterology", basis: "approved-hierarchy" },
  arthritis: { legacyTitle: "Arthritis", specialty: "Orthopedics", basis: "approved-hierarchy" },
  osteoarthritis: { legacyTitle: "Osteoarthritis", specialty: "Orthopedics", basis: "approved-hierarchy" },
  "numbness-tingling": { legacyTitle: "Numbness & Tingling", specialty: "Neurology", basis: "approved-hierarchy" },
  "second-medical-opinion": { legacyTitle: "Second Medical Opinion", specialty: "Expert Medical Opinion", basis: "approved-hierarchy" },

  // Specialty-route decisions (legacy specialty field and route disagreed).
  migraines: { legacyTitle: "Migraine", specialty: "Neurology", basis: "approved-specialty-route" },
  dizziness: { legacyTitle: "Dizziness", specialty: "Neurology", basis: "approved-specialty-route" },
  "acid-reflux-gerd": { legacyTitle: "Acid Reflux / GERD", specialty: "Gastroenterology", basis: "approved-specialty-route" },
  constipation: { legacyTitle: "Constipation", specialty: "Gastroenterology", basis: "approved-specialty-route" },
  "sore-throat": { legacyTitle: "Sore Throat", specialty: "ENT", basis: "approved-specialty-route" },
  "multi-system-complaints": { legacyTitle: "Multi-System Complaints", specialty: "Internal Medicine", basis: "approved-specialty-route" },
  "preventive-screening": { legacyTitle: "Preventive Screening", specialty: "Internal Medicine", basis: "approved-specialty-route" },
  "undiagnosed-symptoms": { legacyTitle: "Undiagnosed Symptoms", specialty: "Internal Medicine", basis: "approved-specialty-route" },
  "routine-check-ups": { legacyTitle: "Routine Check-Ups", specialty: "Family Medicine", basis: "approved-specialty-route" },
  "vaccination-advice": { legacyTitle: "Vaccination Advice", specialty: "Family Medicine", basis: "approved-specialty-route" },
  "whole-family-illnesses": { legacyTitle: "Whole-Family Illnesses", specialty: "Family Medicine", basis: "approved-specialty-route" },
  "medication-refills-traveling": { legacyTitle: "Medication Refills While Traveling", specialty: "Travel Medicine", basis: "approved-specialty-route" },
  "prostate-health": { legacyTitle: "Prostate Health", specialty: "Urology", basis: "approved-specialty-route" },

  // Previously unresolved (no specialty in legacy data), now approved.
  "chronic-kidney-disease": { legacyTitle: "Chronic Kidney Disease", specialty: "Internal Medicine", basis: "approved-unresolved" },
  obesity: { legacyTitle: "Obesity", specialty: "Weight Management", basis: "approved-unresolved" },
  "rheumatoid-arthritis": { legacyTitle: "Rheumatoid Arthritis", specialty: "Orthopedics", basis: "approved-unresolved" },
  dehydration: { legacyTitle: "Dehydration", specialty: "General Physician", basis: "approved-unresolved" },
  indigestion: { legacyTitle: "Indigestion", specialty: "Gastroenterology", basis: "approved-unresolved" },
  "metabolic-syndrome": { legacyTitle: "Metabolic Syndrome", specialty: "Endocrinology", basis: "approved-unresolved" },
  vomiting: { legacyTitle: "Vomiting", specialty: "General Physician", basis: "approved-unresolved" },

  // CLEAR_SEMANTIC_MATCH records (no legacy specialty field; the route names
  // one live specialty in the record's own category). Approved in PR 4.5,
  // Decision 1. The planner checks the approved specialty equals the route's.
  osteoporosis: { legacyTitle: "Osteoporosis", specialty: "Endocrinology", basis: "approved-clear-semantic-match" },
  "post-covid-concerns": { legacyTitle: "Post-COVID Concerns", specialty: "Pulmonology", basis: "approved-clear-semantic-match" },
  "medication-review": { legacyTitle: "Medication Review", specialty: "Internal Medicine", basis: "approved-clear-semantic-match" },
});

// Services (PR 4 spec §6): kind "service", all under General Physician.
const SERVICES = Object.freeze({
  "doctors-note": { legacyTitle: "Doctor's Note", specialty: "General Physician" },
  "follow-up-consultation": { legacyTitle: "Follow-Up Consultation", specialty: "General Physician" },
  "lab-results-review": { legacyTitle: "Lab Results Review", specialty: "General Physician" },
  "medical-certificate": { legacyTitle: "Medical Certificate", specialty: "General Physician" },
  "prescription-refill": { legacyTitle: "Prescription Refill", specialty: "General Physician" },
  "return-to-work-clearance": { legacyTitle: "Return-to-Work Clearance", specialty: "General Physician" },
  "specialist-referral": { legacyTitle: "Specialist Referral", specialty: "General Physician" },
});

// Merges (PR 4 spec §7): the legacy record becomes an alias of the canonical.
const MERGES = Object.freeze({
  "bladder-infection": { legacyTitle: "Bladder Infection", into: "urinary-tract-infection" },
  "seasonal-allergies": { legacyTitle: "Seasonal Allergies", into: "allergic-rhinitis" },
  wheezing: { legacyTitle: "Wheezing", into: "asthma" },
});

// Aliases approved in the PR 4 spec that are not legacy keywords.
const APPROVED_EXTRA_CONDITION_ALIASES = Object.freeze({
  "asthma-flare-up": ["asthma attack", "asthma flare", "worsening asthma"],
  asthma: ["wheezing"],
  "chronic-migraine": ["migraine", "severe headache"],
});

// Aliases the PR 4 spec names as examples; the planner asserts each one ends
// up on the planned record.
const EXPECTED_CONDITION_ALIASES = Object.freeze({
  "type-2-diabetes": ["diabetes", "blood sugar"],
  osteoporosis: ["weak bones", "bone density"],
  palpitations: ["heart racing", "irregular heartbeat"],
  "high-blood-pressure": ["bp", "hypertension"],
  "chest-pain": ["chest tightness"],
  "chronic-migraine": ["migraine", "severe headache"],
  "urinary-tract-infection": ["bladder infection"],
  "allergic-rhinitis": ["seasonal allergies"],
  asthma: ["wheezing"],
  "asthma-flare-up": ["asthma attack", "asthma flare", "worsening asthma"],
});

// Specialty aliases approved in the PR 4 spec (§12), with the PR 4.5
// Decision 2 correction: "gp" belongs to General Physician (where the
// "General Practice" doctors map), never to Family Medicine. Only these are
// planned; other legacy specialty keywords are reported as unapplied
// candidates. Writing them to existing specialty documents (aliases field
// only) is approved by PR 4.5 Decision 3.
const APPROVED_SPECIALTY_ALIASES = Object.freeze({
  Dermatology: ["skin doctor", "skin"],
  Ophthalmology: ["eye doctor"],
  Cardiology: ["heart", "cardiac", "heart specialist"],
  Orthopedics: ["bone doctor", "bone", "joint"],
  Neurology: ["brain", "nerve"],
  Pulmonology: ["lungs", "breathing"],
  Endocrinology: ["hormones", "diabetes"],
  Gastroenterology: ["stomach", "digestive"],
  Pediatrics: ["pediatrician", "child health"],
  "Family Medicine": ["family doctor"],
  "General Physician": ["gp"],
  Urology: ["urologist"],
  Psychiatry: ["psychiatrist"],
  "Psychology / Counselling": ["talk therapy"],
  "Nutrition & Dietetics": ["dietitian"],
});

// Where each specialty alias set was approved (recorded on the plan's
// SET_SPECIALTY_ALIASES operations).
const SPECIALTY_ALIAS_APPROVAL = Object.freeze({
  default: "PR 4.5 Decision 3",
  "General Physician": "PR 4.5 Decision 2 (gp moved from Family Medicine) + Decision 3",
  "Family Medicine": "PR 4.5 Decision 2 (gp removed) + Decision 3",
});

// Overlapping records that stay separate. `status` says where that was decided.
const KEEP_SEPARATE = Object.freeze([
  { a: "asthma", b: "asthma-flare-up", status: "APPROVED_PR4_SPEC" },
  { a: "migraines", b: "chronic-migraine", status: "APPROVED_PR4_SPEC" },
  { a: "acne", b: "live:Teen acne", status: "APPROVED_PR4_SPEC" },
  { a: "ear-infection", b: "ear-pain", status: "PR4_SPEC_SAFEST_DEFAULT" },
  { a: "vertigo", b: "dizziness", status: "AUDIT_S14_DEFAULT_KEEP_BOTH" },
  { a: "eczema", b: "itchy-skin", status: "AUDIT_S14_DEFAULT_KEEP_BOTH" },
  { a: "cold-and-flu", b: "fever", status: "AUDIT_S14_DEFAULT_KEEP_BOTH" },
  { a: "cancer-second-opinion", b: "second-medical-opinion", status: "AUDIT_S14_DEFAULT_KEEP_BOTH" },
  { a: "vomiting", b: "nausea-and-vomiting", status: "AUDIT_S14_DEFAULT_KEEP_BOTH" },
  { a: "doctors-note", b: "medical-certificate", status: "AUDIT_S14_DEFAULT_KEEP_BOTH" },
]);

// Live condition documents known from the audit that are not valid search
// records. They are never modified or deleted by this migration.
const KNOWN_LIVE_CONDITION_NOTES = Object.freeze({
  "Teen acne": "Only usable live condition (Adolescent Care). Unchanged.",
  "Pediatric Fever": "Orphan/test data: parent specialty no longer exists.",
  jhvj: "Orphan/test data: parent specialty no longer exists.",
});

module.exports = {
  LEGACY_CATEGORY_TO_LIVE,
  LEGACY_SPECIALTY_TO_LIVE,
  ROUTE_SECTION_TO_SPECIALTY,
  ROUTE_SPECIALTY_SEGMENT_TO_LIVE,
  NEW_SPECIALTIES,
  DOCTOR_SPECIALIZATION_TO_SPECIALTY,
  CANONICAL_RENAMES,
  APPROVED_SPECIALTY_DECISIONS,
  SERVICES,
  MERGES,
  APPROVED_EXTRA_CONDITION_ALIASES,
  EXPECTED_CONDITION_ALIASES,
  APPROVED_SPECIALTY_ALIASES,
  SPECIALTY_ALIAS_APPROVAL,
  KEEP_SEPARATE,
  KNOWN_LIVE_CONDITION_NOTES,
};
