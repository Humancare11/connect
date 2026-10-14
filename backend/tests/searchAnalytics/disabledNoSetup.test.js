// With SEARCH_ANALYTICS_ENABLED off (the default), loading the analytics
// models must not create their collections or indexes on a live database;
// when the flag is exactly "true" it must (Mongoose's normal setup).
// Runs against an ephemeral mongodb-memory-server, never a configured URI.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { analyticsSchemaOptions } = require("../../services/searchAnalytics/constants");

const NAMES = ["searchinteractions", "searchtermdailystats"];

// Loads the models in a fresh process (schema options are read at load time),
// connects, lets Mongoose settle its automatic init, and prints what exists.
const CHILD = `
const mongoose = require("mongoose");
const Other = mongoose.model("OtherProbe", new mongoose.Schema({ k: { type: String, index: true } }));
require("./models/SearchInteraction"); require("./models/SearchTermDailyStat");
(async () => {
  await mongoose.connect(process.env.PROBE_URI);
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  const db = mongoose.connection.db;
  const cols = (await db.listCollections().toArray()).map((c) => c.name);
  const out = { cols, idx: {} };
  for (const n of cols) out.idx[n] = (await db.collection(n).indexes()).map((i) => i.name);
  console.log("RESULT" + JSON.stringify(out));
  await mongoose.disconnect();
})();`;

describe("analytics collection/index setup follows the flag", { timeout: 240000 }, () => {
  let mongod;
  before(async () => { mongod = await MongoMemoryServer.create(); });
  after(async () => { await mongod.stop(); });

  const probe = async (flag, dbName) => {
    const env = { ...process.env, PROBE_URI: mongod.getUri(dbName) };
    delete env.SEARCH_ANALYTICS_ENABLED;
    if (flag !== undefined) env.SEARCH_ANALYTICS_ENABLED = flag;
    const out = execFileSync(process.execPath, ["-e", CHILD], { cwd: path.join(__dirname, "../.."), env, encoding: "utf8" });
    return JSON.parse(out.split("RESULT")[1]);
  };

  for (const [label, flag] of [["unset", undefined], ["false", "false"], ["TRUE", "TRUE"], ["1", "1"]]) {
    test(`flag ${label}: no analytics collection or index is created; other models still index`, async () => {
      const r = await probe(flag, `off_${label}`);
      for (const n of NAMES) {
        assert.ok(!r.cols.includes(n), `${n} was created`);
        assert.equal(r.idx[n], undefined);
      }
      assert.ok(r.idx.otherprobes?.includes("k_1"), "existing models keep their auto indexes");
    });
  }

  test('flag exactly "true": collections and all indexes are created', async () => {
    const r = await probe("true", "on");
    for (const n of NAMES) assert.ok(r.cols.includes(n), `${n} missing`);
    assert.ok(r.idx.searchinteractions.includes("interactionId_1"));
    assert.ok(r.idx.searchinteractions.includes("expiresAt_1"));
    assert.ok(r.idx.searchtermdailystats.includes("expiresAt_1"));
    assert.ok(r.idx.otherprobes.includes("k_1"));
  });

  test("analyticsSchemaOptions only enables on the exact string", () => {
    assert.deepEqual(analyticsSchemaOptions({}), { autoIndex: false, autoCreate: false });
    assert.deepEqual(analyticsSchemaOptions({ SEARCH_ANALYTICS_ENABLED: "yes" }), { autoIndex: false, autoCreate: false });
    assert.deepEqual(analyticsSchemaOptions({ SEARCH_ANALYTICS_ENABLED: "true" }), { autoIndex: true, autoCreate: true });
  });
});
