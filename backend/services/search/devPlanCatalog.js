// DEVELOPMENT-ONLY, in-memory overlay of the PR8 planned taxonomy.
//
// Lets a local search endpoint (and the real React UI) see the planned PR8
// condition/service records and planned specialty aliases WITHOUT writing
// anything to MongoDB. It reuses the committed migration plan
// (scripts/searchTaxonomy/searchTaxonomyMigrationPlan.json) - no second copy of
// the taxonomy exists.
//
// Enabled only when BOTH are true:
//   NODE_ENV=development  AND  SEARCH_DEV_PLAN_CATALOG=true
// In any other environment (production included) it is a no-op, and a set flag
// outside development is ignored with a console error. It only affects
// searchCatalog.js: never the appointment tree, booking, admin taxonomy or any
// database. It performs no database access at all.

const path = require("path");

const FLAG = "SEARCH_DEV_PLAN_CATALOG";
const PLAN_FILE = path.join(__dirname, "..", "..", "scripts", "searchTaxonomy", "searchTaxonomyMigrationPlan.json");

function isDevPlanOverlayEnabled(env = process.env) {
  const requested = env[FLAG] === "true";
  if (!requested) return false;
  if (env.NODE_ENV !== "development") {
    console.error(`[search] ${FLAG}=true ignored: it only works when NODE_ENV=development.`);
    return false;
  }
  return true;
}

// The overlay content, read from the committed plan (conditions + services and
// the planned specialty alias additions).
function loadPlanOverlay(plan = require(PLAN_FILE)) {
  const ops = plan.operations || [];
  return {
    conditions: ops
      .filter((o) => o.op === "CREATE_CONDITION")
      .map((o) => ({ categoryName: o.categoryName, specialtyName: o.specialtyName, document: o.document })),
    specialtyAliases: ops
      .filter((o) => o.op === "SET_SPECIALTY_ALIASES")
      .map((o) => ({ specialtyName: o.specialtyName, aliases: o.update.$addToSet.aliases.$each })),
  };
}

// Pure merge over the raw rows the catalog already read from MongoDB. Planned
// conditions are attached to the LIVE specialty with the same name in the same
// category (never by planned ids). A planned record is skipped if the live
// specialty is missing or a live condition with that name already exists there.
// Returns new arrays; inputs are not mutated.
function applyPlanOverlay({ rawCategories, rawSpecialties, rawConditions }, overlay) {
  const categoryByName = new Map(rawCategories.map((c) => [c.name, c]));
  const specialtyKey = (categoryName, specialtyName) => {
    const category = categoryByName.get(categoryName);
    return category ? rawSpecialties.find((s) => s.name === specialtyName && String(s.categoryId) === String(category._id)) : undefined;
  };

  const aliasAdds = new Map(overlay.specialtyAliases.map((a) => [a.specialtyName, a.aliases]));
  const specialties = rawSpecialties.map((s) =>
    aliasAdds.has(s.name)
      ? { ...s, aliases: [...new Set([...(Array.isArray(s.aliases) ? s.aliases : []), ...aliasAdds.get(s.name)])] }
      : s,
  );

  const existing = new Set(rawConditions.map((c) => `${String(c.specialtyId)}|${String(c.name).trim().toLowerCase()}`));
  const added = [];
  const skipped = [];
  for (const { categoryName, specialtyName, document } of overlay.conditions) {
    const specialty = specialtyKey(categoryName, specialtyName);
    const key = specialty ? `${String(specialty._id)}|${document.name.trim().toLowerCase()}` : null;
    if (!specialty || existing.has(key)) {
      skipped.push(document.legacyId);
      continue; // eslint-disable-line no-continue
    }
    added.push({ ...document, _id: `devplan-${document.legacyId}`, specialtyId: specialty._id, icon: "", description: "" });
  }
  return { rawSpecialties: specialties, rawConditions: [...rawConditions, ...added], added: added.length, skipped };
}

module.exports = { isDevPlanOverlayEnabled, loadPlanOverlay, applyPlanOverlay, FLAG, PLAN_FILE };
