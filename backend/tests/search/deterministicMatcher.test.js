const test = require("node:test");
const assert = require("node:assert/strict");
const { buildFixtureCatalog } = require("./fixtures");
const { matchCatalog } = require("../../services/search/deterministicMatcher");
const { validateQuery } = require("../../services/search/queryNormalizer");

let catalog;
test.before(async () => {
  ({ catalog } = await buildFixtureCatalog());
});

const search = (q, options) => matchCatalog(catalog, validateQuery(q), options);
const titles = (matches, type) =>
  matches[type].map((m) => m.record.name || m.record.displayName || m.record.title);

test("exact condition ranks first", () => {
  const m = search("acne");
  assert.deepEqual(titles(m, "condition").slice(0, 2), ["Acne", "Teen acne"]);
  assert.equal(m.condition[0].matchedOn, "name");
});

test("teen acne ranks the exact condition first", () => {
  assert.equal(titles(search("teen acne"), "condition")[0], "Teen acne");
});

test("condition alias", () => {
  const m = search("pimples");
  assert.deepEqual(titles(m, "condition"), ["Acne"]);
  assert.equal(m.condition[0].matchedOn, "alias");
  assert.equal(titles(search("blood sugar"), "condition")[0], "Type 2 Diabetes");
});

test("specialty by name", () => {
  assert.deepEqual(titles(search("neurology"), "specialty"), ["Neurology"]);
});

test("specialty alias also surfaces that specialty's doctors", () => {
  const m = search("skin doctor");
  assert.equal(titles(m, "specialty")[0], "Dermatology");
  assert.equal(m.specialty[0].matchedOn, "alias");
  assert.ok(titles(m, "doctor").includes("Dr. Priya Example"));
  assert.equal(titles(search("heart specialist"), "specialty")[0], "Cardiology");
});

test("category by name, with & and 'and' treated alike", () => {
  assert.deepEqual(titles(search("skin & hair"), "category"), ["Skin & Hair"]);
  assert.deepEqual(titles(search("skin and hair"), "category"), ["Skin & Hair"]);
});

test("doctor by name, with and without the Dr prefix", () => {
  assert.deepEqual(titles(search("rahul"), "doctor"), ["Dr. Rahul Testname"]);
  assert.deepEqual(titles(search("Dr Rahul"), "doctor"), ["Dr. Rahul Testname"]);
  assert.deepEqual(titles(search("testname"), "doctor"), ["Dr. Rahul Testname"]);
});

test("doctor by specialization, including approved mapping", () => {
  assert.deepEqual(titles(search("dermatology"), "doctor"), ["Dr. Priya Example"]);
  // "General Practice" is mapped to the "General Physician" specialty.
  assert.ok(titles(search("general physician"), "doctor").includes("Dr. Rahul Testname"));
  // "OB/GYN" is mapped to "OB-GYN".
  assert.deepEqual(titles(search("ob-gyn"), "doctor"), ["Dr. Asha Sample"]);
});

test("natural phrasing falls back to the core query", () => {
  assert.equal(titles(search("doctor for migraine"), "condition")[0], "Migraine");
  assert.equal(titles(search("I have migraine"), "condition")[0], "Migraine");
  assert.equal(titles(search("chronic migraine"), "condition")[0], "Chronic Migraine");
});

test("blog by title", () => {
  const m = search("telemedicine");
  assert.ok(m.blog.length > 0);
  assert.ok(m.blog.every((b) => /telemedicine/i.test(b.record.title + b.record.description)));
});

test("no results for unrelated text", () => {
  const m = search("zzqxv");
  assert.equal(Object.values(m).flat().length, 0);
});

test("types filter restricts result types", () => {
  const m = search("acne", { types: ["condition"] });
  assert.ok(m.condition.length > 0);
  assert.equal(m.specialty.length + m.category.length + m.doctor.length + m.blog.length, 0);
});

test("excluded records never match", () => {
  for (const q of ["orphan condition", "inactive condition", "hidden specialty", "hidden category", "under hidden"]) {
    assert.equal(Object.values(search(q)).flat().length, 0, q);
  }
});

test("matching is deterministic", () => {
  const a = JSON.stringify(search("ac"));
  const b = JSON.stringify(search("ac"));
  assert.equal(a, b);
});
