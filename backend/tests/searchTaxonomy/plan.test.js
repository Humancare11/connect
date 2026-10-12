// The committed dry-run plan: reproducible offline and consistent with the
// approved decisions. No database connection: the live state comes from the
// snapshot stored inside the plan itself.
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const plan = require("../../scripts/searchTaxonomy/searchTaxonomyMigrationPlan.json");
const decisions = require("../../scripts/searchTaxonomy/searchTaxonomyDecisions");
const {
  buildPlan,
  loadLegacyIndex,
  loadAppRoutes,
} = require("../../scripts/searchTaxonomy/prepareSearchTaxonomyMigration");
const HealthcareCondition = require("../../models/HealthcareCondition");

const ops = (type) => plan.operations.filter((o) => o.op === type);
const conditionOp = (legacyId) => ops("CREATE_CONDITION").find((o) => o.document.legacyId === legacyId);

test("plan rebuilds offline to the identical operations (sha256)", async () => {
  const snap = plan.liveSnapshot;
  const rebuilt = buildPlan({
    legacy: await loadLegacyIndex(),
    appRoutes: loadAppRoutes().paths,
    live: {
      database: snap.database,
      categories: snap.categories,
      specialties: snap.specialties,
      conditions: snap.conditions,
      indexes: snap.indexes,
      doctorRows: null,
    },
    conditionSchemaIndexes: HealthcareCondition.schema.indexes(),
  });
  assert.deepEqual(rebuilt.fatal, []);
  const sha = crypto.createHash("sha256").update(JSON.stringify(rebuilt.operations)).digest("hex");
  assert.equal(sha, plan.operationsSha256);
});

test("plan is a clean, unexecuted dry run", () => {
  assert.equal(plan.dryRun, true);
  assert.equal(plan.executed, false);
  assert.deepEqual(plan.fatal, []);
  assert.equal(plan.counts.collisionCount, 0);
  assert.equal(plan.safety.writeAttempts, 0);
  const hash = crypto.createHash("sha256").update(JSON.stringify(plan.operations)).digest("hex");
  assert.equal(hash, plan.operationsSha256);
});

test("final counts: 204 legacy → 201 records + 3 merges, 0 excluded", () => {
  const c = plan.counts;
  assert.equal(c.legacyConditionRecords, 204);
  assert.equal(c.importable, 201);
  assert.equal(c.importableConditions, 194);
  assert.equal(c.importableServices, 7);
  assert.equal(c.aliasMerges, 3);
  assert.equal(c.excluded, 0);
  assert.equal(c.importable + c.aliasMerges + c.excluded, c.legacyConditionRecords);
  assert.equal(ops("CREATE_CONDITION").length, 201);
  assert.equal(ops("CREATE_SPECIALTY").length, 2);
  assert.equal(ops("CREATE_INDEX").length, 3);
  assert.equal(ops("SET_SPECIALTY_ALIASES").length, 15);
  assert.equal(ops("EXCLUDE").length, 0);
  assert.equal(new Set(ops("CREATE_CONDITION").map((o) => o.document.legacyId)).size, 201);
});

test("Decision 1: the 3 approved records are imported to their specialties", () => {
  const expected = { osteoporosis: "Endocrinology", "post-covid-concerns": "Pulmonology", "medication-review": "Internal Medicine" };
  for (const [id, specialty] of Object.entries(expected)) {
    assert.equal(decisions.APPROVED_SPECIALTY_DECISIONS[id].specialty, specialty);
    const op = conditionOp(id);
    assert.ok(op, `${id} not planned`);
    assert.equal(op.specialtyName, specialty);
    assert.equal(op.basis, "approved-clear-semantic-match");
    const record = plan.legacyMapping.conditions.find((r) => r.legacyId === id);
    assert.equal(record.decision, "IMPORT");
    assert.notEqual(record.classification, "NEEDS_REVIEW");
  }
  assert.equal(decisions.APPROVED_SEMANTIC_MATCHES, undefined);
});

test("Decision 2: 'gp' is a General Physician alias only", () => {
  assert.deepEqual(decisions.APPROVED_SPECIALTY_ALIASES["General Physician"], ["gp"]);
  assert.ok(!decisions.APPROVED_SPECIALTY_ALIASES["Family Medicine"].includes("gp"));
  const owners = ops("SET_SPECIALTY_ALIASES")
    .filter((o) => o.update.$addToSet.aliases.$each.includes("gp"))
    .map((o) => o.specialtyName);
  assert.deepEqual(owners, ["General Physician"]);
  const everySpecialtyAlias = ops("SET_SPECIALTY_ALIASES").flatMap((o) => o.update.$addToSet.aliases.$each);
  assert.equal(everySpecialtyAlias.length, new Set(everySpecialtyAlias).size, "an alias sits on two specialties");
  assert.equal(plan.doctors.specializationMapping.find((d) => d.specialization === "General Practice").mappedSpecialty, "General Physician");
});

test("Decision 3: specialty alias updates are approved and touch only aliases", () => {
  for (const o of ops("SET_SPECIALTY_ALIASES")) {
    assert.equal(o.approved, true);
    assert.match(o.approvedBy, /^PR 4\.5 .*Decision 3$/);
    assert.deepEqual(Object.keys(o.update), ["$addToSet"]);
    assert.deepEqual(Object.keys(o.update.$addToSet), ["aliases"]);
    assert.deepEqual(o.fieldsTouched, ["aliases"]);
    assert.deepEqual(Object.keys(o.filter), ["_id"]);
    assert.ok(o.expected.name && o.expected.categoryId && typeof o.expected.isActive === "boolean");
  }
});

test("everything created is inactive; services are kind 'service' under General Physician", () => {
  for (const o of [...ops("CREATE_CONDITION"), ...ops("CREATE_SPECIALTY")]) assert.equal(o.document.isActive, false);
  const services = ops("CREATE_CONDITION").filter((o) => o.document.kind === "service");
  assert.deepEqual(services.map((o) => o.document.legacyId).sort(), Object.keys(decisions.SERVICES).sort());
  for (const o of services) assert.equal(o.specialtyName, "General Physician");
});

test("no operation targets doctors, enrollments or existing conditions", () => {
  for (const o of plan.operations) {
    if (o.collection) assert.ok(["healthcareconditions", "healthcarespecialties"].includes(o.collection), o.collection);
  }
  const liveConditionIds = new Set(plan.liveSnapshot.conditions.map((c) => c._id));
  for (const o of plan.operations) assert.ok(!o.filter || !liveConditionIds.has(o.filter._id));
  assert.ok(plan.liveSnapshot.conditions.every((c) => c.migrationAction === "NO_CHANGE"));
  assert.equal(plan.doctors.recordsModified, 0);
});
