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
const publicBlogs = require("../../data/publicBlogs");
const { DOCTOR_SPECIALIZATION_MAP } = require("./searchConstants");

const DEFAULT_TTL_MS = 5 * 60 * 1000;

const CATEGORY_FIELDS = "_id name description icon isActive";
const SPECIALTY_FIELDS = "_id categoryId name description icon aliases isActive";
const CONDITION_FIELDS = "_id specialtyId name description icon aliases kind legacyId slug route isActive";

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
  blogs: publicBlogs,
};

async function buildSearchCatalog(sources = defaultSources) {
  const [rawCategories, rawSpecialties, rawConditions, rawDoctors] = await Promise.all([
    sources.HealthcareCategory.find({ isActive: true }).select(CATEGORY_FIELDS).lean(),
    sources.HealthcareSpecialty.find({ isActive: true }).select(SPECIALTY_FIELDS).lean(),
    sources.HealthcareCondition.find({ isActive: true }).select(CONDITION_FIELDS).lean(),
    sources.Enrollment.aggregate(publicDoctorsPipeline(sources.Doctor.collection.name)),
  ]);

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
      aliases: textList(specialty.aliases, 30, 60),
      isActive: true,
    }));
  const specialtyById = Object.fromEntries(specialties.map((specialty) => [specialty._id, specialty]));

  const conditions = rawConditions
    .filter((condition) => condition.isActive === true && specialtyById[idString(condition.specialtyId)])
    .filter((condition) => text(condition.name, 120))
    .map((condition) => ({
      _id: idString(condition._id),
      specialtyId: idString(condition.specialtyId),
      name: text(condition.name, 120),
      description: text(condition.description, 1000),
      icon: text(condition.icon, 500),
      aliases: textList(condition.aliases, 30, 60),
      kind: condition.kind === "service" ? "service" : "condition",
      // Migration traceability only; never part of a search response.
      legacyId: text(condition.legacyId, 80),
      slug: text(condition.slug, 140),
      route: text(condition.route, 200),
      isActive: true,
    }));

  const doctors = rawDoctors.map(toPublicDoctor).filter(Boolean);
  const blogs = (sources.blogs || []).map(toPublicBlog).filter(Boolean);

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
    inflight = buildSearchCatalog()
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
