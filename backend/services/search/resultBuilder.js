// Turns internal matches into the public /api/search response shape.
//
// Every navigation path is derived here from backend-controlled catalog data;
// nothing from the request is ever used as a path.

const { slugify } = require("../../utils/slugify");
const { RESULT_TYPES, RESULT_GROUPS, CATEGORY_LANDING_ROUTES } = require("./searchConstants");
const {
  SPECIALTY_DISCOVERY_ROUTES,
  CONDITION_DISCOVERY_ROUTES,
  DISCOVERY_FALLBACK_ROUTES,
} = require("./discoveryRoutes");

// Mirrors frontend slugifyDoctorName (Findadoctor.jsx) so the path resolves
// through DoctorProfileForUser (/doctors/:slug, leading 5-digit doctorId).
function slugifyDoctorName(name) {
  return (name || "")
    .replace(/^Dr\.?\s*/i, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "doctor";
}

// A stored legacy marketing route is only used when it is a plain same-site
// path (and, for navigation, only when it is a known discovery page).
function safeLegacyRoute(route) {
  if (typeof route !== "string" || !route) return null;
  if (!route.startsWith("/") || route.startsWith("//") || route.includes("..")) return null;
  return /^\/[A-Za-z0-9\-/&_]*$/.test(route) ? route : null;
}

// Search is discovery, not booking: every catalog result opens an existing
// discovery page (see discoveryRoutes.js), falling back up the hierarchy to
// the nearest page that exists. Never an /appointment-booking/ route.
const categoryPath = (category) =>
  CATEGORY_LANDING_ROUTES[category.name] || DISCOVERY_FALLBACK_ROUTES.category;

const specialtyPath = (specialty, category) =>
  SPECIALTY_DISCOVERY_ROUTES[category.name]?.[specialty.name] || CATEGORY_LANDING_ROUTES[category.name];

// Candidates, in order: the stored legacy route, then the page slug (legacyId
// or slugified name) under the specialty page or at the top level. Only paths
// that are known condition pages are accepted.
function conditionPath(condition, specialty, category) {
  const base = specialtyPath(specialty, category);
  const slugs = [condition.legacyId, slugify(condition.name)].filter(Boolean);
  const candidates = [
    safeLegacyRoute(condition.route),
    ...(base ? slugs.map((slug) => `${base}/${slug}`) : []),
    ...slugs.map((slug) => `/${slug}`),
  ];
  return candidates.find((path) => CONDITION_DISCOVERY_ROUTES.has(path)) || base || DISCOVERY_FALLBACK_ROUTES.condition;
}

const BUILDERS = {
  category(category) {
    return {
      type: "category",
      id: category._id,
      title: category.name,
      description: category.description,
      icon: category.icon,
      metadata: {},
      navigation: { type: "category", path: categoryPath(category) },
    };
  },

  specialty(specialty, index) {
    const category = index.categoryById[specialty.categoryId];
    return {
      type: "specialty",
      id: specialty._id,
      title: specialty.name,
      description: specialty.description,
      icon: specialty.icon,
      metadata: { categoryId: category._id, categoryName: category.name },
      navigation: {
        type: "specialty",
        path: specialtyPath(specialty, category) || DISCOVERY_FALLBACK_ROUTES.specialty,
      },
    };
  },

  condition(condition, index, type = "condition") {
    const specialty = index.specialtyById[condition.specialtyId];
    const category = index.categoryById[specialty.categoryId];
    const legacyRoute = safeLegacyRoute(condition.route);
    return {
      type,
      id: condition._id,
      title: condition.name,
      description: condition.description,
      icon: condition.icon,
      metadata: {
        kind: condition.kind,
        specialtyId: specialty._id,
        specialtyName: specialty.name,
        categoryId: category._id,
        categoryName: category.name,
        ...(legacyRoute ? { legacyRoute } : {}),
      },
      navigation: { type, path: conditionPath(condition, specialty, category) },
    };
  },

  // Services (kind "service", e.g. Doctor's Note) share the condition shape,
  // hierarchy and page lookup.
  service(service, index) {
    return BUILDERS.condition(service, index, "service");
  },

  doctor(doctor) {
    const location = [doctor.city, doctor.state, doctor.country].filter(Boolean).join(", ");
    return {
      type: "doctor",
      id: String(doctor.doctorId),
      title: doctor.displayName,
      description: [doctor.specialtyName, location].filter(Boolean).join(" · "),
      metadata: {
        doctorId: doctor.doctorId,
        qualification: doctor.qualification,
        specialization: doctor.specialization,
        specialtyName: doctor.specialtyName,
        subSpecialization: doctor.subSpecialization,
        languages: doctor.languagesKnown,
        city: doctor.city,
        state: doctor.state,
        country: doctor.country,
        experience: doctor.experience,
        gender: doctor.gender,
        consultantFees: doctor.consultantFees,
        feeCurrency: doctor.feeCurrency,
        consultationMode: doctor.consultationMode,
        about: doctor.aboutDoctor,
      },
      navigation: {
        type: "doctor",
        path: `/doctors/${doctor.doctorId}-${slugifyDoctorName(doctor.displayName)}`,
      },
    };
  },

  blog(blog) {
    return {
      type: "blog",
      id: blog.id,
      title: blog.title,
      description: blog.description,
      metadata: { readTime: blog.readTime },
      navigation: { type: "blog", path: blog.path },
    };
  },
};

// matches: output of matchCatalog. Returns { results, total }.
function buildResults(matches, catalog) {
  const results = Object.fromEntries(RESULT_TYPES.map((type) => [RESULT_GROUPS[type], []]));
  let total = 0;
  for (const type of RESULT_TYPES) {
    for (const match of matches[type] || []) {
      results[RESULT_GROUPS[type]].push({
        ...BUILDERS[type](match.record, catalog.index),
        matchedOn: match.matchedOn,
      });
      total += 1;
    }
  }
  return { results, total };
}

module.exports = { buildResults, slugifyDoctorName, safeLegacyRoute };
