const test = require("node:test");
const assert = require("node:assert/strict");
const { buildFixtureCatalog, PRIVATE_DOCTOR_FIELDS } = require("./fixtures");
const {
  publicDoctorsPipeline,
  DOCTOR_PUBLIC_FIELDS,
} = require("../../services/search/searchCatalog");
const { matchCatalog } = require("../../services/search/deterministicMatcher");
const { buildResults, safeLegacyRoute } = require("../../services/search/resultBuilder");
const { validateQuery } = require("../../services/search/queryNormalizer");

let catalog;
let calls;
test.before(async () => {
  ({ catalog, calls } = await buildFixtureCatalog());
});

const run = (q, options) => buildResults(matchCatalog(catalog, validateQuery(q), options), catalog);

// ── Catalog contents ──────────────────────────────────────────────────────
test("catalog has the normalised collections only", () => {
  assert.deepEqual(
    Object.keys(catalog).sort(),
    ["blogs", "builtAt", "categories", "conditions", "doctors", "index", "specialties"],
  );
  assert.ok(Object.isFrozen(catalog) && Object.isFrozen(catalog.doctors[0]));
});

test("inactive parents, orphans and inactive records are excluded", () => {
  assert.ok(!catalog.categories.some((c) => c.name === "Hidden Category"));
  assert.ok(!catalog.specialties.some((s) => s.name === "Hidden Specialty"));
  for (const name of ["Orphan Condition", "Inactive Condition", "Under Hidden Specialty"]) {
    assert.ok(!catalog.conditions.some((c) => c.name === name), name);
  }
  assert.equal(catalog.doctors.length, 3); // invalid doctorId dropped
});

test("category records carry no pricing fields", () => {
  for (const category of catalog.categories) {
    assert.deepEqual(Object.keys(category).sort(), ["_id", "description", "icon", "isActive", "name"]);
  }
});

test("condition defaults applied for records without the PR2 fields", () => {
  const acne = catalog.conditions.find((c) => c.name === "Acne");
  assert.equal(acne.kind, "condition");
  assert.equal(acne.slug, "");
  assert.equal(acne.route, "");
  assert.equal(catalog.conditions.find((c) => c.name === "Doctor's Note").kind, "service");
});

test("taxonomy queries use fixed filters and explicit field selection", () => {
  const finds = calls.filter((c) => c.filter);
  assert.equal(finds.length, 3);
  for (const call of finds) assert.deepEqual(call.filter, { isActive: true });
  const selects = Object.fromEntries(calls.filter((c) => c.select).map((c) => [c.model, c.select]));
  assert.equal(selects.HealthcareCategory, "_id name description icon isActive");
  assert.equal(selects.HealthcareSpecialty, "_id categoryId name description icon aliases isActive");
  assert.equal(selects.HealthcareCondition, "_id specialtyId name description icon aliases kind legacyId slug route isActive");
});

// ── Public doctor allowlist ───────────────────────────────────────────────
test("doctor pipeline: approved + linked, non-disabled account + explicit projection", () => {
  const pipeline = publicDoctorsPipeline("doctors");
  assert.deepEqual(pipeline[0], { $match: { approvalStatus: "approved" } });
  const lookup = pipeline[1].$lookup;
  assert.equal(lookup.from, "doctors");
  assert.deepEqual(lookup.pipeline[0], { $match: { accountDisabled: { $ne: true } } });
  assert.deepEqual(pipeline[2], { $unwind: "$account" }); // drops enrollments without a Doctor
  const projection = pipeline[pipeline.length - 1].$project;
  assert.deepEqual(
    Object.keys(projection).sort(),
    ["_id", "doctorId", ...DOCTOR_PUBLIC_FIELDS].sort(),
  );
  assert.equal(projection._id, 0);
});

test("doctor catalog records contain only allowlisted fields", () => {
  const allowed = new Set([
    "doctorId", "displayName", "specialtyName", ...DOCTOR_PUBLIC_FIELDS,
  ]);
  for (const doctor of catalog.doctors) {
    for (const key of Object.keys(doctor)) assert.ok(allowed.has(key), `unexpected key ${key}`);
  }
});

test("doctor search results never contain private fields", () => {
  const { results } = run("rahul");
  assert.equal(results.doctors.length, 1);
  const serialized = JSON.stringify(results);
  for (const [field, value] of Object.entries(PRIVATE_DOCTOR_FIELDS)) {
    assert.ok(!serialized.includes(`"${field}"`), `field ${field} leaked`);
    if (typeof value === "string") assert.ok(!serialized.includes(value), `value of ${field} leaked`);
  }
  for (const word of ["email", "phone", "password", "dob", "address", "license", "availability", "token", "oauth"]) {
    assert.ok(!serialized.toLowerCase().includes(`"${word}`), `${word} leaked`);
  }
});

// ── Result format & navigation ────────────────────────────────────────────
test("result groups and item shape", () => {
  const { results, total } = run("acne");
  assert.deepEqual(Object.keys(results), ["categories", "specialties", "conditions", "services", "doctors", "blogs"]);
  const acne = results.conditions[0];
  assert.deepEqual(Object.keys(acne).sort(), ["description", "icon", "id", "matchedOn", "metadata", "navigation", "title", "type"]);
  assert.equal(total, Object.values(results).flat().length);
});

test("navigation is derived from catalog data and opens discovery pages", () => {
  assert.deepEqual(run("acne").results.conditions[0].navigation, {
    type: "condition",
    path: "/skin-and-hair-care/dermatology/acne",
  });
  assert.deepEqual(run("neurology").results.specialties[0].navigation, {
    type: "specialty",
    path: "/chronic-care/neurology",
  });
  assert.deepEqual(run("dermatology").results.specialties[0].navigation, {
    type: "specialty",
    path: "/skin-and-hair-care/dermatology",
  });
  assert.deepEqual(run("cardiology").results.specialties[0].navigation, {
    type: "specialty",
    path: "/chronic-care/cardiology",
  });
  assert.deepEqual(run("skin & hair").results.categories[0].navigation, {
    type: "category",
    path: "/skin-and-hair-care",
  });
  assert.deepEqual(run("rahul").results.doctors[0].navigation, {
    type: "doctor",
    path: "/doctors/12345-rahul-testname",
  });
  const blog = run("uti symptoms").results.blogs[0];
  assert.equal(blog.navigation.path, "/uti-symptoms-causes-treatment-&-when-to-see-a-doctor");
});

test("conditions without a dedicated page fall back up the hierarchy", () => {
  // No /child-and-family-care/adolescent-medicine/teen-acne page exists.
  const teenAcne = run("teen acne").results.conditions.find((c) => c.title === "Teen acne");
  assert.equal(teenAcne.navigation.path, "/child-and-family-care/adolescent-medicine");
  const note = run("sick note").results.services[0];
  assert.deepEqual(note.navigation, { type: "service", path: "/general-and-everyday-care/general-physician" });
});

test("search never navigates into the booking flow", () => {
  for (const q of ["acne", "derm", "skin", "neurology", "cardiology", "migraine", "diabetes", "sick note", "teen", "eczema"]) {
    for (const item of Object.values(run(q).results).flat()) {
      assert.ok(!item.navigation.path.startsWith("/appointment-booking"), `${q}: ${item.navigation.path}`);
    }
  }
});

test("stored legacy routes are used only when safe and a known page", () => {
  const eczema = run("eczema").results.conditions[0];
  assert.equal(eczema.metadata.legacyRoute, "/skin-and-hair-care/dermatology/eczema");
  assert.equal(eczema.navigation.path, "/skin-and-hair-care/dermatology/eczema");
  const rash = run("skin rash").results.conditions[0];
  assert.ok(!("legacyRoute" in rash.metadata)); // "javascript:alert(1)" rejected
  assert.equal(rash.navigation.path, "/skin-and-hair-care/dermatology/skin-rash");
  for (const bad of ["//evil.example", "https://evil.example", "/a/../b", "/a b", "javascript:x", ""]) {
    assert.equal(safeLegacyRoute(bad), null, bad);
  }
});

test("blog metadata skips the duplicate-path entry and exposes no body", () => {
  assert.ok(!catalog.blogs.some((b) => b.id === "6"));
  const paths = catalog.blogs.map((b) => b.path);
  assert.equal(new Set(paths).size, paths.length);
  for (const blog of catalog.blogs) {
    assert.deepEqual(Object.keys(blog).sort(), ["description", "id", "path", "readTime", "title"]);
  }
});

// ── Limits ───────────────────────────────────────────────────────────────
test("maximum 5 results per group and 25 total", async () => {
  const many = (n, make) => Array.from({ length: n }, (_, i) => make(i));
  const oid = (n) => n.toString(16).padStart(24, "0");
  const { catalog: big } = await buildFixtureCatalog({
    categories: many(20, (i) => ({ _id: oid(1000 + i), name: `Test Category ${i}`, isActive: true })),
    specialties: many(20, (i) => ({ _id: oid(2000 + i), categoryId: oid(1000), name: `Test Specialty ${i}`, isActive: true })),
    conditions: [
      ...many(20, (i) => ({ _id: oid(3000 + i), specialtyId: oid(2000), name: `Test Condition ${i}`, isActive: true })),
      ...many(20, (i) => ({ _id: oid(4000 + i), specialtyId: oid(2000), name: `Test Service ${i}`, kind: "service", isActive: true })),
    ],
    doctors: many(20, (i) => ({ doctorId: 10000 + i, firstName: "Test", surname: `Doctor${i}` })),
    blogs: many(20, (i) => ({ id: i, title: `Test Blog ${i}`, description: "", path: `/test-${i}` })),
  });
  const { results, total } = buildResults(matchCatalog(big, "test"), big);
  // 6 groups x 5 = 30 candidates: each group is capped at 5, the whole
  // response at 25.
  for (const group of Object.values(results)) assert.ok(group.length <= 5);
  assert.equal(Object.values(results).flat().length, 25);
  assert.equal(total, 25);

  const capped = buildResults(matchCatalog(big, "test", { totalLimit: 7 }), big);
  assert.equal(capped.total, 7);
});
