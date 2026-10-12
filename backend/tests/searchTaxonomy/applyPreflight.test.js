// The future apply script's safety logic, exercised on in-memory targets
// built from the plan's own snapshot. No database connection.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Types } = require("mongoose");

const plan = require("../../scripts/searchTaxonomy/searchTaxonomyMigrationPlan.json");
const {
  parseArgs,
  parseMongoUri,
  assertTargetAllowed,
  assertConfirmation,
  expectedConfirmation,
  verifyPlanIntegrity,
  analyzeTarget,
  buildConditionDocument,
  buildSpecialtyDocument,
  MigrationAbort,
} = require("../../scripts/searchTaxonomy/applySearchTaxonomyMigration");

const REPO = path.join(__dirname, "..", "..", "..");
const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");
const clone = (v) => JSON.parse(JSON.stringify(v));
const ops = (type) => plan.operations.filter((o) => o.op === type);

// The target exactly as it was when the plan was generated.
function snapshotTarget() {
  const snap = plan.liveSnapshot;
  return {
    databaseName: snap.database,
    categories: clone(snap.categories),
    specialties: clone(snap.specialties),
    conditions: snap.conditions.map((c) => ({
      _id: c._id, name: c.name, specialtyId: c.specialtyId, isActive: c.isActive,
      legacyId: c.legacyId, slug: c.slug, kind: c.kind || "condition",
    })),
    indexes: [
      { name: "_id_", key: { _id: 1 } },
      { name: "specialtyId_1", key: { specialtyId: 1 } },
      { name: "specialtyId_1_name_1", key: { specialtyId: 1, name: 1 } },
    ],
    duplicates: { names: [], legacyIds: [], slugs: [] },
    transactions: { supported: true, topology: "replicaSet" },
  };
}

// The target after a successful apply.
function migratedTarget() {
  const t = snapshotTarget();
  ops("CREATE_SPECIALTY").forEach((o, i) => t.specialties.push({ _id: `new${i}`, name: o.document.name, categoryId: o.document.categoryId, isActive: false, aliases: [] }));
  ops("CREATE_CONDITION").forEach((o, i) => {
    const d = o.document;
    t.conditions.push({ _id: `c${i}`, name: d.name, specialtyId: d.specialtyId, isActive: false, legacyId: d.legacyId, slug: d.slug, kind: d.kind });
  });
  for (const o of ops("SET_SPECIALTY_ALIASES")) {
    const s = t.specialties.find((x) => x._id === o.filter._id);
    s.aliases = [...new Set([...s.aliases, ...o.update.$addToSet.aliases.$each])];
  }
  for (const o of ops("CREATE_INDEX")) t.indexes.push({ name: o.options.name, key: o.key, ...o.options });
  return t;
}

test("clean snapshot target: preflight passes with the full action list", () => {
  const a = analyzeTarget(plan, snapshotTarget());
  assert.deepEqual(a.errors, []);
  assert.equal(a.actions.indexes.filter((x) => x.action === "create").length, 3);
  assert.equal(a.actions.specialties.filter((x) => x.action === "insert").length, 2);
  assert.equal(a.actions.conditions.filter((x) => x.action === "insert").length, 201);
  assert.equal(a.actions.specialtyAliases.filter((x) => x.action === "update").length, 15);
  assert.deepEqual(a.expectedCounts.after, { categories: 11, specialties: 32, conditions: 204 });
});

test("re-run on a migrated target is a no-op (idempotent)", () => {
  const a = analyzeTarget(plan, migratedTarget());
  assert.deepEqual(a.errors, []);
  assert.ok(a.actions.indexes.every((x) => x.action === "exists"));
  assert.ok(a.actions.specialties.every((x) => x.action === "exists"));
  assert.ok(a.actions.conditions.every((x) => x.action === "exists"));
  assert.ok(a.actions.specialtyAliases.every((x) => x.action === "noop"));
});

const expectError = (mutate, pattern, options) => {
  const t = snapshotTarget();
  mutate(t);
  const { errors } = analyzeTarget(plan, t, options);
  assert.ok(errors.some((e) => pattern.test(e)), `expected ${pattern}, got:\n${errors.join("\n")}`);
};

test("refuses a different database than the plan was generated against", () => {
  expectError((t) => { t.databaseName = "humancare_uat"; }, /Regenerate the plan against the target/);
});

test("refuses when the expected taxonomy changed", () => {
  expectError((t) => { t.categories.pop(); }, /Expected 11 categories|missing/);
  expectError((t) => { t.specialties[0].name = "Renamed"; }, /changed since planning/);
  expectError((t) => { t.specialties.push({ _id: "x", name: "Surprise", categoryId: t.categories[0]._id, isActive: true, aliases: [] }); }, /Unexpected specialty/);
  expectError((t) => { t.conditions.push({ _id: "y", name: "Manual", specialtyId: t.specialties[0]._id, isActive: true, legacyId: null, slug: "", kind: "condition" }); }, /Unexpected condition/);
  expectError((t) => { t.conditions = t.conditions.filter((c) => c.name !== "jhvj"); }, /never deleted/);
});

test("refuses duplicates, legacyId/name/slug conflicts and bad specialty references", () => {
  expectError((t) => { t.duplicates.names.push({ _id: "dup" }); }, /Duplicate condition name/);
  expectError((t) => { t.duplicates.legacyIds.push({ _id: "dup" }); }, /Duplicate legacyId/);
  expectError((t) => { t.duplicates.slugs.push({ _id: "dup" }); }, /Duplicate slug/);
  const acne = ops("CREATE_CONDITION").find((o) => o.document.legacyId === "acne").document;
  expectError((t) => { t.conditions.push({ _id: "z", name: "Other", specialtyId: acne.specialtyId, isActive: false, legacyId: "acne", slug: "other", kind: "condition" }); }, /different content/);
  expectError((t) => { t.conditions.push({ _id: "z", name: "ACNE", specialtyId: acne.specialtyId, isActive: true, legacyId: null, slug: "", kind: "condition" }); }, /name "Acne" already used|Unexpected condition/);
  expectError((t) => { t.specialties = t.specialties.filter((s) => s._id !== acne.specialtyId); }, /does not exist|missing/);
});

test("refuses an already-active planned specialty", () => {
  const onc = ops("CREATE_SPECIALTY")[0].document;
  expectError((t) => { t.specialties.push({ _id: "o", name: onc.name, categoryId: onc.categoryId, isActive: true, aliases: [] }); }, /ACTIVE/);
});

test("index state: mismatched options or a same-key index are refused", () => {
  expectError((t) => { t.indexes.push({ name: "uniq_condition_legacyId", key: { legacyId: 1 }, unique: false }); }, /exists with different unique/);
  expectError((t) => { t.indexes.push({ name: "legacyId_1", key: { legacyId: 1 } }); }, /createIndex would fail/);
  // The legacy plain {specialtyId, name} index (no collation) does not clash.
  assert.ok(analyzeTarget(plan, snapshotTarget()).actions.indexes.some((i) => i.name === "uniq_specialty_condition_name" && i.action === "create"));
});

test("transactions are required unless explicitly waived", () => {
  expectError((t) => { t.transactions = { supported: false, topology: "standalone" }; }, /does not support transactions/);
  const t = snapshotTarget();
  t.transactions = { supported: false, topology: "standalone" };
  assert.deepEqual(analyzeTarget(plan, t, { allowNoTransaction: true }).errors, []);
});

test("target guard refuses authDB, the app's own database and production", () => {
  const args = { allowProtected: false };
  const env = {};
  assert.throws(() => assertTargetAllowed({ uri: "", env, args }), MigrationAbort);
  assert.throws(() => assertTargetAllowed({ uri: "mongodb://h1:27017", env, args }), /name the target database/);
  assert.throws(() => assertTargetAllowed({ uri: "mongodb+srv://u:p@cluster.x.net/authDB?retryWrites=true", env, args }), /protected live\/shared/);
  assert.throws(
    () => assertTargetAllowed({ uri: "mongodb://h1,h2/appdb", env, args, appUris: ["mongodb://u:p@h2,h1/appdb?x=1"] }),
    /backend's own MONGO_URI/,
  );
  assert.throws(() => assertTargetAllowed({ uri: "mongodb://h/uat", env: { NODE_ENV: "production" }, args }), /production/);
  assert.equal(assertTargetAllowed({ uri: "mongodb://h/humancare_uat", env, args, appUris: ["mongodb://h/authDB"] }).dbName, "humancare_uat");
  // Only both explicit confirmations unlock a protected target.
  assert.throws(() => assertTargetAllowed({ uri: "mongodb://h/authDB", env: { SEARCH_MIGRATION_ALLOW_PROTECTED_DB: "authDB" }, args }));
  assert.throws(() => assertTargetAllowed({ uri: "mongodb://h/authDB", env, args: { allowProtected: true } }));
  const ok = assertTargetAllowed({ uri: "mongodb://h/authDB", env: { SEARCH_MIGRATION_ALLOW_PROTECTED_DB: "authDB" }, args: { allowProtected: true } });
  assert.equal(ok.protectedReasons.length, 1);
});

test("--apply confirmation is bound to the database and the plan hash", () => {
  const token = expectedConfirmation("humancare_uat", plan);
  assert.equal(token, `humancare_uat:${plan.operationsSha256.slice(0, 12)}`);
  assert.doesNotThrow(() => assertConfirmation({ SEARCH_MIGRATION_CONFIRM: token }, "humancare_uat", plan));
  assert.throws(() => assertConfirmation({ SEARCH_MIGRATION_CONFIRM: "yes" }, "humancare_uat", plan), MigrationAbort);
  assert.throws(() => assertConfirmation({ SEARCH_MIGRATION_CONFIRM: token }, "other_db", plan), MigrationAbort);
});

test("plan integrity: current plan passes; tampering and stale sources fail", () => {
  const hashes = Object.fromEntries(
    Object.entries(plan.sources).map(([k, s]) => [k, sha256(fs.readFileSync(path.join(REPO, s.path), "utf8"))]),
  );
  assert.deepEqual(verifyPlanIntegrity(plan, hashes), []);
  assert.ok(verifyPlanIntegrity(plan, { ...hashes, searchIndex: "0" }).some((e) => /regenerate/.test(e)));

  const tampered = clone(plan);
  tampered.operations.find((o) => o.op === "CREATE_CONDITION").document.isActive = true;
  const errs = verifyPlanIntegrity(tampered, hashes);
  assert.ok(errs.some((e) => /operationsSha256/.test(e)));
  assert.ok(errs.some((e) => /isActive:false/.test(e)));

  const widened = clone(plan);
  widened.operations.find((o) => o.op === "SET_SPECIALTY_ALIASES").update.$set = { name: "x" };
  widened.operationsSha256 = sha256(JSON.stringify(widened.operations));
  assert.ok(verifyPlanIntegrity(widened, hashes).some((e) => /only \$addToSet/.test(e)));

  const foreign = clone(plan);
  foreign.operations[0].collection = "enrollments";
  foreign.operationsSha256 = sha256(JSON.stringify(foreign.operations));
  assert.ok(verifyPlanIntegrity(foreign, hashes).some((e) => /forbidden collection/.test(e)));
});

test("documents are always written inactive", () => {
  const now = new Date();
  const cond = buildConditionDocument({ ...ops("CREATE_CONDITION")[0].document, isActive: true }, Types.ObjectId, now);
  const spec = buildSpecialtyDocument({ ...ops("CREATE_SPECIALTY")[0].document, isActive: true }, Types.ObjectId, now);
  assert.equal(cond.isActive, false);
  assert.equal(spec.isActive, false);
  assert.ok(cond.specialtyId instanceof Types.ObjectId);
});

test("argument parsing", () => {
  assert.equal(parseArgs([]).apply, false);
  assert.deepEqual([...parseArgs(["--phases=indexes,conditions"]).phases], ["indexes", "conditions"]);
  assert.throws(() => parseArgs(["--phases=everything"]), MigrationAbort);
  assert.throws(() => parseArgs(["--force"]), MigrationAbort);
  assert.deepEqual(parseMongoUri("mongodb+srv://a:b@X.net/db1?z=1"), { hosts: "x.net", dbName: "db1" });
});
