// Driver-level MongoDB write guard for the search-taxonomy scripts.
//
// Installed BEFORE connecting. Every write path of the MongoDB driver used by
// Mongoose is wrapped; a call THROWS (and is recorded) unless the caller's
// `allow(collectionName, method)` returns true for it. The default allows
// nothing, which is what the dry-run planner uses.
//
// Always refused, whatever `allow` says:
//   - deletes, drops, renames, index drops, bulk writes, replace, findOneAnd*
//   - collection / database creation or deletion (Db methods)
//   - write commands sent through db.command()
//   - aggregate with $out / $merge
//   - Mongoose Model.syncIndexes / ensureIndexes / createIndexes / diffIndexes
const ALLOWABLE_COLLECTION_METHODS = ["insertOne", "insertMany", "updateOne", "updateMany", "createIndex", "createIndexes"];
const ALWAYS_REFUSED_COLLECTION_METHODS = [
  "replaceOne", "deleteOne", "deleteMany", "findOneAndUpdate", "findOneAndDelete",
  "findOneAndReplace", "bulkWrite", "initializeOrderedBulkOp", "initializeUnorderedBulkOp",
  "dropIndex", "dropIndexes", "drop", "rename",
];
const ALWAYS_REFUSED_DB_METHODS = ["createCollection", "dropCollection", "dropDatabase", "renameCollection", "createIndex"];
const ALWAYS_REFUSED_MODEL_STATICS = ["syncIndexes", "ensureIndexes", "createIndexes", "diffIndexes", "cleanIndexes"];
const WRITE_COMMANDS = new Set([
  "insert", "update", "delete", "findandmodify", "createindexes", "dropindexes",
  "create", "drop", "dropdatabase", "renamecollection", "collmod",
]);

class DatabaseWriteBlockedError extends Error {}

const hasWriteStage = (pipeline) =>
  Array.isArray(pipeline) && pipeline.some((stage) => stage && (stage.$out || stage.$merge));

function installWriteGuard(mongoose, { allow = () => false, label = "DRY-RUN" } = {}) {
  const attempts = [];
  const allowed = [];
  const refuse = (what) => {
    attempts.push(what);
    throw new DatabaseWriteBlockedError(`${label}: database write blocked (${what})`);
  };
  const { Collection, Db } = mongoose.mongo;

  for (const method of ALLOWABLE_COLLECTION_METHODS) {
    const original = Collection.prototype[method];
    if (typeof original !== "function") continue; // eslint-disable-line no-continue
    Collection.prototype[method] = function guarded(...args) {
      if (!allow(this.collectionName, method)) refuse(`${this.collectionName}.${method}`);
      allowed.push(`${this.collectionName}.${method}`);
      return original.apply(this, args);
    };
  }
  for (const method of ALWAYS_REFUSED_COLLECTION_METHODS) {
    if (typeof Collection.prototype[method] !== "function") continue; // eslint-disable-line no-continue
    Collection.prototype[method] = function guarded() {
      refuse(`${this.collectionName}.${method}`);
    };
  }
  const originalAggregate = Collection.prototype.aggregate;
  Collection.prototype.aggregate = function guardedAggregate(pipeline, ...rest) {
    if (hasWriteStage(pipeline)) refuse(`${this.collectionName}.aggregate($out/$merge)`);
    return originalAggregate.call(this, pipeline, ...rest);
  };
  for (const method of ALWAYS_REFUSED_DB_METHODS) {
    if (typeof Db.prototype[method] !== "function") continue; // eslint-disable-line no-continue
    Db.prototype[method] = function guarded() {
      refuse(`db.${method}`);
    };
  }
  const originalCommand = Db.prototype.command;
  Db.prototype.command = function guardedCommand(command, ...rest) {
    const name = Object.keys(command || {})[0] || "";
    if (WRITE_COMMANDS.has(name.toLowerCase())) refuse(`db.command(${name})`);
    if (name === "aggregate" && hasWriteStage(command.pipeline)) refuse("db.command(aggregate $out/$merge)");
    return originalCommand.call(this, command, ...rest);
  };
  for (const method of ALWAYS_REFUSED_MODEL_STATICS) {
    mongoose.Model[method] = function guarded() {
      refuse(`Model.${method}`);
    };
  }

  mongoose.set("autoIndex", false);
  mongoose.set("autoCreate", false);

  // Prove the guard is armed without touching any database: a refused method
  // invoked on a detached receiver must throw before any I/O.
  let armed = false;
  try {
    Collection.prototype.deleteMany.call({ collectionName: "__write_guard_self_test__" });
  } catch (err) {
    armed = err instanceof DatabaseWriteBlockedError;
  }
  attempts.length = 0;
  if (!armed) throw new Error("Write guard self-test failed; refusing to connect.");

  return {
    attempts,
    allowed,
    summary() {
      const count = (list, re) => list.filter((a) => re.test(a)).length;
      const tally = (list) => ({
        total: list.length,
        inserts: count(list, /insert/i),
        updates: count(list, /update|replace|findOneAnd|bulkWrite|findandmodify/i),
        deletes: count(list, /delete/i),
        indexCreations: count(list, /createIndex/i),
        indexDeletions: count(list, /dropIndex/i),
        collectionCreations: count(list, /createCollection|command\(create\)/i),
        collectionDeletions: count(list, /\.drop$|dropCollection|dropDatabase|command\(drop/i),
      });
      const blocked = tally(attempts);
      return {
        guard: "driver-level, throwing (installed before connect)",
        guardSelfTest: "passed",
        autoIndex: mongoose.get("autoIndex"),
        autoCreate: mongoose.get("autoCreate"),
        writeAttempts: attempts.length,
        inserts: blocked.inserts,
        updates: blocked.updates,
        deletes: blocked.deletes,
        indexCreations: blocked.indexCreations,
        indexDeletions: blocked.indexDeletions,
        collectionCreations: blocked.collectionCreations,
        collectionDeletions: blocked.collectionDeletions,
        attempted: [...attempts],
        allowedWrites: tally(allowed),
      };
    },
  };
}

module.exports = { installWriteGuard, DatabaseWriteBlockedError, hasWriteStage };
