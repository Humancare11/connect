// Builds raw SearchInteraction documents with exact timestamps, for tests that
// run against a throwaway in-memory MongoDB (never a real database). They are
// inserted through the driver so createdAt / updatedAt / expiresAt can be
// controlled; every other field follows the model's rules.
let counter = 0;
const nextId = () => {
  counter += 1;
  return `00000000-0000-4000-8000-${counter.toString(16).padStart(12, "0")}`;
};

const OUTCOME_FIELDS = {
  dedicated_page_found: {
    resultCount: 1, resultTypes: ["condition"], dedicatedPageAvailable: true,
    topResultType: "condition", topResultPath: "/skin-and-hair-care/dermatology/acne", topResultDedicated: true, topScore: 100,
  },
  fallback_only: {
    resultCount: 1, resultTypes: ["specialty"], dedicatedPageAvailable: false,
    topResultType: "specialty", topResultPath: "/chronic-care", topResultDedicated: false, topScore: 80,
  },
  no_results: {
    resultCount: 0, resultTypes: [], dedicatedPageAvailable: false,
    topResultType: null, topResultPath: null, topResultDedicated: null, topScore: null,
  },
};

// overrides may set term, termKey, settledBy, aiStatus, outcome, createdAt (Date | ISO string), and any raw field.
function interaction(overrides = {}) {
  const outcome = overrides.outcome || "dedicated_page_found";
  const settledBy = overrides.settledBy || "idle";
  const createdAt = new Date(overrides.createdAt || "2026-10-08T12:00:00.000Z");
  const term = overrides.term || overrides.termKey || "acne";
  return {
    interactionId: nextId(),
    term,
    termKey: overrides.termKey || term,
    settledBy,
    aiStatus: overrides.aiStatus || (settledBy === "submit" ? "not_needed" : "not_requested"),
    outcome,
    schemaVersion: 1,
    ...OUTCOME_FIELDS[outcome],
    expiresAt: new Date(createdAt.getTime() + 90 * 24 * 60 * 60 * 1000),
    ...overrides,
    createdAt,
    updatedAt: createdAt,
  };
}

// n copies (distinct interactionIds) of one shape.
const many = (n, overrides = {}) => Array.from({ length: n }, () => interaction(overrides));

module.exports = { interaction, many };
