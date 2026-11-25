#!/usr/bin/env node
/**
 * READ-ONLY MongoDB schema profiler.
 *
 * Writes NOTHING to the database. It only runs: listCollections, collStats, listIndexes,
 * aggregate([$indexStats]) and aggregate([$sample]) (plus an optional aggregate([$group,$limit])
 * for --full-distinct). The only file it writes is the JSON report, and only outside the repo.
 *
 * Usage (PowerShell):
 *   $env:DB_PROFILE_URI = "mongodb+srv://<read-only-user>:<password>@<cluster>/<database>"
 *   node scripts/dbProfile.js --out C:\Users\dell\db-profile\db-profile.json
 *   node scripts/dbProfile.js --selftest        # no database: checks the profiler on fake documents
 *
 * Options:
 *   --out <file>        report path (default: ~/db-profile/db-profile.json). Refused if inside the repo.
 *   --db <name>         database name (default: the one in the URI)
 *   --sample <n>        sample size per collection (default 500)
 *   --full-distinct     look for status-like distinct values over the WHOLE collection (a scan, off by default)
 *
 * The connection string is read ONLY from DB_PROFILE_URI. No .env file is loaded, so the app's
 * read-write credentials can never be picked up by accident. The URI is never printed or saved.
 *
 * PRIVACY: the report holds field names, BSON types, counts, percentages and sizes. The only
 * values it can contain are the distinct values of status-like fields (see STATUS_FIELD_RE), and
 * only when there are fewer than 30 of them and each looks like a short code (see SAFE_VALUE_RE).
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

// The MongoDB driver ships inside mongoose, so no new dependency is needed.
const mongoose = require("mongoose");
const { MongoClient, BSON } = mongoose.mongo;

const REPO_ROOT = path.resolve(__dirname, "..", "..");

// ───────────────────────── settings ─────────────────────────
const DEFAULT_SAMPLE = 500;
const MAX_DEPTH = 8;
const MAX_PATHS_PER_COLLECTION = 1500; // guards against objects used as maps
const MAX_KEYS_PER_OBJECT = 60; // more distinct keys than this = keys are data, collapse them
const MAX_DISTINCT = 30; // report distinct values only below this count
const QUERY_TIMEOUT_MS = 30000;

// Field names whose distinct values may be reported.
const STATUS_FIELD_RE = /(^|[^a-z])(status|role|type|currency|approvalStatus|applicationStatus|paymentStatus)$|status$|currency$|^role$|^type$/i;
// Never report values for names that look sensitive, whatever their ending.
const SENSITIVE_NAME_RE = /token|secret|password|hash|email|phone|mobile|address|name$|note|comment|message|body|text|reason|account|iban|ifsc|cipher|iv$|authtag|key$|url$/i;
// A reportable value must look like a short code (e.g. "paid", "in-progress", "application/pdf").
const SAFE_VALUE_RE = /^[A-Za-z0-9_.:\-\/+ ]{0,40}$/;

// Privileges that mean the connected user is NOT read-only. The script refuses to run if it has any.
const WRITE_ACTIONS = new Set([
  "insert", "update", "remove", "createCollection", "createIndex", "dropCollection", "dropIndex",
  "dropDatabase", "renameCollectionSameDB", "collMod", "convertToCapped", "bypassDocumentValidation",
  "createUser", "dropUser", "grantRole", "revokeRole", "enableSharding", "shardCollection",
]);
// Only these aggregation stages may ever be sent. $out and $merge (writes) can never pass.
const ALLOWED_STAGES = new Set(["$sample", "$indexStats", "$group", "$limit", "$match"]);

// ───────────────────────── tiny helpers ─────────────────────────
function parseArgs(argv) {
  const args = { sample: DEFAULT_SAMPLE, fullDistinct: false, selftest: false, out: "", db: "" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") args.out = argv[++i] || "";
    else if (a === "--db") args.db = argv[++i] || "";
    else if (a === "--sample") args.sample = Math.max(1, Math.min(2000, Number(argv[++i]) || DEFAULT_SAMPLE));
    else if (a === "--full-distinct") args.fullDistinct = true;
    else if (a === "--selftest") args.selftest = true;
    else throw new Error(`Unknown option: ${a}`);
  }
  return args;
}

function assertOutsideRepo(file) {
  const resolved = path.resolve(file);
  const rel = path.relative(REPO_ROOT, resolved);
  if (rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))) {
    throw new Error(`Refusing to write the report inside the repo (${REPO_ROOT}). Use --out with a path outside it.`);
  }
  return resolved;
}

function assertReadOnlyPipeline(pipeline) {
  for (const stage of pipeline) {
    const name = Object.keys(stage)[0];
    if (!ALLOWED_STAGES.has(name)) throw new Error(`Blocked aggregation stage ${name}`);
  }
}

// Driver is opened with promoteValues:false, so numbers arrive as Int32 / Double / Long wrappers.
function typeOf(v) {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (Array.isArray(v)) return "array";
  if (v instanceof Date) return "date";
  const t = typeof v;
  if (t === "string") return "string";
  if (t === "boolean") return "bool";
  if (t === "number") return Number.isInteger(v) ? "int" : "double";
  if (t === "object") {
    const b = v._bsontype;
    if (b) {
      const s = String(b).toLowerCase();
      if (s === "objectid" || s === "objectid") return "objectId";
      if (s === "int32") return "int";
      if (s === "double") return "double";
      if (s === "long") return "long";
      if (s === "decimal128") return "decimal";
      if (s === "binary") return "binary";
      return s;
    }
    return "object";
  }
  return t;
}

// Field names that are really data (dynamic map keys) must not reach the report.
function safeKey(key) {
  if (/^[0-9a-f]{24}$/i.test(key)) return "<dynamic>";
  if (key.includes("@") || key.length > 40 || /^\d/.test(key)) return "<dynamic>";
  return key;
}

function round(n, d = 2) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

// ───────────────────────── field profiler (pure, works on in-memory docs) ─────────────────────────
function profileDocuments(docs, { idLikeNames } = {}) {
  const total = docs.length;
  const paths = new Map(); // path -> stats
  let pathCapHit = false;

  const stat = (p) => {
    let s = paths.get(p);
    if (!s) {
      if (paths.size >= MAX_PATHS_PER_COLLECTION) {
        pathCapHit = true;
        return null;
      }
      s = { docs: 0, types: Object.create(null), lenSum: 0, lenMax: 0, lenDocs: 0, elemTypes: Object.create(null), hexStrings: 0, strings: 0, distinct: new Set(), distinctOverflow: false, unsafeValue: false };
      paths.set(p, s);
    }
    return s;
  };

  const wantsValues = (p) => {
    const last = p.split(".").pop();
    return STATUS_FIELD_RE.test(last) && !SENSITIVE_NAME_RE.test(last);
  };

  const noteValue = (s, p, v) => {
    if (typeof v === "string") {
      s.strings += 1;
      if (/^[0-9a-f]{24}$/i.test(v)) s.hexStrings += 1;
    }
    if (!wantsValues(p) || typeof v !== "string" || s.distinctOverflow) return;
    if (!SAFE_VALUE_RE.test(v)) {
      s.unsafeValue = true; // looks like free text: never report any value for this path
      return;
    }
    s.distinct.add(v);
    if (s.distinct.size >= MAX_DISTINCT) s.distinctOverflow = true;
  };

  function walk(value, p, seen, depth) {
    const t = typeOf(value);
    const s = stat(p);
    if (!s) return;
    if (!seen.has(p)) {
      seen.add(p);
      s.docs += 1;
    }
    s.types[t] = (s.types[t] || 0) + 1;

    if (t === "array") {
      s.lenSum += value.length;
      s.lenMax = Math.max(s.lenMax, value.length);
      s.lenDocs += 1;
      for (const el of value) {
        const et = typeOf(el);
        s.elemTypes[et] = (s.elemTypes[et] || 0) + 1;
        if (et === "object" && depth < MAX_DEPTH) walkObject(el, p, seen, depth + 1);
        else if (et === "string") noteValue(s, p, el);
      }
    } else if (t === "object") {
      if (depth < MAX_DEPTH) walkObject(value, p, seen, depth + 1);
    } else {
      noteValue(s, p, value);
    }
  }

  function walkObject(obj, prefix, seen, depth) {
    const keys = Object.keys(obj);
    const dynamic = keys.length > MAX_KEYS_PER_OBJECT;
    for (const k of keys) {
      const name = dynamic ? "<dynamic>" : safeKey(k);
      walk(obj[k], prefix ? `${prefix}.${name}` : name, seen, depth);
    }
  }

  const topBytes = new Map();
  for (const doc of docs) {
    const seen = new Set();
    walkObject(doc, "", seen, 0);
    for (const k of Object.keys(doc)) {
      let bytes = 0;
      try { bytes = BSON.calculateObjectSize({ [k]: doc[k] }); } catch { /* ignore */ }
      topBytes.set(k, (topBytes.get(k) || 0) + bytes);
    }
  }

  const fields = {};
  const refFields = {};
  const statusValues = {};
  const arrays = {};

  for (const [p, s] of [...paths.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const typePct = {};
    const typeTotal = Object.values(s.types).reduce((a, b) => a + b, 0) || 1;
    for (const [t, n] of Object.entries(s.types)) typePct[t] = round((n / typeTotal) * 100, 1);
    fields[p] = { presentPct: round((s.docs / total) * 100, 1), types: typePct };

    if (s.lenDocs > 0) {
      arrays[p] = { maxLength: s.lenMax, avgLength: round(s.lenSum / s.lenDocs), elementTypes: s.elemTypes };
    }

    const last = p.split(".").pop();
    const idNamed = idLikeNames ? idLikeNames.test(last) : false;
    const idTypes = (s.types.objectId || 0) + (s.elemTypes.objectId || 0);
    const strTypes = (s.types.string || 0) + (s.elemTypes.string || 0);
    if (idTypes > 0 || (idNamed && strTypes > 0)) {
      const all = idTypes + strTypes + Object.entries(s.types).filter(([t]) => t !== "objectId" && t !== "string" && t !== "array").reduce((a, [, n]) => a + n, 0) || 1;
      refFields[p] = {
        objectIdPct: round((idTypes / all) * 100, 1),
        stringPct: round((strTypes / all) * 100, 1),
        stringsThatLookLikeObjectId: s.hexStrings,
        mixed: idTypes > 0 && strTypes > 0,
      };
    }

    if (wantsValues(p) && s.strings > 0) {
      if (s.unsafeValue) statusValues[p] = { suppressed: "values do not look like short codes" };
      else if (s.distinctOverflow) statusValues[p] = { suppressed: `${MAX_DISTINCT} or more distinct values` };
      else statusValues[p] = { distinctCount: s.distinct.size, values: [...s.distinct].sort() };
    }
  }

  const topLevelFieldAvgBytes = [...topBytes.entries()]
    .map(([k, b]) => [k, Math.round(b / total)])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([field, avgBytes]) => ({ field, avgBytes }));

  return { sampled: total, pathCapHit, fields, arrays, refFields, statusValues, topLevelFieldAvgBytes };
}

// Remove literal values from an index partialFilterExpression; keep field names, operators and $type.
function redactFilter(node, parentKey = "") {
  if (Array.isArray(node)) return node.map((n) => redactFilter(n, parentKey));
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = redactFilter(v, k);
    return out;
  }
  if (parentKey === "$type" || parentKey === "$exists") return node;
  if (typeof node === "string") return "<string>";
  return node; // numbers / booleans
}

function describeIndex(ix) {
  const out = { name: ix.name, key: ix.key };
  for (const flag of ["unique", "sparse", "expireAfterSeconds", "background", "hidden"]) {
    if (ix[flag] !== undefined) out[flag] = ix[flag];
  }
  if (ix.partialFilterExpression) out.partialFilterExpression = redactFilter(ix.partialFilterExpression);
  if (ix.collation) out.collation = { locale: ix.collation.locale, strength: ix.collation.strength };
  if (ix.weights) out.textFields = Object.keys(ix.weights);
  return out;
}

function errInfo(err) {
  return { error: String(err.codeName || err.code || err.name || "error") };
}

// ───────────────────────── database access (read-only calls only) ─────────────────────────
async function assertReadOnlyUser(db) {
  const res = await db.admin().command({ connectionStatus: 1, showPrivileges: true });
  const privileges = res.authInfo?.authenticatedUserPrivileges || [];
  const roles = (res.authInfo?.authenticatedUserRoles || []).map((r) => r.role);
  const badRoles = roles.filter((r) => /^(readWrite|readWriteAnyDatabase|dbOwner|dbAdmin|dbAdminAnyDatabase|userAdmin|root|atlasAdmin|clusterAdmin|backup|restore)$/.test(r));
  const badActions = new Set();
  for (const p of privileges) for (const a of p.actions || []) if (WRITE_ACTIONS.has(a)) badActions.add(a);
  if (badRoles.length || badActions.size) {
    throw new Error(
      `The connected user is not read-only (roles: ${badRoles.join(", ") || "-"}; write actions: ${[...badActions].join(", ") || "-"}). ` +
        "Create an Atlas database user with the built-in 'read' role (or 'Only read any database') and use that. Nothing was queried."
    );
  }
  return { roles };
}

async function aggregateSafe(coll, pipeline) {
  assertReadOnlyPipeline(pipeline);
  return coll.aggregate(pipeline, { maxTimeMS: QUERY_TIMEOUT_MS, allowDiskUse: false }).toArray();
}

async function loadSchemaRefs() {
  // Optional: which fields the Mongoose schemas declare as refs. Loading models never opens a connection.
  const refs = {};
  try {
    mongoose.set("autoIndex", false);
    mongoose.set("autoCreate", false);
    const dir = path.resolve(__dirname, "..", "models");
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".js")) continue;
      try { require(path.join(dir, f)); } catch { /* helper files that are not models */ }
    }
    for (const model of Object.values(mongoose.models)) {
      const byPath = {};
      model.schema.eachPath((p, type) => {
        const ref = type.options?.ref || type.caster?.options?.ref;
        if (ref && typeof ref === "string") byPath[p] = ref;
      });
      if (Object.keys(byPath).length) refs[model.collection.name] = byPath;
    }
  } catch { /* optional */ }
  return refs;
}

async function profileCollection(db, info, args, schemaRefs) {
  const name = info.name;
  const coll = db.collection(name);
  const result = { name };

  try {
    const st = await db.command({ collStats: name });
    result.stats = {
      documentCount: st.count,
      avgDocumentSizeBytes: Math.round(st.avgObjSize || 0),
      dataSizeBytes: st.size,
      storageSizeBytes: st.storageSize,
      totalIndexSizeBytes: st.totalIndexSize,
      indexSizesBytes: st.indexSizes,
    };
  } catch (err) {
    result.stats = errInfo(err);
  }

  let usage = {};
  try {
    const rows = await aggregateSafe(coll, [{ $indexStats: {} }]);
    for (const r of rows) usage[r.name] = { ops: Number(r.accesses?.ops ?? 0), since: r.accesses?.since ? new Date(r.accesses.since).toISOString() : null };
  } catch (err) {
    usage = { _unavailable: errInfo(err).error };
  }
  try {
    const idx = await coll.listIndexes().toArray();
    result.indexes = idx.map((ix) => ({ ...describeIndex(ix), usage: usage[ix.name] || null }));
  } catch (err) {
    result.indexes = errInfo(err);
  }

  try {
    const sample = await aggregateSafe(coll, [{ $sample: { size: args.sample } }]);
    const idLikeNames = /(Id|Ids|By)$|^(user|patient|doctor|appointment|partner|payment|invoice|message|mailbox|campaign|recipient|link|admin|owner|author|assignedTo|createdBy|updatedBy|sender|session)$/;
    const profile = profileDocuments(sample, { idLikeNames });
    const declared = schemaRefs[name] || {};
    for (const [p, info2] of Object.entries(profile.refFields)) if (declared[p]) info2.declaredRefModel = declared[p];
    for (const [p, model] of Object.entries(declared)) {
      // declared refs that never appeared in the sample are still worth listing
      if (!profile.refFields[p] && profile.fields[p]) profile.refFields[p] = { declaredRefModel: model, note: "declared ref; no ObjectId/id-like string seen in sample" };
    }
    result.sample = profile;

    if (args.fullDistinct) {
      for (const p of Object.keys(profile.statusValues)) {
        if (!profile.statusValues[p].suppressed || profile.statusValues[p].suppressed.includes("distinct")) {
          try {
            const rows = await aggregateSafe(coll, [{ $group: { _id: `$${p}` } }, { $limit: MAX_DISTINCT + 1 }]);
            const vals = rows.map((r) => r._id).filter((v) => typeof v === "string");
            if (rows.length > MAX_DISTINCT) profile.statusValues[p] = { suppressed: `${MAX_DISTINCT} or more distinct values (full scan)` };
            else if (vals.every((v) => SAFE_VALUE_RE.test(v))) profile.statusValues[p] = { distinctCount: vals.length, values: vals.sort(), scope: "whole collection" };
          } catch { /* keep sample result */ }
        }
      }
    }
  } catch (err) {
    result.sample = errInfo(err);
  }
  return result;
}

// ───────────────────────── self test (no database) ─────────────────────────
function selfTest() {
  const { ObjectId, Int32, Double } = mongoose.mongo;
  const oid = () => new ObjectId();
  const docs = [];
  for (let i = 0; i < 50; i++) {
    docs.push({
      _id: oid(),
      userId: i % 5 === 0 ? String(oid()) : oid(),
      status: i % 2 ? "paid" : "unpaid",
      email: `person${i}@example.com`,
      notes: "free text that must never be reported " + i,
      price: i % 3 ? new Double(10.5) : new Int32(10),
      items: Array.from({ length: i % 4 }, (_, n) => ({ label: `x${n}`, qty: 1 })),
      map: { [String(oid())]: 1, "a@b.co": 2 },
      type: "some free text that is longer than forty characters for sure, yes",
    });
  }
  const p = profileDocuments(docs, { idLikeNames: /(Id|Ids|By)$/ });
  const dump = JSON.stringify(p);
  const checks = [
    ["status values reported", p.statusValues.status?.values?.join() === "paid,unpaid"],
    ["free-text 'type' suppressed", !!p.statusValues.type?.suppressed],
    ["no email value in report", !dump.includes("example.com")],
    ["no notes text in report", !dump.includes("free text that must")],
    ["dynamic keys collapsed", dump.includes("<dynamic>") && !dump.includes("a@b.co")],
    ["mixed ObjectId/String ref detected", p.refFields.userId?.mixed === true],
    ["array length stats", p.arrays.items?.maxLength === 3],
    ["int vs double seen", !!p.fields.price.types.int && !!p.fields.price.types.double],
  ];
  let ok = true;
  for (const [label, pass] of checks) {
    console.log(`${pass ? "PASS" : "FAIL"}  ${label}`);
    if (!pass) ok = false;
  }
  process.exit(ok ? 0 : 1);
}

// ───────────────────────── main ─────────────────────────
async function main() {
  const args = parseArgs(process.argv);
  if (args.selftest) return selfTest();

  const uri = process.env.DB_PROFILE_URI;
  if (!uri) throw new Error("Set DB_PROFILE_URI to a READ-ONLY connection string (this script does not read .env files).");
  const outFile = assertOutsideRepo(args.out || path.join(os.homedir(), "db-profile", "db-profile.json"));

  const client = new MongoClient(uri, {
    appName: "dbProfile-readonly",
    readPreference: "secondaryPreferred", // keep load off the primary when a secondary exists
    promoteValues: false, // keeps Int32 / Double / Long distinguishable
    serverSelectionTimeoutMS: 15000,
  });
  await client.connect();
  try {
    const db = client.db(args.db || undefined);
    const who = await assertReadOnlyUser(db);

    const infos = (await db.listCollections({}, { nameOnly: false }).toArray())
      .filter((c) => c.type !== "view" && !c.name.startsWith("system."))
      .sort((a, b) => a.name.localeCompare(b.name));
    const schemaRefs = await loadSchemaRefs();

    const collections = [];
    for (const info of infos) {
      process.stdout.write(`profiling ${info.name} ... `);
      const c = await profileCollection(db, info, args, schemaRefs);
      collections.push(c);
      console.log("done");
    }

    const report = {
      generatedAt: new Date().toISOString(),
      database: db.databaseName,
      sampleSizePerCollection: args.sample,
      readOnlyUserRoles: who.roles,
      note: "Field names, BSON types, counts, percentages and sizes only. Values appear only for status-like fields with fewer than 30 short-code values.",
      collections,
    };
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(report, null, 2), "utf8");
    console.log(`\nReport written to: ${outFile}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(`dbProfile failed: ${err.message}`);
  process.exit(1);
});
