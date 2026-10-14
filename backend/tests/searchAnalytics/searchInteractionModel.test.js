const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

// Any accidental database call fails immediately instead of buffering.
mongoose.set("bufferCommands", false);

const SearchInteraction = require("../../models/SearchInteraction");

const valid = () => ({
  interactionId: "6f1c2a9e-3b7d-4c58-9a1e-0d2f5b8e7c41",
  term: "heartburn at night",
  termKey: "heartburn at night",
  settledBy: "submit",
  aiStatus: "used",
  resultCount: 2,
  resultTypes: ["condition", "specialty"],
  outcome: "dedicated_page_found",
  dedicatedPageAvailable: true,
  topResultType: "condition",
  topResultPath: "/chronic-care/gastroenterology/acid-reflux-gerd",
  topResultDedicated: true,
  topScore: 90,
  schemaVersion: 1,
  expiresAt: new Date("2027-01-07T08:14:22.000Z"),
});

// Awaited document validation - the same call the recorder makes. Resolves to
// the list of invalid field paths ([] when valid).
const errorsFor = async (doc) => {
  try {
    await new SearchInteraction(doc).validate();
    return [];
  } catch (thrown) {
    return thrown.name === "ValidationError" ? Object.keys(thrown.errors) : [`thrown:${thrown.name}`];
  }
};
const rejects = async (patch, field) =>
  assert.ok((await errorsFor({ ...valid(), ...patch })).includes(field), `${field} ${JSON.stringify(patch)}`);

test("the approved example document is valid", async () => {
  assert.deepEqual(await errorsFor(valid()), []);
});

test("the model is validated with awaited validation, not validateSync", () => {
  assert.equal(typeof new SearchInteraction(valid()).validate, "function");
  assert.ok(!/validateSync\(/.test(require("fs").readFileSync(require.resolve("../../models/SearchInteraction"), "utf8")));
});

test("collection, strictness and field allowlist are exact", () => {
  assert.equal(SearchInteraction.collection.name, "searchinteractions");
  assert.equal(SearchInteraction.schema.options.strict, "throw");
  assert.equal(SearchInteraction.schema.options.versionKey, false);
  assert.deepEqual(Object.keys(SearchInteraction.schema.paths).sort(), [
    "_id", "aiStatus", "createdAt", "dedicatedPageAvailable", "expiresAt", "interactionId", "outcome",
    "resultCount", "resultTypes", "schemaVersion", "settledBy", "term", "termKey", "topResultDedicated",
    "topResultPath", "topResultType", "topScore", "updatedAt",
  ]);
});

test("the schema has no identity, network, session or record references", () => {
  const paths = Object.keys(SearchInteraction.schema.paths).join(" ").toLowerCase();
  for (const forbidden of ["ip", "user", "patient", "account", "session", "email", "phone", "doctorid", "appointment",
    "consultation", "agent", "header", "cookie"]) {
    assert.ok(!new Set(paths.split(" ")).has(forbidden), forbidden);
  }
  for (const [name, path] of Object.entries(SearchInteraction.schema.paths)) {
    assert.ok(!path.options.ref, `${name} must not reference another collection`);
  }
});

test("unknown fields are rejected, not silently stored", async () => {
  for (const extra of ["ip", "userId", "patientId", "userAgent", "email", "rawQuery"]) {
    assert.deepEqual(await errorsFor({ ...valid(), [extra]: "x" }), ["thrown:StrictModeError"], extra);
  }
});

test("interactionId must be a lowercase UUIDv4", async () => {
  for (const bad of ["", "abc", "6F1C2A9E-3B7D-4C58-9A1E-0D2F5B8E7C41", "6f1c2a9e-3b7d-1c58-9a1e-0d2f5b8e7c41",
    "6f1c2a9e-3b7d-4c58-7a1e-0d2f5b8e7c41", "6f1c2a9e3b7d4c589a1e0d2f5b8e7c41", `${valid().interactionId} `]) {
    await rejects({ interactionId: bad }, "interactionId");
  }
});

test("term and termKey are bounded and must pass the privacy check", async () => {
  for (const term of ["a", "x".repeat(101), "mail me@example.com", "call 5551234567", "dr rahul", "bad\u0000term",
    "my name is raj"]) {
    await rejects({ term }, "term");
  }
  for (const termKey of ["Upper", "has-dash", "double  space", " lead", "x".repeat(101), ""]) {
    await rejects({ termKey }, "termKey");
  }
});

test("enums, counts and result lists are constrained", async () => {
  await rejects({ settledBy: "instant" }, "settledBy");
  await rejects({ aiStatus: "maybe" }, "aiStatus");
  await rejects({ outcome: "gap" }, "outcome");
  await rejects({ resultCount: 26 }, "resultCount");
  await rejects({ resultCount: -1 }, "resultCount");
  await rejects({ resultCount: 1.5 }, "resultCount");
  await rejects({ topScore: 101 }, "topScore");
  await rejects({ topScore: -1 }, "topScore");
  await rejects({ resultTypes: ["condition", "condition"] }, "resultTypes");
  await rejects({ resultTypes: ["doctor"] }, "resultTypes.0");
  await rejects({ topResultType: "doctor" }, "topResultType");
  await rejects({ expiresAt: undefined }, "expiresAt");
  await rejects({ interactionId: undefined }, "interactionId");
});

test("topResultPath must be a plain same-site path", async () => {
  for (const path of ["javascript:alert(1)", "//evil.example", "https://evil.example/", "/a b", "/a?x=1", `/${"a".repeat(200)}`]) {
    await rejects({ topResultPath: path }, "topResultPath");
  }
  assert.deepEqual(await errorsFor({ ...valid(), topResultPath: "/women-health/menopause-care" }), []);
});

test("cross-field consistency is enforced by awaited validation", async () => {
  const empty = {
    resultCount: 0, resultTypes: [], outcome: "no_results", dedicatedPageAvailable: false,
    topResultType: null, topResultPath: null, topResultDedicated: null, topScore: null,
  };
  // Valid combinations are accepted ...
  assert.deepEqual(await errorsFor({ ...valid(), ...empty }), []);
  assert.deepEqual(await errorsFor({ ...valid(), settledBy: "select", aiStatus: "not_requested" }), []);
  assert.deepEqual(await errorsFor({ ...valid(), settledBy: "idle", aiStatus: "not_requested" }), []);
  assert.deepEqual(await errorsFor({ ...valid(), settledBy: "submit", aiStatus: "unavailable" }), []);
  assert.deepEqual(
    await errorsFor({ ...valid(), outcome: "fallback_only", dedicatedPageAvailable: false, resultTypes: ["blog"], topResultType: "blog" }),
    [],
  );
  // ... inconsistent ones are rejected.
  await rejects({ ...empty, outcome: "fallback_only" }, "outcome");
  await rejects({ outcome: "no_results" }, "outcome");
  await rejects({ ...empty, resultTypes: ["blog"] }, "resultCount");
  await rejects({ ...empty, dedicatedPageAvailable: true }, "resultCount");
  await rejects({ ...empty, topResultPath: "/x" }, "resultCount");
  await rejects({ resultTypes: [] }, "resultTypes");
  await rejects({ dedicatedPageAvailable: false }, "dedicatedPageAvailable");
  await rejects({ settledBy: "idle" }, "aiStatus"); // idle with an AI status
  await rejects({ settledBy: "select" }, "aiStatus");
  await rejects({ settledBy: "submit", aiStatus: "not_requested" }, "aiStatus");
});

test("indexes: unique id, 90-day TTL on expiresAt, date, outcome and termKey", () => {
  const indexes = SearchInteraction.schema.indexes();
  const find = (keys) => indexes.find(([spec]) => JSON.stringify(spec) === JSON.stringify(keys));
  assert.deepEqual(find({ interactionId: 1 })[1], { unique: true });
  assert.deepEqual(find({ expiresAt: 1 })[1], { expireAfterSeconds: 0 });
  assert.ok(find({ createdAt: -1 }));
  assert.ok(find({ outcome: 1, createdAt: -1 }));
  assert.ok(find({ termKey: 1, createdAt: -1 }));
  assert.equal(indexes.length, 5);
});

test("a maximal document stays far below one kilobyte of payload", async () => {
  const max = {
    ...valid(),
    term: "a".repeat(100), termKey: "a".repeat(100),
    resultTypes: ["category", "specialty", "condition", "service", "blog"],
    topResultPath: `/${"a".repeat(199)}`,
  };
  assert.deepEqual(await errorsFor(max), []);
  assert.ok(Buffer.byteLength(JSON.stringify(max)) < 1024);
});
