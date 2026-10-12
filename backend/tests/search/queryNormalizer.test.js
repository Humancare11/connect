const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validateQuery,
  normalizeForMatch,
  coreQuery,
  QueryValidationError,
} = require("../../services/search/queryNormalizer");

test("trims surrounding whitespace", () => {
  assert.equal(validateQuery("  acne  "), "acne");
});

test("collapses repeated whitespace and lowercases", () => {
  assert.equal(validateQuery("Chronic    Migraine\t\n pain"), "chronic migraine pain");
});

test("rejects 1-character query", () => {
  assert.throws(() => validateQuery("a"), QueryValidationError);
  assert.throws(() => validateQuery("   a   "), QueryValidationError);
});

test("rejects query longer than 100 characters", () => {
  assert.equal(validateQuery("x".repeat(100)).length, 100);
  assert.throws(() => validateQuery("x".repeat(101)), QueryValidationError);
  assert.throws(() => validateQuery("x".repeat(5000)), QueryValidationError);
});

test("rejects non-string queries", () => {
  for (const value of [undefined, null, 42, true, ["acne"], { $gt: "" }, { $regex: ".*" }]) {
    assert.throws(() => validateQuery(value), QueryValidationError);
  }
});

test("error messages never echo the query", () => {
  try {
    validateQuery("x".repeat(101) + "SECRET");
  } catch (err) {
    assert.ok(!err.message.includes("SECRET"));
  }
});

test("control characters are neutralised", () => {
  assert.equal(validateQuery("ac\u0000ne\u0007 x"), "ac ne x");
});

test("normalizeForMatch folds punctuation, apostrophes, & and accents", () => {
  assert.equal(normalizeForMatch("Men's Health"), "mens health");
  assert.equal(normalizeForMatch("Skin & Hair"), "skin and hair");
  assert.equal(normalizeForMatch("Café  Acné!!"), "cafe acne");
  assert.equal(normalizeForMatch("$where"), "where");
  assert.equal(normalizeForMatch(".*"), "");
});

test("coreQuery strips filler words only", () => {
  assert.equal(coreQuery("doctor for migraine"), "migraine");
  assert.equal(coreQuery("i have migraine"), "migraine");
  assert.equal(coreQuery("dr rahul"), "rahul");
  assert.equal(coreQuery("skin doctor"), "skin");
  assert.equal(coreQuery("doctor"), "");
});
