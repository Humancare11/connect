// Records one settled search interaction. This is the ONLY module allowed to
// write the SearchInteraction model (see tests/search/securityStatic.test.js).
//
// Input is a plain, allowlisted object - never a request object, so nothing
// about who made the search can reach storage:
//
//   { interactionId, q, settledBy, aiStatus, matches, index }
//
//   q        the search text as validated/normalised by the search pipeline
//   matches  internal matcher output ({ [type]: [{ record, score, ... }] })
//   index    catalog.index
//
// Everything stored (counts, types, outcome, page availability) is recomputed
// here from `matches`; nothing about results comes from a client.
//
// recordSearchInteraction NEVER throws. Failures only produce a result
// status, and are logged as an error name and code - never the text, the
// document or an error message.

const SearchInteraction = require("../../models/SearchInteraction");
const { analyzeForAnalytics } = require("../search/queryRedaction");
const { validateQuery, normalizeForMatch, singularForm } = require("../search/queryNormalizer");
const { classifyOutcome } = require("./classifyOutcome");
const { SCHEMA_VERSION, RAW_RETENTION_DAYS, SETTLED_BY, AI_STATUSES, UUID_V4 } = require("./constants");

const DAY_MS = 24 * 60 * 60 * 1000;
const DUPLICATE_KEY = 11000;
const ALLOWED_KEYS = ["interactionId", "q", "settledBy", "aiStatus", "matches", "index"];

const isPlainObject = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

function validDto(dto) {
  if (!isPlainObject(dto)) return false;
  const keys = Object.keys(dto);
  if (keys.length !== ALLOWED_KEYS.length || keys.some((key) => !ALLOWED_KEYS.includes(key))) return false;
  return (
    typeof dto.interactionId === "string" && UUID_V4.test(dto.interactionId) &&
    typeof dto.q === "string" &&
    SETTLED_BY.includes(dto.settledBy) &&
    AI_STATUSES.includes(dto.aiStatus) &&
    isPlainObject(dto.matches) &&
    isPlainObject(dto.index)
  );
}

// Only the error name and code are ever logged.
function logWriteFailure(err, logger) {
  const name = typeof err?.name === "string" ? err.name.slice(0, 60) : "Error";
  const code = typeof err?.code === "number" || typeof err?.code === "string" ? String(err.code).slice(0, 40) : "none";
  try {
    logger(`[search-analytics] write failed: ${name} ${code}`);
  } catch {
    // Logging must never throw either.
  }
}

// Builds the validated document fields, or a { status, reasons } to return.
function buildDocument(dto, now) {
  let term;
  try {
    term = validateQuery(dto.q);
  } catch {
    return { status: "invalid" };
  }

  const analysis = analyzeForAnalytics(term);
  if (!analysis.store) return { status: "dropped", reasons: analysis.reasons };

  const termKey = singularForm(normalizeForMatch(term));
  if (!termKey) return { status: "invalid" };

  const { hasDoctor, ...facts } = classifyOutcome({ matches: dto.matches, index: dto.index });
  if (hasDoctor) return { status: "dropped", reasons: ["doctor"] };

  return {
    doc: {
      interactionId: dto.interactionId,
      term,
      termKey,
      settledBy: dto.settledBy,
      aiStatus: dto.aiStatus,
      ...facts,
      schemaVersion: SCHEMA_VERSION,
      expiresAt: new Date(now().getTime() + RAW_RETENTION_DAYS * DAY_MS),
    },
  };
}

// store: anything with Model-style updateOne(filter, update, options)
function createSearchInteractionRecorder({ store = SearchInteraction, now = () => new Date(), logger = console.error } = {}) {
  return async function recordSearchInteraction(dto) {
    try {
      if (!validDto(dto)) return { status: "invalid" };

      const built = buildDocument(dto, now);
      if (!built.doc) return built;

      // Same schema rules as the model, checked before any write (an upsert
      // does not run validators by itself). Only a validation failure means
      // "invalid"; anything else is a real error and falls to the catch below.
      try {
        await new SearchInteraction(built.doc).validate();
      } catch (err) {
        if (err?.name === "ValidationError") return { status: "invalid" };
        throw err;
      }

      const { interactionId, expiresAt, ...fields } = built.doc;
      // A submitted ("full") interaction is final: it is never matched, so
      // neither a late idle/select event nor a repeated submit overwrites it.
      const filter = { interactionId, settledBy: { $ne: "submit" } };
      const update = { $set: fields, $setOnInsert: { expiresAt } };

      try {
        const written = await store.updateOne(filter, update, { upsert: true });
        return { status: written && written.upsertedCount ? "recorded" : written && written.matchedCount ? "updated" : "ignored" };
      } catch (err) {
        if (err?.code !== DUPLICATE_KEY) throw err;
        // The document exists already (a concurrent first write, or a final
        // submit). Retry once as a plain guarded update: it applies only if
        // the existing document is not final.
        const written = await store.updateOne(filter, update, { upsert: false });
        return { status: written && written.matchedCount ? "updated" : "ignored" };
      }
    } catch (err) {
      logWriteFailure(err, logger);
      return { status: "error" };
    }
  };
}

const recordSearchInteraction = createSearchInteractionRecorder();

module.exports = { recordSearchInteraction, createSearchInteractionRecorder };
