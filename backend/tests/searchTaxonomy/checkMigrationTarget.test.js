// checkMigrationTarget.js: target safety, secret handling and read-only
// inspection. Mocked/in-memory only; no database connection is ever opened
// (the child-process cases are refused before connecting).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const {
  redact,
  describeUri,
  resolveCheckTarget,
  inspectTarget,
  assessReadiness,
  formatReport,
} = require("../../scripts/searchTaxonomy/checkMigrationTarget");

const BACKEND = path.join(__dirname, "..", "..");
const SCRIPT = path.join(BACKEND, "scripts", "searchTaxonomy", "checkMigrationTarget.js");
// Fake values only; ".invalid" hosts can never resolve.
const SECRET_USER = "svcUserZ9";
const SECRET_PASS = "Pa55w0rdQ7";
const APP_URI = `mongodb://${SECRET_USER}:${SECRET_PASS}@h1.db.invalid:27017,h2.db.invalid:27017/authDB?replicaSet=rs0`;
const DEV_URI = `mongodb://${SECRET_USER}:${SECRET_PASS}@h1.db.invalid:27017,h2.db.invalid:27017/authDB_search_dev?replicaSet=rs0`;

test("authDB is rejected, in any letter case", () => {
  for (const db of ["authDB", "AUTHDB", "authdb"]) {
    assert.throws(() => resolveCheckTarget({ uri: `mongodb://h.db.invalid/${db}`, env: {} }), /protected live\/shared/);
  }
});

test("NODE_ENV=production is rejected", () => {
  assert.throws(() => resolveCheckTarget({ uri: "mongodb://h.db.invalid/authDB_search_dev", env: { NODE_ENV: "production" } }), /production/);
});

test("a missing SEARCH_MIGRATION_MONGO_URI is rejected (no MONGO_URI fallback)", () => {
  assert.throws(() => resolveCheckTarget({ uri: undefined, env: { MONGO_URI: DEV_URI } }), /SEARCH_MIGRATION_MONGO_URI is required/);
  assert.throws(() => resolveCheckTarget({ uri: "mongodb://h.db.invalid", env: {} }), /name the target database/);
});

test("the backend's own MONGO_URI database is never accepted as the target", () => {
  const sameAsApp = APP_URI.replace("/authDB?", "/appdb?");
  assert.throws(() => resolveCheckTarget({ uri: sameAsApp, env: {}, appUris: [sameAsApp] }), /backend's own MONGO_URI/);
});

test("the protected-database override does not exist in the checker", () => {
  const env = { SEARCH_MIGRATION_ALLOW_PROTECTED_DB: "authDB" };
  assert.throws(() => resolveCheckTarget({ uri: "mongodb://h.db.invalid/authDB", env }), /no override exists/);
});

test("a different, non-production database is accepted", () => {
  const onSameCluster = resolveCheckTarget({ uri: DEV_URI, env: { NODE_ENV: "development" }, appUris: [APP_URI] });
  assert.deepEqual(onSameCluster, { dbName: "authDB_search_dev", sharedClusterWithApp: true });
  const elsewhere = resolveCheckTarget({ uri: "mongodb://localhost:27017/authDB_search_dev?replicaSet=rs0", env: {}, appUris: [APP_URI] });
  assert.deepEqual(elsewhere, { dbName: "authDB_search_dev", sharedClusterWithApp: false });
});

test("credentials and connection strings are redacted from any message", () => {
  const leaky = `failed to connect to ${DEV_URI} as ${SECRET_USER} with ${SECRET_PASS}`;
  const out = redact(leaky, DEV_URI);
  for (const secret of [SECRET_USER, SECRET_PASS, "h1.db.invalid", "mongodb://svc"]) assert.ok(!out.includes(secret), secret);
  assert.ok(!redact(`see mongodb+srv://a:b@c.example/x`, null).includes("a:b@"));
  const described = describeUri(DEV_URI);
  assert.deepEqual(described, { scheme: "mongodb", credentialsPresent: true, hostCount: 2, database: "authDB_search_dev", optionNames: ["replicaSet"] });
  assert.ok(!JSON.stringify(described).includes(SECRET_PASS));
});

// A read-only mock of the driver Db. Any write method is absent, so calling
// one would throw a TypeError and fail the test.
function mockDb({ collections, topology = "replicaSet", fields = {} }) {
  const calls = [];
  const coll = (name) => ({
    countDocuments: async (filter) => {
      calls.push(`${name}.countDocuments`);
      const field = Object.keys(filter || {})[0];
      if (field) return (fields[name] || []).includes(field) ? 1 : 0;
      return collections[name]?.count ?? 0;
    },
    listIndexes: () => ({ toArray: async () => (calls.push(`${name}.listIndexes`), collections[name]?.indexes || [{ name: "_id_", key: { _id: 1 } }]) }),
  });
  return {
    calls,
    databaseName: "authDB_search_dev",
    admin: () => ({
      command: async (cmd) => {
        calls.push(`admin.${Object.keys(cmd)[0]}`);
        if (cmd.buildInfo) return { version: "8.0.32" };
        return topology === "replicaSet" ? { setName: "rs0", logicalSessionTimeoutMinutes: 30 } : { logicalSessionTimeoutMinutes: 30 };
      },
    }),
    listCollections: () => ({ toArray: async () => (calls.push("listCollections"), Object.keys(collections).map((name) => ({ name }))) }),
    collection: coll,
  };
}

const taxonomy = {
  healthcarecategories: { count: 11 },
  healthcarespecialties: { count: 30 },
  healthcareconditions: { count: 3, indexes: [{ name: "_id_", key: { _id: 1 } }, { name: "specialtyId_1_name_1", key: { specialtyId: 1, name: 1 } }] },
};
const plan = { liveSnapshot: { database: "authDB" }, operationsSha256: "18e71b0cb91f124d" };

test("inspection uses read operations only and reports a clean target as ready", async () => {
  const db = mockDb({ collections: { ...taxonomy, doctors: { count: 40 }, enrollments: { count: 40 } } });
  const result = await inspectTarget(db, plan);
  assert.ok(db.calls.every((c) => /\.(countDocuments|listIndexes)$|^admin\.(hello|buildInfo)$|^listCollections$/.test(c)), db.calls.join());
  assert.equal(result.transactionsSupported, true);
  assert.deepEqual(result.counts, { healthcarecategories: 11, healthcarespecialties: 30, healthcareconditions: 3, doctors: 40, enrollments: 40 });
  const verdict = assessReadiness(result);
  assert.equal(verdict.ready, true);
  assert.ok(verdict.notes.some((n) => /Regenerate it against "authDB_search_dev"/.test(n)));
});

test("not ready: standalone, missing taxonomy, sensitive collections, unsanitized doctors", async () => {
  const standalone = assessReadiness(await inspectTarget(mockDb({ collections: taxonomy, topology: "standalone" }), plan));
  assert.ok(standalone.blocking.some((b) => /replica set or sharded/.test(b)));

  const empty = assessReadiness(await inspectTarget(mockDb({ collections: {} }), plan));
  assert.equal(empty.blocking.filter((b) => /missing or empty/.test(b)).length, 3);

  const leaked = assessReadiness(await inspectTarget(mockDb({ collections: { ...taxonomy, users: { count: 5 }, prescriptions: { count: 1 } } }), plan));
  assert.ok(leaked.blocking.some((b) => /Sensitive collections present.*prescriptions, users/.test(b)));

  const raw = assessReadiness(await inspectTarget(mockDb({
    collections: { ...taxonomy, doctors: { count: 2 }, enrollments: { count: 2 } },
    fields: { doctors: ["password"], enrollments: ["email", "accountNumber"] },
  }), plan));
  assert.ok(raw.blocking.some((b) => /doctors contains private fields.*password/.test(b)));
  assert.ok(raw.blocking.some((b) => /enrollments contains private fields.*email, accountNumber/.test(b)));
});

test("the printed report contains no credentials or hosts", async () => {
  const result = await inspectTarget(mockDb({ collections: taxonomy }), plan);
  const text = formatReport({ describe: describeUri(DEV_URI), sharedClusterWithApp: true, runtimeDatabase: "authDB_search_dev", result, verdict: assessReadiness(result) });
  for (const secret of [SECRET_USER, SECRET_PASS, "db.invalid", "mongodb://s"]) assert.ok(!text.includes(secret), secret);
  assert.match(text, /target database: +authDB_search_dev/);
  assert.match(text, /credentials: present, not shown/);
});

// The real script, in a child process: every case below must be refused
// before any connection attempt, without leaking the fake secrets.
function runScript(env) {
  const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(SEARCH_MIGRATION_|MONGO_URI$|NODE_ENV$)/.test(k)));
  return spawnSync(process.execPath, [SCRIPT], { cwd: BACKEND, env: { ...clean, ...env }, encoding: "utf8", timeout: 20000 });
}

test("script refuses authDB, production and a missing target, without printing secrets", () => {
  const cases = [
    [{ SEARCH_MIGRATION_MONGO_URI: APP_URI, NODE_ENV: "development" }, /protected live\/shared/],
    [{ SEARCH_MIGRATION_MONGO_URI: DEV_URI, NODE_ENV: "production" }, /NODE_ENV is production/],
    [{ MONGO_URI: DEV_URI, NODE_ENV: "development" }, /SEARCH_MIGRATION_MONGO_URI is required/],
  ];
  for (const [env, pattern] of cases) {
    const run = runScript(env);
    const output = `${run.stdout}${run.stderr}`;
    assert.equal(run.status, 1, output);
    assert.match(output, /REFUSED\/FAILED/);
    assert.match(output, pattern);
    for (const secret of [SECRET_USER, SECRET_PASS, "db.invalid"]) assert.ok(!output.includes(secret), `leaked ${secret}`);
  }
});

test("static: the checker never targets MONGO_URI and has no write calls", () => {
  const src = fs.readFileSync(SCRIPT, "utf8").replace(/^\s*\/\/.*$/gm, "");
  assert.match(src, /const uri = process\.env\.SEARCH_MIGRATION_MONGO_URI;/);
  assert.match(src, /mongoose\.connect\(uri,/);
  assert.equal((src.match(/process\.env\.MONGO_URI/g) || []).length, 1, "MONGO_URI may only be described, never connected to");
  assert.ok(!/\.(insertOne|insertMany|updateOne|updateMany|replaceOne|deleteOne|deleteMany|bulkWrite|createIndex|createIndexes|dropIndex|drop|createCollection|syncIndexes|save)\s*\(/.test(src));
  assert.match(src, /installWriteGuard\(mongoose, \{ label: "TARGET-CHECK" \}\)/);
});

test("env template has placeholders only, and real env files / results are git-ignored", () => {
  const template = fs.readFileSync(path.join(BACKEND, ".env.search-dev.example"), "utf8");
  const assignments = template.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  for (const line of assignments) {
    const [, value] = line.split(/=(.*)/s);
    assert.ok(/^<[^>]+>$/.test(value) || /^(development|false|\d+|)$/.test(value), `non-placeholder value: ${line.split("=")[0]}`);
  }
  // AI stays off by default and the OpenAI key is never templated here.
  assert.ok(assignments.includes("SEARCH_AI_ENABLED=false"));
  assert.ok(!assignments.some((l) => l.startsWith("OPEN_AI_API_KEY") || l.startsWith("OPENAI_API_KEY")));
  assert.ok(!/sk-[A-Za-z0-9]/.test(template));
  assert.ok(!/mongodb(\+srv)?:\/\/[^<]/.test(template));
  const ignored = (p) => spawnSync("git", ["check-ignore", "-q", p], { cwd: BACKEND }).status === 0;
  assert.ok(ignored(".env"));
  assert.ok(ignored(".env.search-dev"));
  assert.ok(ignored("scripts/searchTaxonomy/results/applyReport-x.json"));
  assert.ok(!ignored(".env.search-dev.example"));
});
