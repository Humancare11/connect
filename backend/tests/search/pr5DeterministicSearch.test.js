// PR 5: deterministic search completeness. Services as their own type,
// singular/plural and separator folding, description and blog-path
// matching, ranking tiers, hierarchy, doctor visibility rules evaluated on
// the real aggregation pipeline, validation and security. No database.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { buildFixtureCatalog, PRIVATE_DOCTOR_FIELDS } = require("./fixtures");
const { matchCatalog, SCORE, WEIGHT } = require("../../services/search/deterministicMatcher");
const { validateQuery, singularize } = require("../../services/search/queryNormalizer");
const { buildResults } = require("../../services/search/resultBuilder");
const { executeSearch } = require("../../services/search/searchService");
const { publicDoctorsPipeline } = require("../../services/search/searchCatalog");
const { parseRequest, createSearchController } = require("../../controllers/searchController");

const oid = (n) => n.toString(16).padStart(24, "0");
const CAT = { skin: oid(1), chronic: oid(2), general: oid(3) };
const SPEC = { derm: oid(11), neuro: oid(12), gastro: oid(13), gp: oid(14) };

const categories = [
  { _id: CAT.skin, name: "Skin & Hair", description: "Skin, hair and nail concerns", isActive: true },
  { _id: CAT.chronic, name: "Chronic Care & Expert Opinion", description: "", isActive: true },
  { _id: CAT.general, name: "General & Everyday Care", description: "", isActive: true },
];
const specialties = [
  { _id: SPEC.derm, categoryId: CAT.skin, name: "Dermatology", aliases: ["skin doctor", "skin"], isActive: true },
  { _id: SPEC.neuro, categoryId: CAT.chronic, name: "Neurology", aliases: ["brain", "nerve"], isActive: true },
  { _id: SPEC.gastro, categoryId: CAT.chronic, name: "Gastroenterology", aliases: ["stomach", "digestive"], isActive: true },
  { _id: SPEC.gp, categoryId: CAT.general, name: "General Physician", aliases: ["gp"], isActive: true },
];
const conditions = [
  { _id: oid(101), specialtyId: SPEC.derm, name: "Acne", aliases: ["pimples"], legacyId: "acne", isActive: true },
  { _id: oid(102), specialtyId: SPEC.neuro, name: "Migraine", aliases: ["severe headache"], isActive: true },
  { _id: oid(103), specialtyId: SPEC.neuro, name: "Chronic Migraine", aliases: ["migraine"], isActive: true },
  { _id: oid(104), specialtyId: SPEC.gastro, name: "Acid Reflux / GERD", aliases: ["gerd", "heartburn"], isActive: true },
  { _id: oid(105), specialtyId: SPEC.derm, name: "Hives", aliases: ["urticaria"], isActive: true },
  { _id: oid(106), specialtyId: SPEC.gastro, name: "Irritable Bowel Syndrome", aliases: ["ibs"], isActive: true },
  { _id: oid(201), specialtyId: SPEC.gp, name: "Doctor's Note", aliases: ["sick note", "medical certificate"], kind: "service", isActive: true },
  { _id: oid(202), specialtyId: SPEC.gp, name: "Follow-Up Consultation", kind: "service", isActive: true },
];
const blogs = [
  { id: 1, title: "What Is Telemedicine?", description: "Remote care explained.", path: "/what-is-telemedicine" },
  { id: 2, title: "A Guide For Better Nights", description: "Practical routines.", path: "/sleep-hygiene-tips" },
];

let catalog;
test.before(async () => {
  ({ catalog } = await buildFixtureCatalog({ categories, specialties, conditions, blogs }));
});

const run = (q, options) => matchCatalog(catalog, validateQuery(q), options);
const titles = (m, type) => m[type].map((x) => x.record.name || x.record.title || x.record.displayName);

// ── Search types ────────────────────────────────────────────────────────────
test("category: exact name, including & / and", () => {
  assert.deepEqual(titles(run("skin & hair"), "category"), ["Skin & Hair"]);
  assert.equal(run("skin and hair").category[0].matchedOn, "name");
});

test("category aliases are not supported by the schema; description words match at the lowest tier", () => {
  const m = run("nail");
  assert.deepEqual(titles(m, "category"), ["Skin & Hair"]);
  assert.equal(m.category[0].matchedOn, "description");
  assert.equal(m.category[0].score, SCORE.WORD_PREFIX * WEIGHT.DESCRIPTION);
});

test("specialty: exact name and alias", () => {
  assert.equal(run("neurology").specialty[0].matchedOn, "name");
  const gp = run("GP");
  assert.deepEqual(titles(gp, "specialty"), ["General Physician"]);
  assert.equal(gp.specialty[0].matchedOn, "alias");
});

test("condition: exact name and alias", () => {
  assert.equal(titles(run("acne"), "condition")[0], "Acne");
  const gerd = run("gerd");
  assert.deepEqual(titles(gerd, "condition"), ["Acid Reflux / GERD"]);
  assert.equal(gerd.condition[0].matchedOn, "alias");
});

test("services are their own type and never appear as conditions", () => {
  const m = run("sick note");
  assert.deepEqual(titles(m, "service"), ["Doctor's Note"]);
  assert.equal(m.condition.length, 0);
  assert.deepEqual(titles(run("doctors note"), "service"), ["Doctor's Note"]);
  assert.deepEqual(titles(run("sick note", { types: ["condition"] }), "service"), []);
  assert.deepEqual(titles(run("sick note", { types: ["service"] }), "service"), ["Doctor's Note"]);
});

// ── Normalisation ───────────────────────────────────────────────────────────
test("case, whitespace, punctuation and separators", () => {
  for (const q of ["  ACNE  ", "acne!!", "a-c-n-e", "Acne."]) {
    assert.equal(titles(run(q), "condition")[0], "Acne", q);
  }
  assert.equal(titles(run("acid-reflux"), "condition")[0], "Acid Reflux / GERD");
  assert.equal(titles(run("acid reflux / gerd"), "condition")[0], "Acid Reflux / GERD");
  // Separator-insensitive: "followup" ~ "Follow-Up".
  assert.equal(titles(run("followup"), "service")[0], "Follow-Up Consultation");
  assert.equal(titles(run("follow up"), "service")[0], "Follow-Up Consultation");
});

test("singular/plural folding is conservative and symmetric", () => {
  const m = run("migraines");
  assert.equal(titles(m, "condition")[0], "Migraine");
  assert.equal(m.condition[0].score, SCORE.EQUIVALENT);
  assert.equal(titles(run("hive"), "condition")[0], "Hives");
  assert.equal(singularize("allergies"), "allergy");
  for (const kept of ["sinus", "arthritis", "gas", "ibs", "covid19", "stress"]) assert.equal(singularize(kept), kept);
});

// ── Ranking ─────────────────────────────────────────────────────────────────
test("exact match beats partial match", () => {
  assert.deepEqual(titles(run("migraine"), "condition"), ["Migraine", "Chronic Migraine"]);
  assert.equal(run("migraine").condition[0].matchedOn, "name");
});

test("ranking tiers: exact name > exact alias > name prefix > alias prefix > word prefix > contains > description", async () => {
  const S = oid(11);
  const tiers = [
    { name: "Rash", expect: "exact name" },
    { name: "Zeta", aliases: ["rash"], expect: "exact alias" },
    { name: "Rash Care", expect: "name prefix" },
    { name: "Yota", aliases: ["rash care plan"], expect: "alias prefix" },
    { name: "Diaper Rash", expect: "name word prefix" },
    { name: "Heatrash", expect: "name contains" },
    { name: "Omega", description: "Itchy rash advice", expect: "description" },
    { name: "Unrelated", expect: null },
  ];
  const { catalog: c } = await buildFixtureCatalog({
    categories: [categories[0]],
    specialties: [{ _id: S, categoryId: CAT.skin, name: "Dermatology", isActive: true }],
    conditions: tiers.map((t, i) => ({ _id: oid(500 + i), specialtyId: S, isActive: true, ...t })),
    blogs: [],
  });
  const m = matchCatalog(c, "rash", { perTypeLimit: 10, types: ["condition"] });
  assert.deepEqual(m.condition.map((x) => x.record.name), tiers.filter((t) => t.expect).map((t) => t.name));
  const scores = m.condition.map((x) => x.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  assert.equal(new Set(scores).size, scores.length, "tiers must not tie");
});

// ── Hierarchy ───────────────────────────────────────────────────────────────
test("results keep their category → specialty hierarchy", () => {
  const cases = [
    ["acne", "Acne", "Dermatology", "Skin & Hair", "/skin-and-hair-care/dermatology/acne"],
    ["migraine", "Migraine", "Neurology", "Chronic Care & Expert Opinion", "/chronic-care/neurology/migraine"],
    ["gerd", "Acid Reflux / GERD", "Gastroenterology", "Chronic Care & Expert Opinion", "/chronic-care/gastroenterology/acid-reflux-gerd"],
  ];
  for (const [q, title, specialty, category, navPath] of cases) {
    const item = buildResults(run(q), catalog).results.conditions[0];
    assert.equal(item.title, title);
    assert.equal(item.metadata.specialtyName, specialty);
    assert.equal(item.metadata.categoryName, category);
    assert.deepEqual(item.navigation, { type: "condition", path: navPath });
  }
  const service = buildResults(run("sick note"), catalog).results.services[0];
  assert.equal(service.type, "service");
  assert.equal(service.metadata.kind, "service");
  assert.equal(service.metadata.specialtyName, "General Physician");
});

// ── Blogs ───────────────────────────────────────────────────────────────────
test("blogs: title match, path match, and non-matching blogs excluded", () => {
  const title = run("telemedicine");
  assert.deepEqual(titles(title, "blog"), ["What Is Telemedicine?"]);
  assert.equal(title.blog[0].matchedOn, "title");
  const byPath = run("hygiene");
  assert.deepEqual(titles(byPath, "blog"), ["A Guide For Better Nights"]);
  assert.equal(byPath.blog[0].matchedOn, "path");
  assert.deepEqual(titles(run("vaccination"), "blog"), []);
});

// Blogs now come from the Blog collection (see tests/blogs.test.js for the
// catalog loader); this static list is only deterministic fixture data.
test("fixture blog paths are unique", () => {
  const publicBlogs = require("../../data/publicBlogs");
  assert.equal(new Set(publicBlogs.map((b) => b.path)).size, publicBlogs.length, "duplicate blog paths");
});

// ── Doctors: visibility rules on the real pipeline ─────────────────────────
// A minimal evaluator for exactly the stages/operators publicDoctorsPipeline
// uses. Anything else throws, so the test cannot silently misread it.
const get = (doc, dotted) => dotted.split(".").reduce((v, k) => (v == null ? undefined : v[k]), doc);
function matches(doc, filter) {
  return Object.entries(filter).every(([key, cond]) => {
    const value = get(doc, key);
    if (cond && typeof cond === "object" && !Array.isArray(cond)) {
      return Object.entries(cond).every(([op, arg]) => {
        if (op === "$ne") return value !== arg;
        if (op === "$type" && arg === "number") return typeof value === "number";
        throw new Error(`unsupported operator ${op}`);
      });
    }
    return value === cond;
  });
}
function project(doc, spec) {
  const out = {};
  for (const [key, rule] of Object.entries(spec)) {
    if (rule === 0) continue;
    if (rule === 1) {
      if (doc[key] !== undefined) out[key] = doc[key];
    } else if (typeof rule === "string" && rule.startsWith("$")) out[key] = get(doc, rule.slice(1));
    else throw new Error(`unsupported projection ${key}`);
  }
  return out;
}
function runPipeline(docs, pipeline, collections) {
  let current = docs;
  for (const stage of pipeline) {
    const [name, arg] = Object.entries(stage)[0];
    if (name === "$match") current = current.filter((d) => matches(d, arg));
    else if (name === "$project") current = current.map((d) => project(d, arg));
    else if (name === "$unwind") current = current.flatMap((d) => (get(d, arg.slice(1)) || []).map((x) => ({ ...d, [arg.slice(1)]: x })));
    else if (name === "$lookup") {
      current = current.map((d) => ({
        ...d,
        [arg.as]: runPipeline(collections[arg.from].filter((f) => f[arg.foreignField] === d[arg.localField]), arg.pipeline || [], collections),
      }));
    } else throw new Error(`unsupported stage ${name}`);
  }
  return current;
}

test("doctors: approved + linked + not disabled only, with private fields removed", async () => {
  const doctors = [
    { _id: "d1", doctorId: 11111, accountDisabled: false, password: "x", email: "a@x" },
    { _id: "d2", doctorId: 22222, password: "x" },
    { _id: "d3", doctorId: 33333, accountDisabled: true },
    { _id: "d5", doctorId: null },
  ];
  const enrollments = [
    { ...PRIVATE_DOCTOR_FIELDS, doctorId: "d1", approvalStatus: "approved", firstName: "Visible", surname: "Doctor", specialization: "Dermatology" },
    { doctorId: "d2", approvalStatus: "pending", firstName: "Pending", surname: "Review", specialization: "Dermatology" },
    { doctorId: "d3", approvalStatus: "approved", firstName: "Disabled", surname: "Account", specialization: "Dermatology" },
    { doctorId: "d4", approvalStatus: "approved", firstName: "Missing", surname: "Account", specialization: "Dermatology" },
    { doctorId: "d5", approvalStatus: "approved", firstName: "No", surname: "PublicId", specialization: "Dermatology" },
  ];
  const visible = runPipeline(enrollments, publicDoctorsPipeline("doctors"), { doctors });
  assert.deepEqual(visible.map((d) => d.doctorId), [11111]);

  const { catalog: c } = await buildFixtureCatalog({ categories, specialties, conditions: [], doctors: visible, blogs: [] });
  const body = buildResults(matchCatalog(c, "dermatology"), c).results;
  assert.deepEqual(body.doctors.map((d) => d.title), ["Dr. Visible Doctor"]);
  const json = JSON.stringify(body);
  for (const [key, value] of Object.entries(PRIVATE_DOCTOR_FIELDS)) {
    assert.ok(!json.includes(`"${key}"`), `private key ${key} leaked`);
    if (typeof value === "string") assert.ok(!json.includes(value), `private value of ${key} leaked`);
  }
});

// ── Validation ──────────────────────────────────────────────────────────────
test("validation: every invalid request is a 400 with a field, before any catalog access", async () => {
  const cases = [
    [{}, "q", /q is required/],
    [{ q: "" }, "q", /at least 2/],
    [{ q: "     " }, "q", /at least 2/],
    [{ q: "a" }, "q", /at least 2/],
    [{ q: "x".repeat(101) }, "q", /at most 100/],
    [{ q: "x".repeat(5000) }, "q", /at most 100/],
    [{ q: "acne", types: ["patient"] }, "types", /types may only contain/],
    [{ q: "acne", types: [] }, "types", /non-empty array/],
    [{ q: "acne", mode: "smart" }, "mode", /mode must be one of/],
    [{ q: "acne", extra: true }, "body", /Only q, mode and types/],
  ];
  let catalogCalls = 0;
  const controller = createSearchController({ getCatalog: async () => ((catalogCalls += 1), catalog) });
  for (const [body, field, message] of cases) {
    let status;
    let payload;
    const res = { status: (s) => ((status = s), res), json: (p) => ((payload = p), res) };
    await controller({ body }, res);
    assert.equal(status, 400, JSON.stringify(body).slice(0, 40));
    assert.deepEqual(Object.keys(payload.error).sort(), ["code", "field", "message"]);
    assert.equal(payload.success, false);
    assert.equal(payload.error.code, "INVALID_REQUEST");
    assert.equal(payload.error.field, field);
    assert.match(payload.error.message, message);
  }
  assert.equal(catalogCalls, 0);
  assert.deepEqual(parseRequest({ q: "note", types: ["service"] }).types, ["service"]);
});

// ── Response contract ───────────────────────────────────────────────────────
test("response: all six groups, bounded, no legacyId, backend-built navigation", async () => {
  const body = await executeSearch({ q: "acne", mode: "instant", types: parseRequest({ q: "acne" }).types }, { getCatalog: async () => catalog });
  assert.deepEqual(Object.keys(body), ["success", "query", "results", "meta"]);
  assert.deepEqual(Object.keys(body.results), ["categories", "specialties", "conditions", "services", "doctors", "blogs"]);
  assert.deepEqual(body.meta, { total: body.meta.total, mode: "instant", limits: { perType: 5, total: 25 } });
  assert.equal(body.meta.total, Object.values(body.results).flat().length);
  const json = JSON.stringify(body);
  assert.ok(!json.includes("legacyId"));
  for (const item of Object.values(body.results).flat()) assert.ok(item.navigation.path.startsWith("/"));
});

test("unrelated and regex-like queries return nothing and never throw", () => {
  for (const q of ["zzqxv", ".*", "(a+)+$", "$where", "[a-z]*"]) {
    const m = run(q);
    assert.ok(Object.values(m).flat().length <= 25, q);
  }
  assert.equal(Object.values(run("zzqxv")).flat().length, 0);
  assert.equal(Object.values(run(".*")).flat().length, 0);
});

test("static: the search service builds no RegExp, loads no model and logs no query", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "..", "services", "search", "searchService.js"), "utf8");
  assert.ok(!/RegExp\(/.test(src));
  assert.ok(!/require\(["'](mongoose|\.\.\/\.\.\/models)/.test(src));
  assert.ok(!/console\.\w+\([^)]*\b(q|request|query)\b/.test(src));
  assert.ok(!/openai|fetch\(|axios|https?\.request/i.test(src));
});
