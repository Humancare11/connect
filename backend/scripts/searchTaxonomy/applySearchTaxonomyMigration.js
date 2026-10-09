// FUTURE MIGRATION: applies searchTaxonomyMigrationPlan.json to a database.
//
// ⚠️  PREPARED IN PR 4.5 AND NEVER EXECUTED. Do not run it until a
//     NON-PRODUCTION database exists and the plan has been regenerated
//     against it (prepareSearchTaxonomyMigration.js). The plan contains
//     database-specific ObjectIds and is refused on any other database.
//
// Modes
//   (default)  PREFLIGHT ONLY. Connects, re-validates everything and prints
//              what would be written. The write guard allows no write at all.
//   --apply    Preflight, then writes. Requires
//              SEARCH_MIGRATION_CONFIRM="<database>:<first 12 hex of operationsSha256>".
//
// Target
//   SEARCH_MIGRATION_MONGO_URI (required). The app's MONGO_URI is never used
//   implicitly. The URI must name the database explicitly.
//
// Protected targets are refused unless BOTH --allow-protected-database and
// SEARCH_MIGRATION_ALLOW_PROTECTED_DB=<database> are given:
//   - a database name in PROTECTED_DATABASE_NAMES (the live/shared authDB);
//   - the same host(s) + database as the backend's MONGO_URI (.env or .env.production);
//   - NODE_ENV=production.
//
// What it writes (and nothing else)
//   phase "indexes"           healthcareconditions.createIndex × the 3 named indexes (outside the transaction)
//   phase "specialties"       healthcarespecialties.updateOne upsert ($setOnInsert, isActive:false)
//   phase "conditions"        healthcareconditions.updateOne upsert on legacyId ($setOnInsert, isActive:false)
//   phase "specialty-aliases" healthcarespecialties.updateOne $addToSet aliases (filter pins name/categoryId/isActive)
// Phases 2–4 run in ONE transaction where the deployment supports it
// (replica set / sharded). A standalone server is refused unless
// --allow-no-transaction is given (every write is an idempotent upsert, so a
// failed run can be re-run safely).
//
// Never: deletes, renames, isActive changes, doctor/enrollment writes,
// syncIndexes(), dropping any index (legacy ones included). Enforced by the
// driver-level guard in ./dbWriteGuard.js with a write allowlist.
//
// Options: --plan <file>  --phases=indexes,specialties,conditions,specialty-aliases
//          --allow-no-transaction  --report-out <file>  --allow-protected-database
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { installWriteGuard, DatabaseWriteBlockedError } = require("./dbWriteGuard");

const BACKEND_DIR = path.resolve(__dirname, "..", "..");
const REPO_DIR = path.resolve(BACKEND_DIR, "..");
const DEFAULT_PLAN_FILE = path.join(__dirname, "searchTaxonomyMigrationPlan.json");

const PROTECTED_DATABASE_NAMES = ["authdb"]; // lowercase; the live/shared database (audit Q5)
const URI_ENV = "SEARCH_MIGRATION_MONGO_URI";
const CONFIRM_ENV = "SEARCH_MIGRATION_CONFIRM";
const PROTECTED_CONFIRM_ENV = "SEARCH_MIGRATION_ALLOW_PROTECTED_DB";

const PHASES = ["indexes", "specialties", "conditions", "specialty-aliases"];
const CONDITIONS = "healthcareconditions";
const SPECIALTIES = "healthcarespecialties";
const EXPECTED_INDEX_NAMES = ["uniq_specialty_condition_name", "uniq_condition_legacyId", "uniq_specialty_condition_slug"];
const OP_TYPES = new Set(["CREATE_INDEX", "CREATE_SPECIALTY", "CREATE_CONDITION", "MERGE_ALIAS", "SET_SPECIALTY_ALIASES", "EXCLUDE"]);
const NAME_COLLATION = { locale: "en", strength: 2 };

// Writes the guard lets through in --apply mode; everything else throws.
const APPLY_WRITE_ALLOWLIST = {
  [CONDITIONS]: ["createIndex", "updateOne"],
  [SPECIALTIES]: ["updateOne"],
};

const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");
const lower = (value) => String(value ?? "").trim().toLowerCase();
const str = (id) => (id == null ? null : String(id));
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

class MigrationAbort extends Error {
  constructor(message, details = []) {
    super(message);
    this.details = details;
  }
}

// ── Arguments and target safety (pure) ──────────────────────────────────────

function parseArgs(argv) {
  const args = {
    apply: false,
    planFile: DEFAULT_PLAN_FILE,
    phases: new Set(PHASES),
    allowNoTransaction: false,
    allowProtected: false,
    reportOut: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const [flag, inline] = argv[i].split(/=(.*)/s);
    const value = () => (inline !== undefined ? inline : argv[++i]); // eslint-disable-line no-plusplus
    if (flag === "--apply") args.apply = true;
    else if (flag === "--plan") args.planFile = path.resolve(value());
    else if (flag === "--report-out") args.reportOut = path.resolve(value());
    else if (flag === "--allow-no-transaction") args.allowNoTransaction = true;
    else if (flag === "--allow-protected-database") args.allowProtected = true;
    else if (flag === "--phases") {
      const phases = value().split(",").map((p) => p.trim()).filter(Boolean);
      const unknown = phases.filter((p) => !PHASES.includes(p));
      if (unknown.length || !phases.length) throw new MigrationAbort(`Unknown --phases: ${unknown.join(", ") || "(empty)"}`);
      args.phases = new Set(phases);
    } else throw new MigrationAbort(`Unknown argument "${argv[i]}".`);
  }
  return args;
}

// "mongodb[+srv]://[user:pass@]host1,host2/dbName?opts" → { hosts, dbName }.
function parseMongoUri(uri) {
  const match = /^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)(?:\/([^?]*))?/.exec(String(uri || ""));
  if (!match) return null;
  return {
    hosts: match[1].toLowerCase().split(",").sort().join(","),
    dbName: match[2] ? decodeURIComponent(match[2]) : null,
  };
}

// Throws unless the target is allowed. Returns the protection reasons found
// (empty for an ordinary non-production target).
function assertTargetAllowed({ uri, env, args, appUris = [] }) {
  if (!uri) throw new MigrationAbort(`${URI_ENV} is required. The app's MONGO_URI is never used implicitly.`);
  const target = parseMongoUri(uri);
  if (!target) throw new MigrationAbort(`${URI_ENV} is not a MongoDB connection string.`);
  if (!target.dbName) throw new MigrationAbort(`${URI_ENV} must name the target database explicitly (…/<database>).`);

  const reasons = [];
  if (PROTECTED_DATABASE_NAMES.includes(lower(target.dbName))) reasons.push(`database "${target.dbName}" is a protected live/shared database`);
  for (const appUri of appUris) {
    const app = parseMongoUri(appUri);
    if (app && app.hosts === target.hosts && lower(app.dbName) === lower(target.dbName)) {
      reasons.push("target is the backend's own MONGO_URI database");
    }
  }
  if (env.NODE_ENV === "production") reasons.push("NODE_ENV is production");

  if (reasons.length && !(args.allowProtected && env[PROTECTED_CONFIRM_ENV] === target.dbName)) {
    throw new MigrationAbort(
      `Refusing protected target: ${reasons.join("; ")}. A future, explicitly approved run needs --allow-protected-database AND ${PROTECTED_CONFIRM_ENV}=${target.dbName}.`,
    );
  }
  return { dbName: target.dbName, protectedReasons: reasons };
}

function expectedConfirmation(dbName, plan) {
  return `${dbName}:${String(plan.operationsSha256 || "").slice(0, 12)}`;
}

function assertConfirmation(env, dbName, plan) {
  const expected = expectedConfirmation(dbName, plan);
  if (env[CONFIRM_ENV] !== expected) {
    throw new MigrationAbort(`--apply requires ${CONFIRM_ENV}="${expected}" (binds the run to this database and this exact plan).`);
  }
}

// ── Plan integrity (pure) ───────────────────────────────────────────────────

function verifyPlanIntegrity(plan, currentSourceHashes = {}) {
  const errors = [];
  const err = (m) => errors.push(m);
  if (!plan || typeof plan !== "object") return ["Plan is not an object."];
  if (plan.planVersion !== 1) err(`Unsupported planVersion ${plan.planVersion}.`);
  if (plan.dryRun !== true || plan.executed !== false) err("Plan must be a dry-run plan (dryRun: true, executed: false).");
  if ((plan.fatal || []).length) err(`Plan has ${plan.fatal.length} fatal issue(s).`);
  if ((plan.collisions || []).some((c) => c.blocking) || plan.counts?.collisionCount) err("Plan has blocking collisions.");
  if (!Array.isArray(plan.operations)) return [...errors, "Plan has no operations array."];
  if (sha256(JSON.stringify(plan.operations)) !== plan.operationsSha256) err("operationsSha256 does not match the operations (plan edited by hand?).");

  for (const [key, hash] of Object.entries(currentSourceHashes)) {
    if (plan.sources?.[key]?.sha256 !== hash) err(`Source "${key}" changed since the plan was generated; regenerate the plan.`);
  }

  const legacyIds = new Set();
  const conditionOps = new Map();
  for (const o of plan.operations) {
    if (!OP_TYPES.has(o.op)) err(`Unknown operation type "${o.op}".`);
    if (o.collection && ![CONDITIONS, SPECIALTIES].includes(o.collection)) err(`${o.op} targets forbidden collection "${o.collection}".`);
    if (o.document && o.document.isActive !== false) err(`${o.op} ${JSON.stringify(o.idempotencyKey)} is not isActive:false.`);
    if (o.op === "CREATE_INDEX" && !EXPECTED_INDEX_NAMES.includes(o.options?.name)) err(`Unexpected index "${o.options?.name}".`);
    if (o.op === "CREATE_SPECIALTY" && (!o.document?.categoryId || !o.document?.name)) err("CREATE_SPECIALTY without categoryId/name.");
    if (o.op === "CREATE_CONDITION") {
      const d = o.document || {};
      if (!d.specialtyId) err(`CREATE_CONDITION "${d.legacyId}" has no specialtyId (new specialties cannot be referenced).`);
      if (!d.legacyId || d.legacyId !== o.idempotencyKey?.legacyId) err(`CREATE_CONDITION legacyId/idempotencyKey mismatch ("${d.legacyId}").`);
      if (legacyIds.has(d.legacyId)) err(`Duplicate legacyId "${d.legacyId}" in plan.`);
      if (!["condition", "service"].includes(d.kind)) err(`CREATE_CONDITION "${d.legacyId}" has invalid kind "${d.kind}".`);
      // PR 8.1: booking visibility (isActive) stays off; search visibility is a
      // separate flag and may only be on for a record with a stored route.
      if (typeof d.isSearchable !== "boolean") err(`CREATE_CONDITION "${d.legacyId}" must carry a boolean isSearchable.`);
      if (d.isSearchable === true && !(typeof d.route === "string" && d.route.startsWith("/"))) {
        err(`CREATE_CONDITION "${d.legacyId}" is isSearchable but has no stored route.`);
      }
      legacyIds.add(d.legacyId);
      conditionOps.set(d.legacyId, d);
    }
    if (o.op === "SET_SPECIALTY_ALIASES") {
      const each = o.update?.$addToSet?.aliases?.$each;
      const onlyAliases = same(Object.keys(o.update || {}), ["$addToSet"]) && same(Object.keys(o.update.$addToSet), ["aliases"]);
      if (o.approved !== true) err(`SET_SPECIALTY_ALIASES "${o.specialtyName}" is not approved.`);
      if (!onlyAliases || !Array.isArray(each) || !each.every((a) => typeof a === "string")) {
        err(`SET_SPECIALTY_ALIASES "${o.specialtyName}" must only $addToSet string aliases.`);
      }
      if (!same(o.fieldsTouched, ["aliases"])) err(`SET_SPECIALTY_ALIASES "${o.specialtyName}" touches more than aliases.`);
      if (!o.filter?._id || !o.expected?.name || !o.expected?.categoryId || typeof o.expected?.isActive !== "boolean") {
        err(`SET_SPECIALTY_ALIASES "${o.specialtyName}" lacks the expected-state filter.`);
      }
    }
  }
  for (const o of plan.operations.filter((x) => x.op === "MERGE_ALIAS")) {
    const canonical = conditionOps.get(o.canonicalLegacyId);
    if (!canonical || !canonical.aliases.includes(o.alias)) err(`MERGE_ALIAS "${o.alias}" is not inside canonical "${o.canonicalLegacyId}".`);
  }
  const indexOps = plan.operations.filter((o) => o.op === "CREATE_INDEX").map((o) => o.options.name);
  if (indexOps.length !== new Set(indexOps).size) err("Duplicate CREATE_INDEX operations.");
  return errors;
}

// ── Target analysis (pure) ──────────────────────────────────────────────────

const collationKey = (c) => (c ? `${c.locale}/${c.strength}` : null);

function compareIndex(expectedOp, existing) {
  const diffs = [];
  if (!same(existing.key, expectedOp.key)) diffs.push("key");
  if (Boolean(existing.unique) !== Boolean(expectedOp.options.unique)) diffs.push("unique");
  if (collationKey(existing.collation) !== collationKey(expectedOp.options.collation)) diffs.push("collation");
  if (!same(existing.partialFilterExpression, expectedOp.options.partialFilterExpression)) diffs.push("partialFilterExpression");
  return diffs;
}

// target = { databaseName, categories, specialties, conditions, indexes,
//            duplicates: { names, legacyIds, slugs }, transactions: { supported, topology } }
function analyzeTarget(plan, target, { allowNoTransaction = false } = {}) {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);
  const snap = plan.liveSnapshot || {};
  const ops = plan.operations;
  const newSpecOps = ops.filter((o) => o.op === "CREATE_SPECIALTY");
  const condOps = ops.filter((o) => o.op === "CREATE_CONDITION");
  const plannedLegacy = new Map(condOps.map((o) => [o.document.legacyId, o.document]));

  // 1. Target database identity: IDs in the plan belong to one database.
  if (snap.database !== target.databaseName) {
    err(`Plan was generated against "${snap.database}", target is "${target.databaseName}". Regenerate the plan against the target.`);
  }

  // 2. Expected current taxonomy (the snapshot the plan was built from).
  const catById = new Map(target.categories.map((c) => [c._id, c]));
  const specById = new Map(target.specialties.map((s) => [s._id, s]));
  const condById = new Map(target.conditions.map((c) => [c._id, c]));
  for (const c of snap.categories || []) {
    const now = catById.get(c._id);
    if (!now) err(`Category "${c.name}" (${c._id}) from the plan is missing.`);
    else if (now.name !== c.name || now.isActive !== c.isActive) err(`Category ${c._id} changed since planning.`);
  }
  if (target.categories.length !== (snap.categories || []).length) {
    err(`Expected ${(snap.categories || []).length} categories, found ${target.categories.length}.`);
  }
  const plannedSpecAliases = new Map(
    ops.filter((o) => o.op === "SET_SPECIALTY_ALIASES").map((o) => [o.filter._id, o.update.$addToSet.aliases.$each]),
  );
  for (const s of snap.specialties || []) {
    const now = specById.get(s._id);
    if (!now) err(`Specialty "${s.name}" (${s._id}) from the plan is missing.`);
    else if (now.name !== s.name || now.categoryId !== s.categoryId || now.isActive !== s.isActive) {
      err(`Specialty "${s.name}" (${s._id}) changed since planning (name/category/active).`);
    } else {
      const allowedAliases = new Set([...(s.aliases || []), ...(plannedSpecAliases.get(s._id) || [])]);
      const unexpected = (now.aliases || []).filter((a) => !allowedAliases.has(a));
      if (unexpected.length) err(`Specialty "${s.name}" has unplanned aliases: ${unexpected.join(", ")}.`);
    }
  }
  const snapSpecIds = new Set((snap.specialties || []).map((s) => s._id));
  for (const s of target.specialties.filter((x) => !snapSpecIds.has(x._id))) {
    const planned = newSpecOps.find((o) => o.document.categoryId === s.categoryId && lower(o.document.name) === lower(s.name));
    if (!planned) err(`Unexpected specialty "${s.name}" (${s._id}) not in the plan snapshot. Regenerate the plan.`);
    else if (s.isActive !== false) err(`Planned specialty "${s.name}" already exists and is ACTIVE; refusing.`);
  }
  for (const c of snap.conditions || []) {
    const now = condById.get(c._id);
    if (!now) err(`Condition "${c.name}" (${c._id}) from the plan is missing (never deleted by this migration).`);
    else if (now.name !== c.name || now.specialtyId !== c.specialtyId || now.isActive !== c.isActive) {
      err(`Existing condition "${c.name}" (${c._id}) changed since planning.`);
    }
  }
  const snapCondIds = new Set((snap.conditions || []).map((c) => c._id));
  for (const c of target.conditions.filter((x) => !snapCondIds.has(x._id))) {
    if (!c.legacyId || !plannedLegacy.has(c.legacyId)) {
      err(`Unexpected condition "${c.name}" (${c._id}) not in the plan snapshot. Regenerate the plan.`);
    }
  }

  // 3–5. Duplicates already in the target (these would also break the indexes).
  for (const d of target.duplicates.names) err(`Duplicate condition name in one specialty: ${JSON.stringify(d)}.`);
  for (const d of target.duplicates.legacyIds) err(`Duplicate legacyId: ${JSON.stringify(d)}.`);
  for (const d of target.duplicates.slugs) err(`Duplicate slug in one specialty: ${JSON.stringify(d)}.`);

  // 6–7. Per planned condition: specialty reference, legacyId, name and slug conflicts.
  const conditionActions = [];
  for (const o of condOps) {
    const d = o.document;
    const spec = specById.get(d.specialtyId);
    if (!spec) err(`"${d.legacyId}": specialty ${d.specialtyId} does not exist.`);
    else {
      if (spec.name !== o.specialtyName) err(`"${d.legacyId}": specialty ${d.specialtyId} is "${spec.name}", plan expects "${o.specialtyName}".`);
      const cat = catById.get(spec.categoryId);
      if (!cat || cat.name !== o.categoryName) err(`"${d.legacyId}": category of "${spec.name}" is not "${o.categoryName}".`);
    }
    const byLegacy = target.conditions.filter((c) => c.legacyId === d.legacyId);
    if (byLegacy.length > 1) err(`legacyId "${d.legacyId}" exists ${byLegacy.length} times.`);
    const existing = byLegacy[0];
    if (existing) {
      const matches = existing.specialtyId === d.specialtyId && existing.name === d.name && existing.slug === d.slug && existing.kind === d.kind;
      if (!matches) err(`legacyId "${d.legacyId}" already exists (${existing._id}) with different content.`);
      else conditionActions.push({ legacyId: d.legacyId, action: "exists", _id: existing._id, isActive: existing.isActive });
      if (existing.isActive) warnings.push(`"${d.legacyId}" already exists and was activated after migration; left unchanged.`);
    } else {
      conditionActions.push({ legacyId: d.legacyId, action: "insert" });
    }
    for (const c of target.conditions) {
      if (c.legacyId === d.legacyId || c.specialtyId !== d.specialtyId) continue; // eslint-disable-line no-continue
      if (lower(c.name) === lower(d.name)) err(`"${d.legacyId}": name "${d.name}" already used in its specialty by ${c._id}.`);
      if (c.slug && c.slug === d.slug) err(`"${d.legacyId}": slug "${d.slug}" already used in its specialty by ${c._id}.`);
    }
  }

  // New specialties.
  const specialtyActions = [];
  for (const o of newSpecOps) {
    const d = o.document;
    const cat = catById.get(d.categoryId);
    if (!cat || cat.name !== o.categoryName) err(`New specialty "${d.name}": category ${d.categoryId} is not "${o.categoryName}".`);
    const existing = target.specialties.find((s) => s.categoryId === d.categoryId && lower(s.name) === lower(d.name));
    specialtyActions.push(existing ? { name: d.name, action: "exists", _id: existing._id } : { name: d.name, action: "insert" });
  }

  // Specialty alias updates.
  const specialtyAliasActions = [];
  for (const o of ops.filter((x) => x.op === "SET_SPECIALTY_ALIASES")) {
    const now = specById.get(o.filter._id);
    if (!now) continue; // eslint-disable-line no-continue
    if (now.name !== o.expected.name || now.categoryId !== o.expected.categoryId || now.isActive !== o.expected.isActive) {
      err(`Specialty alias target "${o.specialtyName}" no longer matches its expected state.`);
    }
    const add = o.update.$addToSet.aliases.$each.filter((a) => !(now.aliases || []).includes(a));
    if ((now.aliases || []).length + add.length > 30) err(`"${o.specialtyName}" would exceed 30 aliases.`);
    specialtyAliasActions.push({ specialty: o.specialtyName, _id: o.filter._id, add, action: add.length ? "update" : "noop" });
  }

  // 8. Index state.
  const indexActions = [];
  for (const o of ops.filter((x) => x.op === "CREATE_INDEX")) {
    const byName = target.indexes.find((i) => i.name === o.options.name);
    if (byName) {
      const diffs = compareIndex(o, byName);
      if (diffs.length) err(`Index "${o.options.name}" exists with different ${diffs.join(", ")}.`);
      else indexActions.push({ name: o.options.name, action: "exists" });
      continue; // eslint-disable-line no-continue
    }
    const clash = target.indexes.find(
      (i) => same(i.key, o.key) && collationKey(i.collation) === collationKey(o.options.collation),
    );
    if (clash) err(`Index "${clash.name}" already has the key/collation of "${o.options.name}"; createIndex would fail.`);
    else indexActions.push({ name: o.options.name, action: "create" });
  }

  // 9. Transactions.
  if (!target.transactions.supported && !allowNoTransaction) {
    err(`Target (${target.transactions.topology}) does not support transactions; pass --allow-no-transaction to run idempotent writes without one.`);
  }

  const inserts = conditionActions.filter((a) => a.action === "insert").length;
  return {
    errors,
    warnings,
    actions: { indexes: indexActions, specialties: specialtyActions, conditions: conditionActions, specialtyAliases: specialtyAliasActions },
    expectedCounts: {
      before: { categories: target.categories.length, specialties: target.specialties.length, conditions: target.conditions.length },
      after: {
        categories: target.categories.length,
        specialties: target.specialties.length + specialtyActions.filter((a) => a.action === "insert").length,
        conditions: target.conditions.length + inserts,
      },
    },
  };
}

// Documents as they would be stored. isActive is forced false regardless of
// the plan; timestamps mirror what Mongoose would have set.
function buildSpecialtyDocument(planDoc, ObjectId, now) {
  return {
    categoryId: new ObjectId(planDoc.categoryId),
    name: planDoc.name,
    icon: planDoc.icon || "",
    description: planDoc.description || "",
    aliases: [],
    isActive: false,
    createdAt: now,
    updatedAt: now,
    __v: 0,
  };
}

function buildConditionDocument(planDoc, ObjectId, now) {
  return {
    specialtyId: new ObjectId(planDoc.specialtyId),
    name: planDoc.name,
    icon: "",
    description: "",
    aliases: [...planDoc.aliases],
    kind: planDoc.kind,
    legacyId: planDoc.legacyId,
    slug: planDoc.slug,
    route: planDoc.route || "",
    // isActive (booking) is forced false; isSearchable follows the reviewed plan.
    isActive: false,
    isSearchable: planDoc.isSearchable === true,
    createdAt: now,
    updatedAt: now,
    __v: 0,
  };
}

// ── Database I/O ────────────────────────────────────────────────────────────

async function readTarget(db) {
  const col = (name) => db.collection(name);
  const [categories, specialties, conditions, indexes, names, legacyIds, slugs, hello] = await Promise.all([
    col("healthcarecategories").find({}, { projection: { name: 1, isActive: 1 } }).toArray(),
    col(SPECIALTIES).find({}, { projection: { name: 1, categoryId: 1, isActive: 1, aliases: 1 } }).toArray(),
    col(CONDITIONS).find({}, { projection: { name: 1, specialtyId: 1, isActive: 1, legacyId: 1, slug: 1, kind: 1 } }).toArray(),
    col(CONDITIONS).listIndexes().toArray(),
    col(CONDITIONS)
      .aggregate(
        [
          { $group: { _id: { specialtyId: "$specialtyId", name: "$name" }, n: { $sum: 1 }, ids: { $push: "$_id" } } },
          { $match: { n: { $gt: 1 } } },
        ],
        { collation: NAME_COLLATION },
      )
      .toArray(),
    col(CONDITIONS)
      .aggregate([
        { $match: { legacyId: { $gt: "" } } },
        { $group: { _id: "$legacyId", n: { $sum: 1 }, ids: { $push: "$_id" } } },
        { $match: { n: { $gt: 1 } } },
      ])
      .toArray(),
    col(CONDITIONS)
      .aggregate([
        { $match: { slug: { $gt: "" } } },
        { $group: { _id: { specialtyId: "$specialtyId", slug: "$slug" }, n: { $sum: 1 }, ids: { $push: "$_id" } } },
        { $match: { n: { $gt: 1 } } },
      ])
      .toArray(),
    db.admin().command({ hello: 1 }),
  ]);
  const topology = hello.msg === "isdbgrid" ? "sharded" : hello.setName ? "replicaSet" : "standalone";
  return {
    databaseName: db.databaseName,
    categories: categories.map((c) => ({ _id: str(c._id), name: c.name, isActive: c.isActive !== false })),
    specialties: specialties.map((s) => ({
      _id: str(s._id), name: s.name, categoryId: str(s.categoryId), isActive: s.isActive !== false, aliases: s.aliases || [],
    })),
    conditions: conditions.map((c) => ({
      _id: str(c._id), name: c.name, specialtyId: str(c.specialtyId), isActive: c.isActive !== false,
      legacyId: c.legacyId || null, slug: c.slug || "", kind: c.kind || "condition",
    })),
    indexes: indexes.map((i) => ({ name: i.name, key: i.key, unique: i.unique, collation: i.collation, partialFilterExpression: i.partialFilterExpression })),
    duplicates: {
      names: names.map((d) => ({ ...d, ids: d.ids.map(str) })),
      legacyIds: legacyIds.map((d) => ({ ...d, ids: d.ids.map(str) })),
      slugs: slugs.map((d) => ({ ...d, ids: d.ids.map(str) })),
    },
    transactions: { supported: topology !== "standalone" && hello.logicalSessionTimeoutMinutes != null, topology },
  };
}

// Mongoose validation of every document before any write (in memory only).
async function validateDocuments(plan, models, ObjectId, now) {
  const problems = [];
  for (const o of plan.operations) {
    let doc = null;
    if (o.op === "CREATE_CONDITION") doc = new models.HealthcareCondition(buildConditionDocument(o.document, ObjectId, now));
    if (o.op === "CREATE_SPECIALTY") doc = new models.HealthcareSpecialty(buildSpecialtyDocument(o.document, ObjectId, now));
    if (!doc) continue; // eslint-disable-line no-continue
    try {
      await doc.validate();
    } catch (e) {
      problems.push(`${o.op} ${JSON.stringify(o.idempotencyKey)}: ${e.message}`);
    }
  }
  return problems;
}

async function createIndexes(db, plan, analysis, log) {
  const conditions = db.collection(CONDITIONS);
  for (const action of analysis.actions.indexes.filter((a) => a.action === "create")) {
    const o = plan.operations.find((x) => x.op === "CREATE_INDEX" && x.options.name === action.name);
    // Re-check duplicates for exactly this index immediately before building it.
    const fresh = await readTarget(db);
    const dupes = {
      uniq_specialty_condition_name: fresh.duplicates.names,
      uniq_condition_legacyId: fresh.duplicates.legacyIds,
      uniq_specialty_condition_slug: fresh.duplicates.slugs,
    }[action.name];
    if (dupes.length) throw new MigrationAbort(`Duplicates found before building ${action.name}.`, dupes);
    const createdName = await conditions.createIndex(o.key, o.options);
    log({ collection: CONDITIONS, action: "createIndex", index: createdName });
  }
}

// Phases 2–4. Idempotent: every write is an upsert/$addToSet, so a
// transaction retry (withTransaction) or a re-run is safe.
async function writeDocuments({ db, plan, analysis, phases, session, ObjectId, log }) {
  const now = new Date();
  const opts = session ? { session } : {};
  const specialties = db.collection(SPECIALTIES);
  const conditions = db.collection(CONDITIONS);

  if (phases.has("specialties")) {
    for (const o of plan.operations.filter((x) => x.op === "CREATE_SPECIALTY")) {
      const doc = buildSpecialtyDocument(o.document, ObjectId, now);
      const res = await specialties.updateOne(
        { categoryId: doc.categoryId, name: doc.name },
        { $setOnInsert: doc },
        { ...opts, upsert: true, collation: NAME_COLLATION },
      );
      log({ collection: SPECIALTIES, action: res.upsertedId ? "inserted" : "already-existed", _id: str(res.upsertedId), name: doc.name, isActive: false });
    }
  }
  if (phases.has("conditions")) {
    for (const o of plan.operations.filter((x) => x.op === "CREATE_CONDITION")) {
      const doc = buildConditionDocument(o.document, ObjectId, now);
      const res = await conditions.updateOne({ legacyId: doc.legacyId }, { $setOnInsert: doc }, { ...opts, upsert: true });
      log({ collection: CONDITIONS, action: res.upsertedId ? "inserted" : "already-existed", _id: str(res.upsertedId), legacyId: doc.legacyId, name: doc.name, isActive: false });
    }
  }
  if (phases.has("specialty-aliases")) {
    for (const o of plan.operations.filter((x) => x.op === "SET_SPECIALTY_ALIASES")) {
      const filter = {
        _id: new ObjectId(o.filter._id),
        name: o.expected.name,
        categoryId: new ObjectId(o.expected.categoryId),
        isActive: o.expected.isActive,
      };
      const res = await specialties.updateOne(filter, { $addToSet: { aliases: { $each: o.update.$addToSet.aliases.$each } } }, opts);
      if (res.matchedCount !== 1) throw new MigrationAbort(`Specialty "${o.specialtyName}" no longer matches its expected state; aborting.`);
      log({ collection: SPECIALTIES, action: res.modifiedCount ? "aliases-updated" : "aliases-unchanged", _id: o.filter._id, name: o.specialtyName, aliases: o.update.$addToSet.aliases.$each });
    }
  }

  // In-write verification: nothing planned may be active, and the orphan/test
  // records must still be there. Throwing here aborts the transaction.
  const legacyIds = plan.operations.filter((x) => x.op === "CREATE_CONDITION").map((x) => x.document.legacyId);
  const newNames = plan.operations.filter((x) => x.op === "CREATE_SPECIALTY").map((x) => x.document.name);
  const [activeConditions, activeSpecialties, snapshotConditionsLeft] = await Promise.all([
    conditions.countDocuments({ legacyId: { $in: legacyIds }, isActive: { $ne: false }, createdAt: now }, opts),
    specialties.countDocuments({ name: { $in: newNames }, isActive: { $ne: false } }, opts),
    conditions.countDocuments({ _id: { $in: (plan.liveSnapshot.conditions || []).map((c) => new ObjectId(c._id)) } }, opts),
  ]);
  if (activeConditions || activeSpecialties) throw new MigrationAbort("A newly created record is active; aborting.");
  if (snapshotConditionsLeft !== (plan.liveSnapshot.conditions || []).length) throw new MigrationAbort("An existing condition disappeared; aborting.");
}

// ── Main ────────────────────────────────────────────────────────────────────

function readAppMongoUris() {
  const dotenv = require("dotenv");
  return [".env", ".env.production"]
    .map((f) => path.join(BACKEND_DIR, f))
    .filter((f) => fs.existsSync(f))
    .map((f) => dotenv.parse(fs.readFileSync(f)).MONGO_URI)
    .filter(Boolean);
}

function currentSourceHashes(plan) {
  const hashes = {};
  for (const [key, source] of Object.entries(plan.sources || {})) {
    const file = path.join(REPO_DIR, source.path);
    hashes[key] = fs.existsSync(file) ? sha256(fs.readFileSync(file, "utf8")) : "(missing)";
  }
  return hashes;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const plan = JSON.parse(fs.readFileSync(args.planFile, "utf8"));

  const { dbName, protectedReasons } = assertTargetAllowed({
    uri: process.env[URI_ENV],
    env: process.env,
    args,
    appUris: readAppMongoUris(),
  });
  const integrity = verifyPlanIntegrity(plan, currentSourceHashes(plan));
  if (integrity.length) throw new MigrationAbort("Plan integrity check failed.", integrity);
  if (args.apply) assertConfirmation(process.env, dbName, plan);

  const mongoose = require("mongoose");
  const allow = (collection, method) => args.apply && (APPLY_WRITE_ALLOWLIST[collection] || []).includes(method);
  const guard = installWriteGuard(mongoose, { allow, label: args.apply ? "APPLY" : "PREFLIGHT" });
  const HealthcareSpecialty = require("../../models/HealthcareSpecialty");
  const HealthcareCondition = require("../../models/HealthcareCondition");
  const { ObjectId } = mongoose.Types;

  const report = {
    mode: args.apply ? "apply" : "preflight",
    startedAt: new Date().toISOString(),
    database: dbName,
    protectedReasons,
    phases: [...args.phases],
    operationsSha256: plan.operationsSha256,
    writes: [],
  };
  const log = (entry) => {
    report.writes.push(entry);
    console.log(`  ${entry.action.padEnd(17)} ${entry.collection} ${entry._id || ""} ${entry.legacyId || entry.name || entry.index || ""}`);
  };

  await mongoose.connect(process.env[URI_ENV], { autoIndex: false, autoCreate: false });
  try {
    const db = mongoose.connection.db;
    if (db.databaseName !== dbName) throw new MigrationAbort(`Connected to "${db.databaseName}", expected "${dbName}".`);

    const target = await readTarget(db);
    const analysis = analyzeTarget(plan, target, { allowNoTransaction: args.allowNoTransaction });
    const invalid = await validateDocuments(plan, { HealthcareCondition, HealthcareSpecialty }, ObjectId, new Date());
    report.preflight = { errors: [...analysis.errors, ...invalid], warnings: analysis.warnings, actions: analysis.actions, expectedCounts: analysis.expectedCounts, transactions: target.transactions };

    const summarize = (list) => list.reduce((acc, a) => ((acc[a.action] = (acc[a.action] || 0) + 1), acc), {});
    console.log(`\nTarget ${dbName} (${target.transactions.topology}) — preflight`);
    for (const [k, list] of Object.entries(analysis.actions)) console.log(`  ${k}:`, summarize(list));
    console.log("  counts:", analysis.expectedCounts);
    analysis.warnings.forEach((w) => console.log(`  warning: ${w}`));
    if (report.preflight.errors.length) throw new MigrationAbort("Preflight validation failed; nothing was written.", report.preflight.errors);

    if (!args.apply) {
      console.log("\nPreflight passed. PREFLIGHT ONLY: nothing was written (use --apply with the confirmation token).");
      return;
    }

    console.log("\nApplying:");
    if (args.phases.has("indexes")) await createIndexes(db, plan, analysis, log);
    const body = async (session) => {
      report.writes = report.writes.filter((w) => w.action === "createIndex"); // reset on transaction retry
      await writeDocuments({ db, plan, analysis, phases: args.phases, session, ObjectId, log });
    };
    if (target.transactions.supported) {
      const session = mongoose.connection.client.startSession();
      try {
        await session.withTransaction(() => body(session), { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
      } finally {
        await session.endSession();
      }
    } else {
      await body(null);
    }

    const after = await readTarget(db);
    const recheck = analyzeTarget(plan, after, { allowNoTransaction: true });
    report.postVerification = {
      counts: { categories: after.categories.length, specialties: after.specialties.length, conditions: after.conditions.length },
      remainingInserts: recheck.actions.conditions.filter((a) => a.action === "insert").length,
      errors: recheck.errors,
    };
    console.log("\nPost-verification:", report.postVerification);
  } finally {
    await mongoose.disconnect();
    report.finishedAt = new Date().toISOString();
    report.guard = guard.summary();
    const out = args.reportOut || path.join(__dirname, "results", `applyReport-${dbName}-${report.startedAt.replace(/[:.]/g, "-")}.json`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Report: ${path.relative(REPO_DIR, out)}`);
  }
}

if (require.main === module) {
  main().catch((e) => {
    if (e instanceof MigrationAbort || e instanceof DatabaseWriteBlockedError) {
      console.error(`ABORTED: ${e.message}`);
      (e.details || []).forEach((d) => console.error(`  - ${typeof d === "string" ? d : JSON.stringify(d)}`));
    } else console.error(e);
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  parseMongoUri,
  assertTargetAllowed,
  assertConfirmation,
  expectedConfirmation,
  verifyPlanIntegrity,
  analyzeTarget,
  buildConditionDocument,
  buildSpecialtyDocument,
  compareIndex,
  APPLY_WRITE_ALLOWLIST,
  PROTECTED_DATABASE_NAMES,
  MigrationAbort,
};
