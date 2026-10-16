const mongoose = require("mongoose");

const MAX_ALIASES = 30;

const healthcareConditionSchema = new mongoose.Schema(
  {
    specialtyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HealthcareSpecialty",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    icon: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },
    // Booking visibility: only active conditions appear in /api/appointment-tree.
    isActive: {
      type: Boolean,
      default: true,
    },
    // Global discovery search visibility (PR 8.1), independent of isActive.
    // Safe default: a new record is not searchable unless set. Records created
    // before this field existed have no value and keep their old behaviour
    // (searchable while active); see services/search/searchVisibility.js.
    isSearchable: {
      type: Boolean,
      default: false,
    },

    // ── Search taxonomy fields (internal) ────────────────────────────────
    // Not part of the public /api/appointment-tree response: that endpoint
    // projects conditions to an explicit allowlist (see getAppointmentTree).

    // Patient-language / search-language terms, e.g. "pimples" for Acne.
    aliases: {
      type: [{ type: String, trim: true, maxlength: 60 }],
      default: [],
      validate: {
        validator: (value) => !Array.isArray(value) || value.length <= MAX_ALIASES,
        message: `A condition can have at most ${MAX_ALIASES} aliases.`,
      },
    },
    kind: {
      type: String,
      enum: ["condition", "service"],
      default: "condition",
    },
    // Identifier from the legacy frontend searchIndex.js, kept for migration
    // traceability. Left unset on records that did not come from it.
    legacyId: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 140,
      match: /^[a-z0-9-]*$/,
      default: "",
    },
    // Legacy marketing/content route, only where one still needs supporting.
    route: {
      type: String,
      trim: true,
      maxlength: 200,
      match: /^(\/\S*)?$/,
      default: "",
    },
  },
  {
    timestamps: true,
    // Index builds for this collection are run explicitly (reviewed migration
    // step), never automatically on server start: the live collection still
    // carries a legacy non-unique { specialtyId, name } index and its data
    // must be checked for duplicates before the unique indexes below exist.
    autoIndex: false,
  },
);

// Condition names are unique within a specialty, case-insensitively.
healthcareConditionSchema.index(
  { specialtyId: 1, name: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 },
    name: "uniq_specialty_condition_name",
  },
);
// legacyId is unique only where it is set.
healthcareConditionSchema.index(
  { legacyId: 1 },
  {
    unique: true,
    partialFilterExpression: { legacyId: { $gt: "" } },
    name: "uniq_condition_legacyId",
  },
);
// slug is unique within a specialty only where it is non-empty.
healthcareConditionSchema.index(
  { specialtyId: 1, slug: 1 },
  {
    unique: true,
    partialFilterExpression: { slug: { $gt: "" } },
    name: "uniq_specialty_condition_slug",
  },
);

module.exports = mongoose.model("HealthcareCondition", healthcareConditionSchema);
