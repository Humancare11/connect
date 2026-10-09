// In-memory catalog of PUBLIC searchable data for Healthcare Discovery Search.
//
// Built from fixed, read-only MongoDB queries with explicit field selection.
// Search input never reaches these queries: matching happens in memory
// against the plain objects produced here. No patient, consultation,
// payment, authentication or private doctor data is ever loaded.

const HealthcareCategory = require("../../models/HealthcareCategory");
const HealthcareSpecialty = require("../../models/HealthcareSpecialty");
const HealthcareCondition = require("../../models/HealthcareCondition");
const Enrollment = require("../../models/Enrollment");
const Doctor = require("../../models/Doctor");
const Blog = require("../../models/Blog");
const { DOCTOR_SPECIALIZATION_MAP } = require("./searchConstants");
const { isConditionSearchable } = require("./searchVisibility");
const { isDevPlanOverlayEnabled, loadPlanOverlay, applyPlanOverlay } = require("./devPlanCatalog");

const DEFAULT_TTL_MS = 5 * 60 * 1000;

const CATEGORY_FIELDS = "_id name description icon isActive";
const SPECIALTY_FIELDS = "_id categoryId name description icon aliases isActive";
const CONDITION_FIELDS = "_id specialtyId name description icon aliases kind legacyId slug route isActive isSearchable";
// Search visibility is independent of booking visibility (PR 8.1): a condition
// is a candidate when it is searchable OR active (legacy records with no
// isSearchable value); isConditionSearchable() decides, in memory.
const CONDITION_FILTER = Object.freeze({ $or: [{ isSearchable: true }, { isActive: true }] });

// The only Enrollment fields a public doctor search result may carry.
const DOCTOR_PUBLIC_FIELDS = Object.freeze([
  "firstName", "surname", "qualification", "specialization", "subSpecialization",
  "languagesKnown", "city", "state", "country", "experience", "aboutDoctor",
  "gender", "consultantFees", "feeCurrency", "consultationMode",
]);

// Public doctor = approved enrollment whose linked Doctor account exists, is
// not disabled and has a public doctorId. Everything else is projected away
// inside MongoDB, before any document reaches Node.
function publicDoctorsPipeline(doctorCollectionName) {
  return [
    { $match: { approvalStatus: "approved" } },
    {
      $lookup: {
        from: doctorCollectionName,
        localField: "doctorId",
        foreignField: "_id",
        as: "account",
        pipeline: [
          { $match: { accountDisabled: { $ne: true } } },
          { $project: { _id: 0, doctorId: 1 } },
        ],
      },
    },
    { $unwind: "$account" },
    { $match: { "account.doctorId": { $type: "number" } } },
    {
      $project: {
        _id: 0,
        doctorId: "$account.doctorId",
        ...Object.fromEntries(DOCTOR_PUBLIC_FIELDS.map((field) => [field, 1])),
      },
    },
  ];
}

const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const textList = (value, maxItems, maxLength) =>
  (Array.isArray(value) ? value : [])
    .filter((item) => typeof item === "string")
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
const nonNegativeNumber = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
const idString = (value) => (value ? String(value) : "");

// Builds the public doctor record from an explicit allowlist (defence in
// depth on top of the MongoDB projection). Returns null when unusable.
function toPublicDoctor(raw) {
  if (!raw || typeof raw !== "object") return null;
  const doctorId = raw.doctorId;
  if (!Number.isInteger(doctorId) || doctorId < 10000 || doctorId > 99999) return null;

  const firstName = text(raw.firstName, 60);
  const surname = text(raw.surname, 60);
  const fullName = [firstName, surname].filter(Boolean).join(" ");
  const specialization = text(raw.specialization, 120);

  return {
    doctorId,
    firstName,
    surname,
    displayName: fullName ? `Dr. ${fullName}` : "Doctor",
    qualification: text(raw.qualification, 60),
    specialization,
    specialtyName: DOCTOR_SPECIALIZATION_MAP[specialization] || specialization,
    subSpecialization: text(raw.subSpecialization, 120),
    languagesKnown: textList(raw.languagesKnown, 15, 40),
    city: text(raw.city, 80),
    state: text(raw.state, 80),
    country: text(raw.country, 80),
    experience: nonNegativeNumber(raw.experience),
    aboutDoctor: text(raw.aboutDoctor, 500),
    gender: text(raw.gender, 20),
    consultantFees: nonNegativeNumber(raw.consultantFees),
    feeCurrency: text(raw.feeCurrency, 8),
    consultationMode: text(raw.consultationMode, 40),
  };
}

function toPublicBlog(raw) {
  const path = text(raw && raw.path, 200);
  const title = text(raw && raw.title, 200);
  if (!title || !path.startsWith("/")) return null;
  return {
    id: String(raw.id),
    title,
    description: text(raw.description, 600),
    path,
    readTime: nonNegativeNumber(raw.readTime),
  };
}

// Published blogs only, as { id, title, description, path, readTime }. A
// `sources.blogs` array (used by tests) takes precedence over the database.
async function loadPublicBlogs(sources) {
  if (Array.isArray(sources.blogs)) return sources.blogs;
  if (!sources.Blog) return [];
  const rows = await sources.Blog.find({ status: "published" })
    .select("slug title excerpt readTime")
    .sort({ isLegacy: 1, legacyOrder: 1, publishedAt: -1 })
    .lean();
  return rows.map((row) => ({
    id: idString(row._id),
    title: row.title,
    description: row.excerpt,
    path: `/${row.slug}`,
    readTime: row.readTime,
  }));
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

const defaultSources = {
  HealthcareCategory,
  HealthcareSpecialty,
  HealthcareCondition,
  Enrollment,
  Doctor,
  Blog,
};

// Reviewed abbreviations and common symptom phrases, keyed by the EXACT
// canonical name of an existing taxonomy record. A phrase is only added when
// a record with that name is already in the catalog (never creates a result),
// and it behaves as an ordinary alias, so ranking and matching are unchanged.
// Symptom phrases only route a search to where care is discovered; they are
// not a diagnosis. The abbreviations and condition entries mirror aliases from
// the taxonomy migration; once that migration writes them to the database this
// supplement becomes a no-op. "ent" and "obgyn" need no entry: they already
// match "ENT" and "OB-GYN".
const CONTROLLED_ABBREVIATIONS = Object.freeze({
  specialty: Object.freeze({
    "General Physician": ["gp", "fever", "high temperature", "feeling feverish", "temperature", "running a temperature"],
    Neurology: ["headache", "head pain", "my head hurts", "head hurts", "pain in my head"],
    Gastroenterology: ["stomach pain", "tummy pain", "belly pain", "my tummy hurts", "tummy hurts", "my stomach hurts", "my belly hurts", "stomach ache", "tummy ache", "pain in my stomach"],
    Dermatology: ["itchy skin", "skin itching", "my skin is itchy", "my skin itches"],
    Orthopedics: ["joint pain", "joint ache", "my joints hurt", "joints hurt", "aching joints", "pain in my joints"],
  }),
  condition: Object.freeze({
    "High Blood Pressure": ["bp"],
    "Urinary Tract Infection (UTI)": ["uti"],
    "Acid Reflux / GERD": ["gerd"],
    Fever: ["high temperature", "feeling feverish", "temperature", "running a temperature"],
    Headache: ["head pain", "my head hurts", "head hurts", "pain in my head"],
    "Abdominal Pain": ["stomach pain", "tummy pain", "belly pain", "my tummy hurts", "tummy hurts", "my stomach hurts", "my belly hurts", "stomach ache", "tummy ache", "pain in my stomach"],
    "Itchy Skin": ["skin itching", "itching", "my skin is itchy", "my skin itches"],
    "Joint Pain": ["joint ache", "my joints hurt", "joints hurt", "aching joints", "pain in my joints"],
  }),
});

const withControlledAliases = (kind, name, aliases) => {
  const extra = (CONTROLLED_ABBREVIATIONS[kind] || {})[name] || [];
  const missing = extra.filter((alias) => !aliases.some((existing) => existing.toLowerCase() === alias));
  return missing.length ? [...aliases, ...missing] : aliases;
};

async function buildSearchCatalog(sources = defaultSources) {
  const [rawCategories, fetchedSpecialties, fetchedConditions, rawDoctors] = await Promise.all([
    sources.HealthcareCategory.find({ isActive: true }).select(CATEGORY_FIELDS).lean(),
    sources.HealthcareSpecialty.find({ isActive: true }).select(SPECIALTY_FIELDS).lean(),
    sources.HealthcareCondition.find(CONDITION_FILTER).select(CONDITION_FIELDS).lean(),
    sources.Enrollment.aggregate(publicDoctorsPipeline(sources.Doctor.collection.name)),
  ]);

  // DEVELOPMENT ONLY (see devPlanCatalog.js): in-memory overlay of the planned
  // PR8 records. Only present when getSearchCatalog() was given an overlay,
  // which requires NODE_ENV=development and SEARCH_DEV_PLAN_CATALOG=true.
  let rawSpecialties = fetchedSpecialties;
  let rawConditions = fetchedConditions;
  if (sources.devPlanOverlay) {
    const merged = applyPlanOverlay({ rawCategories, rawSpecialties, rawConditions }, sources.devPlanOverlay);
    rawSpecialties = merged.rawSpecialties;
    rawConditions = merged.rawConditions;
    console.warn(`[search] DEV PLAN CATALOG overlay active: ${merged.added} planned condition/service records added in memory (${merged.skipped.length} skipped). No database writes.`);
  }

  // Visibility mirrors /api/appointment-tree: a child is only searchable
  // when every parent above it is active.
  const categories = rawCategories
    .filter((category) => category.isActive === true && text(category.name, 120))
    .map((category) => ({
      _id: idString(category._id),
      name: text(category.name, 120),
      description: text(category.description, 1000),
      icon: text(category.icon, 500),
      isActive: true,
    }));
  const categoryById = Object.fromEntries(categories.map((category) => [category._id, category]));

  const specialties = rawSpecialties
    .filter((specialty) => specialty.isActive === true && categoryById[idString(specialty.categoryId)])
    .filter((specialty) => text(specialty.name, 120))
    .map((specialty) => ({
      _id: idString(specialty._id),
      categoryId: idString(specialty.categoryId),
      name: text(specialty.name, 120),
      description: text(specialty.description, 1000),
      icon: text(specialty.icon, 500),
      aliases: withControlledAliases("specialty", text(specialty.name, 120), textList(specialty.aliases, 30, 60)),
      isActive: true,
    }));
  const specialtyById = Object.fromEntries(specialties.map((specialty) => [specialty._id, specialty]));

  const conditions = rawConditions
    // Hierarchy safety is unchanged: the parent specialty (and its category)
    // must exist and be active, so orphaned taxonomy is never exposed.
    .filter((condition) => isConditionSearchable(condition) && specialtyById[idString(condition.specialtyId)])
    .filter((condition) => text(condition.name, 120))
    .map((condition) => ({
      _id: idString(condition._id),
      specialtyId: idString(condition.specialtyId),
      name: text(condition.name, 120),
      description: text(condition.description, 1000),
      icon: text(condition.icon, 500),
      aliases: condition.kind === "service"
        ? textList(condition.aliases, 30, 60)
        : withControlledAliases("condition", text(condition.name, 120), textList(condition.aliases, 30, 60)),
      kind: condition.kind === "service" ? "service" : "condition",
      // Migration traceability only; never part of a search response.
      legacyId: text(condition.legacyId, 80),
      slug: text(condition.slug, 140),
      route: text(condition.route, 200),
      // Booking visibility, reported as stored (no longer implied by presence).
      isActive: condition.isActive === true,
      isSearchable: true,
    }));

  const doctors = rawDoctors.map(toPublicDoctor).filter(Boolean);
  const blogs = (await loadPublicBlogs(sources)).map(toPublicBlog).filter(Boolean);

  return deepFreeze({
    categories,
    specialties,
    conditions,
    doctors,
    blogs,
    index: { categoryById, specialtyById },
    builtAt: new Date().toISOString(),
  });
}

function ttlMs() {
  const configured = process.env.SEARCH_CATALOG_TTL_MS;
  if (configured === undefined || configured === "") return DEFAULT_TTL_MS;
  const value = Number(configured);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_TTL_MS;
}

let cached = null; // { catalog, expiresAt }
let inflight = null;
let generation = 0;

async function getSearchCatalog() {
  if (cached && Date.now() < cached.expiresAt) return cached.catalog;

  if (!inflight) {
    const buildGeneration = generation;
    inflight = buildSearchCatalog(
      isDevPlanOverlayEnabled() ? { ...defaultSources, devPlanOverlay: loadPlanOverlay() } : defaultSources,
    )
      .then((catalog) => {
        // Skip caching a build that was invalidated while it ran.
        if (buildGeneration === generation) {
          cached = { catalog, expiresAt: Date.now() + ttlMs() };
        }
        return catalog;
      })
      .finally(() => {
        inflight = null;
      });
  }

  try {
    return await inflight;
  } catch (err) {
    // Serve the last good catalog rather than failing search outright.
    if (cached) return cached.catalog;
    throw err;
  }
}

function invalidateSearchCatalog() {
  generation += 1;
  cached = null;
}

module.exports = {
  getSearchCatalog,
  invalidateSearchCatalog,
  buildSearchCatalog,
  publicDoctorsPipeline,
  toPublicDoctor,
  DOCTOR_PUBLIC_FIELDS,
};
