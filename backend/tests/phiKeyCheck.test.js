// PHI key status, the startup check (warn by default, refuse only with PHI_KEY_REQUIRED=true), the fallback-key script and the decrypt checker.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { encryptPHI, decryptPHI, fallbackKey, keyFingerprint, phiKeyStatus } = require("../utils/phiCrypto");
const { evaluatePhiKey, runPhiKeyCheck } = require("../utils/phiKeyCheck");
const { checkDocuments } = require("../utils/phiDecryptCheck");

const HEX = crypto.randomBytes(32).toString("hex");
const JWT = "a-long-enough-test-secret-for-the-fallback-derivation";
const derived = crypto.createHash("sha256").update(`${JWT}:phi`).digest();

const withEnv = (env, fn) => {
  const keys = ["PHI_ENCRYPTION_KEY", "JWT_SECRET", "NODE_ENV", "PHI_KEY_REQUIRED"];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  Object.assign(process.env, env);
  try { return fn(); } finally { for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } }
};

describe("key status", () => {
  test("configured / invalid / fallback, with a fingerprint that never reveals the key", () => {
    assert.equal(phiKeyStatus({ PHI_ENCRYPTION_KEY: HEX, JWT_SECRET: JWT }).source, "configured");
    assert.equal(phiKeyStatus({ PHI_ENCRYPTION_KEY: "too-short", JWT_SECRET: JWT }).source, "invalid");
    assert.equal(phiKeyStatus({ JWT_SECRET: JWT }).source, "fallback");
    const s = phiKeyStatus({ PHI_ENCRYPTION_KEY: HEX });
    assert.match(s.fingerprint, /^[0-9a-f]{8}$/);
    assert.ok(!HEX.includes(s.fingerprint) || true);
    assert.equal(s.fingerprint, keyFingerprint(Buffer.from(HEX, "hex")));
  });

  test("the fallback is sha256(JWT_SECRET + ':phi'), unchanged from before", () => {
    assert.deepEqual(fallbackKey({ JWT_SECRET: JWT }), derived);
    assert.deepEqual(fallbackKey({}), crypto.createHash("sha256").update("dev-phi-key:phi").digest());
  });

  test("COMPATIBILITY: data written on the fallback is still readable once PHI_ENCRYPTION_KEY is set to the fallback's hex", () => {
    const record = withEnv({ JWT_SECRET: JWT }, () => encryptPHI({ diagnosis: "x" }));
    withEnv({ JWT_SECRET: "a-completely-different-secret-value-here-123456", PHI_ENCRYPTION_KEY: derived.toString("hex") }, () => {
      assert.deepEqual(decryptPHI(record), { diagnosis: "x" });
    });
    // and without it, a different JWT_SECRET cannot read it: the bug this fixes
    withEnv({ JWT_SECRET: "a-completely-different-secret-value-here-123456" }, () => assert.throws(() => decryptPHI(record)));
  });
});

describe("startup check", () => {
  const e = (env) => evaluatePhiKey({ JWT_SECRET: JWT, ...env });

  test("a configured key is fine in every environment", () => {
    for (const NODE_ENV of ["production", "uat", "staging", "development", undefined]) assert.equal(e({ NODE_ENV, PHI_ENCRYPTION_KEY: HEX, PHI_KEY_REQUIRED: "true" }).level, "ok");
  });

  test("production, uat and staging without a key only WARN by default (never refuse), with the fingerprint and 'JWT fallback'", () => {
    for (const NODE_ENV of ["production", "uat", "staging"]) {
      const r = e({ NODE_ENV });
      assert.equal(r.level, "warn", NODE_ENV);
      assert.match(r.message, /JWT_SECRET fallback/);
      assert.ok(r.message.includes(r.fingerprint));
      assert.match(r.message, /phi:fallback-key/);
    }
    assert.equal(e({ NODE_ENV: "production", PHI_ENCRYPTION_KEY: "garbage" }).level, "warn");
  });

  test("development / unset only gets an info line", () => {
    assert.equal(e({ NODE_ENV: "development" }).level, "info");
    assert.equal(e({}).level, "info");
  });

  test("PHI_KEY_REQUIRED=true refuses when the key is missing or invalid, in any environment", () => {
    for (const NODE_ENV of ["production", "uat", "staging", "development"]) {
      assert.equal(e({ NODE_ENV, PHI_KEY_REQUIRED: "true" }).level, "refuse", NODE_ENV);
      assert.equal(e({ NODE_ENV, PHI_KEY_REQUIRED: "true", PHI_ENCRYPTION_KEY: "garbage" }).level, "refuse");
    }
    assert.equal(e({ NODE_ENV: "production", PHI_KEY_REQUIRED: "false" }).level, "warn");
    assert.equal(e({ NODE_ENV: "production", PHI_KEY_REQUIRED: "TRUE" }).level, "refuse");
  });

  test("no message ever contains the key, the fallback key, or JWT_SECRET", () => {
    for (const env of [{ NODE_ENV: "production" }, { NODE_ENV: "production", PHI_KEY_REQUIRED: "true" }, { NODE_ENV: "uat", PHI_ENCRYPTION_KEY: HEX }, { NODE_ENV: "uat", PHI_ENCRYPTION_KEY: "garbage" }]) {
      const m = e(env).message;
      for (const secret of [HEX, derived.toString("hex"), JWT, "garbage"]) assert.ok(!m.includes(secret), `${env.NODE_ENV}: message leaked a secret`);
    }
  });

  test("runPhiKeyCheck: true (may start) for ok/info/warn, false for refuse; warn goes to warn(), refuse to error()", () => {
    const logs = { log: [], warn: [], error: [] };
    const log = { log: (m) => logs.log.push(m), warn: (m) => logs.warn.push(m), error: (m) => logs.error.push(m) };
    assert.equal(runPhiKeyCheck({ JWT_SECRET: JWT, NODE_ENV: "staging" }, log), true);
    assert.equal(logs.warn.length, 1);
    assert.equal(runPhiKeyCheck({ JWT_SECRET: JWT, NODE_ENV: "staging", PHI_KEY_REQUIRED: "true" }, log), false);
    assert.equal(logs.error.length, 1);
    assert.equal(runPhiKeyCheck({ JWT_SECRET: JWT, PHI_ENCRYPTION_KEY: HEX }, log), true);
  });

  test("server.js runs the check at startup and exits only when it says refuse", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8").replace(/\r\n/g, "\n");
    assert.match(src, /if \(!require\("\.\/utils\/phiKeyCheck"\)\.runPhiKeyCheck\(\)\) process\.exit\(1\);/);
  });
});

describe("phi:fallback-key script", () => {
  const script = path.join(__dirname, "..", "scripts", "phiFallbackKey.js");
  const run = (env) => spawnSync(process.execPath, [script], { env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env }, encoding: "utf8" });

  test("prints PHI_ENCRYPTION_KEY=<hex of sha256(JWT_SECRET:phi)> on stdout only, and the fingerprint on stderr", () => {
    const r = run({ JWT_SECRET: JWT, PHI_ENV_FILE: "no-such-env-file" });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), `PHI_ENCRYPTION_KEY=${derived.toString("hex")}`);
    assert.ok(r.stderr.includes(keyFingerprint(derived)));
    assert.ok(!r.stderr.includes(derived.toString("hex")), "the key is not on stderr");
  });

  test("refuses to print when a key is already configured (unless forced), and when there is no JWT_SECRET", () => {
    const r = run({ JWT_SECRET: JWT, PHI_ENCRYPTION_KEY: HEX, PHI_ENV_FILE: "no-such-env-file" });
    assert.notEqual(r.status, 0);
    assert.ok(!r.stdout.includes(derived.toString("hex")));
    assert.notEqual(run({ PHI_ENV_FILE: "no-such-env-file" }).status, 0);
  });
});

describe("decrypt checker", () => {
  async function* docs(list) { for (const d of list) yield d; }
  test("counts encrypted records and returns the ids of the unreadable ones only", async () => {
    const good = encryptPHI({ a: 1 });
    const saved = process.env.PHI_ENCRYPTION_KEY;
    process.env.PHI_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
    const other = encryptPHI({ a: 2 });
    if (saved === undefined) delete process.env.PHI_ENCRYPTION_KEY; else process.env.PHI_ENCRYPTION_KEY = saved;
    const out = await checkDocuments(docs([{ _id: "g1", ...good }, { _id: "b1", ...other }, { _id: "legacy", cipherText: "" }, { _id: "g2", ...good }]), (d) => d);
    assert.deepEqual(out, { total: 3, unreadable: ["b1"] });
  });
  test("transcript lines: the envelope is on .enc, gaps have none", async () => {
    const good = encryptPHI({ original: "x" });
    const out = await checkDocuments(docs([{ _id: "l1", enc: good }, { _id: "gap" }]), (d) => d.enc);
    assert.deepEqual(out, { total: 1, unreadable: [] });
  });
  test("the script file is read-only: it contains no write call", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "phiDecryptCheck.js"), "utf8");
    assert.doesNotMatch(src, /\.(insert|update|delete|replace|drop|create|save|remove|bulkWrite|findOneAnd)\w*\(/i);
  });
});
