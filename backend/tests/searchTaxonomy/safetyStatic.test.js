// Write guard behaviour (no connection) and static guarantees about the
// search-taxonomy scripts' source code.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const { installWriteGuard, DatabaseWriteBlockedError } = require("../../scripts/searchTaxonomy/dbWriteGuard");
const { APPLY_WRITE_ALLOWLIST } = require("../../scripts/searchTaxonomy/applySearchTaxonomyMigration");

const dir = path.join(__dirname, "..", "..", "scripts", "searchTaxonomy");
const read = (file) => fs.readFileSync(path.join(dir, file), "utf8");
// Strip comments so documentation mentioning forbidden calls does not count.
const code = (file) => read(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const guard = installWriteGuard(mongoose, {
  allow: (collection, method) => (APPLY_WRITE_ALLOWLIST[collection] || []).includes(method),
});
const { Collection, Db } = mongoose.mongo;
const detached = (name) => ({ collectionName: name });
const blocked = (fn) => {
  try {
    const result = fn();
    // An allowed call on a detached receiver rejects on its own; ignore that.
    if (result && typeof result.catch === "function") result.catch(() => {});
  } catch (e) {
    return e instanceof DatabaseWriteBlockedError;
  }
  return false;
};

test("guard: deletes, drops and bulk writes are refused even when allowed by the caller", () => {
  const everything = installWriteGuard(mongoose, { allow: () => true });
  for (const m of ["deleteOne", "deleteMany", "drop", "dropIndex", "dropIndexes", "bulkWrite", "replaceOne", "findOneAndUpdate", "rename"]) {
    assert.ok(blocked(() => Collection.prototype[m].call(detached("healthcareconditions"))), m);
  }
  for (const m of ["createCollection", "dropCollection", "dropDatabase"]) assert.ok(blocked(() => Db.prototype[m].call({})), m);
  assert.ok(blocked(() => Db.prototype.command.call({}, { delete: "healthcareconditions" })));
  assert.ok(blocked(() => Collection.prototype.aggregate.call(detached("x"), [{ $out: "y" }])));
  assert.ok(blocked(() => mongoose.Model.syncIndexes()));
  assert.ok(everything.attempts.length >= 14);
});

test("guard: the apply allowlist permits only its own writes", () => {
  installWriteGuard(mongoose, { allow: (c, m) => (APPLY_WRITE_ALLOWLIST[c] || []).includes(m) });
  for (const coll of ["enrollments", "doctors", "healthcarecategories", "categorypricings"]) {
    for (const m of ["insertOne", "updateOne", "updateMany", "createIndex"]) {
      assert.ok(blocked(() => Collection.prototype[m].call(detached(coll))), `${coll}.${m}`);
    }
  }
  assert.ok(blocked(() => Collection.prototype.insertOne.call(detached("healthcareconditions"))));
  assert.ok(blocked(() => Collection.prototype.updateMany.call(detached("healthcarespecialties"))));
  assert.ok(blocked(() => Collection.prototype.createIndex.call(detached("healthcarespecialties"))));
  // Allowed: the guard passes through (the detached receiver then fails for
  // its own reasons, never with the guard error).
  assert.ok(!blocked(() => Collection.prototype.updateOne.call(detached("healthcareconditions"), {}, {})));
  assert.deepEqual(APPLY_WRITE_ALLOWLIST, { healthcareconditions: ["createIndex", "updateOne"], healthcarespecialties: ["updateOne"] });
});

test("guard: default (planner) allows nothing", () => {
  const g = installWriteGuard(mongoose);
  for (const m of ["insertOne", "insertMany", "updateOne", "updateMany", "createIndex", "createIndexes"]) {
    assert.ok(blocked(() => Collection.prototype[m].call(detached("healthcareconditions"))), m);
  }
  assert.equal(g.summary().writeAttempts, 6);
  assert.equal(guard.summary().guardSelfTest, "passed");
});

test("scripts never call syncIndexes, deletes, drops, or touch doctor data", () => {
  for (const file of ["prepareSearchTaxonomyMigration.js", "applySearchTaxonomyMigration.js", "searchTaxonomyDecisions.js"]) {
    const src = code(file);
    assert.ok(!/\.(syncIndexes|ensureIndexes|diffIndexes|cleanIndexes)\s*\(/.test(src), `${file} calls an index-sync API`);
    assert.ok(!/\.(deleteOne|deleteMany|drop|dropIndex|dropIndexes|dropCollection|dropDatabase|replaceOne|findOneAnd\w+|bulkWrite|insertMany|updateMany)\s*\(/.test(src), `${file} has a forbidden write`);
    assert.ok(!/isActive:\s*true/.test(src), `${file} sets isActive: true`);
    assert.ok(!/models\/(Doctor|Enrollment)/.test(src), `${file} loads a doctor model`);
  }
  const apply = code("applySearchTaxonomyMigration.js");
  assert.ok(!/["'](enrollments|doctors)["']/.test(apply), "apply script references doctor collections");
  assert.ok(!/process\.env\.MONGO_URI/.test(apply), "apply script reads the app MONGO_URI as its target");
  // The planner writes nothing: no write method is called at all.
  assert.ok(!/\.(insertOne|updateOne|createIndex|save)\s*\(/.test(code("prepareSearchTaxonomyMigration.js")));
});
