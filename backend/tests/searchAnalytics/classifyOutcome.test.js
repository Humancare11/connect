const test = require("node:test");
const assert = require("node:assert/strict");
const { buildFixtureCatalog } = require("../search/fixtures");
const { matchCatalog } = require("../../services/search/deterministicMatcher");
const { buildResults, resolveNavigation } = require("../../services/search/resultBuilder");
const { validateQuery } = require("../../services/search/queryNormalizer");
const { RESULT_GROUPS, DEFAULT_SEARCH_TYPES } = require("../../services/search/searchConstants");
const { classifyOutcome, deriveAiStatus, isConfirmedGap } = require("../../services/searchAnalytics/classifyOutcome");
const { RELEVANT_SCORE } = require("../../services/searchAnalytics/constants");

let catalog;
test.before(async () => {
  ({ catalog } = await buildFixtureCatalog());
});

const run = (q) => matchCatalog(catalog, validateQuery(q), { types: DEFAULT_SEARCH_TYPES, perTypeLimit: 5, totalLimit: 25 });
const classify = (matches) => classifyOutcome({ matches, index: catalog.index });

// Synthetic catalog pieces, to exercise page/fallback combinations the
// fixtures do not contain.
const category = (name) => ({ _id: `cat-${name}`, name });
const specialty = (cat, name) => ({ _id: `spec-${name}`, categoryId: cat._id, name });
const condition = (spec, name, extra = {}) => ({ _id: `cond-${name}`, specialtyId: spec.name && spec._id, name, kind: "condition", ...extra });
const indexOf = (cats, specs) => ({
  categoryById: Object.fromEntries(cats.map((c) => [c._id, c])),
  specialtyById: Object.fromEntries(specs.map((s) => [s._id, s])),
});
const m = (type, record, score = 100) => ({ type, record, score, matchedOn: "name" });

const chronic = category("Chronic Care & Expert Opinion");
const oncology = specialty(chronic, "Oncology"); // no discovery page
const cardiology = specialty(chronic, "Cardiology"); // has a page
const endo = specialty(chronic, "Endocrinology");
const synthIndex = indexOf([chronic], [oncology, cardiology, endo]);
const classifySynth = (matches) => classifyOutcome({ matches, index: synthIndex });

// ── Outcomes from the real fixture catalog ────────────────────────────────
test("a condition with its own page is dedicated_page_found", () => {
  const facts = classify(run("acne"));
  assert.equal(facts.outcome, "dedicated_page_found");
  assert.equal(facts.dedicatedPageAvailable, true);
  assert.equal(facts.topResultType, "condition");
  assert.equal(facts.topResultPath, "/skin-and-hair-care/dermatology/acne");
  assert.equal(facts.topResultDedicated, true);
  assert.equal(facts.topScore, 100);
  assert.ok(facts.resultTypes.includes("condition"));
});

test("an alias resolves to the same dedicated page (no false gap)", () => {
  const facts = classify(run("pimples"));
  assert.equal(facts.outcome, "dedicated_page_found");
  assert.equal(facts.topResultPath, "/skin-and-hair-care/dermatology/acne");
});

test("a plural / longer phrase naming a covered topic is covered", () => {
  assert.equal(classify(run("migraines")).outcome, "dedicated_page_found");
  assert.equal(classify(run("i have acne for two weeks")).outcome, "dedicated_page_found");
});

test("nothing matched is no_results", () => {
  const facts = classify(run("zzzzqqq"));
  assert.deepEqual(
    { ...facts },
    {
      resultCount: 0, resultTypes: [], outcome: "no_results", dedicatedPageAvailable: false,
      topResultType: null, topResultPath: null, topResultDedicated: null, topScore: null, hasDoctor: false,
    },
  );
});

test("category and specialty with their own pages count as dedicated", () => {
  assert.equal(classify(run("skin and hair")).outcome, "dedicated_page_found");
  assert.equal(classify(run("dermatology")).outcome, "dedicated_page_found");
});

// ── Outcomes from synthetic combinations ──────────────────────────────────
test("a specialty without its own page falls back to the category page: fallback_only", () => {
  const facts = classifySynth({ specialty: [m("specialty", oncology)] });
  assert.equal(facts.outcome, "fallback_only");
  assert.equal(facts.dedicatedPageAvailable, false);
  assert.equal(facts.topResultPath, "/chronic-care");
  assert.equal(facts.topResultDedicated, false);
});

test("a condition that only reaches its specialty/category page is fallback_only", () => {
  const unknown = condition(oncology, "Rare Tumour");
  const facts = classifySynth({ condition: [m("condition", unknown)] });
  assert.equal(facts.outcome, "fallback_only");
  assert.equal(facts.topResultDedicated, false);
  assert.equal(facts.topResultPath, "/chronic-care");
});

test("blog-only results are fallback_only", () => {
  const blog = { id: "b1", title: "Acid reflux guide", path: "/acid-reflux-guide" };
  const facts = classifySynth({ blog: [m("blog", blog)] });
  assert.equal(facts.outcome, "fallback_only");
  assert.deepEqual(facts.resultTypes, ["blog"]);
  assert.equal(facts.dedicatedPageAvailable, false);
  assert.equal(facts.topResultType, "blog");
  assert.equal(facts.topResultDedicated, false);
});

test("a blog next to a relevant dedicated page does not hide that page", () => {
  const blog = { id: "b1", title: "Heart guide", path: "/heart-guide" };
  const migraine = condition(cardiology, "High Blood Pressure");
  const facts = classifySynth({ condition: [m("condition", migraine, 100)], blog: [m("blog", blog, 100)] });
  assert.equal(facts.outcome, "dedicated_page_found");
});

test("a dedicated page below the relevance threshold does not count as covered", () => {
  const bp = condition(cardiology, "High Blood Pressure");
  const weak = classifySynth({ condition: [m("condition", bp, RELEVANT_SCORE - 1)] });
  assert.equal(weak.outcome, "fallback_only");
  assert.equal(weak.dedicatedPageAvailable, true); // a page exists, just not a relevant match
  const exact = classifySynth({ condition: [m("condition", bp, RELEVANT_SCORE)] });
  assert.equal(exact.outcome, "dedicated_page_found");
});

test("AI-intent matches count like any other relevant match", () => {
  const bp = condition(cardiology, "High Blood Pressure");
  const facts = classifySynth({ condition: [{ type: "condition", record: bp, score: 90, matchedOn: "intent" }] });
  assert.equal(facts.outcome, "dedicated_page_found");
});

test("the top result is the highest score; ties keep type order", () => {
  const bp = condition(cardiology, "High Blood Pressure");
  const facts = classifySynth({ specialty: [m("specialty", cardiology, 80)], condition: [m("condition", bp, 90)] });
  assert.equal(facts.topResultType, "condition");
  assert.equal(facts.topScore, 90);
});

test("doctor results are flagged and never expose a path", () => {
  const doctor = { doctorId: 12345, displayName: "Dr. Rahul Testname" };
  const facts = classifySynth({ doctor: [m("doctor", doctor, 100)] });
  assert.equal(facts.hasDoctor, true);
  assert.equal(facts.topResultPath, null);
  assert.equal(facts.topResultType, null);
});

// ── AI status / confirmed gaps ────────────────────────────────────────────
test("deriveAiStatus", () => {
  assert.equal(deriveAiStatus({ requested: false }), "not_requested");
  assert.equal(deriveAiStatus({ requested: true, consulted: false }), "not_needed");
  assert.equal(deriveAiStatus({ requested: true, consulted: true, used: true, status: "ok" }), "used");
  assert.equal(deriveAiStatus({ requested: true, consulted: true, used: false, status: "ok" }), "no_match");
  assert.equal(deriveAiStatus({ requested: true, consulted: true, used: false, status: "failed" }), "unavailable");
  assert.equal(deriveAiStatus({ requested: true, consulted: true, used: false, status: "skipped" }), "unavailable");
  assert.equal(deriveAiStatus({ requested: true, consulted: true }), "unavailable");
  assert.equal(deriveAiStatus(), "not_requested");
});

test("AI-unavailable events never count as confirmed content gaps", () => {
  assert.equal(isConfirmedGap({ outcome: "no_results", aiStatus: "unavailable" }), false);
  assert.equal(isConfirmedGap({ outcome: "fallback_only", aiStatus: "unavailable" }), false);
  assert.equal(isConfirmedGap({ outcome: "no_results", aiStatus: "no_match" }), true);
  assert.equal(isConfirmedGap({ outcome: "fallback_only", aiStatus: "not_requested" }), true);
  assert.equal(isConfirmedGap({ outcome: "fallback_only", aiStatus: "not_needed" }), true);
  assert.equal(isConfirmedGap({ outcome: "dedicated_page_found", aiStatus: "no_match" }), false);
});

// ── Route resolution agrees with the public response ──────────────────────
test("resolveNavigation paths equal the public navigation paths", () => {
  for (const q of ["acne", "teen acne", "migraine", "chronic migraine", "diabetes", "doctor's note", "skin rash", "eczema",
    "dermatology", "skin", "children", "cardiology", "adolescent", "heart", "pain"]) {
    const matches = matchCatalog(catalog, validateQuery(q), { types: DEFAULT_SEARCH_TYPES });
    const { results } = buildResults(matches, catalog);
    for (const [type, list] of Object.entries(matches)) {
      list.forEach((match, i) => {
        const publicPath = results[RESULT_GROUPS[type]][i].navigation.path;
        assert.equal(resolveNavigation(type, match.record, catalog.index).path, publicPath, `${q}/${type}`);
      });
    }
  }
});

test("fallback navigation is never marked dedicated", () => {
  const nav = (name) => resolveNavigation("condition", catalog.conditions.find((c) => c.name === name), catalog.index);
  assert.equal(nav("Acne").dedicated, true);
  assert.equal(nav("Teen acne").dedicated, false); // specialty-page fallback
  assert.equal(nav("Chronic Migraine").dedicated, false);
  assert.equal(nav("Skin Rash").dedicated, true); // unsafe stored route ignored, slug page found
  // No legacyId in the fixture, so the slugified name has no page: fallback.
  assert.equal(nav("Doctor's Note").dedicated, false);
  const withLegacyId = { ...catalog.conditions.find((c) => c.name === "Doctor's Note"), legacyId: "doctors-note" };
  assert.deepEqual(resolveNavigation("service", withLegacyId, catalog.index), { path: "/doctors-note", dedicated: true });
});

test("classification is deterministic and does not mutate its input", () => {
  const matches = run("acne");
  const snapshot = JSON.stringify(matches);
  assert.deepEqual(classify(matches), classify(matches));
  assert.equal(JSON.stringify(matches), snapshot);
});
