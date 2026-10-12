// PR 7.2: doctor results are TEMPORARILY excluded from global search (the
// default request types). Doctor search itself is kept and still works when
// "doctor" is requested explicitly. No database.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { buildFixtureCatalog } = require("./fixtures");
const { parseRequest } = require("../../controllers/searchController");
const { executeSearch } = require("../../services/search/searchService");
const { RESULT_TYPES, DEFAULT_SEARCH_TYPES, RESULT_GROUPS } = require("../../services/search/searchConstants");

// A cardiologist, so "card" / "cardiology" would surface a doctor if doctors
// were part of the default types.
const doctors = [
  { doctorId: 23456, firstName: "Priya", surname: "Example", qualification: "MD", specialization: "Dermatology" },
  { doctorId: 45678, firstName: "Mak", surname: "Heart", qualification: "MD", specialization: "Cardiology" },
];

let catalog;
test.before(async () => {
  ({ catalog } = await buildFixtureCatalog({ doctors }));
});

async function search(q, extra = {}) {
  const parsed = parseRequest({ q, ...extra });
  assert.ok(!parsed.error, parsed.error);
  return executeSearch(parsed, { getCatalog: async () => catalog });
}
const all = (body) => Object.values(body.results).flat();
const titles = (body, group) => body.results[group].map((r) => r.title);

test("the global search default types exclude doctors only", () => {
  assert.deepEqual([...DEFAULT_SEARCH_TYPES], ["category", "specialty", "condition", "service", "blog"]);
  assert.deepEqual(parseRequest({ q: "card" }).types, DEFAULT_SEARCH_TYPES);
});

test("'card', 'derm' and 'cardiology' return no doctor results", async () => {
  for (const q of ["card", "derm", "cardiology", "skin doctor", "priya", "mak heart"]) {
    for (const mode of ["instant", "full"]) {
      const body = await search(q, { mode });
      assert.ok(!all(body).some((item) => item.type === "doctor"), `${q} (${mode}) returned a doctor`);
      assert.deepEqual(body.results.doctors, [], `${q} (${mode})`);
    }
  }
});

test("'card' still returns the category and the specialty", async () => {
  const body = await search("card");
  assert.deepEqual(titles(body, "specialties"), ["Cardiology"]);
  assert.equal(body.results.specialties[0].navigation.path, "/chronic-care/cardiology");
  assert.deepEqual(titles(await search("cardiology"), "specialties"), ["Cardiology"]);
});

test("category, specialty, condition, service and blog results still work", async () => {
  const derm = await search("derm");
  assert.deepEqual(titles(derm, "specialties"), ["Dermatology"]);
  assert.equal(derm.results.specialties[0].navigation.path, "/skin-and-hair-care/dermatology");

  const skin = await search("skin & hair");
  assert.deepEqual(titles(skin, "categories"), ["Skin & Hair"]);
  assert.equal(skin.results.categories[0].navigation.path, "/skin-and-hair-care");

  const acne = await search("acne");
  assert.equal(acne.results.conditions[0].title, "Acne");
  assert.equal(acne.results.conditions[0].navigation.path, "/skin-and-hair-care/dermatology/acne");

  const note = await search("sick note");
  assert.deepEqual(titles(note, "services"), ["Doctor's Note"]);

  const blogs = await search("telemedicine");
  assert.ok(blogs.results.blogs.length > 0);
  for (const blog of blogs.results.blogs) assert.ok(blog.navigation.path.startsWith("/"));
  assert.deepEqual(blogs.results.doctors, []);
});

test("the response keeps all six groups, so the UI contract is unchanged", async () => {
  assert.deepEqual(Object.keys((await search("card")).results), Object.values(RESULT_GROUPS));
});

test("doctor search is preserved: 'doctor' is still a supported type and still matches", async () => {
  assert.ok(RESULT_TYPES.includes("doctor"));
  const explicit = await search("cardiology", { types: ["doctor"] });
  assert.deepEqual(titles(explicit, "doctors"), ["Dr. Mak Heart"]);
  assert.equal(explicit.results.doctors[0].navigation.path, "/doctors/45678-mak-heart");
  const everything = await search("card", { types: [...RESULT_TYPES] });
  assert.ok(titles(everything, "doctors").includes("Dr. Mak Heart"));
  assert.ok(catalog.doctors.length === doctors.length, "doctor catalog is still built");
});

test("doctor implementation code is still present", () => {
  const read = (rel) => fs.readFileSync(path.join(__dirname, "..", "..", rel), "utf8");
  assert.match(read("services/search/searchCatalog.js"), /publicDoctorsPipeline/);
  assert.match(read("services/search/deterministicMatcher.js"), /doctor: \(doctor\) =>/);
  assert.match(read("services/search/resultBuilder.js"), /doctor\(doctor\) \{/);
  assert.match(read("services/search/searchService.js"), /want\("doctor"\)/);
  assert.match(read("services/search/searchConstants.js"), /TEMPORARILY DISABLED/);
});
