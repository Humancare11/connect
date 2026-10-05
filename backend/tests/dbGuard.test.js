const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { assertNotProductionDb, parseMongoHosts } = require("../utils/dbGuard");

const SECRET = "s3cr3t-p@ss/word";
const PROD = `mongodb://user:${SECRET}@ac-aaa-shard-00-00.prod1.mongodb.net:27017,ac-aaa-shard-00-01.prod1.mongodb.net:27017/authDB?ssl=true`;
const UAT = `mongodb://user:${SECRET}@ac-bbb-shard-00-00.uat1.mongodb.net:27017,ac-bbb-shard-00-01.uat1.mongodb.net:27017/authDB?ssl=true`;
const env = { PRODUCTION_MONGO_HOSTS: "prod1.mongodb.net" };

describe("dbGuard", () => {
  test("parses every host out of a multi-host URI, ignoring credentials, ports and database", () => {
    assert.deepEqual(parseMongoHosts(PROD), ["ac-aaa-shard-00-00.prod1.mongodb.net", "ac-aaa-shard-00-01.prod1.mongodb.net"]);
    assert.deepEqual(parseMongoHosts("mongodb+srv://u:p@cluster0.prod1.mongodb.net/db"), ["cluster0.prod1.mongodb.net"]);
    assert.deepEqual(parseMongoHosts("mongodb://localhost:27017/x"), ["localhost"]);
  });

  test("cannot be fooled by unescaped / or @ inside the password", () => {
    for (const pw of ["a/b", "a@b", "x/y@z/w"]) {
      const uri = `mongodb://user:${pw}@ac-aaa-shard-00-00.prod1.mongodb.net:27017/authDB?ssl=true`;
      assert.deepEqual(parseMongoHosts(uri), ["ac-aaa-shard-00-00.prod1.mongodb.net"], pw);
      assert.throws(() => assertNotProductionDb({ uri, env }), /production database cluster/, pw);
    }
  });

  test("refuses the production cluster even though UAT uses the same database name", () => {
    assert.throws(() => assertNotProductionDb({ uri: PROD, env }), /production database cluster/);
    assert.deepEqual(assertNotProductionDb({ uri: UAT, env }).hosts.length, 2);
  });

  test("allows a local database", () => {
    assert.ok(assertNotProductionDb({ uri: "mongodb://127.0.0.1:27017/authDB", env }));
  });

  test("matches by cluster domain, case-insensitively, but not look-alike hosts", () => {
    assert.throws(() => assertNotProductionDb({ uri: "mongodb://U:p@HOST.PROD1.MONGODB.NET/x", env }));
    assert.ok(assertNotProductionDb({ uri: "mongodb://u:p@evilprod1.mongodb.net/x", env }));
  });

  test("fails closed when the production host list is not configured", () => {
    assert.throws(() => assertNotProductionDb({ uri: UAT, env: {} }), /PRODUCTION_MONGO_HOSTS is not set/);
    assert.throws(() => assertNotProductionDb({ uri: UAT, env: { PRODUCTION_MONGO_HOSTS: " , " } }), /not set/);
  });

  test("refuses under NODE_ENV=production and when the URI has no host", () => {
    assert.throws(() => assertNotProductionDb({ uri: UAT, env: { ...env, NODE_ENV: "production" } }), /NODE_ENV is production/);
    assert.throws(() => assertNotProductionDb({ uri: "", env }), /no host/);
    assert.throws(() => assertNotProductionDb({ uri: undefined, env }), /no host/);
  });

  test("error messages never contain the credentials", () => {
    for (const [uri, e] of [[PROD, env], [UAT, {}], ["", env]]) {
      try {
        assertNotProductionDb({ uri, env: e });
      } catch (err) {
        assert.ok(!err.message.includes(SECRET) && !err.message.includes("user:"), err.message);
      }
    }
  });
});
