const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

// Any accidental database call fails immediately instead of buffering.
mongoose.set("bufferCommands", false);

const SearchTermDailyStat = require("../../models/SearchTermDailyStat");

const counts = (idle, select, submit) => ({ idle, select, submit });
const termRow = () => ({
  _id: "2026-10-08|term|acne",
  day: new Date("2026-10-08T00:00:00.000Z"),
  kind: "term",
  termKey: "acne",
  term: "acne",
  interactions: 5,
  bySettledBy: counts(3, 1, 1),
  outcomes: { dedicated_page_found: 4, fallback_only: 1, no_results: 0 },
  aiStatuses: { not_requested: 4, not_needed: 1, used: 0, no_match: 0, unavailable: 0 },
  dedicatedPageAvailableCount: 4,
  topResultPath: "/skin-and-hair-care/dermatology/acne",
  topResultPathCount: 4,
  topResultDedicated: true,
  distinctTerms: null,
  finalized: true,
  computedAt: new Date("2026-10-09T09:00:00.000Z"),
  schemaVersion: 1,
  expiresAt: new Date("2027-11-08T00:00:00.000Z"),
});
const otherRow = () => ({
  ...termRow(),
  _id: "2026-10-08|other|",
  kind: "other",
  termKey: null,
  term: null,
  interactions: 3,
  bySettledBy: counts(1, 1, 1),
  outcomes: { dedicated_page_found: 1, fallback_only: 1, no_results: 1 },
  aiStatuses: { not_requested: 2, not_needed: 1, used: 0, no_match: 0, unavailable: 0 },
  dedicatedPageAvailableCount: 1,
  topResultPath: null,
  topResultPathCount: null,
  topResultDedicated: null,
  distinctTerms: 2,
});

const errorsFor = async (row) => {
  try {
    await new SearchTermDailyStat(row).validate();
    return [];
  } catch (thrown) {
    return thrown.name === "ValidationError" ? Object.keys(thrown.errors) : [`thrown:${thrown.name}`];
  }
};
const rejects = async (row, field) => assert.ok((await errorsFor(row)).includes(field), `${field}: ${JSON.stringify(await errorsFor(row))}`);

test("valid term and 'other' rows are accepted", async () => {
  assert.deepEqual(await errorsFor(termRow()), []);
  assert.deepEqual(await errorsFor(otherRow()), []);
  assert.deepEqual(await errorsFor({ ...otherRow(), interactions: 0, bySettledBy: counts(0, 0, 0), outcomes: { dedicated_page_found: 0, fallback_only: 0, no_results: 0 }, aiStatuses: { not_requested: 0, not_needed: 0, used: 0, no_match: 0, unavailable: 0 }, dedicatedPageAvailableCount: 0, distinctTerms: 0 }), []);
});

test("collection, strictness, 13-month TTL and indexes", () => {
  assert.equal(SearchTermDailyStat.collection.name, "searchtermdailystats");
  assert.equal(SearchTermDailyStat.schema.options.strict, "throw");
  const indexes = SearchTermDailyStat.schema.indexes();
  const find = (keys) => indexes.find(([spec]) => JSON.stringify(spec) === JSON.stringify(keys));
  assert.deepEqual(find({ expiresAt: 1 })[1], { expireAfterSeconds: 0 });
  assert.ok(find({ day: 1, kind: 1 }));
  assert.ok(find({ termKey: 1, day: -1 }));
  assert.equal(indexes.length, 3);
});

test("the schema is an exact allowlist with no identity, network or record references", () => {
  assert.deepEqual(Object.keys(SearchTermDailyStat.schema.paths).sort().filter((p) => !p.includes(".")), [
    "_id", "aiStatuses", "bySettledBy", "computedAt", "day", "dedicatedPageAvailableCount", "distinctTerms", "expiresAt",
    "finalized", "interactions", "kind", "outcomes", "schemaVersion", "term", "termKey", "topResultDedicated",
    "topResultPath", "topResultPathCount",
  ]);
  for (const [name, path] of Object.entries(SearchTermDailyStat.schema.paths)) {
    assert.ok(!path.options.ref, `${name} must not reference another collection`);
  }
});

test("unknown fields are rejected, not silently stored", async () => {
  for (const extra of ["ip", "userId", "interactionId", "patientId", "rawQuery"]) {
    assert.deepEqual(await errorsFor({ ...termRow(), [extra]: "x" }), ["thrown:StrictModeError"], extra);
  }
});

test("a term row needs 3+ interactions, a key and text; the id must match", async () => {
  await rejects({ ...termRow(), interactions: 2, bySettledBy: counts(1, 1, 0), outcomes: { dedicated_page_found: 2, fallback_only: 0, no_results: 0 }, aiStatuses: { not_requested: 2, not_needed: 0, used: 0, no_match: 0, unavailable: 0 }, dedicatedPageAvailableCount: 2 }, "kind");
  await rejects({ ...termRow(), term: null }, "kind");
  await rejects({ ...termRow(), termKey: null }, "kind");
  await rejects({ ...termRow(), _id: "2026-10-08|term|other thing" }, "kind");
  await rejects({ ...termRow(), _id: "2026-10-09|term|acne" }, "kind");
  await rejects({ ...termRow(), distinctTerms: 4 }, "kind");
});

test("an 'other' row carries counts only: no term, key, path or per-term data", async () => {
  await rejects({ ...otherRow(), term: "rare thing" }, "kind");
  await rejects({ ...otherRow(), termKey: "rare thing" }, "kind");
  await rejects({ ...otherRow(), topResultPath: "/x" }, "kind");
  await rejects({ ...otherRow(), topResultPathCount: 1 }, "kind");
  await rejects({ ...otherRow(), topResultDedicated: true }, "kind");
  await rejects({ ...otherRow(), distinctTerms: null }, "kind");
  await rejects({ ...otherRow(), _id: "2026-10-08|term|acne" }, "kind"); // an 'other' row cannot wear a term id
});

test("breakdowns must add up to the interaction count", async () => {
  await rejects({ ...termRow(), bySettledBy: counts(3, 1, 0) }, "interactions");
  await rejects({ ...termRow(), outcomes: { dedicated_page_found: 5, fallback_only: 1, no_results: 0 } }, "interactions");
  await rejects({ ...termRow(), aiStatuses: { not_requested: 1, not_needed: 1, used: 0, no_match: 0, unavailable: 0 } }, "interactions");
  await rejects({ ...termRow(), dedicatedPageAvailableCount: 6 }, "interactions");
});

test("field limits, formats and the privacy check on stored term text", async () => {
  await rejects({ ...termRow(), day: new Date("2026-10-08T01:00:00.000Z") }, "day"); // not UTC midnight
  await rejects({ ...termRow(), _id: "2026-10-08|term|Acne" }, "_id");
  await rejects({ ...termRow(), _id: "x" }, "_id");
  await rejects({ ...termRow(), kind: "weekly" }, "kind");
  await rejects({ ...termRow(), interactions: -1 }, "interactions");
  await rejects({ ...termRow(), interactions: 5.5 }, "interactions");
  await rejects({ ...termRow(), term: "mail me@example.com" }, "term");
  await rejects({ ...termRow(), topResultPath: "//evil.example" }, "topResultPath");
  await rejects({ ...termRow(), topResultPath: "javascript:alert(1)" }, "topResultPath");
  await rejects({ ...termRow(), expiresAt: undefined }, "expiresAt");
  await rejects({ ...termRow(), computedAt: undefined }, "computedAt");
  await rejects({ ...termRow(), outcomes: { dedicated_page_found: 5, fallback_only: 0, no_results: 0, extra: 1 } }, "outcomes");
});
