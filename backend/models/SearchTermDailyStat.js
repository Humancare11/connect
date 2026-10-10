const mongoose = require("mongoose");
const { analyzeForAnalytics } = require("../services/search/queryRedaction");
const {
  analyticsSchemaOptions,
  MIN_TERM_INTERACTIONS,
  SCHEMA_VERSION,
  SETTLED_BY,
  AI_STATUSES,
  OUTCOMES,
  MAX_TERM_LENGTH,
  MAX_PATH_LENGTH,
  SAFE_PATH,
} = require("../services/searchAnalytics/constants");

// One row per UTC day, rolled up from SearchInteraction (see
// services/searchAnalytics/rollup.js). Two kinds of row per day:
//
//   kind "term"   a normalised term with at least MIN_TERM_INTERACTIONS (3)
//                 interactions that day. Carries the term text (it already
//                 passed the privacy check when it was first stored).
//   kind "other"  everything else that day, folded together as COUNTS ONLY:
//                 no term text, no term keys. Written for every processed day,
//                 so it also marks "this day has been rolled up".
//
// _id is "<YYYY-MM-DD>|term|<termKey>" or "<YYYY-MM-DD>|other|", so re-running
// a day rewrites the same documents instead of adding new ones. Kept for 13
// months (TTL on expiresAt). Standalone: no references to any other collection.
const KINDS = ["term", "other"];
const SUMMED_GROUPS = ["bySettledBy", "outcomes", "aiStatuses"];

const counter = { type: Number, required: true, default: 0, min: 0, validate: { validator: Number.isInteger, message: "must be an integer" } };
const countsOf = (keys) => new mongoose.Schema(Object.fromEntries(keys.map((key) => [key, counter])), { _id: false, strict: "throw" });

const searchTermDailyStatSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}\|(term\|[a-z0-9]+(?: [a-z0-9]+)*|other\|)$/ },
    day: { type: Date, required: true },
    kind: { type: String, required: true, enum: KINDS },
    termKey: { type: String, default: null, maxlength: MAX_TERM_LENGTH },
    // Representative text for the key (the most frequent spelling that day).
    term: {
      type: String,
      default: null,
      maxlength: MAX_TERM_LENGTH,
      validate: { validator: (v) => v === null || analyzeForAnalytics(v).store === true, message: "term failed the privacy check" },
    },
    interactions: counter,
    bySettledBy: { type: countsOf(SETTLED_BY), required: true },
    outcomes: { type: countsOf(OUTCOMES), required: true },
    aiStatuses: { type: countsOf(AI_STATUSES), required: true },
    dedicatedPageAvailableCount: counter,
    // Most common top-result path that day (term rows only).
    topResultPath: {
      type: String,
      default: null,
      maxlength: MAX_PATH_LENGTH,
      validate: { validator: (v) => v === null || SAFE_PATH.test(v), message: "topResultPath must be a plain site path" },
    },
    topResultPathCount: { type: Number, default: null, min: 0 },
    topResultDedicated: { type: Boolean, default: null },
    // "other" rows only: how many different terms were folded in (a number, never the terms).
    distinctTerms: { type: Number, default: null, min: 0 },
    // True once the day can no longer change (computed >= 2 h after it ended).
    finalized: { type: Boolean, required: true, default: false },
    computedAt: { type: Date, required: true },
    schemaVersion: { type: Number, required: true, default: SCHEMA_VERSION },
    // day + 13 months; the TTL index below removes the row.
    expiresAt: { type: Date, required: true },
  },
  { collection: "searchtermdailystats", strict: "throw", versionKey: false, timestamps: false, ...analyticsSchemaOptions() },
);

// Cross-field rules as path validators, so every validation entry point enforces them.
searchTermDailyStatSchema.path("kind").validate(function kindMatchesShape(value) {
  if (value === "term") {
    return Boolean(this.termKey && this.term) && this.interactions >= MIN_TERM_INTERACTIONS &&
      this.distinctTerms === null && this._id === `${this.day.toISOString().slice(0, 10)}|term|${this.termKey}`;
  }
  // "other": counts only - no term text, no key, no per-term fields.
  return this.termKey === null && this.term === null && this.topResultPath === null &&
    this.topResultPathCount === null && this.topResultDedicated === null && Number.isInteger(this.distinctTerms) &&
    this._id === `${this.day.toISOString().slice(0, 10)}|other|`;
}, "row shape does not match its kind");
searchTermDailyStatSchema.path("day").validate(
  (value) => value.getTime() % (24 * 60 * 60 * 1000) === 0,
  "day must be UTC midnight",
);
searchTermDailyStatSchema.path("interactions").validate(function groupsAddUp(value) {
  const total = (group) => Object.values(group.toObject ? group.toObject() : group).reduce((a, b) => a + b, 0);
  return SUMMED_GROUPS.every((name) => total(this[name]) === value) && this.dedicatedPageAvailableCount <= value;
}, "breakdowns must add up to interactions");

searchTermDailyStatSchema.index({ day: 1, kind: 1 });
searchTermDailyStatSchema.index({ termKey: 1, day: -1 });
// 13-month retention (expireAfterSeconds counts from expiresAt itself).
searchTermDailyStatSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const SearchTermDailyStat = mongoose.model("SearchTermDailyStat", searchTermDailyStatSchema);

module.exports = SearchTermDailyStat;
