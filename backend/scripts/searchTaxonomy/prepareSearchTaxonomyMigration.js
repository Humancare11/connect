// DRY-RUN ONLY: search-taxonomy migration planner (PR 4).
//
// Reads the live taxonomy (categories, specialties, conditions), the public
// doctor specialization counts and the legacy frontend searchIndex.js, applies
// the approved decisions in ./searchTaxonomyDecisions.js, detects collisions
// and prints/saves the exact operations a FUTURE migration would perform.
//
// It NEVER writes to MongoDB:
//   - a driver-level guard is installed before connecting; every write method
//     (insert/update/replace/delete/findOneAnd*/bulkWrite, create/drop index,
//     create/drop/rename collection, dropDatabase, write commands, and
//     aggregate $out/$merge) THROWS and is recorded, so the run stops;
//   - Mongoose autoIndex and autoCreate are disabled;
//   - only find / aggregate (read stages) / listIndexes / listCollections run.
// The only file written is the plan JSON (see --plan-out).
//
// Usage (from backend/):
//   node scripts/searchTaxonomy/prepareSearchTaxonomyMigration.js [--quiet] [--plan-out <file>]
// Flags that imply execution (--apply, --execute, --write, --commit) are refused.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { pathToFileURL } = require("url");

const { slugify } = require("../../utils/slugify");
const { normalizeForMatch } = require("../../services/search/queryNormalizer");
const { DOCTOR_SPECIALIZATION_MAP } = require("../../services/search/searchConstants");
const decisions = require("./searchTaxonomyDecisions");
const { installWriteGuard, DatabaseWriteBlockedError } = require("./dbWriteGuard");

const BACKEND_DIR = path.resolve(__dirname, "..", "..");
const REPO_DIR = path.resolve(BACKEND_DIR, "..");
const LEGACY_INDEX_FILE = path.join(REPO_DIR, "frontend", "src", "data", "searchIndex.js");
const APP_ROUTES_FILE = path.join(REPO_DIR, "frontend", "src", "App.jsx");
const DECISIONS_FILE = path.join(__dirname, "searchTaxonomyDecisions.js");
const DEFAULT_PLAN_FILE = path.join(__dirname, "searchTaxonomyMigrationPlan.json");

const CLASSIFICATIONS = ["EXACT", "NAME_VARIATION", "CLEAR_SEMANTIC_MATCH", "NEEDS_REVIEW", "INSUFFICIENT_DATA"];
const EXECUTION_FLAGS = ["--apply", "--execute", "--write", "--commit"];

const rel = (file) => path.relative(REPO_DIR, file).split(path.sep).join("/");
const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");
const lower = (value) => String(value).trim().toLowerCase();
const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// ── Sources ─────────────────────────────────────────────────────────────────

async function loadLegacyIndex() {
  const text = fs.readFileSync(LEGACY_INDEX_FILE, "utf8");
  const mod = await import(pathToFileURL(LEGACY_INDEX_FILE).href);
  return {
    categories: mod.categories,
    specialties: mod.specialties,
    conditions: mod.conditions,
    source: { path: rel(LEGACY_INDEX_FILE), sha256: sha256(text) },
  };
}

// Static, absolute route paths declared in App.jsx (all routes there are flat).
function loadAppRoutes() {
  const text = fs.readFileSync(APP_ROUTES_FILE, "utf8");
  const paths = new Set();
  for (const match of text.matchAll(/path="([^"]+)"/g)) {
    if (match[1].startsWith("/") && !/[:*]/.test(match[1])) paths.add(match[1]);
  }
  return { paths, source: { path: rel(APP_ROUTES_FILE), sha256: sha256(text), staticRoutes: paths.size } };
}

async function readLiveState(db, models) {
  const { HealthcareCategory, HealthcareSpecialty, HealthcareCondition } = models;
  const collection = (model) => db.collection(model.collection.collectionName);
  const str = (id) => (id == null ? null : String(id));

  const [categories, specialties, conditions, conditionIndexes, specialtyIndexes] = await Promise.all([
    collection(HealthcareCategory).find({}, { projection: { name: 1, isActive: 1 } }).toArray(),
    collection(HealthcareSpecialty)
      .find({}, { projection: { name: 1, isActive: 1, categoryId: 1, aliases: 1 } })
      .toArray(),
    collection(HealthcareCondition)
      .find({}, { projection: { name: 1, isActive: 1, specialtyId: 1, legacyId: 1, slug: 1, kind: 1, aliases: 1, route: 1 } })
      .toArray(),
    collection(HealthcareCondition).listIndexes().toArray(),
    collection(HealthcareSpecialty).listIndexes().toArray(),
  ]);

  // Doctor data: counts only (no names or contact fields are read out).
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  let doctorRows = null;
  if (existing.has("enrollments") && existing.has("doctors")) {
    doctorRows = await db
      .collection("enrollments")
      .aggregate([
        { $match: { approvalStatus: "approved" } },
        {
          $lookup: {
            from: "doctors",
            localField: "doctorId",
            foreignField: "_id",
            as: "account",
            pipeline: [{ $project: { _id: 0, doctorId: 1, accountDisabled: 1 } }],
          },
        },
        {
          $project: {
            _id: 0,
            specialization: 1,
            linked: { $gt: [{ $size: "$account" }, 0] },
            publicId: { $isNumber: { $arrayElemAt: ["$account.doctorId", 0] } },
            disabled: { $eq: [{ $arrayElemAt: ["$account.accountDisabled", 0] }, true] },
          },
        },
      ])
      .toArray();
  }

  return {
    database: db.databaseName,
    categories: categories.map((c) => ({ _id: str(c._id), name: c.name, isActive: c.isActive !== false })),
    specialties: specialties.map((s) => ({
      _id: str(s._id),
      name: s.name,
      categoryId: str(s.categoryId),
      isActive: s.isActive !== false,
      aliases: Array.isArray(s.aliases) ? s.aliases : [],
    })),
    conditions: conditions.map((c) => ({
      _id: str(c._id),
      name: c.name,
      specialtyId: str(c.specialtyId),
      isActive: c.isActive !== false,
      legacyId: c.legacyId || null,
      slug: c.slug || "",
      kind: c.kind || null,
    })),
    indexes: {
      healthcareconditions: conditionIndexes.map((i) => i.name),
      healthcarespecialties: specialtyIndexes.map((i) => i.name),
    },
    doctorRows,
  };
}

// ── Plan builder (pure: no I/O) ─────────────────────────────────────────────

function specialtyFromRoute(route) {
  const segments = String(route || "").split("/").filter(Boolean);
  if (segments.length >= 2 && decisions.ROUTE_SECTION_TO_SPECIALTY[segments[0]]) {
    return decisions.ROUTE_SECTION_TO_SPECIALTY[segments[0]];
  }
  if (segments.length >= 3) return decisions.ROUTE_SPECIALTY_SEGMENT_TO_LIVE[segments[1]] || null;
  return null;
}

const defaultIndexName = (fields) => Object.entries(fields).map(([k, v]) => `${k}_${v}`).join("_");

function buildPlan({ legacy, appRoutes, live, conditionSchemaIndexes }) {
  const fatal = [];
  const warnings = [];

  // Live lookups.
  const categoryById = new Map(live.categories.map((c) => [c._id, c]));
  const categoryByName = new Map(live.categories.map((c) => [c.name, c]));
  const specialtiesByName = new Map();
  for (const s of live.specialties) {
    if (!specialtiesByName.has(s.name)) specialtiesByName.set(s.name, []);
    specialtiesByName.get(s.name).push(s);
  }
  for (const [name, list] of specialtiesByName) {
    if (list.length > 1) fatal.push(`Live specialty name "${name}" is not unique (${list.length}); name lookup is ambiguous.`);
  }
  const liveSpecialty = (name) => (specialtiesByName.get(name) || [])[0] || null;
  const newSpecialtyNames = new Set(decisions.NEW_SPECIALTIES.map((s) => s.name));
  const categoryNameOfSpecialty = (name) => {
    const spec = liveSpecialty(name);
    if (spec) return categoryById.get(spec.categoryId)?.name || null;
    return decisions.NEW_SPECIALTIES.find((s) => s.name === name)?.category || null;
  };

  // Legacy lookups + decision integrity (every decision must hit a legacy
  // record with the expected title).
  const legacyById = new Map();
  const duplicateLegacyIds = [];
  for (const rec of legacy.conditions) {
    if (legacyById.has(rec.id)) duplicateLegacyIds.push(rec.id);
    legacyById.set(rec.id, rec);
  }
  const legacySpecialtyById = new Map(legacy.specialties.map((s) => [s.id, s]));
  const decisionTables = {
    APPROVED_SPECIALTY_DECISIONS: decisions.APPROVED_SPECIALTY_DECISIONS,
    SERVICES: decisions.SERVICES,
    MERGES: decisions.MERGES,
    CANONICAL_RENAMES: decisions.CANONICAL_RENAMES,
  };
  for (const [table, entries] of Object.entries(decisionTables)) {
    for (const [id, entry] of Object.entries(entries)) {
      const rec = legacyById.get(id);
      if (!rec) fatal.push(`${table}: legacy id "${id}" not found in searchIndex.js.`);
      else if (rec.title !== entry.legacyTitle) {
        fatal.push(`${table}: legacy id "${id}" has title "${rec.title}", expected "${entry.legacyTitle}".`);
      }
      if (entry.specialty && !liveSpecialty(entry.specialty) && !newSpecialtyNames.has(entry.specialty)) {
        fatal.push(`${table}: "${id}" targets unknown specialty "${entry.specialty}".`);
      }
    }
  }
  for (const [id, merge] of Object.entries(decisions.MERGES)) {
    if (!legacyById.has(merge.into)) fatal.push(`MERGES: canonical "${merge.into}" for "${id}" not found.`);
  }
  for (const ids of [decisions.APPROVED_EXTRA_CONDITION_ALIASES, decisions.EXPECTED_CONDITION_ALIASES]) {
    for (const id of Object.keys(ids)) if (!legacyById.has(id)) fatal.push(`Alias decision for unknown legacy id "${id}".`);
  }
  for (const pair of decisions.KEEP_SEPARATE) {
    for (const id of [pair.a, pair.b]) {
      if (!id.startsWith("live:") && !legacyById.has(id)) fatal.push(`KEEP_SEPARATE: unknown legacy id "${id}".`);
    }
  }
  // The doctor mapping must agree with the search backend's map (PR 3).
  for (const [raw, mapped] of Object.entries(DOCTOR_SPECIALIZATION_MAP)) {
    if (decisions.DOCTOR_SPECIALIZATION_TO_SPECIALTY[raw] !== mapped) {
      fatal.push(`Doctor mapping "${raw}" differs from services/search/searchConstants.js.`);
    }
  }

  // Legacy category / specialty records: mapping report only (they exist live).
  const legacyCategoryMap = legacy.categories.map((c) => {
    const liveName = decisions.LEGACY_CATEGORY_TO_LIVE[c.id] || null;
    if (!liveName || !categoryByName.has(liveName)) fatal.push(`Legacy category "${c.id}" has no live category.`);
    return { legacyId: c.id, legacyTitle: c.title, liveCategory: liveName, liveCategoryId: categoryByName.get(liveName)?._id || null };
  });
  const legacySpecialtyMap = legacy.specialties.map((s) => {
    const liveName = decisions.LEGACY_SPECIALTY_TO_LIVE[s.id] || null;
    const spec = liveName && liveSpecialty(liveName);
    if (!spec) fatal.push(`Legacy specialty "${s.id}" has no live specialty.`);
    const legacyCategory = decisions.LEGACY_CATEGORY_TO_LIVE[s.category] || null;
    const liveCategory = spec ? categoryById.get(spec.categoryId)?.name || null : null;
    if (spec && legacyCategory !== liveCategory) {
      warnings.push(`Legacy specialty "${s.id}" category "${s.category}" ≠ live category "${liveCategory}".`);
    }
    const approved = decisions.APPROVED_SPECIALTY_ALIASES[liveName] || [];
    const approvedKeys = new Set(approved.map(normalizeForMatch));
    const candidateKeywords = (s.keywords || []).filter(
      (k) => normalizeForMatch(k) !== normalizeForMatch(liveName) && !approvedKeys.has(normalizeForMatch(k)),
    );
    return {
      legacyId: s.id,
      legacyTitle: s.title,
      liveSpecialty: liveName,
      liveSpecialtyId: spec?._id || null,
      match: spec && lower(s.title) === lower(liveName) ? "EXACT" : "NAME_VARIATION",
      unappliedLegacyKeywords: candidateKeywords,
    };
  });

  // ── Classify and resolve every legacy condition record.
  const records = legacy.conditions.map((rec) => {
    const legacySpecialtyName = rec.specialty ? decisions.LEGACY_SPECIALTY_TO_LIVE[rec.specialty] || null : null;
    if (rec.specialty && !legacySpecialtyName) fatal.push(`Condition "${rec.id}" has unmapped legacy specialty "${rec.specialty}".`);
    const legacyCategoryName = decisions.LEGACY_CATEGORY_TO_LIVE[rec.category] || null;
    if (!legacyCategoryName) fatal.push(`Condition "${rec.id}" has unmapped legacy category "${rec.category}".`);
    const routeSpecialty = specialtyFromRoute(rec.route);

    // Data-derived classification (independent of the approved decisions).
    let classification;
    const reasons = [];
    if (legacySpecialtyName) {
      if (categoryNameOfSpecialty(legacySpecialtyName) !== legacyCategoryName) {
        reasons.push(`legacy category "${legacyCategoryName}" ≠ category of specialty "${legacySpecialtyName}"`);
      }
      if (routeSpecialty && routeSpecialty !== legacySpecialtyName) {
        reasons.push(`route implies "${routeSpecialty}", specialty field says "${legacySpecialtyName}"`);
      }
      const legacySpecialtyTitle = legacySpecialtyById.get(rec.specialty)?.title || "";
      if (reasons.length) classification = "NEEDS_REVIEW";
      else if (lower(legacySpecialtyTitle) !== lower(legacySpecialtyName) || decisions.CANONICAL_RENAMES[rec.id]) {
        classification = "NAME_VARIATION";
        if (lower(legacySpecialtyTitle) !== lower(legacySpecialtyName)) {
          reasons.push(`specialty "${legacySpecialtyTitle}" → "${legacySpecialtyName}"`);
        }
        if (decisions.CANONICAL_RENAMES[rec.id]) reasons.push(`name → "${decisions.CANONICAL_RENAMES[rec.id].name}"`);
      } else classification = "EXACT";
    } else if (routeSpecialty) {
      if (categoryNameOfSpecialty(routeSpecialty) === legacyCategoryName) {
        classification = "CLEAR_SEMANTIC_MATCH";
        reasons.push(`no specialty field; route implies "${routeSpecialty}" in the same category`);
      } else {
        classification = "NEEDS_REVIEW";
        reasons.push(`no specialty field; route implies "${routeSpecialty}" but legacy category is "${legacyCategoryName}"`);
      }
    } else {
      classification = "INSUFFICIENT_DATA";
      reasons.push("no specialty field and no specialty in route");
    }

    // Resolution against the approved decisions.
    let decision = "EXCLUDE";
    let targetSpecialty = null;
    let basis = null;
    let kind = "condition";
    let mergeInto = null;
    const service = decisions.SERVICES[rec.id];
    const approved = decisions.APPROVED_SPECIALTY_DECISIONS[rec.id];
    if (decisions.MERGES[rec.id]) {
      decision = "MERGE";
      mergeInto = decisions.MERGES[rec.id].into;
      basis = "approved-merge";
    } else if (service) {
      decision = "IMPORT";
      targetSpecialty = service.specialty;
      kind = "service";
      basis = "approved-service";
    } else if (approved) {
      decision = "IMPORT";
      targetSpecialty = approved.specialty;
      basis = approved.basis;
    } else if (classification === "EXACT" || classification === "NAME_VARIATION") {
      decision = "IMPORT";
      targetSpecialty = legacySpecialtyName;
      basis = classification.toLowerCase();
    }
    // A CLEAR_SEMANTIC_MATCH without an approved decision stays excluded.
    if ((approved || service) && (classification === "EXACT" || classification === "NAME_VARIATION")) {
      warnings.push(`Decision overrides a clean ${classification} record: "${rec.id}".`);
    }
    if (approved && classification === "CLEAR_SEMANTIC_MATCH" && approved.specialty !== routeSpecialty) {
      fatal.push(`"${rec.id}": approved specialty "${approved.specialty}" ≠ route specialty "${routeSpecialty}".`);
    }

    const name = decisions.CANONICAL_RENAMES[rec.id]?.name || rec.title;
    return {
      legacyId: rec.id,
      legacyTitle: rec.title,
      legacyCategory: rec.category,
      legacySpecialty: rec.specialty || null,
      legacyRoute: rec.route || "",
      keywords: rec.keywords || [],
      classification,
      classificationReasons: reasons,
      decision,
      excludeReason: decision === "EXCLUDE" ? classification : null,
      basis,
      mergeInto,
      name,
      kind,
      targetSpecialty,
      routeSpecialty,
    };
  });
  const recordById = new Map(records.map((r) => [r.legacyId, r]));

  // ── Aliases, slug, route for importable records.
  const aliasDrops = [];
  const buildAliases = (rec) => {
    const candidates = [];
    for (const k of rec.keywords) candidates.push({ text: k, source: "legacy-keyword" });
    for (const k of decisions.APPROVED_EXTRA_CONDITION_ALIASES[rec.legacyId] || []) {
      candidates.push({ text: k, source: "pr4-approved" });
    }
    for (const merged of records.filter((m) => m.decision === "MERGE" && m.mergeInto === rec.legacyId)) {
      candidates.push({ text: merged.legacyTitle, source: `merge:${merged.legacyId}` });
      for (const k of merged.keywords) candidates.push({ text: k, source: `merge:${merged.legacyId}` });
    }
    const nameKey = normalizeForMatch(rec.name);
    const seen = new Map();
    for (const { text, source } of candidates) {
      const alias = lower(text).replace(/\s+/g, " ");
      const key = normalizeForMatch(alias);
      if (!key) {
        aliasDrops.push({ legacyId: rec.legacyId, alias, reason: "EMPTY_AFTER_NORMALIZATION" });
      } else if (key === nameKey) {
        aliasDrops.push({ legacyId: rec.legacyId, alias, reason: "DUPLICATES_CANONICAL_NAME" });
      } else if (seen.has(key)) {
        seen.get(key).sources.push(source);
      } else {
        seen.set(key, { alias, sources: [source] });
      }
    }
    return [...seen.values()];
  };

  for (const rec of records) {
    if (rec.decision !== "IMPORT") continue; // eslint-disable-line no-continue
    rec.aliasDetails = buildAliases(rec);
    rec.aliases = rec.aliasDetails.map((a) => a.alias);
    rec.slug = slugify(rec.name);
    rec.routeStatus = appRoutes.has(rec.legacyRoute) ? "FOUND_IN_APP" : "NOT_FOUND_IN_APP";
    rec.route = rec.routeStatus === "FOUND_IN_APP" ? rec.legacyRoute : "";
    rec.routeSpecialtyMismatch = Boolean(rec.routeSpecialty && rec.routeSpecialty !== rec.targetSpecialty);
    rec.targetCategory = categoryNameOfSpecialty(rec.targetSpecialty);
    rec.targetSpecialtyId = liveSpecialty(rec.targetSpecialty)?._id || null;
  }
  for (const rec of records.filter((r) => r.decision === "MERGE")) {
    const canonical = recordById.get(rec.mergeInto);
    if (!canonical || canonical.decision !== "IMPORT") {
      fatal.push(`Merge target "${rec.mergeInto}" for "${rec.legacyId}" is not being imported.`);
    }
  }
  for (const [id, expected] of Object.entries(decisions.EXPECTED_CONDITION_ALIASES)) {
    const rec = recordById.get(id);
    const have = new Set((rec?.aliases || []).map(normalizeForMatch));
    for (const alias of expected) {
      if (!have.has(normalizeForMatch(alias))) fatal.push(`Expected alias "${alias}" missing on "${id}".`);
    }
  }

  // ── Collision detection.
  const collisions = [];
  const collide = (check, blocking, detail, legacyIds = []) => collisions.push({ check, blocking, detail, legacyIds });
  const importing = () => records.filter((r) => r.decision === "IMPORT");
  const keepSeparateStatus = (x, y) =>
    decisions.KEEP_SEPARATE.find((p) => (p.a === x && p.b === y) || (p.a === y && p.b === x))?.status || null;

  // A. duplicate canonical names within a specialty (collation en/2 ≈ case-insensitive).
  const groupBy = (list, keyFn) => {
    const map = new Map();
    for (const item of list) {
      const key = keyFn(item);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
    return map;
  };
  for (const [key, group] of groupBy(importing(), (r) => `${r.targetSpecialty}|${lower(r.name)}`)) {
    if (group.length > 1) collide("A_DUPLICATE_NAME_IN_SPECIALTY", true, key, group.map((r) => r.legacyId));
  }
  // B. duplicate aliases within a specialty, and aliases equal to a sibling's name.
  for (const [specialty, group] of groupBy(importing(), (r) => r.targetSpecialty)) {
    const aliasOwners = new Map();
    for (const r of group) {
      for (const alias of r.aliases) {
        const key = normalizeForMatch(alias);
        if (!aliasOwners.has(key)) aliasOwners.set(key, []);
        aliasOwners.get(key).push(r.legacyId);
      }
    }
    for (const [key, owners] of aliasOwners) {
      if (owners.length > 1) {
        const status = owners.length === 2 ? keepSeparateStatus(owners[0], owners[1]) : null;
        collide("B_DUPLICATE_ALIAS_IN_SPECIALTY", false, `${specialty}: "${key}" shared${status ? ` (${status})` : ""}`, owners);
      }
      const sibling = group.find((r) => normalizeForMatch(r.name) === key);
      if (sibling) {
        for (const owner of owners.filter((o) => o !== sibling.legacyId)) {
          const status = keepSeparateStatus(owner, sibling.legacyId);
          collide(
            "B_ALIAS_EQUALS_SIBLING_NAME",
            false,
            `${specialty}: alias "${key}" on "${owner}" = name of "${sibling.legacyId}"${status ? ` (${status})` : ""}`,
            [owner, sibling.legacyId],
          );
        }
      }
    }
  }
  // C. the same legacyId mapped to more than one record.
  for (const id of duplicateLegacyIds) collide("C_DUPLICATE_LEGACY_ID", true, id, [id]);
  // D. duplicate slugs within a specialty.
  for (const [key, group] of groupBy(importing(), (r) => `${r.targetSpecialty}|${r.slug}`)) {
    if (group.length > 1) collide("D_DUPLICATE_SLUG_IN_SPECIALTY", true, key, group.map((r) => r.legacyId));
  }
  // E. conflicts with existing live records.
  for (const r of importing()) {
    for (const c of live.conditions) {
      if (c.specialtyId === r.targetSpecialtyId && lower(c.name) === lower(r.name)) {
        collide("E_LIVE_NAME_CONFLICT", true, `"${r.name}" already exists live in ${r.targetSpecialty} (${c._id})`, [r.legacyId]);
      } else if (lower(c.name) === lower(r.name)) {
        collide("E_LIVE_NAME_ELSEWHERE", false, `"${r.name}" also exists live under another specialty id ${c.specialtyId} (${c._id}); no unique-index conflict`, [r.legacyId]);
      }
      if (c.legacyId && c.legacyId === r.legacyId) {
        collide("E_LIVE_LEGACY_ID_CONFLICT", true, `legacyId "${r.legacyId}" already used by ${c._id}`, [r.legacyId]);
      }
      if (c.slug && c.specialtyId === r.targetSpecialtyId && c.slug === r.slug) {
        collide("E_LIVE_SLUG_CONFLICT", true, `slug "${r.slug}" already used in ${r.targetSpecialty} by ${c._id}`, [r.legacyId]);
      }
    }
  }
  for (const ns of decisions.NEW_SPECIALTIES) {
    const cat = categoryByName.get(ns.category);
    for (const s of live.specialties.filter((x) => lower(x.name) === lower(ns.name))) {
      const sameCategory = cat && s.categoryId === cat._id;
      collide(sameCategory ? "E_LIVE_SPECIALTY_CONFLICT" : "E_LIVE_SPECIALTY_NAME_ELSEWHERE", sameCategory, `specialty "${ns.name}" exists live (${s._id})`);
    }
  }
  // F. existing active records that would be renamed: evaluated on the
  // generated operations below (no operation may target an existing name).
  // G. parent specialty missing; H. parent category missing / inactive.
  for (const r of importing()) {
    if (!liveSpecialty(r.targetSpecialty) && !newSpecialtyNames.has(r.targetSpecialty)) {
      collide("G_PARENT_SPECIALTY_MISSING", true, `"${r.legacyId}" → "${r.targetSpecialty}"`, [r.legacyId]);
    }
    const catName = categoryNameOfSpecialty(r.targetSpecialty);
    if (!catName || !categoryByName.get(catName)?.isActive) {
      collide("H_PARENT_CATEGORY_MISSING", true, `"${r.legacyId}" → category "${catName}"`, [r.legacyId]);
    }
  }
  for (const ns of decisions.NEW_SPECIALTIES) {
    if (!categoryByName.has(ns.category)) collide("H_PARENT_CATEGORY_MISSING", true, `new specialty "${ns.name}" → "${ns.category}"`);
  }
  // I. references to new (not yet created) specialties.
  for (const r of importing().filter((x) => newSpecialtyNames.has(x.targetSpecialty))) {
    collide("I_CONDITION_REFERENCES_NEW_SPECIALTY", true, `"${r.legacyId}" → "${r.targetSpecialty}" (specialtyId unknown until created)`, [r.legacyId]);
  }
  // J. services classified as conditions (or vice versa).
  for (const r of records) {
    const isService = Boolean(decisions.SERVICES[r.legacyId]);
    if (r.decision === "IMPORT" && isService !== (r.kind === "service")) {
      collide("J_SERVICE_KIND_MISMATCH", true, `"${r.legacyId}" kind=${r.kind}`, [r.legacyId]);
    }
  }
  for (const id of Object.keys(decisions.SERVICES)) {
    if (recordById.get(id)?.decision !== "IMPORT") collide("J_SERVICE_NOT_IMPORTED", true, `"${id}"`, [id]);
  }

  // Blocking collisions pull the affected records out of the executable plan.
  for (const c of collisions.filter((x) => x.blocking)) {
    for (const id of c.legacyIds) {
      const r = recordById.get(id);
      if (r && r.decision === "IMPORT") {
        r.decision = "EXCLUDE";
        r.excludeReason = `COLLISION:${c.check}`;
      }
    }
  }

  // ── Doctors (planning only).
  const doctorMapping = [];
  let doctorSummary = null;
  if (live.doctorRows) {
    const bySpec = groupBy(live.doctorRows, (d) => d.specialization || "(none)");
    for (const [raw, rows] of [...bySpec].sort((a, b) => b[1].length - a[1].length || byText(a[0], b[0]))) {
      const mapped = decisions.DOCTOR_SPECIALIZATION_TO_SPECIALTY[raw] || null;
      const spec = mapped && liveSpecialty(mapped);
      const isNew = mapped && newSpecialtyNames.has(mapped);
      doctorMapping.push({
        specialization: raw,
        approvedEnrollments: rows.length,
        publicDoctors: rows.filter((d) => d.linked && d.publicId && !d.disabled).length,
        mappedSpecialty: mapped,
        mappingType: !mapped ? "UNMAPPED" : raw === mapped ? "EXACT" : "APPROVED_MAPPING",
        specialtyStatus: spec ? (spec.isActive ? "LIVE_ACTIVE" : "LIVE_INACTIVE") : isNew ? "PLANNED_NEW_INACTIVE" : "MISSING",
      });
      if (!mapped) warnings.push(`Doctor specialization "${raw}" has no approved mapping.`);
      if (isNew) {
        collide("I_DOCTORS_REFERENCE_NEW_SPECIALTY", false, `${rows.length} approved enrollment(s) with "${raw}" → planned inactive "${mapped}"`);
      }
    }
    doctorSummary = {
      approvedEnrollments: live.doctorRows.length,
      linkedDoctorAccounts: live.doctorRows.filter((d) => d.linked).length,
      publicDoctors: live.doctorRows.filter((d) => d.linked && d.publicId && !d.disabled).length,
      approvedWithoutDoctorAccount: live.doctorRows.filter((d) => !d.linked).length,
      disabledAccounts: live.doctorRows.filter((d) => d.disabled).length,
      unlinkedBySpecialization: Object.fromEntries(
        [...groupBy(live.doctorRows.filter((d) => !d.linked), (d) => d.specialization || "(none)")].map(([k, v]) => [k, v.length]),
      ),
    };
  }

  // ── Existing live conditions (never modified).
  const liveSpecialtyIds = new Set(live.specialties.map((s) => s._id));
  const liveConditionStatus = live.conditions.map((c) => {
    const spec = live.specialties.find((s) => s._id === c.specialtyId);
    const cat = spec && categoryById.get(spec.categoryId);
    const inHierarchy = Boolean(c.isActive && spec?.isActive && cat?.isActive);
    return {
      _id: c._id,
      name: c.name,
      specialtyId: c.specialtyId,
      isActive: c.isActive,
      legacyId: c.legacyId,
      slug: c.slug,
      kind: c.kind,
      specialty: spec?.name || null,
      category: cat?.name || null,
      parentExists: liveSpecialtyIds.has(c.specialtyId),
      globalSearch: inHierarchy ? "INCLUDED (active hierarchy)" : "EXCLUDED FROM GLOBAL SEARCH",
      migrationAction: "NO_CHANGE",
      note: decisions.KNOWN_LIVE_CONDITION_NOTES[c.name] || null,
    };
  });
  const liveDuplicateNamePairs = [...groupBy(live.conditions, (c) => `${c.specialtyId}|${lower(c.name)}`)]
    .filter(([, g]) => g.length > 1)
    .map(([k]) => k);

  // ── Operations (never executed here).
  const operations = [];
  const liveIndexNames = new Set(live.indexes.healthcareconditions);
  for (const [fields, options] of conditionSchemaIndexes) {
    const name = options.name || defaultIndexName(fields);
    if (liveIndexNames.has(name)) continue; // eslint-disable-line no-continue
    operations.push({
      op: "CREATE_INDEX",
      phase: 1,
      collection: "healthcareconditions",
      key: fields,
      options,
      precondition:
        name === "uniq_specialty_condition_name"
          ? `no duplicate {specialtyId, lower(name)} pairs (live now: ${liveDuplicateNamePairs.length})`
          : "run after uniq_specialty_condition_name",
    });
  }
  for (const ns of decisions.NEW_SPECIALTIES) {
    const cat = categoryByName.get(ns.category);
    operations.push({
      op: "CREATE_SPECIALTY",
      phase: 2,
      collection: "healthcarespecialties",
      idempotencyKey: { categoryId: cat?._id || null, name: ns.name },
      document: { name: ns.name, categoryId: cat?._id || null, icon: "", description: "", aliases: [], isActive: false },
      categoryName: ns.category,
    });
  }
  const sortKey = (r) => `${r.targetCategory}|${r.targetSpecialty}|${lower(r.name)}`;
  for (const r of importing().sort((a, b) => byText(sortKey(a), sortKey(b)))) {
    operations.push({
      op: "CREATE_CONDITION",
      phase: 3,
      collection: "healthcareconditions",
      idempotencyKey: { legacyId: r.legacyId },
      document: {
        specialtyId: r.targetSpecialtyId,
        name: r.name,
        aliases: r.aliases,
        kind: r.kind,
        legacyId: r.legacyId,
        slug: r.slug,
        route: r.route,
        isActive: false,
      },
      specialtyName: r.targetSpecialty,
      categoryName: r.targetCategory,
      classification: r.classification,
      basis: r.basis,
      legacyRoute: r.legacyRoute,
      routeStatus: r.routeStatus,
    });
  }
  for (const r of records.filter((x) => x.decision === "MERGE").sort((a, b) => byText(a.legacyId, b.legacyId))) {
    const canonical = recordById.get(r.mergeInto);
    operations.push({
      op: "MERGE_ALIAS",
      phase: 3,
      canonical: canonical?.name || null,
      canonicalLegacyId: r.mergeInto,
      alias: lower(r.legacyTitle),
      mergedLegacyId: r.legacyId,
      mergedLegacyRoute: r.legacyRoute,
      write: "none separately: the alias is already inside the canonical CREATE_CONDITION document",
    });
  }
  // K. a specialty alias may belong to one specialty only, and may not be
  // another specialty's name (e.g. "gp" must not sit on two specialties).
  const specialtyAliasOwners = new Map();
  for (const [specName, aliases] of Object.entries(decisions.APPROVED_SPECIALTY_ALIASES)) {
    for (const alias of aliases) {
      const key = normalizeForMatch(alias);
      if (!specialtyAliasOwners.has(key)) specialtyAliasOwners.set(key, new Set());
      specialtyAliasOwners.get(key).add(specName);
    }
  }
  const allSpecialtyNames = [...live.specialties.map((s) => s.name), ...newSpecialtyNames];
  for (const [key, owners] of specialtyAliasOwners) {
    if (owners.size > 1) collide("K_SPECIALTY_ALIAS_ON_MULTIPLE_SPECIALTIES", true, `"${key}" on ${[...owners].join(", ")}`);
    const named = allSpecialtyNames.find((n) => normalizeForMatch(n) === key && !owners.has(n));
    if (named) collide("K_SPECIALTY_ALIAS_EQUALS_OTHER_SPECIALTY", true, `"${key}" on ${[...owners].join(", ")} = name of "${named}"`);
  }

  for (const [specName, aliases] of Object.entries(decisions.APPROVED_SPECIALTY_ALIASES)) {
    const spec = liveSpecialty(specName);
    if (!spec) {
      fatal.push(`APPROVED_SPECIALTY_ALIASES: unknown specialty "${specName}".`);
      continue; // eslint-disable-line no-continue
    }
    const kept = aliases.filter((a) => normalizeForMatch(a) !== normalizeForMatch(specName)).map(lower);
    operations.push({
      op: "SET_SPECIALTY_ALIASES",
      phase: 4,
      collection: "healthcarespecialties",
      filter: { _id: spec._id },
      // The apply step adds these to its filter, so the update matches only
      // if the specialty is still exactly as planned; they are never written.
      expected: { name: spec.name, categoryId: spec.categoryId, isActive: spec.isActive },
      update: { $addToSet: { aliases: { $each: kept } } },
      specialtyName: specName,
      existingAliases: spec.aliases,
      touchesExistingActiveRecord: spec.isActive,
      fieldsTouched: ["aliases"],
      approved: true,
      approvedBy: decisions.SPECIALTY_ALIAS_APPROVAL[specName] || decisions.SPECIALTY_ALIAS_APPROVAL.default,
    });
  }
  for (const r of records.filter((x) => x.decision === "EXCLUDE")) {
    operations.push({ op: "EXCLUDE", phase: 0, legacyId: r.legacyId, legacyTitle: r.legacyTitle, reason: r.excludeReason });
  }

  // F. no operation may rename / re-parent / (de)activate an existing record.
  const touchesProtectedField = operations.filter(
    (o) => o.filter && o.update && Object.values(o.update).some((set) => ["name", "isActive", "categoryId", "specialtyId"].some((f) => f in set)),
  );
  for (const o of touchesProtectedField) collide("F_EXISTING_RECORD_RENAMED", true, `${o.op} on ${o.filter._id}`);

  // ── Counts.
  const countBy = (list, fn) => list.reduce((acc, x) => ((acc[fn(x)] = (acc[fn(x)] || 0) + 1), acc), {});
  const classificationCounts = Object.fromEntries(CLASSIFICATIONS.map((c) => [c, records.filter((r) => r.classification === c).length]));
  const importable = records.filter((r) => r.decision === "IMPORT");
  const counts = {
    legacyRecordsInspected: legacy.categories.length + legacy.specialties.length + legacy.conditions.length,
    legacyCategoryRecords: legacy.categories.length,
    legacySpecialtyRecords: legacy.specialties.length,
    legacyConditionRecords: legacy.conditions.length,
    classification: classificationCounts,
    importable: importable.length,
    importableConditions: importable.filter((r) => r.kind === "condition").length,
    importableServices: importable.filter((r) => r.kind === "service").length,
    excluded: records.filter((r) => r.decision === "EXCLUDE").length,
    canonicalRecords: importable.length,
    aliasMerges: records.filter((r) => r.decision === "MERGE").length,
    serviceRecords: Object.keys(decisions.SERVICES).length,
    newSpecialties: decisions.NEW_SPECIALTIES.length,
    specialtyAliasUpdates: operations.filter((o) => o.op === "SET_SPECIALTY_ALIASES").length,
    indexesToCreate: operations.filter((o) => o.op === "CREATE_INDEX").length,
    totalConditionAliases: importable.reduce((n, r) => n + r.aliases.length, 0),
    aliasesDroppedAsDuplicateOfName: aliasDrops.filter((d) => d.reason === "DUPLICATES_CANONICAL_NAME").length,
    collisionCount: collisions.filter((c) => c.blocking).length,
    warningCount: collisions.filter((c) => !c.blocking).length,
    parentMissingCount: collisions.filter((c) => /^[GH]_/.test(c.check)).length,
    routeConflicts: {
      legacyRouteNotFoundInApp: importable.filter((r) => r.routeStatus === "NOT_FOUND_IN_APP").length,
      routeSpecialtyDiffersFromTarget: importable.filter((r) => r.routeSpecialtyMismatch).length,
      duplicateStoredRoutes: [...groupBy(importable.filter((r) => r.route), (r) => r.route)].filter(([, g]) => g.length > 1).length,
    },
    slugConflicts: collisions.filter((c) => /SLUG/.test(c.check)).length,
    legacyIdConflicts: collisions.filter((c) => /LEGACY_ID/.test(c.check)).length,
    decisionBasis: countBy(importable, (r) => r.basis),
    importableBySpecialty: countBy(importable, (r) => r.targetSpecialty),
  };

  return {
    fatal,
    warnings,
    collisions,
    counts,
    operations,
    records,
    aliasDrops,
    legacyCategoryMap,
    legacySpecialtyMap,
    doctorMapping,
    doctorSummary,
    liveConditionStatus,
    liveDuplicateNamePairs,
  };
}

// Validates every planned document against the Mongoose schemas in memory
// (validate() without save(): no database round-trip for these schemas).
// Any failure is a blocking collision.
async function validatePlannedDocuments(plan, { HealthcareCondition, HealthcareSpecialty, mongoose }) {
  const check = async (doc) => {
    try {
      await doc.validate();
      return null;
    } catch (err) {
      return Object.values(err.errors || {}).map((e) => e.message).join("; ") || err.message;
    }
  };
  for (const o of plan.operations) {
    let error = null;
    if (o.op === "CREATE_CONDITION") error = await check(new HealthcareCondition(o.document));
    else if (o.op === "CREATE_SPECIALTY") error = await check(new HealthcareSpecialty(o.document));
    else if (o.op === "SET_SPECIALTY_ALIASES") {
      const aliases = [...new Set([...o.existingAliases, ...o.update.$addToSet.aliases.$each])];
      error = await check(new HealthcareSpecialty({ name: o.specialtyName, categoryId: new mongoose.Types.ObjectId(), aliases }));
    }
    if (error) {
      const key = JSON.stringify(o.idempotencyKey || o.filter);
      plan.collisions.push({ check: "SCHEMA_VALIDATION", blocking: true, detail: `${o.op} ${key}: ${error}`, legacyIds: [] });
    }
  }
  plan.counts.schemaValidatedDocuments = plan.operations.filter((o) =>
    ["CREATE_CONDITION", "CREATE_SPECIALTY", "SET_SPECIALTY_ALIASES"].includes(o.op),
  ).length;
  plan.counts.collisionCount = plan.collisions.filter((c) => c.blocking).length;
}

// ── Output ──────────────────────────────────────────────────────────────────

function printOperation(o) {
  const show = (label, body) => console.log(`${label}\n${JSON.stringify(body, null, 2)}\n`);
  if (o.op === "CREATE_INDEX") show("CREATE INDEX (not executed)", { collection: o.collection, key: o.key, options: o.options });
  else if (o.op === "CREATE_SPECIALTY") show("CREATE SPECIALTY (not executed)", o.document);
  else if (o.op === "CREATE_CONDITION") show("CREATE CONDITION (not executed)", o.document);
  else if (o.op === "MERGE_ALIAS") show("MERGE / ALIAS (not executed)", { canonical: o.canonical, alias: o.alias, mergedLegacyId: o.mergedLegacyId });
  else if (o.op === "SET_SPECIALTY_ALIASES") show(`SET SPECIALTY ALIASES (not executed; approved: ${o.approvedBy})`, { specialty: o.specialtyName, filter: o.filter, update: o.update });
  else if (o.op === "EXCLUDE") show("EXCLUDE", { legacyId: o.legacyId, reason: o.reason });
}

function printSummary(plan, meta, quiet) {
  const c = plan.counts;
  console.log("\n=== SEARCH TAXONOMY MIGRATION: DRY RUN (nothing executed) ===");
  console.log(`database (read-only): ${meta.database}`);
  console.log(`live: ${meta.liveCounts.categories} categories, ${meta.liveCounts.specialties} specialties, ${meta.liveCounts.conditions} conditions`);
  console.log(`legacy records inspected: ${c.legacyRecordsInspected} (${c.legacyCategoryRecords} categories, ${c.legacySpecialtyRecords} specialties, ${c.legacyConditionRecords} conditions)`);
  console.log("classification:", c.classification);
  console.log(`importable: ${c.importable} (${c.importableConditions} conditions + ${c.importableServices} services) | alias merges: ${c.aliasMerges} | excluded: ${c.excluded}`);
  console.log(`new specialties (inactive): ${c.newSpecialties} | specialty alias updates: ${c.specialtyAliasUpdates} | indexes to create: ${c.indexesToCreate}`);
  console.log(`blocking collisions: ${c.collisionCount} | warnings: ${c.warningCount} | parent missing: ${c.parentMissingCount}`);
  console.log(`slug conflicts: ${c.slugConflicts} | legacyId conflicts: ${c.legacyIdConflicts} | route conflicts:`, c.routeConflicts);
  if (plan.fatal.length) console.log("\nFATAL:\n  " + plan.fatal.join("\n  "));
  if (plan.warnings.length) console.log("\nWarnings:\n  " + plan.warnings.join("\n  "));
  console.log("\nCollisions / warnings:");
  for (const col of plan.collisions) console.log(`  [${col.blocking ? "BLOCKING" : "warning"}] ${col.check}: ${col.detail}`);
  if (!quiet) {
    console.log("\n--- Planned operations (printed only, NOT executed) ---\n");
    plan.operations.forEach(printOperation);
  }
}

function toPlanJson(plan, meta) {
  const operations = plan.operations;
  return {
    planVersion: 1,
    dryRun: true,
    executed: false,
    generatedAt: meta.generatedAt,
    generator: rel(__filename),
    sources: meta.sources,
    liveSnapshot: {
      database: meta.database,
      counts: meta.liveCounts,
      // Every live category/specialty the plan relies on, so the apply step
      // can prove the target still matches (IDs are database-specific).
      categories: meta.liveTaxonomy.categories,
      specialties: meta.liveTaxonomy.specialties,
      indexes: meta.indexes,
      conditions: plan.liveConditionStatus,
      duplicateConditionNamePairs: plan.liveDuplicateNamePairs.length,
    },
    doctors: { summary: plan.doctorSummary, specializationMapping: plan.doctorMapping, recordsModified: 0 },
    counts: plan.counts,
    collisions: plan.collisions,
    warnings: plan.warnings,
    fatal: plan.fatal,
    safety: meta.safety,
    operationsSha256: sha256(JSON.stringify(operations)),
    operations,
    legacyMapping: {
      categories: plan.legacyCategoryMap,
      specialties: plan.legacySpecialtyMap,
      conditions: plan.records.map((r) => ({
        legacyId: r.legacyId,
        legacyTitle: r.legacyTitle,
        classification: r.classification,
        reasons: r.classificationReasons,
        decision: r.decision,
        basis: r.basis,
        name: r.name,
        kind: r.kind,
        specialty: r.targetSpecialty,
        category: r.targetCategory || null,
        mergeInto: r.mergeInto,
        legacyRoute: r.legacyRoute,
        routeStatus: r.routeStatus || null,
        routeSpecialtyMismatch: r.routeSpecialtyMismatch || false,
        aliasSources: r.aliasDetails ? Object.fromEntries(r.aliasDetails.map((a) => [a.alias, a.sources])) : null,
      })),
      aliasesDropped: plan.aliasDrops,
    },
  };
}

// ── Main ────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const refused = argv.filter((a) => EXECUTION_FLAGS.includes(a.split("=")[0]));
  if (refused.length) {
    console.error(`Refusing ${refused.join(", ")}: this script is DRY-RUN ONLY and never writes to MongoDB.`);
    process.exit(2);
  }
  const outIndex = argv.indexOf("--plan-out");
  return {
    quiet: argv.includes("--quiet"),
    planOut: outIndex >= 0 ? path.resolve(argv[outIndex + 1]) : DEFAULT_PLAN_FILE,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const mongoose = require("mongoose");
  const guard = installWriteGuard(mongoose);

  require("dotenv").config({
    path: path.resolve(BACKEND_DIR, process.env.NODE_ENV === "production" ? ".env.production" : ".env"),
    quiet: true,
  });
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set.");

  const HealthcareCategory = require("../../models/HealthcareCategory");
  const HealthcareSpecialty = require("../../models/HealthcareSpecialty");
  const HealthcareCondition = require("../../models/HealthcareCondition");

  const [legacy, app] = [await loadLegacyIndex(), loadAppRoutes()];

  let live;
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false });
  try {
    live = await readLiveState(mongoose.connection.db, { HealthcareCategory, HealthcareSpecialty, HealthcareCondition });
  } finally {
    await mongoose.disconnect();
  }

  const plan = buildPlan({
    legacy,
    appRoutes: app.paths,
    live,
    conditionSchemaIndexes: HealthcareCondition.schema.indexes(),
  });
  await validatePlannedDocuments(plan, { HealthcareCondition, HealthcareSpecialty, mongoose });

  const meta = {
    generatedAt: new Date().toISOString(),
    database: live.database,
    liveCounts: { categories: live.categories.length, specialties: live.specialties.length, conditions: live.conditions.length },
    indexes: live.indexes,
    liveTaxonomy: {
      categories: live.categories.map(({ _id, name, isActive }) => ({ _id, name, isActive })),
      specialties: live.specialties.map(({ _id, name, categoryId, isActive, aliases }) => ({ _id, name, categoryId, isActive, aliases })),
    },
    sources: {
      searchIndex: legacy.source,
      appRoutes: app.source,
      decisions: { path: rel(DECISIONS_FILE), sha256: sha256(fs.readFileSync(DECISIONS_FILE, "utf8")) },
    },
    safety: guard.summary(),
  };

  printSummary(plan, meta, args.quiet);
  fs.writeFileSync(args.planOut, `${JSON.stringify(toPlanJson(plan, meta), null, 2)}\n`);

  const s = meta.safety;
  console.log(`\nDatabase write attempts: ${s.writeAttempts} (inserts ${s.inserts}, updates ${s.updates}, deletes ${s.deletes}, index create ${s.indexCreations}, index drop ${s.indexDeletions}, collection create ${s.collectionCreations}, collection drop ${s.collectionDeletions})`);
  console.log(`Plan written to ${rel(args.planOut)} (local file only).`);
  if (plan.fatal.length || plan.counts.collisionCount || s.writeAttempts) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err instanceof DatabaseWriteBlockedError ? `STOPPED: ${err.message}` : err);
    process.exit(1);
  });
}

module.exports = { buildPlan, validatePlannedDocuments, specialtyFromRoute, loadLegacyIndex, loadAppRoutes };
