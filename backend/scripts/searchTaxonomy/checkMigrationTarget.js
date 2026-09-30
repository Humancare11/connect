// READ-ONLY check of a search-taxonomy migration target (PR 4.6).
//
// Connects to SEARCH_MIGRATION_MONGO_URI (never MONGO_URI) and reports the
// database name, server version, topology / transaction support, the
// taxonomy counts and indexes, whether sensitive collections or unsanitized
// doctor data are present, and whether the current plan fits this target.
//
// It NEVER writes: the shared driver-level guard allows no write at all, and
// Mongoose autoIndex/autoCreate are off. It creates no collection or index.
//
// Refused before connecting, with NO override (unlike the apply script):
//   - database name authDB (the live/shared database);
//   - the same host(s) + database as the backend's MONGO_URI (.env / .env.production);
//   - NODE_ENV=production;
//   - a missing SEARCH_MIGRATION_MONGO_URI, or one without an explicit database.
// Credentials and connection strings are never printed.
//
// Usage (from backend/):
//   node --env-file=.env.search-dev scripts/searchTaxonomy/checkMigrationTarget.js
// Exit codes: 0 ready · 3 reachable but not ready · 1 refused or failed.
const fs = require("fs");
const path = require("path");

const { installWriteGuard } = require("./dbWriteGuard");
const { assertTargetAllowed, parseMongoUri, MigrationAbort } = require("./applySearchTaxonomyMigration");

const BACKEND_DIR = path.resolve(__dirname, "..", "..");
const PLAN_FILE = path.join(__dirname, "searchTaxonomyMigrationPlan.json");

const TAXONOMY_COLLECTIONS = ["healthcarecategories", "healthcarespecialties", "healthcareconditions"];
// Needed only for doctor-search testing, and only in sanitized form.
const DOCTOR_COLLECTIONS = ["doctors", "enrollments"];
const PLANNED_CONDITION_INDEXES = ["uniq_specialty_condition_name", "uniq_condition_legacyId", "uniq_specialty_condition_slug"];

// Collections that must never be copied into the non-production database
// (patient, clinical, payment, auth, audit and uploaded-document data).
const SENSITIVE_COLLECTIONS = [
  "appointments", "auditlogs", "categoryconsultations", "chatmessages", "consents",
  "consultationnotes", "consultations", "consumedpayments", "directcallalerts",
  "directroomevents", "directvideorooms", "employeetasks", "gops", "invoices",
  "manualinvoices", "medicalcertificates", "otps", "partnercases", "partners",
  "passwordhistories", "paymentlinks", "payments", "prescriptions", "questions",
  "revokedtokens", "securityincidents", "sessions", "tickets", "uploads.chunks",
  "uploads.files", "users", "usertickets",
];
// Private fields whose presence means doctor data was copied unsanitized.
const PRIVATE_DOCTOR_FIELDS = {
  doctors: ["password", "googleId", "appleId", "disabledReason"],
  enrollments: [
    "email", "phoneNumber", "dob", "address", "zip", "clinicName", "clinicAddress",
    "medicalRegistrationNumber", "medicalLicense", "idProof", "degreeFile",
    "medicalLicenseFile", "malpracticeInsuranceFile", "payoutEmail", "paypalId",
    "stripeAccountId", "accountHolderName", "bankName", "accountNumber", "ifscCode",
    "profilePhoto", "availability", "pendingProfileChanges", "profileUpdateSnapshot",
  ],
};

// ── Pure helpers ────────────────────────────────────────────────────────────

// Replaces every connection string, and the credentials of `uri`, with ***.
function redact(text, uri) {
  let out = String(text ?? "");
  const creds = /^mongodb(?:\+srv)?:\/\/([^@/]*)@/.exec(String(uri || ""));
  if (uri) out = out.split(String(uri)).join("***");
  if (creds) {
    for (const part of [creds[1], ...creds[1].split(":")].filter((p) => p.length >= 3)) {
      out = out.split(part).join("***");
      out = out.split(decodeURIComponent(part)).join("***");
    }
  }
  return out.replace(/mongodb(?:\+srv)?:\/\/[^\s"'`]+/g, "mongodb://***");
}

// A description of the URI that contains no credentials, hosts or values.
function describeUri(uri) {
  const match = /^(mongodb(?:\+srv)?):\/\/(?:([^@/]*)@)?([^/?]+)(?:\/([^?]*))?(?:\?(.*))?$/.exec(String(uri || ""));
  if (!match) return null;
  return {
    scheme: match[1],
    credentialsPresent: Boolean(match[2]),
    hostCount: match[3].split(",").length,
    database: match[4] ? decodeURIComponent(match[4]) : null,
    optionNames: match[5] ? match[5].split("&").map((kv) => kv.split("=")[0]) : [],
  };
}

// Same rules as the apply script, but a protected target can never be
// unlocked here: the protected-database override is ignored.
function resolveCheckTarget({ uri, env = {}, appUris = [] }) {
  let dbName;
  try {
    ({ dbName } = assertTargetAllowed({
      uri,
      env: { NODE_ENV: env.NODE_ENV },
      args: { allowProtected: false },
      appUris,
    }));
  } catch (err) {
    // The apply script's hint about override flags does not apply here.
    throw new MigrationAbort(`${String(err.message).split(" A future,")[0]} (no override exists for this check).`);
  }
  const target = parseMongoUri(uri);
  const sharedClusterWithApp = appUris.some((u) => parseMongoUri(u)?.hosts === target.hosts);
  return { dbName, sharedClusterWithApp };
}

function readAppMongoUris() {
  const dotenv = require("dotenv");
  return [".env", ".env.production"]
    .map((f) => path.join(BACKEND_DIR, f))
    .filter((f) => fs.existsSync(f))
    .map((f) => dotenv.parse(fs.readFileSync(f)).MONGO_URI)
    .filter(Boolean);
}

// ── Read-only inspection ────────────────────────────────────────────────────

// `db` is a MongoDB driver Db. Only read operations are used.
async function inspectTarget(db, plan) {
  const admin = db.admin();
  const [hello, build, collectionInfos] = await Promise.all([
    admin.command({ hello: 1 }),
    admin.command({ buildInfo: 1 }),
    db.listCollections({}, { nameOnly: true }).toArray(),
  ]);
  const names = new Set(collectionInfos.map((c) => c.name));
  const topology = hello.msg === "isdbgrid" ? "sharded" : hello.setName ? "replicaSet" : "standalone";

  const counts = {};
  const indexes = {};
  for (const name of [...TAXONOMY_COLLECTIONS, ...DOCTOR_COLLECTIONS]) {
    if (!names.has(name)) continue; // eslint-disable-line no-continue
    counts[name] = await db.collection(name).countDocuments({});
    if (TAXONOMY_COLLECTIONS.includes(name)) {
      indexes[name] = (await db.collection(name).listIndexes().toArray()).map((i) => ({
        name: i.name,
        key: i.key,
        unique: Boolean(i.unique),
        collation: i.collation ? `${i.collation.locale}/${i.collation.strength}` : null,
      }));
    }
  }
  const unsanitized = {};
  for (const [collection, fields] of Object.entries(PRIVATE_DOCTOR_FIELDS)) {
    if (!names.has(collection)) continue; // eslint-disable-line no-continue
    const present = [];
    for (const field of fields) {
      if (await db.collection(collection).countDocuments({ [field]: { $exists: true } }, { limit: 1 })) present.push(field);
    }
    if (present.length) unsanitized[collection] = present;
  }

  return {
    database: db.databaseName,
    serverVersion: build.version,
    topology,
    transactionsSupported: topology !== "standalone" && hello.logicalSessionTimeoutMinutes != null,
    collections: [...names].sort(),
    counts,
    indexes,
    sensitiveCollectionsPresent: SENSITIVE_COLLECTIONS.filter((c) => names.has(c)),
    unsanitizedDoctorFields: unsanitized,
    plannedIndexesPresent: PLANNED_CONDITION_INDEXES.filter((n) => (indexes.healthcareconditions || []).some((i) => i.name === n)),
    plan: plan
      ? {
          generatedAgainst: plan.liveSnapshot?.database || null,
          matchesTarget: plan.liveSnapshot?.database === db.databaseName,
          operationsSha256: String(plan.operationsSha256 || "").slice(0, 12),
        }
      : null,
  };
}

// Readiness verdict for the future migration. Blocking reasons make it "NOT READY".
function assessReadiness(result) {
  const blocking = [];
  const notes = [];
  if (!result.transactionsSupported) {
    blocking.push(`Topology "${result.topology}" has no transactions. A replica set or sharded cluster is required.`);
  }
  for (const name of TAXONOMY_COLLECTIONS) {
    if (!result.counts[name]) blocking.push(`${name} is missing or empty; the taxonomy must be present before planning.`);
  }
  if (result.sensitiveCollectionsPresent.length) {
    blocking.push(`Sensitive collections present (must not be copied): ${result.sensitiveCollectionsPresent.join(", ")}.`);
  }
  for (const [collection, fields] of Object.entries(result.unsanitizedDoctorFields)) {
    blocking.push(`${collection} contains private fields (unsanitized copy): ${fields.join(", ")}.`);
  }
  if (result.plan && !result.plan.matchesTarget) {
    notes.push(`The current plan was generated against "${result.plan.generatedAgainst}". Regenerate it against "${result.database}" before any apply.`);
  }
  if (result.plannedIndexesPresent.length) {
    notes.push(`Planned indexes already present: ${result.plannedIndexesPresent.join(", ")}.`);
  }
  for (const name of DOCTOR_COLLECTIONS) {
    if (!result.counts[name]) notes.push(`${name} is missing or empty: fine for the taxonomy migration, needed later for doctor-search testing.`);
  }
  return { ready: blocking.length === 0, blocking, notes };
}

function formatReport({ describe, sharedClusterWithApp, runtimeDatabase, result, verdict }) {
  const lines = [
    "=== SEARCH MIGRATION TARGET CHECK (read-only) ===",
    `target database:     ${result.database}`,
    `uri:                 ${describe.scheme}://***  (hosts: ${describe.hostCount}, credentials: ${describe.credentialsPresent ? "present, not shown" : "none"}, options: ${describe.optionNames.join(", ") || "none"})`,
    `same cluster as app: ${sharedClusterWithApp ? "YES (different database; use a user scoped to this database only)" : "no"}`,
    `runtime MONGO_URI:   ${runtimeDatabase ? `database "${runtimeDatabase}"` : "not set in this process"}`,
    `server version:      ${result.serverVersion}`,
    `topology:            ${result.topology} · transactions: ${result.transactionsSupported ? "supported" : "NOT supported"}`,
    `counts:              ${Object.entries(result.counts).map(([k, v]) => `${k}=${v}`).join(", ") || "(none)"}`,
  ];
  for (const [name, list] of Object.entries(result.indexes)) {
    lines.push(`indexes ${name}: ${list.map((i) => `${i.name}${i.unique ? " (unique" + (i.collation ? `, ${i.collation}` : "") + ")" : ""}`).join(", ")}`);
  }
  if (result.plan) lines.push(`plan:                generated against "${result.plan.generatedAgainst}" (${result.plan.operationsSha256}…) → ${result.plan.matchesTarget ? "matches" : "must be regenerated"}`);
  lines.push(`verdict:             ${verdict.ready ? "READY for planning" : "NOT READY"}`);
  verdict.blocking.forEach((b) => lines.push(`  ✗ ${b}`));
  verdict.notes.forEach((n) => lines.push(`  · ${n}`));
  lines.push("No writes were attempted: this check is read-only.");
  return lines.join("\n");
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const uri = process.env.SEARCH_MIGRATION_MONGO_URI;
  const appUris = readAppMongoUris();
  const { dbName, sharedClusterWithApp } = resolveCheckTarget({ uri, env: process.env, appUris });
  const describe = describeUri(uri);

  const mongoose = require("mongoose");
  const guard = installWriteGuard(mongoose, { label: "TARGET-CHECK" });
  let plan = null;
  try {
    plan = JSON.parse(fs.readFileSync(PLAN_FILE, "utf8"));
  } catch {
    plan = null;
  }

  await mongoose.connect(uri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 15000 });
  let result;
  try {
    const db = mongoose.connection.db;
    if (db.databaseName !== dbName) throw new MigrationAbort(`Connected to "${db.databaseName}", expected "${dbName}".`);
    result = await inspectTarget(db, plan);
  } finally {
    await mongoose.disconnect();
  }
  if (guard.summary().writeAttempts) throw new MigrationAbort("A write was attempted and blocked; see the guard.");

  const runtimeDatabase = describeUri(process.env.MONGO_URI)?.database || null;
  const verdict = assessReadiness(result);
  console.log(formatReport({ describe, sharedClusterWithApp, runtimeDatabase, result, verdict }));
  process.exitCode = verdict.ready ? 0 : 3;
}

if (require.main === module) {
  main().catch((e) => {
    const uri = process.env.SEARCH_MIGRATION_MONGO_URI;
    const message = e instanceof MigrationAbort ? e.message : `${e.name}: ${e.message}`;
    console.error(`REFUSED/FAILED: ${redact(message, uri)}`);
    process.exit(1);
  });
}

module.exports = {
  redact,
  describeUri,
  resolveCheckTarget,
  inspectTarget,
  assessReadiness,
  formatReport,
  SENSITIVE_COLLECTIONS,
  PRIVATE_DOCTOR_FIELDS,
  TAXONOMY_COLLECTIONS,
};
